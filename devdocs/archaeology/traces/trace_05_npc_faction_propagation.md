# Trace 05 — NPC Disposition & Faction Reputation Propagation

## 1. Entry Point

Any call to `npcSlice.adjustDisposition(npcId, delta)` — triggered from:
- `narrativeEngine.processChoice` (via `choice.npcEffect.dispositionDelta`)
- `narrativeEngine.applyOnEnterEffects` (via `Effect { type: 'disposition' }`)
- `narrativeEngine.processEncounterChoice` (via `choice.npcEffect`)

## 2. Execution Path

1. `adjustDisposition(npcId, delta)` calls `set()`:
   - Looks up `state.npcs[npcId]`.
   - If found, clamps `disposition` to [-10, +10]: `Math.max(-10, Math.min(10, npc.disposition + delta))`.
2. After `set()` completes, reads the NPC from the updated store via `get().npcs[npcId]`.
3. If `npc.faction` is truthy (non-null, non-empty string):
   - Calls `get().adjustReputation(npc.faction, delta * 0.5)`.
4. `adjustReputation` (worldSlice) calls `set()`:
   - Reads `state.factionReputation[faction] ?? 0`.
   - Sets `state.factionReputation[faction] = current + delta`.
   - No clamping — faction reputation is unbounded.

Parallel path for suspicion:
- `adjustSuspicion(npcId, delta)` clamps to [0, 10]. No cross-slice propagation.

## 3. Resource Management

- Synchronous, no I/O.
- Two sequential `set()` calls (disposition then reputation). Each triggers a Zustand notify cycle. React batches these in event handlers but they're separate store updates.
- The `get()` call between the two `set()` calls reads the post-mutation state, which is correct because Immer's `set()` is synchronous.

## 4. Error Path

- If `npcId` doesn't exist in `state.npcs`, the `set()` callback silently does nothing (the `if (npc)` guard).
- The faction propagation still runs `get().npcs[npcId]` — if the NPC doesn't exist, `npc` is undefined, `npc?.faction` is undefined, and the reputation call is skipped. Safe.
- No error logging for missing NPCs.

## 5. Performance Characteristics

- Trivial. Two object lookups, two arithmetic operations, two store updates.
- The double `set()` could cause two React render cycles in non-batched contexts (e.g., inside `setTimeout` or async code). In practice, most calls come from synchronous event handlers where React 18 batches automatically.

## 6. Observable Effects

- `npcs[npcId].disposition` changes (clamped).
- `factionReputation[faction]` changes by `delta * 0.5` (unclamped).
- No SFX triggered by disposition or reputation changes.
- No UI notification — the NPC Gallery shows updated disposition labels on next open, but there's no toast or indicator.
- Downstream: faction reputation changes can trigger vignette unlocks at case completion (`CaseProgression.checkVignetteUnlocks`).

## 7. Why This Design

- The 0.5 multiplier on faction propagation means individual NPC interactions have a dampened effect on the broader faction relationship. This prevents a single conversation from wildly swinging faction standing.
- Propagation happens automatically — content authors don't need to manually add reputation effects alongside disposition effects. This reduces content authoring errors.
- Disposition is bounded [-10, +10] but reputation is unbounded, allowing cumulative faction effects across many NPCs and cases.

## 8. Feels Incomplete

- No UI feedback when faction reputation changes. The player has no way to know their faction standing changed unless they check... but there's no faction reputation display anywhere in the UI.
- `adjustDisposition` propagates to reputation, but `applyOnEnterEffects` with `type: 'disposition'` also calls `store.adjustDisposition`, which also propagates. Content authors might not realize that a disposition effect in JSON also moves faction reputation.
- No inverse propagation — changing faction reputation directly (via `Effect { type: 'reputation' }`) doesn't affect individual NPC dispositions.

## 9. Feels Vulnerable

- Faction reputation is unbounded. Over many cases, reputation could grow to arbitrarily large values. Vignette unlock conditions use `>=` thresholds, so this works, but it means there's no meaningful "max reputation" concept.
- The propagation multiplier (0.5) is hardcoded in `npcSlice`. If different factions should have different propagation rates, this would need refactoring.
- If `adjustDisposition` is called in a loop (e.g., multiple NPC effects in one scene), each call triggers a separate reputation adjustment. The cumulative effect is correct but generates N store updates instead of one batched update.

## 10. Feels Like Bad Design

- The cross-slice call (`get().adjustReputation(...)`) from inside `npcSlice` creates a hidden dependency between slices. The NPC slice directly calls a world slice action. This coupling isn't visible from the slice interfaces and makes it harder to reason about what triggers reputation changes.
- The propagation happens outside the `set()` callback (after it), using `get()` to read post-mutation state. This works but is a non-obvious pattern. A more explicit approach would be to return the faction info from the `set()` and handle propagation in a separate action or middleware.
