# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-08 (**Closed the P2 refactor cluster — #13/#14/#18/#19 — via PR #35 (merged `760f182`).**
Internal-quality hardening, 11 tasks / 15 findings, no behavior change except one intended fix (Advantage badge now shows
for a Lore check under Veil Sight, F-014). New single-source modules: `flags.ts` (flag keys), `constants.ts`
(FACTIONS/OUTCOME_TIERS/assertNever), `advantage.ts` (unified `computeAdvantage`); `narrativeEngine.ts` split into
`contentLoader`/`conditions`/`choiceResolution`/`encounters` behind a barrel (zero importer churn). `Condition` →
discriminated union; `lastCriticalFaculty` → typed `Investigator` field (was a smuggled flag); save migration fixed for
versionless saves (F-015); encounter undefined-nav guard (F-022); reset/adapter/archetype-table de-dup; worldSlice
`assertNever` guard. Executed subagent-driven (TDD + per-task spec+quality review + final whole-branch review, no
Critical/Important). Test baseline **495 → 522** (+27; 52 files). **Earlier same day:** 9 SFX landed + normalized + 2
QA-found blockers fixed (PR #34); media strategy ADR-0006 + prompt kit. **Next: ambient loops (10 files) + perceptual
SFX QA (human ears) → `checkAudioAssets.mjs` + CI. Remaining backlog: P2 #15/#16/#17, P3 #20/#21/#22.**)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases, 198 scenes). Audit P0 backlog
  **fully cleared** (#1–#5, #11). P1 backlog **fully cleared** — the code cluster (#7, #8, #9, #10, #12) plus
  **#6 (deduction-gated content, PR #32)**, the last open P1. The deduction mechanic is now load-bearing.
  **Only remaining pre-1.0 milestone: media assets (#20 + #21/#22 polish).**
- **Active gate:** CI enforces it. Every push/PR to `main` runs the validator + `npm run test:run` in the
  `test` job; `build` → `deploy` depend on it, and `deploy` is skipped on PR events. Bar unchanged locally:
  test suite green + validator clean before merge.
- **Branch focus:** `main` (at `760f182`, **PR #35 merged**) — P2 refactor cluster #13/#14/#18/#19 closed. Next work
  starts from a fresh branch off `main`. Prior same day: PR #34 (SFX + blockers), PR #32 (#6).
- **Verification:** 2026-07-08 — `npm run test:run` → **522 passed (522)** across **52** files (was 495/47; +27 across
  new/expanded suites: flags, constants, advantage, archetypes, saveMigration, worldSlice-effects, +condition/encounter
  additions); `node scripts/validateCase.mjs` → 7 cases clean; `npm run build` (`tsc && vite build`) green;
  `npx tsc --noEmit` clean (proves the discriminated-union `Condition` + narrativeEngine barrel split satisfy every
  consumer). Per-task TDD + spec+quality reviews; final whole-branch integration review found no Critical/Important
  issues. CI green on PR #35 (test/build/OWASP; deploy skipped on PR, ran post-merge).

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
| Q3′ | Audit remediation — remaining P2 | `[ ]` | Open: **#15** (ESLint/tooling/CI), **#16** (perf: unstable selector + code-split), **#17** (docs drift + root README). |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[~]` | **Strategy set (ADR-0006)**; prompt kit authored. **9 SFX shipped + normalized + verified loading in-browser** (fixed 2 blockers found in QA). **Pending:** 10 ambient loops; perceptual SFX QA (human ears); `checkAudioAssets.mjs` + CI. **Illustrations parked** (lowest priority). Issues #20 (+ #21/#22). |

---

## Next actions (explicit order)

**Media track (partly user-blocked):**
1. **Perceptual SFX QA (needs human ears)** — the 9 SFX load & trigger correctly in-browser (Playwright-verified), but whether they *sound* right (grounded/never-campy; occult stinger suitably uncanny) can't be machine-checked. One known duration outlier accepted: `clue-deduction` at 2.62s audible. *(User step.)*
2. **User generates the 10 ambient loops** (Stable Audio/Suno per [`audio-asset-kit.md`](../audio-asset-kit.md)) into `public/audio/ambient/`, exact filenames. *(Unblocked; user step.)*
3. **Build `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference) + a unit test, then revisit CI wiring (likely `--strict`) once all files land. *(Best once ambient files land.)*

**Code track (not blocked — viable now while awaiting ambient loops):**
4. **P2 #15** (ESLint + lint CI, pin Node, drop unused dep, move audit off deploy, Dependabot), **#16** (perf: unstable `buildGameState` selector + code-split overlays/screens), **#17** (docs drift + root README). Then **P3 #21/#22** polish.

✅ Done: **all P0 (#1–#5, #11), all P1 (#6–#10, #12), and the P2 refactor cluster (#13, #14, #18, #19 — PR #35).** Media strategy decided (ADR-0006), prompt kit authored, **9 SFX shipped + normalized + in-browser-verified** (QA caught & fixed 2 latent release-blockers). Remaining audit backlog: **P2 #15/#16/#17**, **P3 #21/#22**, plus the media milestone (#20 — ambient + QA). **Illustrations parked at lowest priority.**

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
