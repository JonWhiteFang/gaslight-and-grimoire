# Codex spec review — Phase 3: Dice / Probability Legibility (Gaslight & Grimoire)

You are an adversarial cross-provider reviewer. You have **no** conversation memory, so this prompt is
fully self-contained. Read the referenced files in the repo to ground every claim — do not rely on
anything outside them.

## What this project is

Gaslight & Grimoire is a browser choose-your-own-adventure game (React 19 + Zustand + Immer, TypeScript,
Vite/Vitest). Players make choices; some choices are **faculty checks** — a d20 roll + a faculty modifier
vs a difficulty class (DC), resolved into an outcome tier (critical / success / partial / failure /
fumble). There are six faculties (reason, perception, nerve, vigor, influence, lore).

## The task under review

**Spec:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md` — read it in full.

Phase 3 makes the odds of a faculty check legible **before** (pre-roll) and **after** (at-roll) the roll,
without a literal success-percentage and without breaking the game's measured Victorian tone. The chosen
treatment: raw numbers (DC, modifier, advantage) **plus** a three-word diegetic "Prospects" band
(Favourable / Uncertain / Forbidding) derived from an internal success probability that is *never
rendered*. Coverage is all three faculty-check surfaces (main choices, scene clue-check prompts,
encounters). The at-roll overlay gains **DC only** (no advantage-dice detail).

## Ground your review against these actual code files

Read these on the `feat/phase3-dice-legibility` branch (spec is the only new file; the rest is the code
the spec proposes to change):

- `src/engine/diceEngine.ts` — `calculateModifier` (`floor((score-10)/2)`), `getTrainedBonus` (+1 on the
  archetype's primary faculty), `resolveCheck` (nat-20 → critical, nat-1 → fumble, `total >= dc` →
  success, `total >= dc-3` → partial, else failure), `resolveDC` (dynamic difficulty; default 12),
  `performCheck` (advantage = 2d20 take higher, disadvantage = take lower, they cancel).
- `src/engine/advantage.ts` — `computeAdvantage` (clue-advantage OR Lore+Veil-Sight).
- `src/store/slices/narrativeSlice.ts` — `CheckResult` shape (`roll/modifier/total/tier`), `setCheckResult`,
  and note `lastCheckResult` is cleared on cross-scene navigation (F-106).
- `src/components/ChoicePanel/ChoiceCard.tsx` — current faculty tag (faculty + modifier + proficiency
  word; NO DC), advantage glyph ◈, `hasAdvantage` prop plumbed via `computeAdvantage`.
- `src/components/NarrativePanel/SceneCluePrompts.tsx` — `method: 'check'` prompts; DC only in aria-label;
  `handleCheck` calls `performCheck(faculty, investigator, dc, false, false)`.
- `src/components/NarrativePanel/DiceRollOverlay.tsx` — current at-roll overlay (roll + modifier = total),
  no DC.
- `src/components/NarrativePanel/NarrativePanel.tsx` — wires `lastCheckResult` → overlay via `setCheckResult`.
- `src/components/EncounterPanel/EncounterPanel.tsx` — the third faculty-check surface.

## Project constraints you must hold the spec to

- **Determinism / purity:** engine helpers must be pure — no `Math.random`, no `Date.now`. The new
  `checkOdds.ts` must be RNG-free and unit-testable.
- **No content-schema change** and **no save migration** are in scope — the spec claims the DC field is
  transient and needs neither. Verify that claim against how `lastCheckResult` is actually used/persisted.
- **Tone:** no literal success percentage may ever reach the UI.
- **Backward compatibility:** the `DiceRollOverlay` must render unchanged when no DC is supplied (deduction
  rolls per ADR-0012 pass no DC).

## Your adversarial charge

**Assume this spec contains at least one real defect** — a correctness hole in the probability/band math, a
determinism/purity hazard, an integration seam the spec gets wrong (e.g. a call-site that does NOT actually
have the DC in hand when it calls `setCheckResult`, or a surface whose advantage state the spec
mis-describes), a backward-compatibility break, a save/persistence claim that's false, or a dangerous
ambiguity that would let an implementer build the wrong thing — **and find it.**

Focus especially on:

1. **The band math (§3).** Is `p = (21 - needed)/20` with `needed = dc - modifier`, clamped to
   `[1/20, 19/20]`, actually correct given `resolveCheck`'s semantics (nat-20 always crit, nat-1 always
   fumble, `total >= dc`)? Does excluding the *partial* tier from the band create a misleading reading
   anywhere? Are the advantage/disadvantage fold-ins (`1-(1-p)²` / `p²`) correct for take-higher /
   take-lower of 2d20? Do the 0.65 / 0.35 thresholds land the bands where the prose claims?
2. **Integration seams (§4, §5).** For each of the three surfaces, does the call-site *actually* have the
   DC and the correct advantage state at the moment the spec says it passes them? The spec claims
   ChoiceCard's advantage is plumbed but SceneCluePrompts passes `hasAdvantage: false` — is that faithful
   to the code, and does it create an inconsistency (advantaged check whose band under-reads)?
3. **The store change (§2.3, §5).** Is `CheckResult.dc` genuinely safe as an optional field with no
   migration? Any path where an old/other caller breaks?
4. **Monotonicity / edge claims (§6, §7).** Is the "band monotonic in modifier" property actually true
   under the proposed math? Any DC/modifier extreme where the clamp or the band mislabels?

Cite `file:line` for every finding. Run the build/tests only if your sandbox allows (read-only is fine —
reason from the code). Classify each finding Blocker / Major / Minor and say precisely what to change.

## Output

Write your review to `codex/output/2026-07-16-phase3-dice-legibility-review.md`.
