# Gap Analysis

> Current state (from archaeology phases 1–9) vs desired state (from requirements, design doc, and roadmap).

---

## 1. Concepts Needing Implementation

Ordered by impact on the playable experience.

### 1.1 Load Game → Restore Case Data — ✅ FIXED (Phase A1)

**Resolution**: `metaSlice.loadGame` now calls `await loadCase(gameState.currentCase)` after restoring state and sets `caseData` in a second `set()` call.

---

### 1.2 Hint Engine Wiring — ✅ FIXED (Phase A3)

**Resolution**: `trackActivity` calls added to `NarrativePanel` (sceneChange), `EvidenceBoard` (boardVisit on mount, connectionAttempt on connection complete).

---

### 1.3 Archetype Ability Engine Integration — ✅ FIXED (Phase A4)

**Resolution**: Added `ABILITY_AUTO_SUCCEED_FLAGS` mapping in `narrativeEngine.ts`. `processChoice` checks for ability flags before `performCheck` — if set, returns `critical` tier without rolling.

---

### 1.4 ~~Clue Discovery Card~~ — ✅ FIXED (Phase C1)

**Resolution**: Replaced stub with Framer Motion slide-in card. NarrativePanel tracks last auto-discovered clue, shows card with 4s auto-dismiss.

---

### 1.5 Encounter UI (MEDIUM)

**Gap**: The encounter engine (`startEncounter`, `processEncounterChoice`, `getEncounterChoices`) is fully implemented and tested. No UI component renders encounters. Players cannot experience encounters.

**Desired state**: Req 9.1–9.7 — multi-round encounters with reaction checks, faculty choices, and damage.

**What's needed**: Either a dedicated `EncounterPanel` component or integration into the existing `ChoicePanel`/`NarrativePanel` flow. Encounter state must be managed somewhere (component state or a new store slice). Scene content must include encounter-triggering scenes.

**Effort**: Significant — new component (~100–200 lines), encounter state management, content authoring for encounter scenes. Medium-high risk.

**Files**: New `src/components/EncounterPanel/` or modifications to `src/components/ChoicePanel/`, `src/components/NarrativePanel/`

---

### 1.6 ~~Manual Save Button~~ — ✅ FIXED (Phase C2)

**Resolution**: Added 💾 button to HeaderBar.

---

### 1.7 ~~Case Completion Screen~~ — ✅ FIXED (Phase C5)

**Resolution**: Created CaseCompletion component and 'case-complete' screen state in App.tsx. Trigger to be wired in Phase D.

---

### 1.8 ~~Faction Reputation Display~~ — ✅ FIXED (Phase C3)

**Resolution**: Added "Faction Standing" section to CaseJournal with narrative labels.

---

### 1.9 Non-Automatic Clue Discovery Methods (LOW)

**Gap**: `ClueDiscovery.method` supports `'exploration'`, `'check'`, and `'dialogue'` but only `'automatic'` is handled in `NarrativePanel`.

**Desired state**: Req 6.1 — clues discovered through exploration choices, successful checks, and dialogue.

**What's needed**: These methods are implicitly handled by content design — an "exploration" clue would be gated by a choice that leads to a scene with an `onEnter` `discoverClue` effect. The `method` field is metadata, not a trigger mechanism. The gap is smaller than it appears — the content contract (Condition/Effect) already supports all discovery paths. What's missing is explicit UI for "Search the desk" style exploration choices within a scene.

**Effort**: Primarily a content authoring concern, not a code gap.

---

## 2. Architecture Changes Required

### 2.1 Break Engine → Store Circular Dependency — ✅ FIXED

**Resolution**: All impure engine functions (`processChoice`, `processEncounterChoice`, `startEncounter`, `CaseProgression.completeCase`, `grantFacultyBonus`) now accept an `EngineActions` interface parameter instead of importing `useStore`. `applyOnEnterEffects` moved to `worldSlice.applyEffects` store action. Zero store imports remain in engine files. `last-critical-faculty` flag is now set on critical rolls in both `processChoice` and `processEncounterChoice`.

---

### 2.2 ~~Extract SFX from Store Mutations~~ — ✅ FIXED (Phase B3)

**Resolution**: Created `src/store/audioSubscription.ts` with store subscription that detects state changes and triggers SFX. Initialized in `main.tsx`. Removed all `AudioManager.playSfx` calls from slice files.

---

### 2.3 Deduplicate GameState Snapshot Builders — ✅ FIXED (Phase A2)

**Resolution**: Created `src/utils/gameState.ts` with single `snapshotGameState` function. `store/index.ts` re-exports as `buildGameState`. All 4 duplicate sites now import from the shared util.

---

### 2.4 ~~Move `buildDeduction` to Engine Layer~~ — ✅ FIXED (Phase B2)

**Resolution**: Moved `src/components/EvidenceBoard/buildDeduction.ts` → `src/engine/buildDeduction.ts`. Updated imports in `DeductionButton.tsx` and the property test.

