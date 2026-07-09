# Status

Current state of Gaslight & Grimoire as of 2026-07-07. This is a factual
snapshot of what exists — not a roadmap. For architectural and API detail it
links to the sibling docs rather than repeating them.

## What this is

A browser-based choose-your-own-adventure game set in a Victorian London where
magic exists beneath the rational world: an occult mystery that blends Sherlock
Holmes-style deduction with D&D-style faculty checks and d20 dice mechanics. For
the design intent and vision, see [Gaslight_&_Grimoire_design.md](./Gaslight_&_Grimoire_design.md).

## Content inventory

Scene and clue counts are from `node scripts/validateCase.mjs`; NPC counts are
from each case's `npcs.json`.

| Case | Type | Scenes | Clues | NPCs |
|---|---|---|---|---|
| The Whitechapel Cipher | main (3-act) | 67 | 14 | 7 |
| The Mayfair Séance | main (3-act) | 50 | 13 | 7 |
| The Lamplighter's Wake | main (3-act) | 44 | 13 | 7 |
| A Matter of Shadows | vignette (2-act) | 13 | 5 | 3 |
| The Rationalist's Dilemma | vignette (2-act) | 10 | 5 | 2 |
| The Debt of Smoke | vignette (2-act) | 9 | 4 | 2 |
| The Unfinished Case | vignette (2-act) | 8 | 4 | 2 |
| **Total** | **7 cases** | **201** | **58** | **30** |

All four factions appear in the content: Rationalists Circle, Hermetic Order of
the Grey Dawn, Lamplighters, and Court of Smoke. Archetype-exclusive scenes
exist across the three main cases — content carries `archetypeIs` conditions
gating scenes to each of the four archetypes (deductionist, occultist, operator,
mesmerist).

See [content-authoring.md](./content-authoring.md) for the JSON schema and the
`Condition`/`Effect` mechanics that drive gating and state mutation.

## Systems present

Each item below corresponds to implemented code. See
[engine-reference.md](./engine-reference.md) and
[architecture.md](./architecture.md) for detail.

- **Character creation with four archetypes** — deductionist, occultist,
  operator, mesmerist, each with +3/+1 faculty bonuses and a once-per-case
  ability (Elementary, Veil Sight, Street Survivor, Silver Tongue).
- **d20 faculty-check engine** — modifier from faculty score plus a trained
  bonus (+1 when the check faculty matches the archetype's primary faculty),
  advantage/disadvantage, dynamic difficulty, and five outcome tiers
  (critical / success / partial / failure / fumble).
- **Four clue-discovery methods** — `automatic` and `dialogue` on scene entry,
  `exploration` via clickable atmospheric prompts, `check` via a dice roll.
- **Evidence board** — persistent clue connections (stored as ID pairs in the
  evidence slice) and deductions derived from connected clue IDs.
- **NPC interaction** — disposition, suspicion, and memory-flag gated dialogue
  choices; suspicion tiers escalate NPC behaviour.
- **Faction reputation** — bounded to [-10, +10], with disposition changes on
  faction-aligned NPCs propagating to faction reputation.
- **Encounters** — mundane (single-axis) and supernatural (dual-axis composure
  + vitality) multi-round encounters with escape paths.
- **Recovery / halt** — shared `breakdown` (composure 0) and `incapacitation`
  (vitality 0) scenes injected into every case, with case-specific variants.
  Reaching either renders a distinct "Investigation halted" screen (not the
  "Case Complete" terminal); starting a new case restores composure/vitality to
  full and clears the halt flags, so a knockout cannot brick later cases.
- **Hint engine** — a stateful three-level escalation (narrative nudge →
  specific clue → direct reveal).
- **Save/load** — localStorage persistence with multi-save support and
  versioned migrations.
- **Accessibility** — reduced motion, font-size scaling, and a real
  high-contrast theme (`AccessibilityProvider` toggles the `.high-contrast`
  class; `index.css` overrides surface/text/accent/border colours under it).
  Overlays (Evidence Board, Case Journal, NPC Gallery) share a `useFocusTrap`
  hook (initial focus + Tab trap + focus restore), and the game background is
  `inert` while an overlay is open.
- **Consequence feedback** — inline atmospheric messages annotating `onEnter`
  effects (e.g. "A chill settles over you (Composure −1)").

## Assets

The game runs **text-only, with SFX present and ambient audio pending**. The
media systems are fully implemented; the 9 SFX files now ship, ambient loops and
illustrations do not yet.

- **Audio** — `AudioManager` (lazy-cached Howler instances) and `AmbientAudio`
  are fully implemented. Nine SFX event types are defined (`dice-roll`,
  `clue-physical`, `clue-testimony`, `clue-occult`, `clue-deduction`,
  `clue-redHerring`, `composure-decrease`, `vitality-decrease`,
  `scene-transition`). **The 9 SFX `.mp3` files now ship** under
  `public/audio/sfx/` (AI-generated per [audio-asset-kit.md](../audio-asset-kit.md),
  loudness-normalized to ~-14 LUFS). SFX urls are base-path-aware
  (`buildSfxSrc` prefixes `import.meta.env.BASE_URL`). The **10 ambient loops**
  referenced via `SceneNode.ambientAudio` do **not** exist yet — Howler silently
  absorbs the missing-file errors, so ambient is quiet. The intended file list is
  in [content-authoring.md](./content-authoring.md#audio-asset-reference).
- **Illustrations** — `SceneIllustration` renders an image from
  `scene.illustration`, but no image files exist under `public/`.
- **NPC portraits** — the `NPCGallery` `Portrait` component renders a
  letter-initial placeholder (the first character of the NPC's name), not an
  image.

Under `public/` there are now 9 SFX `*.mp3` files (`public/audio/sfx/`); no
ambient `*.mp3`, and no `*.png`/`*.jpg`/`*.webp` illustrations yet.

## Test baseline

As of 2026-07-08, running `npm run test:run`:

- **Tests: 554 passed (554)**
- **Test Files: 56 passed (56)**

The suite includes property-based tests using fast-check (six
`*.property.test.ts` files covering the dice engine, narrative engine, deduction
formation, NPC bounds, save manager, and slice isolation). Content is validated
by `node scripts/validateCase.mjs`, which delegates to the shared
`src/engine/contentValidation.ts` module (the same one the runtime
`validateContent` uses) — checking scene-graph edges, clue references, condition
targets, variant structure, `npcEffect` refs, encounter-round edges, and (CLI
only) reachability across all seven cases.
