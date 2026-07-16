# Codex implementation review — Phase 2b: Deduction Formation Model (enacts ADR-0012)

You are an adversarial cross-provider reviewer. This is the **final independent gate** on a
**completed, merge-ready** implementation, after the internal reviews passed and the CI gate is green.
You have **no conversation memory** — everything you need is below or in the cited files.

## Your charge

Assume the implementation contains **at least one real defect the internal reviews missed** — a
correctness bug, an integration/seam defect between the oracle / store / board, an unmapped exception or
error-taxonomy hole, a determinism violation, a false-green or missing test, or a place the code silently
**diverges from its spec/plan**. Find it. Ground **every** finding in the actual committed code with a
`file:line` citation. If you cannot find a real defect, say so explicitly and instead surface the
weakest real risk — do not invent severity.

Run the build/tests **only if your sandbox allows** (read-only is fine — reason from the code). The repo
already reports: **680 tests pass, lint clean, validator 8/8 cases, `npm run build` green.** So the gate
won't catch what you're looking for — focus on logic, seams, and spec fidelity.

## What this change is

**Phase 2b enacts [ADR-0012](docs/DECISIONS/ADR-0012-deduction-roll-semantics.md): correctness gates
deduction formation; the Reason d20 roll only flavours the outcome copy.** Previously the roll gated
formation (a correct clue-set could fail on a bad roll; a wrong set could form on a lucky one). Now a
qualifying connected clue-set **always** forms its deduction (even on a `failure` roll) and a
non-qualifying set **never** does (even on a `critical`). It also fixes pre-existing evidence-board
plumbing defects (N1–N5 + a latent contested-revert bug).

## Ground truth (verified against `main` — do not re-litigate, but DO check the code honours it)

- **7 key-deduction recipes across the 4 main cases; the 4 vignettes ship NO `deductions.json`** → the
  generic path is the only oracle for vignettes.
- **2 of 7 recipes are NOT `connectsTo`-connected among their required clues**
  (`lw-deduction-croke-court-murder`, `ms-deduction-fraud-and-breach`). **Consequence:** recipes MUST be
  matched against the *player's* connection topology, never against authored `connectsTo`. A
  "match recipes to `connectsTo`" shortcut would silently break these two cases — check the oracle does not.
- All shipped clue ids match `^[a-z0-9-]+$`; no recipe id starts with `deduction-generic-`.
- Save version was 4; this change bumps it to 5.

## The diff to review

```
git diff 2d1a1d0218956a35b630e46598f8013625e1daa6..9f1bde5b58becdc03dbdb2151c19b3a8e1c42768
```

11 commits. Production files to read and ground findings against:

- `src/engine/deductionOracle.ts` — **new** pure oracle `classifyBoard(connections, clues, recipes)`.
- `src/engine/buildDeduction.ts` — canonical generic id `deduction-generic-<sorted ids by '+'>`; no `Date.now`/`Math.random`.
- `src/engine/contentValidation.ts` — reserve `deduction-generic-` recipe-id namespace + enforce clue-id charset.
- `src/store/slices/evidenceSlice.ts` — module-level `revertTimers` registry; `contestedTokens`/`contestedPrior`/`attemptSeq`; `contestClues`/`markCluesDeduced`/`cancelContestedReverts`/`clearRevertTimers`.
- `src/store/slices/narrativeSlice.ts` — `resetForNewCase` clears the new state; load actions call `clearRevertTimers()` before reset.
- `src/store/slices/metaSlice.ts` — `loadGame` calls `cancelContestedReverts()` before committing loaded state.
- `src/engine/saveManager.ts` — `CURRENT_SAVE_VERSION` 4→5; v4→v5 `connected`→`deduced`/`examined` recovery; `contested`→`examined` hygiene on **every** load path.
- `src/components/EvidenceBoard/ClueCard.tsx` — `isConnected` prop drives ring + 🔗; `connected` removed from status rendering.
- `src/components/EvidenceBoard/DeductionButton.tsx` — rolls only; `onResult(tier)`; no formation/status writes; no sticky lock.
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — runs the oracle, forms all qualifying deductions, drives statuses/banner/announce.
- `src/types/index.ts` — `DeductionCorrectness`, `ClassifiedComponent`; `'connected'` documented deprecated.
- `src/utils/gameState.ts` — confirms `contestedTokens`/`contestedPrior`/`attemptSeq` are NOT serialized.

