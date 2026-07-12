# The Comet Club — Case Design Spec

**Date:** 2026-07-11
**Status:** Approved design (brainstormed with user; sections A–I approved in session)
**Source concept:** `docs/content-ideas-2026-07-10.md` — concept #5 (ranked #1), Part 3 detailed pitch
**Type:** Main case (3 acts), fourth main case in the catalog
**Scale:** Flagship (Whitechapel-class) — ~66 scenes, ~16 clues, ~10 NPCs

---

## A. Premise & structure

**Slug:** `the-comet-club`. Main case, no `triggerCondition` in `manifest.json` (always
available, like the other three mains).

The twelve gentleman-astronomers of the Aldebaran Society are dying in the order they sat to
observe the 1882 comet. Three deaths in five weeks, each natural on its face. Colonel Aster
(chair eight) hires the investigator as his dinner guest — seating the player at a dead man's
chair, inside the pattern.

**The double solution** (the case's structural signature): exactly one of the three deaths is
a human murder — a tontine killing camouflaged inside the pattern. The other deaths belong to
the pattern itself, which predates the murderer and is accelerating. The rational shadow (a
classic tontine plot) fully explains the case for a player who never chases the occult layer.

**Seating-chart logic:** the deaths run chair 2 → 3 → 5. Chair 4 is alive because he was
called away from the eyepiece in 1882 and never looked — the skip proves the pattern follows
*who looked and in what order*, not seating per se (the seating order merely records the order
they took the eyepiece). Chair 1, the Society's founder, died "of age" in 1885: the first
collection, never recognized. The human murderer killed chair 5 believing he was mimicking a
seating-order pattern he didn't fully understand — the chair-4 skip is what his camouflage
fails to explain. Chair 12 died abroad years ago (mentioned, never seen; his death date fits).

**Scene budget (~66):**

| Act | Scenes | Content |
|---|---|---|
| Act I — The Eighth Chair | ~14 | Club dinner set-piece (all survivors introduced; automatic clues), three opening investigation paths (chair 5 death scene / Lady Halloway / RAS library), first death-scene visits, shrinking-interval realization |
| Act II — The Seating Order | ~36 | Two loops. Loop 1 (tontine layer): Sloane's debts, the Court moneylender, sash weights → `cc-one-true-murder`. Loop 2 (pattern layer): Halloway diary, Corven's absence, Briggs, razored page, Ost's recomputation → `cc-numbered-tickets`, `cc-the-return`. Every surviving chair visitable; all three death scenes explorable; moneylender thread; one exclusive scene per archetype; two encounters |
| Act III — Perihelion Night | ~12 | Murderer confrontation + observatory gathering, three-way final branch, ending scenes |
| Variants | ~4 | Cross-case flag reactions + Occultist dining-room variant |

## B. Cast (`npcs.json`, 10 NPCs)

| NPC | Chair | Role |
|---|---|---|
| Colonel Aster | 8 | Client; dying anyway; quietly bought chair 11's debts the day before hiring the player — Act III sting if checked |
| Lady Wren Halloway | widow of 3 | Has read her husband's observation diary; inherits his stake; looks prescient, is innocent |
| Mr. Pettifer Sloane | 11 | Debt-ridden; hired the killing of chair 5 through a Court of Smoke moneylender |
| Dr. Ost | 9 | Recomputed the 1882 object's period; stopped sleeping on nights it is overhead |
| Mr. Corven | 4 | The skipped chair — never looked in 1882; doesn't know why he's alive, and drinks about it |
| Sir Julius Pemberton-Rhee | 6 | Next in the order; food-tasters; has rewritten his will twice |
| The Reverend Dr. Millbank | 7 | Society chaplain-astronomer; believes it is judgment; heard chair 2's last confession |
| Mr. Featherstonehaugh | 10 | Youngest member; Rationalists Circle; lobbying to destroy the 1882 log |
| Briggs | — | Observatory caretaker; oils a telescope no one may use; loyal to the dome, not the men |
| "Mr. Weir" | — | The Court moneylender's agent — the hands of the one true murder; rooftop pursuit target |

Core suspect web: Sloane (means via moneylender, motive via debt — guilty of chair 5 only) ·
Weir (hands, not brain) · Lady Halloway (inherits; diary makes her look prescient) · Briggs
(access to everything) · Aster himself (the debt-purchase sting).

**Factions:** Court of Smoke (moneylender thread), Rationalists Circle (Featherstonehaugh +
log-destruction pressure), Lamplighters (chair 2 was their consulting astronomer). Grey Dawn
absent by design.

## C. Clues (~16, `clues.json`)

| id | Type | Discovery | Content |
|---|---|---|---|
| `cc-seating-chart` | physical | automatic (Act I dinner) | Founding wager's seating chart, deaths annotated |
| `cc-death-dates` | physical | automatic (Act I dinner) | Three dates in five weeks — interval shrinking |
| `cc-founding-wager` | testimony | dialogue (Aster) | The tontine: survivor inherits the Hampstead observatory and what the dome conceals |
| `cc-sash-weights` | physical | exploration (chair 5's house) | The "fall": sash weights recently moved — genuine murder evidence |
| `cc-sloane-debts` | physical | check (Reason) **or** bought via Weir/Court thread | Sloane's ledger: ruinous debts to a Court moneylender |
| `cc-weir-instructions` | testimony | dialogue after rooftop pursuit **or** Mesmerist exclusive | Weir was paid for one death only, staged to fit the pattern |
| `cc-quack-tonic` | **redHerring** | exploration (chair 2's rooms) | "Poisoned" tonic — self-administered quackery; natural death |
| `cc-halloway-diary` | testimony | dialogue (Halloway, disposition-gated) | Chair 3 slept in daylight, spoke of "his number coming round" |
| `cc-corven-absence` | testimony | dialogue (Corven, drunk) | Called from the eyepiece in 1882; never looked — the skip, explained |
| `cc-1882-log` | physical | exploration (observatory) | The private observation log — one page razored out |
| `cc-razored-page` | occult | check (Lore **or** Perception; Composure cost) | The recovered page: the occulting object sketched as an angular mark |
| `cc-ost-period` | occult | dialogue (Ost's exclusive scene) | The object is periodic; the next perihelion is near |
| `cc-briggs-nights` | testimony | dialogue (Briggs) | The dome is "worked" on nights no one enters |
| `cc-dome-warmth` | occult | check (Nerve, dome annex at night) | The great refractor is warm on Ost's marked nights |
| `cc-founder-death` | physical | exploration (RAS library) | Chair 1's 1885 obituary — "of age"; the date fits the first collection |
| `cc-aster-purchase` | physical | check (Influence at solicitors, optional) | Aster bought chair 11's debts the day before hiring the player |

Every deduction-critical clue has two discovery routes (no-single-faculty rule).

## D. Key deductions (`deductions.json`)

1. **`cc-one-true-murder`** ← `cc-sash-weights` + `cc-sloane-debts` (optional
   `cc-corven-absence` strengthens): exactly one death is human work; the murderer's mimicry
   can't explain the chair-4 skip. Unlocks the on-your-terms murderer confrontation.
2. **`cc-numbered-tickets`** ← `cc-halloway-diary` + `cc-corven-absence` +
   `cc-seating-chart`: the pattern follows who looked, in eyepiece order; it predates the
   murderer, who hides inside it.
3. **`cc-the-return`** ← `cc-razored-page` + `cc-ost-period`: what they saw is periodic and
   the deaths are its approach. Gates the full eyepiece option in Act III; sets
   `mythos-period-computed`.

## E. Red-herring path

`cc-quack-tonic` connects plausibly to `cc-sloane-debts` on the evidence board → a
coherent-but-wrong all-human theory (a poisoner working the whole chart); `buildDeduction`
auto-flags it `isRedHerring`. Confronting on that theory in Act III lets the real murderer
walk, forfeits the pattern layer, and produces the failure ending. The tonic dissolves under
`cc-one-true-murder` (self-administration confirmed via Millbank's deathbed-confession
testimony).

## F. Act III — Perihelion Night

Two movements.

**1. Murderer confrontation.** With `cc-one-true-murder`: staged on the player's terms
(Sloane unmasked, Weir's testimony in hand). Without it: happens on the pattern's timetable at
disadvantage. On the red-herring theory: collapses. Sloane's defence is the moral hinge —
*"I stole from a fire."*

**2. The gathering at Hampstead.** Three-way final branch:

1. **Disperse the club** — expose the murder, seal the 1882 log with the Lamplighters,
   scatter the survivors. The pattern continues, unobserved.
2. **Observe Aster at the eyepiece** — he looks deliberately; Nerve check to watch; deepest
   knowledge at heavy Composure cost.
3. **Take the eyepiece yourself** — full version gated on `cc-the-return`; a degraded,
   near-suicidal version exists without it (alternate-path rule). Sets `cc-took-the-eyepiece`.

## G. Endings & flags

- **Best** (murderer unmasked + `cc-the-return`, club dispersed): the player alone keeps
  Ost's date. Sets `cc-club-dispersed`, `mythos-period-computed`.
- **Compromised** (murderer unmasked, pattern unexplained — or Aster looks): survivors
  scatter; deaths continue offstage at their shrinking interval.
- **Failure** (red-herring confrontation or halt): the tontine theory collapses, the club
  closes ranks; Briggs's final letter mentions the pattern now has *ten* chairs.

**Persistent flags:** `cc-club-dispersed`, `cc-took-the-eyepiece`, `mythos-period-computed`
(breadcrumb for the future Orrery Room keystone — inert until that vignette exists).

**Reputation:** Court of Smoke ±2 via the Weir/moneylender handling; Rationalists ± via the
Featherstonehaugh log-destruction resolution; Lamplighters +1 if the log is sealed with them.

## H. Encounters, archetype exclusives, cross-case variants

- **Encounters (2):** mundane rooftop pursuit of Weir (Vigor/Perception, multi-round);
  supernatural manifestation in the dome annex on a marked night (Nerve/Lore dual-axis — the
  telescope is warm).
- **Archetype exclusives (one full scene each):** Deductionist — the one-true-murder
  reconstruction set-piece at chair 5's house; Occultist — Veil Sight in the dining room shows
  which chairs are "punched"; Mesmerist — breaking Weir under club courtesy without the
  pursuit; Operator — the dome annex's sealed hatch by night.
- **Cross-case variants:** `wc-court-deal-made` → the moneylender sells Sloane out cheap;
  a Mayfair Séance completion flag → Lady Halloway texture variant (one scene; verify the
  actual flag id in that case's content during implementation — drop the variant if no such
  flag exists).

## I. meta.json

- **Synopsis:** "The twelve gentleman-astronomers of the Aldebaran Society are dying in the
  order they once sat to observe the comet of 1882. Three deaths in five weeks, each natural
  on its face. The eighth chair wants a detective at the table — which puts you in the
  seating order too."
- **facultyDistribution:** `{ "reason": 6, "influence": 5, "perception": 5, "lore": 4,
  "nerve": 4, "vigor": 4 }`
- `firstScene` set explicitly (the club dinner). Halt scenes injected from `shared/` as with
  all cases.

## Constraints & acceptance

- All authoring rules in `docs/content-authoring.md` apply: Condition/Effect only, no
  single-faculty critical gates, meaningful branching, referential integrity, measured tone.
- `node scripts/validateCase.mjs public/content/cases/the-comet-club` passes with no errors;
  unreachable-scene / undiscoverable-clue warnings resolved or justified.
- `manifest.json` gains the case entry; `docs/status.md` inventory updated at checkpoint.
- Content-integrity review (the `content-integrity-reviewer` subagent / `/review-content`)
  runs after authoring, plus the Codex adversarial gates per CLAUDE.md.
