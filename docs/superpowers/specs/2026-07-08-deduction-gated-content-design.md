# Design — Deduction-Gated Content (Issue #6)

_Date: 2026-07-08 · Status: approved (brainstorm), pending spec review · Author: session (Magikarp/Jon White)_

## Problem

The deduction system is the game's headline mechanic (Holmes-style "connect the clues, reach
the conclusion"), but it is **decorative**: nothing in content gates on a deduction being made.
Two joined defects:

1. **No stable deduction identity.** `buildDeduction` stores every deduction under a random id
   (`deduction-{Date.now()}-{random}`). The `hasDeduction` condition matches on
   `state.deductions[target]`. So an authored gate `requiresDeduction: "x"` can **never** match —
   there is no stable name to point at.
2. **No content uses the gate.** `grep -rn "hasDeduction\|requiresDeduction" public/content/` → 0 hits.
   The plumbing (`Choice.requiresDeduction` type, `isChoiceVisible`, the encounter choice filter, and
   the `hasDeduction` condition eval) already exists and is correct — it is simply never exercised.

Fixing #6 = give deductions a stable, authorable identity **and** author content that pays it off.

## Decisions (from brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | How a gate-able deduction is identified | **Named clue-set recipes** — author defines a `KeyDeduction` (stable id + exact clue set); connecting that set stores the deduction under the authored id. |
| 2 | What the key deduction unlocks | **The true resolution** — gates the best/true ending only. Existing endings stay reachable, so the case is always completable (respects "no single gate on critical progress"). |
| 3 | Scope | **One key deduction per main case** (3 total). Vignettes untouched (too thin: 2 acts, 4–5 clues). |
| 4 | How connected clues match a recipe | **Subset match** — recipe's clues ⊆ connected web. Extra connected clues are fine. Robust against the shared-web UI; rewards finding the right thread among noise. |

Every question was answered with Magikarp's recommended option (per the standing "recommend + why"
preference). Rationale for each is in the brainstorm transcript; summarized inline above.

## Architecture

### New content type — `KeyDeduction`

Authored per case in a new `deductions.json` beside `clues.json`:

```jsonc
{
  "id": "wc-deduction-harland-mastermind",   // stable, authorable id
  "requiredClues": ["wc-clue-cipher-note", "wc-clue-aldgate-letters", "wc-clue-harland-memo"],
  "title": "The Hand Behind the Cipher",
  "description": "Harland's suppression order, the cipher trail, and Aldgate's letters name the true architect — Aldgate is only the instrument.",
  "isRedHerring": false
}
```

- Add `KeyDeduction` interface to `src/types/index.ts`.
- `deductions.json` shape mirrors `clues.json`: `{ "deductions": KeyDeduction[] }`.

### Engine — pure matcher + recipe-aware storage

- **New pure function** `matchDeduction(connectedIds: string[], recipes: KeyDeduction[]): KeyDeduction | null`
  (in `buildDeduction.ts` or a sibling). Subset semantics: returns the first recipe whose
  `requiredClues` are all present in `connectedIds`; `null` otherwise. No store access → unit-testable.
- **`addDeduction` path** (via `DeductionButton`): after a successful Reason check, run `matchDeduction`
  against the case's recipes.
  - **Match** → store the deduction under the recipe's authored `id`, using its authored
    `title`/`description`, `isRedHerring` from the recipe. `hasDeduction` gates now resolve.
  - **No match** → current behavior unchanged (random-id generic deduction from `buildDeduction`).
- Recipes live on `caseData` (loaded with the case). The matcher receives them as a parameter — the
  engine stays free of store imports (ADR-0001).

### Loading

- `loadCase` fetches `deductions.json` and attaches `recipes` to `caseData` (mirror the `clues.json`
  fetch). Missing file / vignettes → empty recipe list; `matchDeduction` returns `null` gracefully.

### Validator (`contentValidation.ts`)

New rules:
- every `KeyDeduction.requiredClues` id must exist in the case's clues;
- every `requiresDeduction` (choice) and `hasDeduction` (condition) `target` in scenes/choices/variants
  must reference a defined recipe id in that case.

This closes the "gate points at nothing" failure class statically.

### Unchanged (already correct)

- `Choice.requiresDeduction` type (`src/types/index.ts`).
- `isChoiceVisible` (`ChoicePanel.tsx`) — already maps `requiresDeduction` → `hasDeduction`.
- Encounter choice filter (`narrativeEngine.ts`) — same mapping.
- `evaluateCondition` `hasDeduction` case — matches on `state.deductions[target]`.

## Content — the three key deductions

