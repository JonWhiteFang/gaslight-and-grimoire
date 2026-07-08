# Engine Reference

Per-module API reference for `src/engine/`. Every signature and behaviour claim
below is drawn from the current source. Ten non-test modules are documented, one
`##` section each, plus a Determinism note.

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

`rollD20`, `buildDeduction`'s id, and `hintEngine`'s dwell tracking call
`Math.random()` / `Date.now()` directly and are not injectable; tests work
around this. The exact call sites (`file:line`) and the "zero store imports in
engine" verification are in the Determinism and Verification sections of
[architecture.md](./architecture.md).

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
- `performCheck(faculty: Faculty, investigator: Investigator, dc: number, hasAdvantage: boolean, hasDisadvantage: boolean): CheckResult` — the full pipeline. Advantage and disadvantage cancel (if both true, a straight `rollD20`); otherwise rolls with the active edge. Modifier is `calculateModifier(score) + getTrainedBonus(...)`. Returns the roll, modifier, total, `dc`, and resolved `tier`.

## narrativeEngine.ts

Content loading, condition evaluation, scene/variant resolution, clue-discovery
gating, choice processing, and the encounter system.

**Content loading** (async; fetch JSON under `/content/`, prefixed with `import.meta.env.BASE_URL`)

- `fetchManifest(): Promise<CaseManifest>` — fetches `/content/manifest.json`.
- `loadCase(caseId: string): Promise<CaseData>` — fetches `meta.json`, `act1/2/3.json`, `clues.json`, `npcs.json`, `variants.json` in parallel; indexes scenes/clues/npcs into `Record<string, T>` by id; injects the shared `breakdown` and `incapacitation` scenes. Also fetches the optional `deductions.json` (**outside** the parallel batch, `.catch(() => [])`) into `CaseData.recipes` (`KeyDeduction[]`) — a case without key deductions simply has an empty list.
- `loadVignette(vignetteId: string): Promise<VignetteData>` — same shape for a two-act vignette (single `scenes.json`), also injecting the shared scenes.
- (internal `injectSharedScenes` merges `/content/shared/breakdown.json` and `/content/shared/incapacitation.json` into the scene record — not exported.)

**Validation**

- `validateContent(caseData: CaseData): ValidationResult` — delegates to the shared `contentValidation.validateBundle` (errors only; reachability is CLI-only). Checks scene-graph edges, clue/npc references, condition targets, variant structure, `npcEffect` refs, encounter-round edges, and tier completeness (incl. `dynamicDifficulty`). Logs each error via `console.error`; returns `{ valid, errors }`. See the `contentValidation.ts` section below.

**Conditions & scene resolution** (pure)

- `evaluateConditions(conditions: Condition[], state: GameState): boolean` — AND logic; empty array is `true`. Supports `hasClue` (must be revealed), `hasDeduction`, `hasFlag` (bare = flag is truthy; with `value`, compares `Boolean(flag) === value`, so `value:false` matches an unset flag), `facultyMin`, `archetypeIs`, `npcDisposition` (`>=`), `npcSuspicion` (tier→range: normal 0–2, evasive 3–5, concealing 6–8, hostile 9–10), `factionReputation` (`>=`), `npcMemoryFlag`.
- `resolveScene(sceneId: string, state: GameState, caseData: CaseData): SceneNode` — returns the first variant whose `variantOf === sceneId` and whose `variantCondition` is met, else the base scene. Throws if the base scene is missing.
- `canDiscoverClue(discovery: ClueDiscovery, state: GameState): boolean` — pure gate: `requiresFaculty` (score `>=` minimum) and `requiresDeduction` (deduction must exist) must both pass.

**Choice processing**

- `computeChoiceResult(choice: Choice, state: GameState): ChoiceResult` — **pure**, no store access. For a faculty check with a difficulty: if the archetype ability auto-succeed flag for that faculty is set (`ability-auto-succeed-{reason,vigor,influence}`), returns `critical` with no roll; otherwise resolves the DC (`resolveDC`), grants advantage from a revealed `advantageIf` clue or from active Veil Sight on a `lore` check (`ability-veil-sight-active`), runs `performCheck`, and returns the tier's next scene plus roll data. Non-check choices return the `success` (fallback `critical`) outcome at tier `success`; a non-check choice with **neither** `success` nor `critical` throws (nowhere to navigate — F-022).
- `processChoice(choice: Choice, state: GameState, actions: EngineActions): ChoiceResult` — impure wrapper over `computeChoiceResult`. On a `critical` faculty result, sets the `last-critical-faculty` flag. Applies `choice.npcEffect` (`adjustDisposition`/`adjustSuspicion`). **Calls `actions.goToScene(result.nextSceneId)` before returning** — see the callout above.

**Encounters**

