# 5 Things (or Not)

> Ranked by impact. Each item cites trace documents and exact code locations.

---

## 1. Load Game Doesn't Restore Case Data (Critical Correctness Bug)

### What's wrong

`metaSlice.loadGame()` restores all 10 `GameState` fields into the store but never restores `caseData` (the loaded case JSON). After loading a save, `caseData` remains `null`. `useCurrentScene()` returns `null`. The game screen renders with no scene text, no choices, no content. The player sees an empty game.

### Code locations

- `src/store/slices/metaSlice.ts` → `loadGame` (line ~80): restores `investigator`, `currentScene`, `currentCase`, `clues`, `deductions`, `npcs`, `flags`, `factionReputation`, `sceneHistory`, `settings`. Does not set `caseData`.
- `src/store/slices/narrativeSlice.ts` → `caseData: CaseData | null` (line ~38): initialized to `null`, only populated by `loadAndStartCase`.
- `src/store/index.ts` → `useCurrentScene()`: returns `null` when `caseData` is null.

### Expected benefit

Correctness. Without this fix, the "Continue Investigation" flow on the title screen is broken. Loading any save produces a blank game screen.

### Why it's probably not already fixed

The save/load feature was likely built in two phases: save (which works) and load (which was wired to the UI but never end-to-end tested with a real play session). The `caseData` omission is easy to miss because `GameState` (the serializable type) intentionally excludes `caseData` — it's runtime-only content. The gap is that `loadGame` restores `GameState` but doesn't re-fetch the runtime content that `GameState` depends on.

### Incremental first step

In `metaSlice.loadGame`, after restoring state, call `loadCase(gameState.currentCase)` to re-fetch the case JSON and set `caseData`. This is ~5 lines:

```typescript
// After set() in loadGame:
const data = await loadCase(gameState.currentCase);
set((state) => { state.caseData = data; });
```

Files touched: `src/store/slices/metaSlice.ts` (add import for `loadCase`, add 2 lines after the existing `set()` call).

Verification: load a save from `LoadGameScreen` → confirm scene text renders, choices appear, evidence board shows clues.

---

## 2. Hint Engine Tracking Never Wired (Dead Feature)

### What's wrong

`hintEngine.trackActivity()` is never called from any component. The three tracking events — `boardVisit`, `connectionAttempt`, `sceneChange` — are never fired. This means:

- `boardVisitCount` is permanently 0 → the "3 board visits with no connections" trigger never fires.
- `sceneEntryTime` is set once at module load (`Date.now()` in the module initializer) and never reset → the 5-minute dwell trigger fires 5 minutes after the page loads, not after entering a scene.

The hint engine is fully implemented and tested, but its input pipeline is disconnected.

### Code locations

- `src/engine/hintEngine.ts` → `trackActivity()`, `shouldShowHint()`, `resetForScene()`: all implemented, tested.
- `src/components/EvidenceBoard/EvidenceBoard.tsx`: opens/closes but never calls `trackActivity({ type: 'boardVisit' })`.
- `src/store/slices/narrativeSlice.ts` → `goToScene`: never calls `trackActivity({ type: 'sceneChange' })`.
- `src/components/HeaderBar/HintButton.tsx`: reads `shouldShowHint()` but the data it reads is stale.

### Expected benefit

UX. The hint system is a key accessibility feature — it helps stuck players. Without wiring, hints only appear based on a broken dwell timer, not based on actual player behavior.

### Why it's probably not already fixed

The hint engine was likely built as an engine module first (with unit tests), and the component integration was deferred to a later task. The `HintButton` was wired to read from the engine, but the write side (tracking calls from components) was never connected. The tests pass because they use `_setState` to inject state directly.

### Incremental first step

Add 3 `trackActivity` calls:

1. `src/components/EvidenceBoard/EvidenceBoard.tsx`: call `trackActivity({ type: 'boardVisit' })` in the mount `useEffect`.
2. `src/components/EvidenceBoard/EvidenceBoard.tsx`: call `trackActivity({ type: 'connectionAttempt' })` inside `handleInitiateConnection` when a connection completes.
3. `src/store/slices/narrativeSlice.ts` → `goToScene`: call `trackActivity({ type: 'sceneChange' })` after the `set()` call.

Files touched: 2 files, ~3 one-line additions. No new dependencies (hintEngine is already importable).

Verification: open the evidence board 3 times without connecting → hint button should appear. Navigate to a new scene → hint timer should reset.

---

## 3. `processChoice` Is Impure but Labeled Pure (Testability + Correctness Risk)

### What's wrong

`narrativeEngine.processChoice()` is documented as part of the "pure functions where possible" engine layer, but it:
- Calls `useStore.getState()` to get the store instance.
- Calls `store.adjustDisposition()` and `store.adjustSuspicion()` (NPC effects).
- Calls `store.goToScene()` (navigation + SFX + autosave).

This means: (a) unit testing requires a full Zustand store, (b) the function both returns a `ChoiceResult` AND performs side effects, (c) the caller (`ChoicePanel`) shows the dice overlay after navigation has already happened — the scene has changed before the player sees the roll.

### Code locations

- `src/engine/narrativeEngine.ts` → `processChoice()` (line ~180): calls `useStore.getState()`, `store.adjustDisposition`, `store.adjustSuspicion`, `store.goToScene`.
- `src/components/ChoicePanel/ChoicePanel.tsx` → `handleSelect` (line ~60): calls `processChoice`, then uses the return value for UI, but navigation already happened inside `processChoice`.
- Same pattern in `applyOnEnterEffects()` (line ~130) and `startEncounter()` / `processEncounterChoice()`.

