# Implementation Plan: Gaslight & Grimoire

## Overview

Incremental implementation across five phases: foundation scaffolding and core engine, the main gameplay loop, the evidence board and NPC systems, content and polish, and finally expansion content. Each task builds on the previous, ending with fully wired, playable game.

Tech stack: React 18+, Zustand + Immer, Tailwind CSS, Framer Motion, Howler.js, Vitest + React Testing Library, IndexedDB with localStorage fallback.

## Tasks

- [x] 1. Project scaffolding and Zustand store foundation
  - Initialise Vite + React 18 + TypeScript project with Tailwind CSS configured
  - Install and configure Zustand with Immer middleware, Framer Motion, Howler.js, Vitest + React Testing Library
  - Create the normalised `GameStore` with all six slices (`investigator`, `narrative`, `evidence`, `npc`, `world`, `meta`) matching the interfaces in the design doc
  - Export typed `useStore` hook and per-slice selector hooks
  - Create all TypeScript interfaces from the design doc: `Investigator`, `Clue`, `Deduction`, `NPCState`, `SceneNode`, `Choice`, `GameState`, `SaveFile`, `GameSettings`
  - Scaffold the `/content/cases/` and `/content/side-cases/` directory structure with placeholder JSON files
  - _Requirements: 1, 2, 4, 6, 8, 10, 11_

  - [x] 1.1 Write property tests for Zustand store slice isolation
    - **Property 1: Updating one slice does not mutate sibling slices**
    - **Validates: Requirements 2, 6, 8**

- [x] 2. Dice Engine
  - Implement `rollD20()`, `rollWithAdvantage()`, `rollWithDisadvantage()` as pure functions
  - Implement `calculateModifier(facultyScore)` using `Math.floor((score - 10) / 2)`
  - Implement `resolveCheck(roll, modifier, dc)` returning the correct `OutcomeTier` (critical / success / partial / failure / fumble), including natural-20 and natural-1 detection
  - Implement `performCheck(faculty, investigator, dc, hasAdvantage, hasDisadvantage)` as the full pipeline
  - Implement dynamic difficulty scaling via `dynamicDifficulty` config on a `Choice`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.1 Write property tests for Dice Engine
    - **Property 2: `rollD20` always returns an integer in [1, 20]**
    - **Validates: Requirements 4.1**
    - **Property 3: Advantage result is always ≥ either individual roll; Disadvantage result is always ≤ either individual roll**
    - **Validates: Requirements 4.3, 4.4**
    - **Property 4: `calculateModifier` is monotonically non-decreasing and matches the floor formula for all scores 1–20**
    - **Validates: Requirements 4.1**
    - **Property 5: `resolveCheck` with natural 20 always returns `critical`; natural 1 always returns `fumble`**
    - **Validates: Requirements 4.2**

- [x] 3. Narrative Engine — content loading and condition evaluation
  - Implement `loadCase(caseId)` and `loadVignette(vignetteId)` that fetch and parse JSON files from `/content/`
  - Implement `validateContent(caseData)` checking for broken scene-graph edges and missing clue references; log descriptive errors on failure
  - Implement `evaluateConditions(conditions, state)` supporting all condition types: `hasClue`, `hasDeduction`, `hasFlag`, `facultyMin`, `archetypeIs`, `npcDisposition`, `factionReputation`
  - Implement `resolveScene(sceneId, state)` returning the variant scene when its condition is met, otherwise the base scene
  - Apply `onEnter` effects (composure, vitality, flag, disposition, suspicion, reputation, discoverClue) when a scene is entered
  - Maintain `sceneHistory` in the narrative slice on every `goToScene` call
  - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.8, 2.9, 10.7, 17.1–17.5_

  - [x] 3.1 Write property tests for condition evaluation
    - **Property 6: `evaluateConditions` with an empty conditions array always returns `true`**
    - **Validates: Requirements 2.5**
    - **Property 7: `evaluateConditions` is pure — same state and conditions always produce the same result**
    - **Validates: Requirements 2.5, 3.2**

