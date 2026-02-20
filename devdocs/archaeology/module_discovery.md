# Module Discovery

> Reconstructed from import analysis and code structure.

## Natural Module Boundaries

The codebase has 5 natural modules, plus content:

```
┌─────────────────────────────────────────────────────────┐
│ CONTENT (content/)                                       │
│   Pure JSON data. No code imports. Fetched at runtime.   │
└──────────────────────────┬──────────────────────────────┘
                           │ fetch()
┌──────────────────────────▼──────────────────────────────┐
│ TYPES (src/types/)                                       │
│   All type definitions. Imported by everything.          │
│   Zero runtime code. Zero dependencies.                  │
│   Files: index.ts (~220 lines)                           │
└──────────────────────────┬──────────────────────────────┘
                           │ type imports
┌──────────────────────────▼──────────────────────────────┐
│ ENGINE (src/engine/)                                     │
│   Game logic. Aspires to be pure functions.               │
│   6 modules: narrativeEngine, diceEngine, caseProgression│
│              hintEngine, saveManager, audioManager        │
│   Files: 6 modules + 8 test files                        │
└──────────────────────────┬──────────────────────────────┘
                           │ (bidirectional — see below)
┌──────────────────────────▼──────────────────────────────┐
│ STORE (src/store/)                                       │
│   Zustand + Immer. 6 domain slices.                      │
│   Selector hooks, action hooks, buildGameState.          │
│   Files: index.ts, types.ts, 6 slices, 1 test file      │
└──────────────────────────┬──────────────────────────────┘
                           │ hooks
┌──────────────────────────▼──────────────────────────────┐
│ COMPONENTS (src/components/)                             │
│   React UI. 14 component directories + __tests__/.       │
│   Each with index.ts barrel export.                      │
│   Files: ~40 component files + 9 test files              │
└─────────────────────────────────────────────────────────┘
```

Plus two small utility modules:
- `src/data/archetypes.ts` — static archetype definitions and faculty constants
- `src/main.tsx` — bootstrap (ReactDOM.createRoot)
- `src/App.tsx` — screen state machine and overlay orchestration
- `src/index.css` — Tailwind directives and global a11y classes

## Dependency Relationships (import counts)

### Who imports types? (53 imports across 41 files)
Everything. Types is the universal dependency. This is correct — it's the shared vocabulary.

### Who imports store? (22 imports across 20 files)
- 14 component files (correct — components read/write state)
- 2 engine files: `narrativeEngine.ts`, `caseProgression.ts` (problematic — engine should be below store)
- 1 engine test: `caseProgression.test.ts`
- 1 store file: `store/index.ts` (self-import for `resolveScene`)

### Who imports engine? (24 imports across 19 files)
- 9 component files (correct — components call engine functions)
- 4 store slice files (correct — slices use engine for loading, saving, audio, progression)
- 1 store index (correct — `resolveScene` for `useCurrentScene`)
- 5 engine test files (correct)

### Who imports data? (3 imports)
- `CharacterCreation.tsx`, `FacultyAllocation.tsx`, `ArchetypeSelect.tsx` — all in CharacterCreation component

### Engine-to-engine dependencies
```
narrativeEngine → diceEngine (performCheck, rollD20, resolveDC)
caseProgression → saveManager (SaveManager.save)
```
All other engine modules are independent.

## Coupling Analysis

### Tight coupling: Engine ↔ Store (bidirectional)

This is the most significant coupling issue. The intended layering is:
```
types → engine → store → components
```

The actual dependency graph has cycles:
```
narrativeEngine.ts ──imports──→ useStore (from ../store)
caseProgression.ts ──imports──→ useStore (from ../store)
narrativeSlice.ts  ──imports──→ loadCase (from ../engine/narrativeEngine)
narrativeSlice.ts  ──imports──→ CaseProgression (from ../engine/caseProgression)
narrativeSlice.ts  ──imports──→ AudioManager (from ../engine/audioManager)
metaSlice.ts       ──imports──→ SaveManager (from ../engine/saveManager)
evidenceSlice.ts   ──imports──→ AudioManager (from ../engine/audioManager)
investigatorSlice.ts ──imports──→ AudioManager (from ../engine/audioManager)
store/index.ts     ──imports──→ resolveScene (from ../engine/narrativeEngine)
```

This works at runtime because JS modules resolve lazily, but it means:
- Engine functions can't be tested without a store
- Store slices can't be tested without engine modules
- The "engine is pure" aspiration is violated

### Tight coupling: Components → Engine (direct)

9 component files import directly from engine modules:
- `NarrativePanel` → `narrativeEngine` (applyOnEnterEffects, canDiscoverClue)
- `ChoicePanel` → `narrativeEngine` (evaluateConditions, processChoice)
- `ChoiceCard` → `diceEngine` (calculateModifier)
- `FacultyAllocation` → `diceEngine` (calculateModifier)
- `DeductionButton` → `diceEngine` (performCheck)
- `HintButton` → `hintEngine` (shouldShowHint, getHint)
- `TitleScreen` → `saveManager` (SaveManager.listSaves)
- `LoadGameScreen` → `saveManager` (SaveManager.listSaves, deleteSave)

