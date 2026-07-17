# Codex spec review — Phase 5: Choice-Gating Content Model

You are an independent adversarial reviewer from a different model provider. You have **no**
conversation memory, so this prompt is fully self-contained. Your job: find the real defect in a design
spec before it becomes an implementation plan.

## The goal of the work

Gaslight & Grimoire is a browser-based choose-your-own-adventure game (React 19 + Zustand + Immer;
narrative content is JSON under `public/content/`, game logic is pure functions under `src/engine/`).
Choices in the content JSON can already be *gated* by prerequisites (`requiresClue`,
`requiresDeduction`, `requiresFlag`, `requiresFaculty`). Today an unmet gate **hard-hides** the choice.

Phase 5 adds a declarative vocabulary so authors can instead show a gated choice **disabled with a
diegetic reason** ("shown-but-locked") rather than hidden. It ships the schema, a shared pure engine
resolver, a validator rule, authoring docs, tests, and one demo content conversion — backward-compatible
with the 8 shipped cases.

## What to review

**The spec:** `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md` — read it in full.

## Ground your review against the ACTUAL code (read these)

- `src/types/index.ts` — the `Choice` interface (~line 203) and `Condition` union. Verify the two new
  fields fit and that the `Condition` types the resolver builds (`hasClue`/`hasDeduction`/`hasFlag`/
  `facultyMin`) actually exist with those exact tags and shapes.
- `src/components/ChoicePanel/ChoicePanel.tsx` — the current `isChoiceVisible` helper and the
  `.filter(...)` render path the spec refactors.
- `src/engine/encounters.ts` — `getEncounterChoices` (~line 185): the duplicated inline
  condition-building and the `isEscapePath` special-case the spec says it preserves.
- `src/engine/contentValidation.ts` — `validateChoice` (~line 353) and how errors vs. warnings are
  collected/surfaced, so the proposed rules match the existing mechanism.
- `src/engine/narrativeEngine.ts` (barrel) — confirm `evaluateConditions` is exported and its signature
  `(conditions: Condition[], state: GameState) => boolean`.
- `src/engine/checkOdds.ts` and `src/engine/deductionOracle.ts` — the shape/style the new pure
  `choiceVisibility.ts` module is meant to match.

## Project constraints (must hold)

- **Backward-compatibility is non-negotiable:** absent `visibility` must behave EXACTLY like today
  (hard-hide when gated). 8 cases ship against the current model with zero edits expected.
- Engine modules are **pure and RNG-free**; the store/engine separation is strict (engine must not
  import the store).
- Tone is "measured, atmospheric, never campy" — reasons are author-written prose, not machine-generated.
- The validator is a CI gate; a new error must fail the build, a warning must not.
- Merge strategy: never squash (not your concern, but context).

## Your adversarial charge

**Assume this spec contains at least one real defect** — a correctness hole, an unimplementable or
self-contradictory claim, a backward-compatibility break, a determinism/collision hazard, a
validator/engine seam defect, or a dangerous ambiguity that would let two implementers build
incompatible things. **Find it.** Specifically probe:

1. **Backward-compat:** does the resolver's default-`hidden` path truly reproduce today's exact
   `isChoiceVisible` / `getEncounterChoices` behaviour, including the empty-conditions case and the
   `isEscapePath` special-case? Any input where old and new diverge?
2. **Semantics table (§3) vs. resolver logic (§4):** do they fully agree? Any row unhandled, or any
   `visibility`/gate combination whose outcome is ambiguous or contradicts the table?
3. **Validator rules (§5):** are the three errors + one warning each precisely specified and mutually
   consistent? Could a legitimate authored choice trip a false error, or a broken one slip through? Does
   "has no `requires*` gate" have a crisp definition (all four fields absent)?
4. **Encounter path:** the spec says escape paths are "never disabled." Is that consistent with
   returning `disabled` choices from `getEncounterChoices`? Does `EncounterPanel` have what it needs to
   distinguish the three states?
5. **Type/Condition fidelity:** do the `Condition` tags the spec names match `src/types/index.ts`
   exactly? (A drifted tag would make the resolver a no-op.)
6. **Rendering/a11y (§6):** any accessibility or focus-order claim that's wrong or unachievable given a
   non-`<button>` disabled element?
7. **Anything the spec is silent on** that an implementer must decide and could get wrong.

Ground every finding in the actual spec text and/or the real code (cite `file:line` where you can). If
your sandbox allows, you may run the build/tests, but read-only reasoning from the code is fine. Rank
findings by severity (Blocker / Major / Minor). If you believe a claim is actually correct, don't
manufacture a defect — but do say what you checked.

## Output

Write your review to `codex/output/2026-07-17-phase5-choice-gating-review.md`. Structure it as: a
one-line verdict, then findings ranked by severity, each with (a) the exact spec/code location, (b) the
concrete failure it causes, (c) a suggested fix. End with anything the spec got right that's worth
preserving.
