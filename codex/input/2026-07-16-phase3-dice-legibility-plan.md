# Codex plan review — Phase 3: Dice / Probability Legibility (Gaslight & Grimoire)

You are an adversarial cross-provider reviewer with **no** conversation memory. This prompt is fully
self-contained. Ground every claim in the referenced repo files — do not rely on anything outside them.

## Project

Gaslight & Grimoire — a browser choose-your-own-adventure game (React 19 + Zustand + Immer, TypeScript,
Vite/Vitest). **Faculty checks** roll a d20 + a faculty modifier vs a difficulty class (DC), resolved into
an outcome tier (critical/success/partial/failure/fumble). Phase 3 makes those odds legible before and
after the roll — DC + a diegetic "Prospects" band (Favourable/Uncertain/Forbidding) + advantage — without
ever showing a literal percentage.

## What to review

**The implementation plan:** `docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md` — read it in full.
**The spec it implements:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md` — read it
for fidelity checking (the spec already passed a Codex review; 5 findings were folded — auto-succeed
"Assured" treatment, surface-dependent partial policy, accessible-name-not-tag, encounter scope
correction, and the real-check guard).

## Ground the plan against these actual code files (branch `feat/phase3-dice-legibility`)

No production code is implemented yet — these are the CURRENT sources the plan proposes to change. Verify
every file path, line reference, symbol name, and signature the plan cites actually matches:

- `src/engine/flags.ts` — `abilityAutoSucceedFlag`, the `ABILITY_AUTO_SUCCEED` map, `FLAGS`. The plan
  adds `checkAutoSucceeds(faculty, flags)` here.
- `src/engine/choiceResolution.ts:43-69` — `resolveCheckOutcome`; the inline auto-succeed guard at
  lines 48-55 the plan refactors. Confirm `consumedAbilityFlag` usage so the refactor is behaviour-preserving.
- `src/engine/diceEngine.ts` — `calculateModifier` (`floor((score-10)/2)`), `getTrainedBonus` (+1 primary),
  `resolveCheck` (nat-20→critical, nat-1→fumble, `total>=dc`→success, `total>=dc-3`→partial), `resolveDC`.
- `src/engine/checkOdds.ts` — NEW in the plan (Task 2). Check the probability math and the
  `partialCountsAsSuccess` `needed = dc-3-modifier` derivation against `resolveCheck`'s semantics.
- `src/store/slices/narrativeSlice.ts:77-82` — `CheckResult` interface (plan adds optional `dc`).
- `src/components/NarrativePanel/DiceRollOverlay.tsx` — current overlay (roll+mod=total; plan adds `dc`).
- `src/components/ChoicePanel/ChoiceCard.tsx` — current card; `aria-label={choice.text}` on the button;
  `hasAdvantage` prop; the faculty-tag block the plan extends. Note it is `React.memo`-wrapped.
- `src/components/ChoicePanel/ChoicePanel.tsx` — builds `gameState` via `useGameState`; `handleSelect`
  calls `processChoice` and `setCheckResult`. Plan adds `autoSucceeds` prop + `dc` to the result.
- `src/components/EncounterPanel/EncounterPanel.tsx` — renders round choices as `ChoiceCard`s
  (line ~140); `handleChoiceSelect` builds `gameState` and calls `setCheckResult` (lines ~78-93). The
  reaction check is auto-rolled in `startEncounter` and only a boolean reaches the panel.
- `src/components/NarrativePanel/SceneCluePrompts.tsx` — `handleCheck` calls
  `performCheck(faculty, investigator, dc, false, false)` and `onCheckResult(...)`; the check-prompt button
  has `aria-label={`Examine: ... DC ${minimum}`}`. Plan adds the odds tag + folds odds into the label +
  forwards `dc`.
- `src/components/NarrativePanel/NarrativePanel.tsx` — `handleCheckResult` (lines ~100-107) drops the DC;
  plan threads it through.
- `src/types/index.ts` — `Investigator`, `Choice`, `Clue`, `ClueDiscovery`, `ChoiceResult`, `OutcomeTier`,
  `Faculty`. The plan's test fixtures assume field names + a `detective` archetype with `reason` primary —
  verify these against the real types and `src/data/archetypes.ts`.

## Project constraints the plan must honour

- **Determinism/purity:** `checkOdds.ts` and `checkAutoSucceeds` must be pure (no `Math.random`, `Date.now`).
- **TDD:** every task must write a failing test, watch it fail, implement, watch it pass, commit. Flag any
  task whose test would pass before implementation (false RED) or wouldn't actually fail for the stated reason.
- **No save migration:** `CheckResult.dc` is transient (the prior spec review confirmed `lastCheckResult`
  is not in `snapshotGameState`). Verify the plan doesn't accidentally persist it.
- **Backward compat:** `DiceRollOverlay` must be unchanged when `dc` is absent (deduction rolls pass none).
- **No `--squash`.** Frequent commits, merge-commit only (not your concern to enforce, but don't advise squashing).

## Your adversarial charge

**Assume the plan contains at least one real defect the author missed** — a task that won't compile or
whose test gives a false RED/GREEN, a file:line or symbol reference that doesn't match the actual code, a
type/signature mismatch between tasks (e.g. `computeCheckOdds` called with different argument shapes in
different tasks), a probability/band error in the Task 2 code, an integration seam where the cited
call-site doesn't actually have the value the plan passes, a `React.memo` staleness bug (new `autoSucceeds`
prop not triggering re-render), an accessibility assertion that wouldn't hold (`toHaveAccessibleName`
against a button whose name the plan composes), or a spec requirement with no covering task — **and find it.**

Focus especially on:

1. **Task 2 math (`checkOdds.ts`).** Is `needed = passThreshold - modifier` with
   `passThreshold = partialCountsAsSuccess ? dc-3 : dc`, `p = clamp((21-needed)/20, .05, .95)`, and the
   adv/disadv fold-ins correct? Do the test expectations (e.g. the `detective`/`reason` +1 assumption,
   the DC 10/mod 0 → Favourable clue-prompt example) actually hold under this code? Any off-by-one at the
   band boundaries?
2. **False RED/GREEN.** For each task's Step-2 "verify it fails," would the test truly fail for the stated
   reason before the Step-3 implementation? Any test that passes vacuously?
3. **Reference accuracy.** Do all cited line numbers, symbol names, prop names, and the `Investigator`/
   `Choice`/`Clue` fixture fields match the real types? The plan flags some of these with implementer
   notes — verify whether those notes are sufficient or hide a real blocker.
4. **memo / re-render.** `ChoiceCard` is `React.memo`. Does adding `autoSucceeds` as a prop compose safely
   with the existing shallow-compare (T5/T6), or is there a staleness trap?
5. **Fidelity to the (already-reviewed) spec.** Does the plan implement all 5 folded findings, or does any
   task silently revert one (e.g. put an `aria-label` on the tag instead of the button)?

Cite `file:line` (or `plan Task N, Step M`) for every finding. Classify Blocker / Major / Minor and state
exactly what to change. Run build/tests only if your sandbox allows (read-only is fine — reason from code).

## Output

Write your review to `codex/output/2026-07-16-phase3-dice-legibility-plan-review.md`.
