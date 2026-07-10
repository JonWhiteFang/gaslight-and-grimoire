# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-10 (**Content ideation — ran `docs/content-ideas-prompt.md` and wrote [`content-ideas-2026-07-10.md`](content-ideas-2026-07-10.md): 10 new concepts (6 main cases + 4 vignettes), top-3 ranking, a full pitch for The Comet Club, and a staged optional Mythos thread. Docs-only; no code or content touched; baseline 611/58 stands from 2026-07-09 (not re-run — `node_modules` absent locally, see flag below).**)
**This session (ideation):** executed the repo's ideation prompt against full project context (design bible, authoring guide, manifest, all 7 metas). Deliverable highlights: **The Comet Club** ranked #1 (closed-circle astronomers dying in 1882 seating order; double solution — one human tontine murder hidden inside an inhuman pattern; zero new engine needs); **The Ravenscroft Remedy** #2 (activates the unused Ravenscroft Asylum; a Veil-memory-excising "cure" that works); **The Orrery Room** #3 (fills the objectively missing **Grey Dawn faction vignette** gap). Mythos thread staged across 6 breadcrumb flags + one keystone `KeyDeduction` (`mythos-pattern-named`, mintable only in The Orrery Room) — all expressible with existing flag/recipe/variant machinery; suggested build order Comet Club → Orrery Room → Drowned Archive → Tidewaiter's Log. **Sweep fixes:** root `README.md` had survived the PR #69 sweep stale — play URL (github.io → `holodeck.jonwhitefang.uk`), 198→201 scenes, React 18→19, Tailwind → v4, and the CI section's "deploys to GitHub Pages" claim (→ build-compiles check, deploy Cloudflare-side); `docs/README.md` doc map gained the two content-ideas docs. **Flag:** `node_modules` is missing locally (validator/tests could not run this session); content is unchanged since the 2026-07-09 verified counts (611 tests / 58 files / 201 scenes / 7 cases), so those stand — run `npm ci` before the next code session. — Prior (below): #52 interview.

