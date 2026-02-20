# Trace 07 — Hint System

## 1. Entry Point

Two paths:
- **Activity tracking**: `hintEngine.trackActivity(event)` — should be called from EvidenceBoard (boardVisit), connection attempts, and scene changes. In practice, only `HintButton` reads the engine; tracking calls are largely missing from components.
- **Hint display**: `HintButton` component in `HeaderBar` — polls `shouldShowHint(hintsEnabled)` on every render.

## 2. Execution Path

### Tracking (intended but partially wired)

1. `trackActivity({ type: 'boardVisit' })` → increments `state.boardVisitCount`.
2. `trackActivity({ type: 'connectionAttempt' })` → increments `state.connectionAttemptCount`, resets `boardVisitCount` to 0.
3. `trackActivity({ type: 'sceneChange' })` → calls `resetForScene()` → resets all counters and `sceneEntryTime = Date.now()`.

### Display

1. `HintButton` renders inside `HeaderBar`. On every render:
   - Calls `shouldShowHint(settings.hintsEnabled)`.
   - Returns false if hints disabled.
   - Returns true if `boardVisitCount >= 3 && connectionAttemptCount === 0` OR `Date.now() - sceneEntryTime >= 300000` (5 min).
2. If visible, renders a 💡 button with Framer Motion fade-in.
3. On click: `getHint(currentLevel, gameState)`.
   - Level 1: generic narrative nudge.
   - Level 2: finds two revealed clues with `connectsTo` arrays, suggests connecting them.
   - Level 3: gated behind level 2 having been shown. Generic "most recent clue" hint.
4. Hint popover appears below the button. Dismissible via ✕ button.
5. `currentLevel` advances (1→2→3, capped at 3). Resets on scene change via `useEffect`.

## 3. Resource Management

- `hintEngine` is a module-level singleton with mutable `let state`. Not in the Zustand store.
- `Date.now()` called on every `shouldShowHint` invocation (every render of `HintButton`).
- `_setState` and `_getState` exposed for testing — prefixed with underscore to signal internal use.

## 4. Error Path

- `getHint` with level 3 before level 2 was shown: silently downgrades to level 2. No error.
- If `gameState.clues` is empty, level 2 falls back to a generic message.
- No error paths — the hint engine is purely advisory.

## 5. Performance Characteristics

- `shouldShowHint` is called on every render of `HintButton` (which re-renders when `gameState` changes via `buildGameState` selector). This is a cheap function (two comparisons + one `Date.now()`).
- `getHint` at level 2 iterates all clues with `Object.values(gameState.clues).filter(...)`. For typical game sizes (<50 clues), this is negligible.

## 6. Observable Effects

- UI: 💡 button fades in when hint conditions are met. Popover shows hint text.
- No store mutations. No persistence. No SFX.
- Hint level state is local to `HintButton` component — lost on unmount (e.g., navigating away from game screen).

## 7. Why This Design

- The 3-level escalation prevents spoiling the puzzle immediately. Players who are truly stuck can escalate to a direct reveal.
- Board visit counting without connections is a good heuristic for "player is looking at evidence but not making progress."
- The 5-minute dwell timer catches players who are stuck but not using the evidence board.

## 8. Feels Incomplete

- `trackActivity` is never called from any component. The `EvidenceBoard` doesn't call `trackActivity({ type: 'boardVisit' })`. `goToScene` doesn't call `trackActivity({ type: 'sceneChange' })`. The hint engine's tracking state is never updated, so:
  - `boardVisitCount` is always 0 → board trigger never fires.
  - `sceneEntryTime` is set once at module load and never reset → dwell trigger fires after 5 minutes from page load, not from scene entry.
- This means hints only appear based on the dwell timer from initial page load, which is almost certainly not the intended behavior.
- Level 2 hints pick the first two clues with `connectsTo` — not necessarily the most relevant pair for the current scene.
- Level 3 hint text is completely generic and doesn't reference actual game state.

## 9. Feels Vulnerable

- `Date.now()` is used directly — not injectable. Tests use `_setState` to work around this, but the dwell calculation in `shouldShowHint` still calls `Date.now()` live.
- The singleton pattern means the hint engine's state persists across React component lifecycles. If the game is reset (new game started), the hint state is not cleared unless `resetForScene` is explicitly called.
- `sceneEntryTime` is initialized to `Date.now()` at module load time. In a test environment, this could be any value.

## 10. Feels Like Bad Design

- A stateful singleton outside the store is an architectural anomaly. Every other piece of game state lives in Zustand. The hint engine's state should either be in the store or managed via a React context/ref.
- The hint engine is designed to be driven by `trackActivity` calls, but none of the callers are wired up. The engine is fully implemented but effectively dead code for the board-visit trigger.
- `HintButton` receives the full `gameState` as a prop (from `HeaderBar` which builds it via `buildGameState`). This causes `HintButton` to re-render on any store change, even though it only needs `clues` and `hintsEnabled`.
