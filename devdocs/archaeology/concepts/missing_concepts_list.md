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

### Encounter UI — ✅ FIXED (Phase D1)
Created `EncounterPanel` component. Added `encounter` field to `SceneNode`. Authored supernatural encounter scene in act3.json. `GameContent` renders `EncounterPanel` when scene has encounter field.

### Case Completion Screen
`CaseProgression.completeCase()` returns `{ facultyBonusGranted, vignetteUnlocked }` but no UI renders these results. The player has no feedback that a case ended, what bonus they received, or what new content unlocked.
- **Status**: ✅ FIXED
- **Resolution**: `GameContent` detects terminal scenes (no choices, no encounter) and renders a "Case Complete" button. `handleCompleteCase` captures the ending narrative and transitions to the `CaseCompletion` screen, which shows the narrative text, faculty bonus, and vignette unlock. A Matter of Shadows terminal scenes now set `amos-case-complete` flag.

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

### Stale State Cleanup on New Case — ✅ FIXED (Phase D2)
`loadAndStartCase` now clears `clues`, `npcs`, `deductions`, and `lastCheckResult` before populating new case data. Preserves cross-case `flags` and `factionReputation`.

---

## Low (polish, future-proofing)

### Case Selection UI
Case ID is hardcoded to `'the-whitechapel-cipher'` in `App.tsx`. No screen to browse or select available cases. Irrelevant with one case but blocks multi-case play.
- **Status**: ✅ FIXED
- **Resolution**: Created `CaseSelection` component, `content/manifest.json`, and `loadAndStartVignette` store action. Flow: Character Creation → Case Selection → Play. Main cases always shown; vignettes gated by `vignette-unlocked-{id}` flags.

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


---

## Game Design Gaps (identified 2026-02-23)

> These were identified through a full game design audit. See `GAME_DESIGN_ANALYSIS.md` for detailed analysis with code references and proposed solutions.

### Active Clue Discovery UI
Only `automatic` clue discovery has a UI trigger. `exploration`, `check`, and `dialogue` methods are defined in the type system and used in content but have no player-facing interaction.
- **Status**: Missing
- **Severity**: High — core gameplay loop is incomplete
- **Where it should be**: `src/components/NarrativePanel/NarrativePanel.tsx` (explore/check buttons), `src/components/ChoicePanel/ChoicePanel.tsx` (dialogue side-effect)

### Audio and Visual Assets
Zero `.mp3`, `.png`, `.jpg`, `.webp`, or `.svg` asset files exist in the repository. The audio system and illustration system are fully coded but have nothing to render.
- **Status**: Missing
- **Severity**: High — game has no atmosphere
- **Where it should be**: `public/audio/sfx/` (9 files), `public/audio/ambient/` (2–3 loops), `public/images/` (scene illustrations, NPC portraits)

### NPC Dialogue System
NPCs have disposition, suspicion, memoryFlags, and faction but no interactive dialogue. `memoryFlags` is never populated in any content file. Players cannot question, persuade, or confront NPCs.
- **Status**: Missing
- **Severity**: High — NPCs are passive data
- **Where it should be**: New `DialogueNode` type in `src/types/index.ts`, new `DialoguePanel` component, dialogue evaluation in `src/engine/narrativeEngine.ts`

### Composure/Vitality Recovery
Both meters only decrease. No rest scenes, recovery items, or counterplay exist. `breakdown` and `incapacitation` scenes referenced by `StatusBar` callbacks don't exist in any case content.
- **Status**: Missing
- **Severity**: Medium-High — creates unrecoverable death spiral
- **Where it should be**: Content JSON (recovery scenes with positive `onEnter` effects, breakdown/incapacitation scenes)

### Persistent Evidence Board Connections
Connections live in React `useState`, lost on board close/reopen. No drag-and-drop. No touch support.
- **Status**: Missing
- **Severity**: Medium-High — signature mechanic has friction
- **Where it should be**: `src/store/slices/evidenceSlice.ts` (connection state), `src/components/EvidenceBoard/EvidenceBoard.tsx` (click/drag handlers)

### Consequence Feedback / Effect Narration
`onEnter` effects fire silently. Players see meters change with no narrative explanation. Dice outcomes show tier label but no bridging text.
- **Status**: Missing
- **Severity**: Medium — breaks story-mechanics connection
- **Where it should be**: `src/types/index.ts` (add `narrativeText` to `Effect`), `src/components/NarrativePanel/NarrativePanel.tsx` (render notifications)

### Occultist Veil Sight Ability
The flag `ability-veil-sight-active` is set when the Occultist activates their ability, but no engine function or content condition ever checks this flag. The ability has no mechanical effect.
- **Status**: Missing
- **Severity**: Medium — one of four archetypes has a broken ability
- **Where it should be**: `src/engine/narrativeEngine.ts` (check flag to reveal hidden occult elements), content JSON (scenes with veil-sight-gated content)

### Faction Reputation Clamping
Disposition [-10,+10], suspicion [0,10], composure/vitality [0,10] are all clamped. Faction reputation has no clamp and can grow unbounded.
- **Status**: Missing
- **Severity**: Low — no current content pushes reputation to extreme values
- **Where it should be**: `src/store/slices/worldSlice.ts` → `adjustReputation` action

### Content-Specific Deduction Descriptions
`buildDeduction` always returns one of two generic strings regardless of which clues are connected. No content-specific deduction text exists.
- **Status**: Missing
- **Severity**: Low — Evidence Board feels less rewarding
- **Where it should be**: `src/engine/buildDeduction.ts` (look up deduction text from content), content JSON (deduction description mappings)

### Skip Typewriter Interaction
`SceneText` typewriter effect has no click-to-complete. Players must wait for full text or change settings to `instant`.
- **Status**: Missing
- **Severity**: Low — standard CYOA convention
- **Where it should be**: `src/components/NarrativePanel/SceneText.tsx` (click handler to set displayed = full text)
