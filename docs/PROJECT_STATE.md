# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-07 (**Cleared the P1 code cluster** — issues **#7** (touch/click clue-connection: `ClueCard`
tap + Enter, misleading drag removed, persistent first-time hint), **#8** (real high-contrast stylesheet + shared
`useFocusTrap` hook on all overlays + `inert` background), **#9** (breakdown/incapacitation now render a distinct
"Investigation halted" screen via `isHaltScene`/`haltReason`, not "Case Complete"), **#10** (readable case titles in
HeaderBar + save index via `resolveCaseTitle`), and **#12** test coverage (App routing, dice bands + trained bonus,
`goToScene` onEnter-once, typed `EngineActions` mock, `validateContent`, ErrorBoundary, chained v0→v3 migration).
Adversarial review (5-dimension workflow) surfaced **2 confirmed findings**, both fixed: **HIGH** — a knockout bricked
all later cases because `loadAndStartCase`/`Vignette` never reset composure/vitality or cleared halt flags → now reset
on case load; **LOW** — `LoadGameScreen` showed legacy slug save titles → now de-slugified at the render site. Test
baseline **384 → 481** (44 files). Deferred: **#6** (deduction-gated content — creative, needs #7 first).)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Audit P0 backlog
  **fully cleared** (#1–#5, #11). P1 **code cluster cleared** (#7, #8, #9, #10, #12); **#6** (deduction-gated
  content) is the last open P1 — deferred as creative work that depends on #7. Then media assets.
- **Active gate:** CI enforces it. Every push/PR to `main` runs the validator + `npm run test:run` in the
  `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. Bar unchanged locally:
  test suite green + validator clean before merge.
- **Branch focus:** `fix/p1-code-cluster-touch-a11y-halt-titles` off `main` (`2efb40a`) — the P1 code cluster
  (#7/#8/#9/#10/#12) + the two review fixes. Open PR next. #6 (deduction-gated content) starts from a fresh branch.
- **Verification:** 2026-07-07 — `npm run test:run` → **481 passed (481)** across **44** files (was 384/30);
  `node scripts/validateCase.mjs` → 7 cases clean; `npm run build` (`tsc && vite build`) green. High-contrast
  verified visually via Playwright (before/after: black bg, yellow accents, white text). Adversarial review:
  2 findings, both fixed and re-verified green.

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
| — | Content-authoring automation layer | `[x]` | ADR-0004: `PostToolUse` hook, `content-integrity-reviewer` subagent, `/new-scene` + `/review-content`, `context7`/`github` MCP |
| — | Full Ultracode repo audit + backlog | `[x]` | Report in `docs/audits/`; 67 findings → **22 issues** (5 P0/7 P1/7 P2/3 P3) |
| Q | Audit remediation — P0 blockers | `[x]` | **5/5 done**: CI gate #1 + quick-wins #11 (PR #24); validators #2 + Debt of Smoke #3 (PR #25); encounter escape #4 + onEnter idempotency #5, +F-022/F-027 (PR #28). |
| Q2 | Audit remediation — P1 | `[~]` | Code cluster done: #7 touch-connect, #8 a11y, #9 halt screen, #10 titles, #12 tests (+2 review fixes). **#6 (deduction-gated content) still open** — deferred, depends on #7. |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[ ]` | Systems coded; **no media files ship**. Issues #20 (+ #21/#22 polish). |

---

## Next actions (explicit order)

1. **Finish P1** — only **#6** remains: author deduction-gated content so the headline deduction mechanic pays off (nothing in content references `hasDeduction`/`requiresDeduction` today). Now unblocked — #7 made clue-connection reachable on touch/click. This is creative narrative work; brainstorm which deduction gates which accusation/scene per case before authoring. ✅ Done: P0 (#1–#5, #11); P1 code cluster #7/#8/#9/#10/#12 + 2 review fixes (this branch).
2. **Media assets** (issue #20, then #21/#22 polish): the remaining pre-1.0 milestone once #6 lands — decide sourcing/licensing (open question below), produce the nine SFX `.mp3` files named in [content-authoring.md](content-authoring.md#audio-asset-reference), then illustrations/portraits; verify via the dev server + Playwright MCP (ADR-0003).

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- **How do we source and license media assets?** — Audio (9 SFX + ambient loops) and images (scene illustrations, NPC portraits) are unbuilt. Options: commission, license a pack, or generate. Format/naming is already pinned by `content-authoring.md`; the open part is sourcing + licensing + repo-size impact. → ADR when decided.
- **Audit backlog triage** — 22 issues filed from the Ultracode audit ([report](audits/ULTRACODE_FULL_REPO_ANALYSIS.md)). Not a decision-pending question so much as a work queue: confirm the P0/P1 ordering and whether any P2/P3 items should be deferred/won't-fix. The report also records 5 candidate findings **rejected** by adversarial verification (appendix) — don't re-file those.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted), [ADR-0004](DECISIONS/ADR-0004-content-authoring-automation-layer.md) (content-authoring automation layer, Enacted).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Audit: [`audits/ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-07, 67 findings) → GitHub issues #1–#22.
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
