# Project Description

> Inferred from code behavior, not documentation claims.

## What the System Actually Does

Gaslight & Grimoire is a single-player, browser-based interactive fiction game. The player creates a character with one of four archetypes, allocates stat points across six faculties, then plays through a branching mystery case set in Victorian London. Gameplay consists of:

1. Reading narrative text scenes (with optional typewriter animation).
2. Choosing from context-sensitive options — some gated by clues, deductions, flags, or faculty thresholds.
3. Rolling a virtual d20 for faculty checks on skill-gated choices, with outcomes ranging from critical success to fumble.
4. Collecting clues that are discovered automatically on scene entry or gated by faculty scores.
5. Connecting clues on a visual evidence board and attempting Reason checks to form deductions.
6. Managing two health tracks (Composure and Vitality) that deplete from story events and failed checks.
7. Interacting with NPCs whose disposition and suspicion shift based on player choices, with faction reputation propagating automatically.

The game auto-saves on scene transitions. Progress persists in the browser's localStorage. There is no server, no account system, and no network dependency after initial page load.

## What It Does Not Do (Despite Code Suggesting Otherwise)

- **Encounters**: A full encounter engine exists (reaction checks, multi-round combat, dual-axis damage, escape paths) but no UI renders it. Players cannot experience encounters.
- **Load game**: The load screen exists and save files can be selected, but loading doesn't restore the case content data, so the game screen is blank after load.
- **Hint system**: The hint engine tracks board visits and scene dwell time, but no component ever reports these events. Hints appear only via a broken dwell timer.
- **Audio**: 9 SFX events and an ambient audio system are fully coded, but no audio files exist. The game is silent.
- **Case completion**: The engine grants faculty bonuses and checks vignette unlocks at case end, but no UI shows these results.
- **Manual save**: The save function exists but no button triggers it.

## Current Use Cases

### Primary: Play a mystery case
The player creates a character, plays through "The Whitechapel Cipher" (3 acts), makes choices, gathers clues, forms deductions, and reaches a conclusion. This is the only complete end-to-end flow.

### Secondary: Configure accessibility
The player adjusts font size, contrast, motion, text speed, and audio volume via the Settings panel. These persist across sessions (as part of save state).

### Tertiary: Resume from autosave
The game auto-saves. The player can close the browser and return later. However, loading a save is currently broken (see above).

## User Types Implied by Code

### Player
The sole user type. No admin, no content editor, no multiplayer. The code assumes a single human interacting with a browser. All state is local. There is no concept of user identity.

### Content Author (implicit)
The JSON content structure, the `validateCase.mjs` script, and the `Condition`/`Effect` type system imply a content author who writes case JSON by hand. This person is not a user of the running application — they interact with the content pipeline offline.

## Actual Problems Being Solved

1. **Branching narrative with mechanical depth**: The game combines choose-your-own-adventure storytelling with tabletop RPG dice mechanics, giving choices both narrative and statistical weight.

2. **Knowledge-as-power gameplay**: Clues grant mechanical Advantage on dice rolls. Deductions unlock new choices. The evidence board turns passive reading into active puzzle-solving.

3. **Accessible interactive fiction**: The accessibility implementation (font scaling, high contrast, reduced motion, screen reader support with 146 ARIA attributes across 32 files, 44px touch targets) suggests the game is designed to be playable by users with visual, motor, or cognitive accessibility needs.

4. **Zero-infrastructure deployment**: Static files on GitHub Pages. No server, no database, no ops. The entire game runs in the browser with localStorage persistence.

5. **Content-driven extensibility**: The strict content/engine separation and the `Condition`/`Effect` contract mean new cases can be added as JSON without touching TypeScript. The engine is case-agnostic.
