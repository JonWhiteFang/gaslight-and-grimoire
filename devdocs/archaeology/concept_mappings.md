# Concept Mappings

> Maps each major concept to its implementation files, coverage status, design rationale, and edge cases.

---

## 1. Character Creation

**Files**: `src/components/CharacterCreation/CharacterCreation.tsx`, `ArchetypeSelect.tsx`, `FacultyAllocation.tsx`, `src/data/archetypes.ts`, `src/store/slices/investigatorSlice.ts`

**Coverage**: Fully implemented

**Why this shape**: Character creation is a one-time flow that produces an `Investigator` object and stores it. The component owns all local state (name, archetype selection, point allocation) and only touches the store on confirm via `initInvestigator`. This keeps the store clean during the draft phase.

**Alternatives likely considered**: Storing draft state in Zustand (rejected — unnecessary persistence of transient UI state). A wizard/stepper pattern (rejected — only two steps: archetype + allocation, not enough to warrant a stepper).

**Edge cases that shaped design**:
- Archetype change resets allocation to zero (prevents invalid combinations of archetype bonuses + allocated points).
- Confirm button disabled until all 12 points allocated (prevents partial builds).
- No per-faculty cap during allocation — a player can dump all 12 into one faculty. This is intentional: the archetype bonuses provide the floor, player choice provides the ceiling.

---

## 2. Dice Engine

**Files**: `src/engine/diceEngine.ts`

**Coverage**: Fully implemented

**Why this shape**: Pure functions with no dependencies beyond types. `rollD20`, `rollWithAdvantage`, `rollWithDisadvantage`, `calculateModifier`, `resolveCheck`, `resolveDC`, `performCheck` form a clean pipeline. The engine is the most cohesive module in the codebase.

**Alternatives likely considered**: Injecting a random number generator for determinism (not done — `Math.random()` used directly). A class-based `DiceEngine` with configurable RNG (rejected in favor of simple exported functions).

**Edge cases that shaped design**:
- Natural 20 always critical, natural 1 always fumble — regardless of modifier. This overrides the total-vs-DC comparison.
- Advantage and disadvantage cancel out (both present = normal roll). Matches D&D 5e rules exactly.
- `resolveDC` handles both static difficulty and `dynamicDifficulty` (scales DC based on faculty score threshold). This prevents trivial checks for min-maxed characters.
- `performCheck` returns both `roll` (the natural die value) and `natural` (same value) — redundant fields, likely an artifact of iterative development.

---

## 3. Narrative Engine — Scene Resolution

**Files**: `src/engine/narrativeEngine.ts` → `loadCase`, `loadVignette`, `evaluateConditions`, `resolveScene`, `validateContent`

**Coverage**: Fully implemented (loading, conditions, variants, validation). Validation never called at runtime.

**Why this shape**: Content is fetched at runtime (not bundled) so cases can be updated independently. All 7 case files are fetched in parallel via `Promise.all` for speed. Scenes are indexed into `Record<string, SceneNode>` for O(1) lookup. Variant resolution happens at render time via `useCurrentScene()`, not at navigation time, so variants respond to state changes that occur between navigation and render.

**Alternatives likely considered**: Bundling content at build time via Vite's JSON import (rejected — would couple content to build cycle). Lazy-loading acts on demand (rejected — all 3 acts loaded upfront to avoid mid-game loading screens). Caching loaded case data across sessions (not done — re-fetched on every case start).

**Edge cases that shaped design**:
- `Object.keys(data.scenes)[0]` used as first scene ID — relies on JSON insertion order. A `firstScene` field in `meta.json` would be safer but doesn't exist.
- Variant resolution scans the full `variants` array on every `useCurrentScene()` call. Acceptable for small variant counts but would need indexing for large cases.
- `fetchJson` prepends `import.meta.env.BASE_URL` to handle GitHub Pages subdirectory hosting (`/gaslight-and-grimoire/`).

---

## 4. Narrative Engine — Choice Processing

**Files**: `src/engine/narrativeEngine.ts` → `processChoice`, `src/components/ChoicePanel/ChoicePanel.tsx` → `handleSelect`, `src/components/ChoicePanel/ChoiceCard.tsx`

**Coverage**: Fully implemented (check, NPC effects, navigation). Missing: disadvantage support, delay between roll and navigation.

