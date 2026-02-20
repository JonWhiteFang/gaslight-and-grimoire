# Technical Concepts

## Core Architecture

### Single-Page Application (SPA)
Client-only React 18 app bundled by Vite, deployed as static files to GitHub Pages. No server, no API, no backend. All state lives in-browser.
- **Status**: Fully implemented
- **Files**: `index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts`

### Two-Domain Separation (Content vs Engine)
Narrative data lives as JSON under `content/`, game logic lives under `src/engine/`. The two never import each other at build time; content is fetched at runtime via HTTP.
- **Status**: Fully implemented
- **Files**: `content/` (JSON), `src/engine/` (TypeScript), `src/engine/narrativeEngine.ts` → `fetchJson()`

### Zustand + Immer Store
Single `useStore` instance composed from 6 domain slices via Immer middleware. State is flat and normalised (`Record<string, T>` keyed by ID). Mutations happen by directly modifying draft state inside `set()` callbacks.
- **Status**: Fully implemented
- **Files**: `src/store/index.ts`, `src/store/types.ts`, `src/store/slices/*.ts`

### Selector Hook Pattern
Components access state via per-slice selector hooks (`useInvestigator`, `useClues`, etc.) and action hooks (`useInvestigatorActions`, etc.). Direct full-store subscription is discouraged.
- **Status**: Fully implemented
- **Files**: `src/store/index.ts` (exports ~15 hooks)

### GameState Snapshot
`buildGameState(store)` creates a plain serialisable `GameState` object from the store for engine functions and save/load. Duplicated as `snapshotGameState` in `metaSlice.ts`.
- **Status**: Fully implemented (with duplication)
- **Files**: `src/store/index.ts` → `buildGameState`, `src/store/slices/metaSlice.ts` → `snapshotGameState`

## Engine Layer

### Condition Evaluation
`evaluateConditions(conditions, state)` — pure AND logic over an array of `Condition` objects (8 types: hasClue, hasDeduction, hasFlag, facultyMin, archetypeIs, npcDisposition, npcSuspicion, factionReputation). This is the sole gating mechanism for scenes and choices.
- **Status**: Fully implemented
- **Files**: `src/engine/narrativeEngine.ts` → `evaluateConditions`, `evaluateCondition`

### Effect Application
`applyOnEnterEffects(effects)` — applies `Effect[]` to the store on scene entry (7 types: composure, vitality, flag, disposition, suspicion, reputation, discoverClue). The only engine function that directly mutates the store.
- **Status**: Fully implemented
- **Files**: `src/engine/narrativeEngine.ts` → `applyOnEnterEffects`

### Scene Resolution with Variants
`resolveScene(sceneId, state, caseData)` — returns a variant scene if its `variantCondition` is met, otherwise the base scene. Checked on every render via `useCurrentScene()`.
- **Status**: Fully implemented
- **Files**: `src/engine/narrativeEngine.ts` → `resolveScene`, `src/store/index.ts` → `useCurrentScene`

### Dice Engine
d20 roll system: `rollD20()`, advantage/disadvantage, modifier calculation (`floor((score-10)/2)`), 5-tier outcome resolution (critical/success/partial/failure/fumble), dynamic difficulty scaling.
- **Status**: Fully implemented
- **Files**: `src/engine/diceEngine.ts`

### Content Loading
`loadCase(caseId)` fetches 7 JSON files in parallel, indexes by ID, returns `CaseData`. `loadVignette(vignetteId)` does the same for side cases with 4 files.
- **Status**: Fully implemented
- **Files**: `src/engine/narrativeEngine.ts` → `loadCase`, `loadVignette`, `fetchJson`, `indexById`

### Content Validation
`validateContent(caseData)` checks for broken scene-graph edges and missing clue references. Mirrors the offline `validateCase.mjs` script. Never called at runtime.
- **Status**: Partially implemented (exists but unused at runtime)
- **Files**: `src/engine/narrativeEngine.ts` → `validateContent`, `scripts/validateCase.mjs`