- [x] 4. Character Creation UI
  - Implement `<ArchetypeSelect />` displaying all four Archetype cards (Deductionist, Occultist, Operator, Mesmerist) with name, description, Faculty bonuses, and unique ability
  - Implement `<FacultyAllocation />` with a point-buy UI: base 8 per Faculty, 12 bonus points to distribute, live `Faculty_Modifier` display, and validation that all 12 points are allocated before confirming
  - Implement `<CharacterCreation />` parent that wires both components, initialises `composure: 10` and `vitality: 10` on confirm, and navigates to the game screen
  - Add Investigator name input field
  - _Requirements: 1.1–1.7_

  - [x] 4.1 Write unit tests for Faculty allocation validation
    - Test that confirming with unspent points is blocked
    - Test that Faculty_Modifier updates in real time
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 5. Checkpoint — core engine wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Scene rendering and Narrative Panel
  - Implement `<SceneText />` with typewriter effect using Framer Motion; respect `reducedMotion` setting by rendering text instantly
  - Implement `<SceneIllustration />` that conditionally renders the scene illustration when present
  - Implement `<NarrativePanel />` composing `SceneText`, `SceneIllustration`, `DiceRollOverlay`, `OutcomeBanner`, and `ClueDiscoveryCard`
  - Wire `NarrativePanel` to the narrative slice so it re-renders on `goToScene`
  - _Requirements: 2.2, 2.3, 2.4_

  - [x] 6.1 Write unit tests for typewriter effect
    - Test instant render when `reducedMotion` is true
    - Test that full text is eventually rendered in typewriter mode
    - _Requirements: 2.2, 2.3_

- [x] 7. Choice Panel
  - Implement `<ChoiceCard />` displaying choice text, Faculty tag, proficiency colour (green ≥ +2, amber 0–+1, red ≤ -1), text label alongside colour, Advantage indicator icon, and key icon for Deduction/Clue-unlocked choices
  - Implement `<ChoicePanel />` that filters choices using `evaluateConditions` and renders only choices whose requirements are met
  - Wire choice selection to `NarrativeEngine.processChoice`, which triggers the dice roll and navigates to the outcome scene
  - _Requirements: 3.1–3.6, 16.4_

  - [x] 7.1 Write unit tests for choice visibility filtering
    - Test that choices with unmet clue/flag/faculty requirements are hidden
    - Test that Advantage indicator appears when the investigator holds the relevant clue
    - _Requirements: 3.2, 3.5_

- [x] 8. Dice Roll UI and Outcome Feedback
  - Implement `<DiceRollOverlay />` with animated d20 using Framer Motion; skip animation when `reducedMotion` is true; display roll value, modifier, and total
  - Implement `<OutcomeBanner />` with tier-specific colour and icon (gold/star, amber/check, muted-amber/warning, crimson/X, deep-red/skull); display for 2 s then fade; instant transition when `reducedMotion` is true
  - Wire both components into `NarrativePanel` so they appear after a Faculty_Check resolves
  - _Requirements: 4.6, 4.7, 4.8, 16.1, 16.2, 16.5_

  - [x] 8.1 Write unit tests for OutcomeBanner
    - Test correct icon and colour for each of the five outcome tiers
    - Test that banner is not rendered when `reducedMotion` is true (instant transition)
    - _Requirements: 16.1, 16.5_

- [x] 9. Status Bar — Composure and Vitality
  - Implement `<ComposureMeter />` and `<VitalityMeter />` as animated bars (0–10) using Framer Motion
  - On decrease: pulse red and show descriptor ("Shaken", "Bruised") for 3 s; on increase: pulse warm gold and show descriptor ("Steadied", "Mended") for 3 s
  - Shift bar to persistent pulsing red when value ≤ 2
  - Suppress all pulse animations when `reducedMotion` is true
  - Wire `adjustComposure` and `adjustVitality` store actions to trigger Breakdown / Incapacitation narrative events when either reaches 0
  - _Requirements: 5.1–5.7_

  - [x] 9.1 Write unit tests for status threshold triggers
    - Test Breakdown event fires when composure reaches 0
    - Test Incapacitation event fires when vitality reaches 0
    - Test critical-threshold styling activates at ≤ 2
    - _Requirements: 5.4, 5.5, 5.6_

