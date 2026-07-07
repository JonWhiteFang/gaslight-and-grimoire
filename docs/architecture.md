# Architecture

## Overview

Gaslight & Grimoire is a browser-based choose-your-own-adventure game built with
React 18, a single Zustand store (Immer middleware), Tailwind CSS, Framer Motion,
and Howler.js, deployed to GitHub Pages. The system enforces a strict split
between two domains:

- **`public/content/`** — narrative data as JSON (manifest, cases, side-cases,
  shared scenes). Vite serves `public/` at the site root, so the engine fetches
  these at runtime as `/content/...` (prefixed with `import.meta.env.BASE_URL`
  for the GitHub Pages base path).
- **`src/engine/`** — game logic, written as pure functions where possible, with
  no imports of the store.

See [./Gaslight_&_Grimoire_design.md](./Gaslight_&_Grimoire_design.md) for design intent.

## Component hierarchy

The tree is rooted at `<ErrorBoundary>` (wired in `main.tsx`), which wraps
`<App>`. `App` chooses a screen from local state (`title`, `character-creation`,
`case-selection`, `game`, `load-game`, `loading`, `case-complete`) and wraps
every screen in `<AccessibilityProvider>`.

```
<ErrorBoundary>                       # Catches render errors, shows fallback UI
  <App>                               # Screen router (local useState)
    <AccessibilityProvider>           # Supplies reducedMotion / fontSize / highContrast
      ├── <TitleScreen />             # New Game / Load Game / Settings entry
      ├── <LoadGameScreen />          # Save list with load + delete
      ├── <CharacterCreation />       # Archetype pick + faculty point allocation
      ├── <CaseSelection />           # Browser of main cases + unlocked vignettes
      ├── <CaseCompletion />          # End-of-case screen (faculty bonus, unlocks)
      └── (game screen)
          ├── <HeaderBar />           # Ability, overlay toggles, save, review-back
          ├── <AmbientAudio />        # Non-rendering; plays scene ambient track
          ├── <GameContent>           # Resolves current scene, picks body panel
          │   ├── <NarrativePanel />  # Scene text, illustration, dice/clue/effect cards
          │   ├── <ChoicePanel />     # Choice cards (default body)
          │   └── <EncounterPanel />  # Multi-round encounter UI (when scene.encounter)
          ├── <StatusBar />           # Composure + vitality meters
          ├── <EvidenceBoard />       # Overlay: clue cards, connection threads, deduce
          ├── <CaseJournal />         # Overlay: clues, deductions, scene timeline
          ├── <NPCGallery />          # Overlay: NPC dispositions/suspicion
          └── <SettingsPanel />       # Overlay: accessibility + audio + hints settings
```

`GameContent` renders `NarrativePanel` and then chooses the body: a terminal
"Case Complete" button when the scene has no choices and no encounter, an
`EncounterPanel` when `scene.encounter` is set, otherwise `ChoicePanel`. All 16
component directories under `src/components/` are represented above
(`AccessibilityProvider`, `AmbientAudio`, `CaseCompletion`, `CaseJournal`,
`CaseSelection`, `CharacterCreation`, `ChoicePanel`, `EncounterPanel`,
`ErrorBoundary`, `EvidenceBoard`, `HeaderBar`, `NPCGallery`, `NarrativePanel`,
`SettingsPanel`, `StatusBar`, `TitleScreen`).

## Store: six slices

The root store (`src/store/index.ts`) is a single `create<GameStore>()(immer(...))`
composed from six slice creators. `GameStore` (`src/store/types.ts`) is the
intersection of the six slice interfaces.

| Slice | State | Actions |
|---|---|---|
| `investigatorSlice` | `investigator` | `initInvestigator`, `updateFaculty`, `adjustComposure`, `adjustVitality`, `useAbility`, `resetAbility` |
| `narrativeSlice` | `currentScene`, `currentCase`, `sceneHistory`, `lastCheckResult`, `caseData` | `goToScene`, `setCheckResult`, `loadAndStartCase`, `loadAndStartVignette`, `completeCase` |
| `evidenceSlice` | `clues`, `deductions`, `connections` | `discoverClue`, `updateClueStatus`, `addDeduction`, `addConnection`, `clearConnections` |
| `npcSlice` | `npcs` | `adjustDisposition`, `adjustSuspicion`, `setNpcMemoryFlag`, `removeNpc` |
| `worldSlice` | `flags`, `factionReputation` | `setFlag`, `adjustReputation`, `applyEffects` |
| `metaSlice` | `settings` | `updateSettings`, `saveGame`, `autoSave`, `loadGame` |

## Store rules

- **Use hooks, never the full store.** Selector hooks exported from
  `store/index.ts`: `useInvestigator`, `useNarrative`, `useClues`,
  `useDeductions`, `useConnections`, `useNpcs`, `useFlags`,
  `useFactionReputation`, `useSettings`, `useCaseData`. Action hooks:
  `useInvestigatorActions`, `useNarrativeActions`, `useEvidenceActions`,
  `useNpcActions`, `useWorldActions`, `useMetaActions`.
- **Flat, normalized state.** Clues, deductions, and NPCs are stored as
  `Record<string, T>` keyed by id — no nested arrays.
- **Immer mutate-draft.** Slice actions mutate the draft state directly inside
  `set((state) => { ... })`; no manual spreading.
