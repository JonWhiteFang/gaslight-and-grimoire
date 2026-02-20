# Philosophy

> Design principles and architectural decisions inferred from code patterns, not stated documentation.

## Implicit Design Principles

### Content is data, logic is code
The most consistently enforced boundary in the codebase. Narrative content lives as JSON under `content/`. Game logic lives as TypeScript under `src/engine/`. Content mutates game state exclusively through `Condition` and `Effect` objects — there are zero ad-hoc content handlers. This principle is repeated in comments, enforced by the type system, and validated by `validateCase.mjs`.

### Engine functions are pure where possible
The engine layer (`src/engine/`) aspires to pure functions that take `GameState` and return results. `evaluateConditions`, `resolveScene`, `canDiscoverClue`, `resolveCheck`, `calculateModifier`, `resolveDC`, `performCheck`, and `buildDeduction` are all pure. The exceptions — `applyOnEnterEffects`, `processChoice`, `startEncounter`, `processEncounterChoice` — access the store imperatively, and this impurity is acknowledged in comments as a pragmatic tradeoff.

### State is flat and normalised
Every collection in the store uses `Record<string, T>` keyed by ID. No nested arrays, no deeply nested objects. This is stated in comments and enforced in every slice. It makes lookups O(1) and Immer patches efficient.

### Accessibility is not an afterthought
146 ARIA attributes across 32 component files. `min-h-[44px]` on all interactive elements (14 occurrences across 5 files). `w-11 h-11` (44px) on icon buttons (12 occurrences across 8 files). Focus trapping in Settings. Escape-to-close on all overlays. OS `prefers-reduced-motion` detection. Three font size presets plus a custom slider. High contrast mode. Text speed control. This is not bolted on — it's woven into every component from the start.

### Knowledge has mechanical impact
Clues grant Advantage (roll 2d20, take highest) on faculty checks. Deductions unlock choices and dialogue. This is the core gameplay contract: investigation rewards are not just narrative — they change the math. The `advantageIf` field on `Choice` and the advantage check in `processChoice` enforce this.

### No single faculty gates critical progress
Implied by the archetype system (4 archetypes with different faculty distributions) and the `dynamicDifficulty` mechanism. Content is expected to provide alternate paths so that any archetype can complete the story. This is a content authoring rule, not enforced by code.

### Choices have meaningful consequences
NPC disposition, suspicion, faction reputation, world flags, composure, and vitality all change based on choices. These changes persist across scenes and cases. The `npcEffect` field on choices, the `onEnter` effects on scenes, and the faction propagation in `npcSlice` all serve this principle.

## Consistent Coding Patterns

### Component directory convention
Every component lives in `src/components/[Name]/` with an `index.ts` barrel export. Internal files (sub-components, helpers) are never imported across component boundaries. 14 component directories follow this pattern with zero exceptions.

### Selector + action hook separation
State is read via selector hooks (`useInvestigator`, `useClues`, etc.) and mutated via action hooks (`useInvestigatorActions`, `useEvidenceActions`, etc.). This separation is consistent across all 6 slices and enforced by the hook exports in `store/index.ts`.

### Requirement traceability
178 `Req X.Y` references across 39 files. Every component, engine function, and test cites the requirement it implements. This suggests development was driven by a formal requirements document (likely the spec in `.kiro/specs/`). The traceability is unusually thorough for a game project.

### Immer draft mutation
All slice actions use Immer's draft mutation pattern — direct property assignment inside `set()` callbacks. No manual spreading, no `Object.assign` (except one case in `updateSettings`). This is consistent across all 6 slices.

### Reduced motion as a first-class prop
Every animated component (`SceneText`, `DiceRollOverlay`, `OutcomeBanner`, `HintButton`, `ConnectionThread`) accepts a `reducedMotion` prop or reads it from the store, and provides a zero-duration alternative. Framer Motion components check the prop individually; CSS animations are handled by the global `.reduced-motion` class.

### Error boundary as crash recovery
A single `ErrorBoundary` wraps the entire app. It catches render errors, logs to console, and shows a recovery screen. The fallback message claims auto-save has occurred — optimistic but consistent with the autosave-on-scene-transition design.

## Architectural Decisions Evident in Structure

### No router
Screen transitions are managed by a `useState<Screen>` in `App.tsx` with imperative `setScreen()` calls. There is no `react-router`, no URL-based navigation, no browser history integration. This is deliberate — the game has no meaningful URL structure and back/forward navigation would break game state.

### No dependency injection framework
All dependencies are imported directly. Engine modules import `useStore`. Components import engine functions. Singletons (`AudioManager`, `hintEngine`, `SaveManager`) are module-level objects. This keeps the code simple but makes testing harder — tests use `_setState` hacks and full store setups.

### Zustand over Redux
Zustand with Immer was chosen over Redux. The evidence: no action types, no reducers, no dispatch. Slices are plain functions that call `set()` directly. Cross-slice communication happens via `get()` calls (e.g., `npcSlice` calling `adjustReputation`). This is simpler than Redux but creates hidden coupling.

### Overlays over routes
Evidence Board, Case Journal, NPC Gallery, and Settings are full-screen overlays toggled by boolean state, not separate routes or screens. This means the game screen stays mounted underneath — state is preserved, audio keeps playing, and the overlay can be dismissed instantly.

### Content fetched at runtime, not bundled
Case JSON is served as static files and fetched via `fetch()` at runtime, not imported or bundled by Vite. This means content can be updated independently of the app bundle, and the bundle size doesn't grow with content volume. The tradeoff is a loading screen and network dependency on first play.

### localStorage over IndexedDB
Save data uses `localStorage` (synchronous, ~5-10MB limit, string-only) rather than IndexedDB (async, larger, structured). This keeps the save system simple and synchronous but limits save file size and blocks the main thread during writes.

### Property-based testing for invariants
The codebase uses fast-check for property-based tests on dice bounds, NPC value clamping, deduction red-herring propagation, save migration idempotency, and slice isolation. This is unusual for a game project and suggests a focus on correctness over coverage metrics.

### Engine-first, UI-second development
The encounter system, hint engine, and case progression engine are fully implemented and tested but have incomplete or missing UI. This suggests a development approach where engine logic is built and validated first, with UI integration as a separate phase. The `Req X.Y` comments support this — they reference a requirements doc that likely defined engine behavior before UI.