This is acceptable for a project this size but means components have knowledge of engine internals. A stricter architecture would route all engine calls through store actions.

### Loose coupling: Components ↔ Components

No component imports another component's internal files. All cross-component references go through barrel exports (`index.ts`). The only exception is `__tests__/` files, which import internal files directly for unit testing — this is expected and acceptable.

`App.tsx` imports 12 components directly (it's the orchestrator). No other component imports another component.

### Loose coupling: AudioManager

`AudioManager` is imported by 3 store slices (investigator, narrative, evidence) and by `AmbientAudio` component. It has no dependencies on the store or other engine modules — it only imports `Howl` from `howler`. This is the cleanest engine module.

### Loose coupling: hintEngine

`hintEngine` imports only `GameState` from types. No store dependency, no other engine dependency. But it's a stateful singleton with `Date.now()` calls, making it hard to test despite the clean import graph.

## Cohesion Analysis

### High cohesion: Store slices
Each slice owns a clear domain: investigator state, narrative state, evidence state, NPC state, world state, meta/settings. Actions only mutate their own domain (with one exception: `npcSlice.adjustDisposition` calls `worldSlice.adjustReputation` via `get()`).

### High cohesion: diceEngine
Pure functions for d20 mechanics. No side effects, no store access, no external dependencies. The most cohesive module in the codebase.

### High cohesion: saveManager
Focused on localStorage persistence. Clean API: save, load, list, delete, migrate. No store dependency (takes/returns `GameState` as plain data).

### Medium cohesion: narrativeEngine
Does too many things: content loading, condition evaluation, scene resolution, effect application, choice processing, encounter system. These are 6 distinct responsibilities in one 400+ line file. The encounter functions alone could be a separate module.

### Medium cohesion: EvidenceBoard component
Mixes DOM measurement (getBoundingClientRect), connection state management, tag-based brightening logic, and deduction orchestration in a single 200+ line component. The connection logic could be a custom hook.

### Low cohesion: App.tsx
Orchestrates screen state, overlay toggles, ability activation, case loading, save loading, and error handling. This is expected for a root component but it's doing a lot.

## Shared Utilities

### `buildGameState` / `snapshotGameState`
Two functions that do the same thing (build a plain `GameState` from the store). `buildGameState` is in `store/index.ts` (exported). `snapshotGameState` is in `metaSlice.ts` (local). Should be one function in a shared location.

### `indexById` (narrativeEngine.ts)
Converts `T[]` to `Record<string, T>`. Used only in `loadCase`/`loadVignette`. Not exported. Could be a shared utility if other modules need it.

### `calculateModifier` (diceEngine.ts)
`floor((score - 10) / 2)`. Imported by `ChoiceCard` and `FacultyAllocation` for display purposes. Clean shared utility.

### `fetchJson` (narrativeEngine.ts)
Prepends `BASE_URL` and fetches JSON. Not exported. `AmbientAudio` duplicates the URL construction logic inline.

## Boundary Violations

### 1. Engine imports store (architectural inversion)
`narrativeEngine.ts` and `caseProgression.ts` import `useStore` from the store layer. This inverts the intended dependency direction. Engine should be below store, receiving state as parameters and returning results.

**Files**: `src/engine/narrativeEngine.ts` (line 29), `src/engine/caseProgression.ts` (line 8)

### 2. `buildDeduction` lives in component layer
`src/components/EvidenceBoard/buildDeduction.ts` is a pure function tested in `src/engine/__tests__/deductionFormation.property.test.ts`. An engine test reaches into a component directory. The function should live in `src/engine/`.

**Files**: `src/components/EvidenceBoard/buildDeduction.ts`, `src/engine/__tests__/deductionFormation.property.test.ts` (line 11)

### 3. SFX side effects inside store mutations
`AudioManager.playSfx()` is called inside Immer `set()` callbacks in 3 slice files. Store mutations should be pure state transformations. Audio is an irreversible side effect that belongs in a subscription or middleware.

**Files**: `src/store/slices/investigatorSlice.ts` (lines 45, 55), `src/store/slices/narrativeSlice.ts` (lines 40, 52), `src/store/slices/evidenceSlice.ts` (line 20)

### 4. Components call `applyOnEnterEffects` directly
`NarrativePanel` calls `applyOnEnterEffects` (an engine function that mutates the store) from a `useEffect`. This bypasses the store action pattern — the component is directly triggering store mutations through the engine layer instead of dispatching a store action.

**File**: `src/components/NarrativePanel/NarrativePanel.tsx` (line ~50)

### 5. Components access `SaveManager` directly
`TitleScreen` and `LoadGameScreen` import `SaveManager` directly to call `listSaves()` and `deleteSave()`. These should be store actions (on `metaSlice`) to maintain the component → store → engine layering.

**Files**: `src/components/TitleScreen/TitleScreen.tsx` (line 2), `src/components/TitleScreen/LoadGameScreen.tsx` (lines 2–3)

### 6. `NarrativePanel` constructs `GameState` inline
Instead of using `buildGameState`, `NarrativePanel` manually constructs a 10-field `GameState` object inside a `useEffect`. This duplicates the snapshot logic and could drift.

**File**: `src/components/NarrativePanel/NarrativePanel.tsx` (lines ~55–65)
