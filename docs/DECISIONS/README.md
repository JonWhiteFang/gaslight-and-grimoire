# Architecture Decision Records — Index

> **Purpose:** the single entry point for *why* the non-trivial calls were made — one row per decision,
> with status, scope, and how the ADRs relate.

This index complements [../../CLAUDE.md](../../CLAUDE.md) and the [docs/](../README.md) set, which hold
the **WHAT** (architecture, invariants, scope) and the **WHY at the level of standing principle**. The
ADRs are the **HOW / point-in-time detail**. When the project guide and an ADR appear to disagree, the
guide is the *current rule* and the ADR is the *historical record* — check the **Status** column first.

## Status legend

| Status | Meaning |
|---|---|
| **Proposed** | Written; not yet committed to. |
| **Accepted** | Agreed and binding, but not necessarily in code yet. |
| **Enacted** | Accepted *and* realised in the codebase today. |
| **Superseded by ADR-XXXX** | Replaced by a later decision; kept for history. |
| **Deprecated** | No longer applies, not directly replaced. |

## The index

| ID | Title | Status | Date | Phase | Relations | Summary |
|---|---|---|---|---|---|---|
| [ADR-0001](ADR-0001-content-engine-separation.md) | Content ↔ engine separation, single store, bounded state | Enacted | 2026-07-07 | Foundation | none | Content is runtime JSON gated only by `Condition`/`Effect`; engine is pure and store-free; one six-slice Zustand store; all numeric state bounded. |
| [ADR-0002](ADR-0002-committed-memory-spine.md) | Adopt a committed, version-controlled project-memory spine | Enacted | 2026-07-07 | Tooling | none | STATE + RUN_LOG + DECISIONS + session-start hook + `/checkpoint`; scope-gate tracker/ledger dropped (project is feature-complete). Enacted 2026-07-07 after first real `/checkpoint`. |

## How to add a new ADR

1. **Pick the next number** (never reused, even if an ADR is later superseded).
2. **Choose a short slug:** `ADR-NNNN-<short-slug>.md`, kept in this directory.
3. **Copy the template** ([ADR-TEMPLATE.md](ADR-TEMPLATE.md)); fill in context, decision, status, date,
   consequences. Add a **Relations** line if it supersedes or pairs with an existing ADR — and update the
   other ADR's status to point back.
4. **Wire it into the index** (a row above) and link it from [../PROJECT_STATE.md](../PROJECT_STATE.md) → References.
