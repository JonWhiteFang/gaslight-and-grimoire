# Trace 01 — Case Loading & Game Start

## 1. Entry Point

`App.tsx` → `handleStartCase` callback, triggered when `CharacterCreation.onComplete` fires.

```
App.handleStartCase → setScreen('loading') → loadAndStartCase('the-whitechapel-cipher') → setScreen('game')
```

## 2. Execution Path

1. `App.handleStartCase()` sets screen to `'loading'`, clears `loadError`.
2. Calls `store.loadAndStartCase('the-whitechapel-cipher')` (narrativeSlice action).
3. `loadAndStartCase` calls `narrativeEngine.loadCase(caseId)`.
4. `loadCase` constructs base URL `/content/cases/the-whitechapel-cipher/` and fires 7 parallel `fetch()` calls via `Promise.all`: `meta.json`, `act1.json`, `act2.json`, `act3.json`, `clues.json`, `npcs.json`, `variants.json`.
5. `fetchJson` prepends `import.meta.env.BASE_URL` (i.e. `/gaslight-and-grimoire/`) to each path.
6. Each response is parsed as JSON. Scenes from all 3 acts are concatenated and indexed by ID into `Record<string, SceneNode>`. Clues and NPCs are similarly indexed.
7. Returns `CaseData { meta, scenes, clues, npcs, variants }`.
8. Back in `loadAndStartCase`: determines `firstSceneId` as `Object.keys(data.scenes)[0]`.
9. Calls `set()` (Immer) to: store `caseData`, set `currentCase`, reset `sceneHistory`, reset `abilityUsed`, delete ability flags, populate `state.clues` and `state.npcs` from loaded data.
10. Calls `get().goToScene(firstSceneId)`.
11. `goToScene` pushes empty string to `sceneHistory`, sets `currentScene`, plays `scene-transition` SFX, and triggers autosave if `autoSaveFrequency === 'scene'`.
12. Back in `App.handleStartCase`: `setScreen('game')`.

## 3. Resource Management

- 7 parallel HTTP fetches. No abort controller — if the user navigates away during loading, fetches complete silently.
- No caching of loaded case data. Re-loading the same case re-fetches everything.
- JSON parsing is synchronous on the main thread after each fetch resolves.
- `CaseData` is stored in the Zustand store (`caseData` field on narrativeSlice). It persists for the lifetime of the session but is NOT included in save files.

## 4. Error Path

- If any `fetch()` fails (network error, 404), `fetchJson` throws with `[NarrativeEngine] Failed to fetch "${url}": ${status} ${statusText}`.
- `Promise.all` rejects on the first failure — remaining fetches are wasted.
- `loadAndStartCase` is async but doesn't catch internally. The error propagates to `App.handleStartCase`'s try/catch.
- `handleStartCase` catches, sets `loadError` state, and reverts screen to `'title'`.
- The `loadError` state is set but never rendered — no UI displays the error message.

## 5. Performance Characteristics

- 7 parallel fetches is good — no waterfall.
- `indexById` iterates each array once (O(n)). Scenes from 3 acts are concatenated first (one extra array allocation).
- `Object.keys(data.scenes)[0]` for first scene relies on insertion order. This is correct for modern JS engines but fragile if scene order matters.
- No lazy loading — all 3 acts are loaded upfront even though only Act 1 is needed initially.

## 6. Observable Effects

- Screen transitions: `title` → `character-creation` → `loading` → `game`.
- Store mutations: `caseData`, `currentCase`, `sceneHistory`, `clues`, `npcs`, `currentScene` all updated.
- SFX: `scene-transition` plays on first scene entry.
- Autosave: triggered if `autoSaveFrequency === 'scene'`.
- `sceneHistory` gets an empty string pushed as the first entry (the "previous" scene before the first real scene).

## 7. Why This Design

- Loading all acts upfront avoids mid-game loading screens when transitioning between acts.
- Populating clues/NPCs into the store at load time means the evidence board and NPC gallery work immediately without lazy resolution.
- The `caseData` field on the narrative slice gives `useCurrentScene()` access to the full scene graph for variant resolution.

## 8. Feels Incomplete

- `loadError` is captured but never shown to the user. The title screen has no error banner.
- No loading progress indicator — just a pulsing "Loading case…" text.
- `caseData` is not saved/restored — loading a save file doesn't restore `caseData`, so `useCurrentScene()` returns null after load until the case is re-fetched. The `loadGame` action in metaSlice doesn't call `loadCase`.
- Case ID is hardcoded to `'the-whitechapel-cipher'` — no case selection.

## 9. Feels Vulnerable

- No fetch timeout. A slow or hanging server leaves the user on the loading screen indefinitely.
- No AbortController — navigating away doesn't cancel in-flight fetches.
- `Object.keys(data.scenes)[0]` as the first scene is fragile. If JSON key order changes (e.g., a tool re-sorts keys), the wrong scene becomes the entry point. A `meta.json` field like `firstScene` would be safer.
- No content validation at load time. `validateContent` exists but is never called during `loadCase` or `loadAndStartCase`.

## 10. Feels Like Bad Design

- The empty string pushed to `sceneHistory` on the first `goToScene` call is a sentinel value that could cause issues if anything iterates history expecting valid scene IDs.
- `loadAndStartCase` mixes async I/O (fetch), store mutation (set), and navigation (goToScene) in a single action. This makes it hard to test and hard to retry on partial failure.
- Clues and NPCs are merged into the global store rather than scoped to the case. Starting a new case without clearing old data could leave stale clues/NPCs from a previous case.
