# Phase 4 A11y Hardening Spec Review

## Verdict

Changes required. The spec has a real background-isolation gap, computes focus-ring contrast from
the wrong token, and can satisfy its reduced-motion test list without guarding most locally gated
Motion components. It also treats SC 2.4.11 as a focus-appearance criterion even though it is Focus
Not Obscured (Minimum).

## Findings

### Major 1 - Settings opened from the title screen leaves the background interactive

The "background inert while any overlay is open" audit is not true across all routes. The title
branch returns before `anyOverlayOpen` is computed and renders `TitleScreen` next to
`SettingsPanel`, with no inert wrapper (`src/App.tsx:232-247`). The only `inert={anyOverlayOpen}`
site is in the later game branch (`src/App.tsx:320-334`). The current test reaches the game screen
and opens only Evidence Board, so it cannot catch the title-screen path
(`src/components/__tests__/App.test.tsx:168-190`).

This contradicts both "all four overlays" and WS2's instruction to confirm inertness and leave it
unchanged. It also makes the framing that Settings focus restoration is the only real overlay gap
incorrect. Require the title content to become inert as soon as Settings is requested, including
while the lazy fallback is showing, and add an App-level title -> Settings assertion for inert
addition and removal.

### Major 2 - The prescribed focus-ring contrast calculation uses the wrong color

The spec identifies `ring-amber-400` as `#d4a853`. In this project, `#d4a853` is declared as
`--color-gaslight-amber`, which generates `ring-gaslight-amber`
(`src/index.css:5-17`). Tailwind's separate built-in `--color-amber-400` is
`oklch(82.8% 0.189 84.429)` (`node_modules/tailwindcss/theme.css:38`). Therefore the ratio required
by WS3 would not measure the standardized `ring-amber-400` rendered by the app.

Choose the intended token explicitly. If the design intends `#d4a853`, standardize on
`ring-gaslight-amber`; otherwise retain `ring-amber-400` and calculate from its resolved built CSS
value. Also do not imply that high-contrast mode turns the ring bright yellow: the current remap
targets text utilities, not ring utilities (`src/index.css:68-75`).

### Major 3 - The reduced-motion test contract can leave local Motion gates unguarded

WS1 says "a test per source" but then prescribes one test per source class and names only
ConnectionThread among JS-driven Motion paths. There are independent local reduced-motion branches
in DiceRollOverlay (`src/components/NarrativePanel/DiceRollOverlay.tsx:35-52`),
ClueDiscoveryCard (`src/components/NarrativePanel/ClueDiscoveryCard.tsx:29-38`), EffectFeedback
(`src/components/NarrativePanel/EffectFeedback.tsx:27-38`), HintButton
(`src/components/HeaderBar/HintButton.tsx:53-83`), DeductionButton
(`src/components/EvidenceBoard/DeductionButton.tsx:52-64`), OutcomeBanner
(`src/components/NarrativePanel/OutcomeBanner.tsx:111-142`), and both meter width/descriptor
animations (`src/components/StatusBar/ComposureMeter.tsx:98-115`,
`src/components/StatusBar/VitalityMeter.tsx:97-114`). A global CSS-rule test cannot guard any of
those branches.

The explicit regression list checks only the meters' CSS pulse, ConnectionThread, and SceneText.
For example, existing meter tests verify pulse classes and descriptor suppression, not the
`m.div` width transition (`src/components/__tests__/StatusBar.test.tsx:165-175`,
`src/components/__tests__/StatusBar.test.tsx:284-317`). Require one coverage-table row and a direct
guard for every independently implemented Motion gate, or define and test a centralized mechanism.

The table must also classify the ghost thread explicitly. It is an `m.path` with no
`reducedMotion` branch (`src/components/EvidenceBoard/ConnectionThread.tsx:104-113`) whose path is
updated from pointer movement via `requestAnimationFrame`
(`src/components/EvidenceBoard/EvidenceBoard.tsx:200-225`). It may reasonably be exempted as
direct-manipulation feedback, but that decision must be stated; otherwise the acceptance rule "no
`m.*` path lacks a reducedMotion branch" is already false. The named "ClueCard connected glow" is
also inaccurate: `animate-pulse` belongs to the `new` status
(`src/components/EvidenceBoard/ClueCard.tsx:49-58`), while the connected cue is static
(`src/components/EvidenceBoard/ClueCard.tsx:123-127`).

