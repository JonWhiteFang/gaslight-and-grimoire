# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-07 (Cleared **4 audit issues across 2 merged PRs**: **#24** — CI now runs the
test suite + validator and gates deploy, added a `pull_request` trigger, fixed the favicon 404,
`cancel-in-progress: false`, pinned the OWASP action (closes #1, #11); **#25** — unified the build+runtime
content validators into one shared `contentValidation.ts` and extended it (conditions, variants, npcEffect,
encounter edges, reachability), fixed the `hasFlag value:false` engine bug that killed the recovery variants,
repointed 4 dangling clue `sceneSource`s, and re-gated the unreachable *Debt of Smoke* vignette on a persisted
flag (closes #2, #3). Test baseline **334 → 368**. Next P0 group: engine bugs #4 (encounter escape) + #5
(onEnter re-fire).)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Working through
  the audit's P0 backlog: **4 of 5 P0 issues cleared** (#1, #2, #3, #11). Remaining P0: engine bugs #4
  (encounter escape is a dead button) + #5 (onEnter re-fire on revisit/load). Then P1, then media assets.
- **Active gate:** CI now enforces it. Every push/PR to `main` runs the validator + `npm run test:run` in the
  `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. Bar unchanged locally:
  test suite green + validator clean before merge.
- **Branch focus:** `main` (clean, up to date with origin at `dd18933`). Next work starts from a fresh branch
  off `main` for the #4+#5 engine-bug group.
- **Verification:** 2026-07-07 — `npm run test:run` → **368 passed (368)** across **30** files; `node scripts/validateCase.mjs` → 7 cases clean; `npm run build` + `tsc --noEmit` green. CI green on both merged PRs (#24, #25); post-merge deploy on `dd18933` running.

---

## Phase / milestone tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done & verified · `[!]` blocked.
Source of truth for each phase's scope: the Implementation Roadmap in [../CLAUDE.md](../CLAUDE.md); current-state detail in [status.md](status.md).

| # | Title | Status | Notes |
|--:|-------|:------:|-------|
| A | Foundation (loadGame fix, snapshot dedupe, hint wiring, ability fix, validation, firstScene) | `[x]` | Complete |
| B | Core refactoring (pure `computeChoiceResult`, engine↔store decoupled, audio subscription, runtime content validation) | `[x]` | Complete; engine has zero store imports |
| C | Gap filling (ClueDiscoveryCard, save button, faction display, error display, completion screen) | `[x]` | Complete |
| D | Integration (encounter UI, stale-state cleanup, dead-code removal) | `[x]` | Complete |
| E | Game design (active clue discovery, consequence feedback, Veil Sight, recovery, persistent evidence board, faction clamping, CI validation, NPC dialogue, scene history, testing + content depth) | `[x]` | Complete |
| — | Docs rebuild (lean `docs/` set: architecture, engine-reference, content-authoring, status, README) | `[x]` | Complete (recent commits) |
| — | Committed memory spine (this system) | `[x]` | STATE + RUN_LOG + DECISIONS + hook + `/checkpoint` |
| — | Full Ultracode repo audit + backlog | `[x]` | Report in `docs/audits/`; 67 findings → **22 issues** (5 P0/7 P1/7 P2/3 P3) |
| Q | Audit remediation — P0 blockers | `[~]` | **4/5 done**: CI gate #1 + quick-wins #11 (PR #24); validators #2 + Debt of Smoke #3 (PR #25). Remaining: #4, #5. |
| Q2 | Audit remediation — P1 | `[ ]` | Issues #6–#12. Do after the P0 group. |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[ ]` | Systems coded; **no media files ship**. Issues #20 (+ #21/#22 polish). |

---

## Next actions (explicit order)

1. **Finish the P0 group** — the two remaining engine bugs: make encounter escape choices terminal (#4 — `processEncounterChoice` ignores `isEscapePath` before the final round); apply `onEnter` effects once per real transition in `goToScene`, not from a NarrativePanel `useEffect` (#5 — they re-fire on revisit/load). Both are pure engine/store, TDD-friendly. ✅ Done this session: #1, #11 (PR #24); #2, #3 (PR #25).
2. **Then P1 before serious playtesting** (issues #6–#12): author deduction-gated content so the headline mechanic pays off (#6); make clue-connection work on touch/click (#7); the rest (a11y, breakdown dead-end, slug titles, test coverage).
3. **Media assets** (issue #20, then #21/#22 polish): decide sourcing/licensing (open question below), produce the nine SFX `.mp3` files named in [content-authoring.md](content-authoring.md#audio-asset-reference), then illustrations/portraits; verify via the dev server + Playwright MCP (ADR-0003).

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- **How do we source and license media assets?** — Audio (9 SFX + ambient loops) and images (scene illustrations, NPC portraits) are unbuilt. Options: commission, license a pack, or generate. Format/naming is already pinned by `content-authoring.md`; the open part is sourcing + licensing + repo-size impact. → ADR when decided.
- **Audit backlog triage** — 22 issues filed from the Ultracode audit ([report](audits/ULTRACODE_FULL_REPO_ANALYSIS.md)). Not a decision-pending question so much as a work queue: confirm the P0/P1 ordering and whether any P2/P3 items should be deferred/won't-fix. The report also records 5 candidate findings **rejected** by adversarial verification (appendix) — don't re-file those.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Audit: [`audits/ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-07, 67 findings) → GitHub issues #1–#22.
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