- [x] 10. Clue Discovery and Inventory
  - Implement clue discovery logic in `NarrativeEngine.processChoice` and `onEnter` effect handler: automatic, exploration, check, and dialogue methods; enforce `requiresFaculty` and `requiresDeduction` gates
  - Implement `<ClueDiscoveryCard />` that slides in from the right (Framer Motion) showing type icon, title, and one-line summary; auto-dismiss after 4 s or on click; skip slide animation when `reducedMotion` is true
  - Pulse the `<EvidenceBoardToggle />` in the header when a new clue is added to the inventory
  - Add clue to store with status `"new"` via `discoverClue`; never surface missed hidden clues to the player
  - Wire clue-type-specific chime SFX via Howler.js on discovery
  - _Requirements: 6.1–6.8_

  - [x] 10.1 Write unit tests for clue discovery gating
    - Test that a clue requiring a Faculty minimum is not discovered below that threshold
    - Test that a clue requiring a prior Deduction is not discovered without it
    - _Requirements: 6.2_

- [x] 11. Checkpoint — gameplay loop playable end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Evidence Board — corkboard UI and clue cards
  - Implement `<EvidenceBoard />` as a full-screen overlay (accessible at any time during gameplay)
  - Implement `<ClueCard />` as a draggable card with six visual states: `new` (pulsing amber glow + badge), `examined` (standard), `connected` (gold thread), `deduced` (brass pin + green glow), `contested` (slack red thread + question mark), `spent` (greyed out + checkmark)
  - Implement `<ProgressSummary />` showing "Clues: N/? · Deductions: N/?" with totals hidden until Case complete
  - Implement keyboard navigation: Tab between clue cards, Spacebar to initiate a connection
  - _Requirements: 7.1, 7.2, 7.3, 12.5_

  - [x] 12.1 Write unit tests for ClueCard status rendering
    - Test each of the six status states renders the correct visual indicator
    - _Requirements: 7.3_

- [x] 13. Evidence Board — connection threading and Deductions
  - Implement `<ConnectionThread />` drag-to-connect interaction; on drag start, subtly brighten clues sharing at least one tag with the source clue
  - Implement `<DeductionButton />` that triggers a Reason Faculty_Check via `DiceEngine.performCheck`
  - On Deduction success: lock connected clues with permanent Deduction indicator, add `Deduction` to store, unlock associated scenes/dialogue
  - On Deduction failure: animate thread going slack; clues remain available for future attempts
  - If any connected clue is a Red Herring, mark `Deduction.isRedHerring = true` and route narrative to the incorrect path
  - _Requirements: 7.4–7.10_

  - [x] 13.1 Write property tests for Deduction formation
    - **Property 8: A Deduction formed from clues where any clue is a Red Herring always sets `isRedHerring = true`**
    - **Validates: Requirements 7.10**

- [x] 14. NPC System
  - Implement NPC slice actions: `adjustDisposition`, `adjustSuspicion`, `setNpcMemoryFlag`, `removeNpc`
  - Wire NPC state changes to choice `npcEffect` and `onEnter` effects in `NarrativeEngine`
  - Implement Suspicion-tier behaviour gates in `evaluateConditions`: 0–2 normal, 3–5 requires Influence check, 6–8 conceals info, 9–10 hostile action
  - Implement faction reputation propagation: when a faction-aligned NPC's Disposition changes, apply proportional shift to `factionReputation`
  - Implement `removeNpc` to mark NPC as inaccessible and route to alternative scene content
  - Persist NPC state across Cases in the save file
  - _Requirements: 8.1–8.9, 19.1–19.5_

  - [x] 14.1 Write property tests for NPC disposition and suspicion bounds
    - **Property 9: `adjustDisposition` never produces a value outside [-10, +10]**
    - **Validates: Requirements 8.1**
    - **Property 10: `adjustSuspicion` never produces a value outside [0, 10]**
    - **Validates: Requirements 8.1**

