# Implementation Roadmap

> Combines cleanup, refactors, bug fixes, and feature gaps into a phased execution plan. Each item is a single-PR unit of work.

---

## Phase A: Foundation (Stabilize the Baseline)

Goal: Fix broken core functionality and eliminate duplication. After this phase, the game's primary flows (new game, play, save, load) all work correctly.

### A1. Fix `loadGame` to Restore `caseData`

**Files**: `src/store/slices/metaSlice.ts`

**What**: After restoring `GameState`, call `loadCase(gameState.currentCase)` and set `caseData`.

**Dependencies**: None.

**Success criteria**: Load a save from `LoadGameScreen` → scene text renders, choices appear, evidence board shows clues.

**Risk**: Low.

**Verification**: Manual: load a save. Automated: `npm run test:run` (existing tests still pass).

---

### A2. Deduplicate GameState Snapshot Builders

**Files**: New `src/store/buildGameState.ts`. Modified: `src/store/index.ts`, `src/store/slices/metaSlice.ts`, `src/components/NarrativePanel/NarrativePanel.tsx`.

**What**: Create shared `buildGameState` function. Replace `snapshotGameState` and inline construction with imports.

**Dependencies**: None.

**Success criteria**: `npm run build` succeeds (no circular imports). `npm run test:run` passes. Save/load still works.

**Risk**: Trivial.

**Verification**: `npm run build` + `npm run test:run`. Manual: save game, load game, verify all state fields present.

---

### A3. Wire Hint Engine `trackActivity` Calls

**Files**: `src/components/EvidenceBoard/EvidenceBoard.tsx`, `src/store/slices/narrativeSlice.ts`

**What**: Add `trackActivity({ type: 'boardVisit' })` on board mount, `trackActivity({ type: 'connectionAttempt' })` on connection complete, `trackActivity({ type: 'sceneChange' })` in `goToScene`.

**Dependencies**: None.

**Success criteria**: Open evidence board 3 times without connecting → hint button appears. Navigate to new scene → hint timer resets.

**Risk**: Low.

**Verification**: `npm run test:run`. Manual: test hint button appearance.

---

### A4. Add Ability Flag Check in `processChoice`

**Files**: `src/engine/narrativeEngine.ts`

**What**: Before `performCheck`, check if `ability-auto-succeed-{faculty}` flag is set. If so, return success without rolling.

**Dependencies**: None.

**Success criteria**: Activate Deductionist's Elementary ability → make a Reason check → auto-succeeds.

**Risk**: Low-Medium. Must not match non-ability flags.

**Verification**: `npm run test:run`. Manual: test each archetype's ability.

---

### A5. Add Outcome Tier Completeness to Validators

**Files**: `scripts/validateCase.mjs`, `src/engine/narrativeEngine.ts` → `validateContent`

**What**: For choices with `faculty` + `difficulty`, verify all 5 outcome tiers exist.

**Dependencies**: None.

**Success criteria**: `node scripts/validateCase.mjs` catches a choice with a missing tier. Existing content passes (all tiers present).

**Risk**: Low. May surface existing content issues.

**Verification**: `node scripts/validateCase.mjs` exits 0 for current content. Add a test case with missing tier → verify it's caught.

---

### A6. Introduce `firstScene` in Case Meta

**Files**: `src/types/index.ts` → `CaseMeta`, `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`, `content/cases/the-whitechapel-cipher/meta.json`, `content/side-cases/a-matter-of-shadows/meta.json`

**What**: Add optional `firstScene` field to `CaseMeta`. Use it in `loadAndStartCase` with fallback to `Object.keys()[0]`.

**Dependencies**: None.

**Success criteria**: Case loads and starts at the correct scene. Removing `firstScene` from meta.json falls back to current behavior.

**Risk**: Low.

**Verification**: `npm run test:run`. `node scripts/validateCase.mjs`. Manual: start new game → verify correct first scene.

---

**Phase A summary**: 6 items. ~50 lines of changes total. All independent — can be merged in any order. After completion: load game works, hints work, abilities work, content validation is stronger, snapshot duplication is gone.

---

## Phase B: Core Refactoring (Improve Architecture)

Goal: Separate pure logic from side effects. Establish patterns that make future changes safer and more testable.

### B1. Extract Pure `computeChoiceResult`

**Files**: `src/engine/narrativeEngine.ts`

**What**: Extract the pure computation (dice check, DC resolution, advantage, tier, next scene) into `computeChoiceResult(choice, state): ChoiceResult`. Keep `processChoice` as a wrapper.

**Dependencies**: A4 (ability flag check should be in the pure function).

**Success criteria**: New unit test for `computeChoiceResult` passes with no store setup. `processChoice` behavior unchanged.

**Risk**: Low.

**Verification**: New test file `src/engine/__tests__/computeChoiceResult.test.ts`. `npm run test:run`.

---

### B2. Move `buildDeduction` to Engine Layer

