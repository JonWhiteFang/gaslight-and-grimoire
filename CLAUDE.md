# CLAUDE.md — Gaslight & Grimoire

## What This Is

A browser-based choose-your-own-adventure game set in Victorian London where magic exists beneath the rational world. Players investigate branching mysteries blending Sherlock Holmes-style deduction with D&D-style faculty checks and dice mechanics. Built with React 19, Zustand, Tailwind CSS v4, Framer Motion, and Howler.js. Deployed as a Cloudflare static-assets Worker at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/`.

## Documentation (docs/)

Project docs live under `docs/`. Read the relevant one before significant changes:

- `docs/README.md` — orientation and doc map (start here)
- `docs/architecture.md` — component hierarchy, store slices, engine modules, data flow, cross-slice couplings, determinism notes
- `docs/engine-reference.md` — per-module engine API (signatures + behavior)
- `docs/content-authoring.md` — case/vignette JSON schemas, Condition/Effect catalogs, validation, audio asset reference
- `docs/status.md` — current state: systems present, content inventory, test baseline
- `docs/Gaslight_&_Grimoire_design.md` — the original design bible (vision, world, mechanics, narrative intent)

## Project memory — read at session start, update at session end

This repo keeps a **committed, version-controlled memory spine** so progress and decisions survive
across sessions and machines (unlike a tool's machine-local auto-memory). It does **not** restate the
architecture or scope rules in this file and `docs/` — it tracks *what's done and what's been decided*:

- **`docs/PROJECT_STATE.md`** — the one-page live snapshot. **Read this first** when resuming work.
- **`docs/RUN_LOG.md`** — append-only session history (what happened, when).
- **`docs/DECISIONS/`** — Architecture Decision Records (the *why* behind non-trivial calls).

**Protocol.** Start of work: read `PROJECT_STATE.md` + the latest `RUN_LOG.md` entry. End of session:
run `/checkpoint`. A `SessionStart` hook (`.claude/hooks/session-preflight.sh`) injects git state + the
top of `PROJECT_STATE.md` automatically.

## Architecture

Two strict domains — never mix them:

- `public/content/` — narrative data as JSON (cases, clues, NPCs, scenes). Vite serves `public/` at the site root, so the engine fetches these at runtime as `/content/...`.
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
      └── (game screen — a <div>, not a component; App switches on `screen` state)
          ├── <HeaderBar />         # Ability button, hint button, overlay toggles
          ├── <AmbientAudio />      # Non-rendering: ambient track from scene.ambientAudio
          ├── <GameContent>         # NarrativePanel + (ChoicePanel | EncounterPanel | Case-Complete btn) + StatusBar
          │   ├── <NarrativePanel />  # Scene text, illustration, dice roll overlay, clue discovery card, active clue prompts
          │   ├── <ChoicePanel />     # Choice cards rendered from current SceneNode.choices
          │   ├── <EncounterPanel />  # Multi-round encounter UI (when scene has encounter field)
          │   └── <StatusBar />       # Vitality meter, composure meter
          └── <Suspense>            # Overlays are React.lazy-loaded (F-043):
              ├── <EvidenceBoard />   # Overlay: clue cards, connection threads, deduction button
              ├── <CaseJournal />     # Overlay: clues gathered, deductions, key events
              ├── <NPCGallery />      # Overlay
              └── <SettingsPanel />   # Overlay
```

## Directory Layout

