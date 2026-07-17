VERDICT: REVISE - the plan has a final-build type failure, an AA contrast regression, and several spec-required tests that it claims but does not actually add.

## Findings

### Blocker - Task 3's new test imports `ContentBundle` from a module that does not export it

**Location:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md:268-270` (T3 Step 1); `src/engine/contentValidation.ts:31`; `tsconfig.json:20`.

`ContentBundle` is declared and exported by `src/engine/contentValidation.ts`, not `src/types/index.ts`. The proposed

```ts
import type { ContentBundle, Choice, SceneNode } from '../../types';
```

therefore produces TS2305 when `tsc` checks the new test under `src/`. Vitest transpiles without type-checking, so T3 Step 6 can report green and leave this latent until T9's `npm run build`.

**Fix:** Import `ContentBundle` with `validateBundle` from `../contentValidation`, and import only `Choice`/`SceneNode` from `../../types`. Add a build/typecheck immediately after T3 rather than waiting until T9.

### Major - `LockedChoice` fails the spec's explicit AA text-contrast invariant

**Location:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md:519-526` (T4 Step 3); `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:230-234`; `src/index.css:15`.

The proposed `<li>` applies `opacity-60` to its entire subtree, then uses `text-stone-400` for the choice and `text-stone-500` for the reason. On the normal `#1a1a2e` ink background, compositing at 60% reduces the already-muted colors to approximately 3.23:1 and 2.10:1 respectively. Both are below the 4.5:1 body-text threshold that the spec explicitly says must remain intact. The reason is also the smaller `text-xs`, so it has no large-text exemption.

**Fix:** Remove parent opacity. Convey the disabled state with the lock, line-through, muted border/background, and an AA-safe foreground (at least unmodified `stone-400`, whose established ink ratio is 6.60:1). Recompute both text ratios and include them in the live verification.

### Major - The validator tests false-green the warning contract and omit two folded requirements

**Location:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md:332-335,441-444` (T3 Steps 1 and 7); `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:249-257`; `scripts/validateCase.ts:96-115`.

The warning test checks only that no error contains the words `shown despite a gate`; it does not assert zero errors. An implementation that emits the expected warning plus a differently worded hard error still passes. The spec requires zero errors and CLI exit success. Step 7 runs only shipped content, which contains no `visibility: "shown"`, so it cannot prove that a real soft-gate warning leaves the CLI successful.

The same test matrix promises non-string `gateReason` coverage, but the plan tests only whitespace. The resolver matrix also promises `requiresFlag: null`, while T2 tests only empty strings (`plan:131-134`).

**Fix:** Assert `expect(errorsOf(c)).toEqual([])` for the soft gate; add `null`/numeric `gateReason` cases through an `unknown` cast; add the `requiresFlag: null` compatibility case; and run the CLI against a fixture containing a valid `visibility: "shown"` choice while asserting warning output and exit code 0.

### Major - The component acceptance criteria are not covered by the planned RED tests

**Location:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md:564-600,728-758` (T5/T6 Step 1); `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:242-243,258-262`.

The ChoicePanel test comments say "in a list" but assert neither `list` nor `listitem`. It also omits the required interactive `nav`, nav-before-list DOM order, non-focusability, and `visibility: "shown"` interaction assertions. The standalone LockedChoice test manually supplies its own `<ul>`, so it cannot catch ChoicePanel placing the `<li>` under an invalid parent.

T6 adds only `getEncounterChoices` engine tests. No failing `EncounterPanel` test is added before changing its render path, so the full suite can pass even if a disabled encounter choice is still rendered as an interactive `ChoiceCard`, its reason is omitted, or the locked list is absent.

**Fix:** Add role/ordering/focus/soft-gate assertions to `ChoicePanel.test.tsx`. Add an `EncounterPanel.test.tsx` RED case whose mocked available choices include an unmet disabled choice, then assert visible reason, `list`/`listitem`, no matching button, and preservation of the interactive encounter nav.

### Major - Task 7 does not implement the folded demo regression witness

**Location:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md:867-902` (T7); `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:286-299`.

The spec's folded Major 5 requires the converted shipped choice to have an explicit before/after assertion so the one intended behavior delta is distinguishable from regressions. T7 only edits JSON, validates structure/tone, and relies on T9 manual browser verification. `validateCase` cannot prove that the selected choice resolves hidden under the old/default form and disabled under the authored form, nor that exactly one shipped choice was converted.

**Fix:** After selecting the concrete choice ID, add a content-backed regression test that loads it, proves an equivalent copy without the two new fields resolves `hidden` with an unmet gate, and proves the authored choice resolves `disabled` with its reason. Also assert the shipped-content inventory contains exactly the intended conversion.

### Minor - Two task recipes need literal cleanup

**Location:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md:730-758,712-716,765-802`.

T6 tells the engineer to add a direct `getEncounterChoices` import even though `src/engine/__tests__/encounterSystem.test.ts:48-52` already imports that identifier from the barrel, and its snippet calls nonexistent `makeEmptyState` despite the real helper being `makeGameState` at line 75. The adaptation note acknowledges only the helper. Make the exact edit explicit so RED fails on behavior, not duplicate/undefined test plumbing.

T5's commit stages only `src/components/ChoicePanel/`, omitting the modified `src/components/__tests__/ChoicePanel.test.tsx`. T6 also removes the last use of the `Condition` type in `src/engine/encounters.ts:10` but never says to remove the import, leaving a lint warning. Finally, T6's two `.filter` calls resolve every available choice twice; this is pure and not a correctness bug, but a single partition loop would match T5 and be clearer.

## What Is Correct And Worth Keeping

- T1's field union matches the spec, and the four conditions in T2 exactly match the real `Condition` variants in `src/types/index.ts:152-161`.
- T2 imports `evaluateConditions` directly from `./conditions`; the inspected dependency graph introduces no barrel cycle. Its truthy-field builder preserves the shipped empty-string behavior.
- T6's proposed escape branch is behaviorally identical to `src/engine/encounters.ts:191-220`: truthy gates are ANDed, an empty condition list passes, and an escape is included only when those conditions pass. Escape choices never become disabled.
- T3's `warnings` plumbing is otherwise complete. The escape branch correctly suppresses derivative rule noise, and applying the rules through the existing `worseAlternative` recursion is appropriate because replacement choices are rendered and selected like other encounter choices.
- T5 preserves the F-045 contract: the memoized clue/deduction Sets and `handleSelect` dependencies remain unchanged, and shown choices retain the existing `computeAdvantage`/`checkAutoSucceeds` calls. No current ChoicePanel test queries the nav as the root, so the wrapper itself is not an existing-test break.
- `scripts/validateCase.ts:96-115` already prints warnings and exits nonzero only for errors, so no production CLI change is needed once the missing integration assertion is added.
- Verified locally: the current `encounters` Vitest filter does select `encounterSystem.test.ts` (31 tests), and the current ChoicePanel harness genuinely has no `missing-clue`; those parts are not false-GREEN defects.
