# Cleanup Inventory

> Candidates for removal or consolidation. **Nothing should be deleted without reading this document first.** Each item includes a risk assessment and caution notes.

---

## 1. Unreferenced Exported Functions

Functions that are exported but never imported by any other file (excluding their own definition file).

| Symbol | File | Imported by | Verdict |
|---|---|---|---|
| `loadVignette` | `src/engine/narrativeEngine.ts` | Nobody | **Keep.** Will be needed when vignette play is wired up. The side case "A Matter of Shadows" exists but no code path loads it yet. |
| `validateContent` | `src/engine/narrativeEngine.ts` | Nobody | **Keep.** Intended to be called at runtime after `loadCase` (Req 17.3–17.5). Gap closure plan item 1.7 adds this call. |
| `setMasterSfxVolume` | `src/engine/audioManager.ts` | Nobody | **Candidate for removal** if the audio subscription pattern (gap closure 2.4) sets volume per-play. Currently dead code — volume is passed as a parameter to `playSfx` at call time. |
| `resetForScene` | `src/engine/hintEngine.ts` | Nobody (directly) | **Keep.** Called internally by `trackActivity({ type: 'sceneChange' })`. Will be exercised once hint wiring is added (gap closure 1.2). |
| `RollResult` (type) | `src/engine/diceEngine.ts` | Nobody | **Candidate for removal.** Exported interface used only as the return type of `rollWithAdvantage`/`rollWithDisadvantage`, but no external code destructures it. Internal use only. |

---

## 2. Unreferenced Selector/Action Hooks

Hooks exported from `src/store/index.ts` that no component imports.

| Hook | Imported by | Verdict |
|---|---|---|
| `useNarrative` | Nobody | **Candidate for removal.** Components use `useStore` with inline selectors or `useCurrentScene()` instead. |
| `useFlags` | Nobody | **Keep.** Likely needed by future components (e.g., faction reputation display). |
| `useFactionReputation` | Nobody | **Keep.** Same rationale — gap closure 1.6 adds faction display to CaseJournal. |
| `useNarrativeActions` | Nobody | **Keep.** Part of the documented API pattern. Components currently use `useStore(s => s.goToScene)` directly, but the hook exists for consistency. |
| `useEvidenceActions` | Nobody | **Keep.** Same rationale. |
| `useNpcActions` | Nobody | **Keep.** Same rationale. |
| `useWorldActions` | Nobody | **Keep.** Same rationale. |

⚠️ **Caution**: The action hooks are part of the documented store API (AGENTS.md, steering docs). They exist for convention enforcement even if current components bypass them. Removing them would violate the stated architecture.

---

## 3. Unreferenced Store Actions

Actions defined in slices but never called from any component or engine function (excluding tests).

| Action | Slice | Called by (non-test) | Verdict |
|---|---|---|---|
| `startNewCase` | narrativeSlice | Nobody (only `AbilityButton.test.tsx`) | **Candidate for removal.** Superseded by `loadAndStartCase` which does everything `startNewCase` does plus loads content. The test uses it for setup but could use `loadAndStartCase` or direct `set()`. |
| `resetAbility` | investigatorSlice | Nobody (only `AbilityButton.test.tsx`) | **Keep.** Ability reset happens inside `loadAndStartCase` via `state.investigator.abilityUsed = false`, but `resetAbility` is the proper action for it. May be needed when case completion is wired. |
| `removeNpc` | npcSlice | Nobody | **Keep.** Required by Req 8.8 (NPC death/removal). No content currently triggers it, but the action is correct and will be needed for future cases. ⚠️ **Dynamic risk**: Could be called from content `Effect` if a `removeNpc` effect type were added. |
| `setNpcMemoryFlag` | npcSlice | Nobody | **Keep.** Required by the NPC memory system (Req 8.4). No content currently uses it, but the `memoryFlags` field exists on every NPC. |
| `completeCase` | narrativeSlice | Nobody (only `caseProgression.test.ts`) | **Keep.** Will be called when case completion UI is added (gap closure 2.5). |

---

## 4. Duplicate Implementations

