# Trace 02 — Scene Navigation & onEnter Effects

## 1. Entry Point

`narrativeSlice.goToScene(sceneId)` — called from `processChoice`, `loadAndStartCase`, `StatusBar` (breakdown/incapacitation), or any code that advances the scene.

## 2. Execution Path

1. `goToScene` (narrativeSlice) calls `set()`:
   - Pushes current `state.currentScene` onto `state.sceneHistory`.
   - Sets `state.currentScene = sceneId`.
   - Calls `AudioManager.playSfx('scene-transition', state.settings.audioVolume.sfx)`.
2. After `set()`, checks `get().settings.autoSaveFrequency === 'scene'` and calls `get().autoSave()` if true.
3. React re-renders. `useCurrentScene()` in `GameContent` fires:
   - Reads `currentScene` and `caseData` from store.
   - Calls `resolveScene(currentScene, gameState, caseData)`.
   - `resolveScene` looks up `caseData.scenes[sceneId]` for the base scene.
   - Searches `caseData.variants` for any variant where `variantOf === sceneId` and `variantCondition` is met.
   - Returns variant if found, otherwise base scene.
4. `NarrativePanel` detects scene change via `useEffect` on `currentSceneId`:
   - Compares against `prevSceneRef.current` to avoid re-processing.
   - If `scene.onEnter` exists, calls `applyOnEnterEffects(scene.onEnter)`.
   - Iterates `scene.cluesAvailable`, auto-discovers any with `method === 'automatic'` that pass `canDiscoverClue`.
5. `applyOnEnterEffects` calls `useStore.getState()` and dispatches store actions per effect type: `adjustComposure`, `adjustVitality`, `setFlag`, `adjustDisposition`, `adjustSuspicion`, `adjustReputation`, `discoverClue`.
6. `SceneText` receives new `scene.narrative` and starts typewriter animation (or instant if `reducedMotion`).
7. `ChoicePanel` receives new `scene.choices` and filters by `isChoiceVisible`.

## 3. Resource Management

- No async work — scene navigation is synchronous after the initial case load.
- `resolveScene` iterates `caseData.variants` array on every render of `useCurrentScene()`. Not cached.
- `applyOnEnterEffects` is called from a `useEffect` — runs after render, so the first frame shows the scene before effects are applied.
- `SceneText` typewriter uses `setInterval` with cleanup on unmount/text change.

## 4. Error Path

- `resolveScene` throws if `sceneId` is not found in `caseData.scenes`. This would crash the component tree; caught by `ErrorBoundary`.
- If `caseData` is null (e.g., after loading a save without re-fetching case data), `useCurrentScene()` returns null. `GameContent` renders `ChoicePanel` with empty choices. No error shown.
- `applyOnEnterEffects` silently skips effects with missing `target` or `delta` fields.

## 5. Performance Characteristics

- `resolveScene` does a linear scan of `caseData.variants` on every call to `useCurrentScene()`. With the current single case this is trivial (small array), but would scale poorly with many variants.
- `buildGameState` is called inside `useCurrentScene()` via `useStore(buildGameState)` — this creates a new object on every store change, potentially causing unnecessary re-renders of components that depend on `useCurrentScene()`.
- `NarrativePanel` builds a full `GameState` snapshot inside its `useEffect` for clue discovery gating. This is redundant with the `buildGameState` call in `useCurrentScene()`.

## 6. Observable Effects

- `sceneHistory` grows by one entry per navigation.
- `currentScene` changes → triggers re-render of NarrativePanel, ChoicePanel, AmbientAudio.
- SFX: `scene-transition` plays.
- Autosave: writes to localStorage if configured.
- onEnter effects: composure/vitality changes, flags set, NPC disposition/suspicion changes, clues discovered.
- Automatic clue discovery: `discoverClue` action fires → clue SFX plays, clue `isRevealed` set to true.
- `AmbientAudio` detects `scene.ambientAudio` change → cross-fades to new track.

## 7. Why This Design

- Variant resolution at render time (not at navigation time) means variants respond to state changes that happen between navigation and render — e.g., an onEnter effect that sets a flag could theoretically affect variant resolution on the same scene. In practice, `useCurrentScene()` runs after effects are applied.
- Separating `goToScene` (store action) from `applyOnEnterEffects` (engine function called from component) keeps the store action pure and the side effects in the component layer.

## 8. Feels Incomplete

- No "back" navigation. `sceneHistory` is populated but never consumed — there's no UI or action to go back to a previous scene.
- `hintEngine.trackActivity({ type: 'sceneChange' })` is documented in the hint engine but never called from `goToScene` or `NarrativePanel`. The hint engine's scene dwell timer is never reset on navigation.
- The `ClueDiscoveryCard` is a stub — auto-discovered clues are added to the store but the user gets no visual notification.

## 9. Feels Vulnerable

- `applyOnEnterEffects` accesses the store imperatively via `useStore.getState()` inside a React `useEffect`. If multiple effects trigger store updates that cause re-renders, the effect could run with stale state for subsequent iterations within the same loop.
- The `prevSceneRef` guard in `NarrativePanel` prevents double-processing, but if React StrictMode double-invokes effects (dev mode), the ref check handles it. However, the ref is never reset when `caseData` changes, so loading a new case with the same first scene ID would skip onEnter effects.

## 10. Feels Like Bad Design

- `NarrativePanel` manually constructs a `GameState` object (10 fields) inside its `useEffect` instead of using `buildGameState`. This is duplicated logic that could drift.
- `applyOnEnterEffects` is the only engine function that directly mutates the store. All other engine functions are pure or return results. This inconsistency makes the function harder to test and reason about.
- The typewriter effect in `SceneText` uses `setInterval` which can drift. `requestAnimationFrame` would be smoother and more battery-friendly.