### Save System with Versioned Migrations
localStorage persistence with `gg_save_` prefix. `SaveFile` wraps `GameState` with `version` + `timestamp`. Migration pipeline (v0→v1 adds `factionReputation`). Index at `gg_save_index`. 10-save cap.
- **Status**: Fully implemented (save side); broken on load (doesn't restore `caseData`)
- **Files**: `src/engine/saveManager.ts`, `src/store/slices/metaSlice.ts`

### Hint Engine
Stateful singleton tracking board visits, connection attempts, scene dwell time. 3 escalating hint levels. Respects `hintsEnabled` setting.
- **Status**: Partially implemented (engine complete, tracking calls never wired from components)
- **Files**: `src/engine/hintEngine.ts`, `src/components/HeaderBar/HintButton.tsx`

### Audio Manager
Howler.js singleton with lazy-cached `Howl` instances per SFX event (9 events). Separate `AmbientAudio` component for per-scene looping tracks with cross-fade.
- **Status**: Fully implemented (code); no audio assets in repo
- **Files**: `src/engine/audioManager.ts`, `src/components/AmbientAudio/AmbientAudio.tsx`

### Encounter System
`startEncounter` (reaction check for supernatural), `processEncounterChoice` (per-round faculty checks with dual-axis damage), `getEncounterChoices` (condition filtering + occult advantage). Full engine with no UI consumer.
- **Status**: Partially implemented (engine complete, no UI component)
- **Files**: `src/engine/narrativeEngine.ts` → `startEncounter`, `processEncounterChoice`, `getEncounterChoices`

### Case Progression
`completeCase` grants +1 faculty bonus from `last-critical-faculty` flag, checks vignette unlock conditions, auto-saves. Vignette registry with faction rep / NPC disposition / flag triggers.
- **Status**: Fully implemented (engine); no UI for case completion results
- **Files**: `src/engine/caseProgression.ts`

## Component Architecture

### Screen State Machine
`App.tsx` manages a `Screen` union type (`'title' | 'character-creation' | 'game' | 'load-game' | 'loading'`) via `useState`. No router — screen transitions are imperative `setScreen()` calls.
- **Status**: Fully implemented
- **Files**: `src/App.tsx`

### Overlay Pattern
Evidence Board, Case Journal, NPC Gallery, and Settings Panel are full-screen overlays toggled by boolean state in `App.tsx`. Each implements Escape-to-close. Settings Panel implements focus trapping.
- **Status**: Fully implemented
- **Files**: `src/App.tsx` (toggle state), `src/components/EvidenceBoard/`, `src/components/CaseJournal/`, `src/components/NPCGallery/`, `src/components/SettingsPanel/`

### Barrel Export Convention
Each component lives in `src/components/[Name]/` with an `index.ts` barrel export. Internal files are not imported across component boundaries.
- **Status**: Fully implemented
- **Files**: every `src/components/*/index.ts`

### Accessibility Provider
Renderless wrapper that applies CSS custom properties and classes to `document.documentElement` based on store settings (font size, high contrast, reduced motion). Detects OS `prefers-reduced-motion` on mount.
- **Status**: Fully implemented
- **Files**: `src/components/AccessibilityProvider/AccessibilityProvider.tsx`, `src/index.css`

### Error Boundary
Class component wrapping the entire app. Catches render errors, logs to console, shows a recovery screen with "Return to Title" button.
- **Status**: Fully implemented
- **Files**: `src/components/ErrorBoundary/ErrorBoundary.tsx`, `src/main.tsx`

## Testing

### Property-Based Testing
fast-check used for dice engine, narrative engine, NPC bounds, deduction formation, save manager, and slice isolation. Convention: `.property.test.ts` suffix.
- **Status**: Fully implemented
- **Files**: `src/engine/__tests__/*.property.test.ts`, `src/store/__tests__/sliceIsolation.property.test.ts`

### Component Testing
React Testing Library + Vitest for component behavior tests. jsdom environment. Setup file at `src/test-setup.ts`.
- **Status**: Fully implemented
- **Files**: `src/components/__tests__/*.test.tsx`

## Value Clamping
Numeric game values are clamped at mutation time: composure [0,10], vitality [0,10], disposition [-10,+10], suspicion [0,10], audio volume [0,1]. Faculty scores are uncapped (only capped at 20 in `grantFacultyBonus`). Faction reputation is unbounded.
- **Status**: Fully implemented (per-field, inline `Math.max/Math.min`)
- **Files**: `src/store/slices/investigatorSlice.ts`, `src/store/slices/npcSlice.ts`, `src/engine/audioManager.ts`, `src/engine/caseProgression.ts`
