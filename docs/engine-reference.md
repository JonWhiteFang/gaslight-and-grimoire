# Engine Reference

Per-module API reference for `src/engine/`. Every signature and behaviour claim
below is drawn from the current source. Each non-test module gets one `##`
section, plus a Determinism note.

> **`narrativeEngine.ts` is a barrel, not a module (F-019).** It was split into
> four focused modules — `contentLoader`, `conditions`, `choiceResolution`, and
> `encounters` — and now only re-exports their full surface
> (`export * from './contentLoader'`, etc.), so every existing
> `import { X } from '.../narrativeEngine'` continues to resolve unchanged. The
> four sections below document those modules directly; import from either the
> barrel or the specific module.

See [architecture.md](./architecture.md) for the engine↔store boundary, the
store slices, data flow, bounded-state clamping, and the full determinism
verification block. This document does not repeat those; it focuses on the
per-function API surface.

> **Navigation side-effect — read before calling `processChoice`.**
> `processChoice(choice, state, actions)` calls `actions.goToScene(nextSceneId)`
> **before it returns** its `ChoiceResult`. By the time you hold the result, the
> store has already navigated (and any dice overlay is shown *after* the scene
> changed). When you need the outcome without side effects — testing, preview,
> or computing before deciding — call the pure **`computeChoiceResult(choice,
> state)`** instead; it performs the identical ability-auto-succeed / dice /
> advantage / DC logic and returns the same `ChoiceResult` with no store access.
> `startEncounter` and `processEncounterChoice` likewise mutate through
> `actions` (composure/vitality/NPC deltas, and `goToScene` when the encounter
> completes).

## Determinism

`rollD20` and `hintEngine`'s dwell tracking call `Math.random()` / `Date.now()`
directly and are not injectable; tests work around this. (`buildDeduction`'s id
is now a pure function of the sorted clue set — Phase 2b removed its
`Date.now()`/`Math.random()` call.) The exact call sites (`file:line`) and the
"zero store imports in engine" verification are in the Determinism and
Verification sections of [architecture.md](./architecture.md).

---

## diceEngine.ts

Pure dice math: d20 rolls, faculty modifiers, DC resolution, and outcome tiers.

**Types**

- `interface RollResult { roll1: number; roll2: number; result: number }` — the two raw d20 rolls and the selected result (used by advantage/disadvantage).
- `interface CheckResult { roll: number; modifier: number; total: number; dc?: number; tier: OutcomeTier }` — the resolved outcome of a full check.

**Functions**

- `rollD20(): number` — returns a random integer in `[1, 20]`.
- `rollWithAdvantage(): RollResult` — rolls 2d20 and keeps the higher (`Math.max`).
- `rollWithDisadvantage(): RollResult` — rolls 2d20 and keeps the lower (`Math.min`).
- `calculateModifier(facultyScore: number): number` — the faculty modifier, `Math.floor((facultyScore - 10) / 2)`.
- `getTrainedBonus(faculty: Faculty, archetype: Archetype): number` — `+1` when `faculty` is the archetype's primary faculty, else `0`. Primary map: deductionist→reason, occultist→lore, operator→vigor, mesmerist→influence.
- `resolveCheck(roll: number, modifier: number, dc: number): OutcomeTier` — maps a roll to a tier: natural 20 → `critical`, natural 1 → `fumble`, else `total = roll + modifier`: `total >= dc` → `success`, `total >= dc - 3` → `partial`, otherwise `failure`.
- `resolveDC(choice: Choice, investigator: Investigator): number` — the effective DC. If `choice.dynamicDifficulty` is set, returns `highDC` when the investigator's `scaleFaculty` score `>= highThreshold`, else `baseDC`. Otherwise `choice.difficulty ?? 12`.
- `isFacultyCheck(choice: Choice): choice is Choice & { faculty: Faculty }` — the **single source of truth** for "will the engine roll a d20 for this choice?": `choice.faculty != null && (choice.difficulty !== undefined || choice.dynamicDifficulty != null)`. A type guard so callers narrow `choice.faculty` to non-null. Gates **both** the roll (`resolveCheckOutcome`), the content validator's check detection, and the pre-roll odds UI (`ChoiceCard`/`ChoicePanel`/`EncounterPanel`), so the "is a check" question can't drift between engine and UI (Phase 3 T6b).
- `performCheck(faculty: Faculty, investigator: Investigator, dc: number, hasAdvantage: boolean, hasDisadvantage: boolean): CheckResult` — the full pipeline. Advantage and disadvantage cancel (if both true, a straight `rollD20`); otherwise rolls with the active edge. Modifier is `calculateModifier(score) + getTrainedBonus(...)`. Returns the roll, modifier, total, `dc`, and resolved `tier`.

