# Gap Analysis

> Current state (from archaeology phases 1–9) vs desired state (from requirements, design doc, and roadmap).

---

## 1. Concepts Needing Implementation

Ordered by impact on the playable experience.

### 1.1 Load Game → Restore Case Data (CRITICAL)

**Gap**: `metaSlice.loadGame` restores all `GameState` fields but doesn't restore `caseData`. After loading a save, `useCurrentScene()` returns null. The game screen is blank.

**Desired state**: Req 11.7 — "restore the complete game state and resume at the saved Scene_Node."

**What's needed**: After restoring `GameState`, call `loadCase(gameState.currentCase)` and set `caseData` on the narrative slice.

**Effort**: ~5 lines in `metaSlice.ts`. Low risk. Blocks the entire "Continue Investigation" flow.

**Files**: `src/store/slices/metaSlice.ts`

---

### 1.2 Hint Engine Wiring (HIGH)

**Gap**: `trackActivity()` is never called from any component. The board-visit trigger (3+ visits without connections) is dead. The dwell timer starts from page load, not scene entry.

**Desired state**: Req 13.1 — hints trigger on board visits and scene dwell time.

**What's needed**: 3 `trackActivity` calls: `EvidenceBoard` mount (boardVisit), `EvidenceBoard` connection complete (connectionAttempt), `narrativeSlice.goToScene` (sceneChange).

**Effort**: 3 one-line additions across 2 files. Low risk.

**Files**: `src/components/EvidenceBoard/EvidenceBoard.tsx`, `src/store/slices/narrativeSlice.ts`

---

### 1.3 Archetype Ability Engine Integration (HIGH)

**Gap**: Ability activation sets world flags (`ability-auto-succeed-reason`, etc.) in `App.tsx`, but no engine code reads these flags. The dice engine doesn't check for auto-succeed flags. Abilities are cosmetically activated but mechanically inert.

**Desired state**: Req 15.1–15.4 — abilities auto-succeed specific faculty checks.

**What's needed**: In `processChoice` (or `performCheck`), check if the relevant ability flag is set. If so, return a `critical` or `success` result without rolling. Clear the flag after use.

**Effort**: ~10 lines in `narrativeEngine.ts` or `diceEngine.ts`. Medium risk — must not break existing check flow.

**Files**: `src/engine/narrativeEngine.ts` → `processChoice`, or `src/engine/diceEngine.ts` → `performCheck`

---

### 1.4 Clue Discovery Card (MEDIUM)

**Gap**: `ClueDiscoveryCard` is a stub ("Full implementation in Task 10"). Auto-discovered clues are added to the store but the player gets no visual notification.

**Desired state**: Req 6.3 — slide-in card with type icon, title, summary, auto-dismiss after 4 seconds.

**What's needed**: Wire `NarrativePanel` to pass the most recently discovered clue and a visibility flag to `ClueDiscoveryCard`. Implement the slide-in animation (Framer Motion) and auto-dismiss timer.

**Effort**: ~30 lines across 2 files. Low risk.

**Files**: `src/components/NarrativePanel/ClueDiscoveryCard.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx`

---

### 1.5 Encounter UI (MEDIUM)

**Gap**: The encounter engine (`startEncounter`, `processEncounterChoice`, `getEncounterChoices`) is fully implemented and tested. No UI component renders encounters. Players cannot experience encounters.

**Desired state**: Req 9.1–9.7 — multi-round encounters with reaction checks, faculty choices, and damage.

**What's needed**: Either a dedicated `EncounterPanel` component or integration into the existing `ChoicePanel`/`NarrativePanel` flow. Encounter state must be managed somewhere (component state or a new store slice). Scene content must include encounter-triggering scenes.

**Effort**: Significant — new component (~100–200 lines), encounter state management, content authoring for encounter scenes. Medium-high risk.

**Files**: New `src/components/EncounterPanel/` or modifications to `src/components/ChoicePanel/`, `src/components/NarrativePanel/`

---

### 1.6 Manual Save Button (LOW)

