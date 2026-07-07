# Documentation Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sprawling 34-file `devdocs/` tree with 5 lean, code-accurate documentation files under `docs/`, strip the now-orphaned `Req X.Y` references from source, and re-point CLAUDE.md — without changing any runtime behavior or test outcome.

**Architecture:** This is a documentation + mechanical-refactor task, not a feature build. There is no TDD loop for the docs; instead, each doc is written from **facts gathered directly from the live code**, then verified against that code. The one code change (stripping `Req X.Y` strings from comments and test labels) is verified by an unchanged passing-test count (334 tests / 29 files) before and after.

**Tech Stack:** Markdown docs; React 18 / Zustand / TypeScript source; Vitest for the verification gate; `node scripts/validateCase.mjs` for content facts.

**Reference spec:** `docs/superpowers/specs/2026-07-07-devdocs-rebuild-design.md`

---

## Ground-Truth Facts (verified 2026-07-07 — embed these; do not re-derive loosely)

These were captured from the live code at plan-writing time. Re-run the verification commands (Task 1) to confirm before writing docs.

**Test baseline:** `334 passed (334)` across `29 passed (29)` test files.

**Content inventory (from `node scripts/validateCase.mjs`):**

| Case | Scenes | Clues |
|---|---|---|
| cases/the-whitechapel-cipher | 66 | 14 |
| cases/the-mayfair-seance | 49 | 13 |
| cases/the-lamplighters-wake | 43 | 13 |
| side-cases/a-matter-of-shadows | 13 | 5 |
| side-cases/the-rationalists-dilemma | 10 | 5 |
| side-cases/the-debt-of-smoke | 9 | 4 |
| side-cases/the-unfinished-case | 8 | 4 |
| **Total** | **198** | **58** |

7 cases (3 main 3-act, 4 vignettes). NPCs: 7 per main case, 2–3 per vignette (read from each `npcs.json` length when writing `status.md`).

**Engine files (`src/engine/`, 10 non-test):**
- `diceEngine.ts` — `rollD20`, `rollWithAdvantage`, `rollWithDisadvantage`, `calculateModifier`, `getTrainedBonus`, `resolveCheck`, `resolveDC`, `performCheck`; interfaces `RollResult`, `CheckResult`.
- `narrativeEngine.ts` — `fetchManifest`, `loadCase`, `loadVignette`, `validateContent`, `evaluateConditions`, `resolveScene`, `canDiscoverClue`, `computeChoiceResult`, `processChoice`, `startEncounter`, `processEncounterChoice`, `getEncounterChoices`.
- `buildDeduction.ts` — `buildDeduction`.
- `caseProgression.ts` — `CaseProgression` object; interface `CaseCompletionResult`.
- `hintEngine.ts` — `trackActivity`, `shouldShowHint`, `getHint`, `resetForScene`, `_getState`, `_setState`; types `HintEvent`, `HintLevel`, `HintContent`, `HintEngineState`.
- `saveManager.ts` — `SaveManager` object; interface `SaveSummary`.
- `audioManager.ts` — `AudioManager` object; type `SfxEvent`.
- `cluePrompts.ts` — `getCluePromptText`.
- `effectMessages.ts` — `generateEffectMessage`, `generateEffectMessages`.
- `engineActions.ts` — interface `EngineActions`.

**Store slices (`src/store/slices/`, 6):** `investigatorSlice`, `narrativeSlice`, `evidenceSlice`, `npcSlice`, `worldSlice`, `metaSlice`. (Action tables in CLAUDE.md are accurate; re-read each slice to confirm before copying.)

**Component dirs (`src/components/`, 16):** AccessibilityProvider, AmbientAudio, CaseCompletion, CaseJournal, CaseSelection, CharacterCreation, ChoicePanel, EncounterPanel, ErrorBoundary, EvidenceBoard, HeaderBar, NPCGallery, NarrativePanel, SettingsPanel, StatusBar, TitleScreen.

**Condition types (`src/types/index.ts` — `Condition.type`):** `hasClue`, `hasDeduction`, `hasFlag`, `facultyMin`, `archetypeIs`, `npcDisposition`, `npcSuspicion`, `factionReputation`, `npcMemoryFlag`. Fields: `target: string`, `value?: number | boolean | string | NpcSuspicionTier`.

