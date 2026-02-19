# Requirements Document

## Introduction

Gaslight & Grimoire is a browser-based choose-your-own-adventure game set in Victorian London (1893) where magic exists beneath the rational world. Players take on the role of an investigator navigating branching mysteries, gathering clues, interrogating suspects, making deductions, and surviving encounters with both mundane and supernatural threats. The game blends Sherlock Holmes-style deductive reasoning with D&D-style stat checks and dice mechanics, wrapped in atmospheric gothic storytelling. Built with React 18+, Zustand, Tailwind CSS, and a JSON-driven narrative engine.

## Glossary

- **Game**: The Gaslight & Grimoire browser application
- **Investigator**: The player character with Faculties, Composure, and Vitality
- **Faculty**: One of six character attributes (Reason, Perception, Nerve, Vigor, Influence, Lore) used for skill checks
- **Faculty_Modifier**: A derived value calculated as (Faculty Score - 10) / 2, rounded down
- **Archetype**: A starting character template (Deductionist, Occultist, Operator, Mesmerist) providing Faculty bonuses and a unique ability
- **Composure**: Mental/emotional stability meter (0–10); at 0 the Investigator suffers a Breakdown
- **Vitality**: Physical health meter (0–10); at 0 the Investigator is Incapacitated
- **Faculty_Check**: A d20 roll plus Faculty_Modifier compared against a Difficulty Class
- **Difficulty_Class**: A target number (Routine 8, Moderate 12, Hard 16, Formidable 20, Supernatural 24+)
- **Advantage**: Rolling 2d20 and taking the higher result, granted by relevant clues
- **Disadvantage**: Rolling 2d20 and taking the lower result, applied when injured, stressed, or unprepared
- **Clue**: A piece of evidence discovered during investigation, categorized as Physical Evidence, Testimony, Occult Fragment, Deduction, or Red Herring
- **Evidence_Board**: A persistent UI overlay where players pin clues, draw connections, and form Deductions
- **Deduction**: A player-created connection between two or more clues, validated by a Reason check
- **Connection_Thread**: A visual link drawn between two clues on the Evidence_Board
- **NPC**: A non-player character with Disposition, Suspicion, and memory flags
- **Disposition**: An NPC relationship value from -10 (hostile) to +10 (devoted)
- **Suspicion**: An NPC awareness value from 0 (oblivious) to 10 (fully aware)
- **Scene_Node**: A single narrative unit containing text, choices, clue discoveries, and conditions
- **Narrative_Engine**: The system that traverses the JSON scene graph, evaluates conditions, and renders scenes
- **Case**: A self-contained mystery following a three-act structure (The Scene, The Web, The Reckoning)
- **Vignette**: A shorter optional side case with a simplified two-act structure
- **Dice_Engine**: The module responsible for d20 rolls, Advantage/Disadvantage, and modifier calculations
- **Save_File**: A versioned JSON serialization of the full game state stored in IndexedDB
- **Hint_System**: A three-tier contextual help system that provides escalating guidance
- **Choice_Panel**: The UI area displaying available player choices with Faculty tags and proficiency indicators
- **Narrative_Panel**: The main UI area displaying scene text, illustrations, and outcome feedback
- **Status_Bar**: The UI component showing Composure and Vitality meters
- **Outcome_Banner**: A brief visual indicator showing the result tier of a Faculty_Check
- **Settings_Panel**: The UI for configuring accessibility, audio, and save preferences
- **Reaction_Check**: A snap Faculty_Check at the start of supernatural encounters that determines available options
- **Variant_Scene**: An alternative Scene_Node that replaces a base scene based on persistent flags from prior Cases

## Requirements

### Requirement 1: Character Creation

**User Story:** As a player, I want to create an Investigator by choosing an Archetype and allocating Faculty points, so that I can personalize my character before starting a Case.

#### Acceptance Criteria

1. THE Game SHALL present four Archetype options (Deductionist, Occultist, Operator, Mesmerist) with descriptions of their bonuses and unique abilities.
2. WHEN the player selects an Archetype, THE Game SHALL apply the Archetype's Faculty bonuses to a base value of 8 for each Faculty.
3. THE Game SHALL provide the player with 12 bonus points to distribute across the six Faculties.
4. WHEN the player attempts to confirm character creation, THE Game SHALL validate that all 12 bonus points have been allocated before proceeding.
5. THE Game SHALL display the calculated Faculty_Modifier for each Faculty in real time as points are allocated.
6. WHEN character creation is confirmed, THE Game SHALL initialize Composure to 10 and Vitality to 10.
7. THE Game SHALL allow the player to enter a name for the Investigator.

