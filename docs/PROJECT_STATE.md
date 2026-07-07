# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-07 (Ran a full read-only Ultracode repo audit — report at
[audits/ULTRACODE_FULL_REPO_ANALYSIS.md](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) — and filed its findings as
**22 GitHub issues** (5 P0, 7 P1, 7 P2, 3 P3). Correction to prior state: media assets are **no longer** the
only open work — the audit surfaced P0 correctness/CI blockers (unreachable vignette, dead encounter-escape
button, onEnter re-fire, tests not in CI) and that the headline deduction mechanic is unused by content. No
code changed this session; 334 tests still green.)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes), **but** a full
  audit found the build is not yet playtest-ready: two headline mechanics are broken/unused and content is
  shipped that can't be reached. Work now has a triaged backlog (22 issues) on top of the media-assets gap.
- **Active gate:** none formal. Quality bar in force: `npm run test:run` green + `node scripts/validateCase.mjs` clean before any merge to `main`. (Audit issue #1 proposes making the test run an actual CI gate — it currently is not.)
- **Branch focus:** `main` (clean, aside from the untracked audit report under `docs/audits/`). Next work starts from a fresh branch off `main`, beginning with the P0 issues.
- **Verification:** 2026-07-07 — `npm run test:run` → **334 passed (334)** across **29** files; content validation clean for all 7 cases; `npm run build` last known good. (These pass, but the audit shows green tests/validator do **not** cover the P0 defects — see issues #1, #2.)

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
| E | Game design (active clue discovery, consequence feedback, Veil Sight, recovery, persistent evidence board, faction clamping, CI validation, NPC dialogue, scene history, testing + content depth) | `[x]` | Complete — 334 tests |
| — | Docs rebuild (lean `docs/` set: architecture, engine-reference, content-authoring, status, README) | `[x]` | Complete (recent commits) |
| — | Committed memory spine (this system) | `[x]` | STATE + RUN_LOG + DECISIONS + hook + `/checkpoint` |
| — | Full Ultracode repo audit + backlog | `[x]` | Report in `docs/audits/`; 67 findings → **22 issues** (5 P0/7 P1/7 P2/3 P3) |
| Q | Audit remediation — P0 correctness/CI blockers, then P1 | `[ ]` | Issues #1–#12. Do **before** media assets. |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[ ]` | Systems coded; **no media files ship**. Issues #20 (+ #21/#22 polish). |

---

## Next actions (explicit order)

1. **Clear the P0 audit blockers first** (issues #1–#5): put the test suite in CI + gate deploy (#1); extend/unify the content validators (#2); fix the permanently-unreachable *Debt of Smoke* vignette (#3); make encounter escape choices terminal (#4); apply `onEnter` effects idempotently in `goToScene` (#5). These are correctness/CI, not polish.
2. **Then P1 before serious playtesting** (issues #6–#12): author deduction-gated content so the headline mechanic pays off (#6); make clue-connection work on touch/click (#7); the rest (a11y, breakdown dead-end, slug titles, deploy quick-wins, test coverage).
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