- [x] 15. NPC Gallery and Case Journal
  - Implement `<NPCGallery />` overlay listing all encountered NPCs with portrait placeholder, faction, and Disposition described in narrative terms (e.g. "Warm", "Suspicious", "Hostile")
  - Implement `<CaseJournal />` overlay that auto-updates with a plain-prose summary of key case events as flags and scene history accumulate
  - Wire both overlays to be accessible from `<HeaderBar />`
  - _Requirements: 12.10, 12.11_

- [x] 16. Checkpoint — Evidence Board and NPC systems complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Encounter System
  - Implement encounter round loop in `NarrativeEngine`: 2–4 rounds, each with 2–4 Faculty-tagged choices
  - Implement `Reaction_Check` at the start of supernatural encounters (Nerve or Lore); on failure reduce Composure by 1–2 and replace one choice with a worse alternative
  - Apply dual-axis damage (Composure and Vitality simultaneously) for supernatural encounters
  - Grant Advantage or unique resolution options when the Investigator holds relevant Occult Fragment clues
  - Ensure a non-combat escape path exists when prior clue gathering conditions are met
  - _Requirements: 9.1–9.7_

- [x] 18. Archetype Abilities
  - Implement `<AbilityButton />` in `<HeaderBar />` showing ability name and availability; grey out with visual indicator when `abilityUsed` is true
  - Implement ability activation handlers for each Archetype:
    - Deductionist "Elementary": auto-succeed next Reason check for clue connection
    - Occultist "Veil Sight": reveal hidden supernatural scene elements
    - Operator "Street Survivor": auto-succeed next Vigor escape check
    - Mesmerist "Silver Tongue": auto-succeed next Influence interrogation/negotiation check
  - Call `useAbility()` store action on activation; call `resetAbility()` when a new Case begins
  - _Requirements: 15.1–15.6_

  - [x] 18.1 Write unit tests for ability lifecycle
    - Test ability is available at Case start and unavailable after use
    - Test `resetAbility` restores availability on new Case
    - _Requirements: 15.5, 15.6_

- [x] 19. Hint System
  - Implement `HintEngine` with `trackActivity`, `shouldShowHint`, `getHint`, and `resetForScene`
  - Trigger hint icon fade-in after 3+ Evidence Board visits without a connection attempt, or 5+ minutes on a single scene
  - Implement three hint levels: Level 1 narrative nudge, Level 2 specific clue connection suggestion, Level 3 direct reveal (only after Level 2 viewed)
  - Hints surface only on deliberate player action; suppress all hint triggers when `hintsEnabled` is false in settings
  - Reset hint tracking on scene change
  - _Requirements: 13.1–13.6_

  - [x] 19.1 Write unit tests for hint trigger conditions
    - Test hint icon appears after 3 board visits without connection
    - Test hint icon appears after 5-minute scene dwell
    - Test hints are fully suppressed when disabled in settings
    - _Requirements: 13.1, 13.6_

- [x] 20. Save / Load System
  - Implement `SaveManager` with `save`, `load`, `listSaves`, `deleteSave`, and `migrate`
  - Serialise full `GameState` into a versioned `SaveFile` (`{ version, timestamp, state }`)
  - Store to IndexedDB as primary; fall back to localStorage when IndexedDB is unavailable
  - Implement auto-save modes: `"choice"` (after each choice), `"scene"` (on scene enter), `"manual"` (explicit trigger only)
  - Implement `migrate(saveFile)` that upgrades older version numbers to the current schema
  - Wire `saveGame` and `loadGame` store actions to `SaveManager`
  - Implement Load Game screen listing saves with timestamps; restore full state and resume at saved scene
  - _Requirements: 11.1–11.8_

  - [x] 20.1 Write property tests for save/load round-trip
    - **Property 11: `save` followed by `load` produces a `GameState` deeply equal to the original**
    - **Validates: Requirements 11.1, 11.7**
    - **Property 12: `migrate` is idempotent — migrating an already-current save file returns an equivalent file**
    - **Validates: Requirements 11.3, 11.8**