## contentLoader.ts

Async JSON content loading (under `/content/`, prefixed with
`import.meta.env.BASE_URL`) plus load-time validation. Re-exported by the
`narrativeEngine` barrel.

- `fetchManifest(): Promise<CaseManifest>` — fetches `/content/manifest.json`.
- `loadCase(caseId: string): Promise<CaseData>` — fetches `meta.json`, `act1/2/3.json`, `clues.json`, `npcs.json`, `variants.json` in parallel; indexes scenes/clues/npcs into `Record<string, T>` by id; injects the shared `breakdown` and `incapacitation` scenes. Also fetches the optional `deductions.json` (**outside** the parallel batch, `.catch(() => [])`) into `CaseData.recipes` (`KeyDeduction[]`) — a case without key deductions simply has an empty list.
- `loadVignette(vignetteId: string): Promise<VignetteData>` — same shape for a two-act vignette (single `scenes.json`), also injecting the shared scenes.
- `validateContent(caseData: CaseData): ValidationResult` — delegates to the shared `contentValidation.validateBundle` (errors only; reachability is CLI-only). Checks scene-graph edges, clue/npc references, condition targets, variant structure, `npcEffect` refs, encounter-round edges, and tier completeness (incl. `dynamicDifficulty`). Logs each error via `console.error`; returns `{ valid, errors }`. See the `contentValidation.ts` section below.
- (internal `loadSharedScenes` — module-cached, so the breakdown/incapacitation scenes are fetched at most once and reused across loads, F-047 — plus `mergeSharedScenes`, `fetchJson`, `indexById` are not exported. A `_resetSharedScenesCache` test hook clears the cache.)

## conditions.ts

Pure condition evaluation, scene/variant resolution, and clue-discovery gating.
Re-exported by the `narrativeEngine` barrel.

- `evaluateConditions(conditions: Condition[], state: GameState): boolean` — AND logic; empty array is `true`. Supports `hasClue` (must be revealed), `hasDeduction`, `hasFlag` (bare = flag is truthy; with `value`, compares `Boolean(flag) === value`, so `value:false` matches an unset flag), `facultyMin`, `archetypeIs`, `npcDisposition` (`>=`), `npcSuspicion` (tier→range: normal 0–2, evasive 3–5, concealing 6–8, hostile 9–10), `factionReputation` (`>=`), `npcMemoryFlag`.
- `evaluateCondition(condition: Condition, state: GameState): boolean` — the single-condition primitive `evaluateConditions` folds over (a module-internal helper; `evaluateConditions` is the exported entry point). `Condition` is a discriminated union on `type`, so the switch is exhaustive (F-026).
- `resolveScene(sceneId: string, state: GameState, caseData: CaseData): SceneNode` — returns the first variant whose `variantOf === sceneId` and whose `variantCondition` is met, else the base scene. Throws if the base scene is missing.
- `canDiscoverClue(discovery: ClueDiscovery, state: GameState): boolean` — pure gate: `requiresFaculty` (score `>=` minimum) and `requiresDeduction` (deduction must exist) must both pass.

## choiceResolution.ts

Pure choice-outcome computation plus the impure `processChoice` action.
Re-exported by the `narrativeEngine` barrel.