**Effect types (`src/types/index.ts` — `Effect.type`):** `composure`, `vitality`, `flag`, `disposition`, `suspicion`, `reputation`, `discoverClue`, `setMemoryFlag`. Fields: `target?`, `delta?`, `value?`, `description?`.

**Act JSON shape:** main-case `actN.json` is an **object** `{ "scenes": [ ... ] }` (NOT a bare array). Vignette `scenes.json` and all `clues.json`/`npcs.json`/`variants.json` are bare arrays. Confirm per-file when writing `content-authoring.md`.

**`Req X.Y` strip footprint:** 160 reference lines across 37 files, in three shapes:
1. **Whole-line JSDoc/comment** whose only content is a Req reference (~20 lines), e.g. `src/components/StatusBar/StatusBar.tsx:7: * Req 5.1–5.7`, `src/engine/narrativeEngine.ts:55: * Req 17.1` → **delete the whole line**.
2. **Test label parenthetical** (~23 lines), e.g. `describe('AbilityButton — available state (Req 15.6)', ...)` → **strip ` (Req …)`**, keep the label.
3. **Trailing inline comment parenthetical**, e.g. `// Encounter extensions (Req 9)`, `// Grant faculty bonus … (Req 10.6)` → **strip ` (Req …)`**, keep the comment text.

**GitHub Pages:** deploys from Vite `dist` artifact via `.github/workflows/deploy.yml`, NOT from `/docs`. Docs under `docs/` do not affect the published site.

---

## File Structure

**Created (under `docs/`):**
- `docs/README.md` — orientation + map to the 4 other docs and the design bible.
- `docs/architecture.md` — system shape: component hierarchy, 6 store slices, 10 engine modules, data flow, cross-slice couplings, determinism notes.
- `docs/engine-reference.md` — per-file engine API: signatures + behavior.
- `docs/content-authoring.md` — JSON schemas, Condition/Effect catalogs, validation workflow, authoring rules, audio asset reference.
- `docs/status.md` — current state only: what's built, content inventory, live test baseline.

**Deleted:**
- `devdocs/` (entire tree, 34 files).
- `GAME_DESIGN_ANALYSIS.md` (root) — substance absorbed into `docs/status.md`.
- `AUDIO_ASSET_LIST.md` (root) — absorbed into `docs/content-authoring.md`.

**Modified:**
- `CLAUDE.md` — rewrite the "Deep Documentation (devdocs/)" section; fix stray `devdocs/` / stale-count references.
- ~37 source files under `src/` — strip `Req X.Y` strings (no logic change).

**Kept untouched:**
- `docs/Gaslight_&_Grimoire_design.md` — the design-intent bible.
- All `src/` logic and test assertions; all `public/content/` JSON.

---

## Task 1: Capture the before-baseline and confirm ground-truth facts

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite and record the count**

Run: `npx vitest run 2>&1 | tail -5`
Expected: a line reading `Test Files  29 passed (29)` and `Tests  334 passed (334)`.
Record these two numbers — they are the gate for Task 8. If they differ from 334/29, use the observed numbers as the baseline instead.

- [ ] **Step 2: Confirm the content inventory**

Run: `node scripts/validateCase.mjs`
Expected: `All 7 case(s) validated successfully.` with the per-case scene/clue counts matching the "Content inventory" table above.

- [ ] **Step 3: Confirm the Req strip footprint**

Run: `grep -rlE "Req [0-9]" src | wc -l` → expected `37`.
Run: `grep -rnE "Req [0-9]" src | wc -l` → expected `160`.
If these differ, note the new numbers; the strip tasks below use "whatever the grep finds," so a drift only changes counts, not method.

- [ ] **Step 4: Commit nothing**

No commit — this task only establishes the baseline in the working session.

---

## Task 2: Write `docs/architecture.md`

**Files:**
- Create: `docs/architecture.md`
- Read for facts: `src/App.tsx`, `src/main.tsx`, `src/store/index.ts`, `src/store/types.ts`, all `src/store/slices/*.ts`, `src/store/audioSubscription.ts`, `src/utils/gameState.ts`.

- [ ] **Step 1: Read the store layer to confirm slice state/actions and couplings**

Run: `sed -n '1,80p' src/store/slices/npcSlice.ts` (confirm the `adjustDisposition` → `adjustReputation` cross-slice call and the `delta * 0.5` factor).
Run: `sed -n '1,60p' src/store/index.ts` (confirm selector hooks + action hooks names).
Read `src/store/slices/worldSlice.ts` to confirm `applyEffects` lives there (not in the engine) and that reputation is clamped to `[-10, 10]`.