_Prior update: 2026-07-09 (**Answered the issue #52 agent-perspective interview — posted as a comment on the GitHub issue (NOT committed to the repo). This checkpoint's spine/doc edits are the only committed change; no code/content touched, test baseline unchanged 611.**)
**Prior session (interview):** the user asked the agent to answer **issue #52** — an interview addressed to Claude Code for a jonwhitefang.uk blog post on how G&G was built. Ran a fan-out research workflow (8 per-cluster researchers, every claim grounded in git/gh/ADR/RUN_LOG citations; the fact-check phase largely stalled on agent timeouts but returned zero corrections, and every load-bearing figure was independently re-verified by the lead against primary sources). Posted a first-person, candour-over-polish answer to all 11 questions ([issue #52, comment 4926364394](https://github.com/JonWhiteFang/gaslight-and-grimoire/issues/52#issuecomment-4926364394)). **Central honesty findings the blog must not get wrong** (surfaced so future sessions don't re-derive them): the project began under **Kiro** (a different AI IDE) at the 2026-02-19 initial commit `be92632` — the design bible, 4 archetypes, 4 factions, the deduction system, the entire Phase A–E foundation, and the "198 scenes" content uplift (`50df7a1`, 2026-02-25) all **predate Claude Code**, which only took over on 2026-07-07 (`4707828`); the issue's "198 scenes" is a stale Kiro-era commit-title figure (live: **201 base / 215 runtime**, per F-120); there were **two** audits (67→22 issues + 23→8), not one; the deduction mechanic was **activated** (stable ids + content), not built; and the human/agent division of labour is invisible in git (every non-bot commit authored "Jon White"). The interview itself changed no repo files — comment-only. — Prior (below): full doc-drift sweep + audit relocation (PR #69).

_Earlier: 2026-07-09 (**Full-doc-drift sweep + audit-file relocation — docs-only (PR #69, merged). 21 verified drift fixes across 8 docs; moved `2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md` → `docs/audits/`. Test baseline unchanged 611; no code touched.**)
**Prior session (doc sweep):** ran a fan-out audit (9 per-doc auditors + historical link-check, each finding adversarially verified against source) → **21 CONFIRMED drift fixes**, all applied. Highlights: engine-reference `CaseCompletionResult.vignettesUnlocked: string[]` + `checkVignetteUnlocks(): string[]` (were singular/nullable — F-057 drift); the "no audio ships / silent" claim corrected in **4 docs** (9 SFX now ship); CLAUDE.md scene-count parenthetical fixed (201 = base+variants **excl.** shared; 215 at runtime), `haltScenes.ts` added to the engine list, `CaseCompletion`/`InvestigationHalted` added to the component hierarchy; content-JSON described as wrapped objects not bare arrays; a dead `build→deploy` CI ref, two stale `file:line`s in architecture.md, `66→67` validator example, doc-map missing `audio-asset-kit.md`, and several stale audio-status lines. **Also moved** the 2026-07-09 audit report from repo root into `docs/audits/` (via `git mv`, history preserved) beside the 2026-07-07 audit; repointed the 4 live PROJECT_STATE links (`../` → `audits/`) + the RUN_LOG history href (annotated, not rewritten). All 85 internal doc links resolve; validator clean (7 cases). — Prior (below): #60 CI type-check (PR #68).

_Earlier: 2026-07-09 (**Audit-2 P3 #60 FIXED — CI type-checks scripts/ + vite.config.ts (PR #68, merged). ENTIRE audit-2 code backlog (#53–#60) CLEAR.**)
**#60 (F-123):** the build gate's `tsc` had `include: ["src"]`, so `scripts/` — incl. `scripts/validateCase.ts`, the
content-validator source that is itself a CI correctness gate — was in no tsconfig; a type regression there passed the build
and only surfaced at runtime via the vite-node shim. `vite.config.ts` was nominally covered by `tsconfig.node.json` but that
project had no `lib`, so `tsc -b` reported `TS2550` on its `String.includes`. Fix: new **`tsconfig.scripts.json`**
(non-composite + `noEmit` — so unlike the composite `tsconfig.node.json` it avoids `TS6310` and emits no litter; `lib: ES2023`,
`types: ["node"]`) covering `scripts/**/*.ts` + `vite.config.ts`; new `typecheck:scripts` npm script chained into `build`
between `tsc` and `vite build`; `tsconfig.node.json` given explicit `target ES2022`/`lib ES2023` to fix the `TS2550` at root;
`@types/node@^20` devDep (pinned to the `.nvmrc` Node-20 line). Verified the issue's own check: a `const x: string = 42` in
the validator made `npm run build` exit 0 before, exit 2 after (same for a `vite.config.ts` error). **CI round-trip:** the
first push failed `npm ci` on the **emnapi lockfile trap** ([[dependabot-major-group-migration]]) — local Node v25/npm 11
re-resolved the optional `@emnapi/*` ranges to 1.11.2 vs CI's Node-20 1.11.1; fixed by a clean `rm -rf node_modules
package-lock.json && npm install` regen + `npm ci` verify (memory note updated). Test baseline unchanged **611**; all six CI
checks passed on PR #68. Doc-drift sweep: `CLAUDE.md` Commands (build tsc scope + `typecheck:scripts`) + CI/CD `build`-job
description. **Audit-2 code backlog: CLEAR (#53–#60 all done). Only #20 (media, user-blocked) + #52 (interview) remain open.**
— Prior (below): #59 test quality (PR #67).

Earlier this session: **Audit-2 P2 #59 FIXED — test quality (PR #67, merged).**
**#59 (F-112–F-116 + 2 correctness cross-check gaps):** seven test-quality defects, one **test-only** PR — the 588-test
suite was green while several invariants had zero real guards (tests exercised copies of logic, transitive paths, or asserted
nothing about the behaviour they were named for). Every new/rewritten test was **mutation-verified**: the real production
code was broken, the test watched to fail (the honest RED for already-correct code), then restored — so **no production code
changed** (`git diff` on non-test `src/**` is empty). **F-112** `npcBounds.property` drove local clamp COPIES — now calls the
real `adjustDisposition`/`adjustSuspicion` and asserts the store clamps. **F-113** new `worldSlice.reputation` real-slice ±10
boundary tests (was only `vi.fn()`-mocked). **F-114** Nerve-vs-Lore reaction tiebreak (tie + strict cases; flipping `>=`→`>`
fails only the tie). **F-115** new direct `resolveScene` variant tests (was only transitive, all `variants: []`). **F-116**
rewrote the eviction test with deterministic timestamps — asserts the OLDEST manual save is evicted and autosave is protected
(was asserting a list length only). **flag path** `applyEffects` result assertions (was "does not throw"; the `?? true`→`|| true`
mutation that coerces `false`→`true` now fails). **mundane vitality-only** encounter damage branch (+ both-deltas exclusivity).
Test baseline **588→611** (+23, 56→58 files); lint + validator (7 cases) + build green; all six CI checks passed on PR #67.
Doc-drift sweep: `status.md` baseline 588→611, files 56→58. **Audit-2 code backlog remaining: #60 (P3) — no P0/P1/P2 left.**
— Prior (below): #57 a11y/error-messaging (PR #66).

Earlier this session: **Audit-2 P1 #57 FIXED — a11y & error-messaging (PR #66, merged). All P1 now cleared.**
**#57 (F-007-regression + 2 new):** three a11y/error-messaging defects, one PR. **inert regression** — `App` passed the
React-18 idiom `inert: ''`, but React 19 treats `inert` as a real boolean attribute and an empty string is falsy → react-dom
`removeAttribute`s it, silently defeating the modal-background isolation (F-007); 3 of 4 overlays have no independent Tab trap
and relied on it. Fixed to `inert={anyOverlayOpen}` (verified in a real browser: attribute set + background focus blocked).
**ErrorBoundary false auto-save** — the fallback claimed "your progress has been auto-saved" unconditionally, but Manual save
mode never writes an autosave slot; now gated on `SaveManager.listSaves()` actually holding an `autosave`. **Unannounced
loading** — `OverlayFallback` + the "Loading case…" screen were visual-only; added `role="status"` + `aria-live="polite"`.
**Bonus:** hardened `evaluateCondition` record lookups with an own-property guard (`ownValue`) so a gate target naming an
`Object.prototype` member (`toString`/`valueOf`/…) can't read the inherited property — this was the root cause of a
**pre-existing flaky determinism property test** (failed ~1/7 full-suite runs on `main`; now 20/20 clean). TDD (RED watched).
Test baseline **577→588**; lint + validator (7 cases) + build green; all six CI checks passed on PR #66. Doc-drift sweep:
`status.md` baseline 577→588. **Audit-2 code backlog remaining: #59 (P2), #60 (P3) — no P0/P1 left.** — Prior (below): #55
save/reload safety (PR #65).

Earlier this session: **Audit-2 P1 #55 FIXED — save/reload safety (PR #65, merged).**
**#55 (F-103/F-105):** two persistence-safety defects. **F-103** — manual `saveGame` had no try/catch (autoSave did), so a
`localStorage` throw (quota/private-browsing) became an unhandled rejection while the UI showed "Game saved"; now returns
`{ ok:false }` and App shows a `role="alert"` error toast. **F-105** — encounter reaction-check damage re-rolled on
save/reload because `EncounterState` was component-only + unpersisted; now `encounterState` lives in the store + save (v3→v4
migration, defaults null), `EncounterPanel` resumes a persisted in-progress encounter instead of re-running `startEncounter`,
and `goToScene`/`resetForNewCase` clear it. TDD (RED watched). Test baseline **569→577**; lint + validator (7 cases) + build
green; all six CI checks passed on PR #65. Doc-drift sweep: `status.md` baseline 569→577; save version 3→4 + the v3→v4
migration step in `CLAUDE.md` + `engine-reference.md`; `encounterState`/`setEncounterState` added to the narrativeSlice
rows (`CLAUDE.md` + `architecture.md`); the `saveGame` try/catch noted. **Audit-2 code backlog remaining: #57 (P1),
#59 (P2), #60 (P3).** — Prior (below): #56 scene-transition hygiene (PR #64).

Earlier this session: **Audit-2 P1 #56 FIXED — scene-transition state hygiene (PR #64, merged).**
**#56 (F-118/F-104/F-106/F-108):** four defects on the `goToScene`/`resetForNewCase` seam, one PR. The once-per-scene
`onEnter` gate now keys on the **resolved** scene id (base or variant), so a variant's distinct `onEnter` fires once when
newly eligible (F-118) while still never re-firing (F-006 preserved); `resetForNewCase` clears `currentScene` so no foreign
id leaks into the new `sceneHistory` (F-104); `goToScene` clears `lastCheckResult` on cross-scene nav so the dice overlay
can't leak forward (F-106); `App` uses a reactive `canGoBack` selector (F-108, with an App-level integration test driving
the real new-game flow). TDD (RED watched). Test baseline **564→569**; lint + validator (7 cases) + build green; all six
CI checks passed on PR #64. Doc-drift sweep: `status.md` baseline 564→569; the `onEnter`/`visitedScenes` behaviour notes
in `CLAUDE.md` + `architecture.md` now say "resolved scene id" (F-118) + note the F-104/F-106 resets; `engine-reference.md`
`validateBundle` now documents the F-102 gated-deduction reachability error + `computeNonCriticalReachableScenes` (drift
from #54). **Audit-2 code backlog remaining: #55/#57 (P1), #59 (P2), #60 (P3).** — Prior (below): both P0s (#53 PR #62, #54 PR #63).

Earlier this session: **Both audit-2 P0 gameplay blockers FIXED — #53 (PR #62) + #54 (PR #63), both merged.**
**#54 (F-102):** the Mayfair true ending was gated behind a key deduction whose 3 clues were only gatherable via two
nat-20 rolls (~0.25%) — an RNG lottery. Fix dual-sources the two crit-gated clues onto non-critical sibling scenes
(`ms-clue-vesper-journal` → `ms-act2-occult-partial`; `ms-clue-hidden-mechanism` → `ms-act1-room-partial`, perception≥11
check) so a skilled no-crit occult run forms the deduction (verified by simulation + the content-integrity reviewer, clean).
Added a **validator guard** (per-tier reachability: every clue a *gated* recipe needs must be obtainable off the
non-critical scene graph — errored on Mayfair pre-fix; the follow-up the audit asked for). **#53 (F-101/F-107, PR #62):**
archetype auto-succeed ability now consumed once via a shared `resolveCheckOutcome` both check paths call. TDD throughout
(RED watched). Test baseline **554→564**; lint + validator (7 cases) + build green; all six CI checks passed on both PRs.
Doc-drift sweep: `status.md` baseline 558→564 + validator-check list; `content-authoring.md` key-deduction rule (F-102
now validator-enforced); engine-reference/CLAUDE.md `resolveCheckOutcome` (from #53). **Audit-2 code backlog remaining:
#55/#56/#57 (P1), #59 (P2), #60 (P3) — no P0 left.** — Prior (below): #58 doc-drift (PR #61); the audit itself.
Second full Ultracode repo audit — analysis only, no code changed. Ran the
command battery (all green — 554 tests, lint, validator, build, 0 npm vulns) then an orchestrated 13-dimension
adversarial fan-out (71 agents) + lead verification. 37 raw → **23 root-cause-deduped verified findings** (new IDs
**F-101…F-123**, distinct from the prior F-001…F-067); 4 rejected as false positives. Report:
[`2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md) (`docs/audits/`). Overall
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
  #53–#60 (F-101…F-123): CLEAR — both P0 gameplay blockers FIXED (#53 auto-succeed PR #62, #54 Mayfair true ending
  PR #63); all P1 FIXED (#55 save/reload PR #65, #56 scene-transition PR #64, #57 a11y/errors PR #66, #58 docs PR #61);
  P2 #59 test quality FIXED (PR #67); P3 #60 CI type-check `scripts/` FIXED (PR #68).** No audit-2 code items left.
  See the audit report + the issues. **Non-code #52 (agent-perspective interview) answered** on the issue 2026-07-09.
- **Deployment:** **Cloudflare static-assets Worker** at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/*` (GitHub
  Pages retired, ADR-0007). Config in-repo: `wrangler.jsonc` (assets-only), `public/_headers` (real CSP header incl.
  `frame-ancestors 'none'`), `scripts/nest-for-cloudflare.mjs` (postbuild nests `dist/*` under the route prefix, keeps
  `_headers` at root). Cloudflare git-connects the repo and builds `main` on push; Cloudflare-side setup is owner-managed.
- **Active gate:** CI enforces it. Every push/PR to `main` runs `npm run lint` + the validator + `npm run test:run` in
  the `test` job; `build` (build-compiles check, **no publish** now) depends on it — and its `tsc` step now also
  type-checks `scripts/` + `vite.config.ts` via `tsconfig.scripts.json` (F-123). CI installs run
  `npm ci --ignore-scripts` (F-038). Bar unchanged locally: lint + test suite green + validator clean before merge.
- **Dependencies:** All npm majors current **except TypeScript** (held at 5.x — TS 7 blocked until `typescript-eslint`
  drops its `<6.1.0` peer cap). Runtime: React 19, framer-motion 12, zustand 5, immer 11. Toolchain: Vite 8 (Rolldown),
  Vitest 4, jsdom 29, Tailwind 4 (CSS-first `@theme`), ESLint 10. See ADR-0008 + [[dependabot-major-group-migration]] for
  the clustering approach and the emnapi lockfile gotcha.
- **Branch focus:** `main` (at `0a72e7c`, **PRs #62–#70 merged**) — the entire audit-2 code backlog (#53–#60) is cleared.
  No open code work; next substantive items are user-blocked (#20 media) or non-code (#52 interview). Prior: PR #51 (deps),
  PRs #48/#49 (#47 deploy).
- **Verification:** 2026-07-09 — on merged `main`: `npm run test:run` → **611 passed (611)** across **58** files;
  `npm run lint` clean, validator clean (7 cases), `npm ci --ignore-scripts` + `npm run build` green (build now also
  type-checks `scripts/` + `vite.config.ts`; emits `dist/gaslight-and-grimoire/` + `dist/_headers`). **CI green on PR #68**
  (and #62–#67) — all six checks pass on each, including the **Cloudflare Workers Build**. This session (interview) touched
  **no code or content** — the answer was posted to GitHub issue #52, not the repo — so the 611/58 baseline holds unchanged;
  re-verified live this session: `npm run test:run` → **611 passed (611)** / 58 files, `node scripts/validateCase.mjs` →
  **201 scenes / 7 cases** clean. **2026-07-10 (ideation session):** docs-only again — no code/content touched, so 611/58
  and 201/7 continue to stand; nothing re-run this session because `node_modules` is absent locally (`npm ci` needed before
  the next code session).

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
| — | Second full Ultracode repo audit (analysis only) | `[x]` | **2026-07-09.** Report at [`audits/2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md); 71-agent fan-out + lead verification → **23 findings (F-101…F-123)**, 4 rejected, overall risk Medium. Filed **8 grouped issues #53–#60**. No code changed. |
| R | Audit-2 remediation — P0 gameplay blockers | `[x]` | **Both done.** **#53 — PR #62:** auto-succeed ability consumed once via shared `resolveCheckOutcome` (F-101); encounters route through the same unit (F-107). **#54 — PR #63:** Mayfair true ending de-crit-gated by dual-sourcing 2 clues (F-102) + a validator guard against crit-gated deduction clues. 554→564 tests. |
| R2 | Audit-2 remediation — P1 (code) | `[x]` | **Complete.** **#55 — PR #65:** save/reload safety — `saveGame` try/catch + error toast (F-103), persisted `encounterState` (v3→v4) so reload doesn't re-roll the reaction check (F-105); 569→577. **#56 — PR #64:** scene-transition hygiene (F-118/F-104/F-106/F-108); 564→569. **#57 — PR #66:** a11y/errors — React-19 `inert={bool}` (F-007 regression), ErrorBoundary auto-save claim gated, loading fallbacks `role=status`, + `evaluateCondition` own-property guard (fixed a pre-existing flaky determinism test); 577→588. |
| R2′ | Audit-2 remediation — P1 (docs #58) | `[x]` | **Done — PR #61 (`3dc49aa`).** F-119 `architecture.md` onEnter anti-pattern (+ F-013 flag drift); F-120 scene counts → 201; F-121 component count 16→17; F-122 choices/scene → ~1.77. Also closed the `.gitignore` `vite.config` emit-litter gap. Docs-only. |
| R3 | Audit-2 remediation — P2 test quality (#59) | `[x]` | **Done — PR #67 (`629df31`), test-only.** F-112–F-116 + 2 correctness cross-check gaps: replaced copy-of-logic/transitive/smoke tests with real-unit, **mutation-verified** guards — npcBounds→real slice clamps, new worldSlice reputation ±10, Nerve-vs-Lore tiebreak, direct `resolveScene` variant tests, real eviction (oldest evicted + autosave protected), `applyEffects` flag-false result, mundane vitality-only branch. No production code changed. 588→611 (+23), 56→58 files. |
| R3′ | Audit-2 remediation — P3 CI type-check (#60) | `[x]` | **Done — PR #68 (`98d3ac9`).** New `tsconfig.scripts.json` (non-composite + `noEmit`, `lib ES2023`, `types:["node"]`) covering `scripts/**/*.ts` + `vite.config.ts`; `typecheck:scripts` npm script chained into `build`; `tsconfig.node.json` given explicit `target/lib` to fix the `TS2550` at root; `@types/node@^20` devDep. A type error in the validator source now fails the build (was exit 0). Emnapi lockfile trap on first push → clean regen. Baseline unchanged (611). |

---

## Next actions (explicit order)

**Audit-2 code backlog: CLEAR.** All of #53–#60 merged (PRs #62–#68). The only open GitHub issue is #20 (media,
user-blocked). No open code work. **#52 (agent-perspective interview) answered** 2026-07-09 — a first-person response to
all 11 questions is posted as a [comment on the issue](https://github.com/JonWhiteFang/gaslight-and-grimoire/issues/52#issuecomment-4926364394)
(the blog draft itself is the user's to write; the issue can be closed once they've mined the answer).

**Content track (new, optional):** [`content-ideas-2026-07-10.md`](content-ideas-2026-07-10.md) holds 10 vetted concepts
awaiting a user pick. If green-lit, suggested order: **The Comet Club** (case) → **The Orrery Room** (Grey Dawn vignette —
fills the one missing faction vignette) → The Drowned Archive → The Tidewaiter's Log; that makes the optional Mythos
thread playable end-to-end after four builds. Ideation only — no JSON authored yet.

**Media track (partly user-blocked) — the practical next steps if resuming:**
1. **User generates the 10 ambient loops** (Stable Audio/Suno per [`audio-asset-kit.md`](audio-asset-kit.md)) into `public/audio/ambient/`, exact filenames. *(Unblocked; user step.)*
2. **Perceptual SFX QA (needs human ears)** — the 9 SFX load & trigger correctly in-browser (Playwright-verified), but whether they *sound* right (grounded/never-campy; occult stinger suitably uncanny) can't be machine-checked. One known duration outlier accepted: `clue-deduction` at 2.62s audible. *(User step.)*
3. **Build `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference) + a unit test, then revisit CI wiring (likely `--strict`) once all files land. *(Best once ambient files land.)*

**Non-code:** #52 — **DONE** (agent's-perspective interview answered on the issue 2026-07-09). Remaining is the user's own
blog write-up for jonwhitefang.uk, plus optionally closing #52. The posted answer flags the overclaim traps to avoid
(Kiro origin, 198→201 scene count, two audits not one, "activated not built" deduction, invisible agent/human git line).

**Notes for whoever picks this up:** the audit's 4 rejected false positives are recorded in the report's *Rejected findings*
section — don't re-file them. Both audit backlogs (#1–#22 and #53–#60) are now fully cleared except the media milestone (#20).
The lockfile is fragile to incremental edits — see the emnapi trap in [[dependabot-major-group-migration]]; full-regen +
`npm ci` verify before pushing any dep change.

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- ~~**How do we source and license media assets?**~~ **RESOLVED 2026-07-08 → [ADR-0006](DECISIONS/ADR-0006-media-asset-strategy.md).** AI-generate **audio only** via a prompt kit the user runs (no API in repo); illustrations parked at lowest priority. Naturalistic never-campy house style. Prompt kit authored: [`audio-asset-kit.md`](audio-asset-kit.md).
- **Audit-1 backlog** — 22 issues from the first Ultracode audit ([report](audits/ULTRACODE_FULL_REPO_ANALYSIS.md)); all cleared except #20 (media). 5 findings rejected by adversarial verification — don't re-file.
- **Audit-2 backlog (2026-07-09)** — 8 issues #53–#60 ([report](audits/2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md), F-101…F-123). **All done (PRs #62–#68 merged).** 4 findings **rejected** by adversarial verification (report's *Rejected findings* section) — don't re-file.
- ~~**`.gitignore` gap:** `tsc -b` emitted `vite.config.js`/`.d.ts` from the composite `tsconfig.node.json` reference.~~ **RESOLVED 2026-07-09 → PR #61 (`3dc49aa`).** Gitignored the two artifacts. `noEmit` was ruled out — composite projects forbid it (TS6310, breaks `npm run build`); the plain `tsc` in the build path never emits them anyway, only `tsc -b` (IDE/build-mode) does.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted), [ADR-0004](DECISIONS/ADR-0004-content-authoring-automation-layer.md) (content-authoring automation layer, Enacted), [ADR-0005](DECISIONS/ADR-0005-key-deduction-recipes.md) (stable deduction identity via key-deduction recipes, Enacted), [ADR-0006](DECISIONS/ADR-0006-media-asset-strategy.md) (media asset strategy — AI-generated audio, prompt-kit pipeline, illustrations parked, Accepted), [ADR-0007](DECISIONS/ADR-0007-cloudflare-worker-deploy.md) (Cloudflare static-assets Worker deploy, retire GitHub Pages, Enacted), [ADR-0008](DECISIONS/ADR-0008-dependency-major-migration-strategy.md) (clustered major-dependency migration, defer TypeScript 7, Enacted).
- Media: [audio asset prompt kit](audio-asset-kit.md) · [design spec](superpowers/specs/2026-07-08-audio-asset-kit-design.md).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Audits: [`audits/ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-07, 67 findings) → issues #1–#22; [`audits/2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md`](audits/2026-07-09_ULTRACODE_FULL_REPO_ANALYSIS.md) (2026-07-09, 23 findings F-101…F-123) → issues #53–#60.
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
