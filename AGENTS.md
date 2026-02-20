# AGENTS.md — Gaslight & Grimoire

## What This Is

A browser-based choose-your-own-adventure game set in Victorian London where magic exists beneath the rational world. Players investigate branching mysteries blending Sherlock Holmes-style deduction with D&D-style faculty checks and dice mechanics. Built with React 18, Zustand, Tailwind CSS, Framer Motion, and Howler.js. Deployed to GitHub Pages.

## Architecture

Two strict domains — never mix them:

- `content/` — narrative data as JSON (cases, clues, NPCs, scenes)
- `src/engine/` — game logic (pure functions where possible)

Components live in `src/components/[Name]/` with `index.ts` barrel exports. State is managed by a single Zustand store composed of six Immer-powered slices.

## Directory Layout

```
content/
  cases/[case-name]/          # Main cases (3-act structure)
    meta.json                 # CaseMeta: id, title, synopsis, acts, facultyDistribution
    act1.json, act2.json, act3.json  # SceneNode[] per act
    clues.json                # Array of Clue objects
    npcs.json                 # Array of NPCState objects
    variants.json             # SceneNode[] triggered by cross-case flags
  side-cases/[vignette-name]/ # Side vignettes (2-act structure)
    meta.json                 # VignetteMeta (optional triggerCondition)
    scenes.json, clues.json, npcs.json

src/
  types/index.ts              # ALL type definitions live here
  store/
    index.ts                  # useStore + selector hooks + action hooks
    types.ts                  # GameStore = intersection of all slices
    slices/                   # Six domain slices (see below)
  engine/
    narrativeEngine.ts        # Content loading, condition eval, scene resolution, choice processing, encounters
    diceEngine.ts             # d20 rolls, advantage/disadvantage, modifier calc, outcome tiers
    caseProgression.ts        # End-of-case logic, faculty bonuses, vignette unlocks
    hintEngine.ts             # Stateful hint system (3 escalating levels)
    saveManager.ts            # localStorage persistence with versioned migrations
    audioManager.ts           # Howler.js SFX management (lazy-cached Howl instances)
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
| `narrativeSlice` | `currentScene`, `currentCase`, `sceneHistory`, `lastCheckResult`, `caseData` | `goToScene`, `setCheckResult`, `startNewCase`, `loadAndStartCase`, `completeCase` |
| `evidenceSlice` | `clues`, `deductions` | `discoverClue`, `updateClueStatus`, `addDeduction` |
| `npcSlice` | `npcs` | `adjustDisposition`, `adjustSuspicion`, `setNpcMemoryFlag`, `removeNpc` |
| `worldSlice` | `flags`, `factionReputation` | `setFlag`, `adjustReputation` |
| `metaSlice` | `settings` | `updateSettings`, `saveGame`, `loadGame` |

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
- `Condition` — gates scene access and choices (types: `hasClue`, `hasDeduction`, `hasFlag`, `facultyMin`, `archetypeIs`, `npcDisposition`, `npcSuspicion`, `factionReputation`)
- `Effect` — mutates game state on scene entry (types: `composure`, `vitality`, `flag`, `disposition`, `suspicion`, `reputation`, `discoverClue`)
- `SceneNode` — atomic narrative unit with `choices`, `cluesAvailable`, `conditions`, `onEnter` effects, optional `variantOf`/`variantCondition`
- `Choice` — may have `faculty`/`difficulty` for checks, `advantageIf` clue refs, `outcomes` per tier, `npcEffect`, encounter extensions (`worseAlternative`, `isEscapePath`, `encounterDamage`)

## Engine Behaviour

### Dice (diceEngine.ts)
- `rollD20()` → [1, 20]
- Modifier = `floor((facultyScore - 10) / 2)`
- Outcome: nat 20 → critical, nat 1 → fumble, total ≥ DC → success, total ≥ DC-2 → partial, else failure
- Advantage: roll 2d20 take highest. Disadvantage: take lowest. Both cancel out.
- Dynamic difficulty: `choice.dynamicDifficulty` scales DC based on a faculty score threshold.

### Narrative (narrativeEngine.ts)
- `loadCase` / `loadVignette` — fetch JSON, index by ID into `Record<string, T>`.
- `evaluateConditions` — pure AND logic over `Condition[]` against `GameState`.
- `resolveScene` — returns variant scene if its condition is met, otherwise base scene.
- `applyOnEnterEffects` — applies `Effect[]` to the store (the one non-pure function).
- `processChoice` — performs faculty check (using `resolveDC` for dynamic difficulty), applies NPC effects, navigates to next scene.
- `canDiscoverClue` — pure gate check for `ClueDiscovery` requirements.
- `validateContent` — checks for broken scene-graph edges and missing clue references.

### Encounters (also in narrativeEngine.ts)
- `startEncounter` — for supernatural encounters, performs Nerve/Lore reaction check at DC 12. Failure: composure damage + worseAlternative replacement.
- `processEncounterChoice` — faculty check + damage application. Supernatural = dual-axis (composure + vitality). Mundane = single axis.
- `getEncounterChoices` — filters choices by conditions, annotates occult advantage, always includes escape paths.

### Case Progression (caseProgression.ts)
- `completeCase` — grants +1 faculty bonus from `last-critical-faculty` flag, checks vignette unlocks, auto-saves.
- Vignette unlocks triggered by: faction reputation thresholds, NPC disposition ≥ 7, or required flags.

### Hints (hintEngine.ts)
- Stateful singleton tracking board visits, connection attempts, scene dwell time.
- Triggers after 3+ board visits with no connections OR 5+ minutes on a scene.
- 3 escalating levels: narrative nudge → specific clue suggestion → direct reveal.
- Level 3 gated behind Level 2 being shown first. Respects `hintsEnabled` setting.

### Save System (saveManager.ts)
- localStorage with `gg_save_` prefix. Index at `gg_save_index`.
- `SaveFile` wraps `GameState` with `version` + `timestamp`.
- Migration pipeline: v0→v1 adds `factionReputation`. Current version: 1.

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
- Run `node scripts/validateCase.mjs` after editing case files to catch broken references.
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
- Side case: "A Matter of Shadows" (unlocks at Lamplighters faction rep ≥ 2)
