# Refactoring Opportunities

> Ordered by ROI for enabling AI-driven development. Each opportunity makes the codebase more testable, more predictable, and easier for automated agents to modify safely.

---

## R1. Extract Pure `computeChoiceResult` from `processChoice`

**Current pattern**: `processChoice` in `src/engine/narrativeEngine.ts` (line ~360) is the most-called engine function. It combines pure computation (dice roll, DC resolution, advantage check, tier determination, next scene lookup) with side effects (NPC disposition/suspicion via `useStore.getState()`, scene navigation via `store.goToScene()`). It both returns a `ChoiceResult` and mutates the store.

**Proposed pattern**: Extract a pure `computeChoiceResult(choice: Choice, state: GameState): ChoiceResult` that does the computation. Keep `processChoice` as a thin wrapper that calls `computeChoiceResult` then applies effects.

**Benefits**:
- **Testability**: `computeChoiceResult` can be unit tested with a plain `GameState` object — no Zustand store setup, no mocking. AI agents can write tests for new choice logic without understanding the store.
- **Determinism**: The pure function's output is fully determined by its inputs (except `Math.random` in dice rolls — a separate concern).
- **Composability**: The pure function can be reused by encounter processing, ability auto-succeed logic, and future "preview outcome" features.
- **AI-friendliness**: Pure functions are the easiest code for AI to reason about, modify, and test.

**Effort**: ~20 lines moved, 0 lines deleted. 1 file changed.

**Risk**: Low. `processChoice` callers don't change. The wrapper preserves the existing API. New function is additive.

**Mitigation**: Keep `processChoice` as-is initially. Add `computeChoiceResult` alongside it. Migrate callers one at a time.

**ROI**: High. This is the single highest-leverage refactor. Every future change to choice processing (ability auto-succeed, disadvantage support, encounter choices) benefits from a testable pure function.

---

## R2. Deduplicate GameState Snapshot to Shared Module

**Current pattern**: Three locations build the same 10-field `GameState` plain object:
- `src/store/index.ts` → `buildGameState` (exported)
- `src/store/slices/metaSlice.ts` → `snapshotGameState` (local function)
- `src/components/NarrativePanel/NarrativePanel.tsx` → inline 10-field object in `useEffect`

**Proposed pattern**: Create `src/store/buildGameState.ts` that exports the single function. Import it from all three locations. Delete the duplicates.

**Benefits**:
- **Maintainability**: Adding a field to `GameState` requires changing one function, not three.
- **Correctness**: Eliminates field drift risk. If `GameState` gains a field and one snapshot builder misses it, saves silently lose data.
- **AI-friendliness**: AI agents modifying `GameState` only need to update one snapshot function.

**Effort**: ~15 lines in new file. 3 files updated (import changes). 0 new logic.

**Risk**: Trivial. Must avoid circular imports — the new file imports only from `../types`, not from `store/index.ts`.

**ROI**: High effort-to-impact ratio. 15 minutes of work eliminates a class of bugs permanently.

---

## R3. Move SFX Triggering to Store Subscription

**Current pattern**: `AudioManager.playSfx()` is called inside Immer `set()` callbacks in 3 slice files:
- `src/store/slices/investigatorSlice.ts` → `adjustComposure`, `adjustVitality`
- `src/store/slices/narrativeSlice.ts` → `goToScene`, `setCheckResult`
- `src/store/slices/evidenceSlice.ts` → `discoverClue`

Side effects inside state mutations violate the Immer purity contract and make slices harder to test (tests must mock `AudioManager`).

**Proposed pattern**: Create `src/store/audioSubscription.ts`. Use Zustand's `subscribe` API to detect state changes (composure decreased, scene changed, clue discovered, check result set) and trigger the corresponding SFX. Initialize the subscription in `src/store/index.ts` or `src/main.tsx`.

**Benefits**:
- **Testability**: Slice tests become pure state tests — no AudioManager mocking needed.
- **Correctness**: SFX fires after state is committed, not during mutation. No risk of audio playing for a rolled-back mutation.
- **Separation of concerns**: Slices do state. Subscription does audio. Clean boundary.
- **AI-friendliness**: AI agents modifying slices don't need to think about audio side effects.

**Effort**: ~40 lines new file. ~15 lines removed from 3 slice files.

**Risk**: Low-Medium. Must verify every SFX event still fires. The subscription sees post-commit state, so timing shifts from mid-mutation to post-mutation — imperceptible for audio.

