# Run Log — Gaslight & Grimoire

> Append-only history of working sessions. Newest entry at the **top**. One entry per session.
> Keep entries short — detail that's still *current* belongs in [PROJECT_STATE.md](PROJECT_STATE.md);
> decisions belong in [DECISIONS/](DECISIONS/). This log is the *narrative of what happened, when*.

---

## Entry template (copy this)

```
## YYYY-MM-DD — <short title>
- **Goal:** <what this session set out to do>
- **Did:** <what actually changed — files, decisions, builds>
- **Verified:** <commands/tests run + their results, or "n/a — no code yet">
- **Open / blockers:** <what's unresolved>
- **Memory updated:** STATE ☐ · RUN_LOG ☑ · ADR ☐ (<id if any>)
```

---

## 2026-07-07 — Full Ultracode repo audit + file findings as GitHub issues

- **Goal:** Run a comprehensive read-only, all-angles audit of the repo and produce a report for later remediation; then file the findings as GitHub issues.
- **Did:** Ran a 13-dimension adversarial audit (110 subagents: one finder per dimension, one independent skeptic re-opening cited files per finding). 97 findings verified, 5 rejected as false positives; deduped to **67 canonical findings** (2 High, ~19 Medium, ~40 Low/Polish). Wrote the report (now at `docs/audits/ULTRACODE_FULL_REPO_ANALYSIS.md` — the user moved it there from repo root). Created priority + category labels and filed **22 grouped GitHub issues** (#1–#22: 5 P0, 7 P1, 7 P2, 3 P3) on `JonWhiteFang/gaslight-and-grimoire`. Independently re-verified the anchor findings (e.g. `npc-sable` max disposition +4 vs unlock threshold 7 → *Debt of Smoke* unreachable; 0 `requiresDeduction`/`hasDeduction` refs in content; `ClueCard` has `draggable` + `onKeyDown` only, no click/touch). Updated PROJECT_STATE to correct the "media is the only remaining work" framing (now false), add an audit + a P0/P1 remediation milestone row, reorder Next actions, and link the report. **No code changed.**
- **Verified:** `npm run test:run` → **334 passed (334)**, 29 files (unchanged). `node scripts/validateCase.mjs` → 7 cases clean. `npm run build` green (402 KB JS / 125 KB gzip). `npm audit` → 0 vulns. `gh issue list` → 22 open issues. Audit method is read-only; runtime-behaviour findings (encounter escape, onEnter re-fire, touch connect) are confirmed from code+content and flagged in the report for an optional Playwright MCP click-through.
- **Doc-drift sweep (flagged, NOT auto-fixed — each is now a filed issue, so fixing piecemeal here would make the issue stale on day one):** (1) `CLAUDE.md:197` says save "Current version: 1" but `saveManager.ts:14` is `CURRENT_SAVE_VERSION = 2`; `CLAUDE.md:305` wrongly lists `saveManager` under `Date.now()/Math.random()` users → **issue #17**. (2) `docs/status.md:70`/`CLAUDE.md` present high-contrast as "applied", but the audit found the `.high-contrast` class is consumed by nothing (inert) → **issue #8**. (3) `CLAUDE.md:51` references a `<GameScreen>` component that doesn't exist → **issue #17**. Left these to their issues rather than editing four bundled drifts one at a time. No drift found in the spine itself.
- **Open / blockers:** 22-issue backlog is the new work queue; P0 issues (#1–#5) are correctness/CI blockers that should precede media assets. No blockers. The relocated report under `docs/audits/` is untracked — surfaced for the user to commit.
- **Memory updated:** STATE ☑ · RUN_LOG ☑ · ADR ☐ (no new architectural decision — the audit records findings, it doesn't decide a direction)

## 2026-07-07 — Add Playwright MCP server (project scope)

- **Goal:** Install a browser-driving MCP capability so the running game can be verified end-to-end (the one open milestone, media assets, only shows up at runtime).
- **Did:** Added `@playwright/mcp` at **project scope** via committed `.mcp.json` (`claude mcp add playwright -s project`). Chose project over local/user scope for team-shareability, consistent with the repo's committed-tooling convention. Recorded the rationale in **ADR-0003** (Enacted) and wired it into the ADR index. Updated PROJECT_STATE: `_Last updated:_`, References (ADR-0003), and Next actions (media-asset steps now note Playwright can verify in-browser).
- **Verified:** `.mcp.json` valid JSON, registers `playwright`; `npx @playwright/mcp@latest --version` → 0.0.77; Playwright Chromium binary already cached. `claude mcp list` → server registered, `⏸ Pending approval` (expected one-time gate for committed MCP). Ground-truth baseline unchanged: `npm run test:run` → **334 passed (334)**, 29 files; `node scripts/validateCase.mjs` → 7 cases clean. Doc-drift sweep: no doc references MCP/Playwright, so no drift; STATE counts still accurate.
- **Open / blockers:** Playwright MCP needs one-time approval on next `claude` launch in this repo before its tools go live. Media assets remain the one open milestone. No blockers.
- **Memory updated:** STATE ☑ · RUN_LOG ☑ · ADR ☑ (ADR-0003)

## 2026-07-07 — First `/checkpoint`: exercise the loop, enact ADR-0002

- **Goal:** Run the first real end-of-session `/checkpoint` to verify the memory-spine loop works, and enact ADR-0002 now that its follow-up condition is met.
- **Did:** Doc-drift sweep (scoped to this session's docs) found no drift — STATE/status.md `334/334` + `29 files`, content counts, and the CLAUDE.md hook path all match code/git/config. Flipped **ADR-0002 Accepted→Enacted** (status line annotated with the transition; Follow-up struck through with a dated note — original decision text preserved). Updated the ADR index row to Enacted. Bumped PROJECT_STATE `_Last updated:_` and marked both ADRs Enacted in References. Confirmed the `/checkpoint` skill and `SessionStart` hook load (post `/reload-plugins`: "2 hooks, 1 skill").
- **Verified:** `npm run test:run` → **334 passed (334)**, 29 files. `node scripts/validateCase.mjs` → all 7 cases clean. Working tree was clean at session start (prior spine work already committed as `04e7485` and pushed).
- **Open / blockers:** Media assets remain the one open milestone — see PROJECT_STATE Open questions. No blockers.
- **Memory updated:** STATE ☑ · RUN_LOG ☑ · ADR ☑ (ADR-0002 → Enacted)

## 2026-07-07 — Stand up the committed memory spine

- **Goal:** Set up the committed, version-controlled project-memory spine (PROJECT_STATE / RUN_LOG / DECISIONS + session-start hook + `/checkpoint` skill), adapted to G&G's real state.
- **Did:** Added `docs/PROJECT_STATE.md` (one-page snapshot; phase tracker A–E done, media-assets the one open milestone; scope-gate tracker and scope ledger dropped as not applicable to a feature-complete project). Added `docs/RUN_LOG.md` (this file). Added `docs/DECISIONS/` with `ADR-TEMPLATE.md`, `README.md` (index), `ADR-0001-content-engine-separation.md` (architecture baseline, Enacted), and `ADR-0002-committed-memory-spine.md` (this system, Accepted). Added `.claude/hooks/session-preflight.sh` (git state + top of PROJECT_STATE) and wired a `SessionStart` hook into `.claude/settings.json` while preserving the existing `permissions` block. Added `.claude/skills/checkpoint/SKILL.md`. Added a "Project memory" pointer section to `CLAUDE.md`.
- **Verified:** `npm run test:run` → **334 passed (334)**, 29 files. `node scripts/validateCase.mjs` → all 7 cases clean. `.claude/settings.json` parses as valid JSON (`jq`). Hook script runs standalone and emits valid `additionalContext` JSON.
- **Open / blockers:** Media assets (audio + illustrations + NPC portraits) remain unbuilt — see PROJECT_STATE Open questions. No blockers.
- **Memory updated:** STATE ☑ · RUN_LOG ☑ · ADR ☑ (ADR-0001, ADR-0002)