**Why this shape**: `processChoice` combines dice check + NPC effect + navigation in one call. This was a convenience choice — the component doesn't need to orchestrate multiple steps. The tradeoff is that the function is impure (calls store actions) and navigation happens before the caller can show the dice result.

**Alternatives likely considered**: Returning a pure result and letting the component apply effects (the "ideal" — rejected for simplicity). A two-phase approach: compute result, then apply after animation delay (not implemented but would fix the dice-before-navigation issue).

**Edge cases that shaped design**:
- Choices without `faculty`/`difficulty` skip the dice check entirely and route to `outcomes['success']` (fallback to `outcomes['critical']`). This handles narrative-only choices.
- `advantageIf` checks if any referenced clue is revealed — grants advantage if the player holds relevant evidence. This is the core "knowledge is power" mechanic.
- `npcEffect` is applied regardless of check outcome — choosing to confront an NPC affects the relationship even if the check fails.
- Missing outcome tiers cause `goToScene(undefined)` → crash. Content validation catches missing scenes but not missing tiers.

---

## 5. Narrative Engine — onEnter Effects

**Files**: `src/engine/narrativeEngine.ts` → `applyOnEnterEffects`, `src/components/NarrativePanel/NarrativePanel.tsx` (caller)

**Coverage**: Fully implemented

**Why this shape**: `applyOnEnterEffects` is the one engine function that directly mutates the store. It's called from `NarrativePanel`'s `useEffect` on scene change. This keeps the store action layer thin — effects are defined in content JSON and applied generically.

**Alternatives likely considered**: Making it a store action (e.g., `narrativeSlice.applyEffects`) — would be cleaner architecturally but would require the slice to understand all 7 effect types. Having `goToScene` apply effects automatically — rejected because `goToScene` doesn't have access to the resolved scene (it only knows the scene ID).

**Edge cases that shaped design**:
- Effects with missing `target` or `delta` are silently skipped (defensive coding).
- `discoverClue` effect type allows content to grant clues on scene entry without a discovery check.
- `NarrativePanel` uses a `prevSceneRef` to prevent double-processing in React StrictMode.

---

## 6. Clue Discovery & Evidence System

**Files**: `src/engine/narrativeEngine.ts` → `canDiscoverClue`, `src/store/slices/evidenceSlice.ts`, `src/components/EvidenceBoard/EvidenceBoard.tsx`, `ClueCard.tsx`, `ConnectionThread.tsx`, `DeductionButton.tsx`, `buildDeduction.ts`, `ProgressSummary.tsx`, `src/components/NarrativePanel/NarrativePanel.tsx` (auto-discovery), `src/components/NarrativePanel/ClueDiscoveryCard.tsx` (stub)

**Coverage**: Partially implemented. Automatic discovery works. Exploration/check/dialogue discovery methods have no UI trigger. ClueDiscoveryCard is a stub. Evidence Board connection + deduction flow is complete.

**Why this shape**: Clues are pre-loaded into the store (with `isRevealed: false`) when a case starts. Discovery flips `isRevealed` to true. This avoids runtime clue creation and keeps the store as the single source of truth. The Evidence Board uses React component state for connections (not the store), which means connections are lost on close/reopen.

**Alternatives likely considered**: Storing connections in Zustand (would persist across board open/close — rejected, possibly for simplicity or because connections are transient until deduction). Creating clue objects on discovery rather than pre-loading (rejected — pre-loading enables `canDiscoverClue` to check against the full clue set).

**Edge cases that shaped design**:
- `buildDeduction` checks if any connected clue has `type === 'redHerring'` and propagates `isRedHerring` to the deduction. This is the red herring mechanic.
- Deduction DC is hardcoded to 14 (Reason check) in `DeductionButton`. Not content-driven.
- Failed deduction marks clues as `'contested'`, then resets to `'examined'` after 2 seconds via `setTimeout`. The timeout is not cleaned up on unmount.
- Tag-based brightening during connection: `shouldBrighten` checks if source and target clues share any tag. This is a hint mechanism, not a validation — players can connect any two clues regardless of tags.

---

## 7. NPC System & Faction Propagation

**Files**: `src/store/slices/npcSlice.ts`, `src/store/slices/worldSlice.ts`, `src/components/NPCGallery/NPCGallery.tsx`

**Coverage**: Fully implemented (store + gallery). Missing: faction reputation display, rival faction decrease (Req 19.3).

