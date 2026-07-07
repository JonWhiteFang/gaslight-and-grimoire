# Full Ultracode Repository Analysis

**Repository:** `gaslight-and-grimoire` — a browser-based Victorian-London choose-your-own-adventure detective game (React 18 + Zustand + Vite, deployed to GitHub Pages).
**Analysis date:** 2026-07-07
**Method:** Read-only inspection. Ground truth established by running build/test/audit/validator commands, then a 13-dimension adversarial audit (one finder per dimension, one independent skeptic re-opening cited files per finding). 110 audit agents ran; 97 findings were verified, 5 rejected as false positives. Anchor findings were independently re-verified by the lead.
**No code was modified.**

---

## Executive summary

**Overall health: solid engineering, shippable-but-not-polished product.** The codebase is unusually disciplined for a game of this size: a genuinely store-free engine layer, a clean six-slice Zustand store with all numeric state clamped at boundaries, `strict` TypeScript, 334 passing tests (incl. property-based suites), a strict Content-Security-Policy, zero HTML-injection sinks, zero `npm audit` vulnerabilities, and a committed documentation/decision spine. The build is green and the content validator is clean.

The problems are **not** in the core mechanics-as-coded — they are in **three gaps between "coded" and "actually works for a player"**, plus **CI/quality-gate** weaknesses:

1. **Two of the game's headline mechanics don't pay off or don't work.** Deductions are formable but **no scene or choice in any of the 7 cases is gated by a deduction** — the "Sherlock Holmes deduction" pitch is cosmetic. And the Evidence Board's clue-connection (the path to *making* deductions) is **Spacebar-only** — unusable on touch and invisible to first-time users, despite cards showing a drag cursor. (F-001, F-002)

2. **Content is shipped that no player can reach or that misbehaves.** An entire vignette (*The Debt of Smoke*) is **permanently unreachable** — its unlock needs disposition ≥ 7 but the maximum attainable is +4, and disposition resets each case (F-003). An encounter "Flee" button silently advances the fight instead of escaping (F-004). Six case-specific recovery scenes never display (F-024). None of this is caught because the validators don't check conditions, variants, or encounter edges (F-016).

3. **The 334-test safety net never runs in CI, and the media layer is empty.** `deploy.yml` never runs the tests, so a correctness regression deploys straight to production (F-005). The game is entirely silent and illustration-free — 0 audio/image assets exist though the systems are fully coded (F-025, and 37 `ambientAudio` refs will 404).

**Nothing is Critical** (build works, deploy works, no data-loss-on-normal-use, no secret exposure). But F-001 through F-005 should be treated as release blockers for real playtesting. The strengths are real and worth preserving — this report is a punch-list on a fundamentally sound base, not a rescue.

---

## Current state

| Aspect | Status |
|---|---|
| **Detected stack** | React 18.3, Zustand 4.5 + Immer 10, Vite 7.3, TypeScript 5.4 (5.9 installed), Tailwind 3.4, Framer Motion 11, Howler 2.2. Vitest 3 + fast-check 3 + RTL for tests. Frontend-only SPA; no backend. |
| **App purpose** | Branching narrative detective game: 4 archetypes, d20 faculty checks, clue/deduction evidence board, faction reputation, NPC disposition/suspicion, 7 cases (3 main 3-act, 4 vignette 2-act). |
| **Repo size/shape** | ~12.5k lines TS/TSX (66 source files + 29 test files). 512 KB of content JSON. Two strict domains: `public/content/**` (data) and `src/engine/**` (logic). |
| **Build status** | ✅ `npm run build` green — `tsc && vite build`, 465 modules, single JS chunk **402 KB (125 KB gzip)** + CSS 28.5 KB. Build ≈ 2.4 s. |
| **Test status** | ✅ `npm run test:run` → **334 passed / 334**, 29 files, ~12.6 s. Never executed in CI. |
| **Content status** | ✅ `node scripts/validateCase.mjs` → clean, 7 cases, 198 scenes, 58 clues. Validator does **not** cover conditions/variants/encounters (see F-016). |
| **Deployment status** | GitHub Pages via `deploy.yml` on push to main. Base path `/gaslight-and-grimoire/` correct. Deploy gates on validator + `npm audit --audit-level=high` + build — **but not tests**. |
| **Dependency/security** | ✅ `npm audit` → **0 vulnerabilities**. 13 major versions behind (all pins appear deliberate). One unpinned 3rd-party GitHub Action (`@main`). |

---

## Commands run

| Command | Result | Notable output |
|---|---|---|
| `git status` / `git branch` | ✅ clean, on `main` | Working tree clean at start. |
| `find . -type f` (excl. node_modules/.git/dist) | ✅ | 66 source + 29 test + 47 content JSON + docs. |
| `npm run test:run` | ✅ pass | **334 passed (334)**, 29 files, 12.63 s. One benign jsdom `--localstorage-file` warning. |
| `npm run build` | ✅ pass | JS 402.01 KB (gzip 124.96 KB), CSS 28.51 KB, index 0.76 KB. |
| `npm audit` | ✅ pass | **found 0 vulnerabilities**. |
| `npm outdated` | ⚠️ (informational) | 17 packages behind; 13 by a full major (React 19, Vite 8, Zustand 5, Immer 11, Tailwind 4, TS 6, Vitest 4, framer-motion 12, jsdom 29, RTL 16, fast-check 4, plugin-react 6). |
| `node scripts/validateCase.mjs` | ✅ pass | 7 cases validated, no errors/warnings. |
| `npm run lint` / `npm run typecheck` | ❌ **skipped — scripts do not exist** | No lint script; no linter installed. Typecheck only via `tsc` inside `build`. |
| Targeted `grep`/`node` probes | ✅ | Confirmed: no `dangerouslySetInnerHTML`; `any` confined to tests; `/vite.svg` favicon **missing**; `wc-case-complete` flag correctly set on all 4 endings; `hasDeduction`/`requiresDeduction` = **0 hits in content**; max `npc-sable` disposition = **+4** vs threshold 7; `.high-contrast` CSS class consumed by nothing. |

---

## Top risks

| Rank | ID | Severity | Category | Title | Why it matters |
|---:|---|---|---|---|---|
| 1 | F-001 | High | UX/Content | Deductions have zero gameplay payoff — no content is deduction-gated | The headline "deduction" mechanic is cosmetic across all 7 cases. |
| 2 | F-002 | High | UX/A11y | Evidence Board clue-connection is Spacebar-only, unusable on touch | The core detective loop is unreachable on mobile and unclear on desktop. |
| 3 | F-003 | Medium | Content | *The Debt of Smoke* vignette is permanently unreachable (needs disp ≥ 7, max +4) | An entire shipped vignette is dead content; docs list it as normal. |
| 4 | F-004 | Medium | Correctness | Encounter "Flee" in a non-final round is a dead button | Escape path silently advances the fight on both boss encounters. |
| 5 | F-005 | Medium | CI/CD | 334 tests never run in CI — nothing gates deploy or PRs | Correctness regressions deploy straight to production Pages. |
| 6 | F-006 | Medium | Correctness | `onEnter` effects re-fire on revisit / save-load — deltas stack | Composure/vitality/reputation can be farmed or drained by re-entry. |
| 7 | F-016 | Medium | Content/Testing | Validators don't check conditions, variants, npcEffect, or encounters | F-003/F-004/F-024 all pass CI clean — false confidence. |
| 8 | F-007 | Medium | A11y | High-contrast mode is a no-op; overlays lack focus trap/restore | Advertised, tested a11y features don't work for low-vision/keyboard users. |
| 9 | F-008 | Medium | Architecture | Core mechanics (deduction resolve, clue-check) live in UI components | Game logic can't be unit-tested; violates the project's own engine boundary. |
| 10 | F-010 | Medium | UX | HeaderBar & save list show raw slug (`the-whitechapel-cipher`) | Developer-facing string in the most prominent UI, breaking the tone. |

---

## Findings

Findings are ordered by severity. High and Medium findings use the full format. Low and Polish findings are grouped by category at the end with condensed-but-complete entries (evidence, impact, adversarial note, fix). Cross-dimension duplicates have been merged into a single canonical finding with a **Also surfaced as** note. Every finding survived independent adversarial verification unless marked otherwise; 5 rejected candidates are listed in the Appendix.

---

### Finding: Deductions have zero gameplay payoff — no scene or choice in any of the 7 cases is gated by a deduction

**ID:** F-001
**Severity:** High
**Category:** UX / Content
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `src/components/EvidenceBoard/DeductionButton.tsx:36`, `src/components/ChoicePanel/ChoicePanel.tsx:29`, all of `public/content/**`
- `grep -rn '"hasDeduction"' public/content` → **0 hits**; `grep -rn 'requiresDeduction' public/content` → **0 hits** (independently re-run by lead: both 0).
- The engine fully supports both paths: `hasDeduction` is a `Condition` type (`evaluateCondition`, `narrativeEngine.ts:211`), and `isChoiceVisible` honors `requiresDeduction` (`ChoicePanel.tsx:29`). `DeductionButton` runs a DC-14 Reason check, calls `buildDeduction`, and stores the result via `addDeduction`.
- The one `"deduction"` string in content (`the-whitechapel-cipher/act2.json:1167`) is a *flag* named `wc-deductionist-pattern`, not a `Deduction` object.

#### Why it matters
The design pitch (per `CLAUDE.md` and the design bible) is "Sherlock Holmes-style deduction." Players are walked through connect-clues → roll Reason → "Deduction Locked," and the result unlocks **no** dialogue, scenes, or outcomes — it only appears as a line in the Case Journal. The most heavily marketed mechanic changes nothing, so the entire Evidence Board feels pointless once a player notices. This is the single largest gap between the product's promise and its behavior.

#### Adversarial review
Re-verified: the greps are dispositive and were re-run independently (0 and 0). Could this be intentional — deductions as "flavor/journaling only"? Unlikely: the engine carries two fully-wired gating mechanisms (`hasDeduction`, `requiresDeduction`) that exist *only* to consume deductions, and both are tested — building machinery you never use is drift, not design. False-positive risk is essentially nil (a global content search cannot miss a JSON key). The only thing that would weaken it is a documented decision that deductions are intentionally decorative; none exists — the docs describe deduction as core progression. Severity: High is correct because it undermines the headline loop, but note it is a **content-authoring gap, not a code defect** — the fix is authoring plus a validator nudge, not an engine change. Not Critical: the game is fully completable without deductions.

#### Verdict after adversarial review
**Stands, High.** Confirmed by independent re-grep. It is the top product risk.

