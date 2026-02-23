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


---

## ~~R8. Widen Dice Partial Band and Lower Default DC~~ — ✅ DONE

**Resolution**: Partial band widened (`dc - 3`). Trained bonus (+1 for archetype primary faculty) added via `getTrainedBonus`. All 34 content DCs lowered by 2. Encounter reaction check stays at DC 12.

---

## R9. Persist Evidence Board Connections in Store

**Status**: Not started (Phase E6)

**What**: Move `connections` from React `useState` in `EvidenceBoard` to `evidenceSlice` in the Zustand store. Connections survive board close/reopen.

**Why**: Players lose work when closing the board. The signature mechanic has unnecessary friction. Also enables save/load of board state.

**Files**: `src/store/slices/evidenceSlice.ts`, `src/components/EvidenceBoard/EvidenceBoard.tsx`

**Effort**: Medium.

---

## R10. Add Narrative Text to Effect Objects

**Status**: Not started (Phase E9)

**What**: Add optional `narrativeText` field to `Effect` type. Render inline notifications when effects fire.

**Why**: `onEnter` effects fire silently. Players see meters change with no narrative explanation, breaking the story-mechanics connection.

**Files**: `src/types/index.ts`, `src/components/NarrativePanel/NarrativePanel.tsx`, content JSON

**Effort**: Low.

---

## R11. Inject Randomness and Time Dependencies

**Status**: Not started (deferred)

**What**: Make `rollD20()` accept an optional RNG function. Make `hintEngine` and `buildDeduction` accept a `Clock` interface. Make `saveManager` accept a timestamp provider.

**Why**: `Math.random()` and `Date.now()` are used directly throughout. Tests work around this with `_setState` hacks. Injectable dependencies would make all engine functions fully deterministic and testable.

**Files**: `src/engine/diceEngine.ts`, `src/engine/hintEngine.ts`, `src/engine/buildDeduction.ts`, `src/engine/saveManager.ts`

**Effort**: Medium. Touches many files but each change is mechanical.