**Why this shape**: NPC state is flat (`Record<string, NPCState>`). Disposition and suspicion are clamped at mutation time. Faction propagation is automatic: `adjustDisposition` on a faction-aligned NPC calls `adjustReputation(faction, delta * 0.5)` via a cross-slice `get()` call. This ensures content authors don't need to manually add reputation effects.

**Alternatives likely considered**: Explicit reputation effects in content JSON (rejected — too error-prone, easy to forget). A middleware or subscription for propagation (rejected — the cross-slice `get()` call is simpler). Configurable propagation multiplier per faction (not done — 0.5 is hardcoded).

**Edge cases that shaped design**:
- Disposition clamped to [-10, +10]. Suspicion clamped to [0, 10]. Faction reputation is unbounded — no clamping.
- `removeNpc` sets `isAlive = false` and `isAccessible = false` but doesn't delete the NPC from the store. This preserves the NPC's data for cross-case reference.
- NPCGallery filters by `isAccessible` — removed NPCs don't appear but their data persists.
- Suspicion tier labels in NPCGallery use different names than the type system: "Wary" (gallery) vs "concealing" (type). The gallery uses narrative-friendly labels.

---

## 8. Encounter System

**Files**: `src/engine/narrativeEngine.ts` → `startEncounter`, `processEncounterChoice`, `getEncounterChoices`, `src/types/index.ts` → `EncounterState`, `EncounterRound`, `Choice` encounter extensions

**Coverage**: Partially implemented. Engine complete and tested. No UI component. No store slice for encounter state.

**Why this shape**: Encounters are modeled as multi-round sequences with per-round choices. The engine functions accept and return `EncounterState`, which the caller must manage. This was likely designed for a future `EncounterPanel` component that would hold `EncounterState` in local state and call engine functions per round.

**Alternatives likely considered**: Modeling encounters as a sequence of regular scenes (possible but loses the round structure and reaction check). Adding an `encounterSlice` to the store (not done — encounter state is transient, not worth persisting).

**Edge cases that shaped design**:
- Supernatural reaction check uses the higher of Nerve or Lore (Nerve wins ties). This gives both faculties a role in supernatural encounters.
- Composure damage on failed reaction: `(rollD20() % 2) + 1` gives 1 or 2. Uses a d20 for a binary choice — wasteful but functional.
- `worseAlternative` replacement only affects the first choice in round 1. Content authors can't replace multiple choices.
- Escape paths (`isEscapePath: true`) are always included in filtered choices if conditions are met. This ensures the player is never trapped.
- `_hasAdvantage` annotation on returned choices uses a private-convention property name on a public type — a code smell.

---

## 9. Save / Load System

**Files**: `src/engine/saveManager.ts`, `src/store/slices/metaSlice.ts` → `saveGame`, `autoSave`, `loadGame`, `src/components/TitleScreen/LoadGameScreen.tsx`

