# Gaslight & Grimoire — Game Design Analysis

Date: 2026-02-23
Scope: Full codebase, content, assets, engine, UI/UX, and documentation review

---

## Executive Summary

Gaslight & Grimoire has a strong architectural foundation — clean engine/content separation, well-typed data models, a solid Zustand store, and thorough documentation. The core gameplay loop (discover → connect → act → reflect) is well-designed on paper. However, the game currently suffers from thin content, absent media assets, several unimplemented interaction mechanics, and balance issues that would significantly undermine player engagement. The 10 improvements below are ordered by impact on the player experience.

---

## ~~1. Implement Active Clue Discovery (Exploration, Check, Dialogue)~~ — ✅ FIXED

**Category:** Gameplay Mechanics
**Severity:** High — ✅ RESOLVED

**Resolution:** All four discovery methods now work. `exploration` renders atmospheric clickable prompts via `SceneCluePrompts` (auto-generated from clue type/title). `check` performs dice rolls via `performCheck` with one-shot-per-scene semantics and narrative failure text. `dialogue` auto-discovers on scene entry with speech-bubble variant `ClueDiscoveryCard` (🗣️ icon, "Gleaned from Conversation" header). No content JSON changes required. New files: `src/engine/cluePrompts.ts`, `src/components/NarrativePanel/SceneCluePrompts.tsx`.

---

## 2. Add Audio and Visual Assets

**Category:** Assets & Immersion
**Severity:** High — the game is completely silent and text-only

**Issue:** The audio system is fully coded (`AudioManager`, `AmbientAudio`, `audioSubscription.ts`, 9 SFX event types, per-scene `ambientAudio` field on `SceneNode`) but zero audio files exist in the repository. Howler silently swallows the missing file errors. Similarly, `SceneIllustration` renders an `<img>` tag from `scene.illustration`, but no image files exist. NPC portraits are letter-initial placeholders. The game is entirely text on a dark background.

**Impact:** For a gothic mystery game, atmosphere is everything. A silent, illustration-free experience dramatically reduces immersion. The audio infrastructure is wasted engineering without assets to drive it.

**Proposed Solution:**
- **Audio (minimum viable):** Source or generate 9 SFX files (dice-roll, 5 clue-type sounds, composure-decrease, vitality-decrease, scene-transition) as short MP3s. Add 2–3 ambient loops (gaslit-street, interior-parlour, occult-tension) and reference them in scene JSON via the existing `ambientAudio` field. Place files in `public/audio/sfx/` and `public/audio/ambient/`.
- **Illustrations (minimum viable):** Generate or commission scene illustrations for key narrative moments (act openers, encounter scenes, case climaxes). Even stylized silhouettes or atmospheric sketches in the gaslight palette would transform the experience. Reference them via the existing `scene.illustration` field.
- **NPC Portraits:** Replace letter-initial placeholders in `NPCGallery` with character portraits (illustrated or AI-generated in a consistent Victorian style).

**Files to modify:**
- `public/audio/` — new directory with asset files
- `public/images/` — new directory with illustrations
- Content JSON `act*.json` files — populate `illustration` and `ambientAudio` fields
- `src/components/NPCGallery/NPCGallery.tsx` — update `Portrait` component to use image assets

---

## 3. Deepen Branching and Content Volume

**Category:** Content
**Severity:** High — replayability is very limited

**Issue:** Quantitative analysis of the content reveals thin branching:

| Metric | Whitechapel Cipher | Mayfair Séance | A Matter of Shadows |
|---|---|---|---|
| Scenes | 22 | 25 | 7 |
| Avg choices/scene | 1.2 | 1.1 | 1.3 |
| Faculty checks | 11 | 9 | 2 |
| Dead-end scenes | 3 | 4 | 2 |
| Clues | 6 | 6 | 2 |
| NPCs | 3 | 3 | 1 |
| Variants | 1 | 1 | 0 |

An average of ~1.1 choices per scene means most scenes are linear corridors with a single "continue" option. Only 1 variant scene per case means cross-case state barely affects the narrative. 6 clues per case is thin for an evidence-board mechanic that requires connecting pairs.