Each recipe mixes clue **types** (never single-faculty-gated) and excludes red herrings. Each true
ending is **additive** — no existing path removed, so no soft-lock. The gated true-accusation choice
is **invisible** until the recipe is made (existing `isChoiceVisible` behavior).

### 1. The Whitechapel Cipher — "The Hand Behind the Cipher"

- **Recipe id:** `wc-deduction-harland-mastermind`
- **Clues:** `wc-clue-cipher-note` (physical) + `wc-clue-aldgate-letters` (physical) + `wc-clue-harland-memo` (testimony)
- **Reveals:** Aldgate is the instrument; Harland's suppression order names the architect, reaching to the Deputy Commissioner.
- **Gated choice:** in `wc-act3-the-reckoning` — name Harland, not just Aldgate. `faculty: reason`,
  `advantageIf: [wc-clue-harland-memo]`.
- **New true ending:** `wc-act3-ending-true-exposure` — the cover-up broken at the top, not just the pawn caught.
- **Without it:** the four current endings stand (Aldgate resolved; the rot at the top survives).

### 2. The Mayfair Séance — "The Fraud That Woke Something Real"

- **Recipe id:** `ms-deduction-fraud-and-breach`
- **Clues:** `ms-clue-hidden-mechanism` (physical) + `ms-clue-vesper-journal` (occult) + `ms-clue-grey-dawn-sigil` (occult)
- **Reveals:** dual truth — the séance was staged fraud (mechanism) **and** the fake ritual
  accidentally drew a genuine presence (journal + sigil).
- **Gated choice:** in `ms-act3-the-reckoning` — deliver the complete account (fraud + genuine breach together).
- **New true ending:** `ms-act3-ending-true-account` — the full, correct explanation named.
- **Without it:** `ms-act3-ending-exposure` names only the fraud, missing the supernatural cause.

### 3. The Lamplighter's Wake — "The Locked Room, Unlocked"

- **Recipe id:** `lw-deduction-croke-court-murder`
- **Clues:** `lw-clue-locked-room-key` (physical) + `lw-clue-poison-vial` (physical) +
  `lw-clue-court-manifest` (testimony) + `lw-clue-croke-testimony` (testimony)
- **Reveals:** Croke poisoned Marsh and used the missing key to stage the locked room, so the Court
  could bury the Veil-fragment trafficking.
- **Gated choice:** in `lw-act3-the-reckoning` — name Croke + the Court motive.
- **New true ending:** `lw-act3-ending-true-reckoning` — murder solved and the Court motive named.
- **Without it:** the current four endings resolve the breach but leave the murder officially unsolved.

## Content wiring (per case — 3 edits each)

1. New `deductions.json` with the one recipe.
2. Reckoning scene gains one `requiresDeduction`-gated choice → routes to the new true ending.
3. One new `*-ending-true-*` scene (the payoff narrative).

## Testing & verification

**Engine unit tests:**
- `matchDeduction`: exact set matches; superset matches (subset semantics); missing one clue → no
  match; empty recipes / empty set → `null` (vignette-safe); red-herring-inclusive set can't fabricate
  a match it doesn't satisfy.
- `addDeduction`: matching connection stores under the authored id with authored title/description;
  non-matching keeps random-id generic behavior.
- `evaluateCondition` `hasDeduction` resolves true against a recipe-stored deduction (regression guard).

**Validator tests:** recipe with unknown clue → error; `requiresDeduction`/`hasDeduction` target with
no matching recipe → error; the 3 real cases → clean.

**End-to-end (before claiming done):**
- `npm run test:run` green incl. new tests; `node scripts/validateCase.mjs` → 7 cases clean.
- **Playwright MCP** click-through on Whitechapel: (a) reach the reckoning without the deduction →
  true-accusation choice **absent**; (b) connect the recipe clues, pass the Reason check, return to the
  reckoning → true-accusation choice **present** and routes to the true ending.
- `content-integrity-reviewer` subagent pass on new/edited scenes (tone + design rules).

## Out of scope

- Vignette deduction gates (thin content; revisit as follow-up).
- Multiple deductions per case / deduction chains (follow-up once single-deduction pattern is proven).
- Dedicated per-recipe deduction UI (subset match on the shared web is sufficient).

## Compliance notes

- **CLAUDE.md content rules:** no single faculty gates critical progress (each true ending is
  additive, existing paths remain); red herrings excluded from recipes; deductions derived from linked
  clue ids (recipes are clue-id sets).
- **ADR-0001 (content↔engine separation):** matcher is pure, receives recipes as a parameter; engine
  keeps zero store imports.