```
public/content/                 # served at runtime as /content/
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
    deductions.json           # KeyDeduction[] recipes (optional) — stable ids for hasDeduction gates
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
    narrativeEngine.ts        # Barrel: re-exports contentLoader/conditions/choiceResolution/encounters (import path unchanged)
    contentLoader.ts          # fetchManifest, loadCase, loadVignette, validateContent (+ cached loadSharedScenes/mergeSharedScenes, fetchJson, indexById)
    conditions.ts             # evaluateConditions, evaluateCondition, resolveScene, canDiscoverClue
    choiceResolution.ts       # computeChoiceResult, processChoice
    encounters.ts             # startEncounter, processEncounterChoice, getEncounterChoices
    advantage.ts              # computeAdvantage — single source for check advantage (clue OR lore+Veil Sight); used by checks, encounters, ChoiceCard badge
    flags.ts                  # Single source of truth for ability/progression flag string keys (FLAGS, abilityAutoSucceedFlag, CASE_LOAD_CLEARED_FLAGS)
    constants.ts              # FACTIONS, OUTCOME_TIERS, assertNever exhaustiveness guard
    contentValidation.ts      # Shared content validator (validateBundle) — used by validateContent + the CLI
    engineActions.ts          # EngineActions interface — the store-facing seam that keeps engine free of store imports
    diceEngine.ts             # d20 rolls, advantage/disadvantage, modifier calc, outcome tiers
    buildDeduction.ts         # Pure deduction builder + key-deduction recipe matcher (matchDeduction/buildDeductionFromRecipe)
    caseProgression.ts        # End-of-case logic, faculty bonuses, vignette unlocks
    hintEngine.ts             # Stateful hint system (3 escalating levels)
    saveManager.ts            # localStorage persistence with versioned migrations, multi-save support
    audioManager.ts           # Howler.js SFX management (lazy-cached Howl instances)
    cluePrompts.ts            # Atmospheric prompt text generator for exploration/check clue discovery
    effectMessages.ts         # Pure effect-to-feedback-message generator (atmospheric + mechanical annotation)
  components/                 # React components (each in own directory)
  data/archetypes.ts          # Archetype definitions, faculty constants

scripts/
  validateCase.mjs            # Content-validation entry point (vite-node shim) — run after editing case JSON
  validateCase.ts             # The real validator; imports shared src/engine/contentValidation (edit logic HERE, not the .mjs shim)

.github/workflows/
  deploy.yml                  # CI gate: lint + validator + tests + build-compiles check (push/PR to main). Deploy is Cloudflare-side (wrangler.jsonc)
  security.yml                # OWASP Dependency-Check + npm audit (weekly + on PR)
```

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm run lint         # ESLint (flat config; TS recommended + react-hooks)
npm test             # vitest watch mode
npm run test:run     # vitest single run (use this for CI / scripted checks)
node scripts/validateCase.mjs  # Validate case content JSON
```

## Store & State Management

Single `useStore` (Zustand + Immer) composed from six slices:

| Slice | State | Actions |
|---|---|---|
| `investigatorSlice` | `investigator` | `initInvestigator`, `updateFaculty`, `adjustComposure`, `adjustVitality`, `useAbility`, `resetAbility` |
| `narrativeSlice` | `currentScene`, `currentCase`, `sceneHistory`, `visitedScenes`, `lastEffectMessages`, `lastCheckResult`, `caseData` | `goToScene`, `setCheckResult`, `loadAndStartCase`, `loadAndStartVignette`, `completeCase` |
| `evidenceSlice` | `clues`, `deductions`, `connections` | `discoverClue`, `updateClueStatus`, `addDeduction`, `addConnection`, `clearConnections` |
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
- `applyEffects` — store action in `worldSlice` that applies `Effect[]`. Called by `goToScene` on scene entry, gated so a scene's `onEnter` fires exactly once per playthrough (see `visitedScenes` below).
- `processChoice` — performs faculty check (using `resolveDC` for dynamic difficulty), applies NPC effects, navigates to next scene. A non-check choice with no `success`/`critical` outcome throws (F-022). Checks archetype ability auto-succeed flags (`ability-auto-succeed-reason`, `ability-auto-succeed-vigor`, `ability-auto-succeed-influence`) before rolling — if set, returns `critical` tier without a dice roll.
- `computeChoiceResult` — pure function extracted from `processChoice`. Computes the choice outcome (ability auto-succeed, dice check, advantage, DC resolution) without store access. Returns `ChoiceResult`. Used by `processChoice` internally; can be called directly for testing or preview.
- `canDiscoverClue` — pure gate check for `ClueDiscovery` requirements.
- `validateContent` — checks for broken scene-graph edges and missing clue references.

### Encounters (narrativeEngine.ts + EncounterPanel)
- Triggered by `SceneNode.encounter` field — `GameContent` renders `EncounterPanel` instead of `ChoicePanel`.
- `startEncounter` — for supernatural encounters, performs Nerve/Lore reaction check at DC 12. Failure: composure damage + worseAlternative replacement.
- `processEncounterChoice` — escape paths (`isEscapePath`) are terminal (navigate to their outcome + complete the encounter immediately, no damage). Otherwise faculty check + damage application. Supernatural = dual-axis (composure + vitality). Mundane = single axis.
- `getEncounterChoices` — filters choices by conditions, always includes escape paths. (Advantage is applied on the roll in `processEncounterChoice`, not annotated here.)

### Case Progression (caseProgression.ts)
- `completeCase` — grants +1 faculty bonus from the typed `investigator.lastCriticalFaculty` field (F-013), checks vignette unlocks, auto-saves.
- Vignette unlocks triggered by: faction reputation thresholds, NPC disposition thresholds, or required (persisted) flags. `checkVignetteUnlocks` returns **every** satisfied vignette (F-057), so simultaneously-earned unlocks all fire. See `VIGNETTE_CONDITIONS` in `caseProgression.ts` for the live registry.

### Hints (hintEngine.ts)
- Stateful singleton tracking board visits, connection attempts, scene dwell time.
- `trackActivity()` called from `NarrativePanel` (scene changes), `EvidenceBoard` (board visits, connection attempts).
- Triggers after 3+ board visits with no connections OR 5+ minutes on a scene.
- 3 escalating levels: narrative nudge → specific clue suggestion → direct reveal.
- Level 3 gated behind Level 2 being shown first. Respects `hintsEnabled` setting.

### Save System (saveManager.ts)
- localStorage with `gg_save_` prefix. Index at `gg_save_index`.
- `SaveFile` wraps `GameState` with `version` + `timestamp`.
- Migration pipeline: v0→v1 adds `factionReputation`; v1→v2 backfills `sceneHistory` + `connections`; v2→v3 backfills `visitedScenes` (from `sceneHistory + currentScene`, so reloads don't re-fire `onEnter` — F-006). Current version: 3 (`CURRENT_SAVE_VERSION`).
- `saveGame` generates unique IDs (`save-{timestamp}`), capped at 10 manual saves.
- `autoSave` writes to the `'autosave'` slot, triggered by `goToScene` (scene frequency) or ChoicePanel (choice frequency) based on `autoSaveFrequency` setting.
- `load` guards the deserialised blob: a non-object envelope or a state failing the `isValidGameState` shape check (missing `investigator`/`clues`/… or wrong types) returns `null` rather than corrupting the store (F-036).
- `loadGame` restores all `GameState` fields and re-fetches `caseData` via `loadCase(currentCase)`.

### Audio (audioManager.ts)
- Howler.js with lazy-cached Howl instances per SFX event.
- SFX events: `dice-roll`, `clue-{type}`, `composure-decrease`, `vitality-decrease`, `scene-transition`.
- Triggered from store slices (investigator, narrative, evidence).

## Content Authoring Rules

- `Condition` and `Effect` are the ONLY mechanism for gating and mutating game state from content JSON. No ad-hoc logic in scene handlers.
- Deductions are always derived from linked clue IDs — never hardcode deduction outcomes.
- If any connected clue is a `redHerring`, the deduction's `isRedHerring` must be true.
- **Key deductions** (`deductions.json`): a `KeyDeduction` recipe (stable `id` + `requiredClues` set) gives a conclusion a gate-able identity. Connecting a superset of `requiredClues` + passing the Reason check stores the deduction under the authored `id` (`matchDeduction` — subset semantics), so `requiresDeduction`/`hasDeduction` gates resolve. Gate the *true/best* ending behind one, but keep the case completable without it. Recipe clue refs + gate targets are validator-enforced.
- No single Faculty should gate critical story progress — always provide alternate paths.
- Choices must have meaningful consequences; avoid cosmetic-only branching.
- Run `node scripts/validateCase.mjs` after editing case files to catch broken references. Validates all cases by default, or pass a specific case path.
- Narrative tone: measured, atmospheric, never campy.

## Tailwind Theme

Custom colour palette under `gaslight-*`:
- `amber` (#D4A853), `crimson` (#8B1A1A), `slate` (#2C3E50), `fog` (#B8C5D0), `ink` (#1A1A2E), `gold` (#C9A84C), `brass` (#B5860D)
- Fonts: serif (Georgia), mono (Courier New)

## Testing

- Vitest 4 + React Testing Library + fast-check for property-based tests.
- Component tests: `src/components/__tests__/`
- Engine tests: `src/engine/__tests__/`
- Property-based tests use `.property.test.ts` suffix.
- Test environment: jsdom. Setup file: `src/test-setup.ts`.

## CI/CD

- **Deployment (issue #47):** a **Cloudflare static-assets Worker** at
  `holodeck.jonwhitefang.uk/gaslight-and-grimoire/*` (retired GitHub Pages). Config is `wrangler.jsonc`
  (assets-only, no Worker script; `assets.directory` → `./dist`); Cloudflare git-connects this repo and
  runs `npm run build` on push to `main`. `public/_headers` carries real response headers (the CSP,
  incl. `frame-ancestors 'none'` which the `<meta>` CSP can't). `scripts/nest-for-cloudflare.mjs` is a
  postbuild step that nests `dist/*` under `dist/gaslight-and-grimoire/` (except `_headers`) so the
  Worker's 1:1 path→file mapping matches the routed prefix. Cloudflare-side setup (Worker, route, DNS,
  root redirect) is owner-managed, out of repo scope.
- `deploy.yml` (workflow name: `CI`) — on push to main, PR to main, or manual dispatch. Two jobs:
  `test` (`npm run lint` + validator `node scripts/validateCase.mjs` + `npm run test:run`) →
  `build` (`npm run build`, build-compiles check only — no publish). `build` needs `test`, so a failing
  lint/validator/test blocks the merge gate. It no longer publishes anywhere (deploy is Cloudflare-side).
  Dependency auditing is **not** here — it lives in `security.yml` (F-032). `concurrency:
  cancel-in-progress: false`. Node pinned via `.nvmrc` (`node-version-file`).
- `security.yml` — on PR to main + weekly Monday 08:00 UTC: npm audit + OWASP Dependency-Check (fail on CVSS ≥ 7).
- `.github/dependabot.yml` — weekly grouped npm + github-actions updates (F-039).
- Vite base path: `/gaslight-and-grimoire/` (matches the Worker route prefix — keep unchanged).

## Character System

Four archetypes, each with +3/+1 faculty bonuses and a once-per-case ability:
- Deductionist: +3 Reason, +1 Perception. Ability: Elementary (auto-succeed Reason check).
- Occultist: +3 Lore, +1 Perception. Ability: Veil Sight (reveal supernatural elements).
- Operator: +3 Vigor, +1 Nerve. Ability: Street Survivor (auto-succeed Vigor check).
- Mesmerist: +3 Influence, +1 Nerve. Ability: Silver Tongue (auto-succeed Influence check).

Base faculty score: 8. Bonus points to allocate: 12. Composure and Vitality: 0–10 (start at 10).

## Current Content

### Main Cases (3-act structure)
- **"The Whitechapel Cipher"** — 67 scenes, 14 clues, 7 NPCs, 6 variants, 4 endings. Cipher murders in Whitechapel, conspiracy reaching Scotland Yard. Court of Smoke underworld path, archetype-exclusive scenes.
- **"The Mayfair Séance"** — 50 scenes, 13 clues, 7 NPCs, 6 variants, 4 endings. Society séance turns deadly, fraud meets genuine supernatural. Court of Smoke ritual supplier path.
- **"The Lamplighter's Wake"** — 44 scenes, 13 clues, 7 NPCs, 3 variants, 4 endings. Dead Lamplighter agent, locked room, Gasworks Veil fragment trafficking. Court of Smoke as primary antagonist.

### Side Cases (vignettes, 2-act structure)
- **"A Matter of Shadows"** — 13 scenes, 5 clues, 3 NPCs, 3 endings. Missing Lamplighter courier in Southwark. Unlocks at Lamplighters rep ≥ 2.
- **"The Rationalist's Dilemma"** — 10 scenes, 5 clues, 2 NPCs, 3 endings. Scientist detects the Veil electromagnetically; Circle wants it buried. Unlocks at Rationalists Circle rep ≥ 2.
- **"The Debt of Smoke"** — 9 scenes, 4 clues, 2 NPCs, 3 endings. Court of Smoke contact asks for help with a stolen Veil fragment. Unlocks via the persisted `wc-court-deal-made` flag (set by the Whitechapel Court-of-Smoke ending).
- **"The Unfinished Case"** — 8 scenes, 4 clues, 2 NPCs, 3 endings. Cold case: the original cipher maker was murdered before the Whitechapel events. Unlocks after completing The Whitechapel Cipher.

### Content Totals
- 201 scenes, 58 clues, 30 NPCs across 7 cases (scene count per `node scripts/validateCase.mjs` — base + variants, incl. the injected shared scenes)
- All 4 factions active: Rationalists Circle, Hermetic Order of the Grey Dawn, Lamplighters, Court of Smoke
- Archetype-exclusive scenes in all 3 main cases (Deductionist, Occultist, Operator, Mesmerist)
- ~1.77 choices per scene across all content (2.14 among choice-bearing scenes, i.e. excluding terminal endings and encounter scenes)

## Known Bugs & Gaps

**`docs/status.md` + `docs/PROJECT_STATE.md` are the live source of truth** for current state and the
open audit backlog — consult them, not this section, for what's outstanding. (Run `npm run test:run`
for the live test baseline.) Phases A–E are complete; the original-build gaps (active clue discovery,
NPC dialogue, recovery mechanics, persistent evidence board, Veil Sight, consequence feedback, content
depth, faction clamping, CI validation) are all fixed. What remains:

- **Media assets** — the audio system is fully coded and 9 SFX have shipped, but ambient loops and
  illustrations are still pending (illustrations parked at lowest priority). See PROJECT_STATE milestone M.
- **2026-07 repo-audit backlog** — see the prioritised issue list in `docs/PROJECT_STATE.md` and
  `docs/audits/ULTRACODE_FULL_REPO_ANALYSIS.md` for any remaining P2/P3 items.

## Architectural Warnings

Things to be aware of when making changes:

- **`processChoice` navigates before returning** — It calls `actions.goToScene()` internally, then returns `ChoiceResult`. The caller shows the dice overlay after the scene has already changed. Use `computeChoiceResult` for the pure computation without side effects.
- **`onEnter` effects are applied from `goToScene`, once per scene** — `goToScene` resolves the scene and calls `worldSlice.applyEffects(onEnter)`, gated on `narrativeSlice.visitedScenes` so effects fire exactly once per playthrough (never re-fire on save-load or any re-navigation — F-006). Feedback text is written to `narrativeSlice.lastEffectMessages`; `NarrativePanel` only reads it. Do **not** re-add effect application to the view layer. `visitedScenes` resets on case/vignette load and round-trips through save (migration v3).
- **Evidence Board connections persist in store** — `evidenceSlice.connections` holds ID pairs. DOM points are recomputed on render. Connections cleared on case/vignette load and on deduction (success or failure).
- **`adjustDisposition` has a hidden cross-slice call** — After updating NPC disposition, it calls `get().adjustReputation(faction, delta * 0.5)` for faction-aligned NPCs. This coupling is in `src/store/slices/npcSlice.ts`.
- **Faction reputation is clamped** — Disposition [-10,+10], suspicion [0,10], composure/vitality [0,10], faction reputation [-10,+10]. All numeric state is now bounded.
- **`Object.keys(data.scenes)[0]` is the fallback for first scene** — In `loadAndStartCase`. Used only when `meta.json` lacks a `firstScene` field. All cases now have `firstScene` set explicitly.
- **No audio files in repo** — The audio system is fully coded but silent. Howler silently handles missing files. SFX is triggered via a store subscription in `src/store/audioSubscription.ts` (initialized in `main.tsx`), not from slice actions.
- **`Date.now()` and `Math.random()` used directly** — In `diceEngine.rollD20()`, `hintEngine`, `metaSlice.saveGame` (save ID), `buildDeduction`. Not injectable. Tests work around this. (`saveManager` uses neither `Date.now()` nor `Math.random()`; it stamps a save's `timestamp` with `new Date().toISOString()`.)

## Implementation Roadmap

The project was built in phases A–E, all complete. Summary:

- **Phase A (Foundation)**: ✅ COMPLETE — Fixed loadGame, deduped snapshots, wired hints, fixed abilities, added validation, added firstScene
- **Phase B (Core Refactoring)**: ✅ COMPLETE — Extracted pure computeChoiceResult, moved buildDeduction to engine, audio subscription, consolidated CheckResult types, runtime content validation with tier completeness
- **Phase C (Gap Filling)**: ✅ COMPLETE — ClueDiscoveryCard, save button, faction display, error display, case completion screen
- **Phase D (Integration)**: ✅ COMPLETE — Encounter UI, stale state cleanup, remove dead code
- **Phase E (Game Design)**: ✅ COMPLETE — ~~Active clue discovery~~ ✅, ~~consequence feedback~~ ✅, ~~Veil Sight~~ ✅, ~~recovery mechanics~~ ✅, ~~persistent evidence board~~ ✅, ~~faction clamping~~ ✅, ~~CI validation~~ ✅, ~~NPC dialogue~~ ✅, ~~scene history~~ ✅, ~~testing expansion~~ ✅, ~~content depth~~ ✅. Remaining: audio/visual assets. See `docs/status.md` for current state.
