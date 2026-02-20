# Missing Concepts

Concepts that are absent from the codebase but are implied by the architecture, referenced in comments, or expected by the design patterns in use.

---

## Critical (blocks core functionality) — ✅ ALL FIXED

### Case Data Restoration on Load — ✅ FIXED (Phase A1)
`metaSlice.loadGame` now calls `await loadCase(gameState.currentCase)` after restoring state and sets `caseData`.

### Hint Engine Wiring — ✅ FIXED (Phase A3)
`trackActivity()` calls added to `NarrativePanel` (sceneChange), `EvidenceBoard` (boardVisit on mount, connectionAttempt on connection complete).

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

### Runtime Content Validation — ✅ FIXED (Phase B5)
`validateContent` now includes outcome tier completeness checking and is called at runtime in `loadAndStartCase`.

### Outcome Tier Completeness Validation — ✅ FIXED (Phase B5)
Both `validateContent` and `validateCase.mjs` now check that faculty-check choices have all 5 outcome tiers.

### Side-Effect-Free Store Mutations — ✅ FIXED (Phase B3)
Created `src/store/audioSubscription.ts` with store subscription. All `AudioManager.playSfx` calls removed from slice files.

### First Scene ID in Meta — ✅ FIXED (Phase A6)
Added `firstScene` to `CaseMeta`/`VignetteMeta`. Both existing cases have it set. `loadAndStartCase` uses it with fallback.

### Stale State Cleanup on New Case
`loadAndStartCase` populates `state.clues` and `state.npcs` from the new case but doesn't clear clues/NPCs from a previous case. Starting a second case would merge old and new data.
- **Status**: Missing
- **Where it should be**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`, clear `state.clues = {}` and `state.npcs = {}` before populating
- **Trace**: trace_01_case_loading.md §10

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
