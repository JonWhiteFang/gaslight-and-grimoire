# Phase 4 A11y Hardening Plan Review

## Verdict

Changes required. The title inertness implementation and SettingsPanel refactor are directionally
correct, but the plan weakens the approved reduced-motion contract, does not actually standardize
the app's focus rings, computes contrast from approximate rather than resolved colors, and contains
test code that will either false-green or fail the stated gate.

## Findings

### Major 1 - Task 4 drops the direct guards required for most Motion branches

The spec explicitly requires a direct test for every independently implemented reveal/idle Motion
gate (`docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md:80-120`). The plan instead
classifies DiceRollOverlay, ClueDiscoveryCard, EffectFeedback, HintButton, DeductionButton, and both
meter width transitions as "transition-prop-only", "DOM-identical", and therefore untestable in
jsdom (`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:325-357`).

That classification is factually incomplete. DiceRollOverlay changes `initial`, `exit`, and the
inner die's `animate` value (`src/components/NarrativePanel/DiceRollOverlay.tsx:42-52`);
ClueDiscoveryCard changes the x component of `initial` and `exit`
(`src/components/NarrativePanel/ClueDiscoveryCard.tsx:35-38`); EffectFeedback changes `initial`
(`src/components/NarrativePanel/EffectFeedback.tsx:35-38`); HintButton's popover changes `initial`
and `exit` (`src/components/HeaderBar/HintButton.tsx:80-83`); and DeductionButton removes
`whileTap` (`src/components/EvidenceBoard/DeductionButton.tsx:54-64`). Even where only
`transition` differs, as on the meters (`src/components/StatusBar/ComposureMeter.tsx:98-103`,
`src/components/StatusBar/VitalityMeter.tsx:97-102`), a focused unit test can mock the Motion
primitive and capture the props. jsdom's lack of visual layout does not prevent a direct branch
guard.

The sole proposed OutcomeBanner test is also false-green: it only waits for a status element
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:392-400`), but both the reduced branch
and normal `m.div` branch expose the same role and label
(`src/components/NarrativePanel/OutcomeBanner.tsx:113-138`). Removing the reduced-motion branch
entirely would not fail that test. Task 4 must add direct guards for every row required by the spec
and assert the actual plain-element divergence for OutcomeBanner.

### Major 2 - Task 5 does not reach its declared focus-ring standard

The spec standard is `focus-visible:ring-2 focus-visible:ring-amber-400`, including migration of
ordinary keyboard-focusable controls from bare `focus:ring-*`
(`docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md:174-182`). Task 5 edits only the
five stone rings and two thin rings (`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:421-481`).
It leaves ordinary, non-programmatically-focused controls on bare `focus:ring-amber-400`, including
TitleScreen New Investigation (`src/components/TitleScreen/TitleScreen.tsx:59-64`), load-save rows
(`src/components/TitleScreen/LoadGameScreen.tsx:85-90`), and CaseSelection case buttons
(`src/components/CaseSelection/CaseSelection.tsx:79-105`). More remain in App, CaseCompletion, and
ErrorBoundary (`src/App.tsx:73-103`, `src/components/CaseCompletion/CaseCompletion.tsx:69-75`,
`src/components/ErrorBoundary/ErrorBoundary.tsx:35-41`).

The proposed test checks only that one class string contains `ring-amber-400`; it never asserts the
`focus-visible:` variant or any of the other migration sites
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:449-460`). The exact query also cannot
find the load button in the default no-save state: its accessible name is "No saved investigations
available", not Load/Continue (`src/components/TitleScreen/TitleScreen.tsx:68-77`). The plan's
fallback suggestion to assert New Game would false-green because New Game already has an amber ring.
Enumerate the ordinary bare-focus sites, justify true exceptions, and test every edited class or a
structural inventory that fails when an outlier remains.

### Major 3 - The contrast table still measures substitute colors, not resolved Tailwind tokens

The prior review correction required the chosen ring's resolved value. Tailwind defines
`amber-400` as `oklch(82.8% 0.189 84.429)` (`node_modules/tailwindcss/theme.css:34-39`), but the
plan's calculator substitutes `#f5b544` and says to resolve the real value only if the approximate
answer is marginal (`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:492-510`). That does
not satisfy the spec's requirement to compute the actual ratio from the resolved token
(`docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md:165-184`).

The table also omits several primary accent pairs the spec names: `amber-400`,
`gaslight-amber`, and `gaslight-gold` on their real surfaces
(`docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md:185-188`);
the custom values are distinct tokens (`src/index.css:10-17`). Resolve the OKLCH colors exactly,
measure the actual pairs, and add rows for every intentional nonstandard ring that Task 5 retains.

