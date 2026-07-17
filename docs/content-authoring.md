# Content Authoring

How to author case and vignette content for Gaslight & Grimoire. All narrative
lives as JSON under `public/content/` and is fetched at runtime — no code
changes are needed to add or edit a case.

Every schema claim below is drawn from `src/types/index.ts` (the single source of
truth for content types), the validator `scripts/validateCase.mjs`, and the
loaders in `src/engine/narrativeEngine.ts`. See
[architecture.md](./architecture.md) for the content→engine load flow and
[engine-reference.md](./engine-reference.md) for how conditions, effects, and
clue discovery are evaluated.

## Content layout

`public/content/` is served at the site root by Vite, so the engine fetches
these files at runtime as `/content/...` (base-path prefixed for the
`/gaslight-and-grimoire/` Worker route — see architecture.md's data-flow section).

```
public/content/
  manifest.json                       # { cases: CaseManifestEntry[] } — the case/vignette catalog
  shared/
    breakdown.json                    # a single SceneNode (composure hits 0)
    incapacitation.json               # a single SceneNode (vitality hits 0)
  cases/[case-id]/                    # main case, 3-act structure
    meta.json                         # CaseMeta object
    act1.json, act2.json, act3.json   # { scenes: SceneNode[] } each
    clues.json                        # { clues: Clue[] }
    npcs.json                         # { npcs: NPCState[] }
    variants.json                     # { variants: SceneNode[] }
    deductions.json                   # { deductions: KeyDeduction[] } — optional; key-deduction recipes
  side-cases/[vignette-id]/           # vignette, single scenes file (no acts split)
    meta.json                         # VignetteMeta object
    scenes.json                       # { scenes: SceneNode[] }
    clues.json                        # { clues: Clue[] }
    npcs.json                         # { npcs: NPCState[] }
```

**File shapes — read carefully.** Every array-bearing content file is a JSON
**object that wraps a named array**, never a bare `[...]` array:

| File | Top-level shape |
|---|---|
| `manifest.json` | `{ "cases": [ ... ] }` |
| `act1/2/3.json`, vignette `scenes.json` | `{ "scenes": [ ... ] }` |
| `clues.json` | `{ "clues": [ ... ] }` |
| `npcs.json` | `{ "npcs": [ ... ] }` |
| `variants.json` | `{ "variants": [ ... ] }` |
| `deductions.json` (optional) | `{ "deductions": [ ... ] }` |
| `meta.json` | a `CaseMeta` / `VignetteMeta` object |
| `shared/breakdown.json`, `shared/incapacitation.json` | a single `SceneNode` object |

`loadCase` reads `act1.scenes` / `clues.clues` / `npcs.npcs` / `variants.variants`;
`loadVignette` reads `scenes.scenes` etc. The three act files are concatenated
into one scene set, and the shared `breakdown` + `incapacitation` scenes are
injected into every case and vignette (their ids are `breakdown` and
`incapacitation`, both `act: 0`).

### meta and manifest fields

`CaseMeta` — `id`, `title`, `synopsis`, `acts` (number), `facultyDistribution`
(`Partial<Record<Faculty, number>>`), optional `firstScene` (scene id to start
at; if absent the engine falls back to the first scene key).

`VignetteMeta` — `id`, `title`, `synopsis`, optional `triggerCondition`
(a single `Condition`), optional `firstScene`.

`CaseManifestEntry` (each item in `manifest.json`) — `id`, `title`, `synopsis`,
`type` (`'case' | 'vignette'`), optional `triggerCondition`. A vignette only
appears in Case Selection once its unlock condition is met (unlock logic is in
`caseProgression.ts`; see engine-reference.md).

## Condition catalog

A `Condition` gates scene variants and choice availability. Shape:
`{ type, target, value? }` where `value` is `number | boolean | string |
NpcSuspicionTier`. A `Condition[]` is evaluated with **AND** semantics — every
condition must pass; an empty array is always `true` (`evaluateConditions`).

| `type` | Meaning | `target` | `value` |
|---|---|---|---|
| `hasClue` | Clue is discovered (revealed) | clue id | — |
| `hasDeduction` | Key deduction has been made | key-deduction recipe id (see Key deductions below) | — |
| `hasFlag` | World flag is set | flag key | omitted → `=== true`; else exact match |
| `facultyMin` | Faculty score ≥ threshold | faculty name | minimum score (number) |
| `archetypeIs` | Investigator is this archetype | — | archetype id (e.g. `"occultist"`) |
| `npcDisposition` | NPC disposition ≥ value | npc id | minimum (number) |
| `npcSuspicion` | NPC suspicion in tier's range | npc id | tier: `normal` 0–2, `evasive` 3–5, `concealing` 6–8, `hostile` 9–10 |
| `factionReputation` | Faction reputation ≥ value | faction name | minimum (number) |
| `npcMemoryFlag` | NPC memory flag is set | npc id | memory-flag key (string) |

Per-condition evaluation detail is in engine-reference.md (`evaluateConditions`).

## Effect catalog

An `Effect` mutates game state on scene entry (`SceneNode.onEnter`). Shape:
`{ type, target?, delta?, value?, description? }`. Effects are applied by the
`worldSlice.applyEffects` store action, which dispatches each effect to the
appropriate slice; numeric state is clamped by the slice (see architecture.md's
bounded-state table).

| `type` | Meaning | Fields used |
|---|---|---|
| `composure` | Adjust composure (0–10) | `delta` |
| `vitality` | Adjust vitality (0–10) | `delta` |
| `flag` | Set a world flag | `target` (key), `value` (`boolean \| string`) |
| `disposition` | Adjust NPC disposition (−10..10)* | `target` (npc id), `delta` |
| `suspicion` | Adjust NPC suspicion (0–10) | `target` (npc id), `delta` |
| `reputation` | Adjust faction reputation (−10..10) | `target` (faction), `delta` |
| `discoverClue` | Reveal a clue | `target` (clue id) |
| `setMemoryFlag` | Set an NPC memory flag to `true` | `target` (npc id), `value` (flag key) |

\* Adjusting a faction-aligned NPC's disposition also propagates `delta * 0.5`
into that NPC's faction reputation (a hidden cross-slice coupling — see
architecture.md).

