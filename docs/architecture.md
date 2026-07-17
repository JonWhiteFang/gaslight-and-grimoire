# Architecture

## Overview

Gaslight & Grimoire is a browser-based choose-your-own-adventure game built with
React 19, a single Zustand store (Immer middleware), Tailwind CSS v4, Framer Motion,
and Howler.js, deployed as a Cloudflare static-assets Worker at
`holodeck.jonwhitefang.uk/gaslight-and-grimoire/`. The system enforces a strict
split between two domains:

- **`public/content/`** — narrative data as JSON (manifest, cases, side-cases,
  shared scenes). Vite serves `public/` at the site root, so the engine fetches
  these at runtime as `/content/...` (prefixed with `import.meta.env.BASE_URL`
  for the `/gaslight-and-grimoire/` base path — the Worker's routed prefix).
- **`src/engine/`** — game logic, written as pure functions where possible, with
  no imports of the store. The modules (each documented in
  [engine-reference.md](./engine-reference.md)): `narrativeEngine` (barrel),
  `contentLoader`, `conditions`, `choiceResolution`, `choiceVisibility`,
  `encounters`, `advantage`, `checkOdds`, `flags`, `constants`,
  `contentValidation`, `engineActions`, `diceEngine`, `buildDeduction`,
  `deductionOracle`, `caseProgression`, `haltScenes`, `hintEngine`,
  `saveManager`, `audioManager`, `cluePrompts`, `effectMessages`.

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
          │   ├── <EncounterPanel />  # Multi-round encounter UI (when scene.encounter)
          │   └── <InvestigationHalted /> # Failure screen when composure/vitality = 0
          ├── <StatusBar />           # Composure + vitality meters
          ├── <EvidenceBoard />       # Overlay: clue cards, connection threads, deduce
          ├── <CaseJournal />         # Overlay: clues, deductions, scene timeline
          ├── <NPCGallery />          # Overlay: NPC dispositions/suspicion
          └── <SettingsPanel />       # Overlay: accessibility + audio + hints settings
```

`GameContent` renders `NarrativePanel` and then chooses the body: a terminal
"Case Complete" button when the scene has no choices and no encounter, an
`EncounterPanel` when `scene.encounter` is set, an `InvestigationHalted` screen
when composure or vitality hits 0, otherwise `ChoicePanel`. The 19
component directories under `src/components/` are
(`AccessibilityProvider`, `AmbientAudio`, `CaseCompletion`, `CaseJournal`,
`CaseSelection`, `CharacterCreation`, `ChoicePanel`, `EncounterPanel`,
`ErrorBoundary`, `EvidenceBoard`, `HeaderBar`, `InvestigationHalted`,
`LiveAnnouncer`, `NPCGallery`, `NarrativePanel`, `SettingsPanel`, `StatusBar`,
`TitleScreen`, `shared`). `LiveAnnouncer` mounts at the app root in `main.tsx`
(outside the tree above); `shared/` holds cross-surface presentational pieces —
`CheckOddsTag`, the decorative pre-roll odds tag (`aria-hidden`) that
`ChoiceCard`, `ChoicePanel`, `EncounterPanel`, and `SceneCluePrompts` render, with
the odds phrase folded into each host's own button `aria-label` (Phase 3); and
`LockedChoice`, the non-interactive disabled-choice `<li>` (lock icon +
line-through + `gateReason` prose, no opacity for AA contrast) that `ChoicePanel`
and `EncounterPanel` render in a "Locked choices" `<ul>` after the interactive
`<nav>` (Phase 5).

## Store: six slices

The root store (`src/store/index.ts`) is a single `create<GameStore>()(immer(...))`
composed from six slice creators. `GameStore` (`src/store/types.ts`) is the
intersection of the six slice interfaces.

| Slice | State | Actions |
|---|---|---|
| `investigatorSlice` | `investigator` | `initInvestigator`, `updateFaculty`, `adjustComposure`, `adjustVitality`, `useAbility`, `resetAbility` |
| `narrativeSlice` | `currentScene`, `currentCase`, `sceneHistory`, `visitedScenes`, `lastEffectMessages`, `lastCheckResult`, `encounterState`, `caseData` | `goToScene`, `setCheckResult`, `setEncounterState`, `loadAndStartCase`, `loadAndStartVignette`, `completeCase` |
| `evidenceSlice` | `clues`, `deductions`, `connections`, `contestedTokens`, `contestedPrior`, `attemptSeq` | `discoverClue`, `updateClueStatus`, `addDeduction`, `addConnection`, `clearConnections`, `contestClues`, `markCluesDeduced`, `cancelContestedReverts` |
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
  `setMemoryFlag`). It is invoked from **`narrativeSlice.goToScene`** on scene
  entry, gated on `visitedScenes` **keyed by the resolved scene id** (base or
  variant) so a scene's `onEnter` fires **exactly once per playthrough** — never
  re-firing on back-navigation or save-load (F-006), yet still firing a variant's
  distinct `onEnter` once when its condition first becomes true (F-118).
  `NarrativePanel` only *reads* the resulting `lastEffectMessages`; effect
  application must **not** be re-added to the view layer.
- **Evidence-board connections persist in `evidenceSlice`.** `connections` holds
  `{ fromId, toId }` id pairs (deduped, order-insensitive). DOM anchor points are
  recomputed on render; the store never holds pixel coordinates. Connections are
  cleared on case/vignette load. The "connected" cue is **derived** from
  `connections` membership at render (`ClueCard isConnected`), never written as a
  clue status (Phase 2b, N1). During formation, `EvidenceBoard` also applies a
  recipe's `onForm` effects (via `worldSlice.applyEffects`) **once per newly
  formed recipe** — the `deductions` record is the once-guard, so re-forming an
  already-recorded recipe never re-fires them.
- **Store-owned contested-revert ownership (Phase 2b).** A failed deduction attempt
  marks its clues `'contested'` via `contestClues(ids)`, which claims a fresh
  `gen = ++attemptSeq`, records each clue's baseline in `contestedPrior` (only if
  not already set — carry-forward), stamps `contestedTokens[id] = gen`, and
  schedules a 2 s revert. The revert restores `contestedPrior[id]` **iff**
  `contestedTokens[id] === gen`, so a later attempt (fail or `markCluesDeduced`
  success) that re-stamps the token makes the stale timer no-op — no cross-attempt
  clobber. Timers live in a **module-level `revertTimers` registry** (non-serialised),
  cancelled by `cancelContestedReverts()` on save-load and via `clearRevertTimers()`
  on case load. `contestedTokens`/`contestedPrior`/`attemptSeq` are transient
  (absent from `snapshotGameState`, never saved).

## Data flow (runtime)

```
CaseSelection → loadAndStartCase(id)  (or loadAndStartVignette)
  → loadCase(id) / loadVignette(id)   fetch /content/cases/<id>/*.json (or side-cases)
  → validateContent + index arrays into Record<string, T> by id
  → set caseData; reset currentScene/clues/npcs/deductions/connections (F-104);
    clear ability flags (ability-auto-succeed-{reason,vigor,influence},
    ability-veil-sight-active) and the typed investigator.lastCriticalFaculty
    reward field (F-013) — other world flags persist across cases
  → goToScene(firstScene)             push prev scene to sceneHistory; clear a
      stale lastCheckResult on cross-scene nav (F-106); apply onEnter effects
      once per resolved scene (gated on visitedScenes, base-or-variant — F-006/F-118)
      → NarrativePanel renders scene (auto-discovers clues; shows lastEffectMessages)
      → ChoicePanel → partitions scene choices via choiceVisibility.resolveChoiceVisibility
          (content visibility/gateReason → 'shown' | 'disabled' | 'hidden'): shown choices
          render as interactive cards in the <nav>; disabled ones as a LockedChoice list
          (aria-label "Locked choices") AFTER the nav; hidden ones not at all.
          EncounterPanel does the same three-way render (escape paths stay hard-gated).
        → each ChoiceCard shows pre-roll odds (checkOdds.computeCheckOdds,
          gated on diceEngine.isFacultyCheck) → processChoice(choice, state, actions)
          → diceEngine (resolveDC, performCheck / rollD20)
          → setCheckResult({...roll, dc}) → NarrativePanel's DiceRollOverlay shows "vs DC N"
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
  imports `useStore` (verified — see below). The only `useStore` references under
  `src/engine/` are in test files.
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
src/engine/__tests__/caseProgression.test.ts   # test only
src/engine/__tests__/npcBounds.property.test.ts # test only; no engine source match

$ grep -n "adjustReputation" src/store/slices/npcSlice.ts
33:      get().adjustReputation(npc.faction, delta * 0.5);

$ grep -rnE "Date.now\(\)|Math.random\(\)" \
    src/engine/diceEngine.ts src/engine/hintEngine.ts \
    src/engine/saveManager.ts src/engine/buildDeduction.ts \
    src/store/slices/metaSlice.ts
src/engine/diceEngine.ts:24:  return Math.floor(Math.random() * 20) + 1;
src/engine/buildDeduction.ts:24:    id: `deduction-${Date.now()}-${Math.random().toString(36).slice(2)}`,
src/engine/hintEngine.ts:39:  sceneEntryTime: Date.now(),
src/engine/hintEngine.ts:81:  const dwellTrigger = Date.now() - state.sceneEntryTime >= SCENE_DWELL_MS;
src/engine/hintEngine.ts:143:  state.sceneEntryTime = Date.now();
src/store/slices/metaSlice.ts:56:    const saveId = `save-${Date.now()}`;
# (saveManager.ts: no match)
```