Test files (check for false-greens / missing coverage, don't just trust them):
`src/engine/__tests__/deductionOracle.test.ts`, `buildDeduction.test.ts`, `contentValidation.test.ts`,
`saveMigration.test.ts`, `saveManager.property.test.ts`, `src/store/slices/__tests__/evidenceSlice.test.ts`,
`src/components/__tests__/{ClueCard,DeductionButton,EvidenceBoard}.test.tsx`.

## Spec & plan (check FIDELITY — does the code do what these say?)

- Spec: `docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md`
- Plan: `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md`

Both fold in a round of your own prior spec/plan review. The five spec findings (Blocker 1: form ALL
matched recipes; Blocker 2: store-owned token-gated revert; Major 3: v4→v5 deduced-vs-examined; Major 4:
reserved generic namespace + charset; Minor 5: empty-classified-result guard) and five plan findings
(success path claims token via `markCluesDeduced`; timers tracked+cancelled; fail→fail carry-forward;
v5 contested hygiene on current-version saves; button repeat-attempt not locked) are all claimed fixed.
**Verify each is actually implemented as claimed — a claimed-fixed finding that regressed is exactly what
this pass exists to catch.**

## Specific seams worth attacking

1. **Oracle topology.** Does `classifyBoard` match recipes against player `connections` (union-find), never
   `connectsTo`? Does the generic path use undirected `connectsTo` correctly? Fail-closed on
   missing/unrevealed/inherited-prototype/self edges?
2. **Multi-recipe / multi-component.** A component satisfying two complete recipes forms both? A
   `[correct, incorrect]` multi-component attempt — banner, announce-once, and per-component clue status
   all correct?
3. **Revert ownership.** fail→success and fail→fail overlaps on a shared clue — does the generation-token
   `=== gen` gate actually prevent a stale timer from clobbering? Is there any path where a clue is
   stranded `contested`, or reverted to the wrong baseline? What about board unmount mid-timer, or a case
   load / save load while a timer is pending (`clearRevertTimers` vs `cancelContestedReverts`)?
4. **Migration.** v4→v5 `connected`→`deduced` only when a persisted deduction references the clue, else
   `examined`. `contested`→`examined` on EVERY load path incl. `version === CURRENT` early return.
   Idempotent. Does a malformed (non-object) `clues` still get rejected by `isValidGameState` (not silently
   coerced to `{}` by a spread)?
5. **Generic id determinism & collision.** Is the id a pure function of the sorted clue set? Can the
   `+`-join collide given the charset validator? Is the `deduction-generic-` namespace actually
   unreachable by an authored recipe id (validator + gate resolution)?
6. **`markCluesDeduced` scope.** The board marks only the union of matched recipes' `requiredClues` (recipe
   path) or the whole component (generic path) as `deduced` — never a lassoed noise clue. Is that
   consistent with what each deduction's `clueIds` actually contains (no card↔Journal divergence)?

## Output

Write your review to **`codex/output/2026-07-16-phase2b-deduction-formation-impl-review.md`**. Structure it:

- **Verdict:** ship / ship-with-fixes / do-not-ship.
- **Findings**, each: severity (Blocker / Major / Minor), `file:line`, what's wrong, why it matters, a
  concrete failing scenario (inputs → wrong output), and a suggested fix.
- If you verified a claimed-fixed finding is genuinely closed, note it briefly (helps confirm coverage).
- Ground everything in the actual committed code. No speculative findings without a `file:line` anchor.
