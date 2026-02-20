---
inclusion: always
---

# Tech Stack

## Core Dependencies
- React 18 — UI rendering and component architecture
- Zustand 4 with Immer middleware — state management (single `useStore` instance, sliced)
- Tailwind CSS 3 + CSS custom properties — styling and theming
- Framer Motion 11 — dice rolls, transitions, typewriter effects (confirmed in use; not "or CSS animations")
- Howler.js 2 — ambient sound and SFX (confirmed in use; not "or Web Audio API")
- Vitest 3 + React Testing Library — unit and property-based tests
- fast-check — property-based testing (`.property.test.ts` suffix convention)
- TypeScript 5, Vite 7

## Persistence
- IndexedDB primary, localStorage fallback (implemented in `src/engine/saveManager.ts`)
- Save files are wrapped in `SaveFile` with `version` + `timestamp` for forward-compatible migrations

## State Management Rules
- Single `useStore` (Zustand + Immer) composed from six domain slices
- Always use exported selector hooks — never subscribe to the full store directly:
  - `useInvestigator`, `useNarrative`, `useClues`, `useDeductions`, `useNpcs`, `useFlags`, `useFactionReputation`, `useSettings`, `useCaseData`
- Use `useCurrentScene()` to get the resolved `SceneNode` for the current scene (handles variant resolution)
- Use `buildGameState(store)` to build a `GameState` snapshot for engine functions
- Always use action selector hooks for mutations:
  - `useInvestigatorActions`, `useNarrativeActions`, `useEvidenceActions`, `useNpcActions`, `useWorldActions`, `useMetaActions`
- State shape is flat and normalised: `Record<string, T>` keyed by id — no deeply nested objects or arrays
- Immer middleware is active — mutate draft state directly inside slice actions; no manual spreading

## Store Slices (`src/store/slices/`)
| Slice | Key state | Key actions |
|---|---|---|
| `investigatorSlice` | `investigator` | `initInvestigator`, `updateFaculty`, `adjustComposure`, `adjustVitality`, `useAbility`, `resetAbility` |
| `narrativeSlice` | `currentScene`, `currentCase`, `sceneHistory`, `caseData` | `goToScene`, `loadAndStartCase` |
| `evidenceSlice` | `clues`, `deductions` | `discoverClue`, `updateClueStatus`, `addDeduction` |
| `npcSlice` | `npcs` | `adjustDisposition`, `adjustSuspicion`, `setNpcMemoryFlag`, `removeNpc` |
| `worldSlice` | `flags`, `factionReputation` | `setFlag`, `adjustReputation` |
| `metaSlice` | `settings` | `saveGame`, `loadGame`, `updateSettings` |

## Common Commands
```bash
npm install          # install dependencies
npm run dev          # development server (Vite)
npm test             # vitest watch mode
npm run test:run     # vitest single run (use this in CI / agent contexts)
npm run build        # tsc + vite build
```

## Code Style & Conventions
- Components live in `src/components/[ComponentName]/` with an `index.ts` barrel export
- Engine functions (`src/engine/`) are pure where possible; side effects go through store actions, not direct state mutation
- `Condition` and `Effect` objects are the only mechanism for gating/mutating game state from content JSON — no ad-hoc logic in scene handlers
- Content JSON (under `/content/`) is validated by `scripts/validateCase.mjs` — run after editing case files
- Tests live in `src/components/__tests__/` and `src/engine/__tests__/`
- Property-based tests use the `.property.test.ts` suffix and fast-check