**Impact:** Players will experience the game as largely linear on first playthrough and have little reason to replay. The Evidence Board — the game's signature mechanic — has too few clues to create interesting deduction puzzles.

**Proposed Solution:**
- Increase average choices per scene to 2.0–2.5 for main cases. Every non-terminal scene should offer at least 2 meaningful choices.
- Add 4–6 more clues per case (target: 10–12 total) with richer `connectsTo` graphs. Include more red herrings to make deduction non-trivial.
- Add 2–3 variant scenes per case that trigger based on faction reputation, NPC disposition, or cross-case flags.
- Add 2–3 more NPCs per case with faction diversity. The current cases only have 2 factions represented.
- Author at least 1 additional vignette with a different unlock condition (e.g., NPC disposition ≥ 7).

**Files to modify:**
- `public/content/cases/*/act*.json` — expand scene graphs
- `public/content/cases/*/clues.json` — add clues
- `public/content/cases/*/npcs.json` — add NPCs
- `public/content/cases/*/variants.json` — add variant scenes
- `public/content/side-cases/` — new vignette directories

---

## ~~4. Add NPC Dialogue and Interrogation Mechanics~~ — ✅ COMPLETE

**Category:** AI and NPC Behavior
**Severity:** High — NPCs were passive data, not interactive characters

