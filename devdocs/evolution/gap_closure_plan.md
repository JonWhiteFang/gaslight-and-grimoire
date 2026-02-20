# Gap Closure Plan

> Phased, executable plan derived from `devdocs/evolution/gap_analysis.md`. Each item is a single-PR-sized unit of work.

---

## Phase 1: Quick Wins (Immediate, Low-Risk)

These fix broken features or close trivial gaps. No architectural changes. Each is independent — can be merged in any order.

---

### 1.1 Fix `loadGame` to Restore `caseData`

**What**: After `metaSlice.loadGame` restores `GameState`, call `loadCase(gameState.currentCase)` and set `caseData` on the store.

**Files**: `src/store/slices/metaSlice.ts`

**Change**: Add import for `loadCase` from `../../engine/narrativeEngine`. After the existing `set()` call in `loadGame`, add:
```typescript
const data = await loadCase(gameState.currentCase);
set((state) => { state.caseData = data; });
```

**Dependencies**: None.

**Risk**: Low. `loadCase` is already used by `loadAndStartCase` and is well-tested. The only new behavior is calling it from `loadGame`.

**Testing**: Load a save from `LoadGameScreen` → verify scene text renders, choices appear, evidence board shows clues. Run `npm run test:run`.

**Rollback**: Revert the 2 added lines in `metaSlice.ts`.

---

### 1.2 Wire Hint Engine `trackActivity` Calls

**What**: Add 3 `trackActivity` calls so the hint engine's tracking state is actually updated.

**Files**: `src/components/EvidenceBoard/EvidenceBoard.tsx`, `src/store/slices/narrativeSlice.ts`

**Changes**:
1. `EvidenceBoard.tsx`: In the mount `useEffect`, add `trackActivity({ type: 'boardVisit' })`.
2. `EvidenceBoard.tsx`: In `handleInitiateConnection`, after a connection completes (after `setConnectingFrom(null)`), add `trackActivity({ type: 'connectionAttempt' })`.
3. `narrativeSlice.ts` → `goToScene`: After the `set()` call, add `trackActivity({ type: 'sceneChange' })`.

**Dependencies**: None.

**Risk**: Low. `trackActivity` is a simple state mutation on a module-level singleton. No store interaction.

**Testing**: Open evidence board 3 times without connecting → hint button should appear. Navigate to a new scene → hint timer should reset. Run existing `hintEngine.test.ts`.

**Rollback**: Remove the 3 added lines.

---

### 1.3 Add Ability Flag Check in `processChoice`

**What**: Before performing a dice roll in `processChoice`, check if the relevant ability auto-succeed flag is set. If so, skip the roll and return success.

**Files**: `src/engine/narrativeEngine.ts`

**Change**: In `processChoice`, before the `performCheck` call, add:
```typescript
const abilityFlag = `ability-auto-succeed-${choice.faculty}`;
if (choice.faculty && state.flags[abilityFlag]) {
  tier = 'critical';
  nextSceneId = choice.outcomes['critical'] ?? choice.outcomes['success'];
  roll = 20; modifier = 0; total = 20;
  // Note: flag is already consumed by useAbility() in App.tsx
}
```
Wrap the existing `performCheck` call in an `else` block.

**Dependencies**: None. The flags are already set by `App.tsx` → `handleActivateAbility`.

**Risk**: Low-Medium. Must ensure the flag check doesn't fire for non-ability-related flags. The `ability-auto-succeed-` prefix is unique and only set by `ABILITY_FLAGS` in `App.tsx`. Veil Sight (`ability-veil-sight-active`) uses a different prefix and wouldn't match — that ability needs separate handling (it reveals supernatural elements, not auto-succeeds a check).

**Testing**: Create character as Deductionist → activate Elementary ability → make a Reason check → verify auto-success without dice roll. Run `npm run test:run`.

**Rollback**: Remove the added `if` block.

---

### 1.4 Deduplicate `snapshotGameState`

**What**: Replace the local `snapshotGameState` in `metaSlice.ts` and the inline GameState construction in `NarrativePanel.tsx` with the shared `buildGameState` from `store/index.ts`.

**Files**: `src/store/slices/metaSlice.ts`, `src/components/NarrativePanel/NarrativePanel.tsx`