**`description` (optional).** Authored feedback text shown when the effect
fires. When present it is used verbatim and the mechanical annotation is still
appended (e.g. `"A chill settles over you (Composure −1)"`). When omitted, an
atmospheric fallback is generated per effect type. `flag`, `discoverClue`, and
`setMemoryFlag` produce no feedback line (they surface their own UI). Full rules:
`generateEffectMessage` in engine-reference.md.

## SceneNode & Choice

### SceneNode

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique within the case; referenced by choice outcomes |
| `act` | number | 1–3 for main cases (`0` for the shared scenes) |
| `narrative` | string | The scene body text (**the field is `narrative`, not `text`**) |
| `cluesAvailable` | `ClueDiscovery[]` | Clues discoverable in this scene (see below) |
| `choices` | `Choice[]` | Player choices; may be empty for terminal/encounter scenes |
| `illustration` | string? | Illustration asset key (no image assets ship yet) |
| `ambientAudio` | string? | Ambient loop key (e.g. `"ambient-whitechapel-night"`) |
| `onEnter` | `Effect[]?` | Effects applied on entry |
| `conditions` | `Condition[]?` | Declared on the type; runtime gating is driven by choice edges and variant resolution rather than a scene-level check |
| `archetypeExclusive` | `Archetype?` | Declared on the type; no runtime consumer at present |
| `variantOf` | string? | (Variants only) base scene id this variant replaces |
| `variantCondition` | `Condition?` | (Variants only) condition under which the variant is shown |
| `encounter` | `{ rounds: EncounterRound[]; isSupernatural: boolean }?` | Turns the scene into a multi-round encounter (rendered by `EncounterPanel`) |