#### Recommended action
Author at least one `requiresDeduction` choice or `hasDeduction`-gated scene per case — e.g. a confrontation/accusation option that only appears once the key deduction is formed, ideally as a superior ending path. Add a `validateCase.mjs` **warning** when a case defines clues but no content references any deduction, so this can never silently regress.

#### Suggested validation
After authoring: `grep -rn 'requiresDeduction\|"hasDeduction"' public/content` should be non-empty; play a case, form the intended deduction, and confirm a new choice/scene appears that was absent beforehand. Add an integration test asserting a `requiresDeduction` choice is hidden without the deduction and visible with it.

---

### Finding: Evidence Board clue-connection is keyboard-Spacebar-only and unusable on touch, despite cards looking draggable

**ID:** F-002
**Severity:** High
**Category:** UX / Accessibility
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `src/components/EvidenceBoard/ClueCard.tsx:107,127,138,139`, `src/components/EvidenceBoard/EvidenceBoard.tsx:117,235`
- `ClueCard` renders `draggable` with `cursor-grab active:cursor-grabbing` (lines 127, 139) but its **only** interaction handler is `onKeyDown` for the spacebar (line 138 → `handleKeyDown` at 107). Independently re-verified: the file has `draggable` + grab cursor + `onKeyDown` and **no** `onClick`/`onDragStart`/`onDrop`/`onTouch*`/`onPointer*` handler, and `EvidenceBoard` defines no drop zone.
- The instruction hint ("Press Space on another clue to connect…") only renders once `connectingFrom` is already set (`EvidenceBoard.tsx:235`), which itself requires pressing Space on a focused card first — so a first-time user gets **no** prompt.
- Enter does nothing (handler checks only `' '`).

#### Why it matters
Connecting clues is the gateway to deductions — the game's central detective mechanic. On touch devices (no physical keyboard), it is **impossible to connect clues at all**, so the Evidence Board and all deductions are unreachable — on the exact platform a GitHub-Pages web game is most likely opened on. On desktop, the grab cursor and `draggable` attribute promise drag-to-connect that silently does nothing, so users try to drag, fail, and give up. It's simultaneously a WCAG 2.1.1 (keyboard) affordance problem and a mobile-blocker.

#### Adversarial review
Re-verified independently: `grep` on `ClueCard.tsx` shows exactly `cursor-grab` (127), `onKeyDown` (138), `draggable` (139) — no pointer/click/touch handler. Could Spacebar-only be an intentional "keyboard-first" design? Even so, the `draggable` attribute and grab cursor are an affordance lie, and touch users are hard-blocked regardless of intent — so intent doesn't rescue it. False-positive risk: could a parent element carry a click handler? Checked — `EvidenceBoard` wires connection solely through `onInitiateConnection` passed to `ClueCard`, invoked only from the keydown path. The severity could be argued down if the game were desktop-keyboard-only by design, but nothing declares that and it ships to the open web. Cheaper fix than full drag-and-drop exists (tap-to-select-then-tap), so the fix cost is low. Stands at High.

#### Verdict after adversarial review
**Stands, High.** Also surfaced as accessibility M13 (Enter vs Space). Confirmed.

#### Recommended action
Add an `onClick` on `ClueCard` that calls `onInitiateConnection(clue.id)` (tap-to-select → tap-to-connect works for mouse **and** touch); add `Enter` to the keydown handler alongside Space; and show a **persistent** hint when the board opens with no connection in progress ("Tap a clue, then tap another to connect them"). Either wire real drag handlers or **remove** the misleading `draggable`/`cursor-grab` affordance so the UI stops promising drag.

#### Suggested validation
Manual: open Evidence Board on a touch emulator (Playwright MCP → mobile viewport) and confirm two taps create a thread. Add an RTL test firing `click` on two `ClueCard`s and asserting `addConnection` was called and both statuses became `connected`.

---

### Finding: *The Debt of Smoke* vignette is permanently unreachable — unlock threshold exceeds the maximum attainable disposition

**ID:** F-003
**Severity:** Medium
**Category:** Content / Correctness
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `public/content/manifest.json:44`, `src/engine/caseProgression.ts:42`, `public/content/cases/the-whitechapel-cipher/npcs.json:34`
- Unlock condition: `npc-sable` disposition ≥ **7** (both `manifest.json` triggerCondition and `caseProgression.VIGNETTE_CONDITIONS`).
- `npc-sable` starts at disposition **−2** (`npcs.json`, verified). Summing **every** positive disposition delta anywhere in Whitechapel — even mutually-exclusive ones — yields only **+6** (`+1` negotiate, `+2` sable-deals `onEnter`, `+3` act3 court-deal `onEnter`). Independently computed maximum reachable disposition = **−2 + 6 = +4**, far below 7.
- Disposition is **case-local**: `loadAndStartCase` resets `state.npcs = {}` (`narrativeSlice.ts:96`), so it cannot accumulate across cases. `the-debt-of-smoke` uses a *different* NPC id (`npc-sable-dos`) internally, so the trigger NPC only lives in Whitechapel.

#### Why it matters
An entire shipped vignette (9 scenes, 4 clues, 2 NPCs per `CLAUDE.md`) is dead content no player can access. `docs/status.md` and `CLAUDE.md` list it as a normal unlockable vignette, so this is an **undetected broken flow**, not a documented gap.

#### Adversarial review
Independently recomputed by the lead with a script summing all positive `dispositionDelta`/`onEnter` deltas across Whitechapel: max = +4 vs threshold 7 — the finding is not just plausible, it's arithmetically certain, and it's *conservative* (it assumed a player could take mutually exclusive branches). Could the vignette be intentionally reserved/locked for a future case that raises Sable's disposition? Possibly, but (a) it ships in the manifest as a live vignette, (b) docs present it as reachable, and (c) no other case touches `npc-sable`. Could a save carry disposition forward? No — `loadAndStartCase` wipes `npcs`. The only thing that would invalidate this is a future case granting +5 Sable disposition; none exists. Severity is Medium (not High) because it's a single side-vignette, the main game is unaffected, and it's a one-line content fix — but it's a genuine "impossible to reach shipped content" bug.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed by independent arithmetic. Related to F-024 (unreachable variants) and F-016 (validator blind spot).

#### Recommended action
Lower the threshold to a reachable value (≤ 4), **or** trigger the vignette from a persisted cross-case flag (the pattern already used by `wc-case-complete`/`the-unfinished-case`) instead of a per-case-reset disposition. E.g. set `wc-sable-alliance` on the court-deal ending and gate the vignette on that flag.

#### Suggested validation
Add a validator/test that cross-checks each vignette's disposition/reputation threshold against the maximum attainable value derivable from content deltas, or at minimum a test asserting `checkVignetteUnlocks` can return `the-debt-of-smoke` from some reachable game state. Manually: complete Whitechapel via the Sable path and confirm the vignette unlocks.

---

### Finding: Encounter "Flee"/escape choice in a non-final round is ignored — the fight advances instead of ending

**ID:** F-004
**Severity:** Medium
**Category:** Correctness
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `src/engine/narrativeEngine.ts:562-575`, `public/content/cases/the-mayfair-seance/act3.json:166`, `public/content/cases/the-whitechapel-cipher/act3.json:158`
- `processEncounterChoice` navigates only when `isComplete`, and `isComplete` is derived purely from the round counter: `const nextRound = currentRound + 1; const isComplete = nextRound >= rounds.length` (lines 563-564). It never inspects `choice.isEscapePath`.
- So an escape choice selected in round 1 of a multi-round encounter computes `nextSceneId` from `choice.outcomes` but **discards it** — it just increments the round. Both supernatural boss encounters (Mayfair act 3, Whitechapel act 3) author a round-1 escape/retreat choice.

#### Why it matters
On two of the three main cases' climactic encounters, the "Flee"/"Retreat" button is a dead control: clicking it neither escapes nor shows the intended escape ending — it silently advances to the next round of the fight the player was trying to leave. A broken core mechanic at the most dramatic moment of the game.