### Major 4 - The title inertness test does not prove isolation during Suspense fallback

The production edit correctly gates `inert` on `isSettingsOpen` and keeps SettingsPanel outside the
wrapper (`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:218-246`), matching the current
state location (`src/App.tsx:124-130`). The test, however, clicks Settings and then uses `waitFor`
for the inert assertion (`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:193-208`).
A future implementation that waits for the lazy panel to resolve before setting inert would still
pass once the close button appears.

The test must hold the lazy import pending, assert that `OverlayFallback` and the inert title region
coexist, then resolve the panel and verify close/removal. A synchronous assertion immediately after
the click is a weaker alternative, but only if module caching cannot bypass the fallback.

### Major 5 - The SettingsPanel Escape test targets the wrong event object and omits Tab wrapping

The proposed test dispatches Escape on `window`
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:110-115`), while both the current and
planned SettingsPanel handlers listen on `document`
(`src/components/SettingsPanel/SettingsPanel.tsx:29-36`,
`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:141-152`). A Window-targeted event does
not propagate down to Document, so this test fails before and after the refactor; the stated RED
expectation that only restoration fails is wrong.

Dispatch on `document` or on the focused close button. Also add first-to-last and last-to-first Tab
assertions: the plan's file table promises Tab-wrap coverage
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:42`), and the spec explicitly requires
it for SettingsPanel (`docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md:144-154`),
but the proposed file contains no Tab test.

### Major 6 - The reduced-motion test does not typecheck under the full gate

The proposed ConnectionThread render passes `null` to `ghostFrom` and `ghostTo`
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:376-388`). Those props accept
`ThreadPoint | undefined`, not `null` (`src/components/EvidenceBoard/ConnectionThread.tsx:20-26`).
Tests are included by the strict project TypeScript configuration (`tsconfig.json:14-20`), so the
Task 7 `npm run build` gate will fail even if Vitest transpiles and runs the test. Omit the props or
pass `undefined`; the `connections` fixture already matches the exported type and should not need
`as any`.

### Minor 7 - Two preserve contracts remain only partially guarded

The plan says the save-failure toast is already covered and adds only the success path
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:22,537-565`). The existing failure test
asserts the alert role and message but not the specified explicit `aria-live="assertive"`
(`src/components/__tests__/App.test.tsx:239-262`), while the component carries both attributes
(`src/App.tsx:377-390`). Add the missing assertion.

The dice test claims "no focusable controls" but searches only `button`, links, and inputs
(`docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md:596-609`). A future `select`,
`textarea`, `[tabindex="0"]`, or contenteditable control would false-green. Use the same broad
focusable selector as `useFocusTrap` (`src/hooks/useFocusTrap.ts:15-16`) plus contenteditable, and
assert focus remains outside the status card.

## Verified Claims

- The SettingsPanel close button is the first focusable descendant of the inner panel; only its
  non-focusable heading precedes it (`src/components/SettingsPanel/SettingsPanel.tsx:83-106`).
- `isSettingsOpen` is in scope before the title branch, and wrapping only TitleScreen leaves the
  lazy overlay interactive (`src/App.tsx:124-130`, `src/App.tsx:232-248`).
- ConnectionThread and OutcomeBanner prop shapes otherwise match the plan; DiceRollOverlay's
  proposed visible/roll/total props are valid (`src/components/NarrativePanel/DiceRollOverlay.tsx:9-26`).
- ClueCard handles Enter and Space, and EvidenceBoard's second selection writes the connection
  (`src/components/EvidenceBoard/ClueCard.tsx:116-121`,
  `src/components/EvidenceBoard/EvidenceBoard.tsx:227-246`).
- SceneText's reduced path and skip button are directly covered
  (`src/components/__tests__/SceneText.test.tsx:20-51`,
  `src/components/__tests__/SceneText.test.tsx:169-201`).

## Verification Run

`npm run test:run -- src/hooks/useFocusTrap.test.tsx src/components/__tests__/App.test.tsx
src/components/__tests__/SceneText.test.tsx src/components/__tests__/StatusBar.test.tsx
src/components/__tests__/OutcomeBanner.test.tsx` passed: 5 files, 87 tests.

`npm run build` passed on the current branch. A direct jsdom event check confirmed that dispatching
a bubbling `keydown` on Window invokes zero Document listeners, grounding Major 5.