**Variants.** A scene in `variants.json` sets `variantOf` (the base scene id) and
`variantCondition`. At runtime `resolveScene` returns the first variant whose
`variantOf` matches and whose `variantCondition` passes, else the base scene.
Variants are not graph nodes — they resolve in place, so they must not be reached
via choice outcome edges.

### Choice

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique within the scene |
| `text` | string | Choice label |
| `outcomes` | `Record<OutcomeTier, string>` | Next-scene id per tier: `critical`, `success`, `partial`, `failure`, `fumble` |
| `faculty` | `Faculty?` | If set (with `difficulty`), the choice is a dice check |
| `difficulty` | number? | DC for the faculty check |
| `dynamicDifficulty` | `{ baseDC, scaleFaculty, highThreshold, highDC }?` | Scales DC by a faculty score (`resolveDC`) |
| `advantageIf` | `string[]?` | Clue ids that grant advantage when revealed |
| `requiresClue` | string? | Gate: choice visible only if this clue is discovered |
| `requiresDeduction` | string? | Gate: requires this deduction |
| `requiresFlag` | string? | Gate: requires this world flag |
| `requiresFaculty` | `{ faculty, minimum }?` | Gate: requires a faculty score |
| `visibility` | `'shown' \| 'hidden' \| 'disabled'?` | What an **unmet** gate does to the choice: `hidden` (default) removes it, `disabled` shows it locked with `gateReason`, `shown` leaves it selectable (soft gate). See "Choice visibility" below |
| `gateReason` | string? | Diegetic explanation rendered on a locked choice. Required iff `visibility: "disabled"` |
| `npcEffect` | `{ npcId, dispositionDelta, suspicionDelta }?` | Applied when the choice is taken |
| `worseAlternative` | `Choice?` | (Encounters) replaces this choice on a failed reaction check |
| `isEscapePath` | boolean? | (Encounters) the non-combat escape option; always offered when its gates pass. May **not** set `visibility: "disabled"` or `"shown"`, or a `gateReason` (an explicit `"hidden"` is an allowed no-op) |
| `encounterDamage` | `{ composureDelta?, vitalityDelta? }?` | (Encounters) damage on failure/fumble |

**Choice gating.** Gating is driven by the four `requiresClue` /
`requiresDeduction` / `requiresFlag` / `requiresFaculty` fields, which the engine
maps to `hasClue` / `hasDeduction` / `hasFlag` / `facultyMin` conditions
(`choiceGateConditions`) and runs through `evaluateConditions`
(`resolveChoiceVisibility` in `src/engine/choiceVisibility.ts` — the single
resolver both `ChoicePanel` and encounters consume). Use these fields to gate a
choice — a bare `conditions` array on a `Choice` is **not** part of the `Choice`
type and is not evaluated at runtime. For an archetype-only choice, prefer
authoring an `archetypeExclusive` scene branch or gating on a flag set for that
archetype. What an *unmet* gate does to the choice — hide it, or show it locked —
is controlled by the `visibility` field, next.

### Choice visibility — hide vs. disable-with-reason

`visibility` governs **only the unmet-gate case**. An ungated choice, or a gated
choice whose gate is met, always renders as a normal selectable choice
regardless of `visibility`. When the gate is unmet:

| `visibility` | Unmet-gate behaviour |
|---|---|
| *(absent)* or `hidden` | The choice is removed from the panel — the player never sees it. **This is the default.** |
| `disabled` | The choice renders in a separate "Locked choices" list below the interactive choices: non-interactive, struck-through, lock icon, with the `gateReason` prose beneath it. |
| `shown` | The choice stays fully selectable despite the unmet gate (**soft gate** — rare escape hatch; always triggers a validator warning). |

**When to hide (the default).** Hide when the option's very existence would
spoil a twist ("Confront the butler about the poison" before the poison is
known) or would confuse a player who lacks the context to parse it. Most gates
should stay hidden — that was the only behaviour before Phase 5 and remains the
correct one for reveal-driven content.

