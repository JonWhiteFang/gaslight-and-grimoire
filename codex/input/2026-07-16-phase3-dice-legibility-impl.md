# Codex implementation review — Phase 3: Dice / Probability Legibility (Gaslight & Grimoire)

You are an adversarial cross-provider reviewer with **no** conversation memory. This prompt is fully
self-contained. Ground every finding in the actual committed code on the branch — cite `file:line`.

## Project

Gaslight & Grimoire — a browser choose-your-own-adventure game (React 19 + Zustand + Immer, TypeScript,
Vite/Vitest). **Faculty checks** roll a d20 + a faculty modifier vs a difficulty class (DC), resolved into
an outcome tier (critical/success/partial/failure/fumble).

## What shipped (the implementation under review)

Phase 3 makes faculty-check odds legible **before** and **after** the roll: a diegetic three-word
"Prospects" band (Favourable/Uncertain/Forbidding) + DC + advantage shown pre-roll on all three check
surfaces (main choices, encounter round choices, scene clue-check prompts), and "vs DC N" in the at-roll
dice overlay — **never a literal percentage**. A guaranteed auto-succeed ability check shows **"Assured"**
instead of dice odds.

This is a **completed, merge-ready branch** — the final independent gate before PR. It has already passed:
per-task spec + code-quality reviews, a whole-branch internal review (verdict: ready to merge), and live
in-browser verification (band renders across 5 faculties; Assured shows for a Reason check while the
Elementary auto-succeed ability is active, side-by-side with an ordinary Nerve band; zero console errors).
Baseline: **730 tests / 74 files green**, lint clean, validator 8/8 clean, build green.

## Branch + diff

- Branch: `feat/phase3-dice-legibility`
- Diff range: `git diff 087a236..e09b810` (base `main` = 087a236, head = e09b810). 40 files, +2907/-24.
- `git log --oneline 087a236..e09b810` shows the task sequence (spec/plan docs, then T1–T8 + a T6b refactor).

## Read these production files (ground every claim here)

- `src/engine/checkOdds.ts` — **NEW.** `computeCheckOdds(args)` → `CheckOdds` (band) + `describeCheckOdds(odds)`
  → accessible phrase. Probability: `needed = (partialCountsAsSuccess ? dc-3 : dc) - modifier`;
  `p = clamp((21-needed)/20, 1/20, 19/20)`; advantage `1-(1-p)²`, disadvantage `p²`, both cancel; band
  ≥.65 favourable, ≥.35 uncertain, else forbidding; `autoSucceeds` short-circuits to favourable.
- `src/engine/flags.ts` — `checkAutoSucceeds(faculty, flags)` pure predicate.
- `src/engine/diceEngine.ts` — `isFacultyCheck(choice)` type guard (`choice is Choice & { faculty: Faculty }`):
  `faculty != null && (difficulty !== undefined || dynamicDifficulty != null)`. `resolveDC`, `performCheck`.
- `src/engine/choiceResolution.ts` — `resolveCheckOutcome` refactored to use `isFacultyCheck` +
  `checkAutoSucceeds` (behaviour-preserving; still returns guaranteed critical + `consumedAbilityFlag`).
- `src/engine/contentValidation.ts` — two sites now call `isFacultyCheck`.
- `src/components/shared/CheckOddsTag.tsx` — decorative (`aria-hidden`) tag: "vs DC N · Prospects: Band"
  or "Assured"; renders NO advantage glyph.
- `src/components/ChoicePanel/ChoiceCard.tsx` — renders the tag for real checks; appends
  `describeCheckOdds` to the button's OWN `aria-label`; keeps its single ◈ glyph; `autoSucceeds` prop.
- `src/components/ChoicePanel/ChoicePanel.tsx` — passes `autoSucceeds` from `gameState.flags`; adds `dc`
  (via `resolveDC`) to `setCheckResult`.
- `src/components/EncounterPanel/EncounterPanel.tsx` — reactive `useStore(s=>s.flags)` selector feeds
  `autoSucceeds`; adds `dc` to `setCheckResult`. Round choices are `ChoiceCard`s (tag is transitive).
- `src/components/NarrativePanel/SceneCluePrompts.tsx` — check prompts show the tag with
  `partialCountsAsSuccess: true` and `autoSucceeds: false` (hard-coded — this path calls `performCheck`
  directly and does NOT consume the ability, so "Assured" would lie); appends odds to the button label;
  forwards `dc`.
- `src/components/NarrativePanel/NarrativePanel.tsx` — `handleCheckResult` forwards `dc`; passes
  `dc={lastCheckResult?.dc}` to `DiceRollOverlay`.
- `src/components/NarrativePanel/DiceRollOverlay.tsx` — optional `dc` prop → "vs DC N" + aria-label;
  unchanged when `dc` absent (deduction rolls pass none).
- `src/store/slices/narrativeSlice.ts` — `CheckResult.dc?: number` (transient; no save migration).

Also available for fidelity: the spec `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md`
and plan `docs/superpowers/plans/2026-07-16-phase3-dice-legibility.md`.

## Project constraints to hold the code to

- **Determinism/purity:** `checkOdds.ts`, `checkAutoSucceeds`, `isFacultyCheck` must be pure — no
  `Math.random`, no `Date.now`.
- **No save migration** — `CheckResult.dc` is transient (`lastCheckResult` is not persisted /
  `snapshotGameState` omits it). Verify nothing broke that.
- **Backward compat:** `DiceRollOverlay` renders unchanged when `dc` is absent; deduction rolls (ADR-0012)
  pass no `dc` and must be unaffected.
- **Engine/UI agreement invariant:** the pre-roll odds must not lie about what the engine rolls —
  `isFacultyCheck` gates both; displayed DC must equal the rolled DC; shown advantage must match
  `computeAdvantage` where it applies (choices) and be absent where it doesn't (clue prompts).

## Your adversarial charge

**Assume the implementation contains at least one real defect the internal reviews missed** — a
correctness bug in the probability/band math, an integration/seam defect between a panel and `ChoiceCard`
or the store, an accessibility defect (odds not actually on the focusable element's accessible name, or a
double-announcement), a determinism/purity violation, a false-green or missing test, a place the code
silently diverges from the spec (e.g. a surface using the wrong `partialCountsAsSuccess`/`autoSucceeds`
polarity), or an `isFacultyCheck` edge case where the odds UI and the engine roll disagree — **and find
it.** Ground every finding in the committed code.

Focus especially on:
1. **Band math correctness** — re-derive the boundaries and the advantage/disadvantage fold-ins against
   `resolveCheck`'s actual tier semantics. Any off-by-one, any input where the displayed band contradicts
   the true odds of the event the player cares about on that surface?
2. **Engine/UI agreement** — does `isFacultyCheck` (type guard) truly gate both the roll and every odds
   site identically now? Is the displayed DC always the one the engine rolls against (incl.
   `dynamicDifficulty`)? Any surface where advantage shown ≠ advantage rolled?
3. **The auto-succeed "Assured" path** — is it correctly live on choices/encounters and correctly
   hard-false on clue prompts? Could "Assured" ever show on a check that then actually rolls (a lie)?
4. **The at-roll `dc`** — does it reach `lastCheckResult` from all three surfaces and render, with no
   phantom DC on non-checks/auto-succeeds and no leak across navigation?
5. **Tests** — any false-green (passes without the behaviour), any load-bearing path unguarded?

Run the build/tests only if your sandbox allows (read-only is fine — reason from the code). Classify each
finding Blocker / Major / Minor and state precisely what to change.

## Output

Write your review to `codex/output/2026-07-16-phase3-dice-legibility-impl-review.md`.
