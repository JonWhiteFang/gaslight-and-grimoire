# Phase 2 — Deduction Feedback Legibility (design spec)

> **Type:** Implementation design spec. Feeds a Codex-gated implementation plan (writing-plans next).
> **Date:** 2026-07-14 · **v3** after two Codex spec-review rounds.
> - **Round 1** ([review](../../../codex/output/2026-07-14-phase2-deduction-feedback-review.md)) killed the
>   original **tag-overlap** oracle (3 Blockers: tags ≠ authored relationships; a live red-herring recipe
>   gates a branch; the button unmounts and loses the message).
> - **Round 2** ([review](../../../codex/output/2026-07-14-phase2-deduction-feedback-round2-review.md))
>   killed the **recipe-only** oracle: it can't form on a flattened id union without topology (Blocker
>   N1), makes deduction **impossible in all 4 vignettes** (they ship no recipes — N3), turns `partial`
>   into a recipe-membership farm (N4), and the status-revert was stale/destructive (N2/N5).
> This version uses a **two-graph** model over the **player's own connection topology**, with
> **`connectsTo`** (the authored relationship field) as the generic oracle. Every finding from both rounds
> is folded in.
> **Track:** UI/UX roadmap Phase 2 ([`docs/research/ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md)),
> backlog items **6** (deduction feedback) + **2** (`connected` colour-only fix, rides along).
> **Enacts (with an amendment):** [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md).
> **Consumes:** the Phase 1 global announcer (`src/announcer.ts`, `announce()`), PR #80.

---

## Problem

Connecting ≥2 clues and pressing **Attempt Deduction** rolls a Reason check (d20 vs DC 14). On
`success`/`critical` it forms a deduction (recipe subset-match → *key* deduction under a stable id, else a
generic one) and marks clues `deduced`; on `partial`/`failure`/`fumble` it marks them `contested`,
reverting after 2 s.

Two problems (research finding D3): **(1)** the roll gatekeeps whether reasoning pays off (a correct set
can fail on a bad roll; a wrong set can pass on a lucky one — players can't separate a reasoning error
from luck); **(2)** failure is binary and undirected (no "you're close" signal). ADR-0012 decided the
principle — *correctness gates formation, the roll only flavours* — and deferred to this spec what
"correct" means for a non-recipe connection and the tier→feedback mapping.

## Corpus facts that drove the model (verified)

- **`connectsTo` (not tags) is the authored clue-relationship field** (`src/types/index.ts:76`). Verified:
  no dangling edges across the corpus; **25 edges are one-way** → the graph is treated as **undirected**.
- **Vignettes ship no recipes.** `VignetteData` has no `recipes` field, `vignetteToCaseData` adds none,
  and no side-case has a `deductions.json`. A recipe-only oracle regresses all 4 vignettes to
  "these don't connect" forever (N3).
- **2 of 4 main-case recipes' `requiredClues` are NOT a connected `connectsTo` component** (e.g.
  `ms-deduction-fraud-and-breach`). So recipes **cannot** be validated against the `connectsTo` graph —
  they are their own authored truth, matched against the **player's** connections.
- **`connectedIds` is a flattened `Set` union of all connection pairs** (`EvidenceBoard.tsx:68`) — topology
  is lost. Classification must run over the **player's connection edges**, not the union (N1).
- **All `hasDeduction`/`requiresDeduction` targets are authored recipe ids** (the 7 recipe ids). The
  content strings `deductionist` / `wc-deductionist-pattern` / `lw-deductionist-timeline` are
  archetype/`setFlag` targets, **not** deductions. So generic deductions gate nothing — but they still
  populate the Journal/count, so they should still form.

## Decisions

1. **Two-graph classification over the player's connection topology.** Both layers use the *player's* own
   edges (the store's `connections` pairs, as an undirected graph), never the flattened union.
   - **Recipes (named key deductions):** a recipe matches iff **all** its `requiredClues` lie in a single
     connected component **the player wired** (their edges), with a deterministic winner. This preserves
     ADR-0005 gating and **fixes N1** (disjoint player-edges can't satisfy a recipe).
   - **Generic correctness (non-recipe, incl. all vignettes):** classify a player-connected component by
     how many of **its edges** are authored `connectsTo` relationships (undirected). This is the
     Golden-Idol-legible, authored-truth oracle that works for vignettes too, and **fixes N4** (partial
     means "you drew a real link and a false one," not "a recipe clue + noise").
2. **Per-attempt scope = one connected component.** The board submits the connected component the player
   just completed (the component containing the just-added edge), not every clue on the board — so other
   independent components are untouched (N1/N5).
3. **Four correctness states:** `correct` / `false` / `partial` / `incorrect` (see the classifier).
4. **Red-herring recipes still form**, framed as a false/uneasy insight (amber, not green) — keeping their
   gated branches reachable (B2).
5. **The d20 roll flavours a *formed* deduction only** (crit → sharper line); `partial`/`incorrect` roll
   nothing. Requires a dated ADR-0012 amendment (partial feedback is deterministic, not roll-driven).
6. **Status changes are snapshot/restore, via live store state** (N2/N5): never downgrade a
   `deduced`/`spent` clue; per-attempt token cancels overlapping revert timers.
7. **No anti-spam cost** in Phase 2 (deferred). Note directional feedback + component-scoping already blunt
   the round-2 farming vector (a lone clue + noise is now `incorrect`, not `partial`).

## Approach (A — engine-owned classification, board owns lifecycle)

Pure engine functions own correctness; the **board** owns connection topology, the transient outcome
banner, status snapshot/restore, and the single `announce()`. The **button** only triggers.

---

## Component 1 — `src/engine/classifyConnection.ts` (new, pure)

```ts
export type Correctness = 'correct' | 'false' | 'partial' | 'incorrect';

export interface ConnectionClassification {
  correctness: Correctness;
  recipe: KeyDeduction | null;   // matched recipe (correct|false), else null
  componentIds: string[];        // the player-connected component classified (the deduced/attempted set)
}

export function classifyConnection(
  edges: ReadonlyArray<{ fromId: string; toId: string }>,  // the PLAYER's connections
  seedId: string,                                          // a clue in the component to classify (e.g. last-connected)
  clues: Record<string, Clue>,
  recipes: KeyDeduction[],
): ConnectionClassification;
```

**Step 0 — resolve the component (topology, fixes N1).** Build an undirected adjacency from `edges` over
ids that are **own properties** of `clues` (prototype/dup-safe, mirrors `conditions.ts:29` `ownValue`).
Flood-fill from `seedId` to get `componentIds` (distinct). **Fail closed:** if `componentIds.length < 2`
→ `{ incorrect, null, componentIds }`.

**Step 1 — recipe match over the component (named layer).** `fullMatches` = recipes whose
`requiredClues` ⊆ `componentIds`. If any:
- winner = order by **non-red-herring first → largest `requiredClues` → lowest `id`** (deterministic,
  content-array-independent; makes the *true* `cc-deduction-one-true-murder` beat the herring
  `cc-deduction-poisoner` on a set with both, since they share `cc-clue-sloane-debts`).
- `!winner.isRedHerring` → `{ correct, winner, componentIds }`.
- `winner.isRedHerring` → `{ false, winner, componentIds }` *(still forms; framed uneasy)*.

**Step 2 — generic `connectsTo` classification (no recipe matched).** Let the component's player-edges be
`E`. An edge `(a,b)` is **authored** iff `b ∈ (clues[a].connectsTo ?? [])` **or** `a ∈ (clues[b].connectsTo
?? [])` (undirected). Then:
- **every** edge in `E` authored → `{ correct, null, componentIds }` *(a generic deduction — forms; see
  Component 3)*.
- **some but not all** authored → `{ partial, null, componentIds }`.
- **no** edge authored → `{ incorrect, null, componentIds }`.

*(Rationale: a 2-clue component is `correct` iff the single edge is an authored `connectsTo` link —
directly the authored relationship, not tag coincidence. Larger components must be fully authored to be
`correct`; a stray wrong link drops them to `partial` — genuine "some of these belong" directional
feedback.)*

**Purity:** no store, no `performCheck`, no `Date.now()`/`Math.random()`. This is the function ADR-0012's
*Confirmation* clause targets.

---

## Component 2 — `src/components/EvidenceBoard/DeductionButton.tsx` (trigger only)

Becomes a pure trigger — no outcome state, no colour phase, no revert timer, no local `<p>` (all move to
the board; fixes B3). `connectedClueIds.length < 2` → null (unchanged).

```
handleAttempt(): if !busy → onAttempt()   // board does the classification + everything else
```

- `onResult` → **`onAttempt()`** (no args; the board owns `connections`, `clues`, `recipes`,
  `investigator`).
- Disabled/label driven by a board-owned `attemptPhase` prop, not local state. No "Rolling…" (sync roll —
  batched no-op; Codex Minor). Accessible label neutral: "Attempt Deduction — connect these clues".

---

## Component 3 — `src/components/EvidenceBoard/EvidenceBoard.tsx` (owns lifecycle)

Replaces `handleDeductionResult`. Reads **live** state via `useStore.getState()` at attempt time (never the
render snapshot — fixes N2). Uses a per-attempt token (a ref counter) so overlapping revert timers cancel.

```
attemptTokenRef = useRef(0)

handleDeductionAttempt():
  const { clues, connections } = useStore.getState()          // LIVE, not render snapshot (N2)
  seed = lastConnectedIdRef.current ?? connections.at(-1)?.toId
  cls = classifyConnection(connections, seed, clues, recipes)
  const ids = cls.componentIds
  const token = ++attemptTokenRef.current
  // snapshot each component clue's PRIOR status (N5 — never downgrade deduced/spent)
  const prior = Object.fromEntries(ids.map(id => [id, clues[id]?.status]))

  if (cls.correctness === 'correct' || cls.correctness === 'false':
     roll = performCheck('reason', investigator, 14, false, false)   // FLAVOUR ONLY
     deduction = cls.recipe
        ? buildDeductionFromRecipe(cls.recipe, ids)      // stable id; recipe clues
        : buildDeduction(ids, clues)                     // generic — random id, ok (nothing gates on it)
     addDeduction(deduction)
     const winners = cls.recipe ? cls.recipe.requiredClues : ids   // generic: whole component are winners
     winners.forEach(id => updateClueStatus(id, 'deduced'))
     ids.filter(id => !winners.includes(id))
        .forEach(id => restore(id, prior[id]))            // extras keep prior status (N5), NOT forced examined
     flavour = roll.tier === 'critical' ? 'sharp' : 'plain'
     key = cls.correctness === 'false' ? 'false' : `correct-${flavour}`
     banner(MESSAGE[key], TONE[cls.correctness]); announce(MESSAGE[key])
     removeComponentConnections(ids)                      // clear ONLY this component's edges (N1/N5), not all
  else:  // partial | incorrect — no roll
     ids.forEach(id => (prior[id] !== 'deduced' && prior[id] !== 'spent') && updateClueStatus(id,'contested'))
     banner(MESSAGE[cls.correctness], TONE[cls.correctness]); announce(MESSAGE[cls.correctness])
     setSlackConnections(component edges); removeComponentConnections(ids); setTimeout(clear slack,1400)
     setTimeout(() => {
       if (attemptTokenRef.current !== token) return       // a newer attempt owns these clues now (N2)
       const live = useStore.getState().clues
       ids.forEach(id => live[id]?.status === 'contested' && updateClueStatus(id, prior[id] ?? 'examined'))
     }, 2000)
```

**New store action `removeConnections(pairs)`** (or `removeComponentConnections(ids)`) on `evidenceSlice`
— removes only the attempted component's edges, leaving other components intact (N1/N5). `clearConnections`
(all) stays for case-load/deduction-elsewhere.

**Outcome banner:** board-owned transient element (lives in the always-mounted board, so it survives edge
removal — B3). **Visual-only** (no `aria-live`); the single SR announcement is `announce()` (the Phase-1
two-slot store re-announces identical text — verified round 2). Three-way tone: green (`correct`) / amber
(`false` **and** `partial`) / red (`incorrect`). Auto-clears (~2 s).

**`restore(id, prior)`** = `updateClueStatus(id, prior)` when `prior` is a real status, else leave as-is —
so a `deduced`/`spent`/`new` clue that was extra noise keeps its badge (N5).

**Message copy** (measured, atmospheric, short status strings — never narrative):

| key | correctness | roll | message |
|---|---|---|---|
| `correct-sharp` | `correct` | `critical` | `The connection holds — a sharp, decisive insight.` |
| `correct-plain` | `correct` | other | `The connection holds.` |
| `false` | `false` | any | `A connection forms — coherent, but something about it feels wrong.` |
| `partial` | `partial` | — | `Some of these belong together, but the link isn't complete.` |
| `incorrect` | `incorrect` | — | `These clues don't connect.` |

---

## Component 4 — `src/components/EvidenceBoard/ClueCard.tsx` (backlog item 2)

`connected` is a yellow ring alone (WCAG 1.4.1 gap). `StatusIndicator` gains a `connected` case → a `🔗`
badge in the same top-right slot as NEW/📌/❓/✓, `aria-label="Connected"`. Update the doc-comment header.
No logic change.

---

## ADR-0012 amendment (before promoting to Enacted)

ADR-0012's frozen Decision says the roll "drives the Phase 2 partial-tier directional feedback" and
*defers* (not eliminates) generic correctness. Add a dated **Amendment** note (body is immutable per MADR):

> **Amendment (2026-07-14, Phase 2 enactment):** implemented with a two-graph oracle over the player's
> connection topology — recipes match the player's connected component; generic correctness uses the
> authored `connectsTo` graph (tag-overlap was rejected as unsound against shipped content). Consequently
> **partial/incorrect are deterministic and roll nothing; the Reason d20 flavours a *formed* deduction
> only** (this supersedes the Decision's "roll drives partial feedback" clause). Generic connections still
> form (they populate the Journal; nothing gates on them), so generic correctness is *defined* here, not
> eliminated. The governing principle is unchanged: correctness gates formation, the roll only flavours.

Then promote `Accepted → Enacted`, fill Commits/PRs. **Confirmation:** the ADR's literal "non-qualifying
set + `critical` roll never forms" can't run on the classifier (it's roll-free — that's the point). The
**board integration test** satisfies the substance: stub `performCheck` to `failure` **and** `critical`
and assert a recipe-matching component forms **identically** at both tiers; a non-qualifying component
forms at neither.

---

## Testing (TDD — RED first)

**`classifyConnection.test.ts`** (+ `.property.test.ts`):
- topology (N1): two disjoint player-edges that jointly contain a recipe's clues but aren't connected →
  **not** `correct` (recipe not satisfied); connecting them → `correct`.
- recipe: full non-herring recipe → `correct`; full red-herring recipe (`cc-deduction-poisoner`) →
  `false` (+ recipe set); set matching a true+herring recipe (shared `cc-clue-sloane-debts`) → `correct`
  with the **true** recipe.
- generic `connectsTo`: 2-clue authored edge → `correct`; a component with one authored + one non-authored
  edge → `partial`; all non-authored → `incorrect`. Undirected: a one-way `connectsTo` still counts.
- **vignette** (no recipes): Rationalist's Dilemma `experiment-log`↔`anomalous-readings` (authored
  `connectsTo`) → `correct` and forms a generic deduction (N3 regression guard).
- fail-closed: `<2` distinct valid ids, unknown id, duplicate ids, prototype key → never `correct`/`false`.
- roll-independence by construction (pure fn).
- property: any player-connected component that is a superset-in-one-component of a non-herring recipe →
  `correct`.

**`EvidenceBoard` integration** (the round-2 criticals):
- **B3:** after a `correct` attempt the **board banner** shows the message though the component's edges were
  removed and the button unmounted; `addDeduction` called; only winners `deduced`.
- **N5:** an already-`deduced`/`spent` clue that is *extra* in a later correct attempt, or is dragged into a
  wrong attempt, **keeps** its status (never downgraded).
- **N2:** two overlapping *failed* attempts — the older timer does **not** revert the newer attempt's clues
  (token guard); a clue reverts to its **prior** status, not blindly `examined`.
- **N1:** an independent second component on the board is untouched by an attempt on the first.
- second successful deduction in one session works (no stuck "Deduction Locked").
- ADR-0012 confirmation: stub `failure` vs `critical` → identical formation for a recipe component.

**`ClueCard` test:** `connected` renders 🔗.

Baseline **635/60**; expect ~16–20 new tests.

## Docs & ADR (in the Phase 2 PR)

ADR-0012 amendment + `Accepted→Enacted`; `engine-reference.md` gains `classifyConnection` (two-graph
rules); `CLAUDE.md` updates the `DeductionButton` note (board owns the outcome lifecycle; correctness is
two-graph; the roll flavours a formed deduction) and adds the new `removeConnections` action to the
evidenceSlice row; `status.md` baseline bump. Post-merge: tick roadmap Phase 2; update
`ui-ux-improvements.md` rows 6 + 2.

## Scope boundaries (YAGNI)

- **No** tag-based correctness (unsound); **no** recipe-only oracle (regresses vignettes).
- Generic deductions **do** form (via `connectsTo`), incl. in vignettes — reverses the v2 "no generic
  forming"; faithful to ADR-0012's *defer, don't eliminate*.
- **No** anti-spam/composure cost; **no** new `ClueStatus`; **no** save migration; **no** change to how
  clues become connectable (still any status — but outcomes now snapshot/restore instead of forcing state).
- **No** dice-legibility DC/modifier surfacing (Phase 3); **no** contrast/reduced-motion sweeps (Phase 4).

## Cross-provider Codex review (file-based)

This **spec** had two review rounds (both folded in). The **plan** and **completed implementation** each
get their own Codex pass (reviews in `codex/output/`).
