# Intro to the Codebase — Architecture

> Derived from code on 2026-02-20. Code is the source of truth.

## One-sentence summary

A client-only React SPA where narrative content (JSON) flows through pure engine functions into a Zustand store, and React components subscribe to store slices to render the UI.

## Two Strict Domains

```
content/   ← narrative data (JSON files, never imports src/)
src/       ← game logic + UI (never writes JSON at runtime)
```

Content is fetched at runtime via `fetch()` from the Vite-served public directory. The engine parses it into `Record<string, T>` maps and loads them into the store. There is no build-time content compilation.

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        CONTENT (JSON)                            │
│  content/cases/*/act1.json, clues.json, npcs.json, etc.          │
└──────────────────┬───────────────────────────────────────────────┘
                   │ fetch() at case start
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ENGINE (src/engine/)                           │
│  narrativeEngine  — loadCase, evaluateConditions, resolveScene,  │
│                     applyOnEnterEffects, processChoice,          │
│                     startEncounter, processEncounterChoice        │
│  diceEngine       — rollD20, performCheck, resolveDC             │
│  caseProgression  — completeCase, checkVignetteUnlocks           │
│  hintEngine       — trackActivity, shouldShowHint, getHint       │
│  saveManager      — save, load, migrate, listSaves, deleteSave   │
│  audioManager     — playSfx, setMasterSfxVolume                  │
└──────────────────┬───────────────────────────────────────────────┘
                   │ calls store actions
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STORE (src/store/)                             │
│  Single useStore (Zustand + Immer), composed from 6 slices:      │
│    investigatorSlice  narrativeSlice  evidenceSlice               │
│    npcSlice           worldSlice      metaSlice                   │
└──────────────────┬───────────────────────────────────────────────┘
                   │ selector hooks
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  COMPONENTS (src/components/)                     │
│  App.tsx orchestrates screen state (title → creation → game)     │
│  Components subscribe via useInvestigator, useClues, etc.        │
│  Actions dispatched via useInvestigatorActions, etc.              │
└──────────────────────────────────────────────────────────────────┘
```

### Typical choice flow

1. User clicks a `ChoiceCard` in `ChoicePanel`.
2. `ChoicePanel.handleSelect` calls `processChoice(choice, gameState)` from the narrative engine.
3. `processChoice` calls `performCheck` (dice engine) if the choice has a faculty/difficulty.
4. `processChoice` calls `store.adjustDisposition` / `store.adjustSuspicion` if `npcEffect` is present.
5. `processChoice` calls `store.goToScene(nextSceneId)`.
6. `goToScene` (narrative slice) pushes to `sceneHistory`, sets `currentScene`, plays SFX, and triggers autosave if configured.
7. `NarrativePanel` re-renders via `useCurrentScene()`, which calls `resolveScene` to check for variant overrides.
8. `NarrativePanel` applies `onEnter` effects and auto-discovers clues.

### No event bus, no reducers

There is no pub/sub event bus. State mutations go through Zustand store actions directly. The Immer middleware means slice actions mutate draft state — no manual spreading. Engine functions that need to mutate state call `useStore.getState()` to get the store instance and invoke actions imperatively.

## Key Abstractions

| Concept | What it is | Where it lives |
|---|---|---|
| `SceneNode` | Atomic narrative unit — text, choices, clues, conditions, effects | `src/types/index.ts`, content JSON |
| `Condition` | Gate for scene access / choice visibility (8 types, AND logic) | `src/types/index.ts`, evaluated in `narrativeEngine.ts` |
| `Effect` | State mutation triggered on scene entry (7 types) | `src/types/index.ts`, applied in `narrativeEngine.ts` |
| `Choice` | Player action — may have faculty check, NPC effect, encounter damage | `src/types/index.ts` |
| `OutcomeTier` | Result of a d20 check: critical/success/partial/failure/fumble | `src/types/index.ts`, resolved in `diceEngine.ts` |
| `GameState` | Full serialisable snapshot of all game state | `src/types/index.ts`, built by `buildGameState()` |
| `CaseData` | Loaded case content: scenes, clues, NPCs, variants | `src/types/index.ts`, loaded by `narrativeEngine.loadCase()` |
| `SaveFile` | Versioned wrapper around `GameState` for persistence | `src/types/index.ts`, managed by `saveManager.ts` |

There are no repository classes, use-case objects, coordinators, or state machines. The architecture is simpler than that:

- **Engine functions** are the "use cases" — mostly pure, taking `GameState` and returning results.
- **Store slices** are the "repositories" — they own state and expose mutation actions.
- **Components** are the "coordinators" — they wire engine calls to store actions.

## State Management Details

### Store composition

```typescript
// src/store/index.ts
export const useStore = create<GameStore>()(
  immer((...args) => ({
    ...createInvestigatorSlice(...args),
    ...createNarrativeSlice(...args),
    ...createEvidenceSlice(...args),
    ...createNpcSlice(...args),
    ...createWorldSlice(...args),
    ...createMetaSlice(...args),
  })),
);
```

`GameStore` is the intersection of all 6 slice interfaces. Each slice is a `StateCreator` that receives `set` and `get` from Zustand.

### Access patterns

- **Read**: selector hooks (`useInvestigator()`, `useClues()`, `useCurrentScene()`, etc.)
- **Write**: action hooks (`useInvestigatorActions()`, `useEvidenceActions()`, etc.)
- **Engine access**: `useStore.getState()` for imperative calls from engine functions
- **Snapshots**: `buildGameState(store)` creates a plain `GameState` for engine functions and save/load

### Cross-slice side effects

- `npcSlice.adjustDisposition` propagates to `worldSlice.adjustReputation` at `delta * 0.5` for faction-aligned NPCs.
- `narrativeSlice.goToScene` triggers `metaSlice.autoSave` when `autoSaveFrequency === 'scene'`.
- `investigatorSlice.adjustComposure/adjustVitality` triggers `AudioManager.playSfx` on negative deltas.
- `evidenceSlice.discoverClue` triggers `AudioManager.playSfx` with a clue-type-specific event.

## Dependency Injection — or Lack Thereof

There is no DI framework. Dependencies are imported directly:

- Engine modules import `useStore` from `../store` to call actions imperatively.
- Components import engine functions and store hooks directly.
- `AudioManager` is a module-level singleton with a lazy `Map<SfxEvent, Howl>` cache.
- `HintEngine` is a module-level singleton with mutable `let state`.
- `SaveManager` is a plain object with methods that call `localStorage` directly.

### Determinism gaps (documented, not introduced by this doc)

| Location | Issue |
|---|---|
| `diceEngine.rollD20()` | `Math.random()` — no seed, not injectable |
| `hintEngine.resetForScene()` | `Date.now()` — module-level mutable state |
| `saveManager.save()` | `new Date().toISOString()` for timestamps |
| `metaSlice.saveGame()` | `Date.now()` for save ID generation |
| `buildDeduction.ts` | `Date.now()` + `Math.random()` for deduction IDs |

Tests work around this: property-based tests in `diceEngine.property.test.ts` test the pure `resolveCheck` function rather than `rollD20`. The hint engine exposes `_setState` for test injection.

## Modularization

```
src/
  types/index.ts          ← ALL type definitions (single file, ~220 lines)
  data/archetypes.ts      ← Static archetype data (constants)
  engine/                 ← Pure-ish game logic (6 modules)
  store/                  ← Zustand store + 6 slices
  components/             ← React components (14 directories, each with index.ts barrel)
```

Components follow a strict convention: `src/components/[Name]/` with an `index.ts` barrel export. No component imports another component's internal files — only the barrel.

Engine modules are loosely coupled. The main dependency chain is:
```
narrativeEngine → diceEngine (for performCheck, resolveDC)
narrativeEngine → store (for applyOnEnterEffects, processChoice)
caseProgression → store, saveManager
All slices → audioManager (for SFX triggers)
metaSlice → saveManager
```

## Content System

Content is authored as JSON under `content/`. Two formats:

- **Main cases**: `meta.json` + `act1.json` + `act2.json` + `act3.json` + `clues.json` + `npcs.json` + `variants.json`
- **Side cases (vignettes)**: `meta.json` + `scenes.json` + `clues.json` + `npcs.json`

`Condition` and `Effect` objects in the JSON are the only mechanism for gating and mutating game state from content. No ad-hoc logic in scene handlers.

Validation: `node scripts/validateCase.mjs` walks all case directories, checks for broken scene-graph edges (choice outcomes pointing to nonexistent scenes) and missing clue references. The same validation logic exists in `narrativeEngine.validateContent()` for runtime use.

## Accessibility

`AccessibilityProvider` wraps the entire app and applies CSS custom properties + class names to `document.documentElement`:
- `--font-size-base` (from `settings.fontSize`)
- `.high-contrast` class (toggles CSS variables for bg/text/border)
- `.reduced-motion` class (sets `animation-duration: 0ms !important` and `transition-duration: 0ms !important` globally)

OS `prefers-reduced-motion` is detected on first mount and synced to the store.

All overlays implement focus trapping (SettingsPanel) and Escape-to-close. All interactive elements have `min-h-[44px]` for touch targets. ARIA labels and roles are used throughout.