**Changes**:
1. `metaSlice.ts`: Remove local `snapshotGameState` function. Import `buildGameState` — but this creates a circular import (`store/index.ts` imports slices). So instead: create `src/store/buildGameState.ts` that imports only from `../types`. Have both `store/index.ts` and `metaSlice.ts` import from it.
2. `NarrativePanel.tsx`: Replace the inline 10-field object with `buildGameState(useStore.getState())`.

**Dependencies**: None.

**Risk**: Trivial. Mechanical refactor. The function body is identical.

**Testing**: `npm run build` (no circular dependency errors). `npm run test:run`. Save a game, load it → all state fields present.

**Rollback**: Revert the 3 file changes.

---

### 1.5 Add Manual Save Button

**What**: Add a save button to the HeaderBar that calls `store.saveGame()`.

**Files**: `src/components/HeaderBar/HeaderBar.tsx`

**Change**: Add a button next to the settings button:
```tsx
<button type="button" aria-label="Save game" onClick={() => useStore.getState().saveGame()} ...>💾</button>
```

**Dependencies**: None. `saveGame` already works.

**Risk**: Trivial.

**Testing**: Click save button → verify save appears in `LoadGameScreen` list.

**Rollback**: Remove the button.

---

### 1.6 Add Faction Reputation to Case Journal

**What**: Add a "Faction Standing" section to `CaseJournal` showing faction reputation values with narrative labels.

**Files**: `src/components/CaseJournal/CaseJournal.tsx`

**Change**: Read `factionReputation` from store. Map values to labels (e.g., ≥3 "Allied", 1–2 "Favorable", 0 "Neutral", -1–-2 "Strained", ≤-3 "Hostile"). Render as a `JournalSection`.

**Dependencies**: None.

**Risk**: Trivial.

**Testing**: Play through scenes that affect faction reputation → open journal → verify faction section appears with correct labels.

**Rollback**: Remove the added section.

---

### 1.7 Add Outcome Tier Completeness to Validators

**What**: For choices with `faculty` + `difficulty`, verify all 5 outcome tiers (`critical`, `success`, `partial`, `failure`, `fumble`) are present in `outcomes`.

**Files**: `scripts/validateCase.mjs`, `src/engine/narrativeEngine.ts` → `validateContent`

**Change**: In both validators, inside the choice iteration loop, add:
```javascript
if (choice.faculty && choice.difficulty) {
  for (const tier of ['critical', 'success', 'partial', 'failure', 'fumble']) {
    if (!choice.outcomes[tier]) {
      errors.push(`... missing outcome tier "${tier}"`);
    }
  }
}
```

**Dependencies**: None.

**Risk**: Low. May surface existing content issues (which is the point).

**Testing**: Run `node scripts/validateCase.mjs` → verify it catches a test case with a missing tier. Run `npm run test:run`.

**Rollback**: Remove the added loop.

---

## Phase 2: Incremental Improvements (Module-by-Module)

These improve architecture and add missing features. Each depends on Phase 1 being complete (for the load-game fix), but items within Phase 2 are independent of each other.

---

### 2.1 Extract Pure `computeChoiceResult` from `processChoice`

**What**: Split `processChoice` into a pure computation function and a side-effectful wrapper.

**Files**: `src/engine/narrativeEngine.ts`

**Changes**:
1. Create and export `computeChoiceResult(choice, state): ChoiceResult` — contains the dice check logic, DC resolution, advantage check. Returns `{ nextSceneId, roll, modifier, total, tier }`. No store access.
2. Modify `processChoice` to call `computeChoiceResult`, then apply NPC effects and navigate.

**Dependencies**: 1.3 (ability flag check should be in `computeChoiceResult`).

**Risk**: Low. `processChoice` callers don't change. New function is additive.

**Testing**: New unit test for `computeChoiceResult` with no store setup — pass a mock `GameState`, verify correct tier/scene for known inputs. Run `npm run test:run`.

**Rollback**: Inline `computeChoiceResult` back into `processChoice`.

---

### 2.2 Move `buildDeduction` to Engine Layer

**What**: Move `src/components/EvidenceBoard/buildDeduction.ts` to `src/engine/buildDeduction.ts`.

**Files**: `src/components/EvidenceBoard/buildDeduction.ts` (delete), `src/engine/buildDeduction.ts` (create), `src/components/EvidenceBoard/DeductionButton.tsx` (update import), `src/engine/__tests__/deductionFormation.property.test.ts` (update import)

**Dependencies**: None.

**Risk**: Trivial. Two import path changes.

**Testing**: `npm run build`. `npm run test:run`.