- **`buildGameState(store)`** (exported as an alias of `snapshotGameState`,
  `src/utils/gameState.ts`) builds the serialisable `GameState` snapshot passed
  to engine functions. `useCurrentScene()` combines `currentScene` + `caseData`
  + a snapshot and calls `resolveScene` to return the resolved `SceneNode`
  (handling variant resolution), or `null`.

## Cross-slice couplings

- **`adjustDisposition` → `adjustReputation`.** After clamping an NPC's
  disposition, `npcSlice.adjustDisposition` reads the NPC's `faction` and, if
  set, calls `get().adjustReputation(npc.faction, delta * 0.5)` — a hidden
  proportional (factor **0.5**) propagation into faction reputation.
- **`applyEffects` lives in `worldSlice`, not the engine.** It is a store action
  that dispatches an `Effect[]` to the relevant slice actions (`composure`,
  `vitality`, `flag`, `disposition`, `suspicion`, `reputation`, `discoverClue`,
  `setMemoryFlag`). It is invoked from `NarrativePanel` on scene entry.
- **Evidence-board connections persist in `evidenceSlice`.** `connections` holds
  `{ fromId, toId }` id pairs (deduped, order-insensitive). DOM anchor points are
  recomputed on render; the store never holds pixel coordinates. Connections are
  cleared on case/vignette load.

## Data flow (runtime)

```
CaseSelection → loadAndStartCase(id)  (or loadAndStartVignette)
  → loadCase(id) / loadVignette(id)   fetch /content/cases/<id>/*.json (or side-cases)
  → validateContent + index arrays into Record<string, T> by id
  → set caseData; reset clues/npcs/deductions/connections; clear ability/reward
    flags (ability-auto-succeed-{reason,vigor,influence}, ability-veil-sight-active,
    last-critical-faculty) — other world flags persist across cases
  → goToScene(firstScene)             push prev scene to sceneHistory
      → NarrativePanel renders scene, fires worldSlice.applyEffects(onEnter)
      → ChoicePanel → processChoice(choice, state, actions)
          → diceEngine (resolveDC, performCheck / rollD20)
          → actions.goToScene(nextSceneId) + NPC/effect mutations
      → store mutation → React re-render
```

`loadAndStartCase`/`loadAndStartVignette` fetch, validate, index, and reset store
state; content is fetched from `/content/...` (base-path prefixed). Auto-save
fires from `goToScene` when `settings.autoSaveFrequency === 'scene'`.

## Engine ↔ store boundary

- **Engine functions take an `EngineActions` parameter.** `processChoice`,
  `startEncounter`, and `processEncounterChoice` receive `actions: EngineActions`
  (`src/engine/engineActions.ts`) rather than reaching into the store. Note:
  `processChoice` calls `actions.goToScene(nextSceneId)` **before** returning its
  `ChoiceResult` — navigation is a side effect of the call.
- **Zero store imports in engine source.** No non-test file under `src/engine/`
  imports `useStore` (verified — see below). The only `useStore` reference under
  `src/engine/` is in a test file.
- **Audio is a store subscription.** `initAudioSubscription()`
  (`src/store/audioSubscription.ts`) registers a `useStore.subscribe` listener
  that diffs successive states and plays SFX (composure/vitality decreases,
  scene transitions, dice rolls, clue reveals). It is wired once in `main.tsx`
  at module load, before React renders.

## Bounded state

All numeric state is clamped inside its slice action:

| Value | Bounds | Where |
|---|---|---|
| Composure | `[0, 10]` | `investigatorSlice.adjustComposure` |
| Vitality | `[0, 10]` | `investigatorSlice.adjustVitality` |
| NPC disposition | `[-10, 10]` | `npcSlice.adjustDisposition` |
| NPC suspicion | `[0, 10]` | `npcSlice.adjustSuspicion` |
| Faction reputation | `[-10, 10]` | `worldSlice.adjustReputation` |

## Determinism notes

`Date.now()` and `Math.random()` are called directly and are not injectable;
tests work around this rather than seeding it. The call sites — dice rolls,
deduction/save id generation, and hint dwell-time tracking — are listed with
exact `file:line` in the Verification block below. (`saveManager.ts` does not
itself call either; the save id is generated in `metaSlice`.)

## Verification

```
$ grep -rl "useStore" src/engine
src/engine/__tests__/caseProgression.test.ts   # test only; no engine source match

$ grep -n "adjustReputation" src/store/slices/npcSlice.ts
33:      get().adjustReputation(npc.faction, delta * 0.5);

$ grep -rnE "Date.now\(\)|Math.random\(\)" \
    src/engine/diceEngine.ts src/engine/hintEngine.ts \
    src/engine/saveManager.ts src/engine/buildDeduction.ts \
    src/store/slices/metaSlice.ts
src/engine/diceEngine.ts:23:  return Math.floor(Math.random() * 20) + 1;
src/engine/buildDeduction.ts:26:    id: `deduction-${Date.now()}-${Math.random().toString(36).slice(2)}`,
src/engine/hintEngine.ts:41:  sceneEntryTime: Date.now(),
src/engine/hintEngine.ts:83:  const dwellTrigger = Date.now() - state.sceneEntryTime >= SCENE_DWELL_MS;
src/engine/hintEngine.ts:145:  state.sceneEntryTime = Date.now();
src/store/slices/metaSlice.ts:43:    const saveId = `save-${Date.now()}`;
# (saveManager.ts: no match)
```
