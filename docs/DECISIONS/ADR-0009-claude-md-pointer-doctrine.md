---
status: "Enacted"
date: "2026-07-11"
deciders: "Jon White (approved full trim), Claude (audit + proposal)"
phase: "Tooling / process"
---

# ADR-0009: CLAUDE.md is a pointer map, not a mirror of docs/

## Context

A claude-md-improver audit (2026-07-11) scored the root `CLAUDE.md` 78/100: commands and warnings
were strong, but ~40% of its 339 lines restated content owned by the `docs/` set (engine behavior,
component hierarchy, content inventory, type catalogs, the completed A–E roadmap). Every fact that
had drifted in `CLAUDE.md` (198→201 scenes, React 18→19, save v3→v4, component counts) drifted
*because* it was a duplicate — 17 corrective commits since 2026-07-07, a recurring tax on every
`/checkpoint` sweep. The repo's own information-flow rule ("one authority per fact; the non-authority
copy is the bug") applied to everything except the guide file that states it.

## Decision

`CLAUDE.md` holds only what an agent needs in context every session — project identity, the doc map,
the memory-spine protocol, the two-domain rule, directory skeleton, commands, store rules, authoring
non-negotiables, testing/CI-CD facts (incl. the no-squash rule), and Architectural Warnings — and
**points at** the authoritative doc for everything else. Reference detail (engine module behavior,
component hierarchy, content inventory, type catalogs) must not be restated there. Trimmed 339 → 165
lines; duplicated sections replaced with pointers naming their authority.

## Alternatives considered

- **A — Keep the full mirror:** always-in-context detail spares pointer-following, but the drift
  record shows the copies rot faster than sweeps fix them; rejected.
- **B — Conservative trim (keep hierarchy/types/archetypes inline):** cuts the worst drift sources
  only (~130 lines); rejected in favour of applying the one-authority rule uniformly once the full
  report was reviewed.
- **C — Full trim to a pointer map:** chosen. Costs one file-read when reference detail is needed;
  ends the recurring sweep tax.

## Consequences

- **Positive:** `CLAUDE.md` facts stop drifting (pointers don't go stale); `/checkpoint` sweeps get
  cheaper; each fact has exactly one home, matching the spine doctrine.
- **Negative / trade-offs:** Claude sees less by default and must open `docs/architecture.md` /
  `engine-reference.md` / `status.md` when working on those areas; the doc map at the top of
  `CLAUDE.md` is now load-bearing.
- **Follow-ups:** sweeps should flag re-accumulation (see Confirmation); the always-in-context
  survivors (Warnings, store rules, CI/CD) still need normal drift checks.

## Confirmation

The `/checkpoint` doc-drift sweep's duplication check: if `CLAUDE.md` states a fact whose authority
is a `docs/` file (engine behavior, component structure, content counts, type shapes), that's drift —
fix it back into a pointer. Heuristic: `CLAUDE.md` staying near ~165 lines; growth by restated
reference material signals erosion of this decision.

## Links

- Related ADRs: ADR-0002 (the memory spine whose one-authority rule this extends to CLAUDE.md itself)
- Planning docs: the 2026-07-11 audit report (in-session; trim plan preserved in the RUN_LOG entry)
- Commits / PRs: the 2026-07-11 trim PR