**Rollback**: Move the file back.

---

### 2.3 Implement ClueDiscoveryCard

**What**: Replace the stub with a working slide-in notification card.

**Files**: `src/components/NarrativePanel/ClueDiscoveryCard.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx`

**Changes**:
1. `NarrativePanel`: Track the most recently auto-discovered clue in local state. Pass it + a visibility flag to `ClueDiscoveryCard`.
2. `ClueDiscoveryCard`: Implement Framer Motion slide-in from right. Show clue type icon, title, description. Auto-dismiss after 4 seconds via `useEffect` timer. Respect `reducedMotion`.

**Dependencies**: None.

**Risk**: Low. Additive UI change. Existing auto-discovery logic in `NarrativePanel` already works.

**Testing**: Navigate to a scene with automatic clues → verify card slides in, shows correct info, auto-dismisses. Test with `reducedMotion: true`.

**Rollback**: Revert both files to restore the stub.

---

### 2.4 Create Audio Subscription (Extract SFX from Slices)

**What**: Move SFX triggering from inside Immer `set()` callbacks to a Zustand `subscribe` callback.

**Files**: New `src/store/audioSubscription.ts`. Modified: `src/store/slices/investigatorSlice.ts`, `src/store/slices/narrativeSlice.ts`, `src/store/slices/evidenceSlice.ts`, `src/main.tsx` (or `src/store/index.ts`).

**Changes**:
1. Create `audioSubscription.ts`: Subscribe to store. Compare previous and current state. Trigger SFX for: composure decrease, vitality decrease, scene change, check result, clue discovery.
2. Initialize the subscription in `main.tsx` (after store is created) or at the bottom of `store/index.ts`.
3. Remove `AudioManager.playSfx` calls from the 3 slice files. Remove `AudioManager` imports.

**Dependencies**: None, but best done after 2.1 (so `processChoice` changes are stable).

**Risk**: Low-Medium. Must verify every SFX event still fires at the correct time. The subscription sees state after mutation, so timing is slightly different (post-commit vs mid-commit). For audio this is imperceptible.

**Testing**: Play through: scene transition (hear SFX), take composure damage (hear SFX), discover a clue (hear SFX), make a faculty check (hear dice SFX). Run `npm run test:run` — slice tests should pass without AudioManager mocking.

**Rollback**: Re-add `AudioManager` calls to slices. Delete `audioSubscription.ts`.

---

### 2.5 Case Completion Screen

**What**: Add a screen/overlay that shows case completion results (faculty bonus, vignette unlock).

**Files**: New `src/components/CaseCompletion/CaseCompletion.tsx`, `src/components/CaseCompletion/index.ts`. Modified: `src/App.tsx`.

**Changes**:
1. New component: Receives `CaseCompletionResult` as props. Displays faculty bonus granted (if any) and vignette unlocked (if any). "Continue" button returns to title screen.
2. `App.tsx`: Add `'case-complete'` to `Screen` type. When `completeCase` is called, capture the result and transition to the completion screen.

**Dependencies**: None.

**Risk**: Low. Additive. No existing code changes except adding a new screen state.

**Testing**: Trigger case completion (may need to navigate to a final scene) → verify completion screen shows correct results.

**Rollback**: Remove new component. Remove `'case-complete'` screen state from `App.tsx`.

---

## Phase 3: Major Refactoring (Requires Planning)

These are larger changes that touch multiple modules. Each should be preceded by a design discussion and have a feature branch.

---

### 3.1 Encounter UI Integration

**What**: Create a UI for the encounter system so players can experience multi-round encounters with reaction checks.

**Scope**:
- New `src/components/EncounterPanel/` component (or extend `ChoicePanel`)
- Encounter state management (component-local `useState` for `EncounterState`)
- Integration with `NarrativePanel` for encounter narrative text
- Content: at least one encounter scene in the existing case to test with

**Dependencies**: 2.1 (pure `computeChoiceResult` makes encounter choice processing testable).

**Risk**: Medium. This is the largest missing feature. The engine is complete and tested, but the UI integration requires decisions about:
- Where encounter state lives (component state vs new store slice)
- How encounter scenes are triggered (a scene flag? a special scene type?)
- How the round-by-round flow interacts with the existing scene navigation