### Expected benefit

Testability: pure engine functions can be tested without store setup. Correctness: separating "compute result" from "apply result" lets the UI show the dice roll before navigating. Maintainability: clearer contract — engine computes, components apply.

### Why it's probably not already fixed

Convenience. Having `processChoice` do everything in one call simplifies the component code. The impurity was likely introduced incrementally — first the check logic, then NPC effects were added, then navigation. Each addition was small, and the function grew into a god-function. Refactoring it requires touching both the engine and every caller.

### Incremental first step

Split `processChoice` into two functions:
- `computeChoiceResult(choice, gameState): ChoiceResult` — pure, no store access. Returns the roll, tier, next scene ID, and NPC effect descriptors.
- Keep the existing `processChoice` as a thin wrapper that calls `computeChoiceResult` then applies effects.

This lets tests target `computeChoiceResult` without a store, and lets `ChoicePanel` eventually call `computeChoiceResult` first (show dice), then apply effects (navigate) after a delay.

Files touched: `src/engine/narrativeEngine.ts` (extract ~20 lines into a new exported function). No callers change in the first step.

Verification: `npm run test:run` passes. New unit test for `computeChoiceResult` with no store setup.

---

## 4. SFX Triggered Inside Immer `set()` Callbacks (Architectural Violation)

### What's wrong

Five store slice actions call `AudioManager.playSfx()` inside their Immer `set()` callbacks:

- `investigatorSlice.adjustComposure` → `playSfx('composure-decrease', ...)`
- `investigatorSlice.adjustVitality` → `playSfx('vitality-decrease', ...)`
- `narrativeSlice.goToScene` → `playSfx('scene-transition', ...)`
- `narrativeSlice.setCheckResult` → `playSfx('dice-roll', ...)`
- `evidenceSlice.discoverClue` → `playSfx('clue-{type}', ...)`

Immer's `set()` callback should be a pure state transformation. Triggering audio (an irreversible side effect) inside it means:
- If Zustand or Immer ever batches, defers, or replays mutations, audio plays at the wrong time or multiple times.
- The `as SfxEvent` cast in `evidenceSlice` bypasses type safety.
- Store slices have a hard dependency on `AudioManager`, making them harder to test in isolation.

### Code locations

- `src/store/slices/investigatorSlice.ts` → `adjustComposure` (line ~45), `adjustVitality` (line ~55).
- `src/store/slices/narrativeSlice.ts` → `goToScene` (line ~40), `setCheckResult` (line ~52).
- `src/store/slices/evidenceSlice.ts` → `discoverClue` (line ~20).

### Expected benefit

Testability: slices become pure state transformers, testable without mocking `AudioManager`. Correctness: side effects happen after state is committed, not during mutation. Maintainability: audio triggering logic is centralized rather than scattered across 5 slice files.

### Why it's probably not already fixed

It works. Howler's `play()` is internally async (schedules on Web Audio context), so it doesn't block the synchronous `set()` callback. The current Zustand+Immer setup doesn't replay mutations. The pattern is convenient — the slice knows exactly when to play audio. Refactoring to a subscription or middleware requires a new pattern that doesn't exist in the codebase yet.

### Incremental first step

Use Zustand's `subscribe` API to trigger audio from state diffs rather than from inside `set()`. Create a single `src/store/audioSubscription.ts` that subscribes to the store and calls `AudioManager.playSfx` when relevant state changes are detected (e.g., composure decreased, scene changed, clue discovered). Then remove the `AudioManager` calls from the 5 slice files.

Files touched: 1 new file (`src/store/audioSubscription.ts`, ~40 lines), 3 existing files (remove `AudioManager` imports and calls from `investigatorSlice.ts`, `narrativeSlice.ts`, `evidenceSlice.ts`).

Verification: `npm run test:run` passes. Play through a scene transition → hear SFX. Take composure damage → hear SFX. Discover a clue → hear SFX.

---

## 5. `snapshotGameState` Duplicated Across Two Files

### What's wrong

Two functions build the same 10-field `GameState` plain object from the store:

- `src/store/index.ts` → `buildGameState(s: GameStore): GameState` — exported, used by components and `useCurrentScene()`.
- `src/store/slices/metaSlice.ts` → `snapshotGameState(s: GameStore): GameState` — local function, used by `saveGame`, `autoSave`, `loadGame`.

They are identical in structure. If a new field is added to `GameState`, both must be updated. If one is missed, saves will silently lose data.

### Code locations

- `src/store/index.ts` → `buildGameState` (line ~85).
- `src/store/slices/metaSlice.ts` → `snapshotGameState` (line ~30).

### Expected benefit

Maintainability: single source of truth for state snapshots. Correctness: eliminates the risk of field drift between the two functions.

### Why it's probably not already fixed

`metaSlice.ts` is a slice file that can't easily import from `store/index.ts` without creating a circular dependency (`store/index.ts` imports all slices, including `metaSlice`). The local `snapshotGameState` was likely a pragmatic workaround to avoid the circular import. The duplication is small (10 lines) and hasn't caused a bug yet.

### Incremental first step

Move `buildGameState` to a new file `src/store/buildGameState.ts` that imports only from `../types` (no store imports). Both `store/index.ts` and `metaSlice.ts` import from this shared file. Delete `snapshotGameState`.

Files touched: 1 new file (`src/store/buildGameState.ts`, ~15 lines), 2 modified files (`store/index.ts` re-exports, `metaSlice.ts` replaces local function with import).

Verification: `npm run test:run` passes. `npm run build` succeeds (no circular dependency). Save a game, load it → all state fields present.