- `resolveCheckOutcome(choice: Choice, state: GameState, label?: string): { result: ChoiceResult; consumedAbilityFlag?: string }` — **pure**, no store access. The **shared check-resolution unit** both `computeChoiceResult` and `processEncounterChoice` call, so the two check paths cannot drift (F-107). For a faculty check with a difficulty (or `dynamicDifficulty`): if the archetype ability auto-succeed flag for that faculty is set (`abilityAutoSucceedFlag(faculty)` → `ability-auto-succeed-{reason,vigor,influence}`), returns `critical` with no roll **and sets `consumedAbilityFlag`** so the impure caller clears it; otherwise resolves the DC (`resolveDC`), grants advantage via `computeAdvantage` (a revealed `advantageIf` clue, or active Veil Sight on a `lore` check), runs `performCheck`, and returns the tier's next scene plus roll data. Non-check choices return the `success` (fallback `critical`) outcome at tier `success`; a non-check choice with **neither** `success` nor `critical` throws (nowhere to navigate — F-022; `label` shapes the message, `Choice` vs `Encounter choice`).
- `computeChoiceResult(choice: Choice, state: GameState): ChoiceResult` — **pure**, no store access. A thin wrapper returning just the `result` of `resolveCheckOutcome` (the ability-flag consumption it signals is applied by the impure `processChoice`).
- `processChoice(choice: Choice, state: GameState, actions: EngineActions): ChoiceResult` — impure wrapper over `resolveCheckOutcome`. When the auto-succeed ability fired, **consumes it** via `actions.setFlag(consumedAbilityFlag, false)` so the once-per-case ability works exactly once (F-101). On a `critical` faculty result, calls `actions.setLastCriticalFaculty(choice.faculty)` (the reward faculty is the typed `investigator.lastCriticalFaculty` field, not a flag — F-013). Applies `choice.npcEffect` (`adjustDisposition`/`adjustSuspicion`). **Calls `actions.goToScene(result.nextSceneId)` before returning** — see the callout above.

## encounters.ts

Multi-round encounter setup and processing. Re-exported by the `narrativeEngine`
barrel.

- `startEncounter(encounterId: string, rounds: EncounterRound[], isSupernatural: boolean, state: GameState, actions: EngineActions): EncounterState` — for supernatural encounters, performs a reaction check at DC 12 using the higher of Nerve or Lore (Nerve on a tie). On failure, reduces composure by 1–2 and replaces round 1's first choice with its `worseAlternative` (when present). Returns an `EncounterState` (`currentRound: 0`, `reactionCheckPassed` = `null` for mundane).
- `processEncounterChoice(choice: Choice, encounterState: EncounterState, state: GameState, actions: EngineActions): { encounterState: EncounterState; result: ChoiceResult }` — **escape paths (`isEscapePath`) are terminal**: they navigate to their `success`/`critical` outcome and mark the encounter `isComplete` immediately, before the round-advance logic, applying no damage (F-004). Otherwise resolves the check through the **shared `resolveCheckOutcome`** (the same unit `processChoice` uses, F-107) — so encounters honour the archetype auto-succeed ability (**consumed on use** via `actions.setFlag`, F-101), dynamic-difficulty DCs, and advantage (a revealed `advantageIf` clue or active Veil Sight on a `lore` check). On failure/fumble applies `choice.encounterDamage`: **supernatural = dual-axis** (both composure and vitality); **mundane = single axis** (composure if set, else vitality). Calls `actions.setLastCriticalFaculty` on critical, applies `npcEffect`, advances `currentRound`, marks `isComplete` when rounds are exhausted, and calls `goToScene` once complete.
- `getEncounterChoices(round: EncounterRound, state: GameState): Choice[]` — filters a round's choices by their derived conditions (`requiresClue`/`requiresDeduction`/`requiresFlag`/`requiresFaculty`); escape-path choices (`isEscapePath`) are included whenever their conditions are met. (Advantage is applied where it matters — the roll in `processEncounterChoice`; the former no-consumer `_hasAdvantage` annotation was removed — F-027.)

