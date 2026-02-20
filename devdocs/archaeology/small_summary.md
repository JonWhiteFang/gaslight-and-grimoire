# Archaeology — Non-technical Summary

> Generated from code reading on 2026-02-20. Code is the source of truth.

## What Is This?

A browser-based choose-your-own-adventure game set in Victorian London. The player is a private investigator solving branching mystery cases that blend Sherlock Holmes-style deduction with tabletop RPG dice mechanics. It runs entirely in the browser (React SPA on GitHub Pages) with no backend — all state lives in localStorage.

There is one deliverable: the web app. No separate modules, services, or backends.

## What the User Experiences

### Screen Flow

1. **Title Screen** — "New Investigation", "Continue Investigation" (if saves exist), "Settings".
2. **Character Creation** — Name your investigator, pick one of four archetypes (Deductionist, Occultist, Operator, Mesmerist), then distribute 12 bonus points across six "faculties" (Reason, Perception, Nerve, Vigor, Influence, Lore). Each archetype gives +3/+1 to specific faculties and a once-per-case special ability.
3. **Game Screen** — The main play area. A narrative text panel shows the current scene (with optional illustration and typewriter text effect). Below it, choice cards appear. A header bar gives access to overlays. A status bar at the bottom shows Composure and Vitality meters.
4. **Overlays** (accessible anytime during play):
   - **Evidence Board** — A corkboard where collected clues appear as cards. The player connects clues with threads and attempts deductions. Tag-based brightening highlights related clues.
   - **Case Journal** — Running log of discovered clues, deductions made, and key story events.
   - **NPC Gallery** — List of encountered characters with narrative-friendly disposition labels ("Warm", "Hostile") and suspicion tiers.
   - **Settings** — Font size, high contrast, reduced motion, text speed, hints toggle, auto-save frequency, audio volume.
5. **Load Game Screen** — Lists all saves (manual + autosave) with delete buttons.

### Core Loop

```
CREATE CHARACTER → LOAD CASE → READ SCENE → MAKE CHOICES → DISCOVER CLUES → CONNECT CLUES → FORM DEDUCTIONS → PROGRESS THROUGH ACTS → COMPLETE CASE
```

In more detail:

1. **Explore scenes** — Each scene is a narrative text block with choices. Some choices are gated behind clues, deductions, flags, or faculty thresholds.
2. **Face faculty checks** — Choices tagged with a faculty and difficulty trigger a d20 roll + modifier. Outcomes range across five tiers: critical, success, partial, failure, fumble. Holding relevant clues grants Advantage (roll 2d20, take highest).
3. **Discover clues** — Clues are found automatically on scene entry, through exploration, dialogue, or faculty checks. Each clue has a type (physical, testimony, occult, deduction, red herring) and plays a type-specific sound effect.
4. **Use the Evidence Board** — Connect clues with threads, then attempt a deduction. Success locks the clues and creates a Deduction that can unlock new scenes or dialogue. Failure animates the threads going slack.
5. **Manage NPC relationships** — Choices can shift NPC disposition (−10 to +10) and suspicion (0–10). Faction-aligned NPCs propagate disposition changes to faction reputation at 50%.
6. **Survive encounters** — Supernatural encounters trigger a Nerve/Lore reaction check. Failure costs Composure and replaces choices with worse alternatives. Encounters deal dual-axis damage (Composure + Vitality) for supernatural threats, single-axis for mundane.
7. **Complete the case** — End-of-case grants +1 to the faculty used in the player's last critical success. Vignette side-cases unlock based on faction reputation, NPC disposition, or story flags.

### Persistence

- Auto-save on every scene transition (configurable to per-choice or manual-only).
- Up to 10 manual save slots + 1 autosave slot.
- Save files are versioned with a migration pipeline (currently v0→v1: adds factionReputation).

## What Appears Complete

The engine layer and UI shell are fully built and tested:

- **Dice engine** — d20 rolls, advantage/disadvantage, modifier calculation, five-tier outcome resolution, dynamic difficulty scaling. Property-tested.
- **Narrative engine** — JSON content loading, condition evaluation (8 condition types, AND logic), scene resolution with variant support, onEnter effect application (7 effect types), choice processing with faculty checks, encounter system (reaction checks, dual-axis damage, escape paths, occult advantage). Property-tested.
- **Save system** — localStorage with versioned migrations, save/load/delete/list, autosave. Property-tested.
- **Hint engine** — 3-level escalation (narrative nudge → clue suggestion → direct reveal), triggered by board visit patterns or scene dwell time. Respects settings toggle. Unit-tested.
- **Case progression** — Faculty bonus grants, vignette unlock checks (faction rep, NPC disposition, flags). Unit-tested.
- **Audio manager** — Howler.js with lazy-cached Howl instances for 9 SFX events.
- **All 6 store slices** — Investigator, narrative, evidence, NPC, world, meta. Immer-powered, with selector hooks and action hooks. Property-tested for slice isolation.
- **All UI components** — Title screen, load game, character creation (archetype select + faculty allocation), narrative panel (scene text, illustration, dice overlay, outcome banner, clue discovery card), choice panel (condition filtering), evidence board (clue cards, connection threads, deduction button, progress summary), status bar (composure + vitality meters), header bar (ability button, hint button), case journal, NPC gallery, settings panel, accessibility provider, ambient audio, error boundary.
- **Content validation** — `scripts/validateCase.mjs` checks for broken scene-graph edges and missing clue references.
- **CI/CD** — GitHub Actions for deploy (build + GitHub Pages) and security (npm audit + OWASP dependency check).
- **9 component test files, 8 engine test files** including property-based tests.

## What Appears Actively Evolving

- **Content is thin** — Only 1 main case ("The Whitechapel Cipher", 3 acts) and 1 side case ("A Matter of Shadows"). The engine supports arbitrary cases but the content pipeline has only produced two.
- **ClueDiscoveryCard** — Comment in NarrativePanel says "stub, fully implemented in Task 10". The component exists but may not be feature-complete.
- **No case selection UI** — `loadAndStartCase` is hardcoded to `'the-whitechapel-cipher'` in App.tsx. There's no screen to browse/select available cases.
- **No case completion screen** — `completeCase` exists in the store and engine but no UI renders the results (faculty bonus granted, vignette unlocked).
- **Encounter UI** — The encounter engine is fully implemented (startEncounter, processEncounterChoice, getEncounterChoices) but encounters flow through the generic choice/narrative panels rather than a dedicated encounter UI.
- **Ambient audio** — The `AmbientAudio` component exists and reads `scene.ambientAudio`, but no audio asset files are present in the repo (the `/audio/sfx/` paths are referenced but the files aren't committed).
- **Determinism concerns** — `buildDeduction` uses `Date.now()` and `Math.random()` directly for ID generation. `rollD20()` uses `Math.random()` with no seeding/DI. `hintEngine` uses `Date.now()` for scene dwell tracking. These are functional but not reproducible.
