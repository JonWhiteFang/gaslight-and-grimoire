# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-08 (**Closed #6 — deduction-gated content, the last open P1** — PR #32 merged to `main`
at `b319f09`). Gave deductions a stable, authorable identity (`KeyDeduction` recipes in per-case `deductions.json`)
so `hasDeduction`/`requiresDeduction` gates finally resolve — previously deductions stored under a random id, so the
mechanic was decorative. New pure `matchDeduction` (subset match) + `buildDeductionFromRecipe`; `loadCase` fetches the
optional `deductions.json` into `caseData.recipes`; `DeductionButton` stores a matched deduction under the authored id
(random-id fallback preserved); validator (+ CLI) now enforce recipe clue refs and gate targets against the recipe-id
registry. Content: one key deduction per main case gating a new **true ending** (Whitechapel → Harland exposed;
Mayfair → fraud-and-breach dual truth; Lamplighter's → Croke/Court murder, also gated on `lw-bell-alliance`); existing
endings remain reachable (case always completable). `content-integrity-reviewer` caught + fixed a Harland-rank
continuity error, a Mayfair causal-attribution slip, and a Lamplighter's missing Veil-Key resolution. Test baseline
**481 → 491** (46 files). **Next: media assets (#20).**)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Audit P0 backlog
  **fully cleared** (#1–#5, #11). P1 backlog **fully cleared** — the code cluster (#7, #8, #9, #10, #12) plus
  **#6 (deduction-gated content, PR #32)**, the last open P1. The deduction mechanic is now load-bearing.
  **Only remaining pre-1.0 milestone: media assets (#20 + #21/#22 polish).**
- **Active gate:** CI enforces it. Every push/PR to `main` runs the validator + `npm run test:run` in the
  `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. Bar unchanged locally:
  test suite green + validator clean before merge.
- **Branch focus:** `main` (up to date with origin at `b319f09`, **PR #32 merged**) — deduction-gated content
  landed; issue #6 auto-closed. Media assets (#20) start from a fresh branch off `main`.
- **Verification:** 2026-07-08 — `npm run test:run` → **491 passed (491)** across **46** files (was 481/44;
  +10: matchDeduction 6, contentValidation.deduction 4); `node scripts/validateCase.mjs` → 7 cases clean;
  `npm run build` (`tsc && vite build`) green. **In-browser E2E via Playwright MCP** against the real app
  modules: recipe reaches `caseData` via `loadCase`; connecting recipe clues fires `matchDeduction` and stores
  under the authored id; partial connection does not match; the gated choice is hidden without the deduction
  and visible with it, routing to the new true ending. Final cross-task integration review: approved.

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
| Q2 | Audit remediation — P1 | `[x]` | **Complete.** Code cluster: #7 touch-connect, #8 a11y, #9 halt screen, #10 titles, #12 tests (+2 review fixes). **#6 (deduction-gated content) done — PR #32**: KeyDeduction recipes + gated true endings across all 3 main cases. |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[ ]` | Systems coded; **no media files ship**. Issues #20 (+ #21/#22 polish). |

---

## Next actions (explicit order)

1. **Media assets** (issue #20, then #21/#22 polish) — **the sole remaining pre-1.0 milestone.** Decide sourcing/licensing first (open question below), then produce the nine SFX `.mp3` files named in [content-authoring.md](content-authoring.md#audio-asset-reference), then illustrations/portraits; verify via the dev server + Playwright MCP (ADR-0003).

✅ Done: **all P0 (#1–#5, #11) and all P1 (#6, #7, #8, #9, #10, #12).** #6 (deduction-gated content) landed in PR #32 — `KeyDeduction` recipes give deductions a stable, gate-able identity, and each main case has a deduction-gated true ending. The audit backlog is now down to P2/P3 polish (#13–#22) plus the media milestone.

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- **How do we source and license media assets?** — Audio (9 SFX + ambient loops) and images (scene illustrations, NPC portraits) are unbuilt. Options: commission, license a pack, or generate. Format/naming is already pinned by `content-authoring.md`; the open part is sourcing + licensing + repo-size impact. → ADR when decided.
- **Audit backlog triage** — 22 issues filed from the Ultracode audit ([report](audits/ULTRACODE_FULL_REPO_ANALYSIS.md)). Not a decision-pending question so much as a work queue: confirm the P0/P1 ordering and whether any P2/P3 items should be deferred/won't-fix. The report also records 5 candidate findings **rejected** by adversarial verification (appendix) — don't re-file those.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted), [ADR-0004](DECISIONS/ADR-0004-content-authoring-automation-layer.md) (content-authoring automation layer, Enacted), [ADR-0005](DECISIONS/ADR-0005-key-deduction-recipes.md) (stable deduction identity via key-deduction recipes, Enacted).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Audit: [`audits/ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-07, 67 findings) → GitHub issues #1–#22.
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
