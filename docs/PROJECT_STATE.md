# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-08 (**Media assets (#20) — 9 SFX landed + in-browser QA caught & fixed two release-blockers.**
User generated the 9 SFX; I normalized them (ffmpeg, ~-14 LUFS, de-clipped, trimmed) and ran in-browser Playwright QA.
The QA surfaced **two latent release-blockers no test/validator had caught**: (1) `validateContent` built its bundle
**without `caseData.recipes`**, so `requiresDeduction` read as "unknown key deduction" and **all 3 main cases threw at
load in-browser** (a #6 regression — CLI validator passes recipes so it stayed green); (2) `audioManager` used bare
`/audio/sfx/*.mp3` paths ignoring the Vite base, so **every SFX 404'd in dev AND on GitHub Pages** (extracted pure
`buildSfxSrc` mirroring AmbientAudio). Both fixed TDD; verified in the real running app (Whitechapel loads clean, SFX
fetch base-prefixed 200s for scene-transition/clue/dice). Test baseline **491 → 495** (+4; 47 files). Earlier same day:
media strategy decided (ADR-0006) + prompt kit authored. **Next: ambient loops (10 files) + perceptual SFX QA (needs
human ears) → then `checkAudioAssets.mjs` + CI.**)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Audit P0 backlog
  **fully cleared** (#1–#5, #11). P1 backlog **fully cleared** — the code cluster (#7, #8, #9, #10, #12) plus
  **#6 (deduction-gated content, PR #32)**, the last open P1. The deduction mechanic is now load-bearing.
  **Only remaining pre-1.0 milestone: media assets (#20 + #21/#22 polish).**
- **Active gate:** CI enforces it. Every push/PR to `main` runs the validator + `npm run test:run` in the
  `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. Bar unchanged locally:
  test suite green + validator clean before merge.
- **Branch focus:** `fix/audio-and-deduction-load-blockers` — 2 fix commits (recipes load-validation; SFX base path +
  9 normalized SFX assets) atop the 4 already-pushed docs commits. Media design + prompt kit already on `origin/main`.
  Prior: PR #32 merged, #6 auto-closed.
- **Verification:** 2026-07-08 — `npm run test:run` → **495 passed (495)** across **47** files (was 491/46; +4:
  validateContent recipes regression 1, buildSfxSrc 3); `node scripts/validateCase.mjs` → 7 cases clean;
  `npm run build` green. **In-browser E2E via Playwright MCP** against the running app: after the fix, Whitechapel
  loads with **zero console errors** (previously threw a fatal content-validation error); SFX now fetch
  base-prefixed URLs returning **200** — confirmed live for `scene-transition`, `clue-physical`, `dice-roll`.
  SFX loudness-normalized via ffmpeg (spread 34 dB → ~6 dB around -14 LUFS; hard-clip removed).

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
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[~]` | **Strategy set (ADR-0006)**; prompt kit authored. **9 SFX shipped + normalized + verified loading in-browser** (fixed 2 blockers found in QA). **Pending:** 10 ambient loops; perceptual SFX QA (human ears); `checkAudioAssets.mjs` + CI. **Illustrations parked** (lowest priority). Issues #20 (+ #21/#22). |

---

## Next actions (explicit order)

1. **Perceptual SFX QA (needs human ears)** — the 9 SFX load & trigger correctly in-browser (Playwright-verified), but whether they *sound* right (grounded/never-campy; occult stinger suitably uncanny) can't be machine-checked. One known duration outlier accepted: `clue-deduction` at 2.62s audible. *(User step.)*
2. **User generates the 10 ambient loops** (Stable Audio/Suno per [`audio-asset-kit.md`](../audio-asset-kit.md)) into `public/audio/ambient/`, exact filenames. *(Unblocked; user step.)*
3. **Build `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference) + a unit test. *(Best once ambient files land.)*
4. **Revisit CI wiring** for the checker (likely `--strict`) once all files land. Then **#21/#22 polish**.

✅ Done: **all P0 (#1–#5, #11) and all P1 (#6, #7, #8, #9, #10, #12).** Media strategy decided (ADR-0006), prompt kit authored, **9 SFX shipped + normalized + in-browser-verified** (QA caught & fixed 2 latent release-blockers: recipes load-validation + SFX base-path 404). The audit backlog is now down to P2/P3 polish (#13–#22) plus finishing the media milestone (ambient + QA). **Illustrations parked at lowest priority.**

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
