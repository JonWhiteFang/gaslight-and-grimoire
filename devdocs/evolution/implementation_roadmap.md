# Implementation Roadmap

> Combines cleanup, refactors, bug fixes, and feature gaps into a phased execution plan. Each item is a single-PR unit of work.

---

## Phase A: Foundation (Stabilize the Baseline) — ✅ COMPLETE

Goal: Fix broken core functionality and eliminate duplication. After this phase, the game's primary flows (new game, play, save, load) all work correctly.

### A1. Fix `loadGame` to Restore `caseData` — ✅ DONE

**Files**: `src/store/slices/metaSlice.ts`

**What**: After restoring `GameState`, call `loadCase(gameState.currentCase)` and set `caseData`.

**Resolution**: Added `await loadCase(gameState.currentCase)` after state restoration in `loadGame`, with a second `set()` call to populate `caseData`.

---

### A2. Deduplicate GameState Snapshot Builders — ✅ DONE

**Files**: New `src/utils/gameState.ts`. Modified: `src/store/index.ts`, `src/store/slices/metaSlice.ts`, `src/components/NarrativePanel/NarrativePanel.tsx`, `src/engine/caseProgression.ts`, `src/store/slices/narrativeSlice.ts`.

**What**: Create shared `snapshotGameState` function. Replace all duplicates with imports.

**Resolution**: Created `src/utils/gameState.ts` as a neutral location (avoids circular deps). `buildGameState` in `store/index.ts` re-exports it. Removed local copies from `metaSlice.ts`, inline construction from `NarrativePanel.tsx`, `caseProgression.ts`, and `narrativeSlice.ts`.

---

### A3. Wire Hint Engine `trackActivity` Calls — ✅ DONE

**Files**: `src/components/EvidenceBoard/EvidenceBoard.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx`

**What**: Add `trackActivity({ type: 'boardVisit' })` on board mount, `trackActivity({ type: 'connectionAttempt' })` on connection complete, `trackActivity({ type: 'sceneChange' })` on scene change.

**Resolution**: Added `trackActivity` calls in `EvidenceBoard` (mount + connection) and `NarrativePanel` (scene change useEffect). Hint tracking wired to `NarrativePanel` instead of `narrativeSlice.goToScene` to keep engine-layer clean.

---

### A4. Add Ability Flag Check in `processChoice` — ✅ DONE

**Files**: `src/engine/narrativeEngine.ts`

**What**: Before `performCheck`, check if `ability-auto-succeed-{faculty}` flag is set. If so, return `critical` without rolling.

**Resolution**: Added `ABILITY_AUTO_SUCCEED_FLAGS` mapping (reason/vigor/influence → flag names). `processChoice` checks the flag before `performCheck` and returns `critical` tier with `choice.outcomes['critical']` as next scene.

---

### A5. Add Outcome Tier Completeness to Validators

**Files**: `scripts/validateCase.mjs`, `src/engine/narrativeEngine.ts` → `validateContent`

**What**: For choices with `faculty` + `difficulty`, verify all 5 outcome tiers exist.

**Status**: Not yet started. Deferred to Phase B (B5 runtime validation depends on this).

---

### A6. Introduce `firstScene` in Case Meta — ✅ DONE

**Files**: `src/types/index.ts`, `src/store/slices/narrativeSlice.ts`, `content/cases/the-whitechapel-cipher/meta.json`, `content/side-cases/a-matter-of-shadows/meta.json`, `scripts/validateCase.mjs`

**What**: Add optional `firstScene` field to `CaseMeta` and `VignetteMeta`. Use it in `loadAndStartCase` with fallback.

**Resolution**: Added `firstScene?: string` to both meta types. Set `"firstScene"` in both existing meta.json files. `loadAndStartCase` uses `data.meta.firstScene ?? Object.keys(data.scenes)[0]` with console warning on fallback. `validateCase.mjs` warns if missing, errors if referencing unknown scene.

---

**Phase A summary**: 5 of 6 items complete. A5 (outcome tier validation) deferred to Phase B. After completion: load game works, hints work, abilities work, snapshot duplication is gone, firstScene is explicit.

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

### D4. Remove `snapshotGameState` and Inline Construction — ✅ DONE (completed in Phase A2)

Completed as part of A2. All snapshot builders now use the shared `snapshotGameState` from `src/utils/gameState.ts`.

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
Phase A (✅ COMPLETE, except A5):
  A1✅  A2✅  A3✅  A4✅  A5  A6✅

Phase B:
  A4✅ → B1 → B4
  A5 → B5
  B2 (independent)
  B3 (independent, best after B1)

Phase C (all independent, A1✅ before C2):
  C1  C2  C3  C4  C5

Phase D:
  B1 → D1
  D2 → D3
  A2✅ → D4✅
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