### Requirement 2: Narrative Engine and Scene Rendering

**User Story:** As a player, I want to read atmospheric scene text and see the story unfold based on my choices, so that I experience an immersive branching mystery.

#### Acceptance Criteria

1. THE Narrative_Engine SHALL load Scene_Node data from structured JSON files organized by Case and act.
2. WHEN a Scene_Node is loaded, THE Narrative_Panel SHALL display the scene's narrative text with a typewriter effect.
3. WHILE reduced motion mode is enabled, THE Narrative_Panel SHALL display all text instantly without the typewriter effect.
4. WHEN a Scene_Node has an associated illustration, THE Narrative_Panel SHALL display the illustration alongside the narrative text.
5. THE Narrative_Engine SHALL evaluate Scene_Node conditions (required clues, flags, Deductions, Faculty thresholds) to determine which scenes are accessible.
6. WHEN a Scene_Node has a Variant_Scene whose conditions are met, THE Narrative_Engine SHALL load the Variant_Scene in place of the base scene.
7. WHEN a Scene_Node specifies onEnter effects, THE Narrative_Engine SHALL apply those effects (Composure changes, Vitality changes, flag updates) upon entering the scene.
8. THE Narrative_Engine SHALL maintain a scene history recording each Scene_Node visited in order.
9. WHEN a Scene_Node is restricted to a specific Archetype, THE Narrative_Engine SHALL make that scene accessible only to Investigators of that Archetype.

### Requirement 3: Choice System

**User Story:** As a player, I want to select from meaningful choices that use my Investigator's Faculties, so that my character build and preparation affect the story.

#### Acceptance Criteria

1. THE Choice_Panel SHALL display all available choices for the current Scene_Node.
2. WHEN a choice requires a specific Clue, Deduction, flag, or Faculty threshold, THE Choice_Panel SHALL display that choice only if the requirement is met.
3. THE Choice_Panel SHALL display a Faculty tag on each choice that requires a Faculty_Check.
4. THE Choice_Panel SHALL color-code each Faculty tag based on the Investigator's proficiency: green for Faculty_Modifier of +2 or higher, amber for 0 to +1, red for -1 or lower.
5. WHEN the Investigator possesses a Clue that grants Advantage on a choice, THE Choice_Panel SHALL display an Advantage indicator icon on that choice.
6. THE Choice_Panel SHALL display text labels alongside color-coded indicators so that no information is conveyed by color alone.

### Requirement 4: Faculty Check (Dice) System

**User Story:** As a player, I want the game to resolve risky choices through d20 rolls modified by my Faculties, so that outcomes feel fair and connected to my character's strengths.

#### Acceptance Criteria

1. WHEN a player selects a choice that requires a Faculty_Check, THE Dice_Engine SHALL generate a random d20 roll (integer from 1 to 20 inclusive) and add the relevant Faculty_Modifier.
2. THE Dice_Engine SHALL compare the total result against the Difficulty_Class and determine the outcome tier: Critical Success (natural 20), Success (total meets or exceeds Difficulty_Class), Partial Success (total is within 2 below the Difficulty_Class), Failure (total is more than 2 below the Difficulty_Class), or Critical Failure (natural 1).
3. WHEN the Investigator has Advantage on a check, THE Dice_Engine SHALL roll 2d20 and use the higher result before adding the Faculty_Modifier.
4. WHEN the Investigator has Disadvantage on a check, THE Dice_Engine SHALL roll 2d20 and use the lower result before adding the Faculty_Modifier.
5. WHEN a choice specifies dynamic difficulty scaling, THE Dice_Engine SHALL adjust the Difficulty_Class based on the Investigator's Faculty_Modifier for the specified Faculty.
6. WHEN a Faculty_Check is triggered, THE Narrative_Panel SHALL display an animated d20 roll followed by the result, modifier, and outcome tier.
7. WHILE reduced motion mode is enabled, THE Narrative_Panel SHALL display the dice result directly without animation.
8. WHEN a Faculty_Check resolves, THE Narrative_Panel SHALL display an Outcome_Banner indicating the result tier for 2 seconds before fading.
9. WHEN a Faculty_Check resolves, THE Narrative_Engine SHALL navigate to the Scene_Node corresponding to the outcome tier (success, partial, failure, critical, or fumble).

