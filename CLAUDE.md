# CLAUDE.md — Gaslight & Grimoire

## What This Is

A browser-based choose-your-own-adventure game set in Victorian London where magic exists beneath the rational world. Players investigate branching mysteries blending Sherlock Holmes-style deduction with D&D-style faculty checks and dice mechanics. Built with React 19, Zustand, Tailwind CSS v4, Framer Motion, and Howler.js. Deployed as a Cloudflare static-assets Worker at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/`.

## Documentation (docs/) — one authority per fact

Project docs live under `docs/`. **Each fact has exactly one authoritative home — this file points at
the authorities and does not restate them.** Read the relevant doc before significant changes:

- `docs/README.md` — orientation and doc map (start here)
- `docs/architecture.md` — component hierarchy, store slices, engine modules, data flow, cross-slice couplings, determinism notes
- `docs/engine-reference.md` — per-module engine API (signatures + behavior): dice, conditions, choice resolution, encounters, case progression, hints, saves/migrations, audio
- `docs/content-authoring.md` — case/vignette JSON schemas, Condition/Effect catalogs, authoring rules, validation, audio asset reference
- `docs/status.md` — current state: systems present, content inventory (cases, scenes, clues, NPCs), test baseline
- `docs/Gaslight_&_Grimoire_design.md` — the original design bible (vision, world, mechanics, narrative intent — archetypes, factions, faculties)

## Project memory — read at session start, update at session end

This repo keeps a **committed, version-controlled memory spine** so progress and decisions survive
across sessions and machines (unlike a tool's machine-local auto-memory). It does **not** restate the
architecture or scope rules in this file and `docs/` — it tracks *what's done and what's been decided*:

- **`docs/PROJECT_STATE.md`** — the one-page live snapshot. **Read this first** when resuming work.
- **`docs/RUN_LOG.md`** — prepend-only session history (what happened, when; newest on top).
- **`docs/DECISIONS/`** — Architecture Decision Records (the *why* behind non-trivial calls).

**Protocol.** Start of work: read `PROJECT_STATE.md` + the latest `RUN_LOG.md` entry. End of session:
run `/checkpoint`. A `SessionStart` hook (`.claude/hooks/session-preflight.sh`) injects git state + the
top of `PROJECT_STATE.md` automatically.

## Architecture

Two strict domains — never mix them:

- `public/content/` — narrative data as JSON (cases, clues, NPCs, scenes). Vite serves `public/` at the site root, so the engine fetches these at runtime as `/content/...`.
- `src/engine/` — game logic (pure functions where possible)

Components live in `src/components/[Name]/` with `index.ts` barrel exports. State is managed by a single Zustand store composed of six Immer-powered slices. The full component hierarchy, slice tables, and engine data flow are in `docs/architecture.md`; per-module engine behavior is in `docs/engine-reference.md`.

## Directory Layout

```
public/content/                 # served at runtime as /content/
  manifest.json                 # CaseManifest: all cases and vignettes with metadata
  shared/                       # breakdown/incapacitation halt scenes, injected into all cases
  cases/[case-name]/            # Main cases (3-act): meta.json, act1-3.json, clues.json,
                                #   npcs.json, variants.json, deductions.json
  side-cases/[vignette-name]/   # Side vignettes (2-act): meta.json, scenes.json, clues.json, npcs.json
                                # (JSON schemas + wrapping rules: docs/content-authoring.md)
src/
  types/index.ts              # ALL type definitions live here
  utils/gameState.ts          # snapshotGameState — shared GameState builder (store + engine)
  store/                      # useStore + selector/action hooks; six slices in store/slices/
  engine/                     # game-logic modules — see docs/engine-reference.md for each:
                              #   narrativeEngine (barrel), contentLoader, conditions,
                              #   choiceResolution, encounters, advantage, flags, constants,
                              #   contentValidation, engineActions, diceEngine, buildDeduction,
                              #   caseProgression, haltScenes, hintEngine, saveManager,
                              #   audioManager, cluePrompts, effectMessages
  components/                 # React components (each in own directory)
  data/archetypes.ts          # Archetype definitions, faculty constants

scripts/
  validateCase.mjs            # Content-validation entry point (vite-node shim) — run after editing case JSON
  validateCase.ts             # The real validator; imports shared src/engine/contentValidation (edit logic HERE, not the .mjs shim)

