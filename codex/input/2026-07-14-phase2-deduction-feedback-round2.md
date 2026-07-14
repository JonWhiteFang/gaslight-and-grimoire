# Codex re-review (round 2) — Phase 2 deduction-feedback SPEC

## Operating rules (read first)

- You have **no memory** of the round-1 review. Everything is in this file or the repo files it names.
  You run read-only in this repository.
- **Make no repository changes except writing exactly one file:** your review to
  `codex/output/2026-07-14-phase2-deduction-feedback-round2-review.md`. Nothing else.
- This is **round 2** of a SPEC review. Round 1 returned "revise first" (3 Blockers, 4 Majors, 1 Minor);
  the spec was rewritten. Your job: (1) verify each round-1 finding is **genuinely resolved** (not just
  reworded), and (2) adversarially attack the **new** recipe-based model for fresh defects.

## The charge

**Assume the revised spec still contains at least one real defect and find it.** Then separately confirm
or reject each round-1 finding's resolution. Ground every claim in actual repo code (`file:line`). Rank
findings (Blocker / Major / Minor / Nit). End with a one-line verdict: **sound to plan** / **revise again**.

## What changed since round 1 (the pivot)

The original correctness oracle was **tag-overlap**. You proved it unsound. The rewrite **drops tags
entirely** and defines correctness by the **authored `KeyDeduction` recipes**:

- `classifyConnection(connectedIds, clues, recipes) → { correctness: 'correct'|'false'|'partial'|'incorrect', recipe }`
- **Fail-closed** first: `valid` = distinct ids that are an **own property** of `clues`; `< 2` → `incorrect`.
- **Full recipe match** (all of a recipe's `requiredClues` ⊆ valid): pick winner by **non-red-herring
  first → largest requiredClues → lowest id**. Non-herring winner → `correct`; herring winner → `false`
  (still **forms** its stable deduction, but framed "uneasy"/amber, keeping its gated branch reachable).
- **Partial**: no full match but ∃ recipe with `1 ≤ |req ∩ valid| < |req|` → `partial` (no formation).
- **Incorrect**: otherwise.
- **Generic (non-recipe) connections no longer form a deduction at all.**
- On `correct`/`false`, only the recipe's `requiredClues` are marked `deduced`; **extra** connected clues
  revert to `examined`.
- The **board** (`EvidenceBoard`), not the button, now owns the transient outcome banner + the
  `contested`→`examined` revert timer (fixes the unmount-destroys-message bug). Banner is **visual-only**;
  the single SR announcement is `announce()`.
- The roll flavours a **formed** deduction only (crit → sharper line); partial/incorrect roll nothing.
  ADR-0012 gets a dated **Amendment** note (its body is frozen) reconciling "roll drives partial feedback"
  → "partial is deterministic; roll flavours formation."

## Round-1 findings to verify as resolved (confirm each against the revised spec + code)

1. **B1 (tag oracle unsound):** is the recipe-based oracle actually free of the tag problem? Does anything
   in the spec still lean on tags?
2. **B2 (`cc-deduction-poisoner` is `isRedHerring:true` and gates `the-comet-club/act3.json:24`):** does
   the `false` state correctly keep this deduction forming under its stable id
   (`buildDeductionFromRecipe`, `src/engine/buildDeduction.ts:49`), so the gate stays reachable? Verify the
   recipe id and gate still exist as claimed (`public/content/cases/the-comet-club/deductions.json`,
   `act3.json`).
3. **B3 (clearConnections unmounts button → message lost; revert race):** does moving the banner + timer to
   the board actually fix it? Does the snapshot-`attemptedIds` + "only revert if still `contested`" guard
   close the race? Is there a success→idle path so a second deduction works
   (`src/components/EvidenceBoard/DeductionButton.tsx:84` was the stuck-locked spot)?
4. **Major (roll contract vs ADR-0012):** is the amendment approach sound, or does it still claim `Enacted`
   while contradicting the frozen Decision body
   (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:32`, `:41`, `:76`)?
5. **Major (subset noise + multi-match ordering):** does "non-herring → largest → lowest id" fully remove
   array-order dependence? Consider the real case: `cc-deduction-one-true-murder` (true) and
   `cc-deduction-poisoner` (herring) share `cc-clue-sloane-debts` — a set with **both** recipes' clues
   should deterministically yield the **true** one. Verify.
6. **Major (red-herring false partial):** now that partial is recipe-based not tag-based, is it gone?
7. **Major (unresolved-id fail-open):** does the own-property + distinct + `<2` guard fail closed? Recall
   save validation is shallow (`src/engine/saveManager.ts:62`) and load restores connections directly
   (`src/store/slices/metaSlice.ts:117`), so bad ids can reach the classifier.
8. **Minor (sync roll / "Rolling…" / label):** removed?

## Attack the NEW model for fresh defects (non-exhaustive)

- **Partial over-fires / masks nothing:** with the shipped recipes, is `partial` ever unreachable or
  always-on? E.g. connecting any 2 clues where one happens to be in *some* recipe → `partial` even if the
  player had no idea — is that the intended "you're close"? Could a single shared clue across many recipes
  make almost everything `partial`? Check `requiredClues` overlaps across a case's recipe set
  (`the-comet-club/deductions.json`: does `cc-clue-sloane-debts` appear in 2 recipes?).
- **`false`/`correct` both form under the same stable id path** — does marking only `requiredClues`
  `deduced` and reverting extras interact badly with a recipe whose required clues were connected across
  *multiple* separate connection edges? (The board tracks connections as ID pairs;
  `connectedIds` is the union.)
- **Does dropping generic formation break anything?** The spec claims nothing gates on generic deductions.
  Verify: are all `hasDeduction`/`requiresDeduction` targets authored recipe ids? (Note `deductionist`,
  `wc-deductionist-pattern`, `lw-deductionist-timeline` appear in content — check whether they are
  `hasDeduction` targets or something else (archetype/flag). Grep `requiresDeduction`, `hasDeduction`.)
- **`ProgressSummary` deduction count** and `CaseJournal` — do they assume generic deductions exist?
- **Announcer double-speak / silence:** banner visual-only + one `announce()` — but does `announce()`
  re-announce identical consecutive messages given the Phase-1 two-slot design (`src/announcer.ts`)? A
  player making the same wrong attempt twice: does the SR say it twice (desired) or go silent?
- **Determinism:** anything new introduce `Date.now()`/`Math.random()` on the classification path? (Generic
  `buildDeduction` id-gen is now unused for formation — confirm it's not on the recipe path.)

## Files to ground against

`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md` (the revised spec — read fully);
`src/engine/buildDeduction.ts`; `src/components/EvidenceBoard/{DeductionButton,EvidenceBoard,ClueCard,ProgressSummary}.tsx`;
`src/announcer.ts`; `src/types/index.ts`; `src/engine/conditions.ts` (the `ownValue` guard, line 29);
`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md`;
`public/content/cases/the-comet-club/{deductions.json,act3.json}`; and grep `public/content` for
`requiresDeduction`/`hasDeduction` targets.

## Output

Write to `codex/output/2026-07-14-phase2-deduction-feedback-round2-review.md`: (A) a per-round-1-finding
resolution table (Resolved / Partially / Not resolved, with grounding), (B) any **new** ranked findings,
(C) one-line verdict (sound to plan / revise again).