- `startEncounter(encounterId: string, rounds: EncounterRound[], isSupernatural: boolean, state: GameState, actions: EngineActions): EncounterState` — for supernatural encounters, performs a reaction check at DC 12 using the higher of Nerve or Lore (Nerve on a tie). On failure, reduces composure by 1–2 and replaces round 1's first choice with its `worseAlternative` (when present). Returns an `EncounterState` (`currentRound: 0`, `reactionCheckPassed` = `null` for mundane).
- `processEncounterChoice(choice: Choice, encounterState: EncounterState, state: GameState, actions: EngineActions): { encounterState: EncounterState; result: ChoiceResult }` — **escape paths (`isEscapePath`) are terminal**: they navigate to their `success`/`critical` outcome and mark the encounter `isComplete` immediately, before the round-advance logic, applying no damage (F-004). Otherwise runs the choice's faculty check (advantage from a revealed occult-type `advantageIf` clue, any revealed `advantageIf` clue, or active Veil Sight on a `lore` check). On failure/fumble applies `choice.encounterDamage`: **supernatural = dual-axis** (both composure and vitality); **mundane = single axis** (composure if set, else vitality). Sets `last-critical-faculty` on critical, applies `npcEffect`, advances `currentRound`, marks `isComplete` when rounds are exhausted, and calls `goToScene` once complete.
- `getEncounterChoices(round: EncounterRound, state: GameState): Choice[]` — filters a round's choices by their derived conditions (`requiresClue`/`requiresDeduction`/`requiresFlag`/`requiresFaculty`); escape-path choices (`isEscapePath`) are included whenever their conditions are met. (Advantage is applied where it matters — the roll in `processEncounterChoice`; the former no-consumer `_hasAdvantage` annotation was removed — F-027.)

## contentValidation.ts

Pure content validator shared by the runtime `validateContent` and the CLI (`scripts/validateCase.ts` via `vite-node`), so the two can't drift. Operates on an in-memory `ContentBundle` (arrays of scenes/variants/clues/npcs + `firstScene` + `sharedSceneIds`), independent of how content was loaded.

- `validateBundle(bundle: ContentBundle, options?: { includeReachability?: boolean }): { errors: string[]; warnings: string[] }` — errors: choice-outcome edges (base/variant/shared ids valid), `requiresClue`/`advantageIf`/`cluesAvailable`/`onEnter` discoverClue clue refs, `onEnter` npc refs, `npcEffect.npcId` (incl. inside encounter rounds and `worseAlternative`), condition targets (clue/npc/faculty/archetype/faction/suspicion-tier allowlists; `hasFlag value:false` allowed), variant `variantOf`+`variantCondition` presence, encounter-round edge + tier recursion, tier completeness (fixed **or** `dynamicDifficulty`), `clue.sceneSource`, and **key-deduction recipes** (`KeyDeduction.requiredClues` clue refs, plus `choice.requiresDeduction` and `hasDeduction`-condition targets against the recipe-id registry — a gate pointing at an undefined recipe is an error). With `includeReachability`, warns on scenes unreachable from `firstScene` and clues no reachable scene can discover.
- `computeReachableScenes(bundle: ContentBundle): Set<string>` — BFS from `firstScene` over all choice + encounter outcome edges.
- `computeMaxDisposition(bundle: ContentBundle, npcId: string): number` — start disposition + every positive reachable disposition delta (onEnter + `npcEffect`); used to check whether a disposition-gated vignette threshold is attainable.

## buildDeduction.ts

Pure builders for `Deduction`s, plus the key-deduction recipe matcher.

- `buildDeduction(clueIds: string[], clues: Record<string, Clue>): Deduction` — sets `isRedHerring: true` if any connected clue is of type `redHerring`. Builds a `description` from clue titles (`"Connection: A ↔ B"`, or `"Questionable connection: ..."` when a red herring; 3+ titles are comma-joined with a trailing "and"). Generates a unique id from `Date.now()` + `Math.random()`.
- `matchDeduction(connectedIds: string[], recipes: KeyDeduction[]): KeyDeduction | null` — **subset** match: returns the first recipe whose `requiredClues` are all present in `connectedIds` (extra connected clues allowed), else `null`. Empty recipes or empty set → `null` (vignette-safe). Pure.
- `buildDeductionFromRecipe(recipe: KeyDeduction, _connectedIds: string[]): Deduction` — builds a `Deduction` stored under the recipe's **stable authored id** (so `hasDeduction`/`requiresDeduction` gates resolve), with the recipe's `description`/`isRedHerring` and `clueIds` = the recipe's `requiredClues`. `DeductionButton` prefers this on a successful Reason check when a recipe matches, falling back to `buildDeduction` otherwise.

## caseProgression.ts

End-of-case logic: faculty bonus and vignette unlocks.