### Major 4 - SC 2.4.11 is mis-cited and has no acceptance check

SC 2.4.11 is Focus Not Obscured (Minimum), not the criterion for indicator contrast or thickness.
The spec repeatedly treats a low-contrast or thin ring as a likely 2.4.11 failure, then verifies only
ring color ratios and visible keyboard focus. Those checks address SC 1.4.11 and SC 2.4.7; they say
nothing about whether a focused control is hidden by author-created content.

Keep SC 1.4.11 for the 3:1 non-text contrast check and SC 2.4.7 for visible focus. If SC 2.4.11
remains a phase target, add a concrete browser check that tabs through every scrollable
screen/dialog and confirms the focused component is not entirely obscured. If focus-indicator size
is intended as a target, name SC 2.4.13 separately rather than attributing it to 2.4.11.

### Minor 5 - The `focus` to `focus-visible` rule needs an explicit autofocus exception

The load-game delete flow replaces the delete button with an `autoFocus` confirmation button, whose
current visible indicator is a bare `focus:ring-2 focus:ring-red-400`
(`src/components/TitleScreen/LoadGameScreen.tsx:106-123`). Programmatic focus after pointer
activation is not guaranteed to match `:focus-visible`, so a mechanical migration can leave the
newly focused control without the ring. Preserve bare `focus` here unless browser verification
proves the intended behavior, or add a specific focus treatment and regression test for the
auto-focused confirmation state.

### Minor 6 - Focus restoration is already directly tested at the hook level

The implementation claim is correct: `useFocusTrap` captures `document.activeElement` and restores
it on cleanup (`src/hooks/useFocusTrap.ts:21-26`, `src/hooks/useFocusTrap.ts:65-71`). However, the
spec's statement that the hook restore is "unguarded by tests" is false:
`src/hooks/useFocusTrap.test.tsx:48-60` directly tests restoration. Consumer-level tests are still
useful to catch a component dropping the hook; describe the gap that way. The existing consumer
tests currently cover only focus-in and Escape (`src/components/__tests__/overlayFocusTrap.test.tsx:32-59`,
`src/components/__tests__/EvidenceBoard.test.tsx:129-134`).

### Minor 7 - A static CSS assertion cannot claim behavioral coverage

Vitest runs in jsdom (`vite.config.ts:29-32`), so it cannot prove that animations visibly stop. A
Vite `?raw` import or source read can feasibly parse and assert the selector plus both declarations
in `src/index.css:90-93`; that is a useful structural deletion guard. A test that expects a built
stylesheet must itself run the CSS build, because the stated gate runs tests before the production
build. Word this acceptance check as structural only. Effective suppression needs the specified
real-browser check, or an automated browser test that inspects the resolved animation/transition
durations.

## Verified Claims

- SettingsPanel really has a bespoke trap with no restoration
  (`src/components/SettingsPanel/SettingsPanel.tsx:21-64`), and its close button really is the first
  focusable descendant of the referenced inner panel (`src/components/SettingsPanel/SettingsPanel.tsx:83-106`).
- The game-branch `inert={boolean}` usage is React-19-correct (`src/App.tsx:320-334`).
- SceneText's instant path and real skip button are present
  (`src/components/NarrativePanel/SceneText.tsx:59-64`,
  `src/components/NarrativePanel/SceneText.tsx:118-127`).
- Save toast roles and DiceRollOverlay's non-modal status role match the spec
  (`src/App.tsx:377-390`, `src/components/NarrativePanel/DiceRollOverlay.tsx:34-45`).
- The proposed phase remains within components, CSS, and tests; no content/engine boundary change is
  required.

## Verification Run

`npm run test:run -- src/hooks/useFocusTrap.test.tsx src/components/__tests__/App.test.tsx src/components/__tests__/SceneText.test.tsx src/components/__tests__/StatusBar.test.tsx`
passed: 4 files, 65 tests. `npm run build` also passed.