| What | Location A | Location B | Location C | Action |
|---|---|---|---|---|
| GameState snapshot builder | `src/store/index.ts` → `buildGameState` | `src/store/slices/metaSlice.ts` → `snapshotGameState` | `src/components/NarrativePanel/NarrativePanel.tsx` → inline 10-field object | **Consolidate.** Gap closure plan item 1.4. Move to `src/store/buildGameState.ts`. Delete `snapshotGameState` and inline construction. |
| CheckResult type | `src/engine/diceEngine.ts` → `CheckResult` (6 fields: roll, modifier, total, dc, tier, natural) | `src/store/slices/narrativeSlice.ts` → `CheckResult` (4 fields: roll, modifier, total, tier) | — | **Consolidate.** The slice version is a subset. Either use the engine version everywhere or create a `UICheckResult` type that omits `dc` and `natural`. |
| Content validation | `src/engine/narrativeEngine.ts` → `validateContent` | `scripts/validateCase.mjs` | — | **Keep both.** Different execution contexts (browser vs Node.js). They check the same things but operate on different data sources (in-memory CaseData vs filesystem JSON). Document the duplication. |

---

## 5. Stub / Placeholder Code

| File | What | Status | Action |
|---|---|---|---|
| `src/components/NarrativePanel/ClueDiscoveryCard.tsx` | Entire component is a stub. Comments: "stub placeholder", "Full implementation in Task 10", "Slide-in animation and type icon — implemented in Task 10". | Known incomplete | **Keep.** Gap closure plan item 2.3 implements it. The stub provides the correct interface (`ClueDiscoveryCardProps`). |
| `src/components/NarrativePanel/NarrativePanel.tsx` line 113 | Comment: "Clue discovery notification — stub, fully implemented in Task 10" | Known incomplete | **Keep.** Will be updated when ClueDiscoveryCard is implemented. |

---

## 6. Unused Type Definitions

Types defined in `src/types/index.ts` that are only used by their own definition or by a single engine function with no external consumer.

| Type | Used by | Verdict |
|---|---|---|
| `EncounterRound` | `narrativeEngine.ts`, `encounterSystem.test.ts` | **Keep.** Encounter engine is complete; UI is the missing piece. |
| `EncounterState` | `narrativeEngine.ts`, `encounterSystem.test.ts` | **Keep.** Same rationale. |
| `VignetteMeta` | `narrativeEngine.ts` | **Keep.** Used by `loadVignette`. |
| `VignetteData` | `narrativeEngine.ts` | **Keep.** Same. |
| `ValidationResult` | `narrativeEngine.ts` | **Keep.** Used by `validateContent`. |
| `ChoiceResult` | `narrativeEngine.ts` | **Keep.** Return type of `processChoice` and `processEncounterChoice`. |

⚠️ **Caution**: All of these types are part of the public API surface defined in the canonical type file. They support features that are engine-complete but UI-incomplete. Removing them would require re-adding them when the UI is built.

---

## 7. Unused Data Fields

Fields defined in types or content that no code reads.

| Field | Defined in | Read by | Verdict |
|---|---|---|---|
| `CaseMeta.facultyDistribution` | `src/types/index.ts`, `content/cases/*/meta.json` | Nobody | **Candidate for removal** from the type, or **implement** faculty balance validation that reads it. The design doc (§4.2) specifies minimum check quotas per faculty — this field was likely intended to support that validation. |
| `Deduction.unlocksScenes` | `src/types/index.ts` | Nobody (never populated by `buildDeduction`) | **Keep.** The field is correct per the design. `buildDeduction` should populate it from content data. Currently a gap, not dead code. |
| `Deduction.unlocksDialogue` | `src/types/index.ts` | Nobody | **Keep.** Same rationale. |
| `Clue.grantsFaculty` | `src/types/index.ts` | Nobody | **Keep.** Designed for the "clues grant Advantage on specific faculty checks" mechanic. Currently, advantage is determined by `choice.advantageIf` (clue IDs), not by `clue.grantsFaculty`. The field exists for a more granular advantage system. |
| `SceneNode.illustration` | `src/types/index.ts` | `SceneIllustration` component | **Keep.** The component renders it. No content currently sets it, but the pipeline is ready. |
| `CheckResult.natural` | `src/engine/diceEngine.ts` | Nobody external (redundant with `roll`) | **Candidate for removal.** `natural` and `roll` are always the same value in `performCheck`. |

---

## 8. Orphaned Configuration

| File | Contents | Verdict |
|---|---|---|
| `.vscode/settings.json` | Empty object `{}` | **Candidate for removal.** No settings configured. Adds no value. However, its presence prevents VS Code from creating it with defaults, which some developers prefer. Low priority. |

---

## 9. Dead Code Paths