### Requirement 5: Composure and Vitality Status System

**User Story:** As a player, I want to track my Investigator's mental and physical condition through visible status bars, so that I understand the stakes and consequences of my actions.

#### Acceptance Criteria

1. THE Status_Bar SHALL display Composure and Vitality as animated meter bars with values from 0 to 10.
2. WHEN Composure or Vitality decreases, THE Status_Bar SHALL animate the bar pulsing red and display a brief descriptor (e.g., "Shaken", "Bruised") for 3 seconds.
3. WHEN Composure or Vitality increases, THE Status_Bar SHALL animate the bar pulsing warm gold and display a brief descriptor (e.g., "Steadied", "Mended") for 3 seconds.
4. WHEN Composure or Vitality reaches 2 or below, THE Status_Bar SHALL shift the bar to a pulsing red state to indicate a critical threshold.
5. WHEN Composure reaches 0, THE Narrative_Engine SHALL trigger a Breakdown narrative event with forced consequences (bad decision, hallucination, or panic).
6. WHEN Vitality reaches 0, THE Narrative_Engine SHALL trigger an Incapacitation narrative event (capture, hospitalization, or rescue scene).
7. WHILE reduced motion mode is enabled, THE Status_Bar SHALL update values without pulsing animations.

### Requirement 6: Clue Discovery and Inventory

**User Story:** As a player, I want to discover and collect clues during investigation, so that I can build evidence for my deductions.

#### Acceptance Criteria

1. WHEN a Scene_Node contains discoverable clues, THE Game SHALL reveal clues based on the discovery method: exploration choices, successful Faculty_Checks, dialogue, or automatic discovery.
2. WHEN a Clue requires a specific Faculty score or prior Deduction to discover, THE Game SHALL make that Clue available only if the requirement is met.
3. WHEN a Clue is discovered, THE Narrative_Panel SHALL display a clue card that slides in from the right showing the clue type icon, title, and a one-line summary.
4. WHEN a Clue is discovered, THE Game SHALL play a chime sound distinct to the clue type.
5. WHILE reduced motion mode is enabled, THE Narrative_Panel SHALL display the clue card without slide animation.
6. WHEN a Clue is discovered, THE Game SHALL add the Clue to the Investigator's inventory with a status of "new".
7. WHEN a new Clue is added, THE Evidence_Board toggle in the header SHALL pulse to indicate new content.
8. THE Game SHALL never inform the player that a hidden Clue was missed in a scene.

### Requirement 7: Evidence Board

**User Story:** As a player, I want to use an Evidence Board to pin clues, draw connections, and form deductions, so that I can experience the cerebral heart of the investigation.

#### Acceptance Criteria

1. THE Evidence_Board SHALL open as a full-screen overlay accessible at any time during gameplay.
2. THE Evidence_Board SHALL display all collected clues as pinnable, draggable cards with type icons and status indicators.
3. THE Evidence_Board SHALL display each Clue's status visually: "new" with a pulsing amber glow and badge, "examined" with standard appearance, "connected" with a gold thread, "deduced" with a brass pin and green glow, "contested" with a slack red thread and question mark, and "spent" with a grey-out and checkmark.
4. THE Evidence_Board SHALL allow the player to drag a Connection_Thread from one Clue card to another.
5. WHEN the player drags a Connection_Thread from a Clue, THE Evidence_Board SHALL subtly brighten other clues that share at least one tag with the selected Clue.
6. WHEN two or more clues are connected and the player activates the "Attempt Deduction" button, THE Dice_Engine SHALL perform a Reason Faculty_Check.
7. WHEN a Deduction attempt succeeds, THE Evidence_Board SHALL lock the connected clues in place with a permanent Deduction indicator and the Deduction SHALL unlock new narrative branches or dialogue options.
8. WHEN a Deduction attempt fails, THE Evidence_Board SHALL display the Connection_Thread going slack as visual feedback, and the clues SHALL remain available for future attempts.
9. THE Evidence_Board SHALL display a progress summary bar showing the count of discovered clues and formed Deductions, with the total hidden (shown as "?") until the Case is complete.
10. IF a Deduction is formed from clues that include a Red Herring, THEN THE Narrative_Engine SHALL lead the player down an incorrect path with narrative consequences.

### Requirement 8: NPC System

**User Story:** As a player, I want NPCs to remember my actions and react dynamically based on our relationship, so that the world feels alive and my choices have lasting consequences.