- `interface CaseCompletionResult { facultyBonusGranted: Faculty | null; vignetteUnlocked: string | null }`.
- `CaseProgression.completeCase(caseId: string, state: GameState, actions: EngineActions): CaseCompletionResult` — grants `+1` to the faculty stored in the `last-critical-faculty` flag (when it names a valid faculty), then checks vignette unlocks and, if one unlocks, sets the `vignette-unlocked-{id}` flag. Returns what was granted/unlocked.
- `CaseProgression.checkVignetteUnlocks(state: GameState): string | null` — returns the id of the first not-yet-unlocked vignette whose condition is met. Registered conditions: `a-matter-of-shadows` (Lamplighters reputation ≥ 2), `the-rationalists-dilemma` (Rationalists Circle reputation ≥ 2), `the-debt-of-smoke` (persisted flag `wc-court-deal-made`), `the-unfinished-case` (flag `wc-case-complete`).
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

- `const CURRENT_SAVE_VERSION = 2`.
- `interface SaveSummary { id: string; timestamp: string; caseName: string; investigatorName: string }`.
- `SaveManager.save(saveId: string, state: GameState): void` — wraps `state` in a `SaveFile` (`version`, ISO `timestamp`, `state`), writes it, and upserts the index entry (re-sorted desc).
- `SaveManager.load(saveId: string): GameState | null` — reads and parses the save, runs `migrate`, returns the migrated `state` (or `null` if missing/unparseable).
- `SaveManager.listSaves(): SaveSummary[]` — returns the index.
- `SaveManager.deleteSave(saveId: string): void` — removes the save and its index entry.
- `SaveManager.migrate(saveFile: SaveFile): SaveFile` — idempotent upgrade to the current version (**3**). **v0→v1**: default `factionReputation` to `{}`. **v1→v2**: backfill `sceneHistory` and `connections` to `[]` (a missing `sceneHistory` otherwise crashes the first `goToScene` after load). **v2→v3**: backfill `visitedScenes` from `sceneHistory + currentScene`, so reloading a pre-v3 save doesn't re-fire `onEnter` on scenes already seen (F-006).

## audioManager.ts

Howler.js SFX playback with lazily-cached `Howl` instances per event.

- `type SfxEvent` — one of: `'dice-roll'`, `'clue-physical'`, `'clue-testimony'`, `'clue-occult'`, `'clue-deduction'`, `'clue-redHerring'`, `'composure-decrease'`, `'vitality-decrease'`, `'scene-transition'`.
- `AudioManager.playSfx(event: SfxEvent, volume: number): void` — lazily creates/caches the `Howl` for the event, clamps volume to `[0, 1]`, and plays. Howler handles missing files silently (no assets ship in the repo).
- `AudioManager.setMasterSfxVolume(volume: number): void` — sets clamped `[0, 1]` volume on every cached `Howl`.

## cluePrompts.ts

Atmospheric prompt text for exploration/check clue discovery.

- `getCluePromptText(type: ClueType, title: string, method: 'exploration' | 'check'): string` — returns a tone-appropriate prompt string keyed by clue `type` and discovery `method`. The `title` is woven into the text for physical (both modes), redHerring (both modes), and testimony (exploration only); occult and deduction use fixed atmospheric lines in both modes. Falls back to the physical exploration prompt for unknown types.

## effectMessages.ts

Pure conversion of `Effect` objects into player-facing feedback strings
(atmospheric text + mechanical annotation such as `(Composure -1)`).

- `generateEffectMessage(effect: Effect, npcs: Record<string, NPCState>): string | null` — returns `null` for `flag`, `discoverClue`, and `setMemoryFlag` (which surface their own feedback) and for effects with no `delta`. Otherwise appends a mechanical suffix (`(Composure +2)`, etc.). When `effect.description` is authored, it is used as the message text with the mechanical suffix still appended; otherwise an atmospheric message is generated per type (composure, vitality, disposition, suspicion, reputation), resolving NPC names from `npcs`.
- `generateEffectMessages(effects: Effect[], npcs: Record<string, NPCState>): string[]` — maps over the effects and drops the `null` results.

## engineActions.ts

The action interface that impure engine functions receive instead of importing
the store — this is what breaks the engine→store circular dependency (see
[architecture.md](./architecture.md)).

- `interface EngineActions` declares: `adjustComposure(delta)`, `adjustVitality(delta)`, `setFlag(key, value: boolean | string)`, `adjustDisposition(npcId, delta)`, `adjustSuspicion(npcId, delta)`, `adjustReputation(faction, delta)`, `discoverClue(clueId)`, `goToScene(sceneId)`, `updateFaculty(faculty, value)`, and a read-only `investigator: Investigator`. The store's slice actions satisfy this shape at call sites.