## advantage.ts

- `computeAdvantage(choice: Choice, state: GameState): boolean` — the **single source of truth** for whether a check rolls with advantage (F-014). Two grants OR'd together: any of the choice's `advantageIf` clue IDs is revealed, **or** a `lore` check while the Veil Sight flag (`FLAGS.veilSight`) is active. Used by regular checks (`computeChoiceResult`), encounter checks (`processEncounterChoice`), and the UI Advantage badge (via the parents that hold `GameState`), so all three agree.

## checkOdds.ts

Pure pre-roll odds classifier — turns a faculty check into a diegetic "Prospects" band and an accessible-name phrase, for the Phase 3 dice-legibility UI. No RNG, no `Date.now`. Consumed by `ChoiceCard`, `ChoicePanel`, `EncounterPanel`, and `SceneCluePrompts` (never by the engine's roll path — it only *describes* odds, it doesn't resolve them).

- `type ProspectsBand = 'favourable' | 'uncertain' | 'forbidding'`.
- `interface CheckOdds { faculty; modifier; dc; hasAdvantage; hasDisadvantage; autoSucceeds; band }`.
- `computeCheckOdds(args: { faculty, investigator, dc, hasAdvantage, hasDisadvantage, autoSucceeds, partialCountsAsSuccess }): CheckOdds` — modifier via `calculateModifier + getTrainedBonus` (matches the real roll). Success probability `p = clamp((21 - needed) / 20, 1/20, 19/20)` where `needed = (partialCountsAsSuccess ? dc - 3 : dc) - modifier` — the clamp encodes nat-1-always-fails / nat-20-always-succeeds. Advantage folds `pEff = 1 - (1 - p)²`, disadvantage `pEff = p²`, both-true cancels. Band thresholds: `pEff >= 0.65` favourable, `>= 0.35` uncertain, else forbidding. `autoSucceeds` short-circuits to `band: 'favourable'` (the guaranteed-critical case). **`partialCountsAsSuccess` is surface-dependent**: `false` on `Choice`-based checks (partial routes to a distinct outcome), `true` on scene clue-check prompts (a partial tier still discovers the clue) — enacts spec §3.1 / §4.2.
- `describeCheckOdds(odds: CheckOdds): string` — the screen-reader phrase, e.g. `"Reason check, modifier +2, difficulty 14, prospects uncertain, advantage"`, or `"Reason check, assured success"` when `autoSucceeds`. Parents append this to their **own button `aria-label`** (the visual `CheckOddsTag` is `aria-hidden`, since a button's explicit label overrides descendant text).

## contentValidation.ts

Pure content validator shared by the runtime `validateContent` and the CLI (`scripts/validateCase.ts` via `vite-node`), so the two can't drift. Operates on an in-memory `ContentBundle` (arrays of scenes/variants/clues/npcs + `firstScene` + `sharedSceneIds`), independent of how content was loaded.

- `validateBundle(bundle: ContentBundle, options?: { includeReachability?: boolean }): { errors: string[]; warnings: string[] }` — errors: choice-outcome edges (base/variant/shared ids valid), `requiresClue`/`advantageIf`/`cluesAvailable`/`onEnter` discoverClue clue refs, `onEnter` npc refs, `npcEffect.npcId` (incl. inside encounter rounds and `worseAlternative`), condition targets (clue/npc/faculty/archetype/faction/suspicion-tier allowlists; `hasFlag value:false` allowed), variant `variantOf`+`variantCondition` presence, encounter-round edge + tier recursion, tier completeness (fixed **or** `dynamicDifficulty`), `clue.sceneSource`, and **key-deduction recipes** (`KeyDeduction.requiredClues` clue refs, plus `choice.requiresDeduction` and `hasDeduction`-condition targets against the recipe-id registry — a gate pointing at an undefined recipe is an error). With `includeReachability`, warns on scenes unreachable from `firstScene` and clues no reachable scene can discover, and **errors** when a clue required by a *gated* key deduction (referenced by `requiresDeduction`/`hasDeduction`/`ClueDiscovery.requiresDeduction`) is only obtainable on a `critical`-tier scene edge — i.e. the gated content would be reachable only by a lucky roll (F-102).
- `computeReachableScenes(bundle: ContentBundle): Set<string>` — BFS from `firstScene` over all choice + encounter outcome edges.
- `computeNonCriticalReachableScenes(bundle: ContentBundle): Set<string>` — BFS like `computeReachableScenes` but excludes edges reachable *only* via a check's `critical` tier; used by the F-102 gated-deduction reachability error.
- `computeMaxDisposition(bundle: ContentBundle, npcId: string): number` — start disposition + every positive reachable disposition delta (onEnter + `npcEffect`); used to check whether a disposition-gated vignette threshold is attainable.

## buildDeduction.ts

Pure builders for `Deduction`s, plus the key-deduction recipe matcher.

- `buildDeduction(clueIds: string[], clues: Record<string, Clue>): Deduction` — sets `isRedHerring: true` if any connected clue is of type `redHerring`. Builds a `description` from clue titles (`"Connection: A ↔ B"`, or `"Questionable connection: ..."` when a red herring; 3+ titles are comma-joined with a trailing "and"). **The id is a canonical stable signature** `` `deduction-generic-${[...clueIds].sort().join('+')}` `` (Phase 2b, N5) — re-forming the same set upserts one deduction (`addDeduction` keys by id), so the Journal never inflates. No `Date.now()`/`Math.random()`. Safe because clue ids are validated `^[a-z0-9-]+$` (no `+`), so the signature can't collide, and the `deduction-generic-` namespace is reserved against authored recipe ids by the content validator.
- `matchDeduction(connectedIds: string[], recipes: KeyDeduction[]): KeyDeduction | null` — **subset** match: returns the first recipe whose `requiredClues` are all present in `connectedIds` (extra connected clues allowed), else `null`. Empty recipes or empty set → `null` (vignette-safe). Pure. (Superseded on the board by `deductionOracle.classifyBoard`, which matches **all** recipes per component; retained for any single-recipe callers.)
- `buildDeductionFromRecipe(recipe: KeyDeduction, _connectedIds: string[]): Deduction` — builds a `Deduction` stored under the recipe's **stable authored id** (so `hasDeduction`/`requiresDeduction` gates resolve), with the recipe's `description`/`isRedHerring` and `clueIds` = the recipe's `requiredClues`. `EvidenceBoard` forms one per matched recipe in a qualifying component.

## deductionOracle.ts

Pure classification of the evidence board's player-connected components (Phase 2b — enacts
[ADR-0012](DECISIONS/ADR-0012-deduction-roll-semantics.md)). No store/React access; no
`Date.now()`/`Math.random()`.