#### Acceptance Criteria

1. THE Game SHALL track each named NPC's Disposition (integer from -10 to +10) and Suspicion (integer from 0 to 10).
2. WHEN the player makes a dialogue choice, performs a witnessed action, or completes a Case outcome that affects an NPC, THE Game SHALL adjust that NPC's Disposition and Suspicion accordingly.
3. WHEN an NPC's Suspicion is between 0 and 2, THE NPC SHALL behave normally and be open to conversation.
4. WHEN an NPC's Suspicion is between 3 and 5, THE NPC SHALL give evasive answers and require Influence Faculty_Checks to share information.
5. WHEN an NPC's Suspicion is between 6 and 8, THE NPC SHALL actively conceal information and may warn other NPCs or factions.
6. WHEN an NPC's Suspicion is between 9 and 10, THE NPC SHALL take hostile action such as setting traps, fleeing, destroying evidence, or confronting the player.
7. THE Game SHALL persist NPC Disposition, Suspicion, and memory flags across Cases.
8. WHEN an NPC is removed from the game (death or departure), THE Narrative_Engine SHALL replace that NPC's future scenes with alternative content.
9. WHEN a faction-aligned NPC's Disposition changes, THE Game SHALL apply a proportional reputation shift to the associated faction.

### Requirement 9: Encounter System

**User Story:** As a player, I want to face dangerous encounters resolved through Faculty choices over multiple rounds, so that combat and confrontations feel tense and consequential.

#### Acceptance Criteria

1. THE Narrative_Engine SHALL present encounters as 2 to 4 rounds, each offering 2 to 4 choices tied to different Faculties.
2. WHEN an encounter round resolves, THE Game SHALL apply narrative consequences and any Composure or Vitality changes based on the outcome.
3. WHEN a supernatural encounter begins, THE Game SHALL present a Reaction_Check (Nerve or Lore) before the standard choice round.
4. WHEN a Reaction_Check fails, THE Game SHALL reduce Composure by 1 to 2 points and remove or replace one choice option with a worse alternative.
5. WHEN a supernatural encounter deals damage, THE Game SHALL threaten both Composure and Vitality simultaneously.
6. WHEN the Investigator possesses relevant Occult Fragment clues during a supernatural encounter, THE Game SHALL grant Advantage or provide unique resolution options.
7. WHEN an encounter can be avoided through prior clue gathering or smart choices, THE Narrative_Engine SHALL provide a non-combat path.

### Requirement 10: Case Structure and Progression

**User Story:** As a player, I want to play through structured Cases with branching acts and persistent consequences, so that each mystery feels complete yet connected to a larger story.

#### Acceptance Criteria

1. THE Narrative_Engine SHALL structure each main Case in three acts: Act I (The Scene), Act II (The Web), and Act III (The Reckoning).
2. THE Narrative_Engine SHALL structure each Vignette in two acts (Discover and Act) with 10 to 20 Scene_Nodes.
3. WHEN the player reaches a mandatory scene, THE Narrative_Engine SHALL provide at least two Faculty-based approaches so that no single Faculty is required.
4. THE Narrative_Engine SHALL support at least two distinct investigative angles for each core mystery within a Case.
5. WHEN a Case is completed, THE Game SHALL persist flags, faction reputation changes, and NPC state changes for use in subsequent Cases.
6. WHEN a Case is completed, THE Game SHALL grant the Investigator +1 to a Faculty used in a successful critical moment.
7. WHEN persistent flags from prior Cases match a Variant_Scene's conditions, THE Narrative_Engine SHALL load the Variant_Scene in place of the base scene.
8. WHEN a player's faction reputation reaches a threshold, or an NPC's Disposition reaches 7 or higher, or an unresolved thread exists from a prior Case, THE Game SHALL unlock the corresponding Vignette.

### Requirement 11: Save and Load System

**User Story:** As a player, I want to save and load my game progress reliably, so that I can return to my investigation across sessions.

#### Acceptance Criteria