- [ ] **Step 2: Write the file**

Write `docs/architecture.md` with these sections (populate from what you read, not from memory):

1. **Overview** — one paragraph: React 18 + Zustand (Immer) + Tailwind + Framer Motion + Howler; strict split between `public/content/` (JSON data, served at site root) and `src/engine/` (logic). Link to `./Gaslight_&_Grimoire_design.md` for design intent.
2. **Component hierarchy** — the tree rooted at `<ErrorBoundary>` → `<App>` → `<AccessibilityProvider>` → screens (`TitleScreen`, `LoadGameScreen`, `CharacterCreation`, `CaseSelection`, `GameScreen`) and `GameScreen`'s children (`HeaderBar`, `AmbientAudio`, `GameContent` → `NarrativePanel`/`ChoicePanel`/`EncounterPanel`, `StatusBar`, overlays `EvidenceBoard`/`CaseJournal`/`NPCGallery`/`SettingsPanel`). One line per component saying what it renders.
3. **Store: six slices** — a table with columns Slice / State / Actions, one row per slice (`investigatorSlice`, `narrativeSlice`, `evidenceSlice`, `npcSlice`, `worldSlice`, `metaSlice`), filled from the slice files you read.
4. **Store rules** — use selector hooks / action hooks (never subscribe to full store); flat normalized `Record<string, T>` state; Immer mutate-draft; `buildGameState(store)` builds the `GameState` snapshot for engine calls.
5. **Cross-slice couplings** — call out the hidden `adjustDisposition` → `adjustReputation(faction, delta * 0.5)` in `npcSlice`; note `applyEffects` is a `worldSlice` action called from `NarrativePanel`; note connections persist in `evidenceSlice`.
6. **Data flow (runtime)** — the path: `loadAndStartCase` → `fetchManifest`/`loadCase` (fetch `/content/...`) → index into `Record` → `goToScene` → `NarrativePanel` renders + fires `applyEffects` → `ChoicePanel`/`processChoice` → `diceEngine` → store mutation → re-render.
7. **Engine ↔ store boundary** — engine functions take an `EngineActions` interface param; **zero store imports in engine files** (verify with `grep -rl "useStore" src/engine` returning nothing). Audio is driven by a store subscription in `src/store/audioSubscription.ts` (wired in `main.tsx`).
8. **Bounded state** — disposition `[-10,10]`, suspicion `[0,10]`, composure/vitality `[0,10]`, faction reputation `[-10,10]`.
9. **Determinism notes** — `Date.now()` / `Math.random()` used directly in `diceEngine.rollD20`, `hintEngine`, `saveManager`, `metaSlice.saveGame`, `buildDeduction`; not injectable; tests work around this.

- [ ] **Step 3: Verify claims against code**

