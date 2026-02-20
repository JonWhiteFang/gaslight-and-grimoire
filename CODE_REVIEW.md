# Code Review — Gaslight & Grimoire

Issues found during full codebase review, grouped by severity.

---

## Critical — Broken Functionality

### ~~1. Game screen doesn't render NarrativePanel or ChoicePanel~~ ✅ RESOLVED
~~`src/App.tsx`~~ — Fixed: Game screen now mounts NarrativePanel, StatusBar, and ChoicePanel via a `GameContent` component.

### ~~2. NarrativePanel displays scene ID, not narrative text~~ ✅ RESOLVED
~~`src/components/NarrativePanel/NarrativePanel.tsx`~~ — Fixed: Uses `useCurrentScene()` to resolve the scene and passes `scene.narrative` to SceneText, `scene.illustration` to SceneIllustration.

### ~~3. No case loading pipeline wired up~~ ✅ RESOLVED
~~`narrativeSlice.ts`~~ — Fixed: Added `loadAndStartCase` action that calls `loadCase()`, stores `caseData`, populates clues/NPCs, and navigates to the first scene. Wired into App after character creation.

### ~~4. `loadCase` / `loadVignette` fetch paths break on GitHub Pages~~ ✅ RESOLVED
~~`src/engine/narrativeEngine.ts`~~ — Fixed: `fetchJson` now prefixes URLs with `import.meta.env.BASE_URL`.

### ~~5. `processChoice` ignores dynamic difficulty~~ ✅ RESOLVED
~~`src/engine/narrativeEngine.ts`~~ — Fixed: `processChoice` now calls `resolveDC()` instead of using `choice.difficulty` directly.

### ~~6. ChoicePanel doesn't process faculty checks~~ ✅ RESOLVED
~~`src/components/ChoicePanel/ChoicePanel.tsx`~~ — Fixed: `handleSelect` now calls `processChoice()` for all choice types and populates `lastCheckResult` for the dice overlay.

---

## High — Logic Errors & Data Bugs

### ~~7. AmbientAudio uses scene ID as audio filename~~ ✅ RESOLVED
~~`src/components/AmbientAudio/AmbientAudio.tsx`~~ — Fixed: Now reads `scene.ambientAudio` via `useCurrentScene()` and prefixes with `BASE_URL`.

### ~~8. NarrativePanel passes no props to child components~~ ✅ RESOLVED
~~`NarrativePanel.tsx`~~ — Fixed: SceneIllustration receives `src` from the resolved scene. ClueDiscoveryCard remains a stub (Task 10).

### ~~9. HintButton level doesn't reset on scene change~~ ✅ RESOLVED
~~`src/components/HeaderBar/HintButton.tsx`~~ — Fixed: `useEffect` keyed on `gameState.currentScene` resets level to 1.

### ~~10. OutcomeBanner is invisible in reduced motion mode~~ ✅ RESOLVED
~~`src/components/NarrativePanel/OutcomeBanner.tsx`~~ — Fixed: Reduced motion branch now uses `DISPLAY_DURATION_MS` (2000ms).

### ~~11. `textSpeed` setting is never used~~ ✅ RESOLVED
~~`SceneText`~~ — Fixed: New `textSpeed` prop controls reveal speed. NarrativePanel passes it from settings.

### ~~12. `saveGame` always overwrites a single slot~~ ✅ RESOLVED
~~`src/store/slices/metaSlice.ts`~~ — Fixed: `saveGame` generates unique IDs, `autoSave` handles the autosave slot separately. Auto-saves trigger on scene/choice per settings. Manual saves capped at 10. LoadGameScreen has delete buttons.

### ~~13. CaseJournal shows raw internal IDs~~ ✅ RESOLVED
~~`src/components/CaseJournal/CaseJournal.tsx`~~ — Fixed: Shows discovered clues with type icons and titles, deduction descriptions, and filtered story-relevant flags with formatted names.

---

## Medium — Architecture & Convention Violations

### ~~14. ChoicePanel subscribes to the full store~~ ✅ RESOLVED
~~`src/components/ChoicePanel/ChoicePanel.tsx`~~ — Fixed: Now uses individual selector hooks and `buildGameState` from the store.

### ~~15. HeaderBar creates unstable selector objects~~ ✅ RESOLVED
~~`src/components/HeaderBar/HeaderBar.tsx`~~ — Fixed: Uses `useStore(buildGameState)` for stable reference.

### ~~16. Duplicate `calculateModifier` function~~ ✅ RESOLVED
~~`src/components/CharacterCreation/FacultyAllocation.tsx`~~ — Fixed: Imports and re-exports from `diceEngine.ts`.

### ~~17. Missing barrel exports~~ ✅ RESOLVED
Fixed: Added `index.ts` barrel exports for AccessibilityProvider, AmbientAudio, and SettingsPanel.

### ~~18. `validateCase.mjs` is hardcoded to one case~~ ✅ RESOLVED
Fixed: Accepts a case path argument or validates all cases and side-cases automatically.

### ~~19. Undefined Tailwind classes in use~~ ✅ RESOLVED
Fixed: Replaced `gaslight-dark` → `gaslight-ink`, `gaslight-surface` → `gaslight-slate`, `gaslight-parchment` → `gaslight-fog`.

---

## Low — Robustness & Polish

### ~~20. No React error boundary~~ ✅ RESOLVED
Fixed: `ErrorBoundary` component wraps App in `main.tsx` with recovery UI.

### ~~21. No `prefers-reduced-motion` detection~~ ✅ RESOLVED
Fixed: `AccessibilityProvider` detects `prefers-reduced-motion: reduce` on mount.

### ~~22. EvidenceBoard thread positions go stale~~ ✅ RESOLVED
Fixed: Recomputes thread positions on scroll and resize events.

### ~~23. DeductionButton failure timeout captures stale closure~~ ✅ RESOLVED
Fixed: Uses a ref to read current `connectedClueIds` in the timeout callback.

### ~~24. EvidenceBoard isBrightened uses inline IIFE in JSX~~ ✅ RESOLVED
Fixed: Extracted `shouldBrighten(clueId)` helper function.

### ~~25. FacultyAllocation button sizing conflict~~ ✅ RESOLVED
Fixed: Buttons use consistent `w-11 h-11` (44px) sizing.

### ~~26. AccessibilityProvider doesn't clean up DOM mutations~~ ✅ RESOLVED
Fixed: All `useEffect` hooks return cleanup functions that remove classes and CSS properties.

### ~~27. `startEncounter` reaction faculty comment is misleading~~ ✅ RESOLVED
Fixed: Comment updated to "Use the higher of Nerve or Lore, with Nerve as tiebreaker".

### ~~28. `saveManager.ts` TODO: IndexedDB upgrade~~ ✅ RESOLVED
Fixed: Removed misleading TODO. Header comment now accurately states localStorage is the storage mechanism.
