# The Orrery Room — Design Spec

**Date:** 2026-07-17
**Status:** Draft — pending Codex spec review (ADR-0013 checkpoint 1)
**Source pitch:** [`docs/content-ideas-2026-07-10.md`](../../content-ideas-2026-07-10.md) §8 + Part 4 (Mythos thread staging)

## 1. Goal & catalog placement

Build **The Orrery Room**, a flagship-scale side vignette (2-act) at
`public/content/side-cases/the-orrery-room/`, filling the last faction-vignette gap
(Grey Dawn; Lamplighters, Rationalists, Court, and a cold case are already covered).

- **Unlock:** `triggerCondition: { type: "factionReputation", target: "Hermetic Order of the Grey Dawn", value: 2 }`.
- **Scale:** ~16–20 base scenes, 6–7 clues, 3 NPCs — larger than any existing vignette
  (8–13 scenes) because it carries a two-faction conflict, the Mythos thread's keystone
  deduction, the catalog's flagship Veil Sight beat, and a red herring.
- **Manifest:** one new `vignette` entry in `public/content/manifest.json`.
- **Faction rep note:** the exact faction key string is `Hermetic Order of the Grey Dawn` —
  verify against `worldSlice` initial reputation keys before authoring (this exact-string
  trap was caught by review once before).

**Premise (from the ranked pitch):** the Hermetic Order of the Grey Dawn asks the
investigator — politely, which is itself alarming — to appraise an orrery seized from a
dead member's estate before the Order's two factions go to war over it. The orrery models
a sky with one body too many. The collector's rooms suggest he spent his last months
adjusting it — or being corrected by it.

