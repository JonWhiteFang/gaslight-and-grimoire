# Architecture Analysis

> Reconstructed from code. Where docs conflict with code, code is authoritative.

## Main Entry Points

### 1. Application boot
`src/main.tsx` → `ReactDOM.createRoot` → `<ErrorBoundary>` → `<App />`

### 2. Screen state machine (`src/App.tsx`)
`App` manages a `Screen` union via `useState`:
```
'title' → 'character-creation' → 'loading' → 'game'
                                               ↕
'title' ← 'load-game' ─────────────────────→ 'game'
```
No router. Transitions are imperative `setScreen()` calls. The `'loading'` state is a transient screen shown during `loadAndStartCase`.

### 3. Game content loading
`App.handleStartCase` → `store.loadAndStartCase('the-whitechapel-cipher')` → `narrativeEngine.loadCase(caseId)` → 7 parallel `fetch()` calls → store populated → `goToScene(firstSceneId)`.

### 4. Scene-to-scene navigation
`narrativeSlice.goToScene(sceneId)` → push to `sceneHistory`, set `currentScene`, play SFX, autosave. React re-renders → `useCurrentScene()` resolves scene (with variant check) → `NarrativePanel` applies onEnter effects and auto-discovers clues.

### 5. Choice processing
`ChoicePanel.handleSelect` → `narrativeEngine.processChoice(choice, gameState)` → `diceEngine.performCheck` → store mutations (NPC effects, navigation) → `ChoiceResult` returned → dice overlay shown.

### 6. Save/Load
- Save: `metaSlice.autoSave()` called from `goToScene` or `ChoicePanel` → `SaveManager.save('autosave', state)` → localStorage.
- Load: `LoadGameScreen` → `App.handleLoadSave` → `metaSlice.loadGame(saveId)` → `SaveManager.load` → store overwritten. (Bug: `caseData` not restored.)

## Main Data Models

### Canonical type definitions: `src/types/index.ts` (single file, ~220 lines)

All game types live here. No type is defined elsewhere except slice-local interfaces.

| Model | Key fields | Used by |
|---|---|---|
| `Investigator` | name, archetype, faculties, composure, vitality, abilityUsed | investigatorSlice, CharacterCreation, ChoiceCard |
| `Clue` | id, type, status, connectsTo, tags, isRevealed | evidenceSlice, EvidenceBoard, CaseJournal |
| `Deduction` | id, clueIds, isRedHerring, unlocksScenes, unlocksDialogue | evidenceSlice, buildDeduction, CaseJournal |
| `NPCState` | id, name, faction, disposition, suspicion, memoryFlags, isAlive | npcSlice, NPCGallery |
| `SceneNode` | id, act, narrative, choices, cluesAvailable, conditions, onEnter, variantOf | narrativeEngine, NarrativePanel, ChoicePanel |
| `Choice` | id, text, faculty, difficulty, outcomes, advantageIf, npcEffect, encounter extensions | narrativeEngine, ChoicePanel, ChoiceCard |
| `Condition` | type (8 variants), target, value | narrativeEngine.evaluateConditions |
| `Effect` | type (7 variants), target, delta, value | narrativeEngine.applyOnEnterEffects |
| `GameState` | 10 fields — full serialisable snapshot | buildGameState, snapshotGameState, SaveManager |
| `GameSettings` | fontSize, highContrast, reducedMotion, textSpeed, hintsEnabled, autoSaveFrequency, audioVolume | metaSlice, AccessibilityProvider, SettingsPanel |
| `SaveFile` | version, timestamp, state: GameState | SaveManager |
| `CaseData` | meta, scenes, clues, npcs, variants | narrativeSlice.caseData, useCurrentScene |
| `EncounterState` | id, rounds, currentRound, isComplete, reactionCheckPassed | narrativeEngine (no UI consumer) |

### Duplicated models / logic

| What | Location A | Location B | Risk |
|---|---|---|---|
| GameState snapshot builder | `src/store/index.ts` → `buildGameState` | `src/store/slices/metaSlice.ts` → `snapshotGameState` | Field drift if GameState changes |
| GameState construction | `src/store/index.ts` → `buildGameState` | `src/components/NarrativePanel/NarrativePanel.tsx` → inline 10-field object in useEffect | Same drift risk |
| CheckResult type | `src/engine/diceEngine.ts` → `CheckResult` | `src/store/slices/narrativeSlice.ts` → `CheckResult` (local interface) | Different shapes — engine has `dc` and `natural`, slice has only `roll`, `modifier`, `total`, `tier` |

## Important Contracts

### Condition/Effect contract
The most important architectural contract. Content JSON interacts with game state exclusively through `Condition` (8 types, AND logic) and `Effect` (7 types). Evaluated by `narrativeEngine.evaluateConditions` and applied by `narrativeEngine.applyOnEnterEffects`. No other mechanism exists for content to gate or mutate state.

### Store slice contract
Each slice exports a TypeScript interface (`InvestigatorSlice`, `NarrativeSlice`, etc.) that defines its state shape and actions. `GameStore` is the intersection of all 6. Components access via selector hooks; engine accesses via `useStore.getState()`.

