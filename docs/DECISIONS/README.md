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
| [ADR-0006](ADR-0006-media-asset-strategy.md) | Media asset strategy — AI-generated audio, prompt-kit pipeline, illustrations parked | Accepted | 2026-07-08 | Media (#20) | builds on ADR-0001; QA via ADR-0003 | Resolves the media-sourcing open question: AI-generate **audio only** (9 SFX then 10 ambient loops) via a **prompt kit** the user runs (no API in repo); naturalistic never-campy house style; illustrations **parked** (lowest priority, no code change to defer); `checkAudioAssets.mjs` validator deferred until files land. Partially enacted — the 9 SFX have shipped (git-tracked in `public/audio/sfx/`); the 10 ambient loops and the `checkAudioAssets.mjs` validator are still pending. |
| [ADR-0007](ADR-0007-cloudflare-worker-deploy.md) | Deploy via a Cloudflare static-assets Worker (retire GitHub Pages) | Enacted | 2026-07-09 | Deployment (#47) | none | Moves the publish target to a Cloudflare assets-only Worker at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/*`: `wrangler.jsonc` + `public/_headers` (real CSP header, adds `frame-ancestors 'none'`) + `scripts/nest-for-cloudflare.mjs` (postbuild nests `dist/*` to match the Worker's 1:1 path mapping). `deploy.yml` keeps the CI gate but stops publishing; Pages unpublished. PR #48 + #49. |
| [ADR-0008](ADR-0008-dependency-major-migration-strategy.md) | Clustered major-dependency migration; defer TypeScript 7; opt out of new lint rules | Enacted | 2026-07-09 | Maintenance | none | Migrated 19 of 20 Dependabot #43 majors (React 19, Vite 8, Vitest 4, Tailwind 4, ESLint 10, …) in dependency-ordered clusters, each gated on lint + validator + test:run + build. **TypeScript held at 5.x** — TS 7 blocked by `typescript-eslint`'s `<6.1.0` peer cap. New ESLint 10 / react-hooks 7 recommended rules opted out (not a refactor in a deps bump). PR #51; #43 closed/superseded. |
| [ADR-0009](ADR-0009-claude-md-pointer-doctrine.md) | CLAUDE.md is a pointer map, not a mirror of docs/ | Enacted | 2026-07-11 | Tooling | extends ADR-0002's one-authority rule | Trimmed CLAUDE.md 339→165 lines: reference detail (engine behavior, component hierarchy, content inventory, type catalogs, completed roadmap) must live only in its authoritative `docs/` file, with CLAUDE.md pointing at it. Ends the recurring sweep tax from duplicated facts drifting. |
| [ADR-0010](ADR-0010-codex-adversarial-review-gates.md) | Codex as cross-provider adversarial reviewer — two mandatory gates | Enacted | 2026-07-11 | Tooling | complements ADR-0004; allowed-content per ADR-0009 | Every non-trivial task passes two Codex (OpenAI) review gates codified in CLAUDE.md: plan reviewed before any mutation; complete task diff vs. starting base reviewed before completion. Codex always read-only; ≤2 rounds/gate; unavailable reviewer announced, never silently skipped. Hardened by Codex's own review of the gate text. |
| [ADR-0011](ADR-0011-comet-club-fourth-main-case.md) | The Comet Club as the fourth main case (flagship scale, mythos breadcrumb live) | Enacted | 2026-07-12 | Content expansion | builds on ADR-0005; gated per ADR-0010 | Ideation pick #1 built first at flagship scale (75 scenes); mythos-period-computed set only on paths that narratively earn it (best ending + deduction-gated eyepiece variant), authored before its Orrery Room consumer exists; RNG-gated Act III entry rejected. PR #76. |

## How to add a new ADR

1. **Pick the next number** (never reused, even if an ADR is later superseded).
2. **Choose a short slug:** `ADR-NNNN-<short-slug>.md`, kept in this directory.
3. **Copy the template** ([ADR-TEMPLATE.md](ADR-TEMPLATE.md)); fill in the YAML front matter and the
   body. If it **supersedes** an existing ADR, set `supersedes:` in the new ADR's front matter and
   `superseded-by:` (plus `status`) in the old one's. If it merely **pairs with** another ADR, link them
   under **Links → Related ADRs** only — the supersession keys are for lifecycle replacement, nothing
   else. (The index's *Relations* column summarises both kinds of link.)
4. **Wire it into the index** (a row above) and link it from [../PROJECT_STATE.md](../PROJECT_STATE.md) → References.

## The immutability rule, precisely

An ADR's *decision content* (Context / Decision / Alternatives considered / Consequences) is written
once and never edited. The mutable parts are the pointers around it: the YAML front matter (`status`,
`superseded-by`), the **Confirmation** section (it names the *current* verification check, so update it
when the check moves — a renamed test, a CI rule replacing a manual review), the **Links** section
(append later commits/PRs/related ADRs; don't remove entries), and the ADR's row in this index. Add a
dated annotation in the index when a change needs explaining. A single ADR can be **partly superseded**
(e.g. one section replaced by a later ADR while the rest stands) — note that here, not in the body.