- `classifyBoard(connections: ClueConnection[], clues: Record<string, Clue>, recipes: KeyDeduction[]): ClassifiedComponent[]` —
  1. **Fail-closed** filter: keep only edges whose *both* endpoints are own-property (`hasOwnProperty` guard), revealed clues; drop self-edges and edges into missing/unrevealed/inherited (`toString`) ids.
  2. **Union-find** over the surviving edges → connected components; a component with `< 2` distinct clues is dropped (forms nothing).
  3. **Classify** each component (size ≥ 2) into `DeductionCorrectness = 'correct' | 'false' | 'partial' | 'incorrect'`:
     - **Recipe path** — every recipe whose `requiredClues ⊆ S` (matched against the **player's topology**, never `connectsTo` — 2 of 7 shipped recipes aren't `connectsTo`-connected). `correct` if any matched recipe is non-red-herring, else `false`. `recipes` carries **all** matches (Blocker 1), ordered for presentation only (non-red-herring → most required → lowest id).
     - **Generic path** (no recipe matched — the only path for vignettes) — classify the component's player-edges against **undirected** `connectsTo`: all authored → `correct` (or `false` if the cluster contains a `redHerring` clue, N4); some authored → `partial`; none → `incorrect`. `recipes: []`.
  `correct`/`false` components form deductions; `partial`/`incorrect` form nothing. The roll never enters this function — it only flavours the banner copy of a formed `correct` result (ADR-0012).

