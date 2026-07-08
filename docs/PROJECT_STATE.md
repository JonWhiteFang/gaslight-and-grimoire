# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-08 (**Media assets (#20) — design + prompt kit authored; sourcing question resolved via ADR-0006.**
Brainstormed the media strategy to a decision: **AI-generate audio only** (illustrations parked at lowest priority — no
code change to defer), **9 SFX first then 10 ambient loops**, delivered as a **prompt kit the user runs** (no API/keys in
repo). House style: naturalistic Victorian period ambience, never campy; the supernatural leaks through only at the occult
stinger and `cellar`/`seance` beds. Wrote the design spec + authored `docs/audio-asset-kit.md` (all 19 prompts, verified
1:1 against the engine's SFX paths and content's `ambientAudio` names — no typos). Docs only this session; **no code, no
content, no test change** (baseline stays 491/46). **Next: user generates the 19 files → then build `checkAudioAssets.mjs`
+ QA pass** (both asset-blocked). Prior session: closed #6 (deduction-gated content, PR #32, `b319f09`).)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Audit P0 backlog
  **fully cleared** (#1–#5, #11). P1 backlog **fully cleared** — the code cluster (#7, #8, #9, #10, #12) plus
  **#6 (deduction-gated content, PR #32)**, the last open P1. The deduction mechanic is now load-bearing.
  **Only remaining pre-1.0 milestone: media assets (#20 + #21/#22 polish).**
- **Active gate:** CI enforces it. Every push/PR to `main` runs the validator + `npm run test:run` in the
  `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. Bar unchanged locally:
  test suite green + validator clean before merge.
- **Branch focus:** `main` — **3 unpushed doc commits** (`f6bc29e` spec, `42de32f` decisions, `19908f9` prompt kit)
  ahead of origin `b319f09`. Media-asset design landed as docs on `main` (no code branch needed yet; the build work
  is asset-blocked). Prior: PR #32 merged, #6 auto-closed.
- **Verification:** 2026-07-08 — docs-only session, **no code/content/test change**; baseline unchanged at
  **491 passed (491)** across **46** files (last run 2026-07-08, prior session). Prompt-kit asset names verified
  1:1 by grep against `SFX_PATHS` in `audioManager.ts` (9 SFX) and the distinct `ambientAudio` values in
  `public/content/**` (10 loops) — exact match, no typos. `checkAudioAssets.mjs` not yet built (asset-blocked).

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
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[~]` | **Strategy set (ADR-0006):** AI-gen **audio only**; design spec + prompt kit (`docs/audio-asset-kit.md`, 19 assets) authored. **Asset-blocked:** user generates files → then `checkAudioAssets.mjs` + QA. **Illustrations parked** (lowest priority). Issues #20 (+ #21/#22). |

---

## Next actions (explicit order)

1. **User generates the 19 audio files** using the prompt kit ([`audio-asset-kit.md`](../audio-asset-kit.md)) — 9 SFX (ElevenLabs SFX) into `public/audio/sfx/`, then 10 ambient loops (Stable Audio/Suno) into `public/audio/ambient/`, exact filenames per the kit. *(Unblocked; this is the user's step.)*
2. **Build `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference) + a unit test for its cross-reference logic. *(Asset-blocked — needs files present to be meaningful.)*
3. **Manual QA pass** per the kit checklist (loop seams, SFX-over-bed mix, each trigger fires); verify via dev server + Playwright MCP (ADR-0003). *(Asset-blocked.)*
4. **Revisit CI wiring** for the checker (likely `--strict`) once files land. Then **#21/#22 polish**.

✅ Done: **all P0 (#1–#5, #11) and all P1 (#6, #7, #8, #9, #10, #12).** Media strategy decided (ADR-0006) — design spec + prompt kit authored. The audit backlog is now down to P2/P3 polish (#13–#22) plus finishing the media milestone. **Illustrations parked at lowest priority** (no code change to defer).

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- ~~**How do we source and license media assets?**~~ **RESOLVED 2026-07-08 → [ADR-0006](DECISIONS/ADR-0006-media-asset-strategy.md).** AI-generate **audio only** via a prompt kit the user runs (no API in repo); illustrations parked at lowest priority. Naturalistic never-campy house style. Prompt kit authored: [`audio-asset-kit.md`](../audio-asset-kit.md).
- **Audit backlog triage** — 22 issues filed from the Ultracode audit ([report](audits/ULTRACODE_FULL_REPO_ANALYSIS.md)). Not a decision-pending question so much as a work queue: confirm the P0/P1 ordering and whether any P2/P3 items should be deferred/won't-fix. The report also records 5 candidate findings **rejected** by adversarial verification (appendix) — don't re-file those.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted), [ADR-0004](DECISIONS/ADR-0004-content-authoring-automation-layer.md) (content-authoring automation layer, Enacted), [ADR-0005](DECISIONS/ADR-0005-key-deduction-recipes.md) (stable deduction identity via key-deduction recipes, Enacted), [ADR-0006](DECISIONS/ADR-0006-media-asset-strategy.md) (media asset strategy — AI-generated audio, prompt-kit pipeline, illustrations parked, Accepted).
- Media: [audio asset prompt kit](../audio-asset-kit.md) · [design spec](superpowers/specs/2026-07-08-audio-asset-kit-design.md).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Audit: [`audits/ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-07, 67 findings) → GitHub issues #1–#22.
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