**When to disable-with-reason.** Disable when a visible-but-locked option builds
tension or teaches the player a pursuable prerequisite — the lock itself is the
information. The shipped exemplar is The Comet Club's `cc-act2-hub` choice
`cc-choice-hub-halloway` ("Present yourself at Lady Halloway's drawing room.",
`requiresFlag: "cc-halloway-trusts"`): the player sees the drawing room exists
and learns that Lady Halloway's trust is the key, without being told which flag
to flip.

**`gateReason` — required, and diegetic.** A `disabled` choice **must** carry a
non-empty `gateReason` (validator error otherwise). Tone: measured, in-world,
hinting at what would unlock the choice without naming ids or mechanics —
**never** mechanical ("Requires: Occult 12" is forbidden register). The demo's
prose is the register to match:

> Her drawing room does not open to callers she has not chosen — and she has
> not chosen you. Not yet.

**Author the choice text gate-neutral.** A `disabled` choice's label renders
struck-through while locked and as a normal button once unlocked, so the same
text must read sensibly in **both** states. "Lady Halloway will receive you
now." argues with its own lock (it asserts the thing the lock denies); it was
reworded to "Present yourself at Lady Halloway's drawing room.", which reads as
an intention whether or not the door is open.

**The `shown` soft gate.** `visibility: "shown"` on a gated choice deliberately
defeats the gate — the choice stays selectable. It exists as a rare escape hatch
(e.g. an option that should tempt the player regardless) and always emits a
non-fatal validator warning so it can't happen by accident.

**Escape paths are exempt — and forbidden.** Encounter escape-path choices
(`isEscapePath`) stay hard-gated: offered only when their gate is met, never
disabled. Setting `visibility: "disabled"` or `"shown"`, or a `gateReason`, on
an escape path is a validator **error** (an explicit `"hidden"` is an allowed
no-op — it is the hard-gate behaviour the escape path already has).

**Validator rules (what fails CI).** `node scripts/validateCase.mjs` enforces,
per choice:

- **Error** — `visibility: "disabled"` without a non-empty `gateReason`.
- **Error** — `gateReason` present but `visibility` is not `disabled` (the
  reason would never render).
- **Error** — `visibility: "disabled"` or `"shown"` on a choice with **no**
  `requires*` gate (nothing to act on; an explicit `"hidden"` on an ungated
  choice is an allowed no-op).
- **Error** — a `visibility` value outside `shown | hidden | disabled`.
- **Error** — an `isEscapePath` choice setting `visibility: "disabled"` or
  `"shown"`, or a `gateReason` (an explicit `"hidden"` is an allowed no-op).
- **Warning** (non-fatal, always-on) — `visibility: "shown"` on a gated choice
  (the soft gate above).

**Outcome tiers.** For a faculty-check choice (`faculty` + `difficulty` set) the
validator requires **all five** outcome tiers to be present. Non-check choices
typically define `success` (used as the sole outcome). Tier resolution
(critical/fumble on nat 20/1, partial band, advantage) is in engine-reference.md.

**Encounters.** When `SceneNode.encounter` is set, `GameContent` renders
`EncounterPanel` and the scene runs round-by-round (`startEncounter`,
`processEncounterChoice`, `getEncounterChoices` — see engine-reference.md).
Supernatural encounters open with a Nerve/Lore reaction check at DC 12; failure
costs composure and swaps in `worseAlternative` choices. Damage is dual-axis
(composure + vitality) for supernatural encounters, single-axis for mundane.

## Clue & ClueDiscovery

