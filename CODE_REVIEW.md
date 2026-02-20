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

### 12. `saveGame` always overwrites a single slot
`src/store/slices/metaSlice.ts:40` — `saveGame` hardcodes the ID as `'autosave'`. The LoadGameScreen UI implies multiple saves, but only one can ever exist.

### 13. CaseJournal shows raw internal IDs
`src/components/CaseJournal/CaseJournal.tsx` — Displays raw scene IDs (`wc-act1-scene1`) and raw flag names (`ability-auto-succeed-reason`) instead of human-readable text.

---

## Medium — Architecture & Convention Violations

### ~~14. ChoicePanel subscribes to the full store~~ ✅ RESOLVED
~~`src/components/ChoicePanel/ChoicePanel.tsx`~~ — Fixed: Now uses individual selector hooks and `buildGameState` from the store.

### 15. HeaderBar creates unstable selector objects
`src/components/HeaderBar/HeaderBar.tsx:30` — The `useStore` selector creates a new `GameState` object on every render, defeating Zustand's shallow equality check. HintButton re-renders on every store change.

### ~~16. Duplicate `calculateModifier` function~~ ✅ RESOLVED
~~`src/components/CharacterCreation/FacultyAllocation.tsx`~~ — Fixed: Imports and re-exports from `diceEngine.ts`.

### ~~17. Missing barrel exports~~ ✅ RESOLVED
Fixed: Added `index.ts` barrel exports for AccessibilityProvider, AmbientAudio, and SettingsPanel.

### 18. `validateCase.mjs` is hardcoded to one case
`scripts/validateCase.mjs` — Only validates `the-whitechapel-cipher`. Should accept a case name argument or iterate all cases/side-cases.

### ~~19. Undefined Tailwind classes in use~~ ✅ RESOLVED
Fixed: Replaced `gaslight-dark` → `gaslight-ink`, `gaslight-surface` → `gaslight-slate`, `gaslight-parchment` → `gaslight-fog`.

---

## Low — Robustness & Polish

### 20. No React error boundary
No error boundary exists anywhere. A runtime error in any component crashes the entire app to a white screen with no recovery path.

### 21. No `prefers-reduced-motion` detection
The app has a manual reduced motion toggle but doesn't read the OS-level `prefers-reduced-motion` media query to set the initial default.

### 22. EvidenceBoard thread positions go stale
`src/components/EvidenceBoard/EvidenceBoard.tsx` — Thread endpoint positions are computed once via `getBoundingClientRect` when the connection is made. If the board scrolls or cards reflow, threads will be misaligned.

### 23. DeductionButton failure timeout captures stale closure
`src/components/EvidenceBoard/DeductionButton.tsx:45` — The `setTimeout` in the failure handler captures `connectedClueIds` from the closure at click time. If connections change during the 2-second timeout, the wrong clues get reset to 'examined'.

### 24. EvidenceBoard isBrightened uses inline IIFE in JSX
`src/components/EvidenceBoard/EvidenceBoard.tsx:180` — The `isBrightened` prop uses an inline IIFE `(() => { ... })()` which creates a new function every render and hurts readability. Should be extracted to a helper or memoized.

### 25. FacultyAllocation button sizing conflict
`src/components/CharacterCreation/FacultyAllocation.tsx` — The +/- buttons have `w-7 h-7` (28px) but also `min-w-[44px] min-h-[44px]`. The min overrides the explicit size, making the visual layout inconsistent with the declared dimensions.

### 26. AccessibilityProvider doesn't clean up DOM mutations
`src/components/AccessibilityProvider/AccessibilityProvider.tsx` — Sets CSS custom properties and classes on `document.documentElement` but never removes them on unmount. If the provider remounts (e.g. during screen transitions), stale classes could accumulate.

### 27. `startEncounter` reaction faculty comment is misleading
`src/engine/narrativeEngine.ts:290` — Comment says "Prefer Nerve; fall back to Lore" but the code actually picks whichever faculty score is higher (with nerve as tiebreaker). The comment should say "Use the higher of Nerve or Lore."

### 28. `saveManager.ts` TODO: IndexedDB upgrade
The file header notes `TODO: upgrade to IndexedDB for larger save files` and the steering docs claim IndexedDB is the primary storage, but the implementation is localStorage-only. The docs and code are out of sync.
