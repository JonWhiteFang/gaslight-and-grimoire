# Codex review — Phase 2a implementation PLAN (adversarial)

## Operating rules (read first)

- You have **no memory** of prior reviews. Everything is in this file or the repo files it names.
  Read-only sandbox.
- **Make no repository changes except writing exactly one file:** your review to
  `codex/output/2026-07-15-phase2a-deduction-legibility-plan-review.md`. Nothing else.
- This is a **PLAN review** (checkpoint (b) of the file-based Codex handoff — see `codex/README.md`,
  `CLAUDE.md` §"Cross-provider review with Codex"). Review the *implementation plan*, not a finished
  implementation. No code has been written yet.

## Context: three prior spec rounds → a scope split

The Phase 2 **spec** went through three Codex review rounds; each found a real Blocker, the last (N1)
rooted in pre-existing board plumbing (connecting two clues overwrites their status to `connected` before
any attempt). The resolution was to **split**: ship a safe **2a** legibility slice now with **today's
deduction formation unchanged**, and defer the whole correctness-oracle + status-lifecycle rework to
**2b** (its own spec). **This plan is 2a only.** Do not re-litigate the deferred 2b model; instead verify
that 2a genuinely avoids touching formation/status semantics and is internally correct.

## The charge

**Assume the plan contains at least one real defect and find it.** Focus on plan-specific hazards:
- a step whose code won't compile or won't do what the prose claims;
- a wrong assumption about the current code (a symbol/line/behaviour that isn't as the plan states);
- an ordering hazard (a step depends on something a later step introduces);
- a test that would pass while asserting nothing, or fail for the wrong reason, or false-green;
- **scope leakage** — any step that in fact changes *what forms a deduction* or *how clue status is
  written*, despite the plan claiming 2a doesn't;
- an accessibility regression (double-announce, or losing the message).
Ground every finding in actual repo code (`file:line`). Rank findings (Blocker/Major/Minor/Nit). End with
a one-line verdict: **sound to implement** / **revise first**.

## What to review

**The plan:** `docs/superpowers/plans/2026-07-15-phase2a-deduction-legibility.md` (read fully).
**The spec (Part A only):** `docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md`.

**Ground against the current code the plan modifies:**
- `src/components/EvidenceBoard/ClueCard.tsx` — `StatusIndicator` switch; the six-state doc-comment.
- `src/components/EvidenceBoard/DeductionButton.tsx` — `handleAttempt` (roll, formation, status writes),
  the `onResult` prop, the trailing `<AnimatePresence>` `<m.p>` label, `lastTier`/`tierLabel`,
  `AnimatePresence` import.
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — `handleDeductionResult`, the header-bar JSX where
  `DeductionButton` is rendered, the existing `useState`/`useEffect`/`useRef` usage, `connections`.
- `src/announcer.ts` — `announce(message, {assertive?})` (the Phase-1 API the plan calls).
- `src/components/__tests__/{ClueCard,EvidenceBoard}.test.tsx` — the existing test patterns/fixtures the
  plan extends (note the store `initStore` helper and the `vi.mock('../../engine/diceEngine', ...)` mock).

## Key facts the plan asserts (verify — they are load-bearing)

1. `DeductionButton` returns `null` when `connectedClueIds.length < 2`, and its local `<m.p>` outcome label
   has `aria-live="polite"`. On success it marks connected clues `deduced`; on failure `contested` →
   `examined` after 2s. **The plan keeps all this; it only removes the `<m.p>` and passes `tier` up.**
   Confirm the plan's Task 2 edits don't accidentally alter the roll/formation/status writes.
2. `EvidenceBoard` is mounted (via `App`) only while the board is open, but it does **not** unmount when
   `clearConnections()` runs — so a board-owned banner survives connection clearing (the fix for the
   button losing its message). Confirm this holds.
3. `performCheck` is synchronous and its result has `.tier` ∈ {critical, success, partial, failure,
   fumble}. The plan maps success→(critical|other) and failure→(partial|other) to four messages. Confirm
   the mapping covers `fumble` (should fall through to the plain-failure message) and that a `partial`
   tier is a **failure** today (does not form) — i.e. the "amber directional" message must NOT imply a
   deduction formed.
4. `announce()` ignores empty strings and re-announces identical text via a two-slot flip; the plan makes
   the banner `aria-hidden` and removes the button's `aria-live`, so `announce()` is the single SR path.
   Confirm there is exactly one announcement per attempt and no other live region duplicates it.

## Specific things worth attacking (non-exhaustive)

- **Task 2 vs Task 3 ordering:** Task 2 changes `onResult` to `(result, tier)` and commits; Task 3's tests
  and handler consume the new arity. Between those commits, is the tree in a broken/uncompilable state
  (the board still calls the 1-arg handler)? Is that acceptable for the commit granularity, or should the
  signature + handler change atomically?
- **Test correctness:** the Task 3 tests `vi.mock('../../announcer', () => ({ announce: vi.fn() }))` and
  spy on it. But the existing `EvidenceBoard.test.tsx` already mocks `diceEngine`. Does adding an announcer
  mock interfere with any existing test in that file? Does the `initStore` helper set everything the new
  tests need (e.g. is `caseData` needed for `DeductionButton`'s `recipes` selector, given the button forms
  a generic deduction when no recipe matches)? Will `screen.getByRole('button', { name: /Attempt
  Deduction/i })` actually match after the label change, and is there more than one matching button?
- **`connectedIds` in the board:** the plan renders `DeductionButton connectedClueIds={connectedIds}`;
  `connectedIds` is derived from `storeConnections`. In the tests the store is seeded with a connection
  pair AND the clue statuses are `connected`. Confirm the button actually renders (≥2 ids) and the click
  path reaches `handleDeductionResult` with the mocked tier.
- **Does removing the `<m.p>` leave `phase`/`idsRef` correct?** After the outcome label is gone, the button
  still uses `phase` for its own text ('Deduction Locked' / 'Attempt Failed'). Confirm nothing dangling.
- **Banner timer + unmount:** the plan clears the banner timer on unmount but the failure path also sets a
  separate 1400ms slack timer with no cleanup (pre-existing). Is the new timer cleanup sufficient, or does
  it introduce a state-update-after-unmount warning path the tests would surface?
- **Doc claims:** the plan says 2a "does NOT enact ADR-0012". Confirm no step changes ADR-0012 status or
  the formation gate, so that claim is true.

## Output

Write to `codex/output/2026-07-15-phase2a-deduction-legibility-plan-review.md`: a ranked findings list
(Blocker/Major/Minor/Nit), each grounded in `file:line` with a concrete fix; then a one-line verdict
(sound to implement / revise first).