**Gap**: `metaSlice.saveGame()` exists and works but no UI element triggers it.

**Desired state**: Req 11.6 — manual save when auto-save is set to "manual".

**What's needed**: A save button in `HeaderBar` or `SettingsPanel`.

**Effort**: ~10 lines. Trivial risk.

**Files**: `src/components/HeaderBar/HeaderBar.tsx` or `src/components/SettingsPanel/SettingsPanel.tsx`

---

### 1.7 Case Completion Screen (LOW)

**Gap**: `CaseProgression.completeCase()` returns `{ facultyBonusGranted, vignetteUnlocked }` but no UI renders these results.

**Desired state**: Design doc §14.1 — after completing a case, show faculty advancement, new contacts, faction shifts, side case unlocks.

**What's needed**: A new screen or overlay in `App.tsx` that renders completion results before returning to the title screen or starting the next case.

**Effort**: New component (~50–100 lines), new screen state in `App.tsx`. Low risk.

**Files**: New `src/components/CaseCompletion/`, `src/App.tsx`

---

### 1.8 Faction Reputation Display (LOW)

**Gap**: Faction reputation is tracked and used for vignette unlocks but never shown to the player.

**Desired state**: Implied by Req 19 — players should understand their faction standing.

**What's needed**: A faction reputation section in `CaseJournal` or a dedicated panel.

**Effort**: ~20 lines added to `CaseJournal.tsx`. Trivial risk.

**Files**: `src/components/CaseJournal/CaseJournal.tsx`

---

### 1.9 Non-Automatic Clue Discovery Methods (LOW)

**Gap**: `ClueDiscovery.method` supports `'exploration'`, `'check'`, and `'dialogue'` but only `'automatic'` is handled in `NarrativePanel`.

**Desired state**: Req 6.1 — clues discovered through exploration choices, successful checks, and dialogue.

**What's needed**: These methods are implicitly handled by content design — an "exploration" clue would be gated by a choice that leads to a scene with an `onEnter` `discoverClue` effect. The `method` field is metadata, not a trigger mechanism. The gap is smaller than it appears — the content contract (Condition/Effect) already supports all discovery paths. What's missing is explicit UI for "Search the desk" style exploration choices within a scene.

**Effort**: Primarily a content authoring concern, not a code gap.

---

## 2. Architecture Changes Required

### 2.1 Break Engine → Store Circular Dependency

**Current**: `narrativeEngine.ts` and `caseProgression.ts` import `useStore` from the store. Store slices import from engine modules. This creates a bidirectional dependency.

**Required change**: Engine functions that currently call `useStore.getState()` should instead:
- Accept state as a parameter (already done for pure functions like `evaluateConditions`)
- Return effect descriptors that the caller applies to the store

**Incremental path**:
1. Extract `computeChoiceResult` from `processChoice` — pure function, no store access. Keep `processChoice` as a thin wrapper.
2. Move `applyOnEnterEffects` to a store action or a component-level helper that calls store actions.
3. Refactor `CaseProgression.completeCase` to return results without calling store actions directly.

**Risk**: Medium. Each step is independently deployable. The wrapper pattern preserves backward compatibility.

**Blocked by**: Nothing. Can start immediately.

---

### 2.2 Extract SFX from Store Mutations

**Current**: `AudioManager.playSfx()` called inside Immer `set()` callbacks in 3 slice files.

**Required change**: Move SFX triggering to a Zustand `subscribe` callback that detects state changes and plays appropriate sounds.

**Incremental path**:
1. Create `src/store/audioSubscription.ts` — subscribes to store, detects composure/vitality decreases, scene changes, clue discoveries, check results.
2. Remove `AudioManager` imports from slice files one at a time.
3. Verify SFX still plays for each event.

**Risk**: Low. Each slice can be migrated independently. Rollback: re-add the `AudioManager` call to the slice.

---

### 2.3 Deduplicate GameState Snapshot Builders

**Current**: `buildGameState` in `store/index.ts` and `snapshotGameState` in `metaSlice.ts` are identical. `NarrativePanel` also constructs the same object inline.