**Approach**:
1. Design the encounter scene trigger mechanism (e.g., `SceneNode.encounter?: { rounds: EncounterRound[], isSupernatural: boolean }`)
2. Build `EncounterPanel` that manages `EncounterState` locally and calls `processEncounterChoice` per round
3. Integrate into `GameContent` — when the current scene has an encounter, render `EncounterPanel` instead of `ChoicePanel`
4. Author one encounter in the existing case content for testing

**Testing**: Play through an encounter scene → verify reaction check, round progression, damage application, escape path, scene navigation on completion.

**Rollback**: Remove `EncounterPanel` component. Remove encounter trigger from content JSON.

---

### 3.2 Break Engine → Store Circular Dependency (Full)

**What**: Eliminate all `useStore` imports from engine modules.

**Scope**: After 2.1 (`computeChoiceResult` extracted), the remaining store-accessing engine functions are:
- `applyOnEnterEffects` (narrativeEngine.ts)
- `processChoice` wrapper (narrativeEngine.ts)
- `startEncounter` (narrativeEngine.ts)
- `processEncounterChoice` (narrativeEngine.ts)
- `CaseProgression.completeCase` (caseProgression.ts)
- `CaseProgression.grantFacultyBonus` (caseProgression.ts)

**Approach**:
1. `applyOnEnterEffects`: Change to return `Effect[]` (it already receives them). Move the store dispatch loop to the caller (`NarrativePanel`). Or create a store action `narrativeSlice.applyEffects(effects)`.
2. `processChoice` wrapper: Move the NPC effect + goToScene calls to `ChoicePanel.handleSelect`. `processChoice` becomes just `computeChoiceResult`.
3. `startEncounter` / `processEncounterChoice`: Move store calls to the encounter UI component (from 3.1).
4. `CaseProgression`: Change `completeCase` to return a result object. Move store mutations to the caller (`narrativeSlice.completeCase`).

**Dependencies**: 2.1, 3.1.

**Risk**: Medium. Each function can be migrated independently. The wrapper pattern (keep old function, delegate to pure function) provides backward compatibility during migration.

**Testing**: After each function migration, run `npm run test:run`. Verify the full play loop works (create character → play scenes → make choices → discover clues → form deductions).

**Rollback**: Each function migration is independently revertible.

---

### 3.3 Stale State Cleanup on New Case

**What**: When starting a new case, clear clues, NPCs, deductions, and flags from the previous case before loading new data.

**Files**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`

**Change**: Before populating clues and NPCs from the new case, reset:
```typescript
state.clues = {};
state.npcs = {};
state.deductions = {};
// Preserve cross-case flags (e.g., vignette-unlocked-*, faction rep)
// Only clear case-specific flags
```

**Dependencies**: Requires a convention for distinguishing cross-case flags from case-specific flags. Currently no such convention exists.

**Risk**: Medium. Clearing too aggressively loses cross-case state. Clearing too conservatively leaves stale data. Needs a flag naming convention (e.g., `case-*` prefix for case-specific flags).

**Testing**: Start case 1 → complete → start case 2 → verify case 1 clues/NPCs are gone, cross-case flags/reputation persist.

**Rollback**: Remove the clearing logic.

---

## Phase 4: Complete Rewrites

### None required.

The architecture is fundamentally sound. All gaps are addressable through incremental fixes (Phase 1), additive features (Phase 2), or targeted refactors (Phase 3). No module needs to be rewritten from scratch.

The closest candidate would be `narrativeEngine.ts` (400+ lines, 6 responsibilities), but it works correctly and is well-documented. Splitting it into focused modules (`sceneResolver.ts`, `choiceProcessor.ts`, `encounterEngine.ts`, `contentLoader.ts`, `contentValidator.ts`, `effectApplicator.ts`) would improve maintainability but is not blocking any feature work. This can be done opportunistically when the file next needs significant changes.

---

## Execution Summary

| Phase | Items | Total effort | Prerequisite |
|---|---|---|---|
| 1: Quick wins | 7 items | ~1 day | None |
| 2: Incremental | 5 items | ~2–3 days | Phase 1.1 (load game fix) |
| 3: Major refactoring | 3 items | ~3–5 days | Phase 2.1, 2.4 |
| 4: Rewrites | 0 items | — | — |

**Critical path**: 1.1 (load game) → 1.3 (abilities) → 2.1 (pure choice result) → 3.1 (encounter UI)

**Parallel work**: All Phase 1 items are independent. Phase 2 items 2.2–2.5 are independent of each other. Phase 3 items 3.1 and 3.3 are independent.
