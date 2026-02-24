# AGENTS.md — Gaslight & Grimoire

## What This Is

A browser-based choose-your-own-adventure game set in Victorian London where magic exists beneath the rational world. Players investigate branching mysteries blending Sherlock Holmes-style deduction with D&D-style faculty checks and dice mechanics. Built with React 18, Zustand, Tailwind CSS, Framer Motion, and Howler.js. Deployed to GitHub Pages.

## Deep Documentation (devdocs/)

Comprehensive archaeology and evolution docs live under `devdocs/`. **Read these before making significant changes.**

### Architecture & Analysis (read first for orientation)
- `devdocs/archaeology/small_summary.md` — Non-technical project summary, what's complete vs evolving
- `devdocs/archaeology/intro2codebase.md` — Data flow diagrams, key abstractions, store patterns, determinism gaps
- `devdocs/archaeology/intro2deployment.md` — Build, deploy, CI/CD, content assets, environment
- `devdocs/archaeology/architecture_analysis.md` — Entry points, data models, contracts, patterns, what doesn't make sense
- `devdocs/archaeology/module_discovery.md` — Module boundaries, coupling/cohesion, dependency graph, boundary violations

### Execution Traces (read for specific subsystem understanding)
- `devdocs/archaeology/traces/trace_01_case_loading.md` — App → loadAndStartCase → fetch → store → goToScene
- `devdocs/archaeology/traces/trace_02_scene_navigation.md` — goToScene → NarrativePanel → onEnter effects → clue discovery
- `devdocs/archaeology/traces/trace_03_choice_processing.md` — ChoicePanel → processChoice → diceEngine → store
- `devdocs/archaeology/traces/trace_04_evidence_board.md` — Connection flow → buildDeduction → Reason check
- `devdocs/archaeology/traces/trace_05_npc_faction_propagation.md` — adjustDisposition → adjustReputation cross-slice
- `devdocs/archaeology/traces/trace_06_save_load.md` — save/autosave/load → SaveManager → localStorage
- `devdocs/archaeology/traces/trace_07_hint_system.md` — hintEngine singleton → HintButton
- `devdocs/archaeology/traces/trace_08_encounter_system.md` — startEncounter → processEncounterChoice → EncounterPanel
- `devdocs/archaeology/traces/trace_09_accessibility_settings.md` — SettingsPanel → AccessibilityProvider → DOM
- `devdocs/archaeology/traces/trace_10_audio_pipeline.md` — Store slices → AudioManager/AmbientAudio → Howler

### Concept Inventories
- `devdocs/archaeology/concepts/technical_concepts_list.md` — All technical concepts with implementation status
- `devdocs/archaeology/concepts/design_concepts_list.md` — Game design concepts with implementation status
- `devdocs/archaeology/concepts/missing_concepts_list.md` — **Gaps ranked by severity** (critical/high/medium/low)
- `devdocs/archaeology/concept_mappings.md` — Concept → file mapping with coverage, rationale, edge cases

### Foundations (code-inferred vs doc-inferred)
- `devdocs/archaeology/foundations/` — What the code actually does, implicit design principles, inferred requirements
- `devdocs/foundations/` — What the docs claim, with "Docs vs Code" delta tables at the end of each file

### Evolution & Roadmap (read before starting new work)
- `devdocs/evolution/gap_analysis.md` — Current vs desired state, what's broken, what's missing, what's blocked
- `devdocs/evolution/gap_closure_plan.md` — Phased plan: quick wins → incremental → major refactoring
- `devdocs/evolution/implementation_roadmap.md` — **The execution plan**: Phase A–D with dependencies, success criteria, verification
- `devdocs/evolution/refactoring_opportunities.md` — Highest-ROI refactors with effort/risk/benefit

### Cleanup & Smoke Tests
- `devdocs/archaeology/cleanup_inventory.md` — What's safe to remove vs what looks dead but must be kept
- `devdocs/archaeology/5_things_or_not.md` — Top 5 improvements with exact code locations and first steps
- `smoke_tests/check_what_is_working/report.md` — Baseline: 306/306 tests pass, 0 type errors, 3 broken features identified

## Architecture

Two strict domains — never mix them:

