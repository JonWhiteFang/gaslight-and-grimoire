# Phase 2a deduction-legibility plan review

## Ranked findings

### 1. Major: the claimed failure status lifecycle is not the current behavior

`DeductionButton` is always rendered by the board
(`src/components/EvidenceBoard/EvidenceBoard.tsx:211`) and merely returns `null` below two connected IDs
(`src/components/EvidenceBoard/DeductionButton.tsx:39`); the React component does not unmount. After a
failure, the board synchronously clears the connections
(`src/components/EvidenceBoard/EvidenceBoard.tsx:181-190`), so the next button render assigns `[]` to
`idsRef.current` (`src/components/EvidenceBoard/DeductionButton.tsx:36-39`). The two-second callback then
iterates that empty array (`src/components/EvidenceBoard/DeductionButton.tsx:60-67`), leaving the attempted
clues `contested` rather than restoring them to `examined`.

This contradicts the plan's preserved-behavior premise and would also make the proposed Task 4
documentation wrong when it says the button itself unmounts
(`docs/superpowers/plans/2026-07-15-phase2a-deduction-legibility.md:373`). It also explains why an
eventual-status test is absent.

**Fix:** Decide this explicitly before implementation. Under the strict 2a boundary, describe and test
only the actual immediate `contested` write and defer the broken reset to 2b; also say that the button's
rendered subtree disappears, not that the component unmounts. If the reset is to be repaired now, capture
attempt-scoped IDs and test the timer with fake timers, but acknowledge that this is a clue-status
lifecycle change and revise the 2a scope accordingly.

### 2. Major: the tests do not guard the central "formation/status unchanged" promise

The proposed tests assert cleared connections, banner copy, and `announce`, but never inspect
`deductions` or clue statuses
(`docs/superpowers/plans/2026-07-15-phase2a-deduction-legibility.md:181-223`). The existing board suite
only covers connecting and marking clues `connected`
(`src/components/__tests__/EvidenceBoard.test.tsx:89-99`). Consequently, an implementation that deletes
`addDeduction` and both status-write branches from
`src/components/EvidenceBoard/DeductionButton.tsx:48-67` while retaining `onResult` would pass every
planned test.

**Fix:** Add assertions that success creates exactly one deduction and marks both clues `deduced`, while
partial/failure creates none and performs the agreed status behavior. These should be explicit
regression tests for the scope boundary, not inferred from banner copy.

### 3. Major: `announce()` call count does not prove there is one screen-reader path

Task 3 checks that the mocked `announce` function is called once, but has no test requiring removal of
the existing local live region at `src/components/EvidenceBoard/DeductionButton.tsx:106-122`. Leaving that
`<m.p aria-live="polite">` intact while adding the global call would still pass all four proposed tests,
so the accessibility regression the plan is meant to prevent is false-green.

**Fix:** Add a focused `DeductionButton` test with stable `connectedClueIds` and an `onResult` spy. Assert
the exact `(result, tier)` tuple and that the rendered button subtree contains no `aria-live` outcome
node after the click. Keep the board integration assertion for banner persistence and the single
`announce()` call.

### 4. Minor: the tone and tier coverage overclaims what it verifies

The tests named "amber" and "hard failure" assert only message text
(`docs/superpowers/plans/2026-07-15-phase2a-deduction-legibility.md:205-222`); an implementation that
renders every banner red would pass. There is also no `fumble` case, despite `OutcomeTier` explicitly
including it (`src/types/index.ts:28-33`) and the plan relying on it falling through to hard failure.

**Fix:** Assert the green/amber/red class (or a stable `data-tone`) for each branch and add a fumble
case that expects the hard-failure message and no deduction.

### 5. Nit: Task 1 leaves a contradictory existing test in place

The current connected-state test is named "renders no badge or icon"
(`src/components/__tests__/ClueCard.test.tsx:95`) but only checks for unrelated NEW/Deduced indicators.
After Task 1 it will continue passing alongside a new test that says a connected badge does render.

**Fix:** Replace or rename the existing test as part of Task 1, and make it assert the new Connected
indicator instead of retaining contradictory test documentation.

**Verdict: revise first**
