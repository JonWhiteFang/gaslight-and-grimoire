# Trace 06 — Save / Load / Autosave System

## 1. Entry Point

Three entry points:
- **Manual save**: `metaSlice.saveGame()` — not wired to any UI button in the current code (no save button visible).
- **Autosave**: `metaSlice.autoSave()` — called from `narrativeSlice.goToScene` (if `autoSaveFrequency === 'scene'`) and from `ChoicePanel.handleSelect` (if `autoSaveFrequency === 'choice'`).
- **Load**: `metaSlice.loadGame(saveId)` — called from `App.handleLoadSave` via `LoadGameScreen`.

## 2. Execution Path

### Save (`saveGame`)

1. `snapshotGameState(get())` builds a plain `GameState` from the store (10 fields).
2. Generates `saveId = 'save-${Date.now()}'`.
3. `SaveManager.save(saveId, gameState)`:
   - Wraps in `SaveFile { version: 1, timestamp: new Date().toISOString(), state }`.
   - `localStorage.setItem('gg_save_' + saveId, JSON.stringify(saveFile))`.
   - Reads index from `localStorage.getItem('gg_save_index')`, parses as `SaveSummary[]`.
   - Upserts summary `{ id, timestamp, caseName, investigatorName }`.
   - Sorts index by timestamp descending.
   - Writes index back.
4. Caps manual saves at 10: reads all saves, filters out `'autosave'`, deletes oldest beyond 10.

### Autosave (`autoSave`)

1. Guards: returns early if `!currentScene` (no active game).
2. `SaveManager.save('autosave', snapshotGameState(get()))`.
3. Wrapped in try/catch — silently swallows errors (localStorage unavailable in tests/private browsing).

### Load (`loadGame`)

1. `SaveManager.load(saveId)`:
   - `localStorage.getItem('gg_save_' + saveId)`.
   - `JSON.parse` → `SaveFile`.
   - `SaveManager.migrate(saveFile)` — if version < 1, adds `factionReputation: {}`.
   - Returns `migrated.state`.
2. If null (not found or parse error), returns early.
3. `set()` overwrites 10 store fields from the loaded `GameState`.

### Load Game Screen

1. `LoadGameScreen` calls `SaveManager.listSaves()` on mount → reads index from localStorage.
2. Renders save list with delete buttons.
3. Delete: `SaveManager.deleteSave(saveId)` → removes key + updates index.
4. Load: calls `onLoad(saveId)` → `App.handleLoadSave` → `loadGame(saveId)` → `setScreen('game')`.

## 3. Resource Management

- All I/O is synchronous `localStorage` calls. No async, no network.
- `JSON.stringify` on the full `GameState` — could be large if many clues/NPCs/flags accumulate.
- Save index is read/written on every save operation (read-modify-write pattern).
- No debouncing on autosave. If `autoSaveFrequency === 'choice'` and the player clicks rapidly, each click triggers a full serialize + write.

## 4. Error Path

- `SaveManager.load`: `JSON.parse` wrapped in try/catch → returns null on corrupt data.
- `readIndex`: try/catch → returns `[]` on corrupt index.
- `autoSave`: try/catch → silently swallows all errors.
- `saveGame`: no try/catch. If localStorage is full, `setItem` throws `QuotaExceededError` → unhandled → propagates to caller.
- `loadGame`: if `SaveManager.load` returns null, the function returns early. No user feedback.

## 5. Performance Characteristics

- `JSON.stringify` on every autosave is the main cost. For a typical game state (~50-100 KB), this is <1ms.
- localStorage is synchronous and blocks the main thread. On slow devices or with large state, this could cause frame drops during autosave.
- The save cap (10 manual saves) prevents unbounded localStorage growth.
- `listSaves` parses the index on every call — called once on `LoadGameScreen` mount, so not a hot path.

## 6. Observable Effects

- localStorage keys: `gg_save_{id}` for each save, `gg_save_index` for the index.
- No UI feedback on save success. No toast, no indicator.
- On load: all store state is overwritten. UI re-renders to reflect loaded state.
- `ErrorBoundary` fallback text says "Your progress has been auto-saved" — this is optimistic; autosave may not have run if the error occurred before a scene transition.

## 7. Why This Design

- Versioned save files with a migration pipeline allow schema evolution without breaking existing saves.
- The index/data split means listing saves doesn't require parsing every save file.
- Autosave on scene transition is a natural checkpoint — the player has just made a meaningful decision.
- The 10-save cap prevents localStorage exhaustion.

## 8. Feels Incomplete

- `loadGame` restores all state fields but does NOT restore `caseData` (the loaded case JSON). After loading a save, `caseData` is null, so `useCurrentScene()` returns null. The game screen would render with no scene content. This is a critical bug.
- No manual save button in the UI. `saveGame` exists but is unreachable.
- No save confirmation or overwrite warning.
- No save file integrity check (checksum, hash). Corrupt or tampered saves are loaded without validation.
- `loadGame` doesn't call `loadAndStartCase` to re-fetch case data. The player would need to... there's no recovery path.

## 9. Feels Vulnerable

- `Date.now()` for save IDs means two saves in the same millisecond would collide. Unlikely but possible in automated testing.
- `new Date().toISOString()` for timestamps — not injectable for testing.
- localStorage has a ~5-10MB limit per origin. With 10 saves + autosave, each potentially 100KB+, this could approach the limit for complex game states.
- The read-modify-write pattern on the index is not atomic. If the browser crashes between writing the save data and updating the index, the save exists but isn't listed.
- No encryption or obfuscation — save files are trivially editable via browser dev tools. This is fine for a single-player game but worth noting.

## 10. Feels Like Bad Design

- The `loadGame` action not restoring `caseData` is a design gap, not just a missing feature. The save/load contract is broken: save captures state, load restores state, but the game requires both state AND loaded content to function.
- `saveGame` is `async` (returns `Promise<void>`) but contains no async operations. The `async` keyword is misleading.
- `snapshotGameState` is defined in `metaSlice.ts` as a local function, but `buildGameState` in `store/index.ts` does the same thing. This is duplicated logic.