## caseProgression.ts

End-of-case logic: faculty bonus and vignette unlocks.

- `interface CaseCompletionResult { facultyBonusGranted: Faculty | null; vignettesUnlocked: string[] }`.
- `CaseProgression.completeCase(caseId: string, state: GameState, actions: EngineActions): CaseCompletionResult` — grants `+1` to the faculty stored in the typed `investigator.lastCriticalFaculty` field (F-013; when set), then checks vignette unlocks and sets the `vignette-unlocked-{id}` flag (`vignetteUnlockedFlag(id)` from `flags.ts`) for **every** newly-unlocked vignette (F-057). Returns what was granted/unlocked.
- `CaseProgression.checkVignetteUnlocks(state: GameState): string[]` — returns the ids of **every** not-yet-unlocked vignette whose condition is met (F-057, so simultaneously-earned unlocks all fire). Registered conditions: `a-matter-of-shadows` (Lamplighters reputation ≥ 2), `the-rationalists-dilemma` (Rationalists Circle reputation ≥ 2), `the-debt-of-smoke` (persisted flag `wc-court-deal-made`), `the-unfinished-case` (flag `wc-case-complete`).
- `CaseProgression.grantFacultyBonus(faculty: Faculty, actions: EngineActions): void` — `actions.updateFaculty(faculty, min(20, current + 1))`.

## hintEngine.ts

Stateful singleton tracking player activity to surface escalating hints. State
lives in a module-level variable (not the store).

**Types**

- `type HintEvent = { type: 'boardVisit' } | { type: 'connectionAttempt' } | { type: 'sceneChange' }`.
- `type HintLevel = 1 | 2 | 3`.
- `interface HintContent { level: HintLevel; text: string }`.
- `interface HintEngineState { boardVisitCount: number; connectionAttemptCount: number; sceneEntryTime: number; lastHintLevelShown: HintLevel | null }`.

**Functions**

- `trackActivity(event: HintEvent): void` — `boardVisit` increments the visit count; `connectionAttempt` increments attempts and resets the board-visit count; `sceneChange` resets all tracking (`resetForScene`).
- `shouldShowHint(hintsEnabled: boolean): boolean` — `false` when hints are disabled. Otherwise triggers on **3+ board visits with zero connection attempts** OR **≥ 5 minutes** elapsed on the current scene.
- `getHint(level: HintLevel, gameState: GameState): HintContent` — returns hint text for the level: 1 = narrative nudge, 2 = specific clue-pair suggestion (from revealed clues with `connectsTo`), 3 = direct reveal. **Level 3 is gated behind Level 2** — requesting 3 before 2 has been shown returns the Level 2 hint. Records the highest level shown.
- `resetForScene(): void` — clears counters, stamps `sceneEntryTime = Date.now()`, resets `lastHintLevelShown`.
- `_getState(): Readonly<HintEngineState>` — test hook; returns a copy of internal state.
- `_setState(partial: Partial<HintEngineState>): void` — test hook; merges into internal state.

## saveManager.ts

localStorage persistence with versioned migrations. Keys: `gg_save_{saveId}`;
index at `gg_save_index` (array of `SaveSummary`, sorted by timestamp desc).

> Note: the **10-manual-save cap** and the reserved **`'autosave'`** slot live in
> `metaSlice` (`saveGame` / `autoSave`), not in `SaveManager`. `SaveManager` also
> calls neither `Date.now()` nor `Math.random()`; the save id is generated in
> `metaSlice`.