**Coverage**: Partially implemented. Save works. Load is broken (doesn't restore `caseData`). Manual save button missing.

**Why this shape**: `SaveManager` is a plain object with synchronous localStorage methods. `GameState` is the serialisable type — it intentionally excludes `caseData` (runtime content that shouldn't be in save files). The gap is that `loadGame` restores `GameState` but doesn't re-fetch the content that `GameState` depends on.

**Alternatives likely considered**: IndexedDB for larger saves (documented in design doc, removed per CODE_REVIEW #28 — localStorage was simpler). Including `caseData` in saves (rejected — would bloat save files with static content). Async save API (the `saveGame` action is `async` but contains no async operations — likely a leftover from the IndexedDB plan).

**Edge cases that shaped design**:
- Save IDs use `Date.now()` — millisecond-level collision possible in automated testing.
- Autosave slot is always `'autosave'` — overwritten on every trigger. Manual saves get unique IDs.
- 10-save cap: oldest manual saves deleted when limit exceeded. Autosave excluded from cap.
- Migration pipeline: v0→v1 adds `factionReputation: {}`. Idempotent — calling migrate on a current-version file returns it unchanged.
- `readIndex` and `SaveManager.load` both have try/catch for corrupt JSON — returns empty array or null respectively.

---

## 10. Hint System

**Files**: `src/engine/hintEngine.ts`, `src/components/HeaderBar/HintButton.tsx`

**Coverage**: Partially implemented. Engine complete and tested. Tracking inputs (`trackActivity`) never called from any component. Dwell timer starts from page load, not scene entry.

**Why this shape**: A stateful singleton outside the Zustand store. Tracks board visits, connection attempts, and scene dwell time. `shouldShowHint` is polled on every `HintButton` render. Three escalating hint levels with level 3 gated behind level 2.

**Alternatives likely considered**: Storing hint state in Zustand (would be architecturally consistent — rejected, possibly because hint state is transient and doesn't need persistence). A React context for hint state (would scope to component tree — not done). Event-driven tracking via store subscriptions (would avoid manual `trackActivity` calls — not done).

**Edge cases that shaped design**:
- Level 3 request before level 2 shown: silently downgrades to level 2. Prevents spoiling.
- `connectionAttempt` resets `boardVisitCount` to 0 — a successful connection means the player is making progress, so the board-visit trigger resets.
- `_setState`/`_getState` exposed for testing — workaround for the singleton's lack of DI.
- `sceneEntryTime` initialized to `Date.now()` at module load — means the 5-minute dwell trigger fires 5 minutes after page load if `resetForScene` is never called (which it isn't, because `trackActivity({ type: 'sceneChange' })` is never called).

---

## 11. Audio System

**Files**: `src/engine/audioManager.ts`, `src/components/AmbientAudio/AmbientAudio.tsx`, `src/store/slices/investigatorSlice.ts` (SFX calls), `src/store/slices/narrativeSlice.ts` (SFX calls), `src/store/slices/evidenceSlice.ts` (SFX calls)

**Coverage**: Fully implemented (code). No audio files in repository. Game is silent.

**Why this shape**: Two subsystems. SFX: `AudioManager` singleton with lazy-cached `Howl` instances, called from store slice `set()` callbacks. Ambient: `AmbientAudio` non-rendering component that cross-fades Howl instances on scene change. SFX is triggered by state changes (not UI events) — this ensures audio plays regardless of which component triggered the action.

**Alternatives likely considered**: Triggering SFX from components (rejected — would miss programmatic state changes). A Zustand subscription for SFX (the "ideal" — would separate side effects from mutations, but not implemented). Web Audio API directly (rejected in favor of Howler.js abstraction).

**Edge cases that shaped design**:
- Missing audio files: Howler silently fails. No error, no fallback. The game runs fine without audio.
- `html5: false` forces Web Audio API — lower latency for SFX but requires user interaction on some mobile browsers before audio can play.
- SFX volume read from `state.settings.audioVolume.sfx` at play time — no need to update cached Howl volumes when settings change.
- Ambient volume updated reactively via a separate `useEffect` on `ambientVolume` change.
- Cross-fade: 1-second fade out of previous track, 1-second fade in of new track. Previous track is `stop()` + `unload()` after fade completes.

---

## 12. Accessibility & Settings

**Files**: `src/components/AccessibilityProvider/AccessibilityProvider.tsx`, `src/components/SettingsPanel/SettingsPanel.tsx`, `src/store/slices/metaSlice.ts` → `updateSettings`, `src/index.css`

**Coverage**: Fully implemented (font size, high contrast, reduced motion, text speed, keyboard nav, ARIA, touch targets). Missing: colorblind mode (in design doc, not in code), OS motion listener (detects on mount only, no change listener), settings stored with game state (loading a save overrides device preferences).

**Why this shape**: `AccessibilityProvider` is a renderless wrapper that applies CSS custom properties and classes to `document.documentElement`. This avoids prop drilling — any component can read CSS variables. Framer Motion components check `reducedMotion` individually because Framer doesn't respect the CSS class. Settings live in the Zustand store and are included in `GameState` for save/load.

**Alternatives likely considered**: A React context for accessibility (rejected — CSS custom properties are simpler and work outside React). Separate settings storage from game state (not done — settings are part of `GameState`, so loading a save overrides current device preferences). `matchMedia` change listener for OS motion preference (not done — only detects on mount).

**Edge cases that shaped design**:
- `updateSettings` uses `Object.assign(state.settings, partial)` — shallow merge. Callers must spread nested objects (e.g., `audioVolume: { ...settings.audioVolume, ambient: value }`). A deep merge would be safer.
- High contrast mode sets CSS variables (`--color-bg`, `--color-text`) but Tailwind classes override them. The actual visual effect comes from direct property overrides on the `.high-contrast` rule, not the variables.
- `.reduced-motion * { animation-duration: 0ms !important; transition-duration: 0ms !important; }` — universal selector with `!important`. Broad but effective.
- Focus trapping in SettingsPanel: manual Tab key interception. No focus-trap library.

---

## 13. Case Progression

**Files**: `src/engine/caseProgression.ts`, `src/store/slices/narrativeSlice.ts` → `completeCase`

**Coverage**: Fully implemented (engine). No UI for case completion results. No case selection screen.

**Why this shape**: `CaseProgression.completeCase` is called from the narrative slice's `completeCase` action. It grants a faculty bonus from the `last-critical-faculty` flag, checks vignette unlock conditions, sets unlock flags, and auto-saves. The vignette registry is a hardcoded array in `caseProgression.ts`.

**Alternatives likely considered**: Content-driven vignette unlock conditions in `meta.json` (partially done — vignette `meta.json` has `triggerCondition`, but the engine uses a hardcoded registry instead). A case completion screen/overlay (not implemented — the engine returns `{ facultyBonusGranted, vignetteUnlocked }` but no UI renders it).

**Edge cases that shaped design**:
- `last-critical-faculty` flag must be set by content JSON `onEnter` effects, not by `processChoice`. This is fragile — if content authors forget to set the flag, no bonus is granted.
- Faculty bonus capped at 20 via `Math.min(20, current + 1)`.
- Already-unlocked vignettes are skipped via `state.flags['vignette-unlocked-${id}']` check.
- Only the first matching vignette is returned — if multiple vignettes qualify simultaneously, only one unlocks per case completion.

---

## 14. Content Validation

**Files**: `src/engine/narrativeEngine.ts` → `validateContent`, `scripts/validateCase.mjs`

**Coverage**: Partially implemented. Both validators exist. Neither is called at runtime. `validateCase.mjs` is a manual offline tool.

**Why this shape**: Two parallel implementations — `validateContent` (TypeScript, runtime-capable) and `validateCase.mjs` (Node.js, offline). Both check the same things: broken scene-graph edges and missing clue references. The duplication exists because `validateCase.mjs` runs outside the browser (reads files from disk), while `validateContent` operates on loaded `CaseData`.

**Alternatives likely considered**: Calling `validateContent` after `loadCase` at runtime (not done — would add latency to case loading and require error UI). A build-time validation step in CI (not done — `validateCase.mjs` is not wired into any CI workflow). A single shared validation function (difficult — the offline script reads files from disk, the runtime function operates on in-memory data).

**Edge cases that shaped design**:
- Variant scene IDs are added to the valid scene set before validation — variants can be targets of choice outcomes.
- `advantageIf` clue references are validated — a choice referencing a nonexistent clue would silently fail to grant advantage.
- Neither validator checks outcome tier completeness — a choice missing a `partial` outcome would crash at runtime if the dice produce that tier.

---

## 15. Screen Flow & App Orchestration

**Files**: `src/App.tsx`, `src/main.tsx`, `src/components/TitleScreen/TitleScreen.tsx`, `src/components/TitleScreen/LoadGameScreen.tsx`, `src/components/ErrorBoundary/ErrorBoundary.tsx`

**Coverage**: Fully implemented for the current feature set. Missing: case selection screen, case completion screen, error display on load failure.

**Why this shape**: `App.tsx` manages a `Screen` union type via `useState`. No router — the game has no meaningful URL structure. Overlays (EvidenceBoard, CaseJournal, NPCGallery, SettingsPanel) are toggled by boolean state, keeping the game screen mounted underneath.

**Alternatives likely considered**: React Router (rejected — no URL-based navigation needed, back/forward would break game state). A state machine library like XState (rejected — `useState` is sufficient for 5 screens). Rendering overlays via portals (not done — overlays are siblings of `GameContent` in the component tree, which works fine with `fixed` positioning).

**Edge cases that shaped design**:
- `loadError` state is captured but never rendered — the user is silently returned to the title screen on load failure.
- Case ID is hardcoded to `'the-whitechapel-cipher'` — no case selection. Irrelevant with one case but blocks multi-case play.
- The `'loading'` screen state is transient — shown only during `loadAndStartCase`. If the fetch hangs, the user is stuck on a pulsing "Loading case…" with no timeout or cancel.
- `handleActivateAbility` sets a world flag (e.g., `ability-auto-succeed-reason`) but no engine code reads these flags to auto-succeed checks. The ability activation is wired to the UI but not to the dice engine.