#### Adversarial review
The cited engine lines were re-opened and confirm `isComplete` ignores `isEscapePath`. The content lines were cited by the finder; the lead confirmed `isEscapePath` choices exist in encounter content generally (F-002's sibling verification saw `isEscapePath` handling in `getEncounterChoices`). Could this be intentional — "you can't flee a boss until it's over"? No: the content deliberately authors `isEscapePath` choices *inside* early rounds, and `getEncounterChoices` goes out of its way to always include escape paths (`narrativeEngine.ts:621`) — the engine is set up to offer escape, then the processing path ignores it. That contradiction is the bug. False-positive risk: if every escape choice happened to sit only in the final round, the counter-based completion would coincidentally work — but the cited round-1 placements refute that. Severity Medium: it's a real broken flow on climactic content, but the encounter still resolves (player continues fighting) rather than crashing, and it's a contained engine fix. A residual PLAUSIBLE flag would be justified only pending an in-browser click-through, which is cheap to do.

#### Verdict after adversarial review
**Stands, Medium.** Engine evidence confirmed directly; recommend a 5-minute Playwright confirmation of the exact content choices.

#### Recommended action
In `processEncounterChoice`, treat a chosen `choice.isEscapePath` (and arguably any choice whose outcome points outside the encounter) as terminal: set `isComplete = true` and call `actions.goToScene(nextSceneId)` regardless of round index.

#### Suggested validation
Add an engine test: build a 3-round encounter, pass an `isEscapePath` choice in round 1, assert `result.encounterState.isComplete === true` and `actions.goToScene` was called with the escape target. Manually confirm via Playwright MCP on the Mayfair act-3 encounter.

---

### Finding: The 334-test suite never runs in CI — nothing gates deploy or PRs

**ID:** F-005
**Severity:** Medium
**Category:** CI/CD
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `.github/workflows/deploy.yml:28-40`, `.github/workflows/security.yml`, `package.json:11`
- `deploy.yml` runs `npm ci` → `validateCase.mjs` → `npm audit` → `npm run build` → deploy. There is **no** `npm run test:run` step anywhere in either workflow.
- `deploy.yml` triggers on `push: branches:[main]` only; there is **no** `pull_request` trigger for tests/build, so PRs are never checked before merge.

#### Why it matters
The project's entire correctness safety net — 334 tests including property-based dice/engine/save suites — is decorative from a CI standpoint. A commit that breaks scene resolution, dice math, save migration, or condition evaluation still passes `tsc && vite build` and **deploys straight to production Pages**. `main` is protected by nothing before push.

#### Adversarial review
Re-read both workflow files: confirmed no test invocation and no `pull_request` trigger. Could tests be intentionally excluded for speed? The suite runs in ~12 s — negligible next to the OWASP Dependency-Check job — so speed is not a credible justification. Could a branch-protection rule enforce tests server-side (invisible in the repo)? Possible, but unverifiable from the repo and not the documented protocol (`PROJECT_STATE.md` says the quality gate is run manually by the developer). Even if a human runs tests locally, that's not CI enforcement and doesn't protect against a forgetful push. The only thing that weakens this is an out-of-repo branch-protection rule requiring a status check — worth confirming, but the repo as committed provides zero automated test gating. Severity Medium (not High) because the current developer clearly does run tests (334 green), so the *practical* risk today is low; the risk is structural and grows with contributors.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed from workflow files. Cheap, high-value fix.

#### Recommended action
Add a `test` job (or step) running `npm run test:run`; make `deploy` `needs:` it. Add `pull_request: branches:[main]` to run build + tests + validator on PRs so `main` is protected before merge, not only after push.

#### Suggested validation
Open a PR that deliberately breaks one test; confirm CI fails and blocks. Confirm the deploy job now depends on the test job in the Actions graph.

---

### Finding: `onEnter` effects re-fire on every revisit, on save-load, and (dev) twice under StrictMode — non-idempotent deltas stack

**ID:** F-006
**Severity:** Medium
**Category:** Correctness
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `src/components/NarrativePanel/NarrativePanel.tsx:60-93`, `src/store/slices/metaSlice.ts:87`
- `onEnter` application is guarded only by an in-component ref: `if (!scene || currentSceneId === prevSceneRef.current) return; prevSceneRef.current = currentSceneId;` (lines 61-62). This ref resets to `''` on every remount and is not persisted.
- Therefore effects re-apply when: the player navigates back into a scene they've visited (the ref only blocks *consecutive* identical ids), the component remounts (overlay/review flows, StrictMode double-invoke in dev), or a save is loaded while sitting on a scene with an `onEnter` penalty (load → NarrativePanel mounts → ref is `''` → effects fire).
- `applyEffects` deltas (`worldSlice.ts:33-65`) are additive: `composure`, `vitality`, `reputation`, `disposition`, `suspicion` all stack.

#### Why it matters
A player can lose (or gain) composure/vitality/reputation repeatedly by re-entering a scene, or by loading a save on a penalty scene. Meters can be drained toward breakdown/incapacitation, or reputation farmed to unlock vignettes early. Flag/`discoverClue`/`setMemoryFlag` effects are naturally idempotent, but numeric deltas are not — and those drive the survival and progression systems.

#### Adversarial review
Re-verified the guard is a non-persisted `useRef('')` keyed on the *previous* scene id, so any A→B→A navigation re-fires A's `onEnter`, and any remount re-fires the current scene's. Is the risk overstated? The `sceneHistory`/back-button flow uses a separate read-only review path (`App.tsx:38-59`) that does **not** re-navigate, so ordinary "review previous" doesn't trigger it — that narrows the exposure. But loading a save onto an `onEnter` scene, and any future feature that revisits scenes, will re-apply. The StrictMode double-fire is dev-only (production React doesn't double-invoke effects), so that specific vector doesn't ship. The core defect — additive deltas with a per-mount guard — is real and matches how the game persists mid-scene. Severity Medium: it requires specific navigation/load patterns rather than happening every turn, and content today has relatively few large `onEnter` penalties, but it's a genuine state-corruption/exploit path. Not Low because it can trigger a false breakdown/incapacitation (game-over-ish) or unearned unlocks.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed. Ties to F-008 (effects should live in the transition path, not the view).

#### Recommended action
Make `onEnter` idempotent per scene per playthrough: persist an `onEnterApplied` record (Set of scene ids) in `GameState` and skip re-application; **or** move `onEnter` application into `goToScene`/a dedicated `enterScene` action so it fires exactly once per real transition, decoupled from component mount. The latter also fixes F-008.

#### Suggested validation
Add a test: enter a scene with `onEnter:[{type:'composure',delta:-2}]`, navigate away and back, assert composure dropped only once. Add a load-time test: save on a penalty scene, load, assert composure unchanged by the load.

---

### Finding: `high-contrast` mode is a no-op, and overlays lack focus trap, initial focus, and focus restoration

**ID:** F-007
**Severity:** Medium
**Category:** Accessibility
**Confidence:** High
**Status:** Confirmed (bundles verified a11y findings M10, M11, M12)

#### Evidence
- **High contrast no-op:** `src/index.css:14` defines `.high-contrast { --color-bg:#000; --color-text:#fff; … background-color:var(--color-bg); color:var(--color-text) }` on `<html>`, but the app root div paints `bg-gaslight-ink` over it and every text node keeps its designed color. Independently confirmed: `.high-contrast` appears in `index.css` but **nothing** in `tailwind.config.js` or components consumes the class or CSS vars. `SettingsPanel` exposes the toggle and it's tested — so the feature is advertised and "green" but visually inert.
- **No focus trap / initial focus / inert background:** `EvidenceBoard.tsx:168`, `CaseJournal.tsx:91`, `NPCGallery.tsx:100` render `role="dialog" aria-modal="true"` but (unlike `SettingsPanel`, which traps at line 25) none moves focus into the dialog on open, none traps Tab, and the background (`App.tsx:263`) is not `inert`/`aria-hidden`. Tab escapes into obscured controls.
- **No focus restoration:** closing any overlay drops focus to `<body>` (`SettingsPanel.tsx:25`, `App.tsx:272`); keyboard users must Tab from the top of the header each time.

#### Why it matters
Low-vision users who enable "High contrast" see zero change. Keyboard and screen-reader users opening the Evidence Board (a core mechanic) start with focus stranded behind the modal, can Tab out into hidden controls (WCAG 2.4.3 / 2.1.2), and on close are dumped to page top. These are real barriers on features the UI actively advertises.