- `const CURRENT_SAVE_VERSION = 5`.
- `interface SaveSummary { id: string; timestamp: string; caseName: string; investigatorName: string }`.
- `SaveManager.save(saveId: string, state: GameState, caseTitle?: string): void` — wraps `state` in a `SaveFile` (`version`, ISO `timestamp`, `state`), writes it, and upserts the index entry (re-sorted desc). `caseTitle`, when supplied, becomes the summary's readable `caseName` (else it falls back to `state.currentCase`).
- `SaveManager.load(saveId: string): GameState | null` — reads and parses the save, runs `migrate`, returns the migrated `state` (or `null` if missing/unparseable).
- `SaveManager.listSaves(): SaveSummary[]` — returns the index.
- `SaveManager.deleteSave(saveId: string): void` — removes the save and its index entry.
- `SaveManager.migrate(saveFile: SaveFile): SaveFile` — idempotent upgrade to the current version (**5**). **v0→v1**: default `factionReputation` to `{}`. **v1→v2**: backfill `sceneHistory` and `connections` to `[]` (a missing `sceneHistory` otherwise crashes the first `goToScene` after load). **v2→v3**: backfill `visitedScenes` from `sceneHistory + currentScene`, so reloading a pre-v3 save doesn't re-fire `onEnter` on scenes already seen (F-006). **v3→v4**: default `encounterState` to `null`, so a pre-v4 save resumes as "not in an encounter" rather than restarting/re-rolling a mid-encounter reaction check (F-105). **v4→v5** (Phase 2b): `'connected'` is no longer a written clue status. The v4 bug overwrote a re-wired clue to `'connected'`, so a persisted deduction may still reference it — restore each `'connected'` clue to `'deduced'` if any persisted `deductions[*].clueIds` references it, else `'examined'` (no gate/Journal desync; an original `new`/`spent` overwritten to `connected` is a documented cosmetic loss). **Every-version load hygiene** (not just v4→v5): any `clue.status === 'contested'` → `'examined'` — `contested` is a 2 s transient with no owning timer after reload, so a save taken mid-attempt can't strand a clue. A malformed (non-plain-object) `clues` is left untouched so `isValidGameState` still rejects it (F-036).

## audioManager.ts

Howler.js SFX playback with lazily-cached `Howl` instances per event.

- `type SfxEvent` — one of: `'dice-roll'`, `'clue-physical'`, `'clue-testimony'`, `'clue-occult'`, `'clue-deduction'`, `'clue-redHerring'`, `'composure-decrease'`, `'vitality-decrease'`, `'scene-transition'`.
- `AudioManager.playSfx(event: SfxEvent, volume: number): void` — lazily creates/caches the `Howl` for the event, clamps volume to `[0, 1]`, and plays. Howler handles missing files silently; the 9 SFX assets ship under `public/audio/sfx/` (ambient loops and illustrations remain pending).
- `AudioManager.setMasterSfxVolume(volume: number): void` — sets clamped `[0, 1]` volume on every cached `Howl`.

## cluePrompts.ts

Atmospheric prompt text for exploration/check clue discovery.

- `getCluePromptText(type: ClueType, title: string, method: 'exploration' | 'check'): string` — returns a tone-appropriate prompt string keyed by clue `type` and discovery `method`. The `title` is woven into the text for physical (both modes), redHerring (both modes), and testimony (exploration only); occult and deduction use fixed atmospheric lines in both modes. Falls back to the physical exploration prompt for unknown types.

## effectMessages.ts

Pure conversion of `Effect` objects into player-facing feedback strings
(atmospheric text + mechanical annotation such as `(Composure -1)`).

- `generateEffectMessage(effect: Effect, npcs: Record<string, NPCState>): string | null` — returns `null` for `flag`, `discoverClue`, and `setMemoryFlag` (which surface their own feedback) and for effects with no `delta`. Otherwise appends a mechanical suffix (`(Composure +2)`, etc.). When `effect.description` is authored, it is used as the message text with the mechanical suffix still appended; otherwise an atmospheric message is generated per type (composure, vitality, disposition, suspicion, reputation), resolving NPC names from `npcs`.
- `generateEffectMessages(effects: Effect[], npcs: Record<string, NPCState>): string[]` — maps over the effects and drops the `null` results.