- [x] 21. Checkpoint — save/load and all systems integrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Accessibility — settings panel and core a11y
  - Implement `<SettingsPanel />` with: font size presets (Standard, Large, Extra Large) + custom slider; high contrast mode toggle; reduced motion toggle; reading pace control (typewriter speed or instant); separate ambient and SFX volume sliders; auto-save frequency selector; hints toggle
  - Implement `<AccessibilityProvider />` that reads settings from the store and applies CSS custom properties for font size and high contrast palette
  - Ensure all interactive elements have a minimum 44×44 px touch target
  - Add ARIA labels, roles, and focus management to all narrative text, choice cards, Evidence Board, and overlays
  - Implement full keyboard navigation: arrow keys + Enter for choices, Tab + Spacebar for Evidence Board, standard menu access
  - _Requirements: 12.1–12.9_

  - [x] 22.1 Write unit tests for accessibility settings propagation
    - Test that `reducedMotion: true` disables all animations across SceneText, DiceRollOverlay, OutcomeBanner, StatusBar, and ClueDiscoveryCard
    - Test that font size changes apply to narrative text and choice cards
    - _Requirements: 12.1, 12.4_

- [x] 23. Audio System
  - Implement `<AmbientAudio />` using Howler.js: load and loop the ambient track specified by the current `SceneNode.ambientAudio`; cross-fade on scene transition
  - Wire SFX triggers: dice roll sound on Faculty_Check, clue-type chime on discovery, low dissonant tone on Composure decrease, percussive impact on Vitality decrease, pen-scratch on scene transition
  - Respect `audioVolume.ambient` and `audioVolume.sfx` settings from the store
  - Ensure every audio cue has a visual equivalent already implemented (OutcomeBanner, ClueDiscoveryCard, StatusBar descriptors)
  - _Requirements: 14.1–14.7_

- [x] 24. Title Screen and Game Flow
  - Implement `<TitleScreen />` with New Game, Load Game, and Settings options; apply atmospheric colour palette, typography, and ambient audio
  - Wire New Game → `<CharacterCreation />`; Load Game → save list screen → restore state; Settings → `<SettingsPanel />`
  - Implement top-level routing between TitleScreen, CharacterCreation, and GameScreen using React state or a lightweight router
  - _Requirements: 18.1–18.5_

- [x] 25. Starter case content — "The Whitechapel Cipher" (Case 1)
  - Author `meta.json`, `act1.json`, `act2.json`, `act3.json`, `clues.json`, `npcs.json`, and `variants.json` for the first main Case
  - Include at least two distinct investigative angles and at least two Faculty-based approaches at every mandatory scene
  - Include at least one Variant_Scene triggered by a persistent flag
  - Include at least one Red Herring clue and one Occult Fragment clue
  - Validate content with `NarrativeEngine.validateContent` and fix any broken graph edges
  - _Requirements: 10.1, 10.3, 10.4, 17.1–17.5_

- [x] 26. Case Progression — post-case persistence and Vignette unlocking
  - Implement end-of-Case logic: persist flags, faction reputation, and NPC state; grant +1 Faculty bonus to the Faculty used in the critical success moment
  - Implement Vignette unlock checks: faction reputation thresholds, NPC Disposition ≥ 7, unresolved prior-Case threads
  - Author one starter Vignette (`meta.json`, `scenes.json`, `clues.json`, `npcs.json`) triggered by a Case 1 outcome
  - _Requirements: 10.5, 10.6, 10.8_

- [x] 27. Final checkpoint — full game playable from title to case completion
  - Ensure all tests pass, ask the user if questions arise.