1. THE Game SHALL serialize the full game state (Investigator, current Case, current scene, clues, Deductions, NPCs, flags, faction reputation, scene history, and settings) into a versioned Save_File.
2. THE Game SHALL store Save_Files in IndexedDB as the primary storage mechanism, with localStorage as a fallback.
3. THE Game SHALL include a version number in each Save_File to support forward-compatible migrations as the data model evolves.
4. WHEN the auto-save frequency setting is "every choice", THE Game SHALL auto-save after each player choice.
5. WHEN the auto-save frequency setting is "every scene", THE Game SHALL auto-save upon entering each new Scene_Node.
6. WHEN the auto-save frequency setting is "manual", THE Game SHALL save only when the player explicitly triggers a save.
7. WHEN the player loads a Save_File, THE Game SHALL restore the complete game state and resume at the saved Scene_Node.
8. IF a Save_File has an older version number than the current schema, THEN THE Game SHALL apply migration logic to update the Save_File to the current version before loading.

### Requirement 12: Accessibility

**User Story:** As a player with accessibility needs, I want comprehensive accessibility options, so that I can enjoy the game regardless of visual, auditory, motor, or cognitive differences.

#### Acceptance Criteria

1. THE Settings_Panel SHALL provide font size controls with three presets (Standard, Large, Extra Large) plus a custom slider, affecting all narrative text, choice cards, and UI labels.
2. THE Settings_Panel SHALL provide a high contrast mode that swaps the atmospheric color palette for a high-contrast scheme (light background, dark text, bold borders) while preserving layout.
3. THE Game SHALL use secondary indicators (icons, patterns, text labels) alongside all color-coded feedback so that no information is conveyed by color alone.
4. THE Settings_Panel SHALL provide a reduced motion mode that disables fog overlays, particle effects, typewriter text animation, dice roll animation, and screen shake effects, replacing them with instant transitions.
5. THE Game SHALL provide full keyboard navigation for all interactions: choice selection via arrow keys and enter, Evidence_Board navigation via tab between clues and spacebar to connect, and menu access.
6. THE Game SHALL ensure all interactive elements meet a minimum touch target size of 44 by 44 pixels.
7. THE Game SHALL structure all narrative text and choice cards with proper ARIA labels, roles, and focus management for screen reader compatibility.
8. THE Settings_Panel SHALL provide a reading pace control to adjust typewriter effect speed or set it to "instant".
9. THE Settings_Panel SHALL provide separate volume sliders for ambient audio and sound effects.
10. THE Game SHALL provide a Case Journal that automatically updates with a summary of the current Case's key events in simple prose.
11. THE Game SHALL provide an NPC Gallery showing all encountered NPCs, their faction, and their current Disposition described in narrative terms.

### Requirement 13: Hint System

**User Story:** As a player who feels stuck, I want an opt-in hint system that provides escalating guidance, so that I can make progress without breaking immersion.

#### Acceptance Criteria

1. WHEN the player revisits the Evidence_Board 3 or more times without attempting a connection, or spends more than 5 minutes on a single scene without choosing, THE Game SHALL fade in a hint icon on the header bar.
2. WHEN the player activates the hint icon at Level 1, THE Hint_System SHALL display a narrative nudge suggesting a location or NPC to revisit.
3. WHEN the player activates the hint icon at Level 2, THE Hint_System SHALL suggest a specific connection between two named clues.
4. WHEN the player activates the hint icon at Level 3 (available only after Level 2 has been viewed), THE Hint_System SHALL reveal the connection directly.
5. THE Hint_System SHALL present hints only through deliberate player action and never display hints unbidden in the narrative.
6. WHERE the player has disabled hints in the Settings_Panel, THE Game SHALL suppress all hint triggers and hide the hint icon.

### Requirement 14: Audio System

**User Story:** As a player, I want atmospheric ambient sound and sound effects, so that the game's gothic mood is enhanced through audio.

#### Acceptance Criteria

1. WHEN a Scene_Node specifies an ambient audio track, THE Game SHALL play the ambient audio on loop while that scene is active.
2. WHEN a Faculty_Check is triggered, THE Game SHALL play a dice roll sound effect.
3. WHEN Composure decreases, THE Game SHALL play a low dissonant tone.
4. WHEN Vitality decreases, THE Game SHALL play a dull percussive impact sound.
5. WHEN a scene transition occurs, THE Game SHALL play a pen-scratch sound effect.
6. THE Game SHALL provide all audio cues with visual equivalents so that sound is never the sole carrier of information.
7. THE Settings_Panel SHALL allow the player to independently adjust ambient audio volume and sound effects volume.

### Requirement 15: Archetype Unique Abilities

**User Story:** As a player, I want my Archetype's unique ability to provide a powerful once-per-Case advantage, so that my character choice feels mechanically meaningful.

#### Acceptance Criteria