**Double solution (house rule):** the mundane layer fully resolves for every player —
the collector's death is laudanum-hastened heart failure confirmed by dosage arithmetic;
the factional war is a power struggle predating the orrery; the provenance paperwork is
genuinely forged even though the instrument is real (the red herring). The occult layer
(the extra body's gearing encodes the period Dr. Ost computed in The Comet Club) is
optional, never critical-path, and always shadowed by the mundane explanation.

## 2. Engine delta — vignette recipes + variants (the only code change)

**Problem:** the pitch's keystone (`mythos-pattern-named`, a `KeyDeduction`) and the
keystone-aware ending paragraphs (variant scenes) both require machinery vignettes do not
load today: `loadVignette` reads no `deductions.json` or `variants.json`, `VignetteData`
has no `recipes`/`variants` fields, and `vignetteToCaseData` hard-codes `variants: []`.
The ideas doc's "no new mechanics" claim is false for vignettes as built.

**Change (mirrors the case loader's existing optional-recipes pattern):**

1. `loadVignette` (`src/engine/contentLoader.ts`) additionally fetches **optional**
   `deductions.json` (`{ deductions: KeyDeduction[] }`) and `variants.json`
   (`{ variants: SceneNode[] }`), using the same `.catch(() => undefined/[])` idiom
   `loadCase` uses for its optional `deductions.json`. Absent files → `recipes: undefined`,
   `variants: []`. **All 4 existing vignettes need no edits and load byte-identically.**
2. `VignetteData` (`src/types/index.ts`) gains `recipes?: KeyDeduction[]` and
   `variants?: SceneNode[]`.
3. `vignetteToCaseData` (`src/store/slices/narrativeSlice.ts`) passes both through:
   `variants: data.variants ?? []`, `recipes: data.recipes`. Nothing else in the adapter
   changes.
4. `metaSlice.loadGame`'s vignette path picks this up for free — it already routes
   through `vignetteToCaseData` (F-066 single source of truth).

**Deliberately unchanged:** validator (`validateBundle` already accepts recipes +
variants and applies the F-102 gated-deduction reachability guard), variant resolution
(`resolveScene`), the deduction oracle, `hasDeduction` conditions, the evidence board —
all operate on `CaseData` and are agnostic to whether it came from a case or a vignette.

**Tests (TDD, RED watched):**
- Absence: a vignette without the two files loads with `recipes: undefined` /
  `variants: []` (regression guard for the 4 shipped vignettes).
- Presence: a vignette fixture with both files gets recipes + variants wired through
  `loadVignette` → `vignetteToCaseData` → store (`caseData.recipes`, variant resolution
  active via `useCurrentScene` path).
- Save/load round-trip: an in-progress vignette with recipes restores them (the
  `loadGame` vignette path).

## 3. Structure & scene graph

~18 base scenes + 3 variants (one per ending, §3.10), prefix `or-`. Two acts.

### Act 1 — the appraisal (9–10 scenes)

1. **Chapterhouse summons** (first scene): Vervain and Coyle stake their positions; the
   commission is set. The Order's politeness is the menace.
2. **The orrery room** (hub, revisitable): the machine examined. Sources
   `or-clue-gear-train`; hosts the keystone beat (§5).
3. **The collector's rooms**: sources `or-clue-adjustment-diary` (his handwriting
   *improves* over the final months) and `or-clue-laudanum-arithmetic`.
4. **Finch interview(s)**: the Rationalist horologist found the gearing sound and cannot
   say so. Influence check (Mesmerist-favoured) extracts `or-clue-finch-admission`.
5. **The Whispering Gallery**: tracing the previous seller surfaces
   `or-clue-forged-provenance` — the red herring (paperwork fake, instrument real).
6. Act 1 closes when the player can see the instrument question and the death question
   are separate questions.

### Act 2 — the verdict (8–9 scenes)

7. **The night scene**: alone with the running orrery (Nerve check). Sources
   `or-clue-night-observation`. The catalog's flagship Veil Sight beat: an Occultist with
   Veil Sight active perceives the extra body's motion as *arrival, not orbit* — one
   paragraph, never explained. Veil Sight **enriches** the clue's discovery prose; it
   never gates the clue.
8. **The dosage arithmetic**: the death resolves mundane, on the critical path — every
   player gets the full mundane solution.
9. **Faction pressure**: Vervain and Coyle each make their case and their offer.
10. **Verdict hub** → three endings:

| Ending | Gate | Effects |
|---|---|---|
| **Side with Vervain** — destroyed | none | Grey Dawn rep +2, Coyle disposition −3, flags `or-case-complete` + `or-orrery-destroyed` |
| **Side with Coyle** — enshrined | none | Grey Dawn rep +2, Vervain disposition −3, flags `or-case-complete` + `or-orrery-enshrined` |
| **Broker sealed custody** | `requiresDeduction: or-genuine-instrument` + Influence check | Grey Dawn rep +1, both dispositions +1, flags `or-case-complete` + `or-orrery-sealed` |

The brokered ending follows the earned-third-path pattern (PR #32). Its choice uses the
default `hidden` visibility (an unearned verdict shouldn't advertise itself); the
keystone beat (§5) is the vignette's `disabled`-visibility showcase.

Each ending scene has a `variantOf` twin gated on
`{ type: "hasDeduction", target: "mythos-pattern-named" }` adding one closing paragraph —
the player leaves knowing *what the number is*, and says nothing. The pattern is never
named in prose (Part 4 rule: never named, never seen).

**Cross-content persistence (corrects an ideas-doc premise):** `resetForNewCase` wipes
`state.deductions` on every case/vignette load (`narrativeSlice.ts`), while flags
persist. So the ideas doc's plan to gate downstream content on
`hasDeduction: mythos-pattern-named` only works *within this playthrough of this
vignette* (the ending variants use it). For the cross-content contract, each keystone
ending **variant**'s `onEnter` also sets a persistent flag
`{ type: "flag", target: "mythos-pattern-named", value: true }` — the variant only
resolves when the deduction is held, so the flag faithfully records the mint. Downstream
content (Mr. Nine, future cases) must gate on **`hasFlag: mythos-pattern-named`**, not
`hasDeduction`. The recipe id and the flag share the name deliberately: they are the same
fact in two namespaces (in-run deduction, cross-run flag), and `Condition.type`
disambiguates.

Rep math note: Vervain and Coyle are both Grey Dawn-aligned, so `adjustDisposition`
propagates `delta * 0.5` to faction rep. The ending effect values above are the
**authored** effects; net faction movement = authored rep delta + propagation from the
disposition deltas. Author the numbers so the net swing stays within ±2 (verify against
the propagation rule during content review).

## 4. Clues & deductions

`clues.json` — six clues + one red herring:

| id | type | source scene | notes |
|---|---|---|---|
| `or-clue-gear-train` | physical | orrery room | no forger's shortcuts; wear consistent with centuries |
| `or-clue-finch-admission` | testimony | Finch interview | extracted via Influence check |
| `or-clue-adjustment-diary` | occult | collector's rooms | the handwriting improves |
| `or-clue-laudanum-arithmetic` | physical | collector's rooms | the mundane death, confirmed; critical-path |
| `or-clue-orrery-period` | occult | keystone beat (§5) | exists only behind the flag gate |
| `or-clue-night-observation` | occult | night scene | Veil Sight enriches, never gates |
| `or-clue-forged-provenance` | red herring | Whispering Gallery | paperwork fake, orrery real |

`deductions.json` — two recipes:

- **`or-genuine-instrument`** = `or-clue-gear-train` + `or-clue-finch-admission`.
  Not a forgery. Gates the brokered ending.
- **`mythos-pattern-named`** = `or-clue-orrery-period` + `or-clue-adjustment-diary` +
  `or-clue-night-observation`. **The Mythos thread's keystone.** The recipe id is the
  cross-content contract name downstream content gates on via
  `hasDeduction: mythos-pattern-named` (ideas doc Part 4). It is only mintable here
  because `or-clue-orrery-period` is only obtainable behind the
  `mythos-period-computed` flag gate — so the F-102 reachability guard must treat the
  recipe as *gated* (reachable off the non-critical graph **given the flag**; confirm the
  validator's gated-recipe handling accepts a flag-gated source scene choice, and record
  the outcome in the plan).

Red-herring rule honored: `or-clue-forged-provenance` connects plausibly to
`or-clue-gear-train` (both speak to authenticity) but belongs to no recipe — connecting
it degrades the board per the standard oracle mechanics, no special handling.

## 5. The keystone beat — first authored use of Phase 5 vocabulary

In the orrery-room hub scene, one choice:

- **Text:** "Set the extra body's gearing against a figure you have seen before."
- **Gate:** `requiresFlag: mythos-period-computed`
- **`visibility: "disabled"`** with diegetic
  **`gateReason`:** "The gearing implies a period. You have nothing to set it against."
- **Met-gate behavior:** a Reason faculty check (tier flavours prose only); all
  non-failure outcome tiers route to a comparison scene whose `onEnter` carries
  `{ type: "discoverClue", target: "or-clue-orrery-period" }`; the failure tier routes
  back to the hub, which stays revisitable, so the keystone is never lost to one bad
  roll.

A flagless player *sees* the shape of what they're missing — the breadcrumb rewarding
replay after The Comet Club — without learning what it is. This is deliberately the
`disabled`-with-reason vocabulary's first from-day-one authored use (the roadmap caveat
Phase 5 was landed to satisfy). The gate-neutral-label and gateReason-tone rules from
`docs/content-authoring.md` apply.

## 6. NPCs & tone

`npcs.json` — three NPCs:

| id | name | faction | role |
|---|---|---|---|
| `npc-vervain` | Sister Vervain | Hermetic Order of the Grey Dawn | iconoclast — destroy it |
| `npc-coyle` | Magister Coyle | Hermetic Order of the Grey Dawn | preservationist — enshrine it |
| `npc-finch` | Mr. Abelard Finch | Rationalists Circle | horologist, out of his depth and lying about it |

Both Grey Dawn NPCs being faction-aligned means siding with one damages the other's
disposition while faction rep still moves net-positive (the Order got its verdict).
Faculty emphasis per the pitch: Lore + Reason lead; Influence between the factions;
one Nerve scene (the night watch). Archetype showcases: Occultist (Veil Sight night
scene), Deductionist (the period match), Mesmerist (Finch).

Tone: measured, atmospheric, never campy. The Order's courtesy is the dread.

## 7. Out of scope

- No changes to validator logic, variant resolution, deduction oracle, evidence board,
  or save schema (no migration — `CaseData.recipes` already round-trips).
- No retrofit of recipes/variants onto the 4 existing vignettes.
- No naming of the Mythos pattern in any prose.
- Downstream consumers of `mythos-pattern-named` (Mr. Nine, future cases) are future
  content, not this build.

## 8. Validation, testing & review pipeline

1. **Engine delta first** (TDD, RED watched), then content authored against it.
2. `node scripts/validateCase.mjs` after every content edit; zero errors and zero
   warnings required (including the soft-lock and soft-gate warnings from Phase 5).
3. **Content-backed witness tests** (existing style): keystone mintable with the
   flag-path clue set; keystone clue unobtainable flagless; brokered ending gated on the
   deduction; all three endings reachable flagless; ending variants resolve with the
   keystone deduction held.
4. **Content-integrity reviewer** pass (design/tone layer the validator can't check).
5. Whole-branch review + live Playwright verify: locked keystone choice renders
   flagless (🔒 + reason), unlocks with the flag, deduction forms on the board, all
   three endings reachable, zero console errors.
6. **Full ADR-0013 Codex trail** (file-based): spec pass → plan pass → implementation
   pass, prompts in `codex/input/`, reviews in `codex/output/`.
7. Gate before PR: `npm run test:run` + `npm run lint` + validator + `npm run build`
   all green. PR merged with a merge commit, never squashed.
