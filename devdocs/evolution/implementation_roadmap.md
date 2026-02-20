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

## Phase B: Core Refactoring (Improve Architecture) — ✅ COMPLETE

Goal: Separate pure logic from side effects. Establish patterns that make future changes safer and more testable.

### B1. Extract Pure `computeChoiceResult` — ✅ DONE

**Resolution**: Created `computeChoiceResult(choice, state): ChoiceResult` as a pure function in `narrativeEngine.ts`. Handles ability auto-succeed, dice checks, advantage, DC resolution. `processChoice` is now a thin wrapper: calls `computeChoiceResult`, applies NPC effects, navigates.

---

### B2. Move `buildDeduction` to Engine Layer — ✅ DONE

**Resolution**: Moved `src/components/EvidenceBoard/buildDeduction.ts` → `src/engine/buildDeduction.ts`. Updated imports in `DeductionButton.tsx` and `deductionFormation.property.test.ts`.

---

### B3. Create Audio Subscription — ✅ DONE

**Resolution**: Created `src/store/audioSubscription.ts` with `initAudioSubscription()` that subscribes to store changes and triggers SFX (composure/vitality decrease, scene transition, dice roll, clue discovery). Initialized in `main.tsx`. Removed all `AudioManager.playSfx` calls from `investigatorSlice`, `narrativeSlice`, and `evidenceSlice`.

---

### B4. Consolidate `CheckResult` Types — ✅ DONE

**Resolution**: Removed `natural` field (redundant with `roll`) and made `dc` optional in `diceEngine.ts` `CheckResult`. Deleted local `CheckResult` from `narrativeSlice.ts`, now imports from `diceEngine`. Single `CheckResult` type across codebase.

---

### B5. Add Runtime Content Validation — ✅ DONE

**Resolution**: Added outcome tier completeness checking (all 5 tiers for faculty-check choices) to both `validateContent` in `narrativeEngine.ts` and `validateCase.mjs`. Wired `validateContent` into `loadAndStartCase` — throws on failure, caught by `App.handleStartCase`.

---

**Phase B summary**: All 5 items complete. Engine functions are pure and testable, SFX is decoupled from state mutations, types are consolidated, content is validated at runtime.

---

## Phase C: Gap Filling (Add Missing Features) — ✅ COMPLETE

Goal: Implement features that are engine-complete but UI-incomplete, and add missing UI elements.

### C1. Implement ClueDiscoveryCard — ✅ DONE

**Resolution**: Replaced stub with Framer Motion slide-in card showing type icon, title, description. NarrativePanel tracks last auto-discovered clue and shows card with 4-second auto-dismiss. Respects reducedMotion.

---

### C2. Add Manual Save Button — ✅ DONE

**Resolution**: Added 💾 button to HeaderBar with `onSaveGame` prop. Wired in App.tsx to call `saveGame()`.

---

### C3. Add Faction Reputation to Case Journal — ✅ DONE

**Resolution**: Added "Faction Standing" section to CaseJournal with narrative labels (Allied/Favorable/Neutral/Strained/Hostile) based on reputation values.

---

### C4. Display Load Error on Title Screen — ✅ DONE

**Resolution**: Added `loadError` and `onDismissError` props to TitleScreen. Renders dismissible red banner when error is present. Wired in App.tsx.

---

### C5. Case Completion Screen — ✅ DONE

**Resolution**: Created `CaseCompletion` component showing faculty bonus and vignette unlock. Added `'case-complete'` screen state to App.tsx with `handleCompleteCase` callback. Trigger will be wired in Phase D when content supports terminal scenes.

---

**Phase C summary**: All 5 items complete. Clue discovery has visual feedback, manual save works, faction reputation is visible, load errors are displayed, case completion has a screen.

---

## Phase D: Integration & Polish (Advanced Features)

Goal: Wire up the remaining engine-complete features and clean up remaining debt.

### D1. Encounter UI Integration — ✅ DONE

**Resolution**: Added `encounter` field to `SceneNode` type. Created `EncounterPanel` component that manages `EncounterState` locally, renders reaction check results, round-by-round choices via `ChoiceCard`. Wired into `GameContent` in `App.tsx` — shows `EncounterPanel` instead of `ChoicePanel` when scene has encounter. Authored one supernatural encounter scene in act3.json (2 rounds, escape paths, encounter damage).

---

### D2. Stale State Cleanup on New Case — ✅ DONE

**Resolution**: Added `state.clues = {}`, `state.npcs = {}`, `state.deductions = {}`, `state.lastCheckResult = null` to `loadAndStartCase` before populating new case data. Preserves `flags` and `factionReputation` (cross-case state).

---

### D3. Remove Superseded `startNewCase` Action — ✅ DONE

**Resolution**: Removed `startNewCase` from `NarrativeSlice` interface and implementation. Rewrote 3 tests in `AbilityButton.test.tsx` to use direct `useStore.setState()`. Zero references to `startNewCase` remain.

---

### D4. Remove `snapshotGameState` and Inline Construction — ✅ DONE (completed in Phase A2)

Completed as part of A2. All snapshot builders now use the shared `snapshotGameState` from `src/utils/gameState.ts`.

---

### D5. Remove Redundant `CheckResult.natural` Field — ✅ DONE (completed in Phase B4)

Completed as part of B4. `natural` field removed from `CheckResult` interface. `dc` made optional.

---

**Phase D summary**: All 5 items complete. Encounters are playable, cross-case state is clean, all identified dead code is removed.

---

## Dependency Graph

```
Phase A (✅ COMPLETE, except A5):
  A1✅  A2✅  A3✅  A4✅  A5✅  A6✅

Phase B (✅ COMPLETE):
  A4✅ → B1✅ → B4✅
  A5✅ → B5✅
  B2✅ (independent)
  B3✅ (independent)

Phase C (✅ COMPLETE):
  C1✅  C2✅  C3✅  C4✅  C5✅

Phase D (✅ COMPLETE):
  B1✅ → D1✅
  D2✅ → D3✅
  A2✅ → D4✅
  B4✅ → D5✅
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
