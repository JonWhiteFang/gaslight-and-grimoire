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

**Resolution**: Created `CaseCompletion` component showing faculty bonus and vignette unlock. Added `'case-complete'` screen state to App.tsx with `handleCompleteCase` callback. Wired in: `GameContent` detects terminal scenes (no choices, no encounter) and renders a "Case Complete" button that triggers `handleCompleteCase`. `CaseCompletion` also displays the ending narrative text.

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

---

## Phase E: Game Design Improvements (Player Experience & Content)

> Added 2026-02-23 from game design analysis (`GAME_DESIGN_ANALYSIS.md`). Phases A–D addressed engineering gaps. Phase E addresses game design, content depth, and player experience gaps identified through a full codebase + content audit.

Goal: Transform the technically sound but content-thin game into a compelling player experience with active investigation, atmospheric immersion, balanced mechanics, and meaningful NPC interaction.

### E1. Implement Active Clue Discovery Methods — ✅ COMPLETE

**What**: All four clue discovery methods now work.

**Resolution**: 
- `exploration`: `SceneCluePrompts` component renders atmospheric clickable prompts (auto-generated from clue type/title via `getCluePromptText`). Player clicks to discover.
- `check`: `SceneCluePrompts` renders faculty-tagged examine prompts. On click, performs a dice roll via `performCheck` (rollD20 + modifier vs `requiresFaculty.minimum` as DC). Success discovers the clue; failure shows narrative snippet. One shot per scene visit, no retry.
- `dialogue`: `NarrativePanel` auto-discovers dialogue-method clues on scene entry (same as automatic) with a speech-bubble variant of `ClueDiscoveryCard` (🗣️ icon, "Gleaned from Conversation" header).

**New files**: `src/engine/cluePrompts.ts`, `src/components/NarrativePanel/SceneCluePrompts.tsx`
**Modified files**: `src/components/NarrativePanel/NarrativePanel.tsx`, `src/components/NarrativePanel/ClueDiscoveryCard.tsx`, `src/components/NarrativePanel/index.ts`

---

### E2. Add Audio and Visual Assets — P0

**What**: The audio system (Howler.js, AudioManager, audioSubscription, 9 SFX events, per-scene `ambientAudio`) is fully coded but zero audio files exist. `SceneIllustration` renders from `scene.illustration` but no images exist. NPC portraits are letter-initial placeholders.

**Files**: New `public/audio/sfx/` (9 MP3s), new `public/audio/ambient/` (2–3 loops), new `public/images/` (scene illustrations), content JSON `act*.json` (populate `illustration` and `ambientAudio` fields), `src/components/NPCGallery/NPCGallery.tsx` (portrait images)

**Dependencies**: None.

**Risk**: Low (code). High effort (asset creation/sourcing).

---

### E3. Deepen Branching and Content Volume — P0

**What**: Average 1.1–1.3 choices per scene. Only 6 clues and 3 NPCs per case. Only 1 variant scene per case. Thin content undermines replayability and the Evidence Board mechanic.

**Files**: `public/content/cases/*/act*.json`, `public/content/cases/*/clues.json`, `public/content/cases/*/npcs.json`, `public/content/cases/*/variants.json`, new vignette directories

**Changes**:
1. Increase avg choices/scene to 2.0–2.5 for main cases.
2. Add 4–6 clues per case (target 10–12 total) with richer `connectsTo` graphs.
3. Add 2–3 variant scenes per case.
4. Add 2–3 NPCs per case with faction diversity.
5. Author 1+ additional vignette.

**Dependencies**: None.

**Risk**: Low (additive content). High effort (content authoring).

---

### ~~E4. Add NPC Dialogue and Interrogation System~~ — ✅ COMPLETE

**What**: NPCs had rich state but no interactive dialogue. `memoryFlags` was never populated.

**Resolution**: Added `npcMemoryFlag` condition type (checks `npcs[target].memoryFlags[value]`) and `setMemoryFlag` effect type (calls `setNpcMemoryFlag`). Disposition/suspicion/memoryFlag-gated dialogue choices added to existing scenes — no new component types needed. 8 new dialogue scenes across both cases: Graves reveals Harland, Mott recognises cipher, Vane cornered by cross-NPC evidence, Ashworth reveals Gerald's secret, Vesper reveals Elara truth. `memoryFlags` populated on key NPC interactions. Files changed: `src/types/index.ts`, `src/engine/narrativeEngine.ts`, `src/store/slices/worldSlice.ts`, `src/engine/effectMessages.ts`, content JSON, 2 new test files.

---

### ~~E5. Add Composure and Vitality Recovery Mechanics~~ — ✅ COMPLETE

**What**: Both meters only decreased. No rest scenes, recovery items, or counterplay. `breakdown` and `incapacitation` scenes didn't exist in content.

**Resolution**: Shared `breakdown` and `incapacitation` scenes created in `public/content/shared/` and injected into all cases via `injectSharedScenes` in `loadCase`/`loadVignette`. Case-specific variants added to Whitechapel Cipher (fog/cipher hallucination, alley collapse) and Mayfair Séance (séance room overwhelm, supernatural assault). Recovery effects (+1 composure/vitality) added to 6 scenes across both cases at natural rest points. Veil Sight also fixed: grants Lore advantage + variant scenes with occult content. Files changed: `src/engine/narrativeEngine.ts`, content JSON (act files, variants, shared scenes), `src/engine/__tests__/veilSight.test.ts`.

---

