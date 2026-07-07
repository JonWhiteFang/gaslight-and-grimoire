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

## 2026-07-07 — Stand up the committed memory spine

- **Goal:** Set up the committed, version-controlled project-memory spine (PROJECT_STATE / RUN_LOG / DECISIONS + session-start hook + `/checkpoint` skill), adapted to G&G's real state.
- **Did:** Added `docs/PROJECT_STATE.md` (one-page snapshot; phase tracker A–E done, media-assets the one open milestone; scope-gate tracker and scope ledger dropped as not applicable to a feature-complete project). Added `docs/RUN_LOG.md` (this file). Added `docs/DECISIONS/` with `ADR-TEMPLATE.md`, `README.md` (index), `ADR-0001-content-engine-separation.md` (architecture baseline, Enacted), and `ADR-0002-committed-memory-spine.md` (this system, Accepted). Added `.claude/hooks/session-preflight.sh` (git state + top of PROJECT_STATE) and wired a `SessionStart` hook into `.claude/settings.json` while preserving the existing `permissions` block. Added `.claude/skills/checkpoint/SKILL.md`. Added a "Project memory" pointer section to `CLAUDE.md`.
- **Verified:** `npm run test:run` → **334 passed (334)**, 29 files. `node scripts/validateCase.mjs` → all 7 cases clean. `.claude/settings.json` parses as valid JSON (`jq`). Hook script runs standalone and emits valid `additionalContext` JSON.
- **Open / blockers:** Media assets (audio + illustrations + NPC portraits) remain unbuilt — see PROJECT_STATE Open questions. No blockers.
- **Memory updated:** STATE ☑ · RUN_LOG ☑ · ADR ☑ (ADR-0001, ADR-0002)
