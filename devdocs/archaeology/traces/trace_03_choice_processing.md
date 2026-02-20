# Trace 03 — Choice Processing & Dice Checks

## 1. Entry Point

User clicks a `ChoiceCard` → `ChoicePanel.handleSelect(choiceId)`.

## 2. Execution Path

1. `handleSelect` finds the `Choice` object from the `choices` array by ID.
2. Builds a fresh `GameState` via `buildGameState(useStore.getState())`.
3. Calls `narrativeEngine.processChoice(choice, gameState)`.
4. Inside `processChoice`:
   - If `choice.faculty` and (`choice.difficulty` or `choice.dynamicDifficulty`) exist:
     a. `resolveDC(choice, investigator)` — if `dynamicDifficulty`, compares faculty score to threshold and returns `highDC` or `baseDC`. Otherwise returns `choice.difficulty ?? 12`.
     b. Checks advantage: `choice.advantageIf?.some(clueId => state.clues[clueId]?.isRevealed)`.
     c. Calls `diceEngine.performCheck(faculty, investigator, dc, hasAdvantage, false)`.
   - Inside `performCheck`:
     a. If advantage only: `rollWithAdvantage()` → rolls 2d20, takes max.
     b. If disadvantage only: `rollWithDisadvantage()` → rolls 2d20, takes min.
     c. If both or neither: single `rollD20()`.
     d. `calculateModifier(faculties[faculty])` → `floor((score - 10) / 2)`.
     e. `resolveCheck(natural, modifier, dc)` → nat 20 = critical, nat 1 = fumble, total ≥ dc = success, total ≥ dc-2 = partial, else failure.
   - `nextSceneId = choice.outcomes[result.tier]`.
   - If no faculty check: `nextSceneId = choice.outcomes['success'] ?? choice.outcomes['critical']`.
5. If `choice.npcEffect` exists: calls `store.adjustDisposition(npcId, delta)` and `store.adjustSuspicion(npcId, delta)`.
6. Calls `store.goToScene(nextSceneId)`.
7. Returns `ChoiceResult { nextSceneId, roll, modifier, total, tier }`.
8. Back in `handleSelect`:
   - If `result.roll` exists, calls `setCheckResult({ roll, modifier, total, tier })` → triggers dice SFX and shows `DiceRollOverlay` + `OutcomeBanner`.
   - If `autoSaveFrequency === 'choice'`, calls `store.autoSave()`.

## 3. Resource Management

- Entirely synchronous. No async, no I/O.
- `Math.random()` called 1–2 times per check (1 for normal, 2 for advantage/disadvantage).
- `processChoice` accesses the store imperatively via `useStore.getState()` for NPC effects and `goToScene`.

## 4. Error Path

- If `choice.outcomes[tier]` is undefined (missing outcome for a tier), `nextSceneId` is undefined. `goToScene(undefined)` would set `currentScene` to undefined, causing `resolveScene` to throw → ErrorBoundary catches.
- No validation that the target scene exists before navigating. Broken content JSON would crash at render time.
- `performCheck` has no error handling — if `investigator.faculties[faculty]` is undefined, `calculateModifier(undefined)` returns `NaN`, and `resolveCheck` with NaN would return `'failure'` (NaN < dc-2 is false, but NaN >= dc is also false — it falls through to `'failure'`).

## 5. Performance Characteristics

- Trivial cost. One random number, one arithmetic operation, one object lookup.
- `buildGameState` creates a new plain object each call — cheap but allocates.
- The `ChoicePanel` re-renders after `goToScene` changes `currentScene`, which triggers `useCurrentScene()` to resolve the new scene and provide new choices.

## 6. Observable Effects

- Store: `currentScene` changes, `sceneHistory` grows, NPC disposition/suspicion may change.
- UI: `DiceRollOverlay` appears with roll/modifier/total. `OutcomeBanner` shows tier label (e.g., "Success!", "Fumble!"). New scene narrative renders.
- SFX: `dice-roll` (from `setCheckResult`), `scene-transition` (from `goToScene`). If NPC disposition changes on a faction-aligned NPC, faction reputation also shifts.
- Persistence: autosave if configured for `'choice'` or `'scene'`.

## 7. Why This Design

- `processChoice` combines check + NPC effect + navigation in one call so the component doesn't need to orchestrate multiple steps. The tradeoff is that the function is impure (calls store actions).
- Advantage is determined by clue possession — this is the core "knowledge has mechanical impact" design rule.
- Dynamic difficulty allows content authors to scale DC based on player build, preventing trivial checks for min-maxed characters.

## 8. Feels Incomplete

- `partial` tier is treated as failure for NPC effects and navigation — there's no special handling for partial success beyond routing to a different scene via `outcomes.partial`.
- No animation or delay between the dice roll and scene transition. The roll overlay appears simultaneously with the new scene text, which could be jarring.
- `processChoice` doesn't record which faculty was checked or the result tier in any persistent state (no `last-critical-faculty` flag set here). That flag must be set by content JSON `onEnter` effects, which is fragile.

## 9. Feels Vulnerable

- `processChoice` calls `store.goToScene()` internally, meaning the caller (`ChoicePanel.handleSelect`) has no opportunity to intercept or delay navigation. The dice overlay and outcome banner are shown after navigation has already happened.
- If `choice.outcomes` is missing a tier that the dice engine produces, the game navigates to `undefined`. Content validation (`validateCase.mjs`) checks outcomes but only for scene existence, not for tier completeness.
- Disadvantage is hardcoded to `false` in `processChoice`. There's no mechanism for content to impose disadvantage on a choice.

## 10. Feels Like Bad Design

- `processChoice` is called a "pure function" in comments but it mutates the store via `useStore.getState()`. This is misleading and makes unit testing require a full store setup.
- The function both returns a result AND performs side effects (store mutations, navigation). The caller uses the return value for UI (dice overlay) but the navigation has already happened. This dual responsibility is confusing.
- `ChoicePanel.handleSelect` re-fetches `useStore.getState()` after `processChoice` to check autosave frequency. This is a second imperative store access in the same handler, mixing hook-based and imperative patterns.
