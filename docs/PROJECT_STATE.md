# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-08 (**Closed P3 #21 hardening — PR #45 merged (`d57b41a`).** Behavioral: F-057
`checkVignetteUnlocks` now returns **all** satisfied vignettes, not just the first (`vignetteUnlocked` → `vignettesUnlocked: string[]`);
F-036 `SaveManager.load` guards the blob envelope + `isValidGameState` shape so a corrupt save returns null instead of
poisoning the store. Save/UX: F-052 save-success toast + eviction warning, F-054 two-tap delete confirm, F-055 loading
screen while a save loads. Storage/CI: F-037 CSP residuals documented (style-src unsafe-inline load-bearing; no
frame-ancestors on Pages), F-038 `npm ci --ignore-scripts` in all CI jobs. Reviewed via finder agent → no bugs (one toast-timer
nit fixed). Test baseline **524 → 547** (+23; 55 files). **Earlier same day:** engine-reference doc rewrite for the
narrativeEngine split (PR #44); P2 #15/#16/#17 cluster (PR #37). **Remaining backlog: P3 #20 (media — ambient loops + QA,
partly user-blocked) and #22 (perf + a11y polish).**)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Audit P0 backlog
  **fully cleared** (#1–#5, #11). P1 backlog **fully cleared** — the code cluster (#7, #8, #9, #10, #12) plus
  **#6 (deduction-gated content, PR #32)**, the last open P1. The deduction mechanic is now load-bearing.
  **The entire P0/P1/P2 audit backlog plus P3 #21 is cleared** — only P3 **#20 (media)** and **#22 (perf + a11y polish)** remain.
- **Active gate:** CI enforces it. Every push/PR to `main` runs `npm run lint` + the validator + `npm run test:run` in
  the `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. CI installs run
  `npm ci --ignore-scripts` (F-038). Bar unchanged locally: lint + test suite green + validator clean before merge.
- **Branch focus:** `main` (at `d57b41a`, **PR #45 merged**) — P3 #21 hardening closed. Next work starts from a fresh
  branch off `main`. Prior same day: PR #44 (engine-reference doc rewrite), PR #37 (P2 #15/#16/#17), PR #35 (#13/#14/#18/#19).
- **Verification:** 2026-07-08 — `npm run test:run` → **547 passed (547)** across **55** files (was 524/53; +23 for the
  new saveValidation + metaSlice.saveGame suites and expanded caseProgression/LoadGameScreen); `npm run lint` → clean;
  `node scripts/validateCase.mjs` → 7 cases clean; `npm run build` green (chunks split); `npx tsc --noEmit` clean.
  Reviewed via a correctness-finder agent → no bugs; one cosmetic toast-timer nit fixed before commit. CI green on PR #45.

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
| Q3 | Audit remediation — P2 refactor cluster | `[x]` | **Complete — PR #35** (`760f182`). #13/#14/#18/#19: flags/constants/advantage SoT modules, `narrativeEngine` split (barrel), discriminated `Condition`, typed `lastCriticalFaculty`, save-migration + encounter-nav fixes, de-dup + `assertNever` guard. 15 findings; 495→522 tests. |
| Q3′ | Audit remediation — remaining P2 | `[x]` | **Complete — PR #37** (`dd53816`). #15 (ESLint + lint CI, Node pin, dep drop, audit off deploy, Dependabot), #16 (`useGameState`/`useShallow` selector fix + lazy overlays + vendor chunks; entry 410→92 KB), #17 (CLAUDE.md drift + root README). +2 tests. |
| Q4 | Audit remediation — P3 #21 hardening | `[x]` | **Complete — PR #45** (`d57b41a`). F-057 (all vignettes unlock, not just first), F-036 (save-load shape guard), F-052 (save toast + eviction warn), F-054 (two-tap delete confirm), F-055 (load indicator), F-037 (CSP residuals documented), F-038 (`--ignore-scripts` in CI). 524→547 tests. |
| — | Docs — engine-reference rewrite for narrativeEngine split | `[x]` | **PR #44** (`472ef32`). Documents the 4 split modules + advantage/flags/constants/haltScenes; fixed save-version/`lastCriticalFaculty`/`save()`-signature drift. Cleared the last flagged doc item. |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[~]` | **Strategy set (ADR-0006)**; prompt kit authored. **9 SFX shipped + normalized + verified loading in-browser** (fixed 2 blockers found in QA). **Pending:** 10 ambient loops; perceptual SFX QA (human ears); `checkAudioAssets.mjs` + CI. **Illustrations parked** (lowest priority). Issue #20. |
| P | Audit remediation — P3 #22 polish (perf + a11y) | `[ ]` | Open: F-044..F-051 — EvidenceBoard scroll throttling, `useShallow`/memo on list items, LazyMotion, reduced-motion gaps, WCAG contrast, skip-link, focusable typewriter skip. |

---

## Next actions (explicit order)

**Media track (partly user-blocked):**
1. **Perceptual SFX QA (needs human ears)** — the 9 SFX load & trigger correctly in-browser (Playwright-verified), but whether they *sound* right (grounded/never-campy; occult stinger suitably uncanny) can't be machine-checked. One known duration outlier accepted: `clue-deduction` at 2.62s audible. *(User step.)*
2. **User generates the 10 ambient loops** (Stable Audio/Suno per [`audio-asset-kit.md`](../audio-asset-kit.md)) into `public/audio/ambient/`, exact filenames. *(Unblocked; user step.)*
3. **Build `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference) + a unit test, then revisit CI wiring (likely `--strict`) once all files land. *(Best once ambient files land.)*

**Code track:**
4. **P3 #22 (perf + a11y polish)** is the only remaining code-actionable audit issue — EvidenceBoard scroll throttling (rAF + cached rects), `useShallow`/`React.memo` on `ChoiceCard`/`ClueCard` list items, `LazyMotion`+`m` for framer, reduced-motion gating on `ConnectionThread`/`DeductionButton`, WCAG-AA contrast on helper text, a skip-to-content link, and a focusable/keyboard typewriter-skip control. Verify with `jest-axe` + Profiler.

✅ Done: **all P0 (#1–#5, #11), all P1 (#6–#10, #12), all P2 (#13–#19 — PRs #35/#37), P3 #21 hardening (PR #45), and the engine-reference doc rewrite (PR #44).** Media strategy decided (ADR-0006), prompt kit authored, **9 SFX shipped + normalized + in-browser-verified** (QA caught & fixed 2 latent release-blockers). Remaining audit backlog: **P3 #22** (polish), plus the media milestone (#20 — ambient + QA). **Illustrations parked at lowest priority.**

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