**Required change**: Single shared function. Must avoid circular imports (store/index.ts imports slices, slices can't import from store/index.ts).

**Incremental path**:
1. Create `src/store/buildGameState.ts` — imports only from `../types`.
2. `store/index.ts` re-exports from it.
3. `metaSlice.ts` imports from it (replacing local `snapshotGameState`).
4. `NarrativePanel` imports from it (replacing inline construction).

**Risk**: Trivial. Mechanical refactor. Verify with `npm run build` + `npm run test:run`.

---

### 2.4 Move `buildDeduction` to Engine Layer

**Current**: `src/components/EvidenceBoard/buildDeduction.ts` is a pure function tested in `src/engine/__tests__/`.

**Required change**: Move to `src/engine/buildDeduction.ts`. Update imports in `DeductionButton.tsx` and the test file.

**Risk**: Trivial. Two import path changes.

---

## 3. Technical Debt Blocking Progress

### 3.1 `loadGame` Doesn't Restore `caseData` — Blocks Save/Load

This is the single most impactful bug. The "Continue Investigation" button on the title screen leads to a blank game screen. Every other save/load feature (autosave, manual save, save list, delete) works correctly, but the load path is broken.

**Blocks**: Any user flow that involves returning to a saved game.

**Fix**: Add `loadCase(gameState.currentCase)` call after state restoration in `loadGame`. ~5 lines.

---

### 3.2 Ability Flags Not Read by Engine — Blocks Archetype Abilities

Ability activation sets world flags but no engine code reads them. The `performCheck` and `processChoice` functions don't check for auto-succeed flags. This means archetype abilities are visually activated but have no mechanical effect.

**Blocks**: The core archetype differentiation mechanic (Req 15).

**Fix**: Add a flag check in `processChoice` before calling `performCheck`. If the relevant ability flag is set, skip the roll and return success. ~10 lines.

---

### 3.3 Hint Tracking Not Wired — Blocks Hint System

The hint engine's input pipeline is disconnected. `trackActivity` is never called. The board-visit trigger can never fire. The dwell timer starts from page load.

**Blocks**: The hint system's primary trigger mechanism (Req 13.1).

**Fix**: 3 one-line `trackActivity` calls in 2 files.

---

### 3.4 `processChoice` Impurity — Blocks Engine Testability

`processChoice` calls `useStore.getState()` internally, making it impossible to unit test without a full Zustand store setup. This is the most-called engine function and the hardest to test.

**Blocks**: Adding new choice processing logic (e.g., disadvantage support, ability auto-succeed) with confidence.

**Fix**: Extract `computeChoiceResult` as a pure function. Keep `processChoice` as a wrapper. New logic targets the pure function.

---

### 3.5 Outcome Tier Completeness Not Validated — Latent Crash Risk

Neither `validateCase.mjs` nor `validateContent` checks that faculty-check choices have all 5 outcome tiers defined. A missing tier causes `goToScene(undefined)` → crash at render time.

**Blocks**: Safe content authoring. Any new case content could introduce a crash.

**Fix**: Add tier completeness check to both validators. ~15 lines each.

---

## 4. What Can Be Incrementally Improved

These are ordered by effort (smallest first) and can each be a single PR.

| # | Improvement | Effort | Files | Risk |
|---|---|---|---|---|
| 1 | Fix `loadGame` to restore `caseData` | ~5 lines | `metaSlice.ts` | Low |
| 2 | Wire hint `trackActivity` calls | 3 lines | `EvidenceBoard.tsx`, `narrativeSlice.ts` | Low |
| 3 | Add ability flag check in `processChoice` | ~10 lines | `narrativeEngine.ts` | Low-Med |
| 4 | Deduplicate `snapshotGameState` → shared `buildGameState` | ~15 lines | 3 files | Trivial |
| 5 | Move `buildDeduction` to engine layer | 0 new lines | 3 files (move + 2 import updates) | Trivial |
| 6 | Add manual save button | ~10 lines | `HeaderBar.tsx` | Trivial |
| 7 | Add faction reputation to CaseJournal | ~20 lines | `CaseJournal.tsx` | Trivial |
| 8 | Add outcome tier completeness to validators | ~15 lines each | `validateCase.mjs`, `narrativeEngine.ts` | Low |
| 9 | Implement ClueDiscoveryCard | ~30 lines | `ClueDiscoveryCard.tsx`, `NarrativePanel.tsx` | Low |
| 10 | Extract `computeChoiceResult` pure function | ~20 lines | `narrativeEngine.ts` | Low |
| 11 | Create audio subscription (extract SFX from slices) | ~40 lines new, ~15 lines removed | 4 files | Low-Med |
| 12 | Add case completion screen | ~80 lines | New component + `App.tsx` | Low |
| 13 | Encounter UI component | ~150–200 lines | New component | Med |

Items 1–3 fix broken features. Items 4–8 are cleanup. Items 9–13 are new features.

---

## 5. What Requires a Rewrite

### Nothing requires a full rewrite.

The architecture is sound in its fundamentals:
- The type system is comprehensive and consistent (~220 lines, single file, used everywhere).
- The Zustand + Immer store pattern is well-executed (6 clean slices, selector hooks, action hooks).
- The Condition/Effect content contract is the right abstraction (8 condition types, 7 effect types, AND logic).
- The component directory convention is followed without exception.
- The content/engine separation is enforced.

The issues are all incremental:
- **Broken features** (load game, hints, abilities) are 3–10 line fixes each.
- **Architectural violations** (engine↔store coupling, SFX in mutations) can be fixed by extracting pure functions and adding a subscription layer — no existing code needs to be deleted, only wrapped.
- **Missing features** (encounter UI, case completion, clue discovery card) are additive — they don't require changing existing code, only adding new components.

### Partial rewrites to consider (not urgent)

**`narrativeEngine.ts` decomposition**: At 400+ lines with 6 responsibilities (loading, conditions, scenes, effects, choices, encounters), this file would benefit from splitting into focused modules. But it works correctly and the functions are well-documented. This is a "when it gets painful" refactor, not a "do it now" one.

**Hint engine → Zustand slice**: The module-level singleton with `Date.now()` calls is architecturally inconsistent. Moving hint state into the store would make it testable, persistable, and consistent with everything else. But the current implementation works (once wired), and the `_setState` test helpers are an adequate workaround. This is a "nice to have" refactor.

---

## Risk Summary

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Load game blank screen ships to users | High (it's broken now) | Critical — breaks resume flow | Fix #1: restore caseData on load |
| Content author adds choice with missing outcome tier | Medium | High — runtime crash | Fix #8: add tier completeness validation |
| Ability activation appears to work but does nothing | High (it's broken now) | Medium — misleading UX | Fix #3: add flag check in processChoice |
| New engine logic added to impure `processChoice` | Medium | Medium — untestable | Fix #10: extract pure `computeChoiceResult` |
| Audio files added but SFX timing is wrong due to Immer batching | Low (Immer doesn't batch today) | Low | Fix #11: audio subscription |

## Unknowns

1. **Content volume**: The engine supports arbitrary cases but only one exists. The architecture's scalability claims (normalized state, flat maps, variant system) are untested at scale. Adding 3–5 more cases would be the real stress test.

2. **Encounter content**: The encounter engine exists but no case content uses encounter-type scenes. It's unclear whether the current case JSON structure can express encounters or if the content schema needs extension.

3. **Cross-case persistence**: The vignette unlock system and variant scene system are implemented but untestable with only one main case. The `loadAndStartCase` function doesn't clear old clues/NPCs before loading new ones — starting a second case would merge state from both.

4. **Mobile performance**: The app targets browsers broadly but has never been tested on mobile. The `html5: false` Howler config may block audio on mobile Safari without user interaction. The Evidence Board's mouse-tracking ghost thread has no touch equivalent.

5. **Save file size at scale**: With 10 manual saves + autosave, each containing clues/NPCs/flags from multiple cases, localStorage's ~5MB limit could be reached. No monitoring or warning exists.
