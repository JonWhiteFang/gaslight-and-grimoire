# The Comet Club — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the fourth main case, `the-comet-club` (flagship scale: ~67 base scenes + 7 variants, 16 clues, 10 NPCs, 4 deduction recipes), as pure content JSON under `public/content/cases/the-comet-club/`.

**Architecture:** Content-only change — no engine or component code. Data follows the established case layout (`meta.json`, `act1-3.json`, `clues.json`, `npcs.json`, `variants.json`, `deductions.json`) plus one `manifest.json` entry. Structure (every scene id, choice edge, gate, clue discovery, effect) is fully specified in this plan; narrative prose is authored by the implementer to the per-scene beats.

**Tech Stack:** JSON content files; validator `node scripts/validateCase.mjs`; Vitest suite as regression check.

**Spec:** `docs/superpowers/specs/2026-07-11-comet-club-case-design.md` (approved). Source pitch: `docs/content-ideas-2026-07-10.md` Part 3.

## Global Constraints

- Branch: `docs/comet-club-spec` (continue on it; rename is unnecessary). Never push or open a PR without user instruction.
- Every array-bearing file is an **object wrapping a named array** (`{"scenes": [...]}`, `{"clues": [...]}`, `{"npcs": [...]}`, `{"variants": [...]}`, `{"deductions": [...]}`) — never a bare array.
- Scene body text field is `narrative` (not `text`).
- **Prose convention:** this plan fixes all ids/edges/gates/mechanics verbatim; the implementer writes each scene's `narrative` (~120–300 words) and choice `text` from the given beats. Tone: measured, atmospheric, Victorian-gaslit, never campy. Sample the register from `public/content/cases/the-mayfair-seance/act1.json` before writing.
- Faculty-check choices (`faculty` + `difficulty`) MUST define all five outcome tiers. Non-check choices define `success` only. DCs stay in the 9–13 band used by existing cases.
- Choice gating uses ONLY `requiresClue` / `requiresDeduction` / `requiresFlag` / `requiresFaculty`. A `conditions` array on a Choice is not evaluated — never author one.
- Variants live in `variants.json`, set `variantOf` + `variantCondition`, and are never targeted by choice outcomes.
- No single-faculty gate on critical progress; every deduction-critical clue in this plan already has two routes — preserve them.
- Deduction-required clues must not be discoverable only via `critical` outcomes (validator F-102 errors).
- After every task: `node scripts/validateCase.mjs public/content/cases/the-comet-club` → 0 errors, then commit. Warnings are acceptable mid-plan only where the task says so, and must be zero by Task 7.
- Case id prefix conventions (matching `ms-*`): scenes `cc-act{1|2|3}-*` / `cc-var-*`, choices `cc-choice-*` / `cc-enc-*`, clues `cc-clue-*`, deductions `cc-deduction-*`. (The spec's short deduction names map: `cc-one-true-murder` → `cc-deduction-one-true-murder`, etc.)
- Global flags this case sets: `cc-case-complete`, `cc-club-dispersed`, `cc-took-the-eyepiece`, `mythos-period-computed` (breadcrumb; intentionally consumed by nothing yet).
- Ambient audio keys may reference not-yet-shipped loops (Howler degrades silently): use `ambient-club-dining`, `ambient-london-street`, `ambient-observatory-night` as fits.

---

### Task 1: Scaffold + data spine (meta, manifest, clues, NPCs, deductions)

**Files:**
- Create: `public/content/cases/the-comet-club/meta.json`
- Create: `public/content/cases/the-comet-club/clues.json`
- Create: `public/content/cases/the-comet-club/npcs.json`
- Create: `public/content/cases/the-comet-club/deductions.json`
- Create: `public/content/cases/the-comet-club/act1.json` (dinner scene only, no choices yet)
- Create: `public/content/cases/the-comet-club/act2.json`, `act3.json`, `variants.json` (empty wrappers)
- Modify: `public/content/manifest.json` (append case entry)

**Interfaces:**
- Produces: every clue id, npc id, and deduction id used by Tasks 2–6 (exact ids below — later tasks must not invent new ones).

- [ ] **Step 1: Verify the validator currently passes (baseline)**

Run: `node scripts/validateCase.mjs`
Expected: `All 7 case(s) validated successfully.`

- [ ] **Step 2: Write meta.json**

```json
{
  "id": "the-comet-club",
  "title": "The Comet Club",
  "synopsis": "The twelve gentleman-astronomers of the Aldebaran Society are dying in the order they once sat to observe the comet of 1882. Three deaths in five weeks, each natural on its face. The eighth chair wants a detective at the table — which puts you in the seating order too.",
  "acts": 3,
  "firstScene": "cc-act1-dinner",
  "facultyDistribution": {
    "reason": 6,
    "influence": 5,
    "perception": 5,
    "lore": 4,
    "nerve": 4,
    "vigor": 4
  }
}
```

- [ ] **Step 3: Append the manifest entry**

In `public/content/manifest.json`, append to the `cases` array (after `the-lamplighters-wake`, before the vignettes, matching main-case grouping):

```json
{
  "id": "the-comet-club",
  "title": "The Comet Club",
  "synopsis": "The twelve gentleman-astronomers of the Aldebaran Society are dying in the order they once sat to observe the comet of 1882. Three deaths in five weeks, each natural on its face. The eighth chair wants a detective at the table — which puts you in the seating order too.",
  "type": "case"
}
```

No `triggerCondition` — main cases are always available.

- [ ] **Step 4: Write npcs.json (10 NPCs)**

```json
{
  "npcs": [
    { "id": "cc-npc-aster", "name": "Colonel Aster", "faction": null, "disposition": 3, "suspicion": 0, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-halloway", "name": "Lady Wren Halloway", "faction": null, "disposition": 0, "suspicion": 1, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-sloane", "name": "Mr. Pettifer Sloane", "faction": null, "disposition": -1, "suspicion": 3, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-ost", "name": "Dr. Ost", "faction": null, "disposition": 1, "suspicion": 0, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-corven", "name": "Mr. Corven", "faction": null, "disposition": 0, "suspicion": 0, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-pemberton-rhee", "name": "Sir Julius Pemberton-Rhee", "faction": null, "disposition": -2, "suspicion": 2, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-millbank", "name": "The Reverend Dr. Millbank", "faction": null, "disposition": 1, "suspicion": 0, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-featherstonehaugh", "name": "Mr. Featherstonehaugh", "faction": "Rationalists Circle", "disposition": 0, "suspicion": 1, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-briggs", "name": "Briggs", "faction": null, "disposition": -1, "suspicion": 0, "memoryFlags": {}, "isAlive": true, "isAccessible": true },
    { "id": "cc-npc-weir", "name": "Mr. Weir", "faction": "Court of Smoke", "disposition": -3, "suspicion": 5, "memoryFlags": {}, "isAlive": true, "isAccessible": true }
  ]
}
```

(Weir and Featherstonehaugh are faction-aligned: disposition changes propagate ×0.5 to Court of Smoke / Rationalists Circle reputation — intended.)

- [ ] **Step 5: Write clues.json (the 2 dinner clues only)**

**Clue placement schedule (Codex Gate-1 fix):** the validator errors on any `sceneSource` naming a scene that doesn't exist yet, so `clues.json` grows task-by-task, each clue landing in the same task that authors its source scene:

- Task 1: `cc-clue-seating-chart`, `cc-clue-death-dates`
- Task 2: `cc-clue-founding-wager`, `cc-clue-sash-weights`, `cc-clue-quack-tonic`, `cc-clue-founder-death`
- Task 3: `cc-clue-sloane-debts`, `cc-clue-weir-instructions`
- Task 4: `cc-clue-halloway-diary`, `cc-clue-corven-absence`, `cc-clue-1882-log`, `cc-clue-razored-page`, `cc-clue-ost-period`, `cc-clue-briggs-nights`, `cc-clue-dome-warmth`, `cc-clue-aster-purchase`

The full 16-clue reference table below defines every field; each task's "add clues" step copies its rows from here. All clues: `"status": "new"`, `"isRevealed": false`. Write `description` prose from the content column (1–3 sentences each, evidence-register).

| id | type | title | sceneSource | connectsTo | tags | content (for description) |
|---|---|---|---|---|---|---|
| `cc-clue-seating-chart` | physical | The Founding Seating Chart | `cc-act1-dinner` | `["cc-clue-death-dates","cc-clue-corven-absence","cc-clue-halloway-diary"]` | `["society","pattern"]` | The 1882 wager's seating chart; the three deaths annotated in Aster's hand — chairs 2, 3, 5 |
| `cc-clue-death-dates` | physical | Three Dates in Five Weeks | `cc-act1-dinner` | `["cc-clue-seating-chart","cc-clue-quack-tonic"]` | `["pattern"]` | Heart, fall, fever — and each interval shorter than the last |
| `cc-clue-founding-wager` | testimony | The Founding Wager | `cc-act1-aster-commission` | `["cc-clue-sloane-debts","cc-clue-aster-purchase"]` | `["society","tontine"]` | Survivor takes the Hampstead observatory and everything its dome conceals |
| `cc-clue-sash-weights` | physical | The Moved Sash Weights | `cc-act1-chair5-house` | `["cc-clue-sloane-debts","cc-clue-weir-instructions"]` | `["murder","chair5"]` | Chair 5's "fall": the window's sash weights were shifted days before — someone prepared that drop |
| `cc-clue-sloane-debts` | physical | Sloane's Ledger | `cc-act2-sloane-ledger` | `["cc-clue-sash-weights","cc-clue-weir-instructions","cc-clue-quack-tonic"]` | `["tontine","court"]` | Ruinous debts to a Court of Smoke moneylender, and payments that stop the week chair 5 died |
| `cc-clue-weir-instructions` | testimony | Weir's Account | `cc-act2-weir-caught` | `["cc-clue-sash-weights","cc-clue-sloane-debts"]` | `["murder","court"]` | Paid for one death only — staged to sit inside the pattern |
| `cc-clue-quack-tonic` | **redHerring** | Chair 2's Tonic | `cc-act1-chair2-rooms` | `["cc-clue-sloane-debts","cc-clue-death-dates"]` | `["chair2"]` | A patent tonic laced with enough arsenic to read as poisoning — bottle bought, dosed, and drunk by chair 2's own hand |
| `cc-clue-halloway-diary` | testimony | The Halloway Diary | `cc-act2-halloway-diary` | `["cc-clue-seating-chart","cc-clue-corven-absence"]` | `["pattern","chair3"]` | Chair 3's last weeks: sleeping in daylight, speaking of "his number coming round" |
| `cc-clue-corven-absence` | testimony | The Skipped Chair | `cc-act2-corven-confides` | `["cc-clue-seating-chart","cc-clue-halloway-diary"]` | `["pattern","chair4"]` | Corven was called from the eyepiece in 1882 and never looked — and the pattern passed over him |
| `cc-clue-1882-log` | physical | The Private Observation Log | `cc-act2-observatory-log` | `["cc-clue-razored-page","cc-clue-founder-death"]` | `["observatory","1882"]` | The Society's own record of the comet night — one page razored out |
| `cc-clue-razored-page` | occult | The Razored Page | `cc-act2-razored-found` | `["cc-clue-ost-period","cc-clue-1882-log"]` | `["occult","1882"]` | The recovered page: an object between comet and Earth, sketched as an angular mark |
| `cc-clue-ost-period` | occult | Ost's Recomputation | `cc-act2-ost-study` | `["cc-clue-razored-page","cc-clue-founder-death"]` | `["occult","astronomy"]` | The occulting object is periodic — and the next perihelion is not far off |
| `cc-clue-briggs-nights` | testimony | The Worked Dome | `cc-act2-briggs-lodge` | `["cc-clue-dome-warmth"]` | `["observatory"]` | On certain nights the dome is worked though no one enters; Briggs keeps the dates |
| `cc-clue-dome-warmth` | occult | The Warm Refractor | `cc-act2-dome-witnessed` | `["cc-clue-briggs-nights","cc-clue-ost-period"]` | `["occult","observatory"]` | On a marked night, the great refractor is warm to the touch |
| `cc-clue-founder-death` | physical | The Founder's Obituary | `cc-act1-ras-library` | `["cc-clue-1882-log","cc-clue-ost-period"]` | `["pattern","1885"]` | Chair 1, dead "of age" in 1885 — the date fits as the pattern's first collection |
| `cc-clue-aster-purchase` | physical | Aster's Purchase | `cc-act2-aster-papers` | `["cc-clue-founding-wager"]` | `["tontine","client"]` | Aster bought chair 11's debts the day before he hired you |

- [ ] **Step 6: Write deductions.json as an empty wrapper**

`deductions.json`: `{ "deductions": [] }` — the recipes below reference clues authored in Tasks 2–4 (`requiredClues` ids are validator-enforced against `clues.json`), so the four recipes are written in **Task 5 Step 0**, before any `requiresDeduction` gate is authored. This is the reference block Task 5 copies verbatim:

```json
{
  "deductions": [
    {
      "id": "cc-deduction-one-true-murder",
      "requiredClues": ["cc-clue-sash-weights", "cc-clue-sloane-debts"],
      "title": "One True Murder",
      "description": "Exactly one of the three deaths is human work. The sash weights were moved by hired hands, and Sloane's ledger paid for them — a single killing dressed to sit inside the pattern. Whatever explains the others, it did not use a window.",
      "isRedHerring": false
    },
    {
      "id": "cc-deduction-numbered-tickets",
      "requiredClues": ["cc-clue-halloway-diary", "cc-clue-corven-absence", "cc-clue-seating-chart"],
      "title": "Numbered Tickets",
      "description": "The order is not the seating — it is the order they took the eyepiece. Corven never looked, and the deaths pass over his chair. The pattern predates the murderer, who is only hiding inside it.",
      "isRedHerring": false
    },
    {
      "id": "cc-deduction-the-return",
      "requiredClues": ["cc-clue-razored-page", "cc-clue-ost-period"],
      "title": "The Return",
      "description": "What the twelve observed in 1882 was not the comet. It is periodic, it is approaching perihelion, and the club's deaths keep its timetable. The collection is an approach.",
      "isRedHerring": false
    },
    {
      "id": "cc-deduction-poisoner",
      "requiredClues": ["cc-clue-quack-tonic", "cc-clue-sloane-debts", "cc-clue-death-dates"],
      "title": "A Poisoner Works the Chart",
      "description": "Arsenic in chair 2's tonic, Sloane's debts, three convenient deaths — a single poisoner harvesting the tontine chair by chair. Coherent, confident, and wrong.",
      "isRedHerring": true
    }
  ]
}
```

- [ ] **Step 7: Write act1.json (dinner scene only, choices added in Task 2), and empty wrappers**

`act1.json`:

```json
{
  "scenes": [
    {
      "id": "cc-act1-dinner",
      "act": 1,
      "narrative": "<PROSE: the Aldebaran Society dinner at Pall Mall. Aster seats the player at dead chair 3. All seven surviving members present and named in passing (chairs 4, 6, 7, 8, 9, 10, 11 — chairs 1 and 12 died years ago, chairs 2, 3, 5 are the recent dead); three empty chairs dressed in black crepe; the founding wager toasted; the seating chart framed on the wall with three dates inked beneath. End on Aster's murmured request for a private word.>",
      "ambientAudio": "ambient-club-dining",
      "cluesAvailable": [
        { "clueId": "cc-clue-seating-chart", "method": "automatic" },
        { "clueId": "cc-clue-death-dates", "method": "automatic" }
      ],
      "choices": []
    }
  ]
}
```

(The `<PROSE: ...>` marker is replaced with real narrative **in this same step** — never commit a marker. It appears in this plan only to define the beat.)

`act2.json`, `act3.json`: `{ "scenes": [] }`. `variants.json`: `{ "variants": [] }`.

- [ ] **Step 8: Validate**

Run: `node scripts/validateCase.mjs public/content/cases/the-comet-club`
Expected: `✓ cases/the-comet-club — 1 scenes, 2 clues` with 0 errors.

Also run: `node scripts/validateCase.mjs`
Expected: `All 8 case(s) validated successfully.`

- [ ] **Step 9: Run the test suite (regression — content loading is exercised by engine tests)**

Run: `npm run test:run`
Expected: PASS, same baseline as before the change.

- [ ] **Step 10: Commit**

```bash
git add public/content/cases/the-comet-club public/content/manifest.json
git commit -m "feat(content): scaffold The Comet Club — meta, manifest, clues, npcs, deductions"
```

---

### Task 2: Act I — The Eighth Chair (16 scenes + Act II hub seed)

**Files:**
- Modify: `public/content/cases/the-comet-club/act1.json` (dinner choices + 15 new scenes)
- Modify: `public/content/cases/the-comet-club/act2.json` (seed `cc-act2-hub` so Act I edges resolve)
- Modify: `public/content/cases/the-comet-club/clues.json` (add this task's 4 clues per the Task 1 placement schedule: `cc-clue-founding-wager`, `cc-clue-sash-weights`, `cc-clue-quack-tonic`, `cc-clue-founder-death` — rows copied from the Task 1 reference table)

**Interfaces:**
- Consumes: clue/npc ids from Task 1.
- Produces: scene ids `cc-act1-*` (list below) and `cc-act2-hub`; flags `cc-halloway-trusts`, `cc-knows-log-gap`, `cc-interval-grasped` consumed by Tasks 3–5.

- [ ] **Step 1: Author the Act I scene graph**

Every scene below goes in `act1.json` with `"act": 1`. Beats define the prose. Convergence rule: exploration scenes end with two plain choices — "pursue another thread" → `cc-act1-crossroads` and "enough for one night" → `cc-act1-interval` — except where a different edge is listed.

1. `cc-act1-dinner` — add choices:
   - `cc-choice-dinner-aster` "Accept the Colonel's request for a private word." (no check) → success: `cc-act1-aster-commission`
   - `cc-choice-dinner-observe` "Study the survivors around the table before committing to anything." — perception, DC 10; critical/success/partial: `cc-act1-table-observed`; failure/fumble: `cc-act1-table-misread`
2. `cc-act1-table-observed` — beat: reads of each survivor (Sloane's cuffs frayed under good tailoring; Pemberton-Rhee tastes nothing first; Corven drinks with purpose; Ost watches the window, not the table). onEnter: `[{ "type": "suspicion", "target": "cc-npc-sloane", "delta": 1 }]`. Choice (no check) → `cc-act1-aster-commission`.
3. `cc-act1-table-misread` — beat: a probing remark lands wrong; the table closes up. onEnter: `[{ "type": "suspicion", "target": "cc-npc-pemberton-rhee", "delta": 1 }, { "type": "composure", "delta": -1, "description": "The silence that follows your question has edges" }]`. Choice → `cc-act1-aster-commission`.
4. `cc-act1-aster-commission` — beat: the study; the wager explained; the engagement offered "as my guest — the club must not know you as a detective". cluesAvailable: `[{ "clueId": "cc-clue-founding-wager", "method": "dialogue" }]`. Choices:
   - `cc-choice-commission-accept` "Accept the commission." → `cc-act1-crossroads`
   - `cc-choice-commission-press` "Press him: what does the dome conceal?" — influence, DC 12; critical/success: `cc-act1-aster-candour`; partial/failure/fumble: `cc-act1-crossroads`
5. `cc-act1-aster-candour` — beat: Aster admits he is dying regardless, which is why he can afford curiosity. onEnter: `[{ "type": "disposition", "target": "cc-npc-aster", "delta": 2 }]`. Choice → `cc-act1-crossroads`.
6. `cc-act1-crossroads` — beat: morning after; three threads. Choices (no checks): → `cc-act1-chair5-house`, → `cc-act1-halloway-call`, → `cc-act1-ras-library`, plus `cc-choice-crossroads-chair2` "Chair 2's rooms are still under his landlady's seal." → `cc-act1-chair2-rooms`, and "Enough — take stock of the dates." → `cc-act1-interval`.
7. `cc-act1-chair5-house` — beat: the house where chair 5 fell; the landing window. cluesAvailable: `[{ "clueId": "cc-clue-sash-weights", "method": "exploration" }]`. Choices:
   - `cc-choice-chair5-window` "Examine the window mechanism itself." — perception, DC 10; critical/success: `cc-act1-chair5-window`; partial/failure/fumble: `cc-act1-chair5-street`
   - "Question the household." (no check) → `cc-act1-chair5-street`
8. `cc-act1-chair5-window` — beat: the drop was prepared; fresh tool-marks under old paint (Deductionist variant point, Task 6). Convergence choices.
9. `cc-act1-chair5-street` — beat: the housekeeper's account; a neighbour saw a man on the leads two nights before. Convergence choices.
10. `cc-act1-halloway-call` — beat: calling on the widow of chair 3 (Mayfair-séance variant point, Task 6). Choice:
    - `cc-choice-halloway-card` "Present yourself honestly — a friend of Aster's, asking about her husband's last weeks." — influence, DC 9; critical/success: `cc-act1-halloway-parlour`; partial/failure/fumble: `cc-act1-halloway-doorstep`
11. `cc-act1-halloway-parlour` — beat: she has read the diary; she says only that her husband "kept astronomer's hours, reversed" — sleeping in daylight. onEnter: `[{ "type": "disposition", "target": "cc-npc-halloway", "delta": 2 }, { "type": "flag", "target": "cc-halloway-trusts", "value": true }]`. Convergence choices.
12. `cc-act1-halloway-doorstep` — beat: propriety rebuffs you; the door closes. A second approach will need standing (retry in Act II via hub once disposition raised elsewhere — the Act II diary scene is flag-gated). Convergence choices.
13. `cc-act1-ras-library` — beat: the Royal Astronomical Society's library; the founder's obituary. cluesAvailable: `[{ "clueId": "cc-clue-founder-death", "method": "exploration" }]`. Choice:
    - `cc-choice-ras-compare` "Compare the Society's published 1882 notices against what a private log ought to hold." — lore, DC 10; critical/success: `cc-act1-ras-stacks`; partial/failure/fumble: convergence edge to `cc-act1-crossroads`
14. `cc-act1-ras-stacks` — beat: the published record is thinner than it should be — the Society printed everything except one night. onEnter: `[{ "type": "flag", "target": "cc-knows-log-gap", "value": true }]`. Convergence choices.
15. `cc-act1-chair2-rooms` — beat: the sealed rooms; the tonic bottle in the washstand. cluesAvailable: `[{ "clueId": "cc-clue-quack-tonic", "method": "exploration" }]`. Convergence choices.
16. `cc-act1-interval` — Act I closer. Beat: the dates laid side by side; the interval shrinks; chair 6 has less time than chair 5 had. onEnter: `[{ "type": "flag", "target": "cc-interval-grasped", "value": true }, { "type": "composure", "delta": -1, "description": "The arithmetic of the dates is not kind" }]`. Choice `cc-choice-interval-act2` "Begin working the club itself." → `cc-act2-hub`.

- [ ] **Step 2: Seed the Act II hub in act2.json**

`cc-act2-hub` (`"act": 2`) — beat: the club's rooms as base of operations; Aster's standing invitation; the survivors' orbits. Choices in Task 3/4 will extend this scene; author it now with two spokes so it is not terminal:
- `cc-choice-hub-sloane` "Sloane's debts wear good tailoring badly. Call on him." → `cc-act2-sloane-study` — **defer this choice to Task 3** (its target doesn't exist yet). Instead author now:
- `cc-choice-hub-wait` "Let the club talk around you." → success: `cc-act2-hub` (self-loop, replaced by real spokes in Tasks 3–4)

- [ ] **Step 3: Validate**

Run: `node scripts/validateCase.mjs public/content/cases/the-comet-club`
Expected: 0 errors; `17 scenes, 6 clues`.

- [ ] **Step 4: Commit**

```bash
git add public/content/cases/the-comet-club
git commit -m "feat(content): Comet Club Act I — the Eighth Chair (16 scenes)"
```

---

### Task 3: Act II loop 1 — the tontine layer (12 scenes)

**Files:**
- Modify: `public/content/cases/the-comet-club/act2.json`
- Modify: `public/content/cases/the-comet-club/clues.json` (add `cc-clue-sloane-debts`, `cc-clue-weir-instructions` from the Task 1 reference table)

**Interfaces:**
- Consumes: `cc-act2-hub`, clue ids, npc ids.
- Produces: scene ids below; flags `cc-sloane-pressed`, `cc-tonic-dissolved` consumed by Tasks 4–5.

- [ ] **Step 1: Replace the hub self-loop with real spokes and author the loop-1 scenes**

Rewrite `cc-act2-hub` choices (removing `cc-choice-hub-wait`):
- `cc-choice-hub-sloane` "Call on Sloane." → `cc-act2-sloane-study`
- `cc-choice-hub-moneylender` "Follow the smell of Sloane's money to its source." — `requiresClue: "cc-clue-sash-weights"` → `cc-act2-moneylender-den`
- `cc-choice-hub-chair6` "Watch Pemberton-Rhee's house — if the pattern holds, chair 6 is next." — `requiresFlag: "cc-interval-grasped"` → `cc-act2-chair6-watch`
- `cc-choice-hub-millbank` "The chaplain heard chair 2's last confession." — `requiresClue: "cc-clue-quack-tonic"` → `cc-act2-millbank-vestry`
- (Task 4 adds five more spokes; Task 5 adds the Hampstead summons.)

New scenes (all `"act": 2`):

1. `cc-act2-sloane-study` — beat: Sloane performing prosperity. Choice `cc-choice-sloane-press` "Name the moneylender and watch his face." — influence, DC 11; critical/success: `cc-act2-sloane-pressed`; partial/failure/fumble: `cc-act2-sloane-stonewalled`. Second choice: "Withdraw and try his paper instead." → `cc-act2-sloane-ledger` (`requiresFlag: "cc-sloane-pressed"` — the ledger route opens only after he's rattled; the moneylender route is the alternative).
2. `cc-act2-sloane-pressed` — beat: the crack; he over-explains a payment he was never asked about. onEnter: `[{ "type": "flag", "target": "cc-sloane-pressed", "value": true }, { "type": "suspicion", "target": "cc-npc-sloane", "delta": 2 }]`. Choices: → `cc-act2-sloane-ledger`, → `cc-act2-hub`.
3. `cc-act2-sloane-stonewalled` — beat: club courtesy as armor. onEnter: `[{ "type": "suspicion", "target": "cc-npc-sloane", "delta": 1 }]`. Choice → `cc-act2-hub` (the moneylender spoke remains the alternate route — no dead end).
4. `cc-act2-sloane-ledger` — beat: an hour alone with his accounts. cluesAvailable: `[{ "clueId": "cc-clue-sloane-debts", "method": "check", "requiresFaculty": { "faculty": "reason", "minimum": 3 } }]`. Choice → `cc-act2-hub`.
5. `cc-act2-moneylender-den` — beat: a Court of Smoke counting-house behind a chandler's (Court variant point, Task 6). Choices:
   - `cc-choice-lender-pay` "Buy the information outright." → `cc-act2-moneylender-deal`
   - `cc-choice-lender-lean` "Lean: the Yard would love this address." — nerve, DC 11; critical/success: `cc-act2-moneylender-deal`; partial/failure/fumble: `cc-act2-moneylender-price`
6. `cc-act2-moneylender-deal` — beat: Sloane sold out with professional indifference. cluesAvailable: `[{ "clueId": "cc-clue-sloane-debts", "method": "dialogue" }]`. onEnter: `[{ "type": "reputation", "target": "Court of Smoke", "delta": 2 }]` (spec requires a ±2 Court swing via the moneylender handling). Choice → `cc-act2-hub`.
7. `cc-act2-moneylender-price` — beat: the same information at a worse price — a favour owed. onEnter: `[{ "type": "reputation", "target": "Court of Smoke", "delta": -2 }, { "type": "composure", "delta": -1, "description": "You leave owing the Court something unnamed" }]`. cluesAvailable: `[{ "clueId": "cc-clue-sloane-debts", "method": "dialogue" }]`. Choice → `cc-act2-hub`.
8. `cc-act2-chair6-watch` — beat: a night on the square opposite Pemberton-Rhee's. Choice `cc-choice-watch-spot` "Hold the watch through the small hours." — perception, DC 11; critical/success: `cc-act2-rooftop-pursuit`; partial/failure/fumble: `cc-act2-weir-lost`.
9. `cc-act2-rooftop-pursuit` — **mundane encounter**. `"encounter": { "isSupernatural": false, "rounds": [...] }`, 2 rounds. (`wc-act2-cellar-ambush` in `the-whitechapel-cipher/act2.json` is the **JSON-structure model only** — it is one round; this encounter fully specifies both of its rounds below. Tier mapping shorthand used here and in the dome encounter: "→ A / B" means `critical` and `success` target A; `partial`, `failure`, `fumble` target B.)
   - Round 1 (`"roundNumber": 1, "isSupernatural": false`):
     - `cc-enc-roof-chase` "Take the parapet after him." — vigor, DC 11, `encounterDamage: { "vitalityDelta": -2 }` → `cc-act2-weir-caught` / `cc-act2-weir-lost`
     - `cc-enc-roof-cutoff` "Read the roofline — drop to the mews and cut him off." — perception, DC 10, `encounterDamage: { "vitalityDelta": -1 }` → `cc-act2-weir-caught` / `cc-act2-weir-lost`
     - `cc-enc-roof-break` "Let him go — mark his line of flight." — `isEscapePath: true`, no check, outcomes `{ "success": "cc-act2-weir-lost" }`
   - Round 2 (`"roundNumber": 2, "isSupernatural": false`) — the final leap across the mews gap:
     - `cc-enc-roof-leap` "Follow him across the gap." — vigor, DC 12, `encounterDamage: { "vitalityDelta": -2 }` → `cc-act2-weir-caught` / `cc-act2-weir-lost`
     - `cc-enc-roof-anticipate` "He must come down at the corner stair — be there first." — perception, DC 12, `encounterDamage: { "vitalityDelta": -1 }` → `cc-act2-weir-caught` / `cc-act2-weir-lost`
     - `cc-enc-roof-abandon` "Break off — no testimony is worth the drop." — `isEscapePath: true`, no check, outcomes `{ "success": "cc-act2-weir-lost" }`
10. `cc-act2-weir-caught` — beat: Weir winded on the leads; he talks because the alternative is the drop. cluesAvailable: `[{ "clueId": "cc-clue-weir-instructions", "method": "dialogue" }]`. onEnter: `[{ "type": "suspicion", "target": "cc-npc-weir", "delta": 2 }]`. Choice → `cc-act2-hub`.
11. `cc-act2-weir-lost` — beat: gone over the rooftops; but a man that practiced has a paymaster you already suspect (Mesmerist variant point, Task 6 — the variant re-delivers `cc-clue-weir-instructions`). Second route stays open: choice `cc-choice-lost-lender` "The Court brokered this hire. Go back to the counting-house and buy the rest." — `requiresClue: "cc-clue-sloane-debts"` → `cc-act2-weir-caught` (the Court sells you Weir's location; scene prose covers both arrivals — write it entry-agnostic: Weir cornered, talking). This is the second route that keeps `cc-clue-weir-instructions` off a single faculty.
12. `cc-act2-millbank-vestry` — beat: Millbank confirms chair 2 dosed himself for years — "he feared poison so much he administered it". onEnter: `[{ "type": "flag", "target": "cc-tonic-dissolved", "value": true }]`. Choice → `cc-act2-hub`.

- [ ] **Step 2: Validate**

Run: `node scripts/validateCase.mjs public/content/cases/the-comet-club`
Expected: 0 errors; `29 scenes, 8 clues`.

- [ ] **Step 3: Commit**

```bash
git add public/content/cases/the-comet-club/act2.json
git commit -m "feat(content): Comet Club Act II loop 1 — the tontine layer"
```

---

### Task 4: Act II loop 2 — the pattern layer + optional threads (21 scenes)

**Files:**
- Modify: `public/content/cases/the-comet-club/act2.json`
- Modify: `public/content/cases/the-comet-club/clues.json` (add the remaining 8 clues from the Task 1 reference table: `cc-clue-halloway-diary`, `cc-clue-corven-absence`, `cc-clue-1882-log`, `cc-clue-razored-page`, `cc-clue-ost-period`, `cc-clue-briggs-nights`, `cc-clue-dome-warmth`, `cc-clue-aster-purchase`)

**Interfaces:**
- Consumes: hub, flags `cc-halloway-trusts`, `cc-knows-log-gap` (Task 2).
- Produces: scene ids below; flag `cc-ost-confided`.

- [ ] **Step 1: Add hub spokes**

Append to `cc-act2-hub` choices:
- `cc-choice-hub-halloway` "Lady Halloway will receive you now." — `requiresFlag: "cc-halloway-trusts"` → `cc-act2-halloway-diary`
- `cc-choice-hub-halloway-cold` "Earn Lady Halloway's door a second time." — influence, DC 11; critical/success: `cc-act2-halloway-diary` (scene prose written entry-agnostic); partial/failure/fumble: `cc-act2-hub` (alternate route to the diary for players who failed Act I)
- `cc-choice-hub-corven` "Corven drinks at the Lamb by four o'clock." → `cc-act2-corven-rooms`
- `cc-choice-hub-chair3` "Chair 3's study stands as he left it. Ask his widow's leave to examine it." → `cc-act2-chair3-study`
- `cc-choice-hub-chairs` "Make the round of the surviving chairs." → `cc-act2-pemberton-rhee`
- `cc-choice-hub-hampstead` "Go up to Hampstead and the observatory." → `cc-act2-hampstead-grounds`
- `cc-choice-hub-solicitors` "Something about Aster's timing itches. Visit his solicitors." — `requiresClue: "cc-clue-founding-wager"` → `cc-act2-solicitors`

New scenes (all `"act": 2`; unlisted return edges → `cc-act2-hub`):

1. `cc-act2-halloway-diary` — beat: she reads the diary aloud rather than surrender it. cluesAvailable: `[{ "clueId": "cc-clue-halloway-diary", "method": "dialogue" }]`. onEnter: `[{ "type": "flag", "target": "cc-halloway-trusts", "value": true }]` (idempotent for the cold-route entry).
1b. `cc-act2-chair3-study` — **chair 3's death scene, and the non-Influence route to the diary** (Codex Gate-1 fix: the diary must not hang on Influence alone, and all three death scenes must be explorable). Beat: the study where chair 3's heart stopped at his desk; blackout curtains fitted for daytime sleep; the observation diary in the desk drawer, its last entries counting down in his own hand. Household staff admit you without a check — the widow's leave is a matter of a card, not a roll. cluesAvailable: `[{ "clueId": "cc-clue-halloway-diary", "method": "exploration" }]`. Choices → `cc-act2-hub`, and `cc-choice-study-condole` "Carry the diary's weight to Lady Halloway herself." → `cc-act2-halloway-diary`.
2. `cc-act2-corven-rooms` — beat: Corven three brandies in. Choice `cc-choice-corven-steer` "Steer him to the night of the comet." — influence, DC 10 (lore alternative below); critical/success: `cc-act2-corven-confides`; partial/failure/fumble: `cc-act2-corven-maudlin`. Second choice `cc-choice-corven-lore` "Talk astronomy until the amateur in him surfaces." — lore, DC 10; same outcome mapping (two-faculty route).
3. `cc-act2-corven-confides` — beat: the telegram that called him from the eyepiece; the shame and the luck of it. cluesAvailable: `[{ "clueId": "cc-clue-corven-absence", "method": "dialogue" }]`.
4. `cc-act2-corven-maudlin` — beat: he weeps about being spared and cannot say why; try again another way. Choices → `cc-act2-corven-rooms` ("Order another and wait."), → `cc-act2-hub`.
5. `cc-act2-pemberton-rhee` — beat: chair 6 behind food-tasters and a rewritten will; terror as testimony. onEnter: `[{ "type": "suspicion", "target": "cc-npc-pemberton-rhee", "delta": -1 }]`. Choices → `cc-act2-featherstonehaugh` ("The youngest member has opinions he is eager to share."), → `cc-act2-hub`.
6. `cc-act2-featherstonehaugh` — beat: the Rationalist lobbying to burn the 1882 log as an embarrassment. Choices:
   - `cc-choice-feather-side` "Agree the log is a liability — and offer to examine it first." → `cc-act2-hampstead-grounds`, `npcEffect: { "npcId": "cc-npc-featherstonehaugh", "dispositionDelta": 2, "suspicionDelta": 0 }`
   - `cc-choice-feather-oppose` "Tell him destroying evidence is a poor kind of rationalism." → `cc-act2-hub`, `npcEffect: { "npcId": "cc-npc-featherstonehaugh", "dispositionDelta": -2, "suspicionDelta": 1 }`
7. `cc-act2-hampstead-grounds` — beat: the observatory on its hill; Briggs's lamp in the lodge; the dome dark. Choices: → `cc-act2-briggs-lodge`, → `cc-act2-observatory-log`, `cc-choice-grounds-night` "Come back on one of Briggs's marked nights." — `requiresClue: "cc-clue-briggs-nights"` → `cc-act2-dome-night`, → `cc-act2-hub`.
8. `cc-act2-briggs-lodge` — beat: Briggs oils a telescope no one may use; his almanac of "worked" nights. cluesAvailable: `[{ "clueId": "cc-clue-briggs-nights", "method": "dialogue" }]`. Choice → `cc-act2-hampstead-grounds`.
9. `cc-act2-observatory-log` — beat: the private log under glass; the razored stub. cluesAvailable: `[{ "clueId": "cc-clue-1882-log", "method": "exploration" }]`. Choice `cc-choice-log-search` "Search the founder's effects for the razored page." — `requiresClue: "cc-clue-1882-log"`, perception, DC 12; critical/success: `cc-act2-razored-found`; partial/failure/fumble: `cc-act2-razored-eluded`. Second gated route: `cc-choice-log-lore` "Reason it as an archivist: where does a careful man hide what he cannot destroy?" — `requiresClue: "cc-clue-1882-log"`, lore, DC 12; same outcomes.
10. `cc-act2-razored-found` — beat: the page, folded into the founder's unread Bible; the angular mark. onEnter: `[{ "type": "discoverClue", "target": "cc-clue-razored-page" }, { "type": "composure", "delta": -1, "description": "The sketch is only ink, and you look away from it twice" }]`. Choice → `cc-act2-hampstead-grounds`.
11. `cc-act2-razored-eluded` — beat: not in the log room; but effects travel — where did the founder die? Choice → `cc-act2-observatory-log` ("Search again with fresh eyes."), → `cc-act2-hampstead-grounds`.
12. `cc-act2-ost-study` — spoke from hub: add hub choice `cc-choice-hub-ost` "Dr. Ost has stopped sleeping on certain nights. Ask him why." → this scene. Beat: Ost half-hoping to be debunked. Choice `cc-choice-ost-show` "Show him what you hold and ask for the figure." — `requiresFlag: "cc-knows-log-gap"` → `cc-act2-ost-confides`; alternate `cc-choice-ost-page` "Lay the razored page on his desk." — `requiresClue: "cc-clue-razored-page"` → `cc-act2-ost-confides`; else `cc-choice-ost-general` "Press him with nothing in hand." — influence, DC 13; critical/success: `cc-act2-ost-confides`; partial/failure/fumble: `cc-act2-ost-evasive`.
13. `cc-act2-ost-confides` — beat: the recomputation; the period; the perihelion. cluesAvailable: `[{ "clueId": "cc-clue-ost-period", "method": "dialogue" }]`. onEnter: `[{ "type": "flag", "target": "cc-ost-confided", "value": true }]`.
14. `cc-act2-ost-evasive` — beat: he retreats into method; come back armed. Choice → `cc-act2-hub`.
15. `cc-act2-dome-night` — **supernatural encounter** (`"isSupernatural": true`), 2 rounds; the engine supplies the opening Nerve/Lore reaction check at DC 12. Damage is **dual-axis** (composure + vitality) per the supernatural-encounter rule in `docs/content-authoring.md`.
    - Round 1 (`"roundNumber": 1, "isSupernatural": true`):
      - `cc-enc-dome-hold` "Hold your ground and observe what works the dome." — nerve, DC 12, `encounterDamage: { "composureDelta": -2, "vitalityDelta": -1 }` → `cc-act2-dome-witnessed` / `cc-act2-dome-fled`
      - `cc-enc-dome-name` "Recite the constellations — order the sky back into a map." — lore, DC 11, `encounterDamage: { "composureDelta": -1, "vitalityDelta": -1 }` → `cc-act2-dome-witnessed` / `cc-act2-dome-fled`
      - `cc-enc-dome-out` "Get out onto the gantry and down." — `isEscapePath: true`, no check, outcomes `{ "success": "cc-act2-dome-fled" }` (Operator variant point, Task 6)
    - Round 2 (`"roundNumber": 2, "isSupernatural": true`) — the refractor swings to bear on nothing visible:
      - `cc-enc-dome-stand` "Stand where it points and refuse to be moved." — nerve, DC 13, `encounterDamage: { "composureDelta": -2, "vitalityDelta": -1 }` → `cc-act2-dome-witnessed` / `cc-act2-dome-fled`
      - `cc-enc-dome-chart` "Chart its bearing against Briggs's almanac dates." — lore, DC 13, `encounterDamage: { "composureDelta": -1, "vitalityDelta": -1 }` → `cc-act2-dome-witnessed` / `cc-act2-dome-fled`
      - `cc-enc-dome-flee` "Take the stair three at a time and do not look up." — `isEscapePath: true`, no check, outcomes `{ "success": "cc-act2-dome-fled" }`
16. `cc-act2-dome-witnessed` — beat: the great refractor warm as a kettle in an empty dome. cluesAvailable: `[{ "clueId": "cc-clue-dome-warmth", "method": "check", "requiresFaculty": { "faculty": "nerve", "minimum": 3 } }]`. onEnter: `[{ "type": "composure", "delta": -1, "description": "Metal should not hold heat it was never given" }]`. Choice → `cc-act2-hub`.
17. `cc-act2-dome-fled` — beat: down the hill with the dome silent behind you. Choice → `cc-act2-hampstead-grounds` ("Return on the next marked night." — the encounter is repeatable), → `cc-act2-hub`.
18. `cc-act2-solicitors` — beat: Gray's Inn; a clerk who can be charmed or a ledger that can be glimpsed. Choice `cc-choice-solicitor-charm` — influence, DC 12; critical/success: `cc-act2-aster-papers`; partial/failure/fumble: `cc-act2-solicitors-rebuffed`.
19. `cc-act2-aster-papers` — beat: the assignment of chair 11's debts, dated the day before your engagement. cluesAvailable: `[{ "clueId": "cc-clue-aster-purchase", "method": "exploration" }]`. Choice → `cc-act2-hub`.
20. `cc-act2-solicitors-rebuffed` — beat: professional discretion, impenetrable. Choice → `cc-act2-hub`.

(Loop 2 adds 21 scenes including `cc-act2-chair3-study` — final Act II tally after Task 5's midpoint: 35.)

- [ ] **Step 2: Validate**

Run: `node scripts/validateCase.mjs public/content/cases/the-comet-club`
Expected: 0 errors; `50 scenes, 16 clues`.

- [ ] **Step 3: Commit**

```bash
git add public/content/cases/the-comet-club/act2.json
git commit -m "feat(content): Comet Club Act II loop 2 — the pattern layer"
```

---

### Task 5: Act III — Perihelion Night (17 scenes + bridge)

**Files:**
- Modify: `public/content/cases/the-comet-club/act2.json` (hub summons spoke + `cc-act2-midpoint`)
- Modify: `public/content/cases/the-comet-club/act3.json` (17 scenes)

**Interfaces:**
- Consumes: deduction ids (Task 1), flags from Tasks 2–4.
- Produces: terminal flags `cc-case-complete`, `cc-club-dispersed`, `cc-took-the-eyepiece`, `mythos-period-computed`.

- [ ] **Step 0: Write the four deduction recipes into deductions.json**

Copy the four-recipe JSON block from Task 1 Step 6 verbatim into `deductions.json` (all 16 `requiredClues` ids now exist in `clues.json`). Run `node scripts/validateCase.mjs public/content/cases/the-comet-club` — 0 errors — before authoring any `requiresDeduction` gate below.

- [ ] **Step 1: Add the midpoint and the summons to act2.json**

- `cc-act2-midpoint` — hub spoke `cc-choice-hub-midpoint` "Lay the murder out end to end." — `requiresDeduction: "cc-deduction-one-true-murder"` → this scene. Beat: one death is bought; the others are not; the murderer is hiding inside something he does not understand. onEnter: `[{ "type": "flag", "target": "cc-midpoint-passed", "value": true }]`. Choice → `cc-act2-hub`.
- Hub spoke `cc-choice-hub-summons` "Briggs's note arrives: the club gathers at Hampstead at the perihelion. Go." — `requiresFlag: "cc-interval-grasped"` → `cc-act3-eve`.

- [ ] **Step 2: Author act3.json**

All scenes `"act": 3`.

1. `cc-act3-eve` — beat: the eve of the gathering; how you spend it depends on what you hold. Choices:
   - `cc-choice-eve-prepared` "Confront Sloane before the gathering — on your terms." — `requiresDeduction: "cc-deduction-one-true-murder"` → `cc-act3-confront-prepared`
   - `cc-choice-eve-herring` "Confront the poisoner working the chart." — `requiresDeduction: "cc-deduction-poisoner"` → `cc-act3-confront-collapse`
   - `cc-choice-eve-forced` "Go to Hampstead and force the question there, evidence or no." → `cc-act3-confront-forced`
2. `cc-act3-confront-prepared` — beat: Sloane, the ledger, Weir's account (reference `cc-clue-weir-instructions` if held — write the prose to stand either way); he folds. Choice → `cc-act3-sloane-defence`.
3. `cc-act3-confront-forced` — beat: accusation on instinct at the gathering's edge. Choice `cc-choice-forced-press` — influence, DC 13, `advantageIf: ["cc-clue-weir-instructions"]`; critical/success: `cc-act3-sloane-defence`; partial/failure/fumble: `cc-act3-sloane-slips`.
4. `cc-act3-confront-collapse` — beat: the poisoner theory laid out — and dismantled by Sloane's counter-thrusts and the members' own knowledge of chair 2's habits; the club closes ranks. (Prose must be **state-neutral** — scene narrative is a single string with no conditional mechanism, so write the dismantling without referencing whether the player heard Millbank's testimony.) onEnter: `[{ "type": "flag", "target": "cc-murderer-walked", "value": true }, { "type": "composure", "delta": -2, "description": "The theory comes apart in your hands in front of the whole table" }]`. Choice → `cc-act3-ending-failure`.
5. `cc-act3-sloane-defence` — beat: "I stole from a fire." One dying man killed for money inside a pattern killing them all. onEnter: `[{ "type": "flag", "target": "cc-sloane-unmasked", "value": true }]`. Choices: `cc-choice-defence-law` "Hand him to the law before the gathering." → `cc-act3-gathering`; `cc-choice-defence-use` "Keep him close — a murderer who studied the pattern is still a student of it." → `cc-act3-gathering`, `npcEffect: { "npcId": "cc-npc-sloane", "dispositionDelta": 2, "suspicionDelta": 0 }`.
6. `cc-act3-sloane-slips` — beat: by morning Sloane is on a packet to Ostend; the pattern keeps his chair. onEnter: `[{ "type": "flag", "target": "cc-sloane-fled", "value": true }]`. Choice → `cc-act3-gathering`.
7. `cc-act3-gathering` — beat: the survivors at Hampstead; Aster's intent declared: he will take the eyepiece and see it back. Choice → `cc-act3-nexus`.
8. `cc-act3-nexus` — the three-way branch:
   - `cc-choice-nexus-disperse` "End it: expose everything, disperse the club, seal the log." → `cc-act3-disperse`
   - `cc-choice-nexus-observe` "Let Aster look — and watch him as he does." — nerve, DC 12; critical/success: `cc-act3-aster-watched`; partial/failure/fumble: `cc-act3-aster-flinched`
   - `cc-choice-nexus-eyepiece` "Take the eyepiece yourself." → `cc-act3-eyepiece-approach`
9. `cc-act3-disperse` — beat: the murder exposed (or its flight admitted), the wager dissolved, the log sealed with the Lamplighters. onEnter: `[{ "type": "flag", "target": "cc-club-dispersed", "value": true }, { "type": "reputation", "target": "Lamplighters", "delta": 1 }]`. Choices: `cc-choice-disperse-best` "Keep what you understand to yourself, and keep Ost's date." — `requiresDeduction: "cc-deduction-the-return"` **and** `requiresFlag: "cc-sloane-unmasked"` (both fields on the one choice; `isChoiceVisible` in `src/components/ChoicePanel/ChoicePanel.tsx` ANDs all `requires*` fields — verified. The spec's Best ending demands the murderer unmasked, so a fled Sloane forecloses it) → `cc-act3-ending-best`; `cc-choice-disperse-plain` "Let it be a murder story, and let the rest go unexplained." → `cc-act3-ending-compromised`.
10. `cc-act3-aster-watched` — beat: you watch a man's ticket punched; Aster lowers himself from the eyepiece smiling, and thanks you. onEnter: `[{ "type": "composure", "delta": -3, "description": "You watched, and you will keep watching it for years" }, { "type": "flag", "target": "cc-watched-collection", "value": true }]`. Choice → `cc-act3-ending-compromised`.
11. `cc-act3-aster-flinched` — beat: you look away at the moment it matters; Aster looks alone. Choice → `cc-act3-ending-compromised`.
12. `cc-act3-eyepiece-approach` — **base scene = the blind version** (full version is a Task 6 variant gated on `cc-deduction-the-return`). Beat: taking the eyepiece with no framework to survive what fills it. onEnter: `[{ "type": "flag", "target": "cc-took-the-eyepiece", "value": true }, { "type": "composure", "delta": -4, "description": "You looked without understanding, and something looked back without effort" }, { "type": "vitality", "delta": -1, "description": "Your hands will not stop shaking for a week" }]`. Choice → `cc-act3-ending-eyepiece`.
13. `cc-act3-ending-best` — terminal (no choices). Beat: quiet, chilling, complete — the club dispersed, the log sealed, the date kept in one head only. onEnter: `[{ "type": "flag", "target": "cc-case-complete", "value": true }, { "type": "flag", "target": "mythos-period-computed", "value": true }]`.
14. `cc-act3-ending-compromised` — terminal. Beat: the human ledger balanced (or fled), the inhuman one still open; the survivors scatter and the interval, somewhere, keeps shrinking. onEnter: `[{ "type": "flag", "target": "cc-case-complete", "value": true }]`.
15. `cc-act3-ending-failure` — terminal. Beat: the club closes ranks; a last letter from Briggs — the pattern now has ten chairs. onEnter: `[{ "type": "flag", "target": "cc-case-complete", "value": true }]`.
16. `cc-act3-ending-eyepiece` — terminal. Beat: what you keep is not knowledge but a direction — you will never again face the estuary without knowing which way the water deepens. onEnter: `[{ "type": "flag", "target": "cc-case-complete", "value": true }, { "type": "flag", "target": "mythos-period-computed", "value": true }]`.
17. (Scene 17 is the Task 6 variant slot — act3.json itself holds 16.)

- [ ] **Step 3: Validate**

Run: `node scripts/validateCase.mjs public/content/cases/the-comet-club`
Expected: 0 errors; `67 scenes, 16 clues`. Zero unreachable-scene warnings for act1–3 ids.

- [ ] **Step 4: Commit**

```bash
git add public/content/cases/the-comet-club/act2.json public/content/cases/the-comet-club/act3.json
git commit -m "feat(content): Comet Club Act III — Perihelion Night"
```

---

### Task 6: Variants — archetype exclusives + cross-case reactions (7 variants)

**Files:**
- Modify: `public/content/cases/the-comet-club/variants.json`

**Interfaces:**
- Consumes: base scene ids (Tasks 2–5); external flags `wc-court-deal-made` (Whitechapel), `ms-case-complete` (Mayfair — verified to exist in `the-mayfair-seance/act3.json`).

- [ ] **Step 1: Author the 7 variants**

Each is a full `SceneNode` in `variants.json` (`"act"` matches its base) with `variantOf` + `variantCondition`. A variant **replaces its base wholly** — copy the base's choices/cluesAvailable and modify; never let a variant drop a base scene's critical clue or edge.

1. `cc-var-dinner-occultist` — `variantOf: "cc-act1-dinner"`, `variantCondition: { "type": "archetypeIs", "value": "occultist" }`. Same clues/choices as the dinner; narrative rewritten: Veil Sight shows four chairs at the table faintly *punched* — marked like tickets — including the client's, and the empty chair you sit in is cold.
2. `cc-var-chair5-deductionist` — `variantOf: "cc-act1-chair5-window"`, `variantCondition: { "type": "archetypeIs", "value": "deductionist" }`. The reconstruction set-piece: the fall re-run in the mind's eye, timings and sightlines (the case's purest deduction scene). Same edges; add onEnter `[{ "type": "suspicion", "target": "cc-npc-sloane", "delta": 1 }]`.
3. `cc-var-weir-mesmerist` — `variantOf: "cc-act2-weir-lost"`, `variantCondition: { "type": "archetypeIs", "value": "mesmerist" }`. Weir is gone, but three nights later he sits opposite you at the club's card table — under club courtesy, you take him apart. cluesAvailable: `[{ "clueId": "cc-clue-weir-instructions", "method": "dialogue" }]`; keep the base's `cc-choice-lost-lender` choice and hub edge.
4. `cc-var-dome-operator` — `variantOf: "cc-act2-dome-fled"`, `variantCondition: { "type": "archetypeIs", "value": "operator" }`. Fleeing, the Operator reads the gantry as a burglar: a sealed maintenance hatch nobody sane would use — and uses it. cluesAvailable: `[{ "clueId": "cc-clue-dome-warmth", "method": "check", "requiresFaculty": { "faculty": "vigor", "minimum": 3 } }]`; keep base edges.
5. `cc-var-moneylender-court` — `variantOf: "cc-act2-moneylender-den"`, `variantCondition: { "type": "hasFlag", "target": "wc-court-deal-made" }`. The counting-house knows you; Sloane is sold out cheap and civilly. Rewrite so both choices lead to `cc-act2-moneylender-deal` (no check needed; the `cc-choice-lender-lean` check choice is replaced by a plain choice).
6. `cc-var-halloway-seance` — `variantOf: "cc-act1-halloway-call"`, `variantCondition: { "type": "hasFlag", "target": "ms-case-complete" }`. Lady Halloway attended Lady Ashworth's circle and knows your name; the doorstep check is waived — single plain choice → `cc-act1-halloway-parlour`.
7. `cc-var-eyepiece-full` — `variantOf: "cc-act3-eyepiece-approach"`, `variantCondition: { "type": "hasDeduction", "target": "cc-deduction-the-return" }`. The full version: you look **knowing what looks back**, framed by Ost's figure — terrible but survivable. onEnter: `[{ "type": "flag", "target": "cc-took-the-eyepiece", "value": true }, { "type": "composure", "delta": -2, "description": "You held the figure in your head like a rail above a drop, and it held" }]`. Choice → `cc-act3-ending-eyepiece`.

- [ ] **Step 2: Validate**

Run: `node scripts/validateCase.mjs public/content/cases/the-comet-club`
Expected: 0 errors; scene count rises to `74 scenes, 16 clues` (if the validator's count excludes variants it will read `67` — trust 0 errors as the gate either way).

- [ ] **Step 3: Commit**

```bash
git add public/content/cases/the-comet-club/variants.json
git commit -m "feat(content): Comet Club variants — archetype exclusives and cross-case reactions"
```

---

### Task 7: Full verification + docs

**Files:**
- Modify: `docs/status.md` (content inventory table + totals)

- [ ] **Step 1: Full validation, zero warnings**

Run: `node scripts/validateCase.mjs`
Expected: `All 8 case(s) validated successfully.`, and **zero warnings** for `the-comet-club` (no unreachable scenes, no undiscoverable clues). Fix any stragglers now.

- [ ] **Step 2: Lint + full test suite**

Run: `npm run lint && npm run test:run`
Expected: both PASS at the pre-existing baseline (content-only change; any new failure is a regression to fix before proceeding).

- [ ] **Step 3: Update docs/status.md**

Add the row (numbers verbatim from Step 1's validator output) to the content inventory table and update the totals row:

```markdown
| The Comet Club | main (3-act) | 74 | 16 | 10 |
```

- [ ] **Step 4: Commit**

```bash
git add docs/status.md
git commit -m "docs: add The Comet Club to content inventory"
```

---

### Task 8: Content-integrity review

- [ ] **Step 1: Run the design/tone review**

Invoke the `/review-content` skill (dispatches the `content-integrity-reviewer` subagent) over `public/content/cases/the-comet-club/**` — it checks what the validator can't: single-faculty dead-ends, cosmetic branching, red-herring/deduction mismatches, tone drift, semantically wrong edges.

- [ ] **Step 2: Fix accepted findings, re-validate, commit**

```bash
node scripts/validateCase.mjs public/content/cases/the-comet-club
git add public/content/cases/the-comet-club
git commit -m "fix(content): Comet Club — content-integrity review findings"
```

(Skip the commit if there are no findings.)

---

## After the plan (orchestrator-level, not implementer tasks)

- **Codex Gate 2:** submit the complete task diff against the recorded start base `2d8281ea104015a527836bdce13c58c39405d313` (the plan commit — no content files exist before it): `git add -N` any untracked task files, then review `git diff 2d8281ea`, before declaring done.
- **`/checkpoint`:** update PROJECT_STATE/RUN_LOG; the mythos-flag decision (`mythos-period-computed` authored with no consumer yet) may warrant an ADR line referencing the ideation doc's Part 4 staging.
- **Merge:** PR with merge commit (never squash), on user instruction only.