**ROI**: Medium-High. Unblocks clean slice testing and establishes the subscription pattern for future side effects (analytics, logging, etc.).

---

## R4. Move `buildDeduction` from Component to Engine Layer

**Current pattern**: `src/components/EvidenceBoard/buildDeduction.ts` is a pure function with no React dependencies. It's tested in `src/engine/__tests__/deductionFormation.property.test.ts` — an engine test reaching into a component directory.

**Proposed pattern**: Move to `src/engine/buildDeduction.ts`. Update 2 import paths.

**Benefits**:
- **Discoverability**: Engine functions live in `src/engine/`. AI agents searching for game logic find it in the expected location.
- **Test organization**: Engine test imports engine module. No cross-layer import.
- **Convention compliance**: Matches the established pattern where all game logic lives in `src/engine/`.

**Effort**: 0 new lines. 1 file moved. 2 import paths updated.

**Risk**: Trivial.

**ROI**: Small effort, permanent convention fix. Prevents future confusion about where pure game logic belongs.

---

## R5. Introduce `firstScene` Field in Case Meta

**Current pattern**: `src/store/slices/narrativeSlice.ts` → `loadAndStartCase` uses `Object.keys(data.scenes)[0]` to determine the first scene. This relies on JSON key insertion order — correct in modern JS engines but fragile if a tool re-sorts keys.

**Proposed pattern**: Add `firstScene: string` to `CaseMeta` interface and to each `meta.json`. Read it in `loadAndStartCase` instead of `Object.keys()[0]`.

**Benefits**:
- **Correctness**: Explicit is better than implicit. The first scene is a content authoring decision, not a runtime inference.
- **Robustness**: Immune to JSON key reordering by formatters, linters, or content tools.
- **AI-friendliness**: AI agents authoring case content can set the entry point explicitly.

**Effort**: 1 field added to type. 1 line changed in `loadAndStartCase`. 2 `meta.json` files updated.

**Risk**: Low. Fallback to `Object.keys()[0]` if `firstScene` is undefined preserves backward compatibility.

**ROI**: Small effort, eliminates a latent correctness risk.

---

## R6. Consolidate `CheckResult` Type Duplication

**Current pattern**: Two `CheckResult` types exist:
- `src/engine/diceEngine.ts` → `CheckResult` with 6 fields: `roll`, `modifier`, `total`, `dc`, `tier`, `natural`
- `src/store/slices/narrativeSlice.ts` → `CheckResult` with 4 fields: `roll`, `modifier`, `total`, `tier`

The slice version is a subset used for UI display. The engine version has extra fields (`dc`, `natural`) that are redundant (`natural === roll`).

**Proposed pattern**: Remove the `natural` field from the engine `CheckResult` (it's always identical to `roll`). Export the engine `CheckResult` and use it in the narrative slice (ignoring `dc` in the UI). Delete the local type in `narrativeSlice.ts`.

**Benefits**:
- **Single source of truth**: One `CheckResult` type across the codebase.
- **AI-friendliness**: AI agents don't need to know which `CheckResult` to use where.

**Effort**: ~5 lines changed across 2 files.

**Risk**: Low. Must verify no test relies on `natural` being a separate field from `roll`.

**ROI**: Small. Eliminates a minor confusion point.

---

## R7. Add Runtime Content Validation After `loadCase`

**Current pattern**: `validateContent(caseData)` exists in `narrativeEngine.ts` but is never called at runtime. Broken content (missing outcome tiers, dangling scene refs) causes crashes at render time via `resolveScene` throwing.

**Proposed pattern**: Call `validateContent(data)` inside `loadAndStartCase` after `loadCase` returns. If validation fails, throw with the error list. The existing try/catch in `App.handleStartCase` will catch it and set `loadError`.

**Benefits**:
- **Correctness**: Content errors are caught at load time with descriptive messages, not at render time with cryptic crashes.
- **AI-friendliness**: AI agents authoring content get immediate feedback on broken references.
- **Safety net**: Complements the offline `validateCase.mjs` script for cases where content is edited without running the script.

**Effort**: ~5 lines in `narrativeSlice.ts`.

**Risk**: Low. Validation is read-only. If it incorrectly rejects valid content, the fallback is to remove the call.

**ROI**: Medium. Prevents a class of runtime crashes.