#### Adversarial review
Each sub-claim was independently re-verified: `.high-contrast` CSS exists but is consumed by nothing (grep in tailwind/components = 0); the three overlays have `aria-modal` but no focus management, while `SettingsPanel` proves the team knows the pattern (so it's an omission, not ignorance). Could `aria-modal="true"` alone suffice? No — `aria-modal` is a hint to AT but does not trap DOM focus or prevent Tab escape; browsers still let Tab leave. Could high-contrast be "reserved for later"? It's shipped in Settings and covered by a passing test (`accessibilitySettings.test.tsx`), so it reads as done when it isn't — that's worse than absent. One related candidate (composure/vitality announcements suppressed under reducedMotion) was **rejected** in verification because `EffectFeedback` already announces deltas via `aria-live` regardless of motion pref — so that specific claim is not part of this finding. Severity Medium: serious for affected users, but the game is playable by mouse users and much a11y is genuinely good (see strengths).

#### Verdict after adversarial review
**Stands, Medium.** Three confirmed a11y defects on advertised features. Confirmed.

#### Recommended action
(a) Ship a real high-contrast stylesheet overriding component colors under `.high-contrast .text-gaslight-fog{color:#fff!important}` etc. (or drive colors through the CSS vars it already sets). (b) Extract `SettingsPanel`'s focus-trap into a shared `useFocusTrap` hook and apply it to `EvidenceBoard`/`CaseJournal`/`NPCGallery`; move focus to the heading/close button on open; `inert` the background. (c) Capture `document.activeElement` on overlay open and restore it on close.

#### Suggested validation
Enable high contrast and screenshot before/after (Playwright MCP) — background should go black, text white. Keyboard test each overlay: focus lands inside on open, Tab cycles within, Esc closes, focus returns to the invoking button. Consider `jest-axe` in component tests.

---

### Finding: Core game mechanics live inside UI components (deduction resolution, clue-check) and model mutation is coupled to view lifecycle

**ID:** F-008
**Severity:** Medium
**Category:** Architecture
**Confidence:** High
**Status:** Confirmed (bundles architecture M2 + M3)

#### Evidence
- **Logic in view:** `DeductionButton.tsx:18` declares `const DEDUCTION_DC = 14;`, line 37 rolls `performCheck('reason', investigator, DEDUCTION_DC, …)`, lines 42-53 call `buildDeduction`, `addDeduction`, and transition clue status to `deduced`/`contested`/`examined` — the entire deduction state machine in a React button. `SceneCluePrompts.tsx:81` similarly runs `performCheck(...)` and decides check-clue discovery success/failure in the component. Neither flow has an engine function; both bypass the `EngineActions` indirection used everywhere else.
- **Model coupled to view:** `onEnter` effects are applied from a `NarrativePanel` `useEffect` (`NarrativePanel.tsx:60-67`), not from the scene-transition path (`narrativeSlice.goToScene:40`). Any scene change without `NarrativePanel` mounted (headless test, review mode, future alternate view) silently skips composure/vitality/flag/clue mutations.

#### Why it matters
The `DEDUCTION_DC` constant and the deduction/clue-check success-failure state machines cannot be unit-tested without rendering React, directly contradicting the project's stated boundary (`src/engine/` = game logic, kept store-free with care). Two different code paths now mutate clue status (engine vs component). And a state transition's *consequences* depend on which component happens to be mounted — the root cause of F-006's re-fire behavior.

#### Adversarial review
All cited lines re-opened and accurate: `DEDUCTION_DC=14` and the check/buildDeduction/status transitions are in the button; `onEnter` application is in a `NarrativePanel` effect. Is this pragmatic and acceptable for a small game? Partly — colocating a one-off UI action with its trigger is common. But the project explicitly invested in a store-free engine and `EngineActions` inversion *specifically* so logic is testable and centralized; these two flows are the exceptions that undercut that investment, and F-006 is the concrete bug that the `onEnter`-in-view placement causes. False-positive risk: is there already an engine `resolveDeduction`? No — grep shows the DC and resolution live only in the component. Severity Medium: it's maintainability/testability debt with one linked correctness bug (F-006), not a standalone crash. A cheaper partial fix (just moving `onEnter` into `goToScene`) resolves the highest-impact half.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed. The `onEnter` half should be prioritized because it also fixes F-006.

#### Recommended action
Extract `resolveDeduction(connectedClueIds, state, actions)` and `resolveClueCheck(discovery, state)` into the engine; move `DEDUCTION_DC` into the engine as a named constant. Move `onEnter` application into `goToScene` (or a dedicated `enterScene` engine/store action) so it fires deterministically with the transition. Components then only render results.

#### Suggested validation
Add engine unit tests for `resolveDeduction` (critical/success/partial/failure/fumble tiers) and `resolveClueCheck`. Add a store-level test that `goToScene` applies `onEnter` exactly once without any component mounted.

---

### Finding: HeaderBar title and save list display the raw case-id slug instead of the human title

**ID:** F-010
**Severity:** Medium
**Category:** UX
**Confidence:** High
**Status:** Confirmed

#### Evidence
- Files: `src/components/HeaderBar/HeaderBar.tsx:53`, `src/store/slices/narrativeSlice.ts:76` (`currentCase = data.meta.id`), `src/engine/saveManager.ts:69` (`caseName: state.currentCase`), `src/components/TitleScreen/LoadGameScreen.tsx:81`
- The store's `currentCase` holds the id slug (`the-whitechapel-cipher`); HeaderBar renders it directly, and `SaveManager.save` records `caseName: state.currentCase` (the slug), which `LoadGameScreen` then lists.

#### Why it matters
Throughout the entire in-game session the top bar reads `the-whitechapel-cipher`, and the Load screen lists saves under hyphenated slugs — a developer-facing string in the most prominent UI location, directly undermining the carefully-authored Victorian tone. It's the most visible polish defect in the app.

#### Adversarial review
Cited lines confirm the slug flows from `meta.id` → `currentCase` → HeaderBar and save index. Could HeaderBar map slug→title itself? It has `caseData` available, so the fix is trivial. Is it possible a CSS/format transform prettifies the slug at render? No transform is applied at `HeaderBar.tsx:53`. The only nuance: the save index stores the slug at save time, so fixing display alone won't retroactively fix old saves' `caseName` — the fix must also change what's *written*. Severity Medium: purely cosmetic (no functional impact) but pervasive and tone-breaking, which for a mood-driven narrative game matters more than a typical cosmetic bug.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed.

#### Recommended action
Render `useStore(s => s.caseData?.meta.title)` in HeaderBar (fall back to a de-slugified `currentCase`). In `saveGame`/`autoSave`, store `caseName: caseData?.meta.title ?? currentCase` so the save index carries the readable title going forward.

#### Suggested validation
Start a case; confirm HeaderBar shows "The Whitechapel Cipher." Save, revisit Load screen, confirm the readable title appears.

---

### Finding: Reaching 0 Composure/Vitality dumps the player into a "Case Complete" dead-end that contradicts the recovery narrative

**ID:** F-011
**Severity:** Medium
**Category:** UX / Content
**Confidence:** High
**Status:** Confirmed (bundles ux M15 + correctness L "breakdown dead-ends")

#### Evidence
- Files: `src/App.tsx:35,66`, `public/content/shared/breakdown.json`, `public/content/shared/incapacitation.json`
- The shared `breakdown`/`incapacitation` scenes have **0 choices** and no recovery edge. `GameContent` treats any choiceless, non-encounter scene as terminal: `isTerminal = scene && scene.choices.length === 0 && !scene.encounter` (`App.tsx:35`) → renders a "Case Complete" button (line 66).
- So hitting 0 composure/vitality routes the player to a scene whose only exit is "Case Complete" → case-selection.

#### Why it matters
`CLAUDE.md` lists "recovery mechanics" as FIXED, but mechanically a knockout is an unavoidable, unsignposted game-over reskinned as a triumphant "Case Complete." The player is told (in breakdown prose) they'll recover, then is forced to end the case and returned to case selection — a jarring tonal and mechanical contradiction.

#### Adversarial review
Confirmed the shared scenes are choiceless and that `isTerminal` fires on any choiceless non-encounter scene, so breakdown/incapacitation are indistinguishable from a real ending. Is this "recovery" as designed? The docs claim recovery scenes with +1 composure/vitality `onEnter` exist — and they do on some scenes — but the *breakdown terminal itself* offers no continue-into-case path, so the loop dead-ends. Could a case-specific breakdown variant provide choices? F-024 shows the case-specific variants are unreachable (their `variantCondition` can never be satisfied), so players always get the generic choiceless version — which reinforces this finding. Severity Medium: it's a real broken/negative-feeling flow at a survival moment, but it doesn't crash and the player retains progress via autosave. Could be argued Low if breakdown is rare in practice, but F-006 makes accidental breakdown *more* likely.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed; compounded by F-006 and F-024.

#### Recommended action
Give breakdown/incapacitation scenes an explicit choice ("Rest and recover" with a +composure/+vitality `onEnter`, leading back into the case), **or** render a distinct "Investigation halted" screen in `GameContent` for these specific scene ids instead of reusing the "Case Complete" terminal.

#### Suggested validation
Drive composure to 0 in a case; confirm the breakdown scene offers a recovery/continue path (or a clearly-labeled halt screen), not a "Case Complete" button.

---

### Finding: Vignette unlock rules are duplicated; manifest/meta `triggerCondition` is dead config

**ID:** F-012
**Severity:** Medium
**Category:** Architecture / Content
**Confidence:** High
**Status:** Confirmed (bundles architecture M1 + content-integrity L)

#### Evidence
- Files: `src/engine/caseProgression.ts:32-49`, `public/content/manifest.json:26-33`, `src/types/index.ts:263,286`, `src/components/CaseSelection/CaseSelection.tsx:58-60`
- Unlock rules are hardcoded in `VIGNETTE_CONDITIONS` (engine) **and** duplicated as `triggerCondition` blocks in `manifest.json` and each vignette `meta.json`, and typed on `VignetteMeta`/`CaseManifestEntry`. But `grep -rn triggerCondition src/` shows `triggerCondition` is referenced **only** in type definitions — it is never evaluated. Unlocking is driven solely by the `vignette-unlocked-*` flag set by `checkVignetteUnlocks` and read by `CaseSelection`.

#### Why it matters
Every unlock rule exists in 2-3 hand-synced places. An author editing a threshold in `manifest.json` (the obvious spot, beside the vignette metadata) sees **no** behavior change, because the runtime only consults the hardcoded engine array. This is exactly the trap that produced F-003 (the manifest says disp ≥ 7, the engine says disp ≥ 7, and *both* are wrong-but-consistent, so nothing flags it).

#### Adversarial review
Every location re-verified; the grep proving `triggerCondition` is read nowhere is dispositive. Could the duplication be intentional redundancy? The fields are typed as a real, evaluable `Condition` and named `triggerCondition`, strongly implying they were meant to be honored — leaving them inert is drift. The rules agree today, so there's no *active* divergence bug, which caps severity at Medium (borderline Low). But it's a live footgun and it directly enabled F-003 going unnoticed. Cheapest safe fix: evaluate `triggerCondition` via the existing `evaluateConditions` and delete `VIGNETTE_CONDITIONS`, giving one source of truth.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed single-source-of-truth violation.

#### Recommended action
Make `checkVignetteUnlocks` read `triggerCondition` from the manifest/vignette meta and evaluate it with `evaluateConditions`; delete the `VIGNETTE_CONDITIONS` array. (Or, if keeping the engine array, delete the dead `triggerCondition` from types + content to stop implying it's honored.)

#### Suggested validation
Change a manifest `triggerCondition` threshold and assert unlock behavior follows it; or add a test asserting `VIGNETTE_CONDITIONS` matches manifest entries so they can't drift.

---

### Finding: Content validators don't check Condition targets, variants, `npcEffect`, or encounter edges — F-003/F-004/F-024 all pass CI clean

**ID:** F-016
**Severity:** Medium
**Category:** Content / Testing
**Confidence:** High
**Status:** Confirmed (bundles content-integrity M17 + correctness L "encounter edges")

#### Evidence
- Files: `scripts/validateCase.mjs:100-160`, `src/engine/narrativeEngine.ts:102-184`
- Both validators check choice-outcome scene edges, `requiresClue`/`advantageIf`/`cluesAvailable` clue refs, faculty-check tier completeness, and `onEnter` `discoverClue`/npc targets. Neither validates: `conditions[]` targets (`hasClue`/`hasDeduction`/`hasFlag`/`npcDisposition`/`factionReputation` refs), `variantCondition`/`variantOf` satisfiability, `npcEffect.npcId`, or **anything inside `encounter.rounds[].choices`** (edges or tier completeness).

#### Why it matters
"`validateCase.mjs` → clean for all 7 cases" is treated as proof of content integrity, yet the unreachable vignette (F-003), the dead escape button's content (F-004), six unreachable variant scenes (F-024), and four dangling clue `sceneSource` refs (F-023) all pass. This is CI false-confidence: a future typo in an `npcDisposition` target or a broken encounter edge would ship silently.

#### Adversarial review
Both validators re-read; the coverage gaps are confirmed by reading their loops (they iterate `scene.choices`/`scene.cluesAvailable`/`scene.onEnter` but never `scene.conditions`, `choice.conditions`, `scene.encounter`, or variant satisfiability). Could this be intentional scope? The validator's own comments emphasize edge/clue integrity, suggesting conditions/encounters were simply out of scope — understandable, but the gap is real and demonstrably let three separate confirmed bugs through. Severity Medium: it's a testing/QA-tooling gap that doesn't itself break the game but removes the guard rail for content bugs that do. Fix is additive and low-risk (more checks can only surface issues).

#### Verdict after adversarial review
**Stands, Medium.** Confirmed. Highest-leverage preventative fix — closes the door that F-003/F-004/F-024 walked through.

#### Recommended action
Extend the validator (ideally the shared one from F-017) to: (1) walk `conditions[]` on scenes/choices and validate targets against clue/npc/faculty/archetype/faction allowlists; (2) validate `variantOf` points to a real scene and that `variantCondition` is at least theoretically satisfiable; (3) validate `npcEffect.npcId`; (4) recurse into `encounter.rounds[].choices` for edges and tier completeness; (5) add the F-003-style disposition/reputation reachability check.

#### Suggested validation
Introduce a deliberately broken condition target in a scratch case and confirm the validator now errors. Run against all 7 cases and triage the warnings it surfaces.

---

### Finding: Two content validators (build-time JS + runtime TS) have diverged

**ID:** F-017
**Severity:** Medium
**Category:** Maintainability
**Confidence:** High
**Status:** Confirmed (bundles maintainability M19 + type-safety L)

#### Evidence
- Files: `scripts/validateCase.mjs:119`, `src/engine/narrativeEngine.ts:142`
- The runtime `validateContent` flags missing tiers when a choice has `faculty && (difficulty !== undefined || dynamicDifficulty)` (`narrativeEngine.ts:142`). The CLI validator only checks `choice.faculty && choice.difficulty !== undefined` (`validateCase.mjs:119`) — it **misses** `dynamicDifficulty`-only choices. Conversely the CLI validator does reachability analysis the runtime one doesn't.

#### Why it matters
There is no single source of truth for "valid content." A `dynamicDifficulty` choice with a missing outcome tier passes `node scripts/validateCase.mjs` (green CI) but is rejected at load by `validateContent` (`loadAndStartCase` throws) — i.e. CI says clean, the game crashes on load. As schemas evolve the two will keep drifting.

#### Adversarial review
Both validators re-read; the `dynamicDifficulty` divergence is exact (CLI omits the `|| dynamicDifficulty` clause). Is maintaining two validators justified (one needs Node/fs for reachability, the other runs in-browser)? The *reachability* half legitimately needs filesystem access, but the *reference/tier-completeness* checks are identical logic that should be shared. Severity Medium: it's a real correctness-of-tooling gap (green CI + runtime crash is the worst combination), but it only bites content using `dynamicDifficulty` without full tiers — currently none, so it's latent. Fix: extract shared checks into one TS module consumed by both.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed. Fix together with F-016.

#### Recommended action
Extract the shared checks (edge refs, clue refs, `onEnter` targets, tier completeness incl. `dynamicDifficulty`) into one TS module; have `validateContent` and a thin `validateCase.mjs` wrapper both consume it. Keep reachability as a CLI-only extra.

#### Suggested validation
Add a fixture with a `dynamicDifficulty` choice missing the `partial` tier; assert both validators reject it identically.

---

### Finding: Ability/progression flag strings are hardcoded across 5 files with no central constant

**ID:** F-018
**Severity:** Medium
**Category:** Maintainability
**Confidence:** High
**Status:** Confirmed (bundles maintainability M18 + architecture/type-safety L variants)

#### Evidence
- Files: `src/engine/narrativeEngine.ts:327` (`ABILITY_AUTO_SUCCEED_FLAGS`), `src/App.tsx:24` (`ABILITY_FLAGS`), `src/store/slices/narrativeSlice.ts:79-82,127-130` (delete-on-load), plus `computeChoiceResult`/`processEncounterChoice` reads of `ability-veil-sight-active`, `last-critical-faculty`, and `vignette-unlocked-*`.
- `flags` is `Record<string, boolean>` (`types/index.ts:221`), so a mismatched string is invisible to the compiler. `App.tsx` and the engine maintain **two separate** archetype→flag maps that must agree.

#### Why it matters
These strings form a hidden contract spanning engine, store, UI, and JSON content. Renaming `ability-veil-sight-active` in the engine but missing `App.tsx` (or a reset site in `narrativeSlice`) silently breaks the Occultist ability with **zero** compile error and no test failure unless a test happens to cover that exact path. The two divergent archetype→flag maps are a latent inconsistency.

#### Adversarial review
All five reference sites confirmed. Could the strings be "stable enough to not matter"? They already appear in ≥5 files with two parallel maps — precisely the condition under which a rename goes wrong. Because `flags` is stringly-typed, TypeScript provides no safety net (this is also why F-013's `as unknown as boolean` cast for `last-critical-faculty` type-checks). Severity Medium: no current bug (the strings agree today), but high regression-risk and a real refactor hazard given the project expects ongoing content/archetype work. Cheap fix (one constants module).

#### Verdict after adversarial review
**Stands, Medium.** Confirmed. Enabler for safer future changes.

#### Recommended action
Create `src/engine/flags.ts` exporting a `FLAGS` object (`abilityAutoSucceed.{reason,vigor,influence}`, `veilSight`, `lastCriticalFaculty`, `vignetteUnlocked(id)`), import it everywhere, and delete the duplicate `App.tsx`/engine maps. Consider a `type KnownFlag` union to narrow `setFlag` where possible.

#### Suggested validation
`grep -rn "'ability-" src` should return only `flags.ts` after refactor. Existing ability tests (`AbilityButton.test.tsx`, `veilSight.test.ts`) must stay green.

---

### Finding: `narrativeEngine.ts` (641 lines) mixes six responsibilities — the top regression-risk file

**ID:** F-019
**Severity:** Medium
**Category:** Maintainability
**Confidence:** High
**Status:** Confirmed (bundles maintainability M20 + architecture L)

#### Evidence
- File: `src/engine/narrativeEngine.ts` — content loading (`:37-94`), validation (`:102-184`), condition evaluation (`:193-266`), scene resolution (`:273-292`), clue-discovery gating (`:308-323`), choice processing (`:339-394`), and the entire encounter system (`:428-641`) all in one module. Advantage logic is duplicated three ways across `computeChoiceResult`, `processEncounterChoice`, and `getEncounterChoices`.

#### Why it matters
Every feature area funnels through one file, so unrelated changes collide in the same module (merge-conflict and regression surface). The triplicated advantage computation (clue advantage + Veil-Sight advantage) is where F-014 (player-facing advantage badge disagreeing with the actual roll) lives.

#### Adversarial review
Structure confirmed by section headers at the cited lines. Is 641 lines actually a "god file"? It's large but internally sectioned and the functions are individually cohesive/pure where possible — so it's not egregious. The stronger part of the finding is the **duplicated advantage logic**, which is a genuine correctness-adjacent smell (F-014). Severity Medium leans on maintainability + the duplication; splitting is low-risk mechanical work. Could be Low if considered purely cosmetic, but the duplication has already produced a real UX discrepancy, so Medium holds.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed; prioritize de-duplicating advantage over the file split.

#### Recommended action
Split into `contentLoader.ts`, `contentValidation.ts`, `conditions.ts`, `choiceResolution.ts`, `encounters.ts`. Extract a single `computeAdvantage(choice, state)` used by all three call sites (fixing F-014 in the process).

#### Suggested validation
No behavior change intended — full test suite must remain 334 green after the split. Add a unit test for the shared `computeAdvantage`.

---

### Finding: `App.tsx` screen state machine, load-error handling, and ability wiring have zero tests; core game-loop effects untested

**ID:** F-020
**Severity:** Medium
**Category:** Testing
**Confidence:** High
**Status:** Confirmed (bundles testing M6 + M7)

#### Evidence
- Files: `src/App.tsx:93,122,135,151`, `src/components/NarrativePanel/NarrativePanel.tsx:60-93`
- No `App.test.tsx` exists. The top-level screen machine (title→creation→selection→game→complete), `handleLoadSave` failure routing, archetype→ability-flag mapping, and ending-narrative capture are untested. `NarrativePanel`'s `onEnter` application + auto-discovery effect (the core loop) has no test — despite being documented as FIXED and being the surface where F-006's double-fire lives.

#### Why it matters
`App.tsx` is the orchestration that turns tested units into a playable game. A regression breaking a screen transition, routing a failed load to the wrong screen, mis-mapping an archetype to the wrong ability, or losing the ending narrative would pass all 334 tests. The untested `NarrativePanel` effect is exactly where a double-apply (F-006) or missed-apply would hide.

#### Adversarial review
Confirmed no `App.test.tsx`/`NarrativePanel.test.tsx` in the file tree. Is App.tsx too integration-heavy to test cheaply? RTL handles this routinely (render `<App/>`, click through). The finding is standard test-gap identification with precise targets. Severity Medium: it's absence-of-coverage on the highest-value integration seam, not a known bug — but combined with F-005 (no CI tests) the practical exposure is higher. Not High because the current app demonstrably works end-to-end.

#### Verdict after adversarial review
**Stands, Medium.** Confirmed.

#### Recommended action
Add `src/App.test.tsx`: (1) happy-path screen flow; (2) `handleLoadSave` failure sets `loadError` and routes to title (mock `loadGame→false`); (3) each archetype maps to the correct ability flag; (4) completion captures ending narrative. Add `NarrativePanel.test.tsx` mounting against a real store: assert `onEnter:[{composure:-1}]` applies exactly once per entry and an `automatic` `cluesAvailable` discovery fires.

#### Suggested validation
`npm run test:run` count rises; the new tests fail if F-006's guard is removed or a screen route is broken.

---

### Finding: Third-party OWASP action pinned to floating `@main` — supply-chain risk and non-reproducible scans

**ID:** F-021
**Severity:** Medium
**Category:** Security / CI/CD
**Confidence:** High
**Status:** Confirmed (bundles CI M9 + security L)

#### Evidence
- File: `.github/workflows/security.yml:40` — `uses: dependency-check/Dependency-Check_Action@main`.

#### Why it matters
`@main` resolves to whatever upstream pushes at run time. A compromised or breaking upstream commit executes in a job with `security-events: write` and access to the checked-out source. Scans are also non-reproducible: two runs on the same commit can behave differently. This is the one genuine supply-chain exposure in an otherwise well-locked project (0 npm vulns, committed lockfile, least-privilege tokens).

#### Adversarial review
Confirmed the exact ref. Is the blast radius limited? The job's token is scoped to `security-events: write` + `contents: read` (good), so it can't publish the site — but it can still exfiltrate source and tamper with security findings, and unpinned third-party actions are a well-known attack vector (cf. tj-actions). Severity Medium: real but bounded by least-privilege scoping and the fact this is a security-scan job, not the deploy path. Fix is trivial (pin a SHA).

#### Verdict after adversarial review
**Stands, Medium.** Confirmed.

#### Recommended action
Pin to a full commit SHA with a version comment: `dependency-check/Dependency-Check_Action@<sha>  # v<x.y.z>`. Bump deliberately via Dependabot. Consider whether OWASP Dependency-Check adds value over `npm audit` for a lockfile-only JS project (see F-030 on its NVD-key flakiness).

#### Suggested validation
Confirm the workflow references a 40-char SHA; a Dependabot PR should be the only way it changes.

---

## Low and Polish findings

All entries below survived adversarial verification. Format: **[ID] Title** — evidence → impact → *adversarial note* → fix.

### Correctness (Low)

- **[F-013] `flags` typed `Record<string,boolean>` but stores Faculty strings via `as unknown as boolean`.** `narrativeEngine.ts:383` stores `last-critical-faculty` as a Faculty string through a double-cast; read back in `caseProgression.ts:62` as `as unknown as Faculty`. → The declared type is false; any consumer trusting `flags[x] === true` breaks. *Adversarial:* works today because reads/writes agree and `isValidFaculty` guards on read; it's a type-safety hole, not a live bug — Low. → Model this as a separate typed field (`lastCriticalFaculty?: Faculty` on state) instead of smuggling a string through the boolean map.
- **[F-022] Non-check choice can navigate to `undefined` → `resolveScene` throws.** `narrativeEngine.ts:366`: `outcomes['success'] ?? outcomes['critical']` can be `undefined` for a non-check choice lacking both; `goToScene(undefined)` → `useCurrentScene` throws (caught → returns null → blank scene). Lead confirmed **content currently avoids this** (0 offending choices). → *Adversarial:* purely latent — enforced only by author discipline, and neither validator checks it (F-016). Low. → Validate "every non-check choice has a `success` or `critical` outcome" in the validator; guard `computeChoiceResult` with a clear error.
- **[F-014] Advantage computed 3-4 ways; the player-facing "Advantage" badge diverges from the roll.** `narrativeEngine.ts:350` (choice) vs `getEncounterChoices` `_hasAdvantage` (occult-only) vs `ChoiceCard` badge. An Occultist with Veil Sight active rolls with advantage on Lore checks but the badge may not show it (and vice-versa). → *Adversarial:* real display/logic mismatch; low player impact (advantage still applied correctly to the roll, only the indicator lies). Low. → Extract one `computeAdvantage` (see F-019) and drive both the badge and the roll from it.
- **[F-015] `SaveManager.migrate()` skips all migrations when `version` is missing/undefined.** `saveManager.ts:128`: `if (version === CURRENT) return; ... if (version < 1)` — `undefined < 1` is `false`, so a versionless blob bypasses v0→v1→v2 backfill. `loadGame` defensively re-defaults `sceneHistory`/`connections` (`metaSlice.ts:96-97`), masking most fallout. → *Adversarial:* **PLAUSIBLE** — needs a hand-edited/legacy save to trigger; `factionReputation` backfill is *not* re-defaulted in loadGame, so a versionless save could leave it undefined. Low. → Treat missing/NaN `version` as `0` at the top of `migrate`.

### Type safety (Low)

- **[F-026] `Condition.value` is a loose 4-way union, forcing unchecked casts in every branch.** `types/index.ts:112`; `evaluateCondition` casts `value as number`/`as NpcSuspicionTier`/`as string`. → Not discriminated on `type`, so TS can't verify a `npcSuspicion` carries a tier. Low. → Convert `Condition` to a discriminated union keyed on `type`.
- **[F-027] `getEncounterChoices` emits `_hasAdvantage` that no consumer reads and that disagrees with the real advantage rule.** `narrativeEngine.ts:592`. → Dead, misleading annotation leaked into the type contract. Low. → Remove it, or make it the single source consumed by `ChoiceCard`.

### Testing (Low)

- **[F-028] `integration.test.ts` is over-mocked — `mockActions as any` + stubbed dice make it a unit test.** `integration.test.ts:8,60`. → Adding a required `EngineActions` field won't fail it — the "integration" guarantee is hollow. *Adversarial:* **PLAUSIBLE** — it still tests `processChoice` logic usefully; the label oversells it. Low. → Type the mock as `EngineActions` (drop `as any`) and add one real-store integration test.
- **[F-029] `resolveCheck` bands / `performCheck` / `resolveDC` / `getTrainedBonus` have no direct unit tests.** `diceEngine.ts:71`. Property tests cover bounds but not the documented DC-3 partial band or the +1 trained bonus specifically. → A silent balance regression wouldn't fail. Low. → Add table-driven tests per tier boundary and trained-bonus per archetype.
- **[F-031] `validateContent` (runtime gate) has zero tests; save round-trip never exercises `connections`; loadVignette + chained v0→v2 migration + ErrorBoundary untested.** `narrativeEngine.ts:102`, `saveManager.property.test.ts:138`, `narrativeSlice.test.ts`. → Coverage holes on load-time gate and persisted evidence-board state. Low. → Add targeted tests for each.

### Build / Deploy / CI (Low)

- **[F-009] Favicon `/vite.svg` is missing and not base-path-rewritten → 404 on every load.** `index.html:6`; lead confirmed `public/vite.svg` does not exist and the app is served under `/gaslight-and-grimoire/` so `/vite.svg` resolves to domain root. → Console 404 on every page load; no favicon. Low. → Add a real favicon under `public/` and reference it relatively (or via `import.meta.env.BASE_URL`).
- **[F-032] `npm audit --audit-level=high` sits in the deploy critical path.** `deploy.yml:33-36`. → A new transitive advisory (usually in build tooling for a static SPA) blocks *all* deploys, even for a docs change. Low. → Move audit to the PR/security workflow (it's already in `security.yml`); keep deploy gated on tests+build+validator.
- **[F-033] Pages `concurrency: cancel-in-progress: true` can abort an in-flight deploy.** `deploy.yml:13-15`. → GitHub recommends `false` for Pages so a rapid second push doesn't cancel a live deploy. Low. → Set `cancel-in-progress: false`.
- **[F-034] No pinned Node version (`engines`/`.nvmrc`); Vite 7 needs node `^20.19 || >=22.12`.** `package.json:5`. → Contributors on Node 20.0-20.18/21 hit opaque Vite failures npm never warns about. Low. → Add `"engines": { "node": ">=20.19" }` and a `.nvmrc`.
- **[F-035] No ESLint or any linter — only `tsc`.** `package.json`; note `AmbientAudio.tsx:61` carries an `eslint-disable` comment for a rule nothing enforces. → Misses `react-hooks/exhaustive-deps`, conditional-hooks, etc. Low. → Add ESLint + `eslint-plugin-react-hooks`, a `lint` script, and a CI step.
- **[F-030] OWASP Dependency-Check has no NVD API key — rate-limited/flaky.** `security.yml:39-49`. → *Adversarial:* **PLAUSIBLE** (depends on runner/NVD behavior). Keyless runs can take 20-40 min or fail to hydrate. Low. → Add an NVD API key secret, or drop Dependency-Check in favor of `npm audit` for this lockfile-only project.

### Security (Low)

- **[F-036] Save deserialization has no schema validation; wholesale `JSON.parse` written into store.** `saveManager.ts:93,128`. → A truncated/tampered/pre-migration save can inject stale or malformed state (and F-015's missing-version path can leave `factionReputation` undefined). *Adversarial:* localStorage is same-origin and user-controlled, so this is robustness/cheating, not remote exploitation — Low. → Validate the parsed shape (or run through `migrate` with defensive defaults) before committing to the store.
- **[F-037] CSP allows `style-src 'unsafe-inline'`; as a `<meta>` tag it can't set frame-ancestors.** `index.html:5`. → `'unsafe-inline'` styles are likely only needed by Tailwind's injected styles / inline `style` props (AccessibilityProvider sets CSS vars, EvidenceBoard sets inline backgrounds). *Adversarial:* removing it may break those inline styles; low real-world risk given no injection sinks. Low. → Investigate a nonce/hash approach or move inline styles to classes; add `X-Frame-Options`/`frame-ancestors` via a Pages `_headers`-equivalent if the host supports it (GitHub Pages does not, so accept clickjacking residual).
- **[F-038] CI `npm ci` runs dependency install lifecycle scripts under the OIDC/Pages token.** `deploy.yml`. → A compromised transitive dep's install script runs with deploy-token access. *Adversarial:* standard for the ecosystem; mitigated by committed lockfile + least-privilege scoping. Low. → Consider `npm ci --ignore-scripts` where feasible, or a separate build-then-deploy token boundary.

### Dependencies (Low) — see also the dependency strategy in the roadmap

- **[F-039] No automated dependency-update tooling despite 13 stale majors, and deploy hard-gates on `npm audit`.** → Deliberate pinning is sound but has no cadence/safety-net; a new advisory can block deploys with no staged upgrade path. Low. → Add Dependabot (grouped, scheduled) and move audit off the deploy path (F-032).
- **[F-040] Unused `@testing-library/user-event` devDependency.** `package.json:24` — no import found in tests. → Install/audit bloat. Low. → Remove, or adopt it (it'd help F-002/F-020 interaction tests).
- **[F-041] Tailwind 4 deferral is correct but couples to autoprefixer + a config rewrite; record it.** `package.json:33`. → Highest-effort upgrade (custom `gaslight-*` palette + fonts must port to the new engine). Low. → Document as an ADR; keep on Tailwind 3 until deliberately scheduled.

### Performance (Low / Polish)

- **[F-042] `buildGameState` used as a Zustand selector returns a fresh object every call → whole-store re-renders.** `store/index.ts:105` (`useCurrentScene`), `utils/gameState.ts:5`, also used in `NarrativePanel:117`. → Every composure tick/flag set/clue discovery re-renders `GameContent`, `NarrativePanel`, `AmbientAudio`, `HeaderBar`, `ChoicePanel`. *Adversarial:* correctness-neutral; perceptible only on low-end mobile — but it's the single biggest render-perf lever. Low. → Subscribe to the specific fields `resolveScene` needs, or wrap with `useShallow`/a memoized snapshot; compute `resolveScene` from narrow selectors.
- **[F-043] No code-splitting — entire app + framer-motion + Howler in one 402 KB eager chunk.** `vite.config.ts`. → Title-screen visitors download the Evidence Board, encounter engine, NPC gallery, settings, framer-motion, and Howler before first paint. Low. → `React.lazy` the overlays and game screen; add `manualChunks` for vendor libs.
- **[F-044] EvidenceBoard layout thrashing: unthrottled scroll/resize/mousemove call `getBoundingClientRect` during render.** `EvidenceBoard.tsx:74,102`. → *Adversarial:* **PLAUSIBLE** (impact scales with clue count; small boards fine). Forces sync reflow while drawing threads. Low. → Throttle to `requestAnimationFrame`; cache rects.
- **[F-045] Object-returning selector hooks lack `useShallow`; list items (ChoiceCard/ClueCard) not memoized and get fresh `Set` props.** `store/index.ts:30`, `ChoicePanel.tsx:55`. → Pure re-render churn. Polish. → Add `useShallow` to object selectors; `React.memo` list items; memoize derived Sets.
- **[F-046] `framer-motion` imported eagerly at ~9 sites with no `LazyMotion` for trivial fades/tweens.** `DiceRollOverlay.tsx:7` et al. → Heaviest single dep for minimal animation. Polish. → Adopt `LazyMotion` + `m` components, or replace simple fades with CSS.
- **[F-047] `injectSharedScenes` adds a second sequential fetch round-trip per case/vignette load.** `narrativeEngine.ts:69`. → Two network RTTs instead of one on high-latency mobile. Low. → Bundle breakdown/incapacitation into the case payload or fetch them in the same `Promise.all`, and cache across loads.

### Accessibility (Low / Polish)

- **[F-048] Framer-motion animations in `ConnectionThread`/`DeductionButton` ignore `reducedMotion`.** `ConnectionThread.tsx:48`. → Threads animate despite the pref (auto-detected at `AccessibilityProvider:31`). Low. → Gate these animations on `reducedMotion` like the other components already do.
- **[F-049] Typewriter skip is a non-focusable `role=button` with `onClick` and no key handler; `aria-live` spams SR during animation.** `SceneText.tsx:86`. → Keyboard users can't skip (WCAG 2.1.1); the live region re-announces the growing fragment each tick. Low. → Make it a real focusable `<button>` with keyboard handling; set the completed text once in the live region, not per interval.
- **[F-050] Low-contrast helper text (`text-stone-500`) fails WCAG AA, with no working high-contrast fallback (F-007).** `CaseJournal.tsx:48` and others. → Hard to read for low-vision users. Low. → Darken/lighten to meet 4.5:1; ensure high-contrast mode overrides it once F-007 is fixed.
- **[F-051] No skip-to-content link; every scene forces keyboard users through the 8-button header.** `index.html`/`App.tsx:245`. → Significant per-scene navigation overhead. Polish. → Add a visually-hidden skip link to the narrative/choices region.

### UX / Product (Low)

- **[F-052] Manual save gives no success feedback; the 10-save cap silently deletes the oldest.** `HeaderBar.tsx:142`, `metaSlice.ts:41-54`. → Players can't tell a save succeeded (or that private-browsing blocked it), and old saves vanish without warning. Low. → Toast on save; warn before evicting the oldest at the cap.
- **[F-053] Ambient/SFX volume sliders exist but do nothing observable (0 assets).** `SettingsPanel.tsx:254`. → Silent game with controls that appear broken. Low. → Ship audio (M milestone) or hide/disable the sliders with an "audio coming soon" note until assets exist.
- **[F-054] Deleting a save is instant with no confirmation — one tap destroys progress.** `LoadGameScreen.tsx:27`. → The ✕ sits beside the load button; an accidental (especially touch) tap irreversibly deletes a playthrough. Low. → Add a confirm step / undo.
- **[F-055] Loading an existing save shows no loading indicator during the async content fetch.** `App.tsx:122`. → On slow links the Load screen appears frozen, inviting repeat taps. Low. → Show the existing `loading` screen during `handleLoadSave` too.

### Content integrity (Low / Polish)

- **[F-024] Six case-specific breakdown/incapacitation variant scenes are unreachable — `variantCondition` is `hasFlag …, value:false`, unsatisfiable.** `the-whitechapel-cipher/variants.json:257` et al. → Hand-written case-flavored recovery narrative never displays; players always get generic shared text. Low. → Fix the variant conditions (or the flag polarity) so case-specific recovery text shows; add variant-satisfiability check to the validator (F-016).
- **[F-023] Four Mayfair clue `sceneSource` fields reference non-existent scenes.** `the-mayfair-seance/clues.json:19` et al. → Metadata drift (display/provenance only; harmless today). Low. → Repoint or clear; validate `sceneSource` in the validator.
- **[F-056] All 37 `ambientAudio` scene refs resolve to files that don't exist → 404 at runtime.** `AmbientAudio.tsx:39-40`. → Documented "zero audio assets" gap, but each scene transition fires a 404. Low. → Ship audio (M milestone) or guard fetches behind an asset manifest.
- **[F-025] Audio + illustration systems are fully coded but 0 assets ship — the game is silent and image-free.** (Cross-refs F-053/F-056.) → The atmospheric mood the design leans on is entirely absent. Low (known gap). → The open **Media Assets (M)** milestone in `PROJECT_STATE.md`; decide sourcing/licensing (open ADR) then produce the 9 SFX + ambient loops + illustrations.
- **[F-057] `checkVignetteUnlocks` unlocks at most one vignette per case completion — simultaneously-met conditions are starved.** `caseProgression.ts:89` (`return` on first match). → A player who earned multiple vignettes gets them one-per-completion, and may run out of main cases to trigger further unlocks. Polish. → Iterate all conditions and set every satisfied `vignette-unlocked-*` flag; return the list.

### Documentation (Low / Polish)

- **[F-058] `CLAUDE.md` says save "Current version: 1" but code is at 2 (v0→v1→v2).** `CLAUDE.md:197,305` vs `saveManager.ts:14`. Independently confirmed. Also: `CLAUDE.md:305` claims `saveManager` uses `Date.now()/Math.random()` (it doesn't — `metaSlice`/`buildDeduction` do). → Hides the crash-preventing v1→v2 migration; misleads anyone reasoning about the save trust boundary or writing a migration. Low. → Update `CLAUDE.md` to v2, correct the determinism note; sibling docs (`engine-reference.md:133`) are already correct.
- **[F-059] `CLAUDE.md` component hierarchy references a `<GameScreen>` component that doesn't exist.** `CLAUDE.md:51`. → Grep for `GameScreen` finds nothing; the real structure is `App` → `GameContent`. Low. → Correct the hierarchy diagram.
- **[F-060] `CLAUDE.md` store table omits `evidenceSlice.connections` + `addConnection`/`clearConnections`.** `CLAUDE.md:130`. → Incomplete quick-reference for a Phase-E feature. Low. → Add the row.
- **[F-061] No root `README.md` — public GitHub Pages repo shows nothing on its project page; required Node version undocumented.** → New contributors and visitors get no orientation. Low. → Add a root README (what it is, live link, setup, Node version, `npm run` scripts, link to `docs/`).
- **[F-062] `CLAUDE.md` "Known Bugs & Gaps" is dated 2026-02-25 and is mostly a struck-through changelog.** `CLAUDE.md:266`. → A reader scanning for current breakage wades through resolved items and may mistake fixed for broken. Polish. → Trim to current state; point to `docs/status.md`.

### Maintainability (Low)

- **[F-063] `loadAndStartCase`/`loadAndStartVignette` duplicate ~40 lines of state-reset logic verbatim.** `narrativeSlice.ts:74-101,122-143`. → Any change to case-start semantics must be made in two synced places. Low. → Extract a shared `resetForNewCase(state)` helper.
- **[F-064] `Effect`/`Condition` dispatch is duplicated across modules with no exhaustiveness guard — a new type silently no-ops.** `worldSlice.ts:36`, `effectMessages.ts`, both validators. → Adding an `Effect` type requires editing ≥4 files with no compiler error. Low. → Centralize the type lists; add a `default: assertNever(x)` to switch statements.
- **[F-065] Adding an archetype requires editing 3+ hardcoded maps (`data/archetypes.ts`, dice `PRIMARY_FACULTY`, `App.tsx ABILITY_FLAGS`).** → High-friction, drift-prone extension point. Low. → Consolidate archetype definition (bonuses, primary faculty, ability flag) into one table.
- **[F-066] `VignetteData→CaseData` adapter (`acts:2`, `variants:[]`) is duplicated with a magic literal in two slices.** `narrativeSlice.ts:112`, `metaSlice.ts:81`. → Change to the adaptation must be made in both. Low. → Extract `vignetteToCaseData(data)`.
- **[F-067] Faction names and OutcomeTier lists are free-form literals rather than shared constants.** `caseProgression.ts:35`, `npcSlice.ts:33` (disposition→reputation by `npc.faction` string). → A typo like `'Lamplighter'` vs `'Lamplighters'` silently misroutes reputation. Low. → Central `FACTIONS` constant; type `faction` fields against it.

---

## Positive observations

The audit's per-dimension strength lists were consistent and evidence-backed. Highlights worth **preserving through any refactor**:

- **Genuinely store-free engine.** No non-test `src/engine/*.ts` imports the store; the `EngineActions` interface (`engineActions.ts`) cleanly inverts the former engine→store dependency. This is the project's best architectural decision (ADR-0001).
- **Deliberate pure/impure split.** `computeChoiceResult`, `evaluateConditions`, `resolveScene`, `canDiscoverClue`, `buildDeduction`, and the whole `diceEngine` are pure and unit-testable without React.
- **All numeric state clamped at slice boundaries.** disposition [-10,10], suspicion [0,10], composure/vitality [0,10], reputation [-10,10]. No unbounded meters.
- **Correct dice semantics.** `resolveCheck` bases nat-20/nat-1 on the natural roll while success/partial use the total — matching the documented tiers.
- **Carefully-ordered `loadGame`.** Fetches content *before* mutating the store and returns `false` on any failure, so a content 404 never leaves the store half-restored; vignette saves correctly route to the side-cases loader.
- **Strong security posture.** Strict CSP with `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`), zero HTML-injection sinks (no `dangerouslySetInnerHTML`/`innerHTML`/`eval`), same-origin-only fetches, least-privilege `GITHUB_TOKEN` scopes, committed lockfile, 0 `npm audit` vulns.
- **Property-based testing.** Dice bounds/advantage, condition-eval purity, save round-trip (200 runs), migrate-idempotency, slice isolation, NPC bounds — meaningful invariants, not snapshot noise.
- **Real empty/error/loading states** across every list surface, with 44px touch targets, `aria-live` regions for dice/outcome/clue/effect feedback, and correct `role="dialog"`/Escape-to-close on overlays.
- **Rigorous, mostly-accurate docs.** `architecture.md` ends with a live grep-based verification block; `engine-reference.md` signatures match source; `content-authoring.md` catalogs match the code; committed memory spine (STATE/RUN_LOG/DECISIONS) is genuinely useful.
- **Content discipline.** No duplicate scene/clue/NPC IDs across 7 cases; `wc-case-complete` correctly set on all four Whitechapel endings; NPC `memoryFlag` dialogue gating is internally consistent.

---

## Recommended roadmap

### Immediate: P0 — fix before further feature work
1. **F-005** — Add `npm run test:run` to CI and gate deploy; add `pull_request` trigger. *(1 file, ~30 min, highest ROI.)*
2. **F-016 / F-017** — Extend + unify the validators (conditions, variants, encounters, npcEffect, disposition-reachability). This is the guard rail that would have caught F-003, F-004, and F-024. *(Do before more content work.)*
3. **F-003** — Fix *The Debt of Smoke* unlock (flag-based trigger or threshold ≤ 4).
4. **F-004** — Make encounter escape choices terminal in `processEncounterChoice`.
5. **F-006 / F-008 (onEnter half)** — Move `onEnter` application into `goToScene` and make it idempotent per scene.

### Short term: P1 — before release or serious playtesting
6. **F-001** — Author deduction-gated content (≥1 per case) so the headline mechanic pays off.
7. **F-002** — Add click/tap + Enter to clue connection; fix the drag affordance; persistent hint.
8. **F-007** — Real high-contrast styles; focus trap/restore on all overlays.
9. **F-011** — Fix the breakdown/incapacitation dead-end.
10. **F-010** — Show human case titles in HeaderBar + save list.
11. **F-009 / F-033 / F-021** — Favicon; Pages `cancel-in-progress:false`; pin the OWASP action SHA.
12. **F-020** — Add `App.test.tsx` + `NarrativePanel.test.tsx` (now enforced by P0 #1).

### Medium term: P2 — maintainability and quality
13. **F-018** — Central `flags.ts` constants.
14. **F-019 / F-014 / F-027** — Split `narrativeEngine.ts`; unify advantage computation.
15. **F-035 / F-034 / F-040** — Add ESLint + `lint` CI step; pin Node; drop unused dep.
16. **F-013 / F-026** — Type `lastCriticalFaculty` properly; discriminated-union `Condition`.
17. **F-042 / F-043** — Fix the unstable `buildGameState` selector; code-split overlays/screens.
18. **F-024 / F-023** — Repair unreachable recovery variants and dangling `sceneSource`.
19. Docs sweep: **F-058–F-062** (+ root README).

### Long term: P3 — optional hardening / future
20. **F-025 / F-053 / F-056** — Media Assets (M) milestone: resolve sourcing/licensing ADR, ship SFX/ambient/illustrations, verify via Playwright MCP.
21. **F-044–F-051** — Perf polish (rAF-throttle board, `useShallow`, `LazyMotion`, memoize lists) + remaining a11y (typewriter skip, reduced-motion on threads, skip link, contrast).
22. Dependency strategy (below); **F-036/F-037/F-038** storage/CSP hardening.
23. **F-063–F-067** — De-duplicate reset logic, adapters, archetype tables; central faction constants; exhaustiveness guards.

**Dependency update strategy (do not big-bang):** The pinning is deliberate and correct — treat upgrades as scheduled, tested batches. Suggested order: (1) low-risk patch/minor via Dependabot (`@types/howler`, `autoprefixer`); (2) tooling majors one-at-a-time behind the (now-CI-enforced) test suite: `vitest 3→4`, `jsdom 24→29`, `@testing-library/react 15→16`, `fast-check 3→4`; (3) `@vitejs/plugin-react` + `vite 7→8` **together** (peer-coupled — this coupling was the basis of a *rejected* "trap" finding: npm's ERESOLVE blocks a naive lone bump, so it fails loudly, not silently); (4) `zustand 4→5` and `immer 10→11` (API-review needed); (5) **defer** `react 18→19`, `tailwind 3→4` (config rewrite, F-041), and `typescript 5→6` until deliberately scheduled — each is a real migration. Move `npm audit` off the deploy critical path (F-032).

---

## Suggested issues / backlog (copy-pasteable)

**P0**
- `[P0] CI: run test:run and gate deploy; add pull_request trigger (F-005)`
- `[P0] Validators: check conditions/variants/encounters/npcEffect + disposition reachability; unify build+runtime validators (F-016, F-017)`
- `[P0] Content: fix The Debt of Smoke unlock — unreachable (max disp +4 vs threshold 7) (F-003)`
- `[P0] Encounters: make escape/flee choices terminal instead of advancing the round (F-004)`
- `[P0] Engine: apply onEnter effects in goToScene, idempotent per scene (F-006, F-008)`

**P1**
- `[P1] Content: author deduction-gated choices/scenes — deductions currently have zero payoff (F-001)`
- `[P1] EvidenceBoard: add click/tap + Enter to connect clues; fix drag affordance; persistent hint (F-002)`
- `[P1] A11y: real high-contrast styles + focus trap/restore on all overlays (F-007)`
- `[P1] UX: breakdown/incapacitation must not dead-end into "Case Complete" (F-011)`
- `[P1] UX: show human case titles in HeaderBar and save list (F-010)`
- `[P1] Add favicon; set Pages cancel-in-progress:false; pin OWASP action to SHA (F-009, F-033, F-021)`
- `[P1] Tests: add App.tsx + NarrativePanel coverage (F-020)`

**P2**
- `[P2] Refactor: central flags.ts constants (F-018)`
- `[P2] Refactor: split narrativeEngine.ts; unify advantage computation (F-019, F-014, F-027)`
- `[P2] Tooling: add ESLint + lint CI step; pin Node (engines/.nvmrc); remove unused dep (F-035, F-034, F-040)`
- `[P2] Perf: fix buildGameState selector churn; code-split overlays/screens (F-042, F-043)`
- `[P2] Content: repair unreachable recovery variants + dangling sceneSource (F-024, F-023)`
- `[P2] Docs: fix save-version drift, GameScreen, connections table; add root README (F-058–F-061)`

**P3**
- `[P3] Media assets milestone: SFX/ambient/illustrations + licensing ADR (F-025, F-053, F-056)`
- `[P3] Perf/a11y polish batch (F-044–F-051)`
- `[P3] Storage/CSP hardening + save schema validation (F-036, F-037, F-038, F-015)`
- `[P3] Maintainability: de-dup reset/adapter/archetype tables; faction constants; exhaustiveness guards (F-063–F-067)`

---

## Suggested follow-up investigations

1. **Runtime click-through of both boss encounters** (Playwright MCP) to visually confirm F-004 and F-002 on a mobile viewport, and to confirm F-006's re-fire by re-entering a penalty scene.
2. **Confirm whether a GitHub branch-protection rule exists** requiring status checks (would partially mitigate F-005 out-of-repo). Not verifiable from the repo alone.
3. **Full content reachability audit** once the validator is extended (F-016): enumerate every unreachable scene/clue/variant and every impossible condition across all 7 cases — F-003/F-024 suggest more may exist.
4. **Save-format fuzzing** (F-015/F-036): feed truncated/versionless/tampered saves through `loadGame` and catalog crash vs graceful-fail behavior.
5. **Bundle analysis** (`vite build --mode analyze` or `rollup-plugin-visualizer`) to size framer-motion/Howler precisely before committing to F-043/F-046.
6. **`jest-axe` pass** on all screens/overlays to quantify a11y beyond the manual findings.

---

## Appendix

### A. Rejected findings (verifier disproved — recorded for completeness)
The adversarial pass rejected 5 candidate findings; none should be actioned:
- **Check-clue `requiresFaculty.minimum` doubles as gate + DC** — deliberate schema simplification; deterministic, all check-clues remain winnable; the "permanently blocks re-attempt" impact claim was factually wrong (state resets on re-entry).
- **`GameSettings.fontSize` mixes enum + `number`** — the numeric arm is *exercised* by a working custom font-size slider (`SettingsPanel.tsx:146-174`); removing it would delete an accessibility feature.
- **tsconfig disables `noUnusedLocals`/`noUnusedParameters`** — enabling them produces 36 errors and fails the build; the example (`_hasAdvantage`) is a return-object property those flags don't even detect. (The real `_hasAdvantage` smell is captured separately as F-027.)
- **Vite 8 "coordination trap"** — describes the correct current state as a hypothetical; npm ERESOLVE would block the naive bump loudly. (Folded into the dependency strategy as a note.)
- **Composure/vitality announcements suppressed under reducedMotion** — contradicted by `EffectFeedback`, which announces deltas via `aria-live="polite"` regardless of motion pref.

### B. File map (source, excl. tests/node_modules/dist)
```
src/
  App.tsx (278)                     main screen state machine + overlays
  main.tsx, index.css, test-setup.ts
  types/index.ts (300)              ALL type definitions
  utils/gameState.ts                snapshotGameState (shared GameState builder)
  store/
    index.ts (114)                  useStore + selector/action hooks + useCurrentScene
    types.ts                        GameStore intersection
    audioSubscription.ts            SFX trigger via store subscription
    slices/{investigator,narrative(156),evidence,npc,world(66),meta(108)}Slice.ts
  engine/
    narrativeEngine.ts (641)        load/validate/conditions/choices/encounters  ← god module (F-019)
    diceEngine.ts (127)             rolls, modifiers, tiers, trained bonus
    saveManager.ts (161)            localStorage persistence + v0→v1→v2 migration
    caseProgression.ts (132)        end-of-case, faculty bonus, vignette unlocks
    hintEngine.ts, buildDeduction.ts, cluePrompts.ts, effectMessages.ts, engineActions.ts, audioManager.ts
  components/  (24 component dirs — see §C of report body for the notable ones)
  data/archetypes.ts
scripts/validateCase.mjs (209)      build/CI content validator (ref+reachability)
public/content/**                   47 JSON files, 7 cases, 198 scenes, 58 clues, 30 NPCs
.github/workflows/{deploy,security}.yml
docs/** (architecture, engine-reference, content-authoring, status, PROJECT_STATE, RUN_LOG, DECISIONS/)
```

### C. Dependency summary
- **Runtime:** react 18.3, react-dom 18.3, zustand 4.5, immer 10, framer-motion 11, howler 2.2. Correctly in `dependencies`.
- **Dev:** typescript 5.9(installed)/5.4(declared), vite 7.3, vitest 3.2, fast-check 3, jsdom 24, tailwindcss 3.4, @testing-library/{react 15, jest-dom, user-event(unused)}, @vitejs/plugin-react 4.
- **Audit:** 0 vulnerabilities. **Outdated:** 13 majors behind (deliberate pins). **Lockfile:** committed (v3).

### D. Test summary
- 334 tests / 29 files, ~12.6 s, all green. Property-based: dice, condition purity, save round-trip, migrate idempotency, slice isolation, NPC bounds, deduction formation, narrative determinism.
- **Gaps (F-020, F-028–F-031):** `App.tsx` (0 tests), `NarrativePanel` effects, `validateContent`, save `connections` round-trip, autosave triggers/cap, `loadVignette`, chained v0→v2 migration, ErrorBoundary. `integration.test.ts` is over-mocked (`as any`).

### E. Content / data summary
- 7 cases (3 main 3-act, 4 vignette 2-act), 198 scenes, 58 clues, 30 NPCs, 4 factions. No duplicate IDs. `wc-case-complete` correctly wired.
- **Confirmed content defects:** F-003 (unreachable vignette), F-024 (6 unreachable recovery variants), F-023 (4 dangling `sceneSource`), F-001 (no deduction-gated content), F-056 (37 audio 404s), F-057 (one-unlock-per-completion). Validator blind to all of these (F-016).

### F. Assumptions and limitations
- All commands ran on the developer machine (macOS, Node local). CI behavior inferred from workflow YAML, not executed.
- No runtime/browser session was driven during this analysis — F-004, F-002, and F-006 are confirmed by code + content reading and would benefit from a Playwright MCP click-through (see follow-up #1). PLAUSIBLE findings (F-015, F-028, F-030, F-044) are flagged as needing a runtime or environment-specific check.
- Line numbers were verified against the current working tree (clean `main` at analysis time); they may drift as code changes.
- Findings were merged across the 13 audit dimensions to remove duplicates; the canonical ID list (F-001…F-067) is the deduplicated set (67 canonical findings covering the 92 verified sub-findings).
```
