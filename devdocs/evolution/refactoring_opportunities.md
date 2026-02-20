# Refactoring Opportunities

> Ordered by ROI for enabling AI-driven development. Each opportunity makes the codebase more testable, more predictable, and easier for automated agents to modify safely.

---

## R1. ~~Extract Pure `computeChoiceResult` from `processChoice`~~ — ✅ DONE (Phase B1)

**Resolution**: Created `computeChoiceResult(choice, state): ChoiceResult` as a pure function in `narrativeEngine.ts`. Handles ability auto-succeed, dice checks, advantage, DC resolution. `processChoice` is now a thin wrapper.

---

## R2. ~~Deduplicate GameState Snapshot to Shared Module~~ — ✅ DONE (Phase A2)

**Resolution**: Created `src/utils/gameState.ts` exporting `snapshotGameState`. `store/index.ts` re-exports as `buildGameState`. All 4 duplicate sites (metaSlice, NarrativePanel, caseProgression, narrativeSlice) now import from the shared util.

---

## R3. ~~Move SFX Triggering to Store Subscription~~ — ✅ DONE (Phase B3)

**Resolution**: Created `src/store/audioSubscription.ts` with `initAudioSubscription()`. Subscribes to store, detects composure/vitality decreases, scene changes, dice rolls, clue discoveries. Initialized in `main.tsx`. All `AudioManager.playSfx` calls removed from slice files.

---

## R4. ~~Move `buildDeduction` from Component to Engine Layer~~ — ✅ DONE (Phase B2)

**Resolution**: Moved to `src/engine/buildDeduction.ts`. Updated imports in `DeductionButton.tsx` and `deductionFormation.property.test.ts`.

---

## R5. ~~Introduce `firstScene` Field in Case Meta~~ — ✅ DONE (Phase A6)

**Resolution**: Added `firstScene?: string` to `CaseMeta` and `VignetteMeta`. Both existing meta.json files updated. `loadAndStartCase` uses `data.meta.firstScene` with `Object.keys` fallback + console warning. `validateCase.mjs` validates the field.

---

## R6. ~~Consolidate `CheckResult` Type Duplication~~ — ✅ DONE (Phase B4)

**Resolution**: Removed `natural` field (redundant with `roll`), made `dc` optional in `diceEngine.ts`. Deleted local `CheckResult` from `narrativeSlice.ts`, now imports from `diceEngine`. Single type across codebase.

---

## R7. ~~Add Runtime Content Validation After `loadCase`~~ — ✅ DONE (Phase B5)

**Resolution**: `validateContent` now includes outcome tier completeness checking. Called in `loadAndStartCase` after `loadCase` — throws on failure, caught by `App.handleStartCase`. Same tier check added to `validateCase.mjs`.