### Save file versioning contract
`SaveFile.version` gates migration logic in `SaveManager.migrate()`. Current version: 1. Migration pipeline: v0→v1 adds `factionReputation`. Any future schema change must add a migration step.

### Content file structure contract
Main cases: `meta.json` + `act1.json` + `act2.json` + `act3.json` + `clues.json` + `npcs.json` + `variants.json`. Vignettes: `meta.json` + `scenes.json` + `clues.json` + `npcs.json`. Enforced by `loadCase`/`loadVignette` fetch patterns and `validateCase.mjs`.

### Outcome tier contract
`Choice.outcomes: Record<OutcomeTier, string>` maps all 5 tiers to scene IDs. `processChoice` indexes into this with the dice result. Missing tiers cause `goToScene(undefined)` → crash. `validateCase.mjs` checks scene existence but not tier completeness.

## Architectural Patterns

### Pattern: Zustand + Immer sliced store
Single `useStore` composed from 6 `StateCreator` functions. Immer enables draft mutation. Selector hooks prevent full-store subscriptions. This is the dominant state pattern — consistent across all slices.

### Pattern: Engine functions with imperative store access
Engine functions (`processChoice`, `applyOnEnterEffects`, `startEncounter`, `processEncounterChoice`, `CaseProgression.completeCase`) call `useStore.getState()` to read/write the store. This makes them impure but avoids passing the store through function signatures.

### Pattern: Component-per-directory with barrel export
14 component directories, each with `index.ts`. Internal files never imported across boundaries (except in `__tests__/`).

### Pattern: Full-screen overlay for secondary UI
EvidenceBoard, CaseJournal, NPCGallery, SettingsPanel are overlays toggled by boolean state in `App.tsx`. All implement Escape-to-close.

### Pattern: SFX triggered from store mutations
`AudioManager.playSfx()` called inside Immer `set()` callbacks in 3 slice files (investigator, narrative, evidence). Side effects inside state mutations.

### Pattern: Module-level singletons
`AudioManager` (object with methods + lazy Map cache), `hintEngine` (mutable `let state`), `SaveManager` (object with methods + localStorage). None are injectable.

### Pattern: Property-based testing for invariants
fast-check used for dice bounds, NPC clamping, deduction red-herring propagation, save migration idempotency, slice isolation. `.property.test.ts` suffix convention.

## What Doesn't Make Sense

### Engine imports store (bidirectional dependency)
```
src/engine/narrativeEngine.ts → imports useStore from ../store
src/engine/caseProgression.ts → imports useStore from ../store
src/store/slices/narrativeSlice.ts → imports loadCase from ../engine/narrativeEngine
src/store/slices/metaSlice.ts → imports SaveManager from ../engine/saveManager
src/store/index.ts → imports resolveScene from ../engine/narrativeEngine
```
The engine and store layers have a circular dependency. This works because JavaScript modules resolve lazily, but it violates the intended layering (engine should be below store, not peer to it). `applyOnEnterEffects` and `processChoice` should return effect descriptors, not call store actions directly.

### `processChoice` returns a result AND performs side effects
`processChoice` navigates to the next scene (via `store.goToScene`) before returning the `ChoiceResult`. The caller (`ChoicePanel`) uses the return value to show the dice overlay, but the scene has already changed. The function's contract is confused — is it a query or a command?

### `caseData` excluded from save/load
`CaseData` (the loaded scene graph) is stored in the Zustand store but excluded from `GameState` (the serialisable type). This is intentional — case content shouldn't be in save files. But `loadGame` doesn't re-fetch it, so loading a save produces a game screen with no content. The save/load contract is broken.

### Hint engine is a stateful singleton outside the store
Every other piece of game state lives in Zustand. The hint engine uses a module-level `let state` with `Date.now()` calls. It has `_setState`/`_getState` test helpers — a workaround for the lack of DI. And its tracking inputs (`trackActivity`) are never called from any component.

### `buildDeduction` lives in a component directory
`src/components/EvidenceBoard/buildDeduction.ts` is a pure function with no React dependencies. It's tested in `src/engine/__tests__/deductionFormation.property.test.ts` — an engine test importing from a component directory. This function belongs in `src/engine/`.

### SFX inside Immer `set()` callbacks
Audio playback (an irreversible side effect) is triggered inside state mutation callbacks in `investigatorSlice`, `narrativeSlice`, and `evidenceSlice`. If mutations were ever batched, deferred, or replayed, audio would fire at wrong times. The `as SfxEvent` cast in `evidenceSlice` also bypasses type safety.

### `EncounterState`/`EncounterRound` types defined but never stored
The encounter system defines `EncounterState` and `EncounterRound` types, and the engine functions return/accept them, but no slice stores encounter state. The caller must manage it externally — but no caller exists.

### Empty string in `sceneHistory`
The first `goToScene` call pushes the current `currentScene` (which is `''`) onto `sceneHistory`. This sentinel value could break any code that iterates history expecting valid scene IDs.
