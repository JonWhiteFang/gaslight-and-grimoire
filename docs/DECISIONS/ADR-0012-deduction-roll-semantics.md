---
status: Enacted
date: 2026-07-14
deciders: Jon White (decision); Claude Code (framing)
phase: UI/UX track (Phase 0 — gates Phase 2, see docs/research/ui-ux-roadmap.md)
supersedes: <none>
---

# ADR-0012: Deduction roll semantics — correctness gates, the roll flavours

## Context

On the Evidence Board, connecting two or more clues and pressing "Attempt Deduction" currently rolls
a **Reason check (d20 vs DC 14)** (`DeductionButton.tsx`, `buildDeduction.ts`). On `success`/`critical`
it forms a deduction — a *key* deduction if the connected set matches a `KeyDeduction` recipe (subset
match, [ADR-0005](ADR-0005-key-deduction-recipes.md)), otherwise a generic one; on
`partial`/`failure`/`fumble` the clues go `contested` and revert to `examined` after 2s.

The consequence is that **the roll gatekeeps whether reasoning pays off at all, independently of
whether the reasoning was right**: a correct clue-set can fail on an unlucky roll, and a
plausible-but-wrong set can still yield a (generic) deduction on a lucky one. The UI/UX research
([`ui-ux-improvements.md` D3](../research/ui-ux-improvements.md#d3--deduction-verification-avoid-binary-whole-puzzle-rightwrong))
found this hurts deduction *legibility* — players cannot tell a reasoning error from bad luck — and
that exemplar mysteries (Return of the Obra Dinn) deliberately make deduction reward reasoning, not
luck, while games like Disco Elysium keep dice for *drama*. This decision is Phase 0 of the UI/UX
roadmap because it changes game feel across all 8 shipped cases and dictates how much of the later
dice-legibility work (Phase 3) applies to the deduction path. It costs no code to decide and unblocks
the Phase 2 deduction-feedback work.

## Decision

**Correctness gates deduction formation; the roll flavours the outcome tier — it no longer gatekeeps
correct reasoning.** A connected clue-set whose correctness qualifies it (at minimum: it matches a
`KeyDeduction` recipe) **always** forms its deduction; a set that does not qualify **never** does. The
Reason d20 roll is retained at the deduction moment but its role narrows to determining the *tier /
framing* of a successful deduction (e.g. a `critical` roll reads as a sharper "insight," an ordinary
`success` as a plain one) and to driving the Phase 2 partial-tier *directional* feedback ("some of
these belong together, but the link isn't complete"). This separates **"did you reason correctly"**
(deterministic, correctness-driven) from **"how brilliantly did the insight land"** (dice-driven).

**Deferred to the Phase 2 spec (not decided here):** exactly what counts as "correct" for a *generic*,
non-recipe connection — today such connections have no modelled correctness at all — and the precise
mapping from `{critical, success, partial, failure, fumble}` to on-board feedback. Those are mechanic
decisions that need their own design; this ADR fixes only the governing principle.

## Alternatives considered

- **A — Hybrid: correctness gates, roll flavours (chosen).** Correct sets always succeed, wrong sets
  always fail; the roll sets tier/flavour and feeds partial-tier feedback. Rewards reasoning (per the
  research) while keeping the d20 identity and a role for the Reason faculty. Chosen.
- **B — Fully deterministic: drop dice from deduction.** A correct set succeeds automatically; dice
  removed from the deduction path entirely (still used for in-scene faculty checks). Cleanest anti-luck
  stance, but sheds the d20 flavour at the deduction beat and makes the Reason faculty irrelevant to
  deducing. Rejected: throws away usable drama and a faculty hook for a purity the hybrid already
  achieves on the axis that matters (correct reasoning always pays off).
- **C — Keep load-bearing (status quo).** The roll stays a gate: correct sets can fail, wrong sets can
  pass. Maximum randomness-driven tension, but it is the exact legibility problem the research
  identified. Rejected.

## Consequences

- **Positive:** correct reasoning always pays off, so players can attribute a failed deduction to a
  reasoning error rather than luck; the deduction beat becomes legible without losing the d20 flavour;
  Phase 2 gains a clean substrate (tier drives directional feedback, correctness drives success);
  the change is content-agnostic (applies uniformly to all 8 cases via the shared board logic, no
  per-case authoring).
- **Negative / trade-offs:** removes a source of randomness-driven tension some players may value;
  requires modelling "correctness" for generic connections that currently have none (deferred to
  Phase 2, but it *must* be resolved there or the principle only half-applies); may make key
  deductions feel "free" once the right clues are connected, shifting the challenge fully onto
  *finding and connecting* the right clues (arguably where a mystery's difficulty belongs).
- **Follow-ups:** Phase 2 spec must define generic-connection correctness + the tier→feedback map;
  Phase 3 (dice legibility) should reflect that the deduction roll is now flavour, not a gate, when
  deciding what to surface; revisit if playtesting shows the deduction beat feels stakes-free.

## Confirmation

Enacted when the Phase 2 implementation lands a test asserting that **a recipe-matching connected set
forms its key deduction regardless of roll tier** (including a low/`failure`-tier roll) and that **a
non-qualifying set never forms one regardless of roll tier** (including `critical`). Until Phase 2
ships, this ADR is `Accepted` (principle agreed) but not yet `Enacted` (code still rolls-to-gate);
promote the status to `Enacted` in the Phase 2 PR that adds that test. A doc-drift sweep can verify by
checking that `DeductionButton.tsx` no longer conditions deduction formation solely on
`tier === 'success' || tier === 'critical'`.

**Enacted 2026-07-16 (Phase 2b).** The correctness oracle
(`src/engine/deductionOracle.ts`, `classifyBoard`) now decides formation and `EvidenceBoard`
(`handleDeductionAttempt`) forms every qualifying deduction; `DeductionButton` only rolls the d20 and
reports the tier. The enacting tests live in `src/components/__tests__/EvidenceBoard.test.tsx`
("oracle-driven formation" — a recipe-matching component forms on a **`failure`**-tier roll; a
non-qualifying set forms **nothing** on a **`critical`**-tier roll). `DeductionButton.tsx` no longer
gates on the tier at all.

## Links

- Related ADRs: [ADR-0005](ADR-0005-key-deduction-recipes.md) (key-deduction recipes — defines the
  recipe subset-match this decision treats as "correct")
- Planning docs: [docs/research/ui-ux-roadmap.md](../research/ui-ux-roadmap.md) (Phase 0);
  [docs/research/ui-ux-improvements.md](../research/ui-ux-improvements.md) (finding D3, Part V bridge)
- Commits / PRs: enacted on branch `feat/phase2b-deduction-formation` (Phase 2b — deduction
  formation model; PR # added on merge).
