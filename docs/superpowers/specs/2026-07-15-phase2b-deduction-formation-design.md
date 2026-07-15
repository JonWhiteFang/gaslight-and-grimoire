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
  /** The matched recipe, if this component matched one; else undefined (generic). */
  recipe?: KeyDeduction;
}
```

`'false'` = "forms, but framed as an uneasy / questionable connection" (the red-herring outcome). It is a
**formed** deduction, distinct from `'partial'`/`'incorrect'` which form nothing.

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

# Recipe path — a recipe whose requiredClues ⊆ S (all required clues in THIS component)
matches = recipes.filter(r => r.requiredClues.every(id => S.has(id)))
if matches non-empty:
    winner = deterministic pick:  non-red-herring first
                                  → largest requiredClues.length
                                  → lowest id (string compare)
    correctness = winner.isRedHerring ? 'false' : 'correct'
    return { clueIds: sorted(S), correctness, recipe: winner }

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
return { clueIds: sorted(S), correctness }              # generic: no recipe
```

- **`connectsToUndirected(a, b)`** = `clues[a].connectsTo?.includes(b) || clues[b].connectsTo?.includes(a)`
  (the corpus has 25 one-way `connectsTo` edges and 0 dangling; undirected is correct).
- **`playerEdges(S)`** = the `connections` internal to the component (both endpoints ∈ S).
- **Deterministic winner** removes any ordering nondeterminism when multiple recipes match one component.

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
- **The latent revert bug (Part B) dies with the overwrite.** Today the failed-attempt timer reverts
  `contested → examined` via `idsRef.current`, which `clearConnections()` empties first — so failed clues
  stay stuck `contested`. In 2b the revert uses an **attempt-scoped immutable snapshot** (§3), not a live
  ref, and restores each clue to its **prior** status (per-component), not a hardcoded `'examined'`.
- **Attempt-scoped ownership (N2):** each attempt captures, at roll time, an immutable snapshot of the
  attempted component's clue ids and their prior statuses (a closure value, not `idsRef.current`). The
  `contested → prior` revert timer closes over that snapshot, so it survives `clearConnections()` and a
  board remount. Timer handles are tracked for cleanup on unmount.

### `ClueStatus` type + save migration

- **Keep `'connected'` in the `ClueStatus` union**, documented as **deprecated / never written** (retained
  so an in-memory pre-migration state can't fail `isValidGameState`). No code writes it after 2b.
- **`CURRENT_SAVE_VERSION` 4 → 5.** New migration step `v4 → v5`: map any `clue.status === 'connected'` →
  `'examined'` for every clue in `state.clues`. `connections` already round-trips (v2 migration), so the
  derived connected ring reconstitutes for free on load — no data loss.

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
  2. For each `correct`/`false` component: build its deduction and `addDeduction` (idempotent upsert),
     then `updateClueStatus(id, 'deduced')` for its clue ids and clear that component's connections.
  3. For each `partial`/`incorrect` component the player actually attempted: mark its clues `contested`
     with the attempt-scoped snapshot + revert timer (§2), slack-animate + clear its connections.
  4. Set the banner + `announce()` from the **aggregate oracle outcome** (§ banner), not the raw roll.

### Generic deduction identity (N5) — canonical stable id

- **`buildDeduction`** stops minting `deduction-${Date.now()}-${Math.random()}`. Generic deductions get a
  **canonical stable id** from the sorted clue-set signature:
  `` `deduction-generic-${[...clueIds].sort().join('+')}` ``. Re-forming the same set upserts the same id
  (`addDeduction` keys by id) → **no Journal inflation** (N5). `Date.now()`/`Math.random()` leave
  `buildDeduction` entirely (removes one of the CLAUDE.md "used directly" call sites).
  **Separator safety (verified):** every shipped clue id matches `[a-z0-9-]+` — no id contains `+` —
  so `+` cannot introduce a signature collision (`{a, b+c}` vs `{a+b, c}` is impossible when `+` never
  occurs in an id). The plan should add a validator assertion (clue ids match `^[a-z0-9-]+$`) so a future
  authored id containing `+` fails the content gate rather than silently colliding two generic deductions.
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
  - Deterministic winner when multiple recipes match one component.
  - Fail-closed: `< 2` distinct → `incorrect`; edge with missing/unrevealed endpoint dropped;
    `Object.prototype` key as a clue id can't read an inherited member.
  - Multi-component: two disjoint clusters classified independently.
- **ADR-0012 Confirmation test (board integration):** a recipe-matching component forms its key deduction
  on a **`failure`-tier** roll; a non-qualifying set forms **nothing** on a **`critical`-tier** roll.
- **Status-lifecycle tests:** `handleInitiateConnection` writes no `'connected'` status; a `deduced` clue
  re-wired into a new connection stays `deduced`; a failed attempt reverts its clues to their **prior**
  status (not hardcoded `examined`) and the revert survives `clearConnections()`.
- **Generic identity (N5):** re-forming the same generic set upserts one deduction (count stays 1).
- **Save migration v4 → v5:** a persisted `'connected'` clue status migrates to `'examined'`; connections
  preserved.
- **Banner/announce:** correctness-driven message + tone per the table; exactly one `announce()` per
  attempt; multi-component aggregate.

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
