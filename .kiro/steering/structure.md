---
inclusion: always
---

# Project Structure

## Content Organization

All narrative content lives under `/content` as JSON. Game logic lives under `/src/engine`. Never mix the two.

```
/content
  /cases/[case-name]/
    meta.json       # CaseMeta: id, title, synopsis, acts, firstScene, facultyDistribution
    act1.json       # SceneNode[] for Act I
    act2.json       # SceneNode[] for Act II
    act3.json       # SceneNode[] for Act III
    clues.json      # Record<string, Clue> keyed by clue id
    npcs.json       # Record<string, NPCState> keyed by npc id
    variants.json   # SceneNode[] triggered by cross-case flags (variantOf + variantCondition)
  /side-cases/[vignette-name]/
    meta.json       # VignetteMeta: id, title, synopsis, optional triggerCondition, optional firstScene
    scenes.json     # Record<string, SceneNode> (two-act structure)
    clues.json
    npcs.json
```

## Component Hierarchy

```
<ErrorBoundary>
  <App>
  └── <AccessibilityProvider>       # Provides a11y settings: reducedMotion, fontSize, highContrast
      ├── <TitleScreen />
      ├── <LoadGameScreen />        # Save list with delete buttons
      ├── <CharacterCreation />     # Archetype selection + faculty point allocation
      └── <GameScreen>
          ├── <HeaderBar />         # Ability button, hint button, overlay toggles
          ├── <AmbientAudio />      # Non-rendering: ambient track from scene.ambientAudio
          ├── <GameContent>
          │   ├── <NarrativePanel />  # Scene text, illustration, dice roll overlay, clue discovery card
          │   ├── <ChoicePanel />     # Choice cards rendered from current SceneNode.choices
          │   └── <EncounterPanel />   # Multi-round encounter UI (when scene has encounter field)
          ├── <StatusBar />         # Vitality meter, composure meter
          ├── <EvidenceBoard />     # Overlay: clue cards, connection threads, deduction button
          ├── <CaseJournal />       # Overlay: clues gathered, deductions, key events
          ├── <NPCGallery />        # Overlay
          └── <SettingsPanel />     # Overlay
```

## Zustand Store

The store is a single `useStore` instance composed of domain slices via Immer middleware. Each slice owns its state shape and actions.

```
src/store/
  index.ts          # useStore + per-slice selector hooks (useInvestigator, useClues, etc.)
  types.ts          # GameStore = intersection of all slice types
  slices/
    investigatorSlice.ts   # investigator: Investigator; initInvestigator, updateFaculty, adjustComposure, adjustVitality, useAbility
    narrativeSlice.ts      # currentScene, currentCase, sceneHistory, caseData; goToScene, loadAndStartCase
    evidenceSlice.ts       # clues: Record<string,Clue>; deductions: Record<string,Deduction>; discoverClue, updateClueStatus, addDeduction
    npcSlice.ts            # npcs: Record<string,NPCState>; adjustDisposition, adjustSuspicion, setNpcMemoryFlag, removeNpc
    worldSlice.ts          # flags: Record<string,boolean>; factionReputation: Record<string,number>; setFlag, adjustReputation
    metaSlice.ts           # settings: GameSettings; saveGame, loadGame, updateSettings
```

Always use the exported selector hooks (`useInvestigator`, `useClues`, `useCaseData`, etc.) rather than subscribing to the full store. For actions, use the corresponding action selectors (`useInvestigatorActions`, `useEvidenceActions`, etc.). Use `useCurrentScene()` to get the resolved `SceneNode` for the current scene. Use `buildGameState(store)` to build a `GameState` snapshot for engine functions — this is a re-export of `snapshotGameState` from `src/utils/gameState.ts`, the single canonical snapshot builder.

## Key Data Models

All types are defined in `src/types/index.ts`. Key interfaces:

- `Investigator` — `name`, `archetype`, `faculties: Record<Faculty, number>`, `composure` (0–10), `vitality` (0–10), `abilityUsed`
- `Clue` — `id`, `type: ClueType`, `status: ClueStatus`, `connectsTo[]`, `grantsFaculty?`, `tags[]`, `isRevealed`
- `Deduction` — derived from linked clue ids; `unlocksScenes[]`, `unlocksDialogue[]`, `isRedHerring`
- `SceneNode` — `id`, `act`, `narrative`, `cluesAvailable: ClueDiscovery[]`, `choices: Choice[]`, `conditions?`, `onEnter?: Effect[]`, `variantOf?`
- `Choice` — `faculty?`, `difficulty?`, `advantageIf[]`, `outcomes: Record<OutcomeTier, string>`, `requiresClue?`, `requiresDeduction?`
- `NPCState` — `disposition` (−10 to +10), `suspicion` (0–10), `memoryFlags: Record<string, boolean>`
- `GameState` — full serialisable state used for save/load; matches the combined store shape
- `SaveFile` — wraps `GameState` with `version` and `timestamp` for migration support

Core enumerations: `Faculty` (`reason | perception | nerve | vigor | influence | lore`), `Archetype` (`deductionist | occultist | operator | mesmerist`), `OutcomeTier` (`critical | success | partial | failure | fumble`), `ClueStatus` (`new | examined | connected | deduced | contested | spent`).

## Engine Modules

```
src/engine/
  narrativeEngine.ts    # Scene resolution, condition evaluation, effect application
  diceEngine.ts         # Faculty checks → OutcomeTier; advantage/disadvantage logic
  buildDeduction.ts     # Pure deduction builder from connected clue IDs
  caseProgression.ts    # Act transitions, case completion checks
  hintEngine.ts         # Hint generation based on current clues and flags
  saveManager.ts        # localStorage persistence; versioned migrations; multi-save support
  audioManager.ts       # Howler.js ambient/SFX management
```

Engine functions are pure where possible. Side effects (store mutations) are applied by calling store actions, not by engines directly mutating state. SFX is triggered via a store subscription in `src/store/audioSubscription.ts`, not from slice actions.

## Conventions

- State shape is flat and normalised: use `Record<string, T>` keyed by id, not nested arrays.
- Deductions are always derived from linked clue ids — never hardcode deduction outcomes.
- `Condition` and `Effect` objects are the only mechanism for gating and mutating game state from content JSON; do not add ad-hoc logic in scene handlers.
- Components live in `src/components/[ComponentName]/` with an `index.ts` barrel export.
- Tests live in `src/components/__tests__/` and `src/engine/__tests__/`. Property-based tests use the `.property.test.ts` suffix.
- Content JSON is validated by `scripts/validateCase.mjs` — run it after editing case files. Validates all cases by default, or pass a specific case path.
