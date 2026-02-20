# Trace 04 — Evidence Board & Deduction Formation

## 1. Entry Point

User clicks "Evidence Board" button in `HeaderBar` → `App` sets `isEvidenceBoardOpen = true` → `EvidenceBoard` mounts.

Connection flow: user presses Space on a clue card → presses Space on another → connection formed. Then clicks "Attempt Deduction".

## 2. Execution Path

### Connection phase

1. `EvidenceBoard` renders all revealed clues via `useClues()` filtered by `isRevealed`.
2. User focuses a `ClueCard` and presses Space → `ClueCard` calls `onInitiateConnection(clueId)`.
3. `EvidenceBoard.handleInitiateConnection`:
   - First call: sets `connectingFrom = clueId`. Ghost thread starts following mouse.
   - Second call (different clue): queries DOM for both `[data-clue-id]` elements, computes centre points via `getCentre()`, creates a `Connection` object, pushes to `connections` state, calls `updateClueStatus(fromId, 'connected')` and `updateClueStatus(toId, 'connected')`.
   - Resets `connectingFrom = null`.
4. Tag-based brightening: while `connectingFrom` is set, `shouldBrighten(clueId)` checks if the target clue shares any tag with the source clue. Matching clues get visual emphasis.

### Deduction phase

5. `DeductionButton` renders when `connectedClueIds.length >= 2`.
6. User clicks "Attempt Deduction" → `DeductionButton.handleAttempt()`.
7. Calls `diceEngine.performCheck('reason', investigator, 14, false, false)` — DC 14 Reason check, no advantage, no disadvantage.
8. On success/critical:
   - `buildDeduction(connectedClueIds, clues)` creates a `Deduction` object. Checks if any connected clue has `type === 'redHerring'` → sets `isRedHerring`.
   - `addDeduction(deduction)` stores it.
   - Each connected clue status set to `'deduced'`.
   - `onResult('success')` → `EvidenceBoard` clears connections.
9. On failure/partial/fumble:
   - Each connected clue status set to `'contested'`.
   - `onResult('failure')` → `EvidenceBoard` moves connections to `slackConnections` (red, drooping animation), clears `connections`.
   - `setTimeout(2000)`: resets clue statuses to `'examined'`, resets phase to `'idle'`, `slackConnections` cleared after 1400ms.

## 3. Resource Management

- Connection positions are computed from DOM `getBoundingClientRect()` — recomputed on scroll/resize via event listeners attached in a `useEffect`.
- Ghost thread tracks mouse position via a global `mousemove` listener (added/removed based on `connectingFrom` state).
- SVG overlay is absolutely positioned over the corkboard area. Thread paths are Framer Motion `<motion.path>` elements with `pathLength` animation.
- `setTimeout` in `DeductionButton` for failure reset — not cleaned up on unmount. If the board closes during the 2s window, `updateClueStatus` calls fire on an unmounted component's captured refs.

## 4. Error Path

- If a clue card's DOM element is not found (e.g., removed between Space presses), `getCentre` is not called and the connection is silently not created.
- `buildDeduction` has no error path — it always returns a valid `Deduction`.
- If `performCheck` returns an unexpected tier, the `handleAttempt` function treats anything other than `success`/`critical` as failure.

## 5. Performance Characteristics

- `shouldBrighten` iterates tags of source and target clue — O(n*m) per clue per render while connecting. With small tag sets this is negligible.
- `recompute` (scroll/resize handler) iterates all connections and queries DOM for each pair — O(n) DOM queries. Could be expensive with many connections.
- SVG re-renders on every mouse move during ghost thread drawing (React state update per `mousemove` event). No throttling.

## 6. Observable Effects

- Store: clue statuses change (`connected` → `deduced` or `contested` → `examined`). Deduction added to `deductions` map.
- UI: gold threads drawn between connected clues. On failure, threads turn red and droop. Deduction button changes state.
- SFX: none directly from the evidence board. The `addDeduction` action doesn't trigger any SFX.
- No autosave triggered by deduction formation.

## 7. Why This Design

- Keyboard-first connection (Space to connect) with mouse ghost thread as visual feedback. Supports both input methods.
- DC 14 Reason check for deduction means the player's character build matters even in the evidence board — it's not just a puzzle, it's a skill check.
- Red herring propagation (`isRedHerring` on deduction) means false leads have mechanical consequences downstream.

## 8. Feels Incomplete

- `buildDeduction` generates generic descriptions ("The threads converge into a clear deduction." / "A connection forms — but something feels off..."). No content-specific deduction text.
- Deductions have `unlocksScenes` and `unlocksDialogue` fields but `buildDeduction` never populates them. They're always undefined.
- No way to undo a connection before attempting deduction. Once two clues are connected, the only way to disconnect is to attempt (and fail) a deduction.
- No visual feedback for the `'contested'` clue status — the status is set but `ClueCard` may not render it distinctly.

## 9. Feels Vulnerable

- `buildDeduction` uses `Date.now()` and `Math.random()` for ID generation. In tests or rapid calls, IDs could collide (though `Math.random().toString(36).slice(2)` makes this unlikely).
- The `setTimeout` in `DeductionButton` captures `idsRef.current` (a ref) for the delayed reset. If the connected clue IDs change during the 2s window (unlikely but possible if the board re-renders), the wrong clues get reset.
- The `setTimeout` is not cleared on unmount. Closing the evidence board during the failure animation leaves a dangling timer that calls `updateClueStatus` on potentially stale IDs.

## 10. Feels Like Bad Design

- Connection state (which clues are connected, thread positions) lives in React component state, not in the Zustand store. This means connections are lost if the evidence board is closed and reopened. The user has to reconnect clues from scratch.
- The deduction DC is hardcoded to 14 in `DeductionButton`. This should arguably be content-driven or at least a constant shared with the engine.
- `EvidenceBoard` mixes DOM measurement (`getBoundingClientRect`), state management (connections), and game logic (tag brightening) in a single 200+ line component. The connection logic could be extracted into a custom hook.