| Location | What | Why it's dead | Verdict |
|---|---|---|---|
| `src/App.tsx` → `loadError` state | `setLoadError(e.message)` is called on case load failure, but `loadError` is never rendered in any JSX | Error captured but invisible to user | **Keep the state, add UI.** Gap closure plan mentions this. The state management is correct; only the rendering is missing. |
| `src/App.tsx` → `ABILITY_FLAGS` → engine | Flags are set via `setFlag` but no engine code reads `ability-auto-succeed-*` flags | Abilities are cosmetically activated but mechanically inert | **Keep. Fix the engine.** Gap closure plan item 1.3. |
| `src/engine/narrativeEngine.ts` → `getEncounterChoices` `_hasAdvantage` annotation | Annotates choices with `_hasAdvantage` but no UI reads this property | No encounter UI exists | **Keep.** Will be consumed by encounter UI (gap closure 3.1). |
| `src/engine/hintEngine.ts` → `trackActivity` | Fully implemented but never called from any component | Hint tracking inputs disconnected | **Keep. Wire it.** Gap closure plan item 1.2. |

---

## 10. Tests for Features That Don't Fully Work

| Test file | Tests | Feature status | Verdict |
|---|---|---|---|
| `encounterSystem.test.ts` | 20 tests | Engine works, no UI | **Keep.** Tests validate the engine correctly. UI is the gap, not the engine. |
| `caseProgression.test.ts` | 16 tests | Engine works, no completion UI | **Keep.** Same rationale. |
| `hintEngine.test.ts` | 27 tests | Engine works, tracking not wired | **Keep.** Tests use `_setState` injection. They validate engine logic independent of wiring. |
| `AbilityButton.test.tsx` | 17 tests | Button works, ability flags inert | **Keep.** Tests validate flag setting and UI state. The engine gap is separate. |

⚠️ **Caution**: These tests all pass (269/269). They test the parts that work. The gaps are in integration, not in the tested units. Removing these tests would lose coverage of working code.

---

## 11. Abandoned / Superseded Features

| Feature | Evidence | Status | Verdict |
|---|---|---|---|
| IndexedDB persistence | Design doc §12.1 specifies "IndexedDB primary, localStorage fallback". CODE_REVIEW #28: "Removed misleading TODO. Header comment now accurately states localStorage is the storage mechanism." | Deliberately abandoned | **No cleanup needed.** The IndexedDB code was never written. The TODO was removed. The design doc is stale on this point. |
| `colorblindMode` setting | Design doc `GameSettings` includes `colorblindMode: boolean`. Code's `GameSettings` does not. | Never implemented | **No cleanup needed.** The field was never added to code. The design doc is aspirational. |
| `startNewCase` action | Defined in `narrativeSlice`. Superseded by `loadAndStartCase` which does the same thing plus loads content. | Superseded | **Candidate for removal** after updating `AbilityButton.test.tsx` to use `loadAndStartCase` or direct `set()` for test setup. |
| Starter case "The Lamplighter's Wake" | Design doc §9.4 describes it in detail. | Replaced by "The Whitechapel Cipher" | **No cleanup needed.** The design doc describes a case that was never authored. The actual case is different. |

---

## Summary: Safe to Remove (After Verification)

| Item | Risk | Prerequisite |
|---|---|---|
| `snapshotGameState` in metaSlice.ts | Trivial | Replace with shared `buildGameState` import |
| Inline GameState construction in NarrativePanel.tsx | Trivial | Replace with `buildGameState` import |
| `useNarrative` hook | Low | Verify no dynamic usage (grep confirms none) |
| `startNewCase` action | Low | Update `AbilityButton.test.tsx` first |
| `CheckResult.natural` field | Low | Verify no test relies on it being different from `roll` |
| `RollResult` type export | Trivial | Only used internally by diceEngine |
| `.vscode/settings.json` | Trivial | Empty file, no functional impact |
| `setMasterSfxVolume` | Low | Only after audio subscription pattern is implemented |

## Summary: Keep Despite Appearing Dead

| Item | Why keep |
|---|---|
| All encounter types + engine functions | Engine-complete, UI-incomplete. Gap closure 3.1. |
| All vignette types + `loadVignette` | Content exists, loading path not yet wired. |
| `validateContent` | Intended for runtime use. Gap closure 1.7. |
| All unused action hooks | Documented API convention. |
| `removeNpc`, `setNpcMemoryFlag` | Required by design, no content triggers them yet. |
| `resetAbility`, `completeCase` | Will be called when case completion is wired. |
| `Deduction.unlocksScenes/unlocksDialogue` | Correct design, `buildDeduction` should populate them. |
| `Clue.grantsFaculty` | Designed for granular advantage system. |
| `CaseMeta.facultyDistribution` | Intended for faculty balance validation. |
| `loadError` state in App.tsx | Correct capture, missing render. |
| Hint engine `trackActivity` | Correct implementation, missing wiring. |
| Ability flags in `ABILITY_FLAGS` | Correct flags, missing engine read. |
