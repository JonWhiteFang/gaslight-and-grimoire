# Missing Concepts

Concepts that are absent from the codebase but are implied by the architecture, referenced in comments, or expected by the design patterns in use.

---

## Critical (blocks core functionality)

### Case Data Restoration on Load
Loading a save restores `GameState` but not `caseData` (the runtime scene graph). Without it, `useCurrentScene()` returns null and the game is unplayable after load. No code path exists to re-fetch case data after `loadGame`.
- **Status**: Missing
- **Where it should be**: `src/store/slices/metaSlice.ts` → `loadGame` should call `loadCase(gameState.currentCase)` and set `caseData`
- **Trace**: trace_06_save_load.md §8

### Hint Engine Wiring
`trackActivity()` is never called from any component. Board visit tracking, connection attempt tracking, and scene change tracking are all dead. The hint system's primary trigger (board visits without connections) cannot fire.
- **Status**: Missing
- **Where it should be**: `src/components/EvidenceBoard/EvidenceBoard.tsx` (boardVisit, connectionAttempt), `src/store/slices/narrativeSlice.ts` → `goToScene` (sceneChange)
- **Trace**: trace_07_hint_system.md §8

---

## High (significant UX or correctness gap)

### Encounter UI
The encounter engine (`startEncounter`, `processEncounterChoice`, `getEncounterChoices`) is fully implemented but has no UI consumer. No component renders encounter rounds, reaction check results, or escape path options. Encounters are unreachable by players.
- **Status**: Missing
- **Where it should be**: a new `src/components/EncounterPanel/` or integration into `ChoicePanel`
- **Trace**: trace_08_encounter_system.md §8

### Case Completion Screen
`CaseProgression.completeCase()` returns `{ facultyBonusGranted, vignetteUnlocked }` but no UI renders these results. The player has no feedback that a case ended, what bonus they received, or what new content unlocked.
- **Status**: Missing
- **Where it should be**: a new screen/overlay in `App.tsx` between case end and title/next-case
- **Files**: `src/engine/caseProgression.ts` (engine exists), `src/App.tsx` (no completion screen state)

### Clue Discovery Notification
`ClueDiscoveryCard` is explicitly a stub ("Full implementation in Task 10"). Auto-discovered clues are added to the store but the player gets no visual notification. The component accepts `clue` and `visible` props but `NarrativePanel` never passes them.
- **Status**: Missing (stub exists)
- **Where it should be**: `src/components/NarrativePanel/ClueDiscoveryCard.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx` (needs to pass discovered clue + visibility)
- **Files**: `src/components/NarrativePanel/ClueDiscoveryCard.tsx`

### Manual Save Button
`metaSlice.saveGame()` exists and works but no UI element triggers it. The player cannot manually save. Only autosave is functional.
- **Status**: Missing
- **Where it should be**: `src/components/HeaderBar/HeaderBar.tsx` or `src/components/SettingsPanel/SettingsPanel.tsx`

### Faction Reputation Display
Faction reputation is tracked, propagated from NPC disposition, and used for vignette unlock checks, but no UI shows the player their faction standing. The NPC Gallery shows NPC disposition but not faction reputation.
- **Status**: Missing
- **Where it should be**: `src/components/CaseJournal/CaseJournal.tsx` or a new faction panel

### Non-Automatic Clue Discovery Methods
`ClueDiscovery.method` supports `'exploration'`, `'check'`, and `'dialogue'` in addition to `'automatic'`, but only `'automatic'` is handled in `NarrativePanel`. The other methods have no UI trigger.
- **Status**: Missing
- **Where it should be**: `src/components/NarrativePanel/NarrativePanel.tsx` or `src/components/ChoicePanel/`

---

## Medium (architectural hygiene, testability, robustness)

### Deterministic Randomness / DI for Time
`rollD20()` uses `Math.random()` directly. `hintEngine` uses `Date.now()` directly. `buildDeduction` uses both. `saveManager` uses `new Date().toISOString()`. `metaSlice.saveGame` uses `Date.now()`. None of these are injectable. Tests work around this with `_setState` hacks or by testing pure sub-functions.
- **Status**: Missing
- **Where it should be**: a `RandomProvider` or seed parameter on `rollD20`; a `Clock` interface for time-dependent code
- **Traces**: trace_03_choice_processing.md §3, trace_07_hint_system.md §9