### Clue (`clues.json`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Referenced by discoveries, choices, deductions. **Must match `^[a-z0-9-]+$`** (validator-enforced, Phase 2b — the generic-deduction id joins clue ids with `+`, so no id may contain `+`) |
| `type` | `ClueType` | `physical`, `testimony`, `occult`, `deduction`, `redHerring` |
| `title` | string | Display name |
| `description` | string | Clue detail text |
| `sceneSource` | string | Scene id where the clue originates |
| `tags` | `string[]` | Free-form tags |
| `status` | `ClueStatus` | `new`, `examined`, `deduced`, `contested`, `spent` — author starting clues as `new`. (`connected` is deprecated / never written after Phase 2b: the board-connection cue is derived from `connections` membership at render, not a status.) |
| `isRevealed` | boolean | Author as `false`; set `true` at runtime on discovery |
| `connectsTo` | `string[]?` | Clue ids this can be connected to on the evidence board |
| `grantsFaculty` | `Faculty?` | Optional faculty association |

### ClueDiscovery (`SceneNode.cluesAvailable`)

Declares how a clue becomes discoverable in a scene: `{ clueId, method,
requiresFaculty?, requiresDeduction? }`.

| `method` | Behavior |
|---|---|
| `automatic` | Discovered on scene entry |
| `dialogue` | Discovered on scene entry, shown as a dialogue/testimony reveal |
| `exploration` | Rendered as an atmospheric clickable prompt the player selects |
| `check` | Requires a dice roll; usually paired with `requiresFaculty: { faculty, minimum }` |

`requiresFaculty` (`{ faculty, minimum }`) and `requiresDeduction` gate whether a
discovery is available (`canDiscoverClue`). Prompt text for `exploration` /
`check` discoveries is generated by `getCluePromptText`. See engine-reference.md
for both.

## Key deductions (`deductions.json`)

