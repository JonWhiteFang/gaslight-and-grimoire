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