Run: `grep -rl "useStore" src/engine` → expected: no output (empty). If it prints a file, correct section 7.
Run: `grep -n "adjustReputation" src/store/slices/npcSlice.ts` → expected: a line showing the `delta * 0.5` propagation. Confirm section 5 matches.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture.md (code-accurate system overview)"
```

---

## Task 3: Write `docs/engine-reference.md`

**Files:**
- Create: `docs/engine-reference.md`
- Read for facts: every file in `src/engine/` (except `__tests__/`).

- [ ] **Step 1: Extract the exported surface of each engine file**

Run:
```bash
for f in src/engine/*.ts; do case "$f" in *__tests__*) continue;; esac; \
echo "=== $f ==="; \
grep -nE "export (async )?function|export const [A-Za-z]+ =|export interface|export type" "$f"; done
```
Expected: the export lists matching the "Engine files" fact block above. Use these as the authoritative function list.

- [ ] **Step 2: Read behavior details for the non-obvious functions**

Read these spans to describe behavior accurately (open each file and read the function body):
- `diceEngine.ts` — `calculateModifier` (`floor((score-10)/2)`), `getTrainedBonus` (+1 when faculty = archetype primary: deductionist→reason, occultist→lore, operator→vigor, mesmerist→influence), `resolveCheck` (nat20→critical, nat1→fumble, ≥DC→success, ≥DC-3→partial, else failure), `resolveDC` (dynamic difficulty).
- `narrativeEngine.ts` — `computeChoiceResult` (pure; ability auto-succeed flags, dice, advantage, DC) vs `processChoice` (calls `actions.goToScene()` **before** returning `ChoiceResult`); `startEncounter` (Nerve/Lore reaction check at DC 12); `processEncounterChoice` (supernatural = dual-axis composure+vitality; mundane = single axis); `resolveScene` (variant resolution); `evaluateConditions` (AND logic).
- `caseProgression.ts` — `CaseProgression.completeCase` grants +1 faculty from `last-critical-faculty` flag, checks vignette unlocks, auto-saves.
- `hintEngine.ts` — stateful singleton; 3 escalating levels; level 3 gated behind level 2; triggers after 3+ board visits w/ no connections OR 5+ min dwell.
- `saveManager.ts` — `gg_save_` prefix, index at `gg_save_index`, `SaveFile` = `GameState` + version + timestamp, migration v0→v1 adds `factionReputation`, current version 1, 10 manual save cap, autosave slot `'autosave'`.

- [ ] **Step 3: Write the file**

Write `docs/engine-reference.md` with one `##` section per engine file (10 sections). In each: a one-line purpose, then a bullet or small table of exported functions with **signature + one-line behavior**. Include the `processChoice` navigation caveat and the `computeChoiceResult` pure-alternative prominently. Add a short "Determinism" note pointing back to `architecture.md`.

- [ ] **Step 4: Verify no invented functions**

Run:
```bash
for f in src/engine/*.ts; do case "$f" in *__tests__*) continue;; esac; \
grep -oE "export (async )?function [a-zA-Z]+|export const [A-Za-z]+" "$f"; done | sort -u
```
Cross-check: every function documented appears in this list, and every exported function/object in this list is documented. Fix any mismatch.

- [ ] **Step 5: Commit**

```bash
git add docs/engine-reference.md
git commit -m "docs: add engine-reference.md (per-module API from source)"
```

---

## Task 4: Write `docs/content-authoring.md` (folds in AUDIO_ASSET_LIST.md)

**Files:**
- Create: `docs/content-authoring.md`
- Read for facts: `src/types/index.ts` (Condition, Effect, SceneNode, Choice, Clue, meta types), `scripts/validateCase.mjs`, `AUDIO_ASSET_LIST.md`, sample content files.

- [ ] **Step 1: Confirm the directory layout and JSON shapes**

Run: `find public/content -maxdepth 2 -type d | sort` (confirm `cases/*`, `side-cases/*`, `shared/`).
Run: `node -e 'const d=require("./public/content/cases/the-whitechapel-cipher/act1.json"); console.log("act shape:", Array.isArray(d)?"array":Object.keys(d).join(","))'` → expected `act shape: scenes` (object with a `scenes` array).
Run: `node -e 'console.log(Array.isArray(require("./public/content/side-cases/a-matter-of-shadows/scenes.json")))'` → expected `true`.

- [ ] **Step 2: Confirm the Condition/Effect catalogs**

Run: `awk '/export interface Condition/,/^}/' src/types/index.ts`
Run: `awk '/export interface Effect/,/^}/' src/types/index.ts`
Use the exact `type` union members and field lists from the output (matches the fact block above).

- [ ] **Step 3: Write the file**

Write `docs/content-authoring.md` with these sections:

1. **Content layout** — the `public/content/` tree: `manifest.json`, `shared/{breakdown,incapacitation}.json`, `cases/[name]/{meta,act1,act2,act3,clues,npcs,variants}.json`, `side-cases/[name]/{meta,scenes,clues,npcs}.json`. Note main-case act files are `{ "scenes": [...] }` objects; vignette `scenes.json` and the `clues`/`npcs`/`variants` files are bare arrays. Note `/content/...` is fetched at runtime because Vite serves `public/` at the site root.
2. **Condition catalog** — table: Type / Meaning / `target` / `value`, one row per condition type (all 9). AND semantics across a `Condition[]`.
3. **Effect catalog** — table: Type / Meaning / fields used, one row per effect type (all 8). Note the optional `description` field for authored feedback text and the auto-generated fallback via `effectMessages`.
4. **SceneNode & Choice shape** — the key fields (`id`, `text`, `choices`, `cluesAvailable`, `conditions`, `onEnter`, `variantOf`/`variantCondition`, `encounter`) and Choice fields (`faculty`/`difficulty`, `advantageIf`, `outcomes` per tier, `npcEffect`, encounter extensions). Read from `src/types/index.ts` — do not invent fields.
5. **Authoring rules** — Condition/Effect are the ONLY gating/mutation mechanism; deductions derived from linked clue IDs; if any connected clue is `redHerring`, deduction `isRedHerring` must be true; no single Faculty gates critical progress; meaningful (not cosmetic) branching; measured/atmospheric tone.
6. **Validation workflow** — `node scripts/validateCase.mjs` (all cases) or with a case path; it's a CI step in `deploy.yml`. Show a sample of successful output.
7. **Audio asset reference** — the full SFX + ambient tables migrated from `AUDIO_ASSET_LIST.md` (9 SFX in `public/audio/sfx/`, 10 ambient loops in `public/audio/ambient/`). State plainly that these files are not yet present in the repo and Howler silently handles their absence.

- [ ] **Step 4: Verify the catalogs match the types**

Run: `grep -cE "'(hasClue|hasDeduction|hasFlag|facultyMin|archetypeIs|npcDisposition|npcSuspicion|factionReputation|npcMemoryFlag)'" src/types/index.ts` → expected `9` distinct members present. Confirm every one appears as a row in the Condition table.
Run: `grep -cE "'(composure|vitality|flag|disposition|suspicion|reputation|discoverClue|setMemoryFlag)'" src/types/index.ts` → confirm all 8 Effect members appear as rows.

- [ ] **Step 5: Commit**

```bash
git add docs/content-authoring.md
git commit -m "docs: add content-authoring.md (schemas, catalogs, asset ref)"
```

---

## Task 5: Write `docs/status.md` (absorbs GAME_DESIGN_ANALYSIS.md) and `docs/README.md`

**Files:**
- Create: `docs/status.md`, `docs/README.md`
- Read for facts: `GAME_DESIGN_ANALYSIS.md`, each `public/content/*/npcs.json` (for NPC counts).

- [ ] **Step 1: Gather NPC counts and confirm totals**

Run:
```bash
node -e 'const fs=require("fs");
for (const base of ["cases","side-cases"]) for (const c of fs.readdirSync("public/content/"+base)) {
  const p="public/content/"+base+"/"+c+"/npcs.json";
  if (fs.existsSync(p)) console.log(base+"/"+c, "npcs="+JSON.parse(fs.readFileSync(p,"utf8")).length);
}'
```
Record NPC counts per case for the status table.
Run: `node scripts/validateCase.mjs` once more to confirm 198 scenes / 58 clues / 7 cases before writing.

- [ ] **Step 2: Write `docs/status.md`**

Current-state-only (no roadmap, no forward-looking gaps). Sections:

1. **What this is** — one paragraph (browser CYOA, Victorian occult mystery, deduction + dice).
2. **Content inventory** — the per-case table (Case / Scenes / Clues / NPCs / type), totals row (198 scenes, 58 clues, 30 NPCs, 7 cases). Use the validator numbers and the NPC counts from Step 1.
3. **Systems present** — bullet list of implemented systems, phrased as fact (character creation + 4 archetypes; d20 check engine with trained bonus; clue discovery — all 4 methods; evidence board with persistent connections; deductions; NPC disposition/suspicion/memory-flag dialogue; faction reputation with propagation; encounters mundane + supernatural; recovery scenes; hint engine; save/load with migrations; accessibility settings; consequence feedback). Base each bullet on the corresponding engine/component that exists.
4. **Assets** — state plainly: audio system fully coded but **no audio files present**; illustration system coded (`SceneIllustration`) but **no image files present**; NPC portraits are letter-initial placeholders. (This is the absorbed, de-roadmapped substance of GAME_DESIGN_ANALYSIS.md item 2.)
5. **Test baseline** — `334 tests across 29 files pass (npx vitest run, 2026-07-07)`.

Do NOT include the old priority matrix, effort/impact columns, or "proposed solution" sections — those are forward-looking and out of scope.

- [ ] **Step 3: Write `docs/README.md`**

Short orientation doc:
- One-paragraph project description.
- A table mapping each doc to "read this when…": `architecture.md`, `engine-reference.md`, `content-authoring.md`, `status.md`, and `Gaslight_&_Grimoire_design.md` (design intent / vision — the canonical bible).
- Pointer to `CLAUDE.md` for the working agreement and commands.
- Commands block: `npm run dev`, `npm run build`, `npm run test:run`, `node scripts/validateCase.mjs`.

- [ ] **Step 4: Verify**

Run: `ls docs/*.md` → expected exactly: `README.md architecture.md content-authoring.md engine-reference.md status.md Gaslight_&_Grimoire_design.md`.
Confirm every link in `README.md` resolves: `grep -oE "\]\(\./[^)]+\)" docs/README.md` and check each target exists.

- [ ] **Step 5: Commit**

```bash
git add docs/status.md docs/README.md
git commit -m "docs: add status.md and README.md (current state + doc map)"
```

---

## Task 6: Delete the old docs

**Files:**
- Delete: `devdocs/` (entire tree), `GAME_DESIGN_ANALYSIS.md`, `AUDIO_ASSET_LIST.md`.

- [ ] **Step 1: Confirm the new docs exist before deleting the old ones**

Run: `ls docs/README.md docs/architecture.md docs/engine-reference.md docs/content-authoring.md docs/status.md`
Expected: all five listed, no "No such file" error. Do not proceed if any is missing.

- [ ] **Step 2: Delete**

```bash
git rm -r devdocs
git rm GAME_DESIGN_ANALYSIS.md AUDIO_ASSET_LIST.md
```
Expected: git lists the removed files.

- [ ] **Step 3: Verify nothing else references the deleted files (outside docs we'll fix next)**

Run: `grep -rn "GAME_DESIGN_ANALYSIS\|AUDIO_ASSET_LIST" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" -l | grep -v "docs/superpowers/"`
Expected: only `CLAUDE.md` (fixed in Task 7). If anything else appears, note it for Task 7.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: remove old devdocs tree and stray root docs"
```

---

## Task 7: Strip `Req X.Y` references from source

**Files:**
- Modify: the ~37 files listed by `grep -rlE "Req [0-9]" src` (see fact block).

This task edits comments and test labels only. **No assertion, control-flow, or runtime change.** Work file-by-file; do not use a single blind repo-wide regex (risk of mangling multi-item lists or leaving dangling punctuation). The three shapes and their fixes are defined in the fact block.

- [ ] **Step 1: List the files to edit**

Run: `grep -rlE "Req [0-9]" src | sort`
Expected: 37 files (the list in the fact block).

- [ ] **Step 2: Edit each file**

For each file, apply the shape-appropriate fix to every `Req` line:
- **Whole-line comment** (`* Req 5.1–5.7`, `// Req 9.2`): delete the entire line. If it leaves an empty JSDoc block (`/**` immediately followed by `*/`), remove the now-empty block too.
- **Trailing parenthetical** (`… (Req 10.6)` at end of a comment or a test label string): remove ` (Req …)` including the single leading space; keep everything before it. E.g. `describe('AbilityButton — used state (Req 15.6)', …)` → `describe('AbilityButton — used state', …)`; `// Encounter extensions (Req 9)` → `// Encounter extensions`.
- **Mid-line reference inside prose** (rare — e.g. `Maps suspicion tier names to numeric ranges (Req 8.3–8.6)`): treat as trailing parenthetical (strip the ` (Req …)`).