**Files**: Move `src/components/EvidenceBoard/buildDeduction.ts` → `src/engine/buildDeduction.ts`. Update imports in `src/components/EvidenceBoard/DeductionButton.tsx` and `src/engine/__tests__/deductionFormation.property.test.ts`.

**Dependencies**: None.

**Success criteria**: `npm run build` succeeds. `npm run test:run` passes. No cross-layer imports in engine tests.

**Risk**: Trivial.

**Verification**: `npm run build` + `npm run test:run`.

---

### B3. Create Audio Subscription

**Files**: New `src/store/audioSubscription.ts`. Modified: `src/store/slices/investigatorSlice.ts`, `src/store/slices/narrativeSlice.ts`, `src/store/slices/evidenceSlice.ts`. Modified: `src/main.tsx` or `src/store/index.ts` (subscription init).

**What**: Subscribe to store. Detect composure/vitality decreases, scene changes, check results, clue discoveries. Trigger SFX. Remove `AudioManager` calls from slices.

**Dependencies**: None, but best done after B1 (stable choice processing).

**Success criteria**: All SFX events still fire at correct times. Slice tests pass without AudioManager mocking.

**Risk**: Low-Medium. Must verify each SFX event.

**Verification**: Manual: play through scene transition, take damage, discover clue, make check — hear all SFX. `npm run test:run`.

---

### B4. Consolidate `CheckResult` Types

**Files**: `src/engine/diceEngine.ts`, `src/store/slices/narrativeSlice.ts`

**What**: Remove `natural` field from engine `CheckResult` (redundant with `roll`). Delete local `CheckResult` in narrativeSlice. Import from diceEngine.

**Dependencies**: B1 (so `computeChoiceResult` uses the canonical type).

**Success criteria**: Single `CheckResult` type across codebase. `npm run test:run` passes.

**Risk**: Low.

**Verification**: `npm run build` + `npm run test:run`.

---

### B5. Add Runtime Content Validation

**Files**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`

**What**: Call `validateContent(data)` after `loadCase` returns. Throw on failure.

**Dependencies**: A5 (tier completeness added to validator first).

**Success criteria**: Broken content JSON causes a descriptive error at load time, not a crash at render time.

**Risk**: Low.

**Verification**: Temporarily break a scene reference in content JSON → verify error is caught and displayed (once error UI exists). Restore content. `npm run test:run`.

---

**Phase B summary**: 5 items. ~80 lines of changes. B1 depends on A4. B4 depends on B1. B5 depends on A5. B2 and B3 are independent. After completion: engine functions are pure and testable, SFX is decoupled from state mutations, types are consolidated, content is validated at runtime.

---

## Phase C: Gap Filling (Add Missing Features)

Goal: Implement features that are engine-complete but UI-incomplete, and add missing UI elements.

### C1. Implement ClueDiscoveryCard

**Files**: `src/components/NarrativePanel/ClueDiscoveryCard.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx`

**What**: Replace stub with Framer Motion slide-in card. Wire `NarrativePanel` to pass discovered clue + visibility flag. Auto-dismiss after 4 seconds.

**Dependencies**: None.

**Success criteria**: Navigate to scene with automatic clues → card slides in with type icon, title, description. Auto-dismisses. Respects `reducedMotion`.

**Risk**: Low.

**Verification**: Manual test. `npm run test:run`.

---

### C2. Add Manual Save Button

**Files**: `src/components/HeaderBar/HeaderBar.tsx`

**What**: Add 💾 button that calls `saveGame()`.

**Dependencies**: A1 (load must work for saves to be useful).

**Success criteria**: Click save → save appears in load game list.

**Risk**: Trivial.

**Verification**: Manual: save, then load from list.

---

### C3. Add Faction Reputation to Case Journal

**Files**: `src/components/CaseJournal/CaseJournal.tsx`

**What**: New "Faction Standing" section with narrative labels for reputation values.

**Dependencies**: None.

**Success criteria**: Journal shows faction names with labels (Allied/Favorable/Neutral/Strained/Hostile).

**Risk**: Trivial.

**Verification**: Manual: play scenes that affect faction rep → open journal → verify.

---

### C4. Display Load Error on Title Screen

**Files**: `src/components/TitleScreen/TitleScreen.tsx`, `src/App.tsx`

**What**: Pass `loadError` as a prop to `TitleScreen`. Render as a dismissible banner.

**Dependencies**: None.

**Success criteria**: If case loading fails, title screen shows error message.

**Risk**: Trivial.

**Verification**: Temporarily break a content URL → verify error banner appears.

---

### C5. Case Completion Screen

**Files**: New `src/components/CaseCompletion/CaseCompletion.tsx`, `src/components/CaseCompletion/index.ts`. Modified: `src/App.tsx`.

**What**: New screen showing faculty bonus granted and vignette unlocked. "Continue" button returns to title.

**Dependencies**: None (engine `completeCase` already works).

**Success criteria**: Trigger case completion → see results screen with correct data.

**Risk**: Low.

**Verification**: Manual: reach case end → verify completion screen.

---

**Phase C summary**: 5 items. All independent. ~150 lines total. After completion: clue discovery has visual feedback, manual save works, faction reputation is visible, load errors are displayed, case completion has a screen.

---

## Phase D: Integration & Polish (Advanced Features)

Goal: Wire up the remaining engine-complete features and clean up remaining debt.

### D1. Encounter UI Integration

**Files**: New `src/components/EncounterPanel/EncounterPanel.tsx`, `src/components/EncounterPanel/index.ts`. Modified: `src/App.tsx` or `src/components/NarrativePanel/NarrativePanel.tsx`.

**What**: Component that manages `EncounterState` locally, renders reaction check results, round-by-round choices, damage feedback. Integrates with existing `ChoiceCard` for choice rendering.

**Dependencies**: B1 (pure `computeChoiceResult` for testable encounter choice processing).

**Success criteria**: Play through a supernatural encounter → reaction check fires, choices render per round, damage applies, escape path available, scene navigates on completion.

**Risk**: Medium. Largest new component. Requires encounter content in case JSON.

**Verification**: Author one encounter scene in existing case. Manual playthrough. New component tests.

---

### D2. Stale State Cleanup on New Case

**Files**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase`

