# Codex review — Phase 2b implementation PLAN: deduction formation model

**You are an adversarial cross-provider reviewer.** You have **no** memory of prior conversation; this
prompt is fully self-contained. Read the grounding files, then review the target plan.

**Write your review to:** `codex/output/2026-07-16-phase2b-deduction-formation-plan-review.md`
(read-only sandbox is fine — reason from the code; do not modify anything).

---

## The project

Gaslight & Grimoire — a browser choose-your-own-adventure game (React 19, Zustand+Immer, TypeScript,
Vitest 4). On its **Evidence Board**, the player connects clues (click/tap two → a connection stored as
`{fromId,toId}`) and presses **Attempt Deduction**. Today that rolls a Reason d20 vs DC 14 and the roll
*gates* whether a deduction forms.

## What this plan implements

**Phase 2b enacts [ADR-0012](docs/DECISIONS/ADR-0012-deduction-roll-semantics.md):** correctness gates
deduction formation; the roll only *flavours* it. A qualifying connected clue-set **always** forms
(regardless of roll tier); a non-qualifying set **never** does. Along the way it fixes pre-existing
board-plumbing defects (a status-overwrite-on-connect, a stuck-`contested` revert bug, generic-deduction
id churn). The design is in the spec (already Codex-reviewed once — 5 findings folded in). **This review
targets the PLAN** — does it faithfully and safely implement the spec, in the right order, with correct
code and real tests?

## Target of review

- **Plan:** `docs/superpowers/plans/2026-07-16-phase2b-deduction-formation.md` (read in full).

## Grounding — read these; the plan makes verifiable claims about them

- `docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md` — the spec the plan implements
  (esp. §1 oracle, §2 status/revert/migration, §3 formation ownership + generic id, §4 tests; and the
  "Round 1 — 5 findings" list at the end — the plan must not reintroduce any).
- `docs/DECISIONS/ADR-0012-deduction-roll-semantics.md` — esp. the **Confirmation** section (the plan's
  Task 7 must land a test that satisfies it).
- `src/engine/buildDeduction.ts` — current generic id (`Date.now()+Math.random()`), `matchDeduction`,
  `buildDeductionFromRecipe`.
- `src/engine/diceEngine.ts` — `performCheck` signature + `CheckResult` (`tier`, `dc?`).
- `src/engine/saveManager.ts` — `CURRENT_SAVE_VERSION` (currently **4**) + the `migrate()` chain style
  (the plan adds a v4→v5 step — check it matches the existing step-by-step reassignment pattern and is
  idempotent / correct for a legacy save with no `version`).
- `src/engine/contentValidation.ts` — the `validateBundle` structure + the recipe/clue loops the plan
  extends (reserve `deduction-generic-`; clue-id charset).
- `src/store/slices/evidenceSlice.ts` — current `clues`/`connections`/`deductions` state + actions; the
  plan adds `contestedTokens`/`attemptSeq` + `contestClues`.
- `src/store/slices/narrativeSlice.ts` — `resetForNewCase` (~line 28-67); the plan clears the new state
  here.
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — `handleInitiateConnection` (writes `'connected'` at
  ~line 194-195), `handleDeductionResult` (the plan renames → `handleDeductionAttempt`), banner state.
- `src/components/EvidenceBoard/DeductionButton.tsx` — the plan strips formation from here (roll only).
- `src/components/EvidenceBoard/ClueCard.tsx` — the plan adds an `isConnected` prop and removes the
  `'connected'` status case.
- `src/types/index.ts` — `Clue`, `ClueStatus`, `ClueType` (`redHerring`), `Deduction`, `KeyDeduction`,
  `OutcomeTier`; the plan adds `DeductionCorrectness` + `ClassifiedComponent`.
- Content the oracle must satisfy: `public/content/cases/*/deductions.json` (7 recipes),
  `public/content/side-cases/*/` (no `deductions.json`), `public/content/*/*/clues.json` (`connectsTo`,
  `redHerring`, clue-id charset).

## Adversarial charge

**Assume the plan contains at least one real defect and find it.** The plan produces working, tested
software task-by-task — a defect is anything that would make a task's code wrong, its test a false-green,
its ordering unbuildable, or its result diverge from the spec/ADR-0012. Prioritise:

- **The store-owned revert + token ownership (Task 4) — highest-risk.** Trace the `contestClues` code and
  the fake-timer tests concretely:
  - Does the `setTimeout` closure reading live state via `set()` actually restore the *prior* status, and
    only when `contestedTokens[id] === gen`?
  - The plan says a *success* must "claim" a clue (bump its token) before setting `deduced` so a stale
    revert can't clobber it — but Task 4's `contestClues` sets the token, and Task 7's formation loop calls
    `updateClueStatus(id, 'deduced')`, which as written **does not** bump the token. Is the claim actually
    implemented anywhere, or is it only described in prose? If the token isn't bumped on success, does the
    fail→success overlap test actually pass, or is it a false-green / will the stale timer still clobber
    `deduced`? This is the exact Blocker-2 failure mode — verify the plan truly closes it.
  - Immer + `setTimeout(() => set(...))`: is mutating `s.clues[id].status` inside a nested `set` sound
    here? Any stale-draft or double-`set` hazard?
  - Does anything cancel/track the timer, or can timers leak across many attempts (test isolation, or a
    real leak)?
- **Oracle correctness (Task 1).** Does the union-find + component code actually produce the classifications
  the tests assert? Check the generic path's `internal`/`authored` edge counting for a component with a
  mix of authored and unauthored player-edges. Does `correctness = ordered.some(!isRedHerring)` match the
  spec (a component matching both a real and a red-herring recipe is `correct`)? Any component the code
  misclassifies vs the spec?
- **Formation integration (Task 7).** Does the loop form **every** recipe in `comp.recipes` (Blocker 1),
  and a generic deduction only when `recipes` is empty? Does the empty-components guard (Minor 5) fire
  before any formation? Is `announce()` called exactly once per attempt (the 2a invariant), or can a
  multi-component attempt announce twice? Does clearing one component's connections corrupt another's
  prior-status snapshot (snapshots are taken before any mutation)?
- **Migration (Task 5).** Is the v4→v5 step correct for a save with `version` absent/NaN (does it still run
  through the earlier steps)? Does it correctly restore `connected`→`deduced` only when a persisted
  deduction references the clue? Idempotent if run twice?
- **Validator (Task 3) / false-greens.** Do the new rules error on the described inputs without breaking
  the 8 shipped cases? Are any of the plan's tests asserting a tautology, mocking away the thing under
  test, or checking a copy of logic rather than the real unit?
- **Spec fidelity.** Anywhere the plan silently diverges from the spec or reintroduces one of the 5
  already-fixed findings.

## Output format

For each finding: **severity** (Blocker / Major / Minor / Nit), a one-line summary, the **plan
section/task + file:line** it grounds in, the concrete failure scenario (inputs → wrong outcome or
false-green), and a suggested fix. If you find no Blocker, say so explicitly and give your next-most-serious
finding. End with a one-line verdict: is the plan sound to implement as written?
