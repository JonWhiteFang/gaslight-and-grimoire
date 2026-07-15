# Codex review — Phase 2 deduction-feedback SPEC (adversarial)

## Operating rules (read first)

- You have **no memory** of prior conversations. Everything you need is in this file or in the repo
  files it names. You are running in this repository with a **read-only** sandbox.
- **Make no repository changes except writing exactly one file:** your review to
  `codex/output/2026-07-14-phase2-deduction-feedback-review.md`. Do not edit code, specs, or anything else.
- This is a **SPEC review** (checkpoint (a) of the file-based Codex handoff — see `codex/README.md` and
  `CLAUDE.md` §"Cross-provider review with Codex"). Review the *design*, not an implementation — no code
  has been written yet.

## The charge

**Assume the spec contains at least one real defect and find it.** Specifically hunt for: a correctness
hole in the classification logic, an unimplementable or self-contradictory claim, a determinism or
id-collision hazard, a place the spec diverges from or fails to enact the ADR it claims to enact, a
missed edge case in the state machine, or a dangerous ambiguity that would let two implementers build
different things. Ground every finding in the actual repo code named below (cite `file:line`). If you
believe the spec is sound, say so, but only after a genuine attempt to break it. Rank findings by
severity (Blocker / Major / Minor / Nit).

## Goal of the work

UI/UX roadmap **Phase 2 — deduction feedback legibility**. It enacts **ADR-0012**
(`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md`), which decided: *correctness* gates whether a
connected clue-set forms a deduction; the Reason d20 roll no longer gatekeeps correct reasoning — it only
*flavours* a successful outcome. ADR-0012 explicitly **deferred two things to this Phase 2 spec**: (1)
what "correct" means for a **generic** (non-recipe) connection, and (2) the tier→feedback mapping. The
spec must resolve both without contradicting the ADR.

## What to review

**The spec:** `docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md` — read it in full.

**Ground it against these files (read them):**
- `src/components/EvidenceBoard/DeductionButton.tsx` — current deduction flow (to be rewritten)
- `src/engine/buildDeduction.ts` — `matchDeduction` (subset match), `buildDeduction`, `buildDeductionFromRecipe`
- `src/components/EvidenceBoard/ClueCard.tsx` — the six clue states + `StatusIndicator` (the `connected` colour-only fix)
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — `handleInitiateConnection` (sets `connected`), `handleDeductionResult`, `connectedIds`
- `src/announcer.ts` — the Phase-1 `announce()` API the spec consumes
- `src/types/index.ts` — `Clue` (has `tags: string[]`, `type` incl. `'redHerring'`), `Deduction`, `KeyDeduction`, `ClueStatus`
- `docs/DECISIONS/ADR-0012-deduction-roll-semantics.md` — the decision + its **Confirmation** clause

## Key facts (confirm, don't trust blindly)

1. Today `DeductionButton.handleAttempt` rolls `performCheck('reason', investigator, 14, false, false)`
   and forms a deduction only on `tier === 'success' || 'critical'`; else marks clues `contested`,
   reverting to `examined` after 2000ms. `connectedClueIds.length < 2` returns null (so the classifier is
   never called with <2 ids).
2. `matchDeduction(connectedIds, recipes)` returns the first recipe whose `requiredClues` are **all**
   present in the connected set (subset match; extra connected clues allowed).
3. A **key** deduction is stored under the recipe's stable `id` — `hasDeduction`/`requiresDeduction`
   content gates depend on these ids. A **generic** deduction gets a random id
   (`deduction-${Date.now()}-${Math.random()...}`) and nothing gates on it.
4. `announce(message, {assertive?})` writes to a global live region; empty/blank is ignored; polite by
   default. Phase 2 is its first component consumer.

## The spec's core decisions (verify these are sound + internally consistent)

- New pure `src/engine/classifyConnection.ts` → `{ correctness: 'correct'|'partial'|'incorrect', recipe }`.
  Rules in order: recipe subset-match → `correct`; else compute `hasRedHerring`, `allShareATag` (a tag on
  **every** connected clue), `someShareATag` (a tag shared by **≥2**); `correct` = allShareATag &&
  !hasRedHerring; `partial` = (!hasRedHerring && someShareATag && !allShareATag) OR (hasRedHerring &&
  someShareATag); `incorrect` = otherwise. Pure, no roll/store/Date.now/Math.random.
- `DeductionButton`: classify **first**; on `correct` roll the d20 **only** to pick a flavour word
  (`critical` → sharper line), form the deduction (recipe or generic), mark `deduced`, `announce()` once;
  on `partial`/`incorrect` **don't roll at all**, mark `contested`, `announce()`, revert after 2s.
- The local `<m.p>` message loses its `aria-live` (becomes visual-only) so `announce()` is the single SR
  announcement (avoid double-speak). Three-way colour: green/amber/red.
- `partial` and `incorrect` both reuse the existing `contested` clue status (no new `ClueStatus`, no save
  migration).
- `ClueCard`: add a `🔗` badge for `connected` (redundant non-colour cue, WCAG 1.4.1).
- ADR-0012 promoted `Accepted`→`Enacted`; Confirmation test = recipe set forms `correct` regardless of
  roll, non-qualifying set never `correct`.

## Specific things worth attacking (non-exhaustive — find others)

- Does the two-branch `partial` definition ever misclassify? Consider: a 2-clue set (where
  `someShareATag` ≡ `allShareATag`), a red-herring clue that *also* shares a tag with the others, a set
  where the only shared tag is contributed solely by the red herring, clues whose ids aren't in the
  `clues` record, empty `tags` arrays.
- Is "the roll is only rolled on `correct`" actually consistent with ADR-0012, which also says the roll
  "feeds the Phase 2 partial-tier directional feedback"? Is that a contradiction the spec silently drops?
- Does removing `aria-live` from the local `<p>` while adding `announce()` actually yield exactly one
  announcement, given the Phase-1 announcer's two-slot re-announce behaviour and that identical
  consecutive messages may be involved?
- Does anything downstream rely on generic deductions still forming for non-tag-sharing sets (search for
  `hasDeduction`, `requiresDeduction`, `deductions[`)? The spec claims nothing gates on generic
  deductions — verify.
- Determinism/collision: generic `buildDeduction` still uses `Date.now()`/`Math.random()` for its id — is
  that in scope, and does the spec's Confirmation test avoid depending on it?
- Any WCAG or a11y claim that's overstated or wrong.

## Output

Write your review to `codex/output/2026-07-14-phase2-deduction-feedback-review.md`:
a ranked findings list (Blocker/Major/Minor/Nit), each with the `file:line` grounding and a concrete
fix or the precise ambiguity to resolve; then a one-line overall verdict (sound to plan / revise first).
