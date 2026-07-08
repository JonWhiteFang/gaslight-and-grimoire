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
| [ADR-0003](ADR-0003-playwright-mcp-project-scope.md) | Commit the Playwright MCP server at project scope | Enacted | 2026-07-07 | Tooling | pairs with ADR-0002 | Committed `.mcp.json` runs `@playwright/mcp` so any clone can drive the browser game; project scope chosen over local/user for team-shareability. |
| [ADR-0004](ADR-0004-content-authoring-automation-layer.md) | Commit a content-authoring automation layer (hook + reviewer subagent + skills) | Enacted | 2026-07-07 | Tooling | extends ADR-0002/0003 | `PostToolUse` hook (validator + `tsc`), read-only `content-integrity-reviewer` subagent wired into `/new-scene` + `/checkpoint` + new `/review-content` (hooks can't dispatch agents, so skills do), `/new-scene` scaffold, + `context7`/`github` MCP. |
| [ADR-0005](ADR-0005-key-deduction-recipes.md) | Stable deduction identity via authored key-deduction recipes | Enacted | 2026-07-08 | P1 (#6) | builds on ADR-0001; design-reviewed via ADR-0004 | `KeyDeduction` recipes in per-case `deductions.json` → `CaseData.recipes`; pure `matchDeduction` (subset) stores matches under the authored id so `hasDeduction`/`requiresDeduction` gates resolve; validator enforces recipe refs + gate targets. Gates the true ending per main case; case stays completable. PR #32. |
| [ADR-0006](ADR-0006-media-asset-strategy.md) | Media asset strategy — AI-generated audio, prompt-kit pipeline, illustrations parked | Accepted | 2026-07-08 | Media (#20) | builds on ADR-0001; QA via ADR-0003 | Resolves the media-sourcing open question: AI-generate **audio only** (9 SFX then 10 ambient loops) via a **prompt kit** the user runs (no API in repo); naturalistic never-campy house style; illustrations **parked** (lowest priority, no code change to defer); `checkAudioAssets.mjs` validator deferred until files land. Accepted (not yet Enacted — no files/validator yet). |

## How to add a new ADR

1. **Pick the next number** (never reused, even if an ADR is later superseded).
2. **Choose a short slug:** `ADR-NNNN-<short-slug>.md`, kept in this directory.
3. **Copy the template** ([ADR-TEMPLATE.md](ADR-TEMPLATE.md)); fill in context, decision, status, date,
   consequences. Add a **Relations** line if it supersedes or pairs with an existing ADR — and update the
   other ADR's status to point back.
4. **Wire it into the index** (a row above) and link it from [../PROJECT_STATE.md](../PROJECT_STATE.md) → References.