### ~~E6. Persist Evidence Board Connections in Store~~ — ✅ COMPLETE

**What**: Connections lived in React `useState`, lost on board close/reopen.

**Resolution**: Added `connections: ClueConnection[]` to `evidenceSlice` with `addConnection` (dedup) and `clearConnections` actions. `EvidenceBoard` reads from store; DOM points recomputed via `useMemo` + version counter on scroll/resize. Connections cleared on case/vignette load and on deduction. Files changed: `src/store/slices/evidenceSlice.ts`, `src/store/index.ts`, `src/store/slices/narrativeSlice.ts`, `src/components/EvidenceBoard/EvidenceBoard.tsx`.

---

### E7. Implement Scene History Navigation — P2

**What**: `sceneHistory` is tracked but never consumed. No back button, no scene replay, no timeline in journal.

**Files**: `src/store/slices/narrativeSlice.ts` (add `goToPreviousScene`), `src/components/HeaderBar/HeaderBar.tsx` (back button), `src/components/CaseJournal/CaseJournal.tsx` (scene timeline)

**Dependencies**: None.

**Risk**: Medium. State rollback (undoing `onEnter` effects) is complex if full undo is desired. Read-only review is simpler.

---

### E8. Rebalance Dice Math — ✅ DONE

**What**: Even maxed faculty (score 14, mod +2) only succeeded 55% vs DC 12. Partial band was only 10% wide (2 numbers on d20). Felt like coin-flipping.

**Resolution**: Three changes: (1) Partial band widened from `dc - 2` to `dc - 3` in `resolveCheck`. (2) `getTrainedBonus(faculty, archetype)` added — returns +1 when check faculty matches archetype primary (deductionist→reason, occultist→lore, operator→vigor, mesmerist→influence). Wired into `performCheck`, `ChoiceCard`, and `SceneCluePrompts`. (3) All 34 content DC values lowered by 2. Encounter reaction check stays at DC 12. Files changed: `src/engine/diceEngine.ts`, `src/components/ChoicePanel/ChoiceCard.tsx`, `src/components/NarrativePanel/SceneCluePrompts.tsx`, 9 content JSON files, 1 test file.

---

### ~~E9. Add Consequence Feedback and Narrative Bridging~~ — ✅ COMPLETE

**What**: `onEnter` effects fired silently. Players saw meters drop with no narrative explanation.

**Resolution**: Added optional `description` field to `Effect` type. Pure `generateEffectMessage` function in `src/engine/effectMessages.ts` produces atmospheric text with mechanical annotation (e.g. "A chill settles over you (Composure −1)"). `EffectFeedback` component renders inline stacked messages in `NarrativePanel` between scene text and choices. Auto-dismisses after 6 seconds. Respects `reducedMotion`. Content-authored descriptions added to 4 scenes. Files changed: `src/types/index.ts`, `src/engine/effectMessages.ts`, `src/components/NarrativePanel/EffectFeedback.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx`, `src/components/NarrativePanel/index.ts`, 2 content JSON files, 1 test file.

---

### E10. Expand Testing to Cover Integration Paths — P2

**What**: No integration tests for choice→navigation→effect pipeline. ~~`validateCase.mjs` not in CI.~~ No component tests for EncounterPanel or EvidenceBoard.

**Files**: `.github/workflows/deploy.yml` (add validation step), new `src/engine/__tests__/integration.test.ts`, new `src/components/__tests__/EncounterPanel.test.tsx`, new `src/components/__tests__/EvidenceBoard.test.tsx`

**Dependencies**: None.

**Risk**: Low. Additive tests.

---

**Phase E summary**: 10 items spanning content, mechanics, UX, and testing. Items E1–E3 are P0 (highest impact on player experience). E4–E6 are P1 (significant features). E7–E10 are P2 (polish and robustness).

---

## Updated Dependency Graph

```
Phase A–D (✅ ALL COMPLETE)

Phase E (Game Design Improvements):
  E1 (active clue discovery)     — ✅ COMPLETE
  E2 (audio/visual assets)       — independent
  E3 (content depth)             — independent
  E4 (NPC dialogue)              — ✅ COMPLETE
  E5 (recovery mechanics)        — ✅ COMPLETE
  E6 (persistent evidence board) — ✅ COMPLETE
  E7 (scene history)             — independent
  E8 (dice rebalance)            — independent
  E9 (consequence feedback)      — ✅ COMPLETE
  E10 (testing expansion)        — independent
```

## Updated Timeline Estimate

| Phase | Items | Effort | Cumulative |
|---|---|---|---|
| A: Foundation | 6 | ~1 day | 1 day |
| B: Core Refactoring | 5 | ~2 days | 3 days |
| C: Gap Filling | 5 | ~1.5 days | 4.5 days |
| D: Integration & Polish | 5 | ~2.5 days | 7 days |
| E: Game Design (P0) | 3 | ~5–8 days | 12–15 days |
| E: Game Design (P1) | 3 | ~4–6 days | 16–21 days |
| E: Game Design (P2) | 4 | ~3–4 days | 19–25 days |

**Phase E critical path**: E1 → E4 (active clue discovery enables dialogue system)

**Phase E parallel tracks**:
- Track 1: E2 (assets — can be done by non-engineers)
- Track 2: E3 (content authoring — can be done by narrative designers)
- Track 3: E5, E8 (mechanics — small code changes)
- Track 4: E6, E7, E9 (UX improvements — independent)
- Track 5: E10 (testing — independent, can run alongside any other work)