- `content/` — narrative data as JSON (cases, clues, NPCs, scenes)
- `src/engine/` — game logic (pure functions where possible)

Components live in `src/components/[Name]/` with `index.ts` barrel exports. State is managed by a single Zustand store composed of six Immer-powered slices.

## Component Hierarchy

```
<ErrorBoundary>
  <App>
  └── <AccessibilityProvider>       # Provides a11y settings: reducedMotion, fontSize, highContrast
      ├── <TitleScreen />
      ├── <LoadGameScreen />        # Save list with delete buttons
      ├── <CharacterCreation />     # Archetype selection + faculty point allocation
      ├── <CaseSelection />         # Case browser: main cases + unlocked vignettes
      └── <GameScreen>
          ├── <HeaderBar />         # Ability button, hint button, overlay toggles
          ├── <AmbientAudio />      # Non-rendering: ambient track from scene.ambientAudio
          ├── <GameContent>
          │   ├── <NarrativePanel />  # Scene text, illustration, dice roll overlay, clue discovery card, active clue prompts
          │   ├── <ChoicePanel />     # Choice cards rendered from current SceneNode.choices
          │   └── <EncounterPanel />   # Multi-round encounter UI (when scene has encounter field)
          ├── <StatusBar />         # Vitality meter, composure meter
          ├── <EvidenceBoard />     # Overlay: clue cards, connection threads, deduction button
          ├── <CaseJournal />       # Overlay: clues gathered, deductions, key events
          ├── <NPCGallery />        # Overlay
          └── <SettingsPanel />     # Overlay
```

## Directory Layout