## flags.ts

Single source of truth for engine/progression flag string keys (F-018), so no
flag literal is duplicated across the engine and store.

- `const FLAGS` — the named engine flags: `breakdownOccurred` (`'breakdown-occurred'`), `incapacitated` (`'incapacitated'`), `veilSight` (`'ability-veil-sight-active'`).
- `abilityAutoSucceedFlag(faculty: Faculty): string | undefined` — the auto-succeed flag for a faculty, or `undefined` if that faculty has no ability (only `reason`/`vigor`/`influence` do).
- `checkAutoSucceeds(faculty: Faculty, flags: Record<string, boolean>): boolean` — `true` when the faculty has an auto-succeed ability **and** its flag is active. The shared predicate `resolveCheckOutcome` uses to short-circuit to a guaranteed `critical`, and the Phase-3 pre-roll odds UI uses to show the **"Assured"** treatment instead of dice odds — so a guaranteed check never displays ordinary probabilities (Phase 3 T1).
- `vignetteUnlockedFlag(vignetteId: string): string` — `` `vignette-unlocked-${vignetteId}` ``.
- `const CASE_LOAD_CLEARED_FLAGS: readonly string[]` — the flags wiped when a new case/vignette starts (breakdown/incapacitation, the three auto-succeed flags, veil sight). The former `last-critical-faculty` flag is **gone** — the reward is now the typed `investigator.lastCriticalFaculty` field, reset directly in the load actions (F-013).
- `const ARCHETYPE_ABILITY_FLAG: Record<Archetype, string>` — each archetype's ability flag (deductionist→auto-succeed-reason, occultist→veil-sight, operator→auto-succeed-vigor, mesmerist→auto-succeed-influence). Set by `App` when the once-per-case ability is activated.

## constants.ts

- `const FACTIONS: ReadonlySet<string>` — the four faction names (Rationalists Circle, Hermetic Order of the Grey Dawn, Lamplighters, Court of Smoke); used for validation allowlists.
- `const OUTCOME_TIERS` — `['critical', 'success', 'partial', 'failure', 'fumble']`, typed `satisfies readonly OutcomeTier[]`.
- `assertNever(x: never): never` — compile-time exhaustiveness guard for `switch` statements (throws at runtime if reached).

## haltScenes.ts

Identifies the shared "investigation halted" terminal scenes so a knockout
(0 Composure/Vitality) is not mislabelled "Case Complete" (F-011, issue #9).

- `type HaltReason = 'composure' | 'vitality'`.
- `const HALT_SCENE_IDS = ['breakdown', 'incapacitation']` — the canonical shared halt-scene ids.
- `isHaltScene(scene: SceneNode | null | undefined): boolean` — true when the scene is a breakdown/incapacitation scene, resolving case-specific variants via `variantOf` (e.g. `wc-breakdown` → `breakdown`).
- `haltReason(scene): HaltReason | null` — `breakdown` → `composure`, `incapacitation` → `vitality`, else `null`.

## engineActions.ts

The action interface that impure engine functions receive instead of importing
the store — this is what breaks the engine→store circular dependency (see
[architecture.md](./architecture.md)).

- `interface EngineActions` declares: `adjustComposure(delta)`, `adjustVitality(delta)`, `setFlag(key, value: boolean | string)`, `setLastCriticalFaculty(faculty: Faculty)` (writes the typed `investigator.lastCriticalFaculty` reward field — F-013), `adjustDisposition(npcId, delta)`, `adjustSuspicion(npcId, delta)`, `adjustReputation(faction, delta)`, `discoverClue(clueId)`, `goToScene(sceneId)`, `updateFaculty(faculty, value)`, and a read-only `investigator: Investigator`. The store's slice actions satisfy this shape at call sites.
