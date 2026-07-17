# Codex plan review — Phase 5: Choice-Gating Content Model (implementation plan)

You are an independent adversarial reviewer from a different model provider, with **no** conversation
memory. This prompt is self-contained. Your job: find the real defect in an implementation plan before
an engineer executes it task-by-task.

## The work

Gaslight & Grimoire (React 19 + Zustand + Immer; JSON content under `public/content/`, pure engine
under `src/engine/`). Choices can be gated by `requiresClue`/`requiresDeduction`/`requiresFlag`/
`requiresFaculty`; today an unmet gate **hard-hides** the choice. Phase 5 adds a `visibility`
(`shown`|`hidden`|`disabled`) + `gateReason` vocabulary so a gated choice can instead be shown
**disabled-with-a-reason**, backward-compatible with 8 shipped cases. It extracts a shared pure resolver
`choiceVisibility.ts` (replacing two duplicated gate-builders), adds validator rules, renders disabled
choices via a new `LockedChoice` component, and converts one shipped choice as a demo.

## What to review

- **The plan:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md` — read in full. It has 9 TDD
  tasks with exact code.
- **The spec it implements:** `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md` — read
  it to check the plan is **faithful** (does every spec section map to a task? any drift?). The spec
  already absorbed a prior Codex review (its §12 lists 7 folded findings — verify the plan honours them).

## Ground every claim against the REAL code (read these)

- `src/types/index.ts` — the `Choice` interface (~line 203) and the `Condition` union (~line 152). Check
  T1's fields and that the conditions T2 builds (`hasClue`/`hasDeduction`/`hasFlag`/`facultyMin`) match
  the union tags/shapes exactly.
- `src/engine/conditions.ts` — `evaluateConditions` (returns `true` on `[]`). Confirm T2's import path
  `./conditions` is right and no barrel cycle is introduced.
- `src/engine/narrativeEngine.ts` — the barrel (re-exports 4 modules). T2 adds `choiceVisibility`.
- `src/components/ChoicePanel/ChoicePanel.tsx` — current `isChoiceVisible` + `.filter` render. Check
  T5's rewrite preserves the memoised `revealedClueIds`/`deductionIds`, the `handleSelect` deps, and the
  `computeAdvantage`/`checkAutoSucceeds` calls. Does T5 keep the `useMemo`/`React.memo` performance
  contract (F-045) intact?
- `src/components/ChoicePanel/index.ts` — the stale `isChoiceVisible` re-export T5 removes.
- `src/engine/encounters.ts` — `getEncounterChoices` (~line 185) + the `isEscapePath` special-case.
  Check T6's rewrite preserves escape behaviour EXACTLY (escape included only when its gate is met, never
  disabled) and that `evaluateConditions` is already imported (it is, line 17).
- `src/components/EncounterPanel/EncounterPanel.tsx` — the render (~line 146). T6 partitions into
  shown/locked. Note it calls `resolveChoiceVisibility` twice per choice in the plan's snippet — flag if
  that's a correctness or clarity problem.
- `src/engine/contentValidation.ts` — `Ctx` (~line 44 + line 320 has only `errors`), the ctx build
  (~line 100), `validateChoice` (~line 353), and how `warnings` is owned by `validateBundle` (~line 85)
  and returned. Check T3's `Ctx.warnings` plumbing is complete and that the new rules are inserted at a
  valid point (before the `worseAlternative` recursion — note the recursion means rules also run on
  nested worseAlternative choices; is that correct or a problem?).
- `scripts/validateCase.ts` — confirm it prints returned warnings without failing (so rule 6 warning
  won't break CI).
- `src/components/shared/index.ts` + `CheckOddsTag.tsx` — the barrel + component style T4's
  `LockedChoice` should match.

## Project constraints (must hold)

- **Backward-compatibility is non-negotiable:** absent `visibility` behaves EXACTLY like today. The
  `requiresFlag: ''` compat case (truthy-only gate building) must stay ungated/shown.
- Pure, RNG-free engine; strict store/engine separation (engine must not import the store or React).
- TDD: every task writes a failing test first, runs it to confirm RED, then implements. Check the tests
  actually FAIL for the right reason and PASS only when the behaviour is correct (no vacuous GREEN).
- The validator is a CI gate: a new error must fail the build; the soft-gate warning must NOT.
- Tone: `gateReason` prose is measured/diegetic, never mechanical.

## Your adversarial charge

**Assume this plan contains at least one real defect** the spec review didn't catch — a task that won't
compile, a test that passes vacuously or tests the wrong thing, a step that breaks an existing invariant
(memoisation, escape-path, save/migration, the F-045 render contract), a fidelity gap where the plan
silently diverges from the spec, an ordering hazard (a task depending on something built later), or a
false-GREEN. **Find it.** Specifically probe:

1. **Compile/type reality:** do T1's field type, T2's `Condition[]` construction, T3's imports (does
   `contentValidation.ts` importing `choiceVisibility.ts` create a cycle, given the barrel re-exports
   both?), T4's props, and T5/T6's JSX actually type-check against the real signatures?
2. **TDD integrity:** for each task, will the Step-2 "verify it fails" genuinely fail for the stated
   reason? Are any assertions vacuous (e.g. the ChoicePanel test harness — does the plan give it a real
   store/case so `missing-clue` is genuinely unmet)? The plan hand-waves the ChoicePanel test setup
   ("reuse that harness") — is that a real gap?
3. **Validator rules:** are the 5 errors + 1 warning inserted correctly and mutually exclusive where
   intended (escape-path branch vs. derived rules)? Does the `worseAlternative` recursion cause the new
   rules to fire on nested choices in a way the tests don't cover or that's wrong?
4. **Backward-compat:** does anything in T5/T6 change behaviour for an existing (no-`visibility`) choice?
   Does the `<section>`-wrapping-`<nav>` change break any existing ChoicePanel test that queries the
   `nav` landmark directly?
5. **Encounter fidelity:** does T6 reproduce the escape-path rule byte-for-byte? Any state where old
   `getEncounterChoices` and new diverge for a non-visibility choice?
6. **Spec fidelity:** anything the spec requires (its §12 folded findings especially) that no task
   implements, or implements differently.
7. **Anything an engineer following the plan literally would get wrong.**

Cite `file:line` and the plan task/step. Rank by severity (Blocker / Major / Minor). You may run
build/tests if your sandbox allows (read-only reasoning is fine). Don't manufacture defects — but do
state what you verified.

## Output

Write your review to `codex/output/2026-07-17-phase5-choice-gating-plan-review.md`: a one-line verdict,
findings ranked by severity (each with location, concrete failure, suggested fix), then what the plan
got right that's worth keeping.
