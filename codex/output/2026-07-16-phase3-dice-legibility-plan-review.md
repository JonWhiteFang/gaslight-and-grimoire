# Phase 3 Dice / Probability Legibility Plan Review

**Verdict:** revise before implementation.

## Findings

### Major - Clue prompts can advertise “Assured” while still rolling normally

**Grounding:** plan Task 7, Step 3 (`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:958-969`);
`src/components/NarrativePanel/SceneCluePrompts.tsx:78-82`;
`src/engine/choiceResolution.ts:48-59`.

Task 7 computes `autoSucceeds` from the active ability flag and can therefore render `Assured`, but
`handleCheck` still calls `performCheck(..., false, false)` unconditionally. Unlike
`resolveCheckOutcome`, this path neither returns a guaranteed critical nor consumes the ability flag.
The mismatch is reachable in current content: shipped clue prompts use Reason, Vigor, and Influence,
the three auto-succeed faculties.

**Required change:** either make clue checks honor and consume the same auto-succeed contract, preferably
through shared resolution logic, or never pass `autoSucceeds: true` on this surface. Add a click-level
test with an active matching flag that proves the displayed treatment and actual outcome agree.

### Major - The stored DC is never passed to the overlay

**Grounding:** plan Task 3, Step 4 (`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:440-476`);
plan Task 7, Step 4 (`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:984-1018`);
`src/components/NarrativePanel/NarrativePanel.tsx:124-131`.

The plan adds a `dc` prop to `DiceRollOverlay` and puts `dc` into `lastCheckResult`, but its only
`NarrativePanel` edit changes `handleCheckResult`. It never adds
`dc={lastCheckResult?.dc}` to the actual `<DiceRollOverlay>` call. All planned tests can pass while every
real faculty-check overlay still omits DC.

**Required change:** add that prop at the render call and add an integration test that seeds or produces
a `lastCheckResult` with `dc` and asserts that `NarrativePanel` renders `vs DC N`.

### Major - Three proposed fixtures use a nonexistent archetype and break RED/GREEN

**Grounding:** plan Task 2, Step 1 (`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:161-174`);
plan Task 5, Step 1 (`...phase3-dice-legibility.md:641-646`);
plan Task 7, Step 1 (`...phase3-dice-legibility.md:914-924`);
`src/types/index.ts:3-4,40-53`; `src/data/archetypes.ts:3-60,63-65`.

`detective` is not an `Archetype`; the Reason-primary value is `deductionist`. Task 2's typed default
does not compile. Tasks 5 and 7 hide the type error with assertions, but rendering calls
`primaryFacultyOf('detective')`, whose non-null assertion then dereferences `undefined`. Their RED fails
for the wrong reason and their GREEN remains broken. The fixtures also invent `maxComposure` /
`maxVitality`, omit required `abilityUsed`, and use `null` where `lastCriticalFaculty` is optional.

**Required change:** replace every `detective` with `deductionist`, use a valid `Investigator` fixture
including `abilityUsed: false`, and remove the assertions that mask shape errors. This is concrete repo
data, so the implementer notes should be replaced with corrected snippets.

### Major - Task 2’s clamp tests pass even if the clamp is deleted

**Grounding:** plan Task 2, Step 1 (`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:177-205`);
plan Task 2, Step 3 (`...phase3-dice-legibility.md:332-360`);
spec `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:164-172,268-277`.

The plain extreme-DC assertions observe only the final band. Without `clamp`, an over-1 probability
still maps to Favourable and a negative probability still maps to Forbidding, so both “clamp” tests
stay green. The threshold tests also use interior values (`.70`, `.45`, `.25`) despite the spec
requiring exact `.65` and `.35` boundaries.

**Required change:** add cases where folding an unclamped value changes the band, such as an extreme
high DC with disadvantage and an extreme low DC with advantage, plus exact `.65` and `.35` boundary
assertions. The proposed formula itself is correct; the defect is that TDD does not prove it.