**Resolution:** Rather than adding a separate `DialogueNode` type and `DialoguePanel` component, NPC dialogue was implemented using the existing scene/choice architecture. New `npcMemoryFlag` condition type gates choices on NPC-specific memory (e.g. "only show this option if Graves told you about the Yard"). New `setMemoryFlag` effect type sets NPC memory flags from `onEnter` effects. 8 new dialogue scenes added across both cases: Graves reveals Deputy Commissioner Harland (disposition ≥ 4 gate), Mott recognises the cipher typeface (clue gate), Vane cornered by cross-NPC evidence (Mott's `shown-cipher` memoryFlag gate), Ashworth reveals Gerald's secret and Elara Thorne (disposition ≥ 5 gate), Vesper reveals the full truth (Ashworth's `knows-gerald-secret` memoryFlag gate). `memoryFlags` now populated on key NPC interactions. Files changed: `src/types/index.ts`, `src/engine/narrativeEngine.ts`, `src/store/slices/worldSlice.ts`, `src/engine/effectMessages.ts`, content JSON, `src/engine/__tests__/npcMemoryFlag.test.ts`.

---

## ~~5. Add Composure and Vitality Recovery Mechanics~~ — ✅ COMPLETE

**Category:** Gameplay Mechanics / Balancing
**Severity:** Medium-High — created an unrecoverable death spiral

**Resolution:** Shared `breakdown` and `incapacitation` scenes created in `public/content/shared/` and injected into all cases via `injectSharedScenes` in `loadCase`/`loadVignette`. Case-specific variants added to Whitechapel Cipher (fog/cipher hallucination breakdown, alley collapse incapacitation) and Mayfair Séance (séance room overwhelm breakdown, supernatural assault incapacitation). Recovery effects (+1 composure/vitality) added to 6 scenes across both cases at natural rest points: cipher decoded, Graves confides, printshop success (Whitechapel); Ashworth confides, room thorough, rational success (Mayfair). Occultist Veil Sight also fixed in same pass: grants Lore advantage + variant scenes with occult content in both cases. Files changed: `src/engine/narrativeEngine.ts`, content JSON, `src/engine/__tests__/veilSight.test.ts`.

---

## 6. Make Evidence Board Connections Persistent and Add Drag-and-Drop

**Category:** UI/UX
**Severity:** Medium-High — the signature mechanic has friction

**Issue:** Evidence Board connections live in React `useState`, not the Zustand store. Closing and reopening the board loses all connections. This is documented as "by design" but is frustrating for players who may need to switch between the board and the narrative to gather more clues. Additionally, connections are keyboard-only (Spacebar to initiate, Spacebar on target to complete). There's no drag-and-drop, which is the natural interaction for a "corkboard with threads" metaphor. The ghost thread follows the mouse but clicking doesn't complete a connection.

**Impact:** Players lose work when they close the board. The keyboard-only connection flow is unintuitive for a visual corkboard metaphor. Touch/mobile users have no way to create connections at all.

**Proposed Solution:**
- Move `connections` state into the Zustand store (a new `boardSlice` or extend `evidenceSlice`). Persist connections across board open/close cycles. Clear them only on successful deduction or explicit "clear board" action.
- Add mouse click-to-connect: clicking a clue card starts a connection, clicking another completes it (mirroring the existing Spacebar flow but with mouse).
- Add drag-and-drop: dragging from one clue card to another creates a connection thread. Use the existing `ConnectionThread` SVG overlay with the ghost thread already tracking `mousePos`.
- For touch devices: tap-to-select, tap-target-to-connect (same as click flow).

**Files to modify:**
- `src/store/slices/evidenceSlice.ts` — add `connections` state and actions
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — wire to store, add click/drag handlers
- `src/components/EvidenceBoard/ClueCard.tsx` — add drag source behavior

---

## 7. Implement Scene History Navigation (Back Button)

**Category:** Player Engagement / UX
**Severity:** Medium — players feel trapped in forward-only progression

**Issue:** `sceneHistory` is tracked in the narrative slice (every `goToScene` call appends to it) but is never used for navigation. There's no "go back" button, no scene replay, and no way to revisit previous scenes. Combined with the lack of recovery mechanics and the randomness of dice checks, a bad outcome on a critical choice is permanent and irreversible.

**Impact:** Players who make a choice they regret (or fail a dice check) have no recourse except loading a save. Since autosave overwrites the single `autosave` slot, they may not even have a recent save to fall back on. This creates anxiety around choices rather than excitement.

**Proposed Solution:**
- Add a "Review Previous Scene" button to the `HeaderBar` that lets the player re-read the last scene's narrative (read-only, no re-choosing).
- For a more generous approach: allow navigating back to the previous scene and re-making the choice. This would require reverting the state changes from the forward navigation (undo the `onEnter` effects, un-discover clues, etc.). Store a state snapshot before each choice to enable clean rollback.
- At minimum, display `sceneHistory` in the `CaseJournal` as a timeline of visited scenes with their narrative excerpts, so players can review their path.

**Files to modify:**
- `src/components/HeaderBar/HeaderBar.tsx` — add back/review button
- `src/components/CaseJournal/CaseJournal.tsx` — add scene history timeline
- `src/store/slices/narrativeSlice.ts` — add `goToPreviousScene` action (if implementing full rollback)

---

## ~~8. Rebalance Dice Math for Player Agency~~ — ✅ FIXED

**Category:** Gameplay Mechanics / Balancing
**Severity:** Medium — ✅ RESOLVED

**Resolution:** Three changes applied: (1) Partial band widened from `dc - 2` to `dc - 3`, increasing partial outcomes from 10% to 15%. (2) Trained bonus (+1 modifier) added via `getTrainedBonus(faculty, archetype)` when the check faculty matches the archetype's primary faculty (deductionist→reason, occultist→lore, operator→vigor, mesmerist→influence). Bonus is reflected in `performCheck` return value, `ChoiceCard` proficiency tags, and `SceneCluePrompts` display. (3) All 34 content DC values lowered by 2 (e.g., DC 12→10, DC 14→12). Encounter reaction check stays at DC 12. Net effect: invested primary faculty (score 14, trained) now succeeds ~80% vs standard DC 10 (was 55% vs DC 12).

---

## ~~9. Add Consequence Feedback and Narrative Bridging~~ — ✅ COMPLETE

**Category:** Player Engagement / UX
**Severity:** Medium — state changes happened silently

**Resolution:** Added optional `description` field to `Effect` type. Pure `generateEffectMessage` function in `src/engine/effectMessages.ts` produces atmospheric text with mechanical annotation (e.g. "A chill settles over you (Composure −1)") for composure, vitality, disposition, suspicion, and reputation effects. Returns null for flag/discoverClue (invisible state / already has own UI). `EffectFeedback` component renders inline stacked messages in `NarrativePanel` between scene text and choices with Framer Motion staggered fade-in, `aria-live="polite"`, auto-dismiss after 6 seconds, respects `reducedMotion`. Content-authored `description` fields added to 4 scenes across Whitechapel Cipher and Mayfair Séance. New files: `src/engine/effectMessages.ts`, `src/components/NarrativePanel/EffectFeedback.tsx`, `src/engine/__tests__/effectMessages.test.ts`.

---

## 10. Expand Testing to Cover Integration Paths and Content Validation

**Category:** Testing & Debugging
**Severity:** Medium — good unit coverage but gaps in integration and content testing

**Issue:** The test suite (18 test files, 269 passing tests) has strong unit and property-based coverage for engine functions and individual components. However, there are notable gaps:
- No integration tests for the full choice → dice roll → scene navigation → effect application pipeline.
- No tests for `EncounterPanel` or `EvidenceBoard` components (only engine-level encounter tests exist).
- No automated content validation in CI — `validateCase.mjs` exists but isn't run in the `deploy.yml` workflow.
- No tests for the save/load round-trip through the UI (only `SaveManager` unit tests).
- The `hintEngine` tests mock `Date.now()` via `_setState` but don't test the actual 5-minute dwell trigger in a realistic scenario.
- No visual regression testing for the custom gaslight theme.

**Impact:** Regressions in the choice processing pipeline or content authoring errors could ship to production undetected. The lack of integration tests means the seams between engine, store, and components are untested.

**Proposed Solution:**
- Add `node scripts/validateCase.mjs` as a step in `deploy.yml` before the build step. Fail the build on validation errors.
- Add integration tests that exercise the full flow: `loadAndStartCase` → `goToScene` → `processChoice` → verify store state → verify component renders the correct scene.
- Add component tests for `EncounterPanel` and `EvidenceBoard` (at minimum: renders correctly, handles choice selection, handles connection creation).
- Add a content snapshot test that loads each case and asserts the scene graph is fully connected (no orphan scenes, no broken references) — complementing the runtime `validateContent` check.

**Files to modify:**
- `.github/workflows/deploy.yml` — add validation step
- `src/engine/__tests__/` — add integration test file
- `src/components/__tests__/` — add EncounterPanel and EvidenceBoard tests

---

## Bonus Observations

These didn't make the top 10 but are worth noting:

- **No mobile/touch support:** The Evidence Board uses mouse tracking (`mousemove` events) and keyboard shortcuts. No touch event handlers exist. The game would be difficult to play on tablets or phones.
- ~~**Faction reputation is unbounded:**~~ ✅ FIXED. Clamped to [-10, +10] in `adjustReputation`. All numeric state is now bounded.
- **Deduction descriptions are generic:** `buildDeduction` always returns "The threads converge into a clear deduction." or "A connection forms — but something feels off..." regardless of which clues are connected. Content-specific deduction text would make the Evidence Board feel more rewarding.
- ~~**`Occultist` ability (Veil Sight) has no mechanical effect:**~~ ✅ FIXED. Veil Sight now grants advantage on all Lore checks while active. Variant scenes added to both cases revealing occult content when flag is set.
- **No "skip typewriter" interaction:** The `SceneText` typewriter effect has no click-to-complete. Players must wait for the full text to render or change their settings to `instant`. A click/tap to instantly reveal remaining text is a standard CYOA convention.
- **Multiplayer/Co-op:** Not applicable to this single-player narrative game. No changes recommended.

---

## Priority Matrix

| # | Improvement | Effort | Impact | Priority |
|---|---|---|---|---|
| 1 | ~~Active Clue Discovery~~ ✅ | Medium | High | P0 — DONE |
| 2 | Audio & Visual Assets | High (asset creation) | High | P0 |
| 3 | Deepen Branching & Content | High (content authoring) | High | P0 |
| 4 | ~~NPC Dialogue System~~ ✅ | High | High | P1 — DONE |
| 5 | ~~Recovery Mechanics~~ ✅ | Low-Medium | High | P1 — DONE |
| 6 | ~~Persistent Evidence Board~~ ✅ | Medium | Medium-High | P1 — DONE |
| 7 | Scene History Navigation | Medium | Medium | P2 |
| 8 | ~~Rebalance Dice Math~~ ✅ | Low | Medium | P2 — DONE |
| 9 | ~~Consequence Feedback~~ ✅ | Medium | Medium | P2 — DONE |
| 10 | Expand Testing | Medium | Medium | P2 |