```
content/
  manifest.json                 # CaseManifest: lists all cases and vignettes with metadata
  shared/
    breakdown.json              # Shared breakdown scene (composure=0), injected into all cases
    incapacitation.json         # Shared incapacitation scene (vitality=0), injected into all cases
  cases/[case-name]/          # Main cases (3-act structure)
    meta.json                 # CaseMeta: id, title, synopsis, acts, firstScene, facultyDistribution
    act1.json, act2.json, act3.json  # SceneNode[] per act
    clues.json                # Array of Clue objects
    npcs.json                 # Array of NPCState objects
    variants.json             # SceneNode[] triggered by cross-case flags
  side-cases/[vignette-name]/ # Side vignettes (2-act structure)
    meta.json                 # VignetteMeta (optional triggerCondition)
    scenes.json, clues.json, npcs.json

src/
  types/index.ts              # ALL type definitions live here
  utils/
    gameState.ts              # snapshotGameState — shared GameState builder (used by store + engine)
  store/
    index.ts                  # useStore + selector hooks + action hooks
    types.ts                  # GameStore = intersection of all slices
    slices/                   # Six domain slices (see below)
  engine/
    narrativeEngine.ts        # Content loading, condition eval, scene resolution, choice processing, encounters
    diceEngine.ts             # d20 rolls, advantage/disadvantage, modifier calc, outcome tiers
    buildDeduction.ts         # Pure deduction builder from connected clue IDs
    caseProgression.ts        # End-of-case logic, faculty bonuses, vignette unlocks
    hintEngine.ts             # Stateful hint system (3 escalating levels)
    saveManager.ts            # localStorage persistence with versioned migrations, multi-save support
    audioManager.ts           # Howler.js SFX management (lazy-cached Howl instances)
    cluePrompts.ts            # Atmospheric prompt text generator for exploration/check clue discovery
    effectMessages.ts         # Pure effect-to-feedback-message generator (atmospheric + mechanical annotation)
  components/                 # React components (each in own directory)
  data/archetypes.ts          # Archetype definitions, faculty constants

scripts/
  validateCase.mjs            # Content validation — run after editing case JSON

.github/workflows/
  deploy.yml                  # Build + deploy to GitHub Pages on push to main
  security.yml                # OWASP Dependency-Check + npm audit (weekly + on PR)
```

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm test             # vitest watch mode
npm run test:run     # vitest single run (use this for CI / scripted checks)
node scripts/validateCase.mjs  # Validate case content JSON
```

## Store & State Management

Single `useStore` (Zustand + Immer) composed from six slices:

| Slice | State | Actions |
|---|---|---|
| `investigatorSlice` | `investigator` | `initInvestigator`, `updateFaculty`, `adjustComposure`, `adjustVitality`, `useAbility`, `resetAbility` |
| `narrativeSlice` | `currentScene`, `currentCase`, `sceneHistory`, `lastCheckResult`, `caseData` | `goToScene`, `setCheckResult`, `loadAndStartCase`, `loadAndStartVignette`, `completeCase` |
| `evidenceSlice` | `clues`, `deductions` | `discoverClue`, `updateClueStatus`, `addDeduction` |
| `npcSlice` | `npcs` | `adjustDisposition`, `adjustSuspicion`, `setNpcMemoryFlag`, `removeNpc` |
| `worldSlice` | `flags`, `factionReputation` | `setFlag`, `adjustReputation` |
| `metaSlice` | `settings` | `updateSettings`, `saveGame`, `autoSave`, `loadGame` |

Rules:
- Always use selector hooks (`useInvestigator`, `useClues`, `useCaseData`, etc.) — never subscribe to the full store.
- Always use action hooks (`useInvestigatorActions`, `useEvidenceActions`, etc.) for mutations.
- Use `useCurrentScene()` to get the resolved `SceneNode` for the current scene (handles variant resolution).
- Use `buildGameState(store)` to build a `GameState` snapshot for engine functions.
- State is flat and normalised: `Record<string, T>` keyed by id. No nested arrays.
- Immer is active — mutate draft state directly inside slice actions. No manual spreading.
- `adjustDisposition` on a faction-aligned NPC automatically propagates `delta * 0.5` to faction reputation.

## Key Types (src/types/index.ts)

- `Faculty`: `reason | perception | nerve | vigor | influence | lore`
- `Archetype`: `deductionist | occultist | operator | mesmerist`
- `OutcomeTier`: `critical | success | partial | failure | fumble`
- `ClueStatus`: `new | examined | connected | deduced | contested | spent`
- `ClueType`: `physical | testimony | occult | deduction | redHerring`
- `NpcSuspicionTier`: `normal (0-2) | evasive (3-5) | concealing (6-8) | hostile (9-10)`
- `Condition` — gates scene access and choices (types: `hasClue`, `hasDeduction`, `hasFlag`, `facultyMin`, `archetypeIs`, `npcDisposition`, `npcSuspicion`, `factionReputation`, `npcMemoryFlag`)
- `Effect` — mutates game state on scene entry (types: `composure`, `vitality`, `flag`, `disposition`, `suspicion`, `reputation`, `discoverClue`, `setMemoryFlag`)
- `SceneNode` — atomic narrative unit with `choices`, `cluesAvailable`, `conditions`, `onEnter` effects, optional `variantOf`/`variantCondition`, optional `encounter`
- `Choice` — may have `faculty`/`difficulty` for checks, `advantageIf` clue refs, `outcomes` per tier, `npcEffect`, encounter extensions (`worseAlternative`, `isEscapePath`, `encounterDamage`)

## Engine Behaviour

### Dice (diceEngine.ts)
- `rollD20()` → [1, 20]
- Modifier = `floor((facultyScore - 10) / 2)` + trained bonus (+1 if faculty matches archetype's primary faculty, 0 otherwise)
- Outcome: nat 20 → critical, nat 1 → fumble, total ≥ DC → success, total ≥ DC-3 → partial, else failure
- Advantage: roll 2d20 take highest. Disadvantage: take lowest. Both cancel out.
- Dynamic difficulty: `choice.dynamicDifficulty` scales DC based on a faculty score threshold.
- Trained bonus: `getTrainedBonus(faculty, archetype)` returns +1 when the check faculty is the archetype's primary (deductionist→reason, occultist→lore, operator→vigor, mesmerist→influence).

### Narrative (narrativeEngine.ts)
- `loadCase` / `loadVignette` — fetch JSON, index by ID into `Record<string, T>`.
- `evaluateConditions` — pure AND logic over `Condition[]` against `GameState`.
- `resolveScene` — returns variant scene if its condition is met, otherwise base scene.
- `applyEffects` — store action in `worldSlice` that applies `Effect[]` on scene entry.
- `processChoice` — performs faculty check (using `resolveDC` for dynamic difficulty), applies NPC effects, navigates to next scene. Checks archetype ability auto-succeed flags (`ability-auto-succeed-reason`, `ability-auto-succeed-vigor`, `ability-auto-succeed-influence`) before rolling — if set, returns `critical` tier without a dice roll.
- `computeChoiceResult` — pure function extracted from `processChoice`. Computes the choice outcome (ability auto-succeed, dice check, advantage, DC resolution) without store access. Returns `ChoiceResult`. Used by `processChoice` internally; can be called directly for testing or preview.
- `canDiscoverClue` — pure gate check for `ClueDiscovery` requirements.
- `validateContent` — checks for broken scene-graph edges and missing clue references.

### Encounters (narrativeEngine.ts + EncounterPanel)
- Triggered by `SceneNode.encounter` field — `GameContent` renders `EncounterPanel` instead of `ChoicePanel`.
- `startEncounter` — for supernatural encounters, performs Nerve/Lore reaction check at DC 12. Failure: composure damage + worseAlternative replacement.
- `processEncounterChoice` — faculty check + damage application. Supernatural = dual-axis (composure + vitality). Mundane = single axis.
- `getEncounterChoices` — filters choices by conditions, annotates occult advantage, always includes escape paths.

### Case Progression (caseProgression.ts)
- `completeCase` — grants +1 faculty bonus from `last-critical-faculty` flag, checks vignette unlocks, auto-saves.
- Vignette unlocks triggered by: faction reputation thresholds, NPC disposition ≥ 7, or required flags.

### Hints (hintEngine.ts)
- Stateful singleton tracking board visits, connection attempts, scene dwell time.
- `trackActivity()` called from `NarrativePanel` (scene changes), `EvidenceBoard` (board visits, connection attempts).
- Triggers after 3+ board visits with no connections OR 5+ minutes on a scene.
- 3 escalating levels: narrative nudge → specific clue suggestion → direct reveal.
- Level 3 gated behind Level 2 being shown first. Respects `hintsEnabled` setting.

### Save System (saveManager.ts)
- localStorage with `gg_save_` prefix. Index at `gg_save_index`.
- `SaveFile` wraps `GameState` with `version` + `timestamp`.
- Migration pipeline: v0→v1 adds `factionReputation`. Current version: 1.
- `saveGame` generates unique IDs (`save-{timestamp}`), capped at 10 manual saves.
- `autoSave` writes to the `'autosave'` slot, triggered by `goToScene` (scene frequency) or ChoicePanel (choice frequency) based on `autoSaveFrequency` setting.
- `loadGame` restores all `GameState` fields and re-fetches `caseData` via `loadCase(currentCase)`.

### Audio (audioManager.ts)
- Howler.js with lazy-cached Howl instances per SFX event.
- SFX events: `dice-roll`, `clue-{type}`, `composure-decrease`, `vitality-decrease`, `scene-transition`.
- Triggered from store slices (investigator, narrative, evidence).

## Content Authoring Rules

- `Condition` and `Effect` are the ONLY mechanism for gating and mutating game state from content JSON. No ad-hoc logic in scene handlers.
- Deductions are always derived from linked clue IDs — never hardcode deduction outcomes.
- If any connected clue is a `redHerring`, the deduction's `isRedHerring` must be true.
- No single Faculty should gate critical story progress — always provide alternate paths.
- Choices must have meaningful consequences; avoid cosmetic-only branching.
- Run `node scripts/validateCase.mjs` after editing case files to catch broken references. Validates all cases by default, or pass a specific case path.
- Narrative tone: measured, atmospheric, never campy.

## Tailwind Theme

Custom colour palette under `gaslight-*`:
- `amber` (#D4A853), `crimson` (#8B1A1A), `slate` (#2C3E50), `fog` (#B8C5D0), `ink` (#1A1A2E), `gold` (#C9A84C), `brass` (#B5860D)
- Fonts: serif (Georgia), mono (Courier New)

## Testing

- Vitest 3 + React Testing Library + fast-check for property-based tests.
- Component tests: `src/components/__tests__/`
- Engine tests: `src/engine/__tests__/`
- Property-based tests use `.property.test.ts` suffix.
- Test environment: jsdom. Setup file: `src/test-setup.ts`.

## CI/CD

- `deploy.yml` — on push to main: npm ci → npm audit → build → deploy to GitHub Pages.
- `security.yml` — on PR to main + weekly Monday 08:00 UTC: npm audit + OWASP Dependency-Check (fail on CVSS ≥ 7).
- Vite base path: `/gaslight-and-grimoire/`.

## Character System

Four archetypes, each with +3/+1 faculty bonuses and a once-per-case ability:
- Deductionist: +3 Reason, +1 Perception. Ability: Elementary (auto-succeed Reason check).
- Occultist: +3 Lore, +1 Perception. Ability: Veil Sight (reveal supernatural elements).
- Operator: +3 Vigor, +1 Nerve. Ability: Street Survivor (auto-succeed Vigor check).
- Mesmerist: +3 Influence, +1 Nerve. Ability: Silver Tongue (auto-succeed Influence check).

Base faculty score: 8. Bonus points to allocate: 12. Composure and Vitality: 0–10 (start at 10).

## Current Content

- Main case: "The Whitechapel Cipher" (3 acts, full scene graph with variants)
- Main case: "The Mayfair Séance" (3 acts, full scene graph with variants, supernatural encounter)
- Side case: "A Matter of Shadows" (unlocks at Lamplighters faction rep ≥ 2)

## Known Bugs & Gaps (as of 2026-02-23)

These are documented in detail in `devdocs/evolution/gap_analysis.md`, `smoke_tests/check_what_is_working/report.md`, and `GAME_DESIGN_ANALYSIS.md`.

### Critical (blocks core functionality)
- None remaining. `loadGame` caseData restoration was fixed in Phase A.

### High (game design — player experience gaps)
- ~~**Active clue discovery unimplemented**~~ — ✅ FIXED. All four discovery methods now work: `automatic` and `dialogue` auto-discover on scene entry (dialogue shows speech-bubble variant card), `exploration` renders atmospheric clickable prompts, `check` performs a dice roll via `performCheck`. New files: `src/engine/cluePrompts.ts`, `src/components/NarrativePanel/SceneCluePrompts.tsx`.
- **Zero audio/visual assets** — Audio system and illustration system are fully coded but no `.mp3` or image files exist. Game is silent with no illustrations.
- **Thin content** — Avg 1.1–1.3 choices/scene, only 6 clues and 3 NPCs per case, 1 variant per case. Low replayability.
- ~~**NPCs have no dialogue system**~~ — ✅ FIXED. Disposition/suspicion/memoryFlag-gated dialogue choices added to existing scenes. New `npcMemoryFlag` condition type and `setMemoryFlag` effect type. 8 new dialogue scenes across both cases. `memoryFlags` now populated on key NPC interactions.

### Medium (game design — mechanics and UX)
- ~~**Engine ↔ Store circular dependency**~~ — ✅ FIXED. Engine functions now accept an `EngineActions` interface parameter instead of importing `useStore`. `applyOnEnterEffects` moved to `worldSlice.applyEffects` store action. Zero store imports in engine files.
- ~~**No recovery mechanics**~~ — ✅ FIXED. Shared `breakdown`/`incapacitation` scenes injected into all cases via `injectSharedScenes` in `loadCase`/`loadVignette`. Case-specific variants for Whitechapel Cipher and Mayfair Séance. Recovery effects (+1 composure/vitality) added to 6 scenes across both cases.
- ~~**Evidence Board connections transient**~~ — ✅ FIXED. Connections now persist in `evidenceSlice` store (ID pairs only). DOM points recomputed on render/scroll/resize. Cleared on case load and deduction.
- ~~**Dice math skews toward failure**~~ — ✅ FIXED. Partial band widened from DC-2 to DC-3 (15% instead of 10%). Trained bonus (+1) added for archetype primary faculty. All content DCs lowered by 2. Encounter reaction check stays at DC 12.
- **Silent state changes** — ~~`onEnter` effects fire with no narrative feedback. Players see meters change without explanation.~~ ✅ FIXED. `EffectFeedback` component renders inline atmospheric messages with mechanical annotations (e.g. "A chill settles over you (Composure −1)"). Optional `description` field on `Effect` supports content-authored text with auto-generated fallback. New files: `src/engine/effectMessages.ts`, `src/components/NarrativePanel/EffectFeedback.tsx`.
- ~~**Occultist Veil Sight inert**~~ — ✅ FIXED. Veil Sight now grants advantage on all Lore checks while active. Variant scenes added to both cases revealing occult content when flag is set. New files: `src/engine/__tests__/veilSight.test.ts`.
- ~~**`validateCase.mjs` not in CI**~~ — ✅ FIXED. Added to `deploy.yml` as a step after `npm ci`, before audit and build.

### Low (polish)
- ~~**Faction reputation unbounded**~~ — ✅ FIXED. Clamped to [-10, +10] in `adjustReputation`.
- **Generic deduction descriptions** — `buildDeduction` returns same 2 strings regardless of clues.
- **No click-to-skip typewriter** — Must wait for full text or change settings.
- ~~**`sceneHistory` unused**~~ — ✅ FIXED. Investigation Timeline in CaseJournal shows chronological scene history. Back button in HeaderBar enables read-only scene review.

## Architectural Warnings

Things to be aware of when making changes:

- **`processChoice` navigates before returning** — It calls `actions.goToScene()` internally, then returns `ChoiceResult`. The caller shows the dice overlay after the scene has already changed. Use `computeChoiceResult` for the pure computation without side effects.
- **`applyEffects` is a store action in `worldSlice`** — Called from `NarrativePanel` useEffect. Replaces the former `applyOnEnterEffects` engine function.
- **Evidence Board connections persist in store** — `evidenceSlice.connections` holds ID pairs. DOM points are recomputed on render. Connections cleared on case/vignette load and on deduction (success or failure).
- **`adjustDisposition` has a hidden cross-slice call** — After updating NPC disposition, it calls `get().adjustReputation(faction, delta * 0.5)` for faction-aligned NPCs. This coupling is in `src/store/slices/npcSlice.ts`.
- **Faction reputation is clamped** — Disposition [-10,+10], suspicion [0,10], composure/vitality [0,10], faction reputation [-10,+10]. All numeric state is now bounded.
- **`Object.keys(data.scenes)[0]` is the fallback for first scene** — In `loadAndStartCase`. Used only when `meta.json` lacks a `firstScene` field. Both existing cases now have `firstScene` set explicitly.
- **No audio files in repo** — The audio system is fully coded but silent. Howler silently handles missing files. SFX is triggered via a store subscription in `src/store/audioSubscription.ts` (initialized in `main.tsx`), not from slice actions.
- **`Date.now()` and `Math.random()` used directly** — In `diceEngine.rollD20()`, `hintEngine`, `saveManager`, `metaSlice.saveGame`, `buildDeduction`. Not injectable. Tests work around this.

## Implementation Roadmap

See `devdocs/evolution/implementation_roadmap.md` for the full phased plan. Summary:

- **Phase A (Foundation)**: ✅ COMPLETE — Fixed loadGame, deduped snapshots, wired hints, fixed abilities, added validation, added firstScene
- **Phase B (Core Refactoring)**: ✅ COMPLETE — Extracted pure computeChoiceResult, moved buildDeduction to engine, audio subscription, consolidated CheckResult types, runtime content validation with tier completeness
- **Phase C (Gap Filling)**: ✅ COMPLETE — ClueDiscoveryCard, save button, faction display, error display, case completion screen
- **Phase D (Integration)**: ✅ COMPLETE — Encounter UI, stale state cleanup, remove dead code
- **Phase E (Game Design)**: 🟡 IN PROGRESS — ~~Active clue discovery~~ ✅, ~~consequence feedback~~ ✅, ~~Veil Sight~~ ✅, ~~recovery mechanics~~ ✅, ~~persistent evidence board~~ ✅, ~~faction clamping~~ ✅, ~~CI validation~~ ✅, ~~NPC dialogue~~ ✅, ~~scene history~~ ✅, ~~testing expansion~~ ✅, audio/visual assets, content depth. See `GAME_DESIGN_ANALYSIS.md` for full analysis.
