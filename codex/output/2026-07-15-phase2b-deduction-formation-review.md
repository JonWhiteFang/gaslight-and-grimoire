# Codex review - Phase 2b deduction formation spec

## Findings

### Blocker - The one-winner rule discards other fully matched key deductions

**Grounding:** `docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:96-103,121,127-131,178-184`; `docs/DECISIONS/ADR-0005-key-deduction-recipes.md:23-27,45-47`; `docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:32-39`.

**Failure scenario:** In The Comet Club, make one component with the authored player edges
`sash-weights -- sloane-debts -- quack-tonic -- death-dates`. That component contains every required clue for
both `cc-deduction-one-true-murder` and `cc-deduction-poisoner`; all three edges are authored
`connectsTo` edges. ADR-0005's subset semantics therefore make both recipes matches. The proposed
ordering picks the non-red-herring `one-true-murder`, returns only that recipe, and Section 3 adds only
that deduction. The complete poisoner recipe forms nothing and gets no uneasy outcome, on every roll.
If `one-true-murder` was already stored, the attempt merely upserts it while still suppressing the new
poisoner deduction. The same structural problem applies whenever a player joins any two complete
recipe sets into one component.

Determinism only makes the loss repeatable; it does not make the selected result semantically complete.
This contradicts the governing rule that a qualifying connected set always forms its deduction and the
resolved red-herring-forms-uneasy decision.

**Suggested fix:** Let a classified component carry all matching recipes and form every match
idempotently; use a deterministic order only for presentation/aggregate copy. If nested recipes should
have different semantics, define that explicitly rather than silently choosing one. Add a board
integration test using the four-clue Comet component above and assert that both recipe ids form, with
the poisoner deduction marked red-herring.

### Blocker - Attempt snapshots do not provide timer ownership and cannot survive the cleanup described

**Grounding:** spec Section 2,
`docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:147-154,182-183,254-256`;
the requirement being claimed as resolved is in
`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:149-156`;
the board is conditionally unmounted at `src/App.tsx:363-365`.

**Failure scenarios:**

1. An incorrect attempt marks two examined clues `contested`; the player closes the board before the
   timer fires. The spec says timer handles are cleaned up on unmount, so the timer cannot also
   "survive ... a board remount." The clues remain `contested`, reproducing the latent bug through a
   different cancellation path.
2. Attempt A fails for `{c1,c2}` and snapshots `examined`. Before A's timer fires, attempt B succeeds
   for `{c1,c3}` and marks `c1` `deduced`. A's unowned callback then restores `c1` to `examined`,
   corrupting the successful formation. If B also fails, A can restore `c1` before B's own timeout.

An immutable id/status closure fixes the current live-`idsRef` bug, but it is not the per-clue generation
ownership Part B required.

**Suggested fix:** Put a per-clue attempt generation/token outside the board component (store or an
engine-owned lifecycle), and restore only when the callback still owns that clue. Define unmount/load/
new-case cancellation semantics explicitly: either let store-only restoration timers survive board
unmount, or synchronously restore currently owned statuses before cancelling them. Add fake-timer tests
for close/remount, fail-to-success overlap, and fail-to-fail overlap.

### Major - The v4-to-v5 migration permanently downgrades previously deduced clues

**Grounding:** `docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:137-162,258-259`;
the destructive v4 write occurs at `src/components/EvidenceBoard/EvidenceBoard.tsx:193-195`, while
deduction membership is persisted in `Deduction.clueIds` (`src/types/index.ts:83-90`).

**Failure scenario:** A player forms a deduction, making `c1` `deduced`, then rewires `c1`; current v4
code overwrites it to `connected`. They save before attempting. The proposed migration maps `c1` to
`examined` even though a persisted deduction still contains `c1`. Once the connection is cleared, the
card is semantically examined while the Journal and deduction gates say it was deduced. Thus the
spec's "no data loss" claim is false for a reachable v4 save.

**Suggested fix:** During migration, map a `connected` clue referenced by any persisted deduction back
to `deduced`, and use `examined` only as the fallback. Document that older `new`/`spent` provenance is
not reconstructible rather than claiming losslessness. Test a v4 `connected` clue both with and without
persisted deduction membership.

### Major - The generic-id proof ignores collisions with authored recipe ids

**Grounding:** `docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:186-199`;
all deductions share one id-keyed record at `src/store/slices/evidenceSlice.ts:47-50`; current validation
builds a recipe-id registry but imposes no reserved namespace at
`src/engine/contentValidation.ts:95-99,129-136`.

**Failure scenario:** Future valid clue ids `a` and `b` coexist with a recipe whose authored id is
`deduction-generic-a+b` but whose required clues are different. Connecting `a` and `b` takes the generic
path and stores under that recipe id, falsely satisfying its `hasDeduction`/`requiresDeduction` gate.
The proposed clue-id regex proves injectivity only between generic clue-set signatures; it does not
separate generic ids from authored ids.

**Suggested fix:** Reserve `deduction-generic-` against recipe ids in the shared content validator (and
test it), or use an explicitly disjoint identity namespace. Keep the clue-id charset assertion as the
separate generic-signature collision guard.

### Minor - Dropping every invalid edge leaves an attempted board with no classifiable outcome

**Grounding:** spec `classifyBoard` steps at
`docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md:79-89,178-184`; the button is
shown from raw connection endpoint ids at `src/components/EvidenceBoard/EvidenceBoard.tsx:109-111,262-264`;
save validation does not inspect connection endpoints at `src/engine/saveManager.ts:62-78`.

**Failure scenario:** A shallow-valid save contains `{fromId:"missing-a",toId:"missing-b"}`. The board
sees two connected ids and permits an attempt, but the oracle drops the edge and returns zero
components. No aggregate outcome is defined, so the board cannot meet the promised one banner/one
announcement behavior. Formation fails closed, but the attempt lifecycle is underspecified.

**Suggested fix:** Define an empty classified result for a non-empty attempted edge set as
`incorrect` (and clear it), or have the board explicitly handle `components.length === 0`. Add an
integration test for stale/malformed persisted connections.

## Independent verification

- Confirmed 7 recipes: 4 Comet Club, and 1 each in Lamplighter's Wake, Mayfair Seance, and Whitechapel
  Cipher. Confirmed all 4 side cases have no `deductions.json`.
- Confirmed exactly the two named recipes are disconnected in their induced undirected authored graph:
  Lamplighter's reaches 3/4 required clues; Mayfair reaches 1/3. The other 5 are connected.
- Confirmed all 74 shipped clue ids match `^[a-z0-9-]+$`; no id contains `+`. Also confirmed 25 one-way
  authored edge declarations and no dangling targets.
- Confirmed production writes `'connected'` only in `handleInitiateConnection`
  (`EvidenceBoard.tsx:194-195`). Outside rendering, no production engine/gate code reads
  `clue.status === 'connected'`.
- The specified ADR confirmation pair itself is appropriate: recipe formation on `failure` plus no
  formation for a non-qualifying `critical` demonstrates that the roll is not the gate, while retaining
  the d20 satisfies chosen Alternative A. The blockers above are independent of roll tier.

**Verdict:** The spec is not sound to proceed to an implementation plan until the multi-match oracle
and attempt-timer ownership blockers are resolved.