Do this with the Edit tool per occurrence, reading each file first. Preserve indentation and surrounding comment structure.

- [ ] **Step 3: Verify no references remain and nothing broke syntactically**

Run: `grep -rnE "Req [0-9]" src` → expected: **no output**.
Run: `grep -rn "()" src | grep -E "describe\(''|it\(''" ` → expected: no output (guards against an over-eager strip that emptied a label). If a test label became empty or malformed, fix it.
Run: `npx tsc --noEmit` → expected: no new errors (comment-only edits shouldn't affect types; a failure means a code line was damaged).

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "chore: remove orphaned Req X.Y references from comments and test labels"
```

---

## Task 8: Verify tests unchanged (the behavior gate)

**Files:** none (verification only).

- [ ] **Step 1: Run the full suite**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files  29 passed (29)` and `Tests  334 passed (334)` — **identical to Task 1's baseline**.

- [ ] **Step 2: If the count changed, stop and diagnose**

A changed passing count means the strip altered behavior (it must not). Use `git diff HEAD~1 -- src` to find the damaged file, fix it, re-run. Do not proceed until the count matches the baseline.

- [ ] **Step 3: Confirm content still validates**

Run: `node scripts/validateCase.mjs` → expected: `All 7 case(s) validated successfully.`

- [ ] **Step 4: No commit** (verification only; any fix committed in its own step).

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (the "Deep Documentation (devdocs/)" section ~lines 7–51; the stale-count line ~289; any other `devdocs/` mentions).

- [ ] **Step 1: Find every reference to update**

Run: `grep -nE "devdocs|GAME_DESIGN_ANALYSIS|AUDIO_ASSET_LIST|334 tests across 29 files" CLAUDE.md`
Expected: the big documentation section, the "Known Bugs & Gaps" line citing `devdocs/evolution/gap_analysis.md` and `GAME_DESIGN_ANALYSIS.md`, the roadmap line citing `devdocs/evolution/implementation_roadmap.md`, and the test-count line.

- [ ] **Step 2: Rewrite the documentation section**

Replace the entire "## Deep Documentation (devdocs/)" section (and its many sub-bullets) with a compact "## Documentation (docs/)" section:

```markdown
## Documentation (docs/)

Project docs live under `docs/`. Read the relevant one before significant changes:

- `docs/README.md` — orientation and doc map (start here)
- `docs/architecture.md` — component hierarchy, store slices, engine modules, data flow, cross-slice couplings
- `docs/engine-reference.md` — per-module engine API (signatures + behavior)
- `docs/content-authoring.md` — case/vignette JSON schemas, Condition/Effect catalogs, validation, audio asset reference
- `docs/status.md` — current state: systems present, content inventory, test baseline
- `docs/Gaslight_&_Grimoire_design.md` — the original design bible (vision, world, mechanics, narrative intent)
```

- [ ] **Step 3: Fix the remaining stray references**

- The "Known Bugs & Gaps" intro line that cites `devdocs/evolution/gap_analysis.md` and `GAME_DESIGN_ANALYSIS.md`: repoint to `docs/status.md`. Keep the live test-baseline sentence but ensure the number reads `334 tests across 29 files` (matching Task 8).
- The "Implementation Roadmap" line citing `devdocs/evolution/implementation_roadmap.md`: since the roadmap docs are gone, either remove that pointer or repoint to `docs/status.md`. (The phased A–E history can remain as prose in CLAUDE.md; just drop the dead path.)
- Any other `devdocs/...` path: remove or repoint to the matching new doc.

- [ ] **Step 4: Verify no dead references remain**

Run: `grep -nE "devdocs|GAME_DESIGN_ANALYSIS|AUDIO_ASSET_LIST" CLAUDE.md`
Expected: **no output**.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: repoint CLAUDE.md at rebuilt docs/ set"
```

---

## Task 10: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: No dead paths anywhere in the repo**

Run: `grep -rnE "devdocs/" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" | grep -v "docs/superpowers/"`
Expected: no output (the spec/plan under `docs/superpowers/` may reference `devdocs/` historically — that's fine and is excluded).

Run: `grep -rn "GAME_DESIGN_ANALYSIS\|AUDIO_ASSET_LIST" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.yml" | grep -v "docs/superpowers/"`
Expected: no output.

- [ ] **Step 2: No Req references in source**

Run: `grep -rnE "Req [0-9]" src`
Expected: no output.

- [ ] **Step 3: Docs directory is exactly the intended set**

Run: `ls docs/*.md`
Expected: `Gaslight_&_Grimoire_design.md README.md architecture.md content-authoring.md engine-reference.md status.md`.
Run: `test ! -d devdocs && echo "devdocs gone"` → expected: `devdocs gone`.

- [ ] **Step 4: Tests + content still green**

Run: `npx vitest run 2>&1 | tail -3` → expected: `334 passed (334)`.
Run: `node scripts/validateCase.mjs` → expected: `All 7 case(s) validated successfully.`

- [ ] **Step 5: Confirm working tree is clean and committed**

Run: `git status --short` → expected: no output (everything committed).
Run: `git log --oneline -9` → expected: the task commits from this plan.

---

## Self-Review Notes

- **Spec coverage:** §3 doc set → Tasks 2–5; §4 accuracy discipline → verification steps in every write task; §5 Req strip → Tasks 7–8; §6 CLAUDE.md → Task 9; §7 kept-untouched (design bible, src logic, content) → not deleted anywhere, guarded by Task 6 Step 1 and Task 8 gate; §8 execution order → Tasks 1→10 mirror it; §9 success criteria → Task 10.
- **Behavior safety:** the only code change (Task 7) is gated by an unchanged 334/29 test count (Task 8) and `tsc --noEmit`.
- **Ordering safety:** old docs (Task 6) are deleted only after new docs are written and confirmed present (Task 6 Step 1).