### Runtime Content Validation
`validateContent(caseData)` exists but is never called at runtime. Broken content JSON (missing outcome tiers, dangling scene references) causes crashes at render time via `resolveScene` throwing. Calling `validateContent` after `loadCase` would catch these errors before gameplay.
- **Status**: Missing (function exists, call site missing)
- **Where it should be**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`, after `loadCase` returns
- **Trace**: trace_01_case_loading.md §9

### Outcome Tier Completeness Validation
`validateCase.mjs` and `validateContent` check that outcome scene IDs exist, but don't check that all 5 outcome tiers are present on faculty-check choices. A missing tier causes `goToScene(undefined)` → crash.
- **Status**: Missing
- **Where it should be**: `scripts/validateCase.mjs`, `src/engine/narrativeEngine.ts` → `validateContent`
- **Trace**: trace_03_choice_processing.md §9

### Side-Effect-Free Store Mutations
SFX is triggered inside Immer `set()` callbacks in 5 slice actions. This mixes irreversible side effects with state transformation. A Zustand subscription or middleware pattern would separate concerns.
- **Status**: Missing (no subscription/middleware pattern exists)
- **Where it should be**: `src/store/audioSubscription.ts` (new)
- **Trace**: trace_10_audio_pipeline.md §10

### Stale State Cleanup on New Case
`loadAndStartCase` populates `state.clues` and `state.npcs` from the new case but doesn't clear clues/NPCs from a previous case. Starting a second case would merge old and new data.
- **Status**: Missing
- **Where it should be**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`, clear `state.clues = {}` and `state.npcs = {}` before populating
- **Trace**: trace_01_case_loading.md §10

### First Scene ID in Meta
`loadAndStartCase` uses `Object.keys(data.scenes)[0]` as the first scene. This relies on JSON key insertion order. A `firstScene` field in `meta.json` would be explicit and safe.
- **Status**: Missing
- **Where it should be**: `content/cases/*/meta.json` → add `firstScene` field, `src/engine/narrativeEngine.ts` → `loadCase` or `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`
- **Trace**: trace_01_case_loading.md §9

---

## Low (polish, future-proofing)

### Case Selection UI
Case ID is hardcoded to `'the-whitechapel-cipher'` in `App.tsx`. No screen to browse or select available cases. Irrelevant with one case but blocks multi-case play.
- **Status**: Missing
- **Where it should be**: a new screen between title and character creation, or after case completion

### Error Display on Load Failure
`App.handleStartCase` catches load errors and sets `loadError` state, but no UI renders it. The player is silently returned to the title screen.
- **Status**: Missing
- **Where it should be**: `src/components/TitleScreen/TitleScreen.tsx` → render `loadError` as a banner

### Back Navigation
`sceneHistory` is populated on every `goToScene` call but never consumed. No "go back" action or UI exists.
- **Status**: Missing
- **Where it should be**: `src/store/slices/narrativeSlice.ts` → a `goBack` action; UI in `HeaderBar` or `NarrativePanel`

### OS Reduced-Motion Listener
`AccessibilityProvider` detects `prefers-reduced-motion` on mount but doesn't listen for changes. If the user toggles OS settings mid-session, the app doesn't respond.
- **Status**: Missing
- **Where it should be**: `src/components/AccessibilityProvider/AccessibilityProvider.tsx` → add `matchMedia.addEventListener('change', ...)`

### Settings Separate from Game State
Settings are saved as part of `GameState`. Loading a save from a different device overrides the current device's accessibility preferences. Settings should be stored independently.
- **Status**: Missing
- **Where it should be**: `src/engine/saveManager.ts` → separate `gg_settings` key; `src/store/slices/metaSlice.ts` → exclude settings from save/load

### Fetch Timeout / AbortController
`loadCase` fires 7 parallel fetches with no timeout and no `AbortController`. A hanging server leaves the player on the loading screen indefinitely.
- **Status**: Missing
- **Where it should be**: `src/engine/narrativeEngine.ts` → `fetchJson`

### Audio Assets
The audio system is fully coded but no `.mp3` files exist in the repository. The game is silent.
- **Status**: Missing
- **Where it should be**: `public/audio/sfx/` (9 files), `public/audio/ambient/` (per-scene tracks)