### Major - Task 6’s GREEN does not exercise its DC or encounter changes

**Grounding:** plan Task 6, Steps 1 and 5
(`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:768-806,883-886`);
spec `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:280-286`.

The only new Task 6 tests inspect pre-roll text in `ChoicePanel`. They never select a choice, inspect
`lastCheckResult.dc`, render an encounter with an active auto-succeed flag, or verify encounter result
DC propagation. Omitting both `setCheckResult` edits and all `EncounterPanel` edits would still produce
the stated GREEN, contrary to the spec's regular-choice plus encounter-round coverage.

**Required change:** add click-level assertions for regular and encounter choices, including dynamic
DC, `lastCheckResult.dc`, and an active encounter auto-succeed flag.

### Minor - Encounter odds are derived from a non-reactive flag snapshot

**Grounding:** plan Task 6, Step 4 (`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:848-863`);
`src/components/EncounterPanel/EncounterPanel.tsx:23-28,108-117`;
`src/store/index.ts:123-134`; `src/components/ChoicePanel/ChoiceCard.tsx:149-152`.

`EncounterPanel` subscribes to investigator, clues, and deductions, then reads flags through
`buildGameState(useStore.getState())`. A flag-only store update does not re-render the panel, so the
memoized `ChoiceCard` never receives a changed `autoSucceeds` boolean. `React.memo` itself is safe once
the primitive prop changes; the missing parent subscription is the stale seam.

**Required change:** use `useGameState()` or subscribe directly to `flags`, and test a flag update while
the encounter remains mounted.

### Minor - Task 1’s resolver verification command names no existing test

**Grounding:** plan Task 1, Step 5
(`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:129-132`);
`src/engine/__tests__/integration.test.ts:128-143`.

There is no `src/engine/__tests__/choiceResolution*.test.ts`. Under the repo's zsh shell the unmatched
glob aborts before Vitest, and the new predicate-only file does not prove `resolveCheckOutcome` still
auto-crits and returns `consumedAbilityFlag`.

**Required change:** target the existing integration test explicitly or add a direct resolver test to
the new file, then use an exact test path.

### Minor - The visual tag drops “Prospects” and duplicates advantage

**Grounding:** plan Task 4, Step 3
(`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:589-597`);
`src/components/ChoicePanel/ChoiceCard.tsx:126-135`;
spec `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:96-100,182-188`.

The planned tag renders `· Uncertain`, not the specified `· Prospects: Uncertain`. It also adds `◈`
without removing `ChoiceCard`'s existing advantage indicator, so advantaged choices show two glyphs.

**Required change:** render the literal `Prospects:` label and choose one owner for the advantage glyph.
Add a ChoiceCard assertion that exactly one glyph is present.

### Minor - The clue-prompt test does not verify the promised accessible name

**Grounding:** plan Task 7, Step 1
(`docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md:926-935`);
plan self-review (`...phase3-dice-legibility.md:1083-1085`);
spec `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:280-284`.

The test checks only visible DC and band text. It never asserts the focusable button's accessible name,
despite the plan claiming T7 covers that requirement.

**Required change:** assert `getByRole('button')` has the faculty, modifier, difficulty, and prospects
phrase, and add the specified unchanged exploration-prompt case.

## Verified

- The Task 2 probability formula, `dc - 3` partial threshold, natural-roll clamp, advantage /
  disadvantage fold-ins, and band comparisons match `resolveCheck` and `performCheck`.
- Adding optional `narrativeSlice.CheckResult.dc` does not require a save migration because
  `snapshotGameState` omits `lastCheckResult` (`src/utils/gameState.ts:5-20`).
- Adding `autoSucceeds` as a primitive `ChoiceCard` prop is compatible with React's default shallow
  memo comparison when the parent re-renders.
- Current baseline verification passed: 684 tests in 64 files.