**What**: Clear `clues`, `npcs`, `deductions` before loading new case data. Preserve cross-case flags and faction reputation.

**Dependencies**: Requires a flag naming convention (e.g., `case-*` prefix for case-specific flags).

**Success criteria**: Start case 1 → complete → start case 2 → case 1 clues/NPCs are gone, cross-case state persists.

**Risk**: Medium. Must not clear cross-case state.

**Verification**: Manual: play two cases in sequence. Verify state isolation.

---

### D3. Remove Superseded `startNewCase` Action

**Files**: `src/store/slices/narrativeSlice.ts`, `src/components/__tests__/AbilityButton.test.tsx`

**What**: Remove `startNewCase` (superseded by `loadAndStartCase`). Update test to use `loadAndStartCase` or direct `set()`.

**Dependencies**: D2 (ensure `loadAndStartCase` handles all case-start concerns).

**Success criteria**: `npm run test:run` passes. No references to `startNewCase` remain.

**Risk**: Low.

**Verification**: `npm run test:run`. Grep for `startNewCase` → 0 results.

---

### D4. Remove `snapshotGameState` and Inline Construction

**Files**: `src/store/slices/metaSlice.ts`, `src/components/NarrativePanel/NarrativePanel.tsx`

**What**: Delete `snapshotGameState` function. Replace inline 10-field object with `buildGameState` import. (The shared module was created in A2.)

**Dependencies**: A2 (shared `buildGameState` module exists).

**Success criteria**: `npm run build` + `npm run test:run`. No duplicate snapshot builders remain.

**Risk**: Trivial.

**Verification**: Grep for `snapshotGameState` → 0 results. Grep for inline `investigator:.*currentScene:.*currentCase:` → 0 results.

---

### D5. Remove Redundant `CheckResult.natural` Field

**Files**: `src/engine/diceEngine.ts`

**What**: Remove `natural` field from `CheckResult` interface and from `performCheck` return. It's always identical to `roll`.

**Dependencies**: B4 (type consolidation complete).

**Success criteria**: `npm run test:run` passes. No code references `natural` field.

**Risk**: Low. Must verify no test asserts on `natural` separately from `roll`.

**Verification**: `npm run test:run`. Grep for `\.natural` in test files → 0 results.

---

**Phase D summary**: 5 items. D1 is the largest (~150–200 lines). D2–D5 are cleanup. After completion: encounters are playable, cross-case state is clean, all identified dead code is removed.

---

## Dependency Graph

```
Phase A (all independent):
  A1  A2  A3  A4  A5  A6

Phase B:
  A4 → B1 → B4
  A5 → B5
  B2 (independent)
  B3 (independent, best after B1)

Phase C (all independent, A1 before C2):
  C1  C2  C3  C4  C5

Phase D:
  B1 → D1
  D2 → D3
  A2 → D4
  B4 → D5
```

## Timeline Estimate

| Phase | Items | Effort | Cumulative |
|---|---|---|---|
| A: Foundation | 6 | ~1 day | 1 day |
| B: Core Refactoring | 5 | ~2 days | 3 days |
| C: Gap Filling | 5 | ~1.5 days | 4.5 days |
| D: Integration & Polish | 5 | ~2.5 days | 7 days |

**Critical path**: A4 → B1 → D1 (ability fix → pure choice result → encounter UI)

**Parallel tracks**:
- Track 1: A1 → C2 (load fix → save button)
- Track 2: A2 → D4 (dedup → cleanup)
- Track 3: A5 → B5 (validation → runtime validation)
- Track 4: A3, A6, B2, B3, C1, C3, C4, C5 (all independent)
