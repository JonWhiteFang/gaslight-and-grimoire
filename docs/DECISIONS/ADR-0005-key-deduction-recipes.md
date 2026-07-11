---
status: "Enacted"
date: "2026-07-08"
deciders: "Jon White (jpawhite); design brainstorm this session"
phase: "Audit remediation — P1 (#6)"
---

# ADR-0005: Stable deduction identity via authored key-deduction recipes

## Context

The deduction system is the game's headline mechanic, but it was **decorative**: `buildDeduction`
stored every deduction under a random id (`deduction-{Date.now()}-{random}`), while the `hasDeduction`
condition matches on `state.deductions[target]`. So an authored gate `requiresDeduction: "x"` could
never resolve — there was no stable name to point at, and no content used the gate. Closing audit issue
**#6** (make deductions load-bearing) required first giving a deduction a **stable, authorable
identity**, then deciding *what* making one should unlock. Governing constraints: the content↔engine
separation and engine purity (ADR-0001), and the content rule that no single faculty may gate critical
progress (the case must stay completable).

## Decision

Introduce an authored **`KeyDeduction` recipe** (stable `id` + a `requiredClues` set + title/description/
`isRedHerring`), stored in an optional per-case `deductions.json` and loaded onto `CaseData.recipes`.
A pure `matchDeduction(connectedIds, recipes)` uses **subset** matching (a recipe matches when its
`requiredClues` are all present in the connected set, extras allowed); on a match, `DeductionButton`
stores the deduction under the recipe's **authored id** via `buildDeductionFromRecipe`, so
`hasDeduction`/`requiresDeduction` gates resolve. No match → the existing random-id `buildDeduction`
path is preserved. The content validator (and CLI) treat recipe ids as a registry: recipe clue refs and
all `requiresDeduction`/`hasDeduction` targets are validated against it. A key deduction gates the
**true/best ending** of each main case only; existing endings remain reachable, so the case is always
completable.

## Alternatives considered

- **A — Named clue-set recipes (chosen):** an authored id + exact clue set. The only option that gives
  authors a stable gate target, is statically validatable, and preserves the deduction *act* (the player
  must connect the clues). Cost: authors define recipes; the engine must match connected clues to them.
- **B — Any-deduction flag per case:** reaching N deductions (or any deduction touching a given clue)
  sets a flag; gates read the flag. Simpler, but blunt — it cannot distinguish the *right* conclusion
  from a wrong or red-herring one, which is exactly the payoff #6 exists to reward.
- **C — Gate on clue possession (`hasClue` for each needed clue):** no stored-deduction identity at all.
  Rejected because it gates on *possession*, not on the player *making the connection* — it discards the
  deduction beat entirely.
- **Match semantics — subset vs. exact:** exact-set matching fights the shared-web Evidence Board UI
  (connecting any extra clue would break the deduction) and punishes curiosity; subset matching rewards
  "found the right thread among the noise." Subset chosen.

## Consequences

- **Positive:** the deduction mechanic becomes load-bearing — connecting the right clues unlocks a
  genuinely different true ending in each main case. Gate targets are now statically enforced (a gate
  pointing at an undefined recipe is a validator error). The matcher is pure (engine stays store-free,
  ADR-0001 preserved); vignettes without `deductions.json` degrade gracefully (`recipes: []`, random-id
  path). No existing ending was removed, so no soft-lock.
- **Negative / trade-offs:** `recipes` is optional on `CaseData` (so the `VignetteData→CaseData` cast
  stays valid), a small type looseness. Subset matching with **multiple** recipes per case has latent
  first-match-ordering ambiguity if one recipe's clue set were a subset of another's — harmless today
  (one recipe per case), worth a guard if multi-recipe cases arrive. Forming the deduction and the gated
  accusation are two separate Reason checks (intentional layering, but double-Reason).
- **Follow-ups:** deduction *chains* / multiple recipes per case, and vignette deduction gates, were
  explicitly deferred (out of scope for #6). Revisit if/when a case wants more than one key deduction.

## Links

- Related ADRs: ADR-0001 (content↔engine separation & bounded state — this keeps the matcher pure and
  the recipe registry authored-in-content); ADR-0004 (the `content-integrity-reviewer` that design-reviewed
  the three cases' recipes/endings).
- Planning docs: `docs/superpowers/specs/2026-07-08-deduction-gated-content-design.md`,
  `docs/superpowers/plans/2026-07-08-deduction-gated-content.md`.
- Commits / PRs: PR #32 (merged `b319f09`); closes issue #6.