1. WHEN the Deductionist player activates the "Elementary" ability, THE Game SHALL automatically succeed on a Reason Faculty_Check to connect two clues, consuming the ability for the current Case.
2. WHEN the Occultist player activates the "Veil Sight" ability, THE Game SHALL reveal hidden supernatural elements in the current scene, consuming the ability for the current Case.
3. WHEN the Operator player activates the "Street Survivor" ability, THE Game SHALL automatically succeed on a Vigor Faculty_Check to escape a dangerous situation, consuming the ability for the current Case.
4. WHEN the Mesmerist player activates the "Silver Tongue" ability, THE Game SHALL automatically succeed on an Influence Faculty_Check during interrogation or negotiation, consuming the ability for the current Case.
5. WHEN a new Case begins, THE Game SHALL reset the Archetype ability to available.
6. WHILE the Archetype ability has been used in the current Case, THE Game SHALL visually indicate that the ability is unavailable.

### Requirement 16: Outcome Feedback System

**User Story:** As a player, I want clear visual feedback on the results of my actions, so that I understand the mechanical impact without breaking narrative immersion.

#### Acceptance Criteria

1. WHEN a Faculty_Check resolves, THE Narrative_Panel SHALL display an Outcome_Banner above the narrative text with a color and icon corresponding to the result tier: gold with a star for Critical Success, warm amber with a checkmark for Success, muted amber with a warning icon for Partial Success, dull crimson with an X for Failure, and deep red with a skull for Critical Failure.
2. THE Outcome_Banner SHALL display for 2 seconds and fade without interrupting reading flow.
3. WHEN a Clue is discovered, THE Narrative_Panel SHALL display a clue card with the type icon, title, and summary that auto-dismisses after 4 seconds or on click.
4. THE Choice_Panel SHALL display a key icon on choices that are unlocked by a Deduction or Clue, signaling that preparation opened the option.
5. WHILE reduced motion mode is enabled, THE Outcome_Banner SHALL appear and disappear with instant transitions instead of animations.

### Requirement 17: JSON Content Loading and Validation

**User Story:** As a developer, I want the game to load and validate case content from structured JSON files, so that content can be authored and maintained independently of the game code.

#### Acceptance Criteria

1. THE Narrative_Engine SHALL load Case content from JSON files organized as: meta.json, act1.json, act2.json, act3.json, clues.json, npcs.json, and variants.json per Case directory.
2. THE Narrative_Engine SHALL load Vignette content from JSON files organized as: meta.json, scenes.json, clues.json, and npcs.json per Vignette directory.
3. WHEN a JSON content file is loaded, THE Narrative_Engine SHALL validate that all scene transitions reference existing Scene_Node IDs (no broken graph edges).
4. WHEN a JSON content file is loaded, THE Narrative_Engine SHALL validate that all clue references in choices and conditions correspond to defined Clue IDs.
5. IF a JSON content file fails validation, THEN THE Game SHALL log a descriptive error identifying the invalid reference.

### Requirement 18: Title Screen and Game Flow

**User Story:** As a player, I want a title screen where I can start a new game, load a saved game, or adjust settings, so that I have a clear entry point into the experience.

#### Acceptance Criteria

1. THE Game SHALL display a Title Screen on launch with options to start a new game, load a saved game, and access the Settings_Panel.
2. WHEN the player selects "New Game", THE Game SHALL navigate to the Character Creation screen.
3. WHEN the player selects "Load Game", THE Game SHALL display a list of available Save_Files with timestamps and resume the selected save.
4. WHEN the player selects "Settings", THE Game SHALL open the Settings_Panel.
5. THE Title Screen SHALL set the atmospheric tone with the game's visual style (color palette, typography) and ambient audio.

### Requirement 19: Faction Reputation System

**User Story:** As a player, I want my actions to affect my standing with the four factions, so that faction relationships open and close story paths across Cases.

#### Acceptance Criteria

1. THE Game SHALL track the Investigator's reputation with each faction (Rationalists' Circle, Hermetic Order of the Grey Dawn, Lamplighters, Court of Smoke) as an integer value.
2. WHEN the player makes choices that benefit or harm a faction's interests, THE Game SHALL adjust the corresponding faction reputation.
3. WHEN the player helps a faction's rival, THE Game SHALL decrease the reputation with the opposing faction.
4. THE Game SHALL persist faction reputation values across Cases.
5. WHEN faction reputation reaches defined thresholds, THE Game SHALL unlock faction-specific Vignettes and exclusive content.