.github/workflows/            # deploy.yml (CI gate), security.yml (dependency auditing)
```

## Commands

```bash
npm run dev              # Vite dev server
npm run build            # tsc (src/) + tsc -p tsconfig.scripts.json (scripts/ + vite.config.ts) + vite build + nest
npm run typecheck:scripts  # Type-check scripts/ + vite.config.ts alone (the tooling tsconfig.json's include:["src"] skips)
npm run lint             # ESLint (flat config; TS recommended + react-hooks)
npm test                 # vitest watch mode
npm run test:run         # vitest single run (use this for CI / scripted checks)
node scripts/validateCase.mjs  # Validate case content JSON
```

## Store & State Management

Single `useStore` (Zustand + Immer) composed from six slices: `investigator`, `narrative`, `evidence`,
`npc`, `world`, `meta` (state/action tables in `docs/architecture.md`).

Rules:
- Always use selector hooks (`useInvestigator`, `useClues`, `useCaseData`, etc.) — never subscribe to the full store.
- Always use action hooks (`useInvestigatorActions`, `useEvidenceActions`, etc.) for mutations.
- Use `useCurrentScene()` to get the resolved `SceneNode` for the current scene (handles variant resolution).
- Use `buildGameState(store)` to build a `GameState` snapshot for engine functions.
- State is flat and normalised: `Record<string, T>` keyed by id. No nested arrays.
- Immer is active — mutate draft state directly inside slice actions. No manual spreading.
- `adjustDisposition` on a faction-aligned NPC automatically propagates `delta * 0.5` to faction reputation.

All type definitions live in `src/types/index.ts`; the `Condition`/`Effect` catalogs and content-facing
type shapes are documented in `docs/content-authoring.md`.

## Content Authoring Rules

The full authoring ruleset (gating, deductions, red herrings, key-deduction recipes, alternate paths)
lives in `docs/content-authoring.md` — read it before writing content. Non-negotiables:

- `Condition` and `Effect` are the ONLY mechanism for gating and mutating game state from content JSON. No ad-hoc logic in scene handlers.
- Run `node scripts/validateCase.mjs` after editing case files to catch broken references. Validates all cases by default, or pass a specific case path.
- Narrative tone: measured, atmospheric, never campy.

## Current Content

7 cases (3 main, 4 side vignettes), all 4 factions active. The live inventory — per-case scene/clue/NPC
counts, endings, unlock conditions, totals — is in `docs/status.md`; verify counts with
`node scripts/validateCase.mjs`, don't quote from memory.

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
  `build` (`npm run build`, build-compiles check only — no publish; its `tsc` step now also type-checks
  `scripts/` + `vite.config.ts` via `tsconfig.scripts.json`, so a type regression in the validator source
  fails the gate — F-123). `build` needs `test`, so a failing lint/validator/test blocks the merge gate.
  It no longer publishes anywhere (deploy is Cloudflare-side).
  Dependency auditing is **not** here — it lives in `security.yml` (F-032). `concurrency:
  cancel-in-progress: false`. Node pinned via `.nvmrc` (`node-version-file`).
- `security.yml` — on PR to main + weekly Monday 08:00 UTC: npm audit + OWASP Dependency-Check (fail on CVSS ≥ 7).
- `.github/dependabot.yml` — weekly grouped npm + github-actions updates (F-039).
- Vite base path: `/gaslight-and-grimoire/` (matches the Worker route prefix — keep unchanged).
- **Merge strategy: do NOT squash-merge.** Use a merge commit (`gh pr merge --merge`) or rebase — never
  `--squash`. Squashing collapses a PR's per-commit history (and its TDD RED→GREEN steps) into one commit,
  which this repo's memory spine relies on for traceability.

## Known Bugs & Gaps

**`docs/status.md` + `docs/PROJECT_STATE.md` are the live source of truth** for current state and the
open audit backlog — consult them, not this file. (Run `npm run test:run` for the live test baseline.)

## Architectural Warnings

Things to be aware of when making changes:

- **`processChoice` navigates before returning** — It calls `actions.goToScene()` internally, then returns `ChoiceResult`. The caller shows the dice overlay after the scene has already changed. Use `computeChoiceResult` for the pure computation without side effects.
- **`onEnter` effects are applied from `goToScene`, once per resolved scene** — `goToScene` resolves the scene and calls `worldSlice.applyEffects(onEnter)`, gated on `narrativeSlice.visitedScenes` **keyed by the resolved scene id** (base or variant), so effects fire exactly once per playthrough — never re-firing on save-load or re-navigation (F-006), yet still firing a variant's distinct `onEnter` once when its condition first becomes true (F-118). Feedback text is written to `narrativeSlice.lastEffectMessages`; `NarrativePanel` only reads it. Do **not** re-add effect application to the view layer. `goToScene` also clears `lastCheckResult` on a real cross-scene navigation so the dice overlay can't leak onto the next scene (F-106). `visitedScenes` resets on case/vignette load (as does `currentScene`, F-104) and round-trips through save (migration v3).
- **Evidence Board connections persist in store** — `evidenceSlice.connections` holds ID pairs. DOM points are recomputed on render. Connections cleared on case/vignette load and on deduction (success or failure).
- **`adjustDisposition` has a hidden cross-slice call** — After updating NPC disposition, it calls `get().adjustReputation(faction, delta * 0.5)` for faction-aligned NPCs. This coupling is in `src/store/slices/npcSlice.ts`.
- **Faction reputation is clamped** — Disposition [-10,+10], suspicion [0,10], composure/vitality [0,10], faction reputation [-10,+10]. All numeric state is now bounded.
- **`Object.keys(data.scenes)[0]` is the fallback for first scene** — In `loadAndStartCase`. Used only when `meta.json` lacks a `firstScene` field. All cases now have `firstScene` set explicitly.
- **9 SFX ship; ambient loops & illustrations pending** — The 9 SFX `.mp3`s live in `public/audio/sfx/` (git-tracked). Howler silently handles the still-missing ambient loops and illustrations. SFX is triggered via a store subscription in `src/store/audioSubscription.ts` (initialized in `main.tsx`), not from slice actions.
- **`Date.now()` and `Math.random()` used directly** — In `diceEngine.rollD20()`, `hintEngine`, `metaSlice.saveGame` (save ID), `buildDeduction`. Not injectable. Tests work around this. (`saveManager` uses neither `Date.now()` nor `Math.random()`; it stamps a save's `timestamp` with `new Date().toISOString()`.)