A **key deduction** is an authored "recipe" that gives a specific conclusion a
stable, gate-able identity. When the player connects clues on the evidence board
and attempts a deduction, the pure **correctness oracle**
(`deductionOracle.classifyBoard`) classifies each connected component and forms
**every** recipe whose `requiredClues` are all in that component (**subset**
semantics against the *player's* connection topology, not `connectsTo`); each
match's `Deduction` is stored under the recipe's **authored `id`** so a
`hasDeduction` / `requiresDeduction` gate can reference it. **Correctness — not
the Reason roll — gates formation (ADR-0012):** a qualifying set forms even on a
`failure` roll; a non-qualifying set forms nothing even on a `critical`. The roll
only flavours the outcome banner's copy. A component that matches no recipe takes
the **generic path** (the only path for vignettes, which ship no `deductions.json`):
it forms one deduction under a **canonical stable id** `deduction-generic-<sorted
clue ids joined by +>` (idempotent — re-forming the same set never inflates the
Journal) when **all** its player-edges are authored `connectsTo` links.

`deductions.json` (main cases; optional — vignettes omit it) has shape
`{ "deductions": KeyDeduction[] }`:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable id a `requiresDeduction`/`hasDeduction` gate targets |
| `requiredClues` | `string[]` | Clue ids that must **all** be connected for the recipe to match (subset — extras allowed) |
| `title` | string | Display name of the conclusion |
| `description` | string | Narrative statement of the deduction |
| `isRedHerring` | boolean | `false` for a sound conclusion |

Authoring rules:
- Every `requiredClues` id must exist in the case's `clues.json`, and every
  `requiresDeduction`/`hasDeduction` target must be a defined recipe id — both are
  **validator-enforced** (a gate pointing at an undefined recipe is an error).
- **A recipe `id` must not begin with `deduction-generic-`** — that prefix is the
  machine-owned namespace for generic deductions; the validator errors on any
  authored recipe id that intrudes on it (Phase 2b, Major 4).
- Recipes should mix clue **types** and exclude `redHerring` clues; the
  conclusion must be genuinely supported by its clues (a real deduction, not an
  arbitrary set).
- **Generic-connection correctness (no recipe):** a connected component is
  `correct` only when **all** its player-edges are authored `connectsTo` links
  (undirected); some-authored → `partial` (forms nothing, amber "won't quite
  hold"); none → `incorrect` (forms nothing, red). Author `connectsTo` on the
  clue pairs that genuinely relate, so a sound generic connection reads as correct.
- **A `redHerring` clue inside an otherwise all-authored cluster** yields a
  `false` outcome — the deduction still *forms* (under `isRedHerring: true`,
  framed "Questionable connection: …") but is flagged uneasy in board + Journal.
  This rewards spotting the real authored link while signalling the dead end.
- Gate the **true/best resolution** behind a key deduction, but keep the case
  completable without it (leave other endings reachable) — never single-gate
  critical progress. Every clue a *gated* recipe requires must be obtainable
  without relying on a `critical` roll: the CLI validator errors if a required
  clue's only source sits on a `critical`-tier scene edge (F-102), so the gated
  ending can't become an RNG lottery.

## NPCState (`npcs.json`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Referenced by conditions/effects (`target`) |
| `name` | string | Display name |
| `faction` | `string \| null` | Faction alignment (drives disposition→reputation propagation), or `null` |
| `disposition` | number | Starting disposition, −10..10 |
| `suspicion` | number | Starting suspicion, 0..10 |
| `memoryFlags` | `Record<string, boolean>` | Author as `{}`; populated at runtime via `setMemoryFlag` |
| `isAlive` | boolean | |
| `isAccessible` | boolean | |

## Authoring rules

- **`Condition` and `Effect` are the only mechanism** for gating access and
  mutating state from content. Do not expect ad-hoc logic in code — if you can't
  express it as a condition/effect (or a choice requirement/variant), it won't
  happen.
- **Deductions are derived from linked clue ids**, never hardcoded. If any
  connected clue is of type `redHerring`, the resulting deduction's
  `isRedHerring` is `true` (handled by `buildDeduction`).
- **No single Faculty gates critical progress.** Always provide an alternate path
  (a different faculty, a clue-gated option, or a mundane fallback) so a weak
  faculty can't dead-end the player.
- **Branching must be meaningful**, not cosmetic — choices should lead to
  materially different scenes, clues, or state.
- **Tone is measured and atmospheric**, never campy. Keep narrative and
  `description` feedback in the same Victorian-gaslit register.
- **Referential integrity.** Every choice outcome must point to a real scene id;
  every `requiresClue` / `advantageIf` / `cluesAvailable` / `discoverClue` target
  must be a real clue id; every NPC-targeting effect must name a real npc id. Run
  the validator (below) after every edit.

## Validation workflow

```bash
node scripts/validateCase.mjs                       # validate every case + vignette
node scripts/validateCase.mjs public/content/cases/the-whitechapel-cipher  # one case
```

Successful output:

```
✓ cases/the-whitechapel-cipher — 67 scenes, 14 clues
...
All 7 case(s) validated successfully.
```

Both the CLI (`scripts/validateCase.mjs`, a `vite-node` launcher for
`scripts/validateCase.ts`) and the runtime `validateContent` delegate to one
shared module, `src/engine/contentValidation.ts`, so they cannot drift. The
checks (errors fail the run with exit 1):

- **Broken scene edges** — every choice `outcomes.<tier>` target must be a known
  scene id (variant + shared `breakdown`/`incapacitation` ids count as valid
  targets). Recurses into `encounter.rounds[].choices` and `worseAlternative`.
- **Missing clue references** — `requiresClue`, `advantageIf`,
  `cluesAvailable[].clueId`, `onEnter` `discoverClue`, and `clue.sceneSource`
  targets must be known clue/scene ids.
- **Missing NPC references** — `onEnter` `disposition` / `suspicion` /
  `setMemoryFlag` and any `choice.npcEffect.npcId` (including inside encounter
  rounds) must be known npc ids.
- **Condition targets** — every `conditions[]` / `variantCondition` entry must
  reference a known clue/npc, a real faculty, and a valid `archetypeIs` /
  `npcSuspicion` / `factionReputation` value. (`hasFlag` with `value:false` is
  legitimate — it gates on a flag being unset.)
- **Variant structure** — every variant must have a `variantOf` (pointing at a
  known base/shared scene) and a `variantCondition`.
- **Outcome-tier completeness** — a faculty-check choice (has `faculty` **and**
  `difficulty` **or** `dynamicDifficulty`) must define all five tiers.
- **`firstScene`** — if `meta.json` names one, it must exist (missing → warning).

It also emits **warnings** (non-fatal, CLI only) for scenes unreachable from
`firstScene` and clues no reachable scene can discover.

The validator runs in CI — it is a step in the `test` job of
`.github/workflows/deploy.yml` (`run: node scripts/validateCase.mjs`, after
`npm ci`), and the `build` (build-compiles) job depends on that `test` job, so a
broken reference fails the merge gate. (Deployment itself is Cloudflare-side per
`wrangler.jsonc`; this workflow does not publish.)

## Audio asset reference

Scenes reference audio by key: `SceneNode.ambientAudio` selects an ambient loop,
and gameplay events trigger SFX (via a store subscription — see architecture.md /
`audioManager`). All files belong under `public/audio/`; MP3 is preferred.

### SFX → `public/audio/sfx/`

Short effects (0.5–2 s).

| File | Trigger | Mood / Description |
|---|---|---|
| `dice-roll.mp3` | Faculty check performed | Tactile dice clatter on wood |
| `clue-physical.mp3` | Physical clue discovered | Paper rustle or object pickup |
| `clue-testimony.mp3` | Testimony clue discovered | Soft murmur or quill scratch |
| `clue-occult.mp3` | Occult clue discovered | Eerie whisper or resonant chime |
| `clue-deduction.mp3` | Deduction clue discovered | Satisfying "click" or insight tone |
| `clue-red-herring.mp3` | Red herring discovered | Subtle discordant note |
| `composure-decrease.mp3` | Composure drops | Unsettling heartbeat or gasp |
| `vitality-decrease.mp3` | Vitality drops | Dull impact or wince |
| `scene-transition.mp3` | Scene changes | Soft page turn or footsteps fading |

### Ambient loops → `public/audio/ambient/`

Seamless loops (30–60 s); played with `loop: true` and cross-faded on scene
change.

| File | Example use | Mood / Description |
|---|---|---|
| `ambient-whitechapel-night.mp3` | Whitechapel Cipher Act 1, variants | Foggy streets, distant footsteps, gas lamp hiss |
| `ambient-london-day.mp3` | Whitechapel Cipher Act 2 | Daytime bustle, carriages, street vendors |
| `ambient-printshop.mp3` | Whitechapel Cipher Act 2 | Mechanical press rhythm, paper shuffle |
| `ambient-study.mp3` | Whitechapel Cipher Act 2 | Crackling fire, ticking clock, quiet room |
| `ambient-cellar.mp3` | Whitechapel Cipher Act 3, Mayfair Séance Act 3 | Dripping water, stone echo, oppressive silence |
| `ambient-mayfair-evening.mp3` | Mayfair Séance Act 1, variants | Upscale parlour, muffled conversation, clinking glass |
| `ambient-mayfair-night.mp3` | Mayfair Séance Act 3 | Quiet affluent street, wind, distant church bell |
| `ambient-seance.mp3` | Mayfair Séance Act 2 | Low drone, candle flicker, tense breathing |
| `ambient-thames-night.mp3` | A Matter of Shadows | River lapping, creaking wood, foghorn |
| `ambient-southwark-night.mp3` | A Matter of Shadows | Rougher district, rats, distant shouts |

The Example-use column is illustrative, not exhaustive — several tracks are
reused across later cases and vignettes. To find every scene that references a
given track, run `grep -rl ambientAudio public/content/` (or grep a specific
filename, e.g. `grep -rl ambient-whitechapel-night public/content/`).

**The 9 SFX files now ship in `public/audio/sfx/`; the 10 ambient loops are not
yet present in the repo.** SFX play; ambient is silent until the loop files are
added. Howler handles the missing ambient files gracefully, playing nothing (see
architecture.md / `audioManager`). Dropping the named ambient files into the path
above enables ambient audio with no code changes.
