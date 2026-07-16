# Phase 2b — Deduction Formation Model (design spec)

> **Type:** Implementation design spec. Feeds a Codex-gated implementation plan (writing-plans next).
> **Date:** 2026-07-15 · **v1.**
>
> **This is the real enactment of [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md).**
> Phase 2a shipped the *legibility* slice (🔗 cue, board-owned banner, `announce()`) with formation
> semantics unchanged. 2b reworks **what forms a deduction**: correctness gates formation, the roll
> only flavours it. It also fixes the pre-existing board-plumbing defects that three Codex spec-review
> rounds surfaced (recorded in the [Phase 2 spec Part B](2026-07-14-phase2-deduction-feedback-design.md#part-b--phase-2b-deferred--its-own-spec-later)).
>
> **Track:** UI/UX roadmap Phase 2b ([roadmap](../../research/ui-ux-roadmap.md)); backlog **6**.
> **Consumes** the Phase-1 announcer (`announce()`, PR #80) and the Phase-2a board-owned banner (PR #82).
> **Enacts** ADR-0012 (`Accepted → Enacted`).

---

## Goal

Replace the roll-gates-formation model with a **correctness-gates-formation** model, enacting ADR-0012:

- A connected clue-set whose **correctness** qualifies it **always** forms its deduction — regardless of
  roll tier (even a `failure` roll).
- A set that does **not** qualify **never** forms one — regardless of roll tier (even a `critical` roll).
- The Reason d20 roll is retained but its role narrows to **flavour** (a `critical` reads as a sharper
  insight); it no longer gatekeeps correct reasoning.

Along the way, fix the four root-cause plumbing defects (N1–N5 + the latent revert bug) that make the
current model unsound to build a correctness oracle on.

## Corpus facts (verified against `main`, 2026-07-15)

These pin the design; a plan must not contradict them:

- **7 key-deduction recipes across the 4 main cases**; the **4 vignettes ship no `deductions.json`** →
  generic classification is the **only** oracle for vignettes.
  - `the-comet-club`: 4 recipes (incl. `cc-deduction-poisoner`, `isRedHerring: true`).
  - `the-lamplighters-wake`: 1 (`lw-deduction-croke-court-murder`, 4 required clues).
  - `the-mayfair-seance`: 1 (`ms-deduction-fraud-and-breach`, 3 required).
  - `the-whitechapel-cipher`: 1 (`wc-deduction-harland-mastermind`, 3 required).
- **2 of 7 recipes are NOT `connectsTo`-connected** among their `requiredClues`
  (`lw-deduction-croke-court-murder`, `ms-deduction-fraud-and-breach`). **Consequence:** recipes must be
  matched against the **player's connection topology**, never against authored `connectsTo` edges.
  A "match recipes to `connectsTo`" shortcut would silently break these two cases.
- **Red-herring clues ship in all 4 main cases and all 4 vignettes** (`type: "redHerring"`). N4's
  all-authored-edges-but-contains-a-red-herring cluster is a real, reachable state.
- **All `hasDeduction`/`requiresDeduction` gate targets are the 7 recipe ids** (Part B, verified); generic
  deductions gate nothing, so they may form freely once idempotent.
- **Save version is currently 4** (`CURRENT_SAVE_VERSION = 4`, `saveManager.ts:14`); 2b bumps it to **5**.
- **`'connected'` clue status is written in exactly one place** (`EvidenceBoard.tsx:194-195`
  `handleInitiateConnection`) and read for rendering in `ClueCard.tsx` (status classes + 🔗 badge).
  No engine/gate logic depends on `clue.status === 'connected'`.

---

## Section 1 — The correctness oracle (`src/engine/deductionOracle.ts`, new, pure)

A new pure engine module — no store access, fully unit-testable — is the heart of 2b. It operates on the
**player's connection topology**, not on `connectsTo` directly for recipe-matching.

### Types (added to `src/types/index.ts`)

```ts
export type DeductionCorrectness = 'correct' | 'false' | 'partial' | 'incorrect';

/** One player-built connected component, classified by the oracle. */
export interface ClassifiedComponent {
  /** Own-property, revealed clue ids in this component (sorted, deduped). */
  clueIds: string[];
  correctness: DeductionCorrectness;
  /**
   * EVERY recipe whose requiredClues ⊆ this component (subset semantics, ADR-0005).
   * A component that joins two complete recipe sets carries both — each forms its
   * own deduction (Blocker 1). Empty on the generic path. Ordered deterministically
   * (non-red-herring first → largest requiredClues → lowest id) for PRESENTATION
   * only — the order never decides which recipes form; all of them do.
   */
  recipes: KeyDeduction[];
}
```

`'false'` = "forms, but framed as an uneasy / questionable connection" (the red-herring outcome). It is a
**formed** deduction, distinct from `'partial'`/`'incorrect'` which form nothing.

**Blocker 1 fix — form all matching recipes, never just one.** An earlier draft picked a single "winner"
recipe and discarded the rest; Codex showed that a component joining two complete recipe sets (e.g. Comet
Club `sash-weights — sloane-debts — quack-tonic — death-dates` satisfies **both** `cc-deduction-one-true-murder`
**and** `cc-deduction-poisoner`) would silently suppress the second — violating "a qualifying set always
forms its deduction." So `recipes` is now a **list**: every matched recipe forms its deduction
idempotently. The deterministic order is retained but demoted to presentation/aggregate-copy only.

### Pipeline — `classifyBoard(connections, clues, recipes): ClassifiedComponent[]`

1. **Build the undirected connection graph** from `connections`. **Fail-closed:** consider only
   `connections` whose *both* endpoints are own-property, revealed clue ids in `clues`
   (`Object.prototype.hasOwnProperty` guard — never read an inherited member, cf. the F-057-era
   `evaluateCondition` own-property fix). Any edge with a missing/unrevealed endpoint is dropped.
2. **Split into connected components** (DFS/union-find over the undirected edge set). A component with
   `< 2` distinct clue ids is classified `incorrect` (it forms nothing) and needs no further work.
3. **Classify each component independently** (see below).
4. **Return** the array of `ClassifiedComponent`, one per component (including the trivial `incorrect`
   ones — the caller decides what to surface).

### Per-component classification

```
component clue-set S (size ≥ 2)

# Recipe path — ALL recipes whose requiredClues ⊆ S (all required clues in THIS component)
matches = recipes.filter(r => r.requiredClues.every(id => S.has(id)))
if matches non-empty:
    ordered = matches sorted by:  non-red-herring first    # PRESENTATION order only
                                  → largest requiredClues.length
                                  → lowest id (string compare)
    # correctness is 'correct' if ANY matched recipe is non-red-herring, else 'false'.
    # (A non-red-herring key deduction genuinely forms; the component isn't a dead end
    #  just because it ALSO happens to satisfy a red-herring recipe.)
    correctness = ordered.some(r => !r.isRedHerring) ? 'correct' : 'false'
    return { clueIds: sorted(S), correctness, recipes: ordered }
    # Section 3 forms a deduction for EVERY recipe in `ordered`: non-red-herring ones
    # under their stable id (isRedHerring:false), red-herring ones under theirs
    # (isRedHerring:true, framed "Questionable connection"). Both board + Journal agree.

# Generic path — no recipe matched (the ONLY path for the 4 vignettes)
# Classify the component's player-edges against undirected authored connectsTo.
authoredEdges = playerEdges(S).filter(e => connectsToUndirected(e.a, e.b))
if authoredEdges.length === playerEdges(S).length:      # ALL player-edges are authored
    hasRedHerring = [...S].some(id => clues[id].type === 'redHerring')
    correctness = hasRedHerring ? 'false' : 'correct'   # N4: all-authored + red-herring → uneasy
elif authoredEdges.length > 0:                          # SOME
    correctness = 'partial'
else:                                                    # NONE
    correctness = 'incorrect'
return { clueIds: sorted(S), correctness, recipes: [] }  # generic: no recipe
```

- **`connectsToUndirected(a, b)`** = `clues[a].connectsTo?.includes(b) || clues[b].connectsTo?.includes(a)`
  (the corpus has 25 one-way `connectsTo` edges and 0 dangling; undirected is correct).
- **`playerEdges(S)`** = the `connections` internal to the component (both endpoints ∈ S).
- **Deterministic order** (in the recipe path) removes ordering nondeterminism in the *presentation* of a
  multi-recipe component; it never decides which recipes form — all matched recipes form.

### Enacting ADR-0012

Correctness alone decides formation:

- The attempt forms a deduction for every `correct` and `false` component.
- It forms nothing for `partial` and `incorrect` components.
- **The roll never appears in `classifyBoard`.** It is rolled only to pick the *tier/flavour* of an
  already-decided formation (§3). A `correct` component forms on a `failure` roll; a non-qualifying set
  forms nothing on a `critical` roll. **This is the ADR-0012 Confirmation test.**

---

## Section 2 — Clue-status lifecycle (`'connected'` becomes derived; fixes N1, N2, and the latent revert bug)

**`'connected'` stops being a written clue status. It is derived from `connections` membership at render.**

- **`handleInitiateConnection` (`EvidenceBoard.tsx`)** no longer calls
  `updateClueStatus(id, 'connected')`. It only `addConnection`s. The overwrite that destroyed a clue's
  prior status (N1) is gone — a `deduced`/`spent` clue stays `deduced`/`spent` while also being wired.
- **`ClueCard`** gains an `isConnected: boolean` prop, passed by the board from
  `connectedIds.includes(clue.id)`. The gold ring **and** the 🔗 badge (moved here from the 2a
  `'connected'` status-case) render from `isConnected`, independent of `clue.status`. `clue.status`
  becomes purely semantic: `new → examined → deduced | contested | spent`. The card-root `aria-label`
  appends `, connected` when `isConnected` so screen-reader parity is kept.
- **The latent revert bug (Part B) dies with the overwrite** — but a board-scoped snapshot closure is
  **not enough** (Codex Blocker 2). Two failure modes remain if the revert lives in the component: (a) the
  player closes the board before the timer fires — `App.tsx:363-365` unmounts the board, unmount-cleanup
  kills the timer, and the clues stay stuck `contested` (the same bug via a different path); (b) overlapping
  attempts sharing a clue — attempt A fails for `{c1,c2}` (snapshots `examined`), then attempt B succeeds
  for `{c1,c3}` marking `c1` `deduced`; A's timer then clobbers `c1` back to `examined`, corrupting B's
  formation. So the revert lifecycle **moves into the store** with per-clue ownership.
- **Store-owned per-clue attempt ownership (N2).** New evidence-slice state
  `contestedTokens: Record<string, number>` (clue id → generation counter) plus a monotonic
  `attemptSeq`. A new store action `contestClues(clueIds, priorStatuses)`:
  1. increments `attemptSeq` → this attempt's `gen`;
  2. for each clue, sets `status = 'contested'` and `contestedTokens[id] = gen`, recording `priorStatuses`;
  3. schedules the revert (2 s). The revert action `revertContested(clueIds, gen, priorStatuses)` restores
     each clue to its prior status **only if `contestedTokens[id] === gen`** — i.e. only if it still owns
     that clue. A later attempt that touches the same clue (fail *or* success) bumps its token first, so the
     stale timer's ownership check fails and it leaves the clue alone. This fixes both (a) and (b): the
     timer is store-scheduled (survives board unmount) and ownership-gated (no cross-attempt clobber).
- **Cancellation semantics (explicit).** `resetForNewCase` and save-load clear `contestedTokens`/`attemptSeq`
  and cancel any pending revert (a `contested` clue on load migrates like any other status — no dangling
  timer). On board unmount the revert is **not** cancelled (it's store-owned, not component-owned); a
  pending `contested` clue simply reverts whether or not the board is open. The store holds at most one
  active timer handle per attempt `gen`, cleared when it fires or is superseded.

### `ClueStatus` type + save migration

- **Keep `'connected'` in the `ClueStatus` union**, documented as **deprecated / never written** (retained
  so an in-memory pre-migration state can't fail `isValidGameState`). No code writes it after 2b.
- **`CURRENT_SAVE_VERSION` 4 → 5.** New migration step `v4 → v5` maps any `clue.status === 'connected'` to a
  restored status. **Naïve `connected → examined` loses data (Codex Major 3):** the v4 bug
  (`EvidenceBoard.tsx:193-195`) overwrote a **`deduced`** clue's status to `connected` when it was re-wired,
  so a persisted `deduction` can still reference a clue the save now records as `connected` — mapping it to
  `examined` would leave the card `examined` while the Journal + `hasDeduction` gate still say `deduced`.
  **Migration rule:** for each clue with `status === 'connected'`, if **any** persisted
  `state.deductions[*].clueIds` contains that clue id → restore to **`deduced`**; otherwise → **`examined`**
  (the safe fallback). `connections` already round-trips (v2), so the derived connected ring reconstitutes
  for free. **Provenance caveat (documented, not claimed lossless):** an original `new`/`spent` status that
  the v4 bug had overwritten to `connected` is **not** reconstructible — those clues fall to `examined`.
  This is acceptable (`new` vs `examined` is cosmetic; a `spent` clue overwritten to `connected` is an
  already-corrupted v4 state). The spec no longer claims "no data loss" — it claims *no gate/Journal
  desync* (the case that matters) plus a bounded, documented cosmetic fallback.
- **Transient `contested` on load.** `contested` is a 2 s transient status with no owning timer after a
  reload. The v4→v5 migration (and load normalization generally) maps any persisted `clue.status ===
  'contested'` → `'examined'` so a save taken mid-attempt can't strand a clue `contested` forever. (This is
  independent of the v4 bug; apply it for all versions on load.)

---

## Section 3 — Formation ownership, generic identity (N5), and the roll's flavour role

### Formation moves from `DeductionButton` to the board (via a thin engine helper)

An attempt now forms **multiple** deductions (one per qualifying component), which the button's
single-formation model can't express. Split responsibilities:

- **`DeductionButton`** keeps: render the button (unchanged text states), roll the d20
  (`performCheck('reason', investigator, 14, …)`), and hand the resulting `tier` up via `onResult(tier)`.
  **It no longer forms deductions or writes clue status.** (Its `onResult` signature simplifies: the board
  no longer needs a `'success'|'failure'` result — it recomputes correctness itself. Pass `tier` only.)
  The button still renders below `< 2` connected clues as `null`.
- **`EvidenceBoard.handleDeductionAttempt(tier)`** (renamed from `handleDeductionResult`):
  1. `const components = classifyBoard(storeConnections, clues, recipes)`.
  2. **Empty-result guard (Minor 5):** if `components.length === 0` (e.g. every edge was dropped as
     stale/malformed — see §fail-closed), treat the attempt as a single `incorrect` outcome: clear all
     connections, show the red banner + announce, form nothing. The board never silently no-ops an attempt.
  3. For each `correct`/`false` component: form **every** recipe in `component.recipes` — each under its
     stable authored id via `buildDeductionFromRecipe` (non-red-herring → `isRedHerring:false`; red-herring
     → `isRedHerring:true`, "Questionable connection") — `addDeduction` (idempotent upsert). If
     `component.recipes` is empty (generic `correct`/`false`), form one generic deduction under its
     canonical id (below). Then `updateClueStatus(id, 'deduced')` for the component's clue ids and clear
     that component's connections.
  4. For each `partial`/`incorrect` component the player actually attempted: mark its clues `contested`
     via the **store-owned** per-clue generation token (§2) + schedule the revert; slack-animate + clear
     its connections.
  5. Set the banner + `announce()` from the **aggregate oracle outcome** (§ banner), not the raw roll.
     A multi-recipe `correct` component still counts as forming multiple deductions in the aggregate copy.

### Generic deduction identity (N5) — canonical stable id

- **`buildDeduction`** stops minting `deduction-${Date.now()}-${Math.random()}`. Generic deductions get a
  **canonical stable id** from the sorted clue-set signature:
  `` `deduction-generic-${[...clueIds].sort().join('+')}` ``. Re-forming the same set upserts the same id
  (`addDeduction` keys by id) → **no Journal inflation** (N5). `Date.now()`/`Math.random()` leave
  `buildDeduction` entirely (removes one of the CLAUDE.md "used directly" call sites).
  **Separator safety (verified):** every shipped clue id matches `[a-z0-9-]+` — no id contains `+` —
  so `+` cannot introduce a signature collision (`{a, b+c}` vs `{a+b, c}` is impossible when `+` never
  occurs in an id). The plan adds a validator assertion (clue ids match `^[a-z0-9-]+$`) so a future
  authored id containing `+` fails the content gate rather than silently colliding two generic deductions.
- **Generic-vs-authored id collision (Codex Major 4).** The charset proof above only guarantees
  *signature-vs-signature* injectivity. It does **not** stop a future authored recipe id from colliding
  with the generic namespace: a recipe authored as `deduction-generic-a+b` (with different `requiredClues`)
  would be *satisfied* when the player generically connects clues `a` and `b`, because the generic path
  stores under that same id and `addDeduction` keys by id — falsely tripping the recipe's
  `hasDeduction`/`requiresDeduction` gate. **Fix — reserve the namespace in the shared content validator:**
  `contentValidation.ts` gains a rule that **no authored `KeyDeduction.id` may begin with
  `deduction-generic-`** (errors in the validator + CI gate). The `deduction-generic-` prefix is thereby an
  exclusive machine-owned namespace, disjoint from all authored recipe ids. Add a validator test for a
  recipe id in the reserved namespace (must error).
- **Recipe deductions** keep their stable authored id (unchanged, `buildDeductionFromRecipe`). A `'false'`
  (red-herring) recipe or generic component forms with `isRedHerring: true`, framed "Questionable
  connection: …" as today — so board and Journal agree (N4).

### The roll's remaining role (flavour only — ADR-0012 Alternative A)

The roll's **only** job post-2b is to sharpen the *copy* of a formed `correct` deduction: a `critical`
roll → "a sharp, decisive insight"; any other tier → the plain "The connection holds." It does not affect
`false`/`partial`/`incorrect` framing (those are correctness-driven). This thin role is intentional and
faithful to ADR-0012's chosen Alternative A (keep the d20 for flavour, not gate) over Alternative B (drop
dice from deduction entirely). **N3 (stale seed) dissolves:** formation is recomputed per-component from
current `connections` each attempt, so there is no last-connected-id seed to go stale.

### Banner + announce (correctness-driven)

The 2a board-owned banner + single `announce()` stay; the message now reflects **oracle correctness**, not
raw roll result. For a single-component attempt:

| oracle outcome | tone | message |
|---|---|---|
| `correct`, `critical` roll | green | `The connection holds — a sharp, decisive insight.` |
| `correct`, other roll | green | `The connection holds.` |
| `false` (red-herring / uneasy) | amber | `A connection forms — but an uneasy, questionable one.` |
| `partial` | amber | `Some of these belong together, but the reasoning won't quite hold.` |
| `incorrect` | red | `These clues don't connect — not like this.` |

For a **multi-component** attempt, surface the aggregate: announce the best outcome and, when more than one
component was evaluated, append a count (e.g. `The connection holds. (2 deductions formed.)`). Exact
aggregate copy is a plan detail; the rule is: one banner, one `announce()`, best-outcome-led. Banner stays
`aria-hidden` (announce() is the sole SR path) and auto-dismisses (~2.5 s) as in 2a.

---

## Section 4 — ADR-0012 enactment, testing, docs

### ADR-0012 enactment

Promote ADR-0012 `Accepted → Enacted` in this PR: front-matter `status`, the Confirmation section's
"Enacted when…" satisfied, and Links `Commits / PRs` filled. Per MADR immutability, the **decision body is
not edited** — only the front matter + Confirmation + Links (the mutable pointers). Update the
`DECISIONS/README.md` index row.

### Testing (TDD, RED first)

- **Oracle unit tests (`deductionOracle.test.ts`)** — the load-bearing suite:
  - All four correctness states, via both recipe and generic paths.
  - **The 2-of-7 non-`connectsTo` recipes** (`lw-deduction-croke-court-murder`,
    `ms-deduction-fraud-and-breach`) match when the player connects their `requiredClues`, proving
    recipe-matching uses player edges not `connectsTo`.
  - N4: all-authored-edges + a `redHerring` clue → `'false'` (not `'correct'`).
  - Red-herring recipe (`cc-deduction-poisoner`) → `'false'`.
  - **Multi-match component (Blocker 1):** the Comet Club component
    `sash-weights — sloane-debts — quack-tonic — death-dates` matches **both**
    `cc-deduction-one-true-murder` and `cc-deduction-poisoner` → `component.recipes` carries **both**;
    correctness is `'correct'` (a non-red-herring recipe matched); the board forms **two** deductions
    (`one-true-murder` `isRedHerring:false`, `poisoner` `isRedHerring:true`). Assert neither is suppressed.
  - **Presentation order** is deterministic (non-red-herring first → largest `requiredClues` → lowest id)
    but does **not** change which recipes form.
  - Fail-closed: `< 2` distinct → `incorrect`; edge with missing/unrevealed endpoint dropped;
    `Object.prototype` key as a clue id can't read an inherited member.
  - Multi-component: two disjoint clusters classified independently.
- **ADR-0012 Confirmation test (board integration):** a recipe-matching component forms its key deduction
  on a **`failure`-tier** roll; a non-qualifying set forms **nothing** on a **`critical`-tier** roll.
- **Status-lifecycle tests:** `handleInitiateConnection` writes no `'connected'` status; a `deduced` clue
  re-wired into a new connection stays `deduced`.
- **Store-owned revert ownership (Blocker 2)** — fake-timer tests on the slice:
  - a failed attempt reverts its clues to their **prior** status (not hardcoded `examined`) and the revert
    fires even though `clearConnections()` ran and the board unmounted (store-owned timer);
  - **fail→success overlap:** A fails `{c1,c2}`; before A's timer, B succeeds `{c1,c3}` marking `c1`
    `deduced`; A's timer must **not** revert `c1` (token ownership check fails) — `c1` stays `deduced`;
  - **fail→fail overlap:** A fails `{c1,c2}`, B fails `{c1,c4}`; only B (the current owner) reverts `c1`.
- **Generic identity (N5):** re-forming the same generic set upserts one deduction (count stays 1).
- **Generic-vs-authored namespace (Major 4):** the validator errors on a `KeyDeduction.id` beginning
  `deduction-generic-`; and a clue id must match `^[a-z0-9-]+$`.
- **Save migration v4 → v5:**
  - a `connected` clue **referenced by a persisted deduction** → `deduced` (no gate/Journal desync);
  - a `connected` clue **not** referenced → `examined`;
  - a persisted `contested` clue → `examined` (no stranded transient);
  - `connections` preserved.
- **Empty-result guard (Minor 5):** an attempt whose every edge is stale/malformed (0 components) clears
  connections + shows the red `incorrect` banner + announces once; forms nothing.
- **Banner/announce:** correctness-driven message + tone per the table; exactly one `announce()` per
  attempt; multi-component / multi-recipe aggregate.

Baseline **649/61**; expect a substantial addition (oracle suite is large).

### Docs

- `engine-reference.md`: new `deductionOracle` module (signatures + behaviour); `buildDeduction` generic id
  change.
- `CLAUDE.md`: formation is now **oracle-driven + board-owned** (update the Architectural Warning that
  currently describes 2a's button-owned formation + the deferred `contested`-revert bug — now fixed);
  `'connected'` is **derived, not stored**; save v4→v5; `Date.now()`/`Math.random()` removed from
  `buildDeduction`.
- `content-authoring.md`: what makes a generic connection "correct" (all player-edges authored via
  `connectsTo`), and that a red-herring clue in an otherwise-correct cluster forms an uneasy deduction.
- Post-merge: roadmap Phase 2b → done; `ui-ux-improvements.md` row 6 (formation model) → done.

### Scope boundaries (YAGNI)

No dice-legibility DC surfacing (Phase 3); no reduced-motion/contrast sweep (Phase 4); no new authored
content or recipes; no change to `hasDeduction`/`requiresDeduction` gate semantics (generic deductions
still gate nothing); no React Flow migration. The roll stays (flavour); it is **not** dropped (that was
ADR-0012 Alternative B, rejected).

---

## Design decisions resolved (this session)

Four forks were resolved toward the root-cause options (all matching Part B's analysis):

1. **Status model:** derive `'connected'` from membership (not snapshot/restore of a written status). Root
   cause — nothing to overwrite, revert bug moot.
2. **Partial-correctness:** forms nothing + amber directional message (keeps "did I reason correctly" a
   clean binary; matches ADR-0012).
3. **Attempt scope:** evaluate each connected component independently (not the flattened id-union).
4. **Red herring in an all-authored cluster (N4):** forms an uneasy/questionable deduction (board + Journal
   agree; rewards spotting the real authored link while signalling the dead end).

---

## Cross-provider Codex review (file-based)

Per [ADR-0013](../../DECISIONS/ADR-0013-codex-file-based-review-handoff.md): this **spec**, the **plan**,
and the **completed implementation** each get a file-based Codex pass
(`codex/input/2026-07-15-phase2b-*.md` → `codex/output/…-review.md`). Spec charge: assume at least one real
defect — a correctness hole in the oracle, an unsound-topology claim, a determinism/collision hazard in the
generic id or winner-selection, a migration/status-lifecycle gap, or a place the design silently diverges
from ADR-0012 — and find it. Ground every finding in the actual committed code + this spec.

### Round 1 ([review](../../../codex/output/2026-07-15-phase2b-deduction-formation-review.md)) — 5 findings, all folded in

Codex independently re-verified all four corpus claims (7 recipes / 4 vignettes-none; the 2 disconnected
recipes; `^[a-z0-9-]+$` clue ids; single `'connected'` writer) and confirmed the ADR-0012 Confirmation pair
is appropriate. It then found 5 real defects, all now fixed in this spec:

1. **Blocker — one-winner rule discarded other complete recipe matches.** A component satisfying two full
   recipes formed only one. **Fixed:** `ClassifiedComponent.recipes` is now a **list**; every matched recipe
   forms; the deterministic order is presentation-only (§1, §3).
2. **Blocker — board-scoped snapshot didn't own the revert timer** (board close cancels it; overlapping
   attempts clobber a shared clue). **Fixed:** revert moved into the **store** with per-clue generation
   tokens + explicit cancellation semantics (§2).
3. **Major — v4→v5 migration downgraded a `deduced`-but-overwritten clue to `examined`**, desyncing the gate
   + Journal. **Fixed:** migration restores `connected → deduced` when a persisted deduction references the
   clue, `examined` otherwise; losslessness claim dropped; `contested → examined` on load added (§2).
4. **Major — generic id could collide with an authored recipe id** (`deduction-generic-a+b`). **Fixed:**
   validator reserves the `deduction-generic-` namespace against authored recipe ids (§3).
5. **Minor — empty classified result on an attempted board was underspecified.** **Fixed:** 0-components →
   single `incorrect` outcome (clear + red banner + announce), never a silent no-op (§3).
