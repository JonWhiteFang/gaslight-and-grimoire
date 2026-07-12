---
status: Enacted
date: 2026-07-12
deciders: Jon White (concept, scale, expansion shape); Claude Code (design/plan)
phase: Content expansion (post audit-2)
---

# ADR-0011: The Comet Club as the fourth main case (flagship scale, mythos breadcrumb live)

## Context

The 2026-07-10 ideation doc ([content-ideas-2026-07-10.md](../content-ideas-2026-07-10.md)) left ten
vetted concepts awaiting a pick, with a ranked top 3 and a suggested Mythos-thread build order. The
catalog had 3 main cases and 4 vignettes; the Mythos meta-thread existed only on paper. Building any
concept forces three decisions: which concept first, at what scale, and whether to author the
cross-content Mythos flags before their consumers exist.

## Decision

Build **The Comet Club** (ideation #5, ranked #1) first, at **flagship scale** (75 scenes — Whitechapel-
class — via a hybrid expansion: every surviving chair interrogable + all three death scenes explorable,
plus deeper side threads), and author the **`mythos-period-computed`** breadcrumb flag now, consumed by
nothing until The Orrery Room exists. Flag semantics are strict: it is set only on paths where the
player narratively *carries the computed period* — the best ending and the deduction-gated
`cc-var-eyepiece-full` variant — never on the blind eyepiece path.

## Alternatives considered

- **A — The Ravenscroft Remedy first (ranked #2):** activates a design-bible location and the Grey
  Dawn; passed over because Comet Club is the Mythos thread's period-minting anchor and the easiest
  build (no new engine needs, bounded cast).
- **B — Standard scale (~50 scenes):** matches the two smaller mains; user chose flagship to make the
  closed circle dense enough that the seating-chart deduction is genuinely earned.
- **C — Defer the mythos flag until The Orrery Room ships:** avoids an unconsumed flag; rejected —
  retrofitting flags into shipped endings is worse than carrying an inert breadcrumb, and the vignette's
  unlock design depends on it existing.
- **D — Gate Act III entry on the midpoint deduction (final-review recommendation):** rejected because
  evidence-board deductions require a Reason *roll* in-engine — the gate would put critical progress
  behind RNG, violating the no-single-faculty/alternate-path rule.

## Consequences

- **Positive:** catalog grows to 8 cases / 4 mains; the Mythos thread's keystone prerequisite is live;
  the double-solution structure (one human murder inside an inhuman pattern) is new to the catalog.
- **Negative / trade-offs:** three bookkeeping flags (`cc-tonic-dissolved`, `cc-ost-confided`,
  `cc-midpoint-passed`) are set but unread; the Mesmerist exclusive fires after a lost pursuit rather
  than bypassing it (accepted spec deviation); the Hampstead summons is an unmarked one-way door from
  the first hub visit.
- **Follow-ups:** The Orrery Room vignette is the natural next build (consumes the flag; fallback
  unlock Grey Dawn rep ≥ 2 already designed); decide whether to wire or drop the three unread flags.

## Confirmation

`grep -rn "mythos-period-computed" public/content/` must show setters only in
`cc-act3-ending-best` and `cc-var-eyepiece-full` (plus, once built, consumers in The Orrery Room).
`node scripts/validateCase.mjs` stays zero-error/zero-warning for the-comet-club.

## Links

- Related ADRs: ADR-0005 (key-deduction recipes), ADR-0010 (both gates ran on this work)
- Planning docs: [spec](../superpowers/specs/2026-07-11-comet-club-case-design.md) ·
  [plan](../superpowers/plans/2026-07-11-comet-club-case.md) ·
  [ideation](../content-ideas-2026-07-10.md)
- Commits / PRs: branch `docs/comet-club-spec` (`84d7d49..c967878`), **PR #76**
