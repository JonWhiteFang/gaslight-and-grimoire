# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-09 (**Audit-2 P0 #53 FIXED — auto-succeed ability now consumed once + check pipelines unified (PR #62).**)
The archetype once-per-case auto-succeed ability (F-101) was set-and-never-cleared, so it auto-crit **every** subsequent
same-faculty choice-check for the rest of the case; its mirror (F-107) left the same ability dead inside encounters (a
parallel check pipeline that ignored the flag + `dynamicDifficulty`). Fix: extracted a single pure
`resolveCheckOutcome(choice, state, label)` in `choiceResolution.ts` that BOTH `computeChoiceResult` and
`processEncounterChoice` call (so the two paths can't drift again); both now **consume** the flag on use via
`actions.setFlag(flag, false)`. TDD (RED watched). Also replaced the two self-fulfilling `setState`-simulation guard tests
in `AbilityButton.test.tsx` with ones driving the real `resetForNewCase`. Test baseline **554→558**; lint + validator +
build green; **all six CI checks pass on PR #62**. Doc-drift sweep fixed `status.md` baseline 554→558 and the
`processChoice`/`computeChoiceResult`/`processEncounterChoice` behaviour lines in `CLAUDE.md` + `engine-reference.md`
(added `resolveCheckOutcome` + flag-consumption). **Audit-2 code backlog remaining: #54 (P0), #55/#56/#57 (P1),
#59/#60 (P2/P3).** — Prior this session (below): audit-2 #58 doc-drift (PR #61); the audit itself.
Second full Ultracode repo audit — analysis only, no code changed. Ran the
command battery (all green — 554 tests, lint, validator, build, 0 npm vulns) then an orchestrated 13-dimension
adversarial fan-out (71 agents) + lead verification. 37 raw → **23 root-cause-deduped verified findings** (new IDs
**F-101…F-123**, distinct from the prior F-001…F-067); 4 rejected as false positives. Report:
[`2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md`](../2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md) (repo root). Overall
risk **Medium**. Filed **8 grouped GitHub issues (#53–#60)**: two **P0** gameplay blockers — **#53** archetype
auto-succeed ability never consumed (auto-crits every same-faculty check all case; F-101/F-107) and **#54** Mayfair
true ending RNG-locked behind two nat-20s (F-102) — plus P1 save/reload safety (#55), scene-transition state hygiene
(#56), a11y/error-messaging incl. a React-19 `inert=''` regression (#57), docs-drift incl. `architecture.md` documenting
the F-006 anti-pattern (#58), P2 test-quality (#59), P3 CI type-checking (#60). **This reopens the audit backlog**
(previously "cleared except #20"). Test baseline **554** (unchanged; 56 files — no code touched). Removed two stray
build artifacts (`vite.config.js`/`.d.ts`) `tsconfig.node.json`'s `composite:true` emitted during the audit build; the
`.gitignore` gap that let them appear is flagged for follow-up. Prior (same day): PR #51 dep major-group migration
(ADR-0008); #47 Cloudflare Worker deploy (ADR-0007).)_

---

## Current position

- **Stage:** Phases A–E complete and the game is playable end-to-end (7 cases). The **first** audit's backlog
  (#1–#22, findings F-001…F-067) is fully cleared except **#20 (media assets)**. **Second audit (2026-07-09) backlog
  #53–#60 (F-101…F-123): #53 (P0 auto-succeed) FIXED (PR #62), #58 (P1 docs) done (PR #61).** Remaining: **#54 (P0
  Mayfair true ending RNG-locked)** — do this next — plus #55/#56/#57 (P1) and #59/#60 (P2/P3). See the audit report +
  the issues.
- **Deployment:** **Cloudflare static-assets Worker** at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/*` (GitHub
  Pages retired, ADR-0007). Config in-repo: `wrangler.jsonc` (assets-only), `public/_headers` (real CSP header incl.
  `frame-ancestors 'none'`), `scripts/nest-for-cloudflare.mjs` (postbuild nests `dist/*` under the route prefix, keeps
  `_headers` at root). Cloudflare git-connects the repo and builds `main` on push; Cloudflare-side setup is owner-managed.
- **Active gate:** CI enforces it. Every push/PR to `main` runs `npm run lint` + the validator + `npm run test:run` in
  the `test` job; `build` (build-compiles check, **no publish** now) depends on it. CI installs run
  `npm ci --ignore-scripts` (F-038). Bar unchanged locally: lint + test suite green + validator clean before merge.
- **Dependencies:** All npm majors current **except TypeScript** (held at 5.x — TS 7 blocked until `typescript-eslint`
  drops its `<6.1.0` peer cap). Runtime: React 19, framer-motion 12, zustand 5, immer 11. Toolchain: Vite 8 (Rolldown),
  Vitest 4, jsdom 29, Tailwind 4 (CSS-first `@theme`), ESLint 10. See ADR-0008 + [[dependabot-major-group-migration]] for
  the clustering approach and the emnapi lockfile gotcha.
- **Branch focus:** `fix/53-ability-auto-succeed` (**PR #62 open, all six CI checks green**) — awaiting merge. Next work
  (#54) starts from a fresh branch off `main` once #62 lands. Prior: PR #61 (#58 docs), PR #51 (deps), PRs #48/#49 (#47 deploy).
- **Verification:** 2026-07-09 — on `fix/53-ability-auto-succeed`: `npm run test:run` → **558 passed (558)** across **56**
  files; `npm run lint` clean, validator clean (7 cases), `npm run build` green (emits `dist/gaslight-and-grimoire/` +
  `dist/_headers`). **CI green on PR #62** — all six checks pass, including the **Cloudflare Workers Build** (deploy preview).

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
| P | Audit remediation — P3 #22 polish (perf + a11y) | `[x]` | **Complete — PR #46** (`1ac3c09`). F-044 rAF-throttle EvidenceBoard, F-045 `useShallow`+`React.memo` list items, F-046 LazyMotion (motion chunk 121.85→79.13 KB), F-047 shared-scene cache, F-048 reduced-motion gating, F-049 focusable typewriter-skip + sr-region, F-050 WCAG contrast, F-051 skip-link. 547→554 tests. |
| — | Deployment — Cloudflare Worker migration (retire GitHub Pages) | `[x]` | **Complete — issue #47, ADR-0007.** PR #48 (`2e539fa`): `wrangler.jsonc` + `public/_headers` (real CSP + `frame-ancestors 'none'`) + `deploy.yml` → CI-gate-only. PR #49 (`7144d34`): `scripts/nest-for-cloudflare.mjs` postbuild nesting (fixed live 404). Owner-verified live; Pages unpublished. |
| — | Second full Ultracode repo audit (analysis only) | `[x]` | **2026-07-09.** Report at repo root (`2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md`); 71-agent fan-out + lead verification → **23 findings (F-101…F-123)**, 4 rejected, overall risk Medium. Filed **8 grouped issues #53–#60**. No code changed. |
| R | Audit-2 remediation — P0 gameplay blockers | `[~]` | **#53 DONE — PR #62.** Auto-succeed ability now consumed once via shared `resolveCheckOutcome` (F-101); encounters route through the same unit so the ability works there too (F-107). 554→558 tests. **#54** (Mayfair true ending RNG-locked, F-102) — still open, next. |
| R2 | Audit-2 remediation — P1 (code) | `[ ]` | **#55** save/reload safety (F-103/F-105); **#56** scene-transition state hygiene (F-118/F-104/F-106/F-108); **#57** a11y+errors incl. React-19 `inert` regression. Not started. |
| R2′ | Audit-2 remediation — P1 (docs #58) | `[x]` | **Done — PR #61 (`3dc49aa`).** F-119 `architecture.md` onEnter anti-pattern (+ F-013 flag drift); F-120 scene counts → 201; F-121 component count 16→17; F-122 choices/scene → ~1.77. Also closed the `.gitignore` `vite.config` emit-litter gap. Docs-only. |
| R3 | Audit-2 remediation — P2/P3 | `[ ]` | **#59** test-quality (F-112–F-116); **#60** CI type-check `scripts/` (F-123). Not started. |

---

## Next actions (explicit order)

**Media track (partly user-blocked):**
1. **Perceptual SFX QA (needs human ears)** — the 9 SFX load & trigger correctly in-browser (Playwright-verified), but whether they *sound* right (grounded/never-campy; occult stinger suitably uncanny) can't be machine-checked. One known duration outlier accepted: `clue-deduction` at 2.62s audible. *(User step.)*
2. **User generates the 10 ambient loops** (Stable Audio/Suno per [`audio-asset-kit.md`](audio-asset-kit.md)) into `public/audio/ambient/`, exact filenames. *(Unblocked; user step.)*
3. **Build `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference) + a unit test, then revisit CI wiring (likely `--strict`) once all files land. *(Best once ambient files land.)*

**Code track — Audit-2 backlog (new, from the 2026-07-09 report):**
4. **~~#53 auto-succeed~~ DONE — PR #62** (shared `resolveCheckOutcome`; F-101/F-107). **Next: #54** (Mayfair true
   ending; F-102): dual-source `ms-clue-vesper-journal` (+ the second clue) onto a non-critical tier so the best ending
   is reachable through skilled play. Last P0 gameplay release-blocker before serious playtesting.
5. **Then P1 (code) — #55/#56/#57.** #56 (scene-transition state hygiene) groups four defects that all touch
   `goToScene`/`resetForNewCase`, so one PR. (**#58 — the P1 docs-drift — is done: PR #61.**)
6. **Then P2/P3 — #59** (test quality — several suites test copies-of-logic, not the real unit; note #53's PR already
   fixed the two self-fulfilling AbilityButton guard tests) and **#60** (CI type-checks `scripts/`; note its `tsc -b` also
   surfaces pre-existing `TS2550` errors on `vite.config.ts`).

**Media track (partly user-blocked, unchanged):** ambient loops + perceptual SFX QA remain a user step (#20). See items 1–3 above.

**Notes for whoever picks this up:** the audit's 4 rejected false positives are recorded in the report's *Rejected findings*
section — don't re-file them. The follow-up "per-tier reachability mode for the validator" would have caught #54 mechanically.

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- ~~**How do we source and license media assets?**~~ **RESOLVED 2026-07-08 → [ADR-0006](DECISIONS/ADR-0006-media-asset-strategy.md).** AI-generate **audio only** via a prompt kit the user runs (no API in repo); illustrations parked at lowest priority. Naturalistic never-campy house style. Prompt kit authored: [`audio-asset-kit.md`](audio-asset-kit.md).
- **Audit-1 backlog** — 22 issues from the first Ultracode audit ([report](audits/ULTRACODE_FULL_REPO_ANALYSIS.md)); all cleared except #20 (media). 5 findings rejected by adversarial verification — don't re-file.
- **Audit-2 backlog (2026-07-09)** — 8 issues #53–#60 ([report](../2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md), F-101…F-123). Work queue, not a decision: confirm the P0→P3 ordering above is right and whether any P2/P3 (#59/#60) should be deferred. 4 findings **rejected** by adversarial verification (report's *Rejected findings* section) — don't re-file.
- ~~**`.gitignore` gap:** `tsc -b` emitted `vite.config.js`/`.d.ts` from the composite `tsconfig.node.json` reference.~~ **RESOLVED 2026-07-09 → PR #61 (`3dc49aa`).** Gitignored the two artifacts. `noEmit` was ruled out — composite projects forbid it (TS6310, breaks `npm run build`); the plain `tsc` in the build path never emits them anyway, only `tsc -b` (IDE/build-mode) does.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted), [ADR-0004](DECISIONS/ADR-0004-content-authoring-automation-layer.md) (content-authoring automation layer, Enacted), [ADR-0005](DECISIONS/ADR-0005-key-deduction-recipes.md) (stable deduction identity via key-deduction recipes, Enacted), [ADR-0006](DECISIONS/ADR-0006-media-asset-strategy.md) (media asset strategy — AI-generated audio, prompt-kit pipeline, illustrations parked, Accepted), [ADR-0007](DECISIONS/ADR-0007-cloudflare-worker-deploy.md) (Cloudflare static-assets Worker deploy, retire GitHub Pages, Enacted), [ADR-0008](DECISIONS/ADR-0008-dependency-major-migration-strategy.md) (clustered major-dependency migration, defer TypeScript 7, Enacted).
- Media: [audio asset prompt kit](audio-asset-kit.md) · [design spec](superpowers/specs/2026-07-08-audio-asset-kit-design.md).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Audits: [`audits/ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-07, 67 findings) → issues #1–#22; [`../2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md`](../2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-09, 23 findings F-101…F-123) → issues #53–#60.
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