---

## 3. Technical Debt Blocking Progress

### 3.1 ~~`loadGame` Doesn't Restore `caseData`~~ — ✅ FIXED

Fixed in Phase A1. `loadGame` now calls `loadCase(gameState.currentCase)` after state restoration.

---

### 3.2 ~~Ability Flags Not Read by Engine~~ — ✅ FIXED

Fixed in Phase A4. `processChoice` checks `ABILITY_AUTO_SUCCEED_FLAGS` before `performCheck`.

---

### 3.3 ~~Hint Tracking Not Wired~~ — ✅ FIXED

Fixed in Phase A3. `trackActivity` calls added to `NarrativePanel` and `EvidenceBoard`.

---

### 3.4 ~~`processChoice` Impurity~~ — ✅ FIXED (Phase B1)

Fixed in Phase B1. Extracted `computeChoiceResult` as a pure function. `processChoice` is now a thin wrapper.

---

### 3.5 ~~Outcome Tier Completeness Not Validated~~ — ✅ FIXED (Phase B5)

Fixed in Phase B5. Both `validateContent` and `validateCase.mjs` now check that faculty-check choices have all 5 outcome tiers. `validateContent` is called at runtime in `loadAndStartCase`.

---

## 4. What Can Be Incrementally Improved

These are ordered by effort (smallest first) and can each be a single PR.

| # | Improvement | Effort | Files | Risk |
|---|---|---|---|---|
| 1 | ~~Fix `loadGame` to restore `caseData`~~ | ✅ DONE | `metaSlice.ts` | — |
| 2 | ~~Wire hint `trackActivity` calls~~ | ✅ DONE | `EvidenceBoard.tsx`, `NarrativePanel.tsx` | — |
| 3 | ~~Add ability flag check in `processChoice`~~ | ✅ DONE | `narrativeEngine.ts` | — |
| 4 | ~~Deduplicate `snapshotGameState` → shared `buildGameState`~~ | ✅ DONE | `utils/gameState.ts` + 5 files | — |
| 5 | ~~Move `buildDeduction` to engine layer~~ | ✅ DONE | `engine/buildDeduction.ts` | — |
| 6 | ~~Add manual save button~~ | ✅ DONE | `HeaderBar.tsx` | — |
| 7 | ~~Add faction reputation to CaseJournal~~ | ✅ DONE | `CaseJournal.tsx` | — |
| 8 | ~~Add outcome tier completeness to validators~~ | ✅ DONE | `validateCase.mjs`, `narrativeEngine.ts` | — |
| 9 | ~~Implement ClueDiscoveryCard~~ | ✅ DONE | `ClueDiscoveryCard.tsx`, `NarrativePanel.tsx` | — |
| 10 | ~~Extract `computeChoiceResult` pure function~~ | ✅ DONE | `narrativeEngine.ts` | — |
| 11 | ~~Create audio subscription (extract SFX from slices)~~ | ✅ DONE | `audioSubscription.ts` + 3 slices | — |
| 12 | ~~Add case completion screen~~ | ✅ DONE | `CaseCompletion/` + `App.tsx` | — |
| 13 | ~~Encounter UI component~~ | ✅ DONE | `EncounterPanel/` + act3.json | — |

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
| ~~Load game blank screen ships to users~~ | ~~High~~ | ~~Critical~~ | ✅ Fixed in Phase A1 |
| Content author adds choice with missing outcome tier | Medium | High — runtime crash | Fix #8: add tier completeness validation |
| ~~Ability activation appears to work but does nothing~~ | ~~High~~ | ~~Medium~~ | ✅ Fixed in Phase A4 |
| New engine logic added to impure `processChoice` | Medium | Medium — untestable | Fix #10: extract pure `computeChoiceResult` |
| Audio files added but SFX timing is wrong due to Immer batching | Low (Immer doesn't batch today) | Low | Fix #11: audio subscription |

## Unknowns

1. **Content volume**: ✅ ADDRESSED — Two main cases now exist (The Whitechapel Cipher, The Mayfair Séance) plus one side case. Case Selection UI and `content/manifest.json` support arbitrary cases. `loadAndStartVignette` wires vignettes into the store.

2. **Encounter content**: ✅ ADDRESSED — Both main cases now include encounter-type scenes in act3.json. The encounter engine is exercised by real content.

3. **Cross-case persistence**: The vignette unlock system and variant scene system are implemented but untestable with only one main case. The `loadAndStartCase` function doesn't clear old clues/NPCs before loading new ones — starting a second case would merge state from both.

4. **Mobile performance**: The app targets browsers broadly but has never been tested on mobile. The `html5: false` Howler config may block audio on mobile Safari without user interaction. The Evidence Board's mouse-tracking ghost thread has no touch equivalent.

5. **Save file size at scale**: With 10 manual saves + autosave, each containing clues/NPCs/flags from multiple cases, localStorage's ~5MB limit could be reached. No monitoring or warning exists.
