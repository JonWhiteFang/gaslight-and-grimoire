# Full Ultracode Repository Analysis

**Repository:** `gaslight-and-grimoire` — browser-based Victorian-London choose-your-own-adventure detective game (React 19 + Zustand 5 + Immer 11 + Vite 8/Rolldown + Tailwind 4 + Framer Motion 12 + Howler.js). Frontend-only SPA, no backend. Deployed as a Cloudflare static-assets Worker at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/`.

**Analysis date:** 2026-07-09
**Analysed at commit:** `0568f78` (branch `main`, clean tree)
**Method:** Read-only. Ground truth established by running the full command battery (lint/test/build/validator/audit), then an orchestrated 13-dimension adversarial audit (one specialist finder per dimension → two independent skeptics per finding, diverse lenses → dedup/synthesis pass) supplemented by direct lead verification of every High/Medium finding against source. 71 audit agents ran; 37 raw findings → 25 survived adversarial verification → 23 after root-cause dedup; 4 rejected as false positives. **No code was modified.**

**This repo is mature.** It already survived a prior 67-finding Ultracode audit (F-001…F-067), all closed across PRs #24–#51. This report deliberately excludes those and hunts only *new, subtle, reachability-aware* defects that survived every prior cycle.

---

## Executive summary

**Overall health: solidly engineered, with two genuine gameplay defects that a player will actually hit.** Overall risk rating: **Medium**.

The engineering discipline is real and holds up under scrutiny: a store-free engine layer, all numeric state clamped at boundaries, `strict` TypeScript, a locked Content-Security-Policy with zero HTML-injection sinks, zero `npm audit` vulnerabilities, 554 passing tests, a clean content validator, and a committed decision/memory spine. The security pass found **nothing** (0 findings) — appropriate for a static SPA with a locked CSP and no `dangerouslySetInnerHTML`/`eval`/secrets. The build, lint, validator, and test suite are all green.

But the survivors are **not** all polish. Two defects materially break the core loop and survived every prior audit because both hide behind a green test suite and a correct-looking UI:

1. **The archetype "once-per-case" auto-succeed ability is never consumed (F-101, High).** Activating Elementary/Street Survivor/Silver Tongue sets a persistent flag that `computeChoiceResult` reads but never clears — so it auto-crits *every* subsequent same-faculty check for the rest of the case, not one. The button greys out (`abilityUsed=true`), so the player believes they spent a one-shot; the effect is permanent. It trivialises the dice system for the archetype's primary faculty and steers the end-of-case faculty bonus. The tests that appear to guard it are self-fulfilling `setState` simulations that never call the real action.

2. **The Mayfair true ending is RNG-locked behind two natural-20s (F-102, High).** `ms-clue-vesper-journal` — required for `ms-deduction-fraud-and-breach`, which gates the best ending `ms-act3-ending-true-account` — is discoverable *only* at `ms-act2-occult-success`, reachable *only* on a `critical` (natural-20) outcome; and the deduction's other clue `ms-clue-hidden-mechanism` has only a critical-only occult-compatible source. Reaching the designed true ending needs ~1-in-400 luck regardless of build, contradicting the project's own rule "No single Faculty should gate critical story progress." The static validator's BFS treats every tier as traversable, so it reports nothing.

Around these sit real Medium defects — silent manual-save failure with no error toast (F-103), encounter reaction-damage that re-rolls on reload (save-scum, F-105), the dice overlay leaking across scene navigation (F-106), a phantom foreign scene-id leaking into every non-first case's `sceneHistory` and autosave (F-104), and archetype abilities silently doing nothing inside encounters (F-107) — plus a directly harmful docs contradiction: `architecture.md:101` tells developers to apply `onEnter` effects from `NarrativePanel`, the exact F-006 bug the repo already fixed (F-119).

**Nothing is Critical:** no crash, no data loss on normal use, no secret exposure, no security-reachable sink, every failure recoverable. But F-101 and F-102 should be treated as gameplay release-blockers before serious playtesting.

---

## Recon report

| Aspect | Finding |
|---|---|
| **Stack** | React 19.2, Zustand 5.0 + Immer 11, Vite 8.1 (Rolldown bundler), TypeScript 5.9 (held; TS7 blocked by typescript-eslint peer cap), Tailwind 4.3 (CSS-first `@theme`), Framer Motion 12, Howler 2.2. Vitest 4 + fast-check 4 + RTL. |
| **Identity** | Detective CYOA with D&D-style faculty checks + dice. Docs, code, tests, and content broadly agree (a few doc-drift exceptions — see F-119/F-120/F-121/F-122). |
| **Architecture** | `src/engine/` (pure-ish logic, zero store imports — verified), `src/store/` (single Zustand+Immer store, 6 slices, selector/action hooks), `src/components/` (17 component dirs, overlays lazy-loaded), `public/content/` (JSON: 3 main cases, 4 vignettes, shared scenes). |
| **Entry points** | `src/main.tsx` → `App.tsx`. Content fetched at runtime from `/content/*.json` via `contentLoader`. Persistence via `localStorage` (`gg_save_*`). No network sinks beyond same-origin content fetch. |
| **Trust boundaries** | Only one meaningful boundary: authored content JSON + `localStorage` save blobs → app state. No server, no multi-user, no auth. |
| **Sources → sinks** | Sources: content JSON, `localStorage` saves, settings, URL base path. Sinks: React DOM (text-only — no `innerHTML`/`dangerouslySetInnerHTML`, verified), `JSON.parse` of saves (shape-guarded by `isValidGameState`), Howler audio `src` (built from a static event→filename map, not user data). |
| **Concurrency** | Single-threaded browser event loop. Async only in content loading + save/load. React 19 StrictMode considerations checked. |
| **Execution capability** | Full — ran lint, test, build, validator, npm audit. Static analysis of `node_modules/react-dom` internals for the `inert` behaviour. |
| **Git churn hotspots** | `narrativeEngine.ts` (22), `narrativeSlice.ts` (16), `types/index.ts` (13), `App.tsx` (13), `caseProgression.ts` (12), `NarrativePanel.tsx` (11). These align with the hidden-hotspot analysis below. |

---

## Commands run

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | **PASS** | 0 errors. Lean flat config (TS recommended + react-hooks). |
| `node scripts/validateCase.mjs` | **PASS** | All 7 cases validate. Reports **67/50/44** scenes for the 3 main cases (see F-120 — docs say 66/49/43). |
| `npm run build` | **PASS** | `tsc && vite build && nest-for-cloudflare`. 506 modules, chunks split (react/motion/audio). |
| `npm run test:run` | **PASS** | 554 passed / 554, 56 files. Benign runtime warning: `--localstorage-file was provided without a valid path` (jsdom/vitest — cosmetic). |
| `npm audit` | **PASS** | 0 vulnerabilities (info/low/moderate/high/critical all 0). |
| `npm outdated` | 1 held | Only `typescript` 5.9→7.0, intentionally held (ADR-0008). |
| secrets grep | clean | No keys/tokens/passwords in source, config, or workflows. |

---

## Top risks

| Rank | ID | Severity | Confidence | Category | Title | Why it matters |
|---:|---|---|---|---|---|---|
| 1 | F-101 | High | High | Correctness | Auto-succeed ability never consumed — auto-crits every same-faculty check all case | Defeats the core dice mechanic for the archetype's primary faculty for the rest of the case after one click |
| 2 | F-102 | High | High | Content | Mayfair true ending RNG-locked behind two nat-20s | Best ending unreachable through skilled play (~0.25% chance); violates project design rule |
| 3 | F-103 | High→Med | High | Error-handling | Manual save fails silently on `localStorage` throw — no toast, player believes saved | Silent data-loss illusion; the save toast fires regardless of whether the write succeeded |
| 4 | F-119 | High→Low | High | Docs | `architecture.md:101` documents the exact F-006 anti-pattern as the invariant | A maintainer following the doc would reintroduce a fixed release-blocker |
| 5 | F-105 | Medium | Medium | Correctness | Encounter reaction-damage re-rolls on save/reload | Save-scum: reload an autosave on a supernatural scene, re-roll the reaction check |
| 6 | F-107 | Medium | High | Correctness | Archetype abilities silently do nothing inside encounters (`processEncounterChoice` ignores the flag) | The same ability is over-applied in choices (F-101) and dead in encounters — mirror bugs |
| 7 | F-106 | Medium→Low | High | Correctness | Dice overlay + outcome banner leak across scene navigation | `goToScene` never clears `lastCheckResult`; overlay floats over unrelated later scenes |
| 8 | F-104 | Medium→Low | High | Correctness | `resetForNewCase` leaks previous case's `currentScene` into new `sceneHistory` | Phantom foreign scene id in autosave; enables a no-op "back" button at case start |
| 9 | F-112 | Medium | High | Testing | `npcBounds` property test validates a *copy* of the clamp, not the real slice | Slice clamp entirely untested; a clamp-removing mutation survives the suite |
| 10 | F-108 | Medium→Low | High | UX | "Review previous scene" button stale-disabled during play (non-reactive `getState()`) | A shipped feature reads `sceneHistory` non-reactively, so the button never enables |

Ranking is severity × confidence × reachability. F-101 and F-102 outrank everything: both High/High, both trivially reachable in normal play, both survived every prior audit.

---

## Findings

### F-101 — Archetype "once-per-case" auto-succeed ability is never consumed

**Severity:** High · **Confidence:** High · **Status:** Confirmed · **Category:** Correctness
*(Reported independently by the correctness-engine and architecture-types finders; both skeptics upheld it; lead-verified.)*

#### Evidence
- `src/App.tsx:145-150` — `handleActivateAbility` does two independent things: `activateAbility()` sets `investigator.abilityUsed=true` (only greys the HeaderBar button), and `setFlag(ARCHETYPE_ABILITY_FLAG[archetype], true)` sets the persistent world flag (e.g. `ability-auto-succeed-reason`).
- `src/engine/choiceResolution.ts:27-31`:
  ```ts
  const abilityFlag = abilityAutoSucceedFlag(choice.faculty);
  if (abilityFlag && state.flags[abilityFlag]) {
    return { nextSceneId: choice.outcomes['critical'], tier: 'critical' };
  }
  ```
  Returns `critical` with no roll and **never clears the flag**. `processChoice` (lines 64-83) doesn't clear it either.
- The only clear site is `resetForNewCase` (`src/store/slices/narrativeSlice.ts:46`, via `CASE_LOAD_CLEARED_FLAGS`), which fires on the **next** case/vignette load. Repo-wide grep for `delete state.flags` / `setFlag(...,false)` on these keys finds nothing else.

#### Why it matters
Design intent (CLAUDE.md; design bible line 159: *"Once per case, automatically succeed on **a** Reason check"*) is a single check. Actual behaviour: after one activation, **every** subsequent Reason (Deductionist) / Vigor (Operator) / Influence (Mesmerist) choice-check auto-crits for the rest of the case. The Whitechapel Cipher alone has ~6-7 Reason checks; all become free auto-criticals. Each auto-crit also calls `setLastCriticalFaculty` (`choiceResolution.ts:71-73`), trivially steering the end-of-case +1 faculty bonus.

**Scope correction (verified):** this does **not** affect Evidence Board deductions (`DeductionButton.tsx:45` calls `performCheck` directly) or encounters (`encounters.ts` calls `performCheck` directly — and see F-107, which is the mirror). Impact is confined to choice-driven faculty checks routed through `computeChoiceResult` — but that is the primary check path, so impact remains High.

#### Adversarial review
Could this be intentional (a "power fantasy" mode)? No — the UI (`AbilityButton` greys out after one use, showing "used"), the design bible, and CLAUDE.md all frame it as a single-use once-per-case resource. Could `abilityUsed` be the real gate? No — `abilityUsed` is only read by the button; the check path reads the flag. Both skeptics tried to refute via "maybe another site clears it" and found none. One skeptic downgraded severity to Medium (single-player offline, opt-in, no crash); the other held High. **Verdict: stands, High** — it is fully reachable in normal play and permanently defeats the core mechanic for the archetype's defining faculty.

#### Recommended action
Consume the flag on use. Since `computeChoiceResult` is pure, do it in `processChoice` (which has `actions`): after an auto-succeeded result, `actions.setFlag(abilityFlag, false)` (or add `EngineActions.clearFlag`). Alternatively drive the once-per-case gate off `investigator.abilityUsed` instead of a persistent world flag. Fix F-107 in the same change so the ability works (once) in encounters too.

#### Regression test
In a `processChoice`/`computeChoiceResult` test: set `flags['ability-auto-succeed-reason']=true`, run on a Reason check → expect `critical`; then assert the flag is now falsy **and** a second Reason check performs a real `performCheck` (mock `rollD20` to a failing value → expect non-critical). This test fails before the fix.

#### Suggested validation
Play a Deductionist, click Elementary, take two Reason choices in a row — observe both resolve as critical with no dice roll. <2 min.

---

### F-102 — Mayfair true ending is RNG-locked behind two natural-20 rolls

**Severity:** High · **Confidence:** High · **Status:** Confirmed · **Category:** Content
*(content-integrity finder; skeptic revised to Medium; lead-verified against JSON — restored to High for design-rule violation.)*

#### Evidence
- `public/content/cases/the-mayfair-seance/deductions.json` — `ms-deduction-fraud-and-breach` requires `ms-clue-hidden-mechanism` + `ms-clue-vesper-journal` + `ms-clue-grey-dawn-sigil`. It gates the true ending `ms-act3-ending-true-account`.
- `clues.json` — `ms-clue-vesper-journal.sceneSource = ms-act2-occult-success`, and it is listed in **only** that scene's `cluesAvailable` (method `dialogue`).
- `act2.json` — `ms-act2-occult-success` is reached **only** from `ms-act2-the-seance.ms-choice-occult-path` on `tier=critical`. `diceEngine.ts:66` confirms `critical` requires a natural 20.
- Act 2 is commit-once: the rational/occult/pemberton sub-branches funnel to `ms-act3-the-reckoning` with no hub return, so the rational-branch source of `ms-clue-hidden-mechanism` is mutually exclusive with the occult branch. Its only occult-compatible source is `ms-act1-room-thorough`, reached only on a `critical` of `ms-choice-examine-room`.

#### Why it matters
Forming the deduction — and thus reaching the designated true/best ending — requires two independent natural-20s in one playthrough (~0.25%, or ~5% for the occult roll alone if Veil Sight advantage applies to just that one). This is RNG, not skill/investigation payoff, and directly violates CLAUDE.md's content rule: *"No single Faculty should gate critical story progress — always provide alternate paths."* The case is still *completable* (other endings need no criticals), so it isn't a hard block — but the headline ending is a lottery. The static validator's reachability BFS treats every outcome tier as traversable, so it (correctly, by its own model) reports the clue as "discoverable" and flags nothing.

#### Adversarial review
Could this be intentional (a rare "perfect run" reward)? Possibly by design, but it contradicts the repo's explicit, documented rule and the pattern used elsewhere (`ms-clue-grey-dawn-sigil` is deliberately dual-sourced across tiers). The skeptic downgraded to Medium on the grounds the case remains completable; the lead restored High because the *design invariant is stated in the repo itself* and the true ending is the authored payoff, not an optional extra. **Verdict: stands, High-severity design/reachability defect.**

#### Recommended action
Dual-source `ms-clue-vesper-journal` onto `ms-act2-occult-partial` (and/or `-success` non-critical tiers), mirroring how `ms-clue-grey-dawn-sigil` is already sourced, and add a non-critical occult-compatible source for `ms-clue-hidden-mechanism`. Then extend the validator with a per-tier reachability mode (see Follow-ups) so critical-only clue sourcing is caught mechanically.

#### Regression test
Add a validator/unit assertion: for every clue named in a `KeyDeduction.requiredClues` that gates a `hasDeduction`/`requiresDeduction`, at least one of its `cluesAvailable` sources must be reachable on a non-`critical` tier. Fails on Mayfair today.

#### Suggested validation
Trace `ms-act2-occult-success` inbound edges in `act2.json` — only `tier:"critical"` reaches it. <2 min.

---

### F-103 — Manual save fails silently when `localStorage` throws

**Severity:** High (synthesis) → Medium (lead) · **Confidence:** High · **Status:** Confirmed · **Category:** Error-handling
*(correctness-save + ux-a11y finders; both skeptics upheld.)*

#### Evidence
- `src/store/slices/metaSlice.ts:47-65` — `saveGame` calls `SaveManager.save(...)` with **no try/catch**. `SaveManager.save` (`saveManager.ts:99`) calls `localStorage.setItem`, which throws `QuotaExceededError` when storage is full (10-save cap + a large `caseData`-free state is small, but quota/private-mode/disabled-storage all throw).
- `src/App.tsx:154-161` — `handleSaveGame` `await saveGame()` then unconditionally shows the "Game saved" toast. A throw becomes an unhandled promise rejection; the `.evicted` destructure never runs, but the toast path is skipped only by the rejection — the user sees no error and no confirmation, or (depending on timing) a misleading state.
- Contrast: `autoSave` (`metaSlice.ts:67-75`) **does** wrap `SaveManager.save` in try/catch. The inconsistency is the tell.

#### Why it matters
A player in private-browsing / storage-disabled / quota-full hits "Save", gets no error, and believes their game is saved. This is the classic silent-data-loss illusion. Prior fix F-052 added the save toast specifically so saves are "never silently lost" — but the toast fires on the happy path only; the failure path has no handler.

#### Adversarial review
Is `QuotaExceededError` reachable? The saved state excludes `caseData` (re-fetched on load), so it's small — quota is unlikely from size alone. But private browsing (Safari historically throws on `setItem`), storage-disabled, and enterprise lockdowns all throw synchronously, and the 10-save cap doesn't bound total bytes. The skeptics agreed the *class* of failure is real and unhandled even if quota-by-size is rare; the lead set Medium (rare trigger, recoverable) rather than the synthesis High. **Verdict: stands, Medium.**

#### Recommended action
Wrap the `SaveManager.save` call in `saveGame` in try/catch mirroring `autoSave`; return a `{ ok: false }` / throw a typed error and surface an error toast in `handleSaveGame` (the `role="alert"` pattern already exists for load errors).

#### Regression test
Mock `localStorage.setItem` to throw; call `saveGame()`; assert it resolves to a failure signal (not an unhandled rejection) and that `handleSaveGame` renders an error toast, not "Game saved".

---

### F-104 — `resetForNewCase` leaks the previous case's `currentScene` into the new case's `sceneHistory`

**Severity:** Medium → Low · **Confidence:** High · **Status:** Confirmed · **Category:** Correctness

#### Evidence
- `src/store/slices/narrativeSlice.ts:28-62` (`resetForNewCase`) sets `sceneHistory=[]`, `visitedScenes=[]`, `lastCheckResult=null`, clears clues/npcs — but **never resets `currentScene`** (grep confirms: `currentScene` is only touched at lines 94/106/109, not in the reset).
- `goToScene` (lines 106-107): `if (state.currentScene) state.sceneHistory.push(state.currentScene)` — so when the new case navigates to its first scene, it first pushes the **stale previous-case** `currentScene` id into the fresh `sceneHistory`.

#### Why it matters
Every non-first case/vignette begins with a phantom foreign scene id as `sceneHistory[0]`. Consequences: (a) that id is persisted into the autosave taken on scene entry; (b) `App.tsx:336` `canGoBack = sceneHistory.length > 0` becomes true at the very first scene, enabling a "Review previous scene" button that points at a scene from a different case (`App.tsx:334` reads `history[history.length-1]`); (c) `GameContent` review mode guards on `caseData?.scenes[reviewSceneId]`, so the foreign id renders nothing — but the button is live and does nothing.

#### Adversarial review
Real but low-impact: the review-mode guard prevents a crash (foreign id → no scene → guard fails → no render), and the phantom entry is overwritten as play proceeds. One skeptic put it at Low, the other Medium (autosave pollution). **Verdict: stands, Low/Medium** — a clean-state hygiene bug at the case boundary.

#### Recommended action
Add `state.currentScene = ''` to `resetForNewCase` (the empty-string sentinel that `goToScene:106` already special-cases to skip the history push).

#### Regression test
Start case A, advance a scene, start case B; assert `sceneHistory` is `[]` (not `['<A-scene-id>']`) after B's first scene loads.

---

### F-105 — Encounter reaction-check damage re-fires on save/reload

**Severity:** Medium · **Confidence:** Medium · **Status:** Confirmed · **Category:** Correctness

#### Evidence
- `src/engine/encounters.ts:32-77` (`startEncounter`) runs the supernatural reaction check and applies composure damage as a **transient** side effect on encounter init (`EncounterPanel.tsx:34-50`, guarded by `initRef` per mount). `EncounterState` (`currentRound`, `reactionCheckPassed`) lives in component state, not the store, and is **not persisted**.
- `autoSave` fires on scene entry (`narrativeSlice.ts:150-152`), including entry to an encounter scene. On reload, `EncounterPanel` remounts, `initRef` resets, and `startEncounter` runs **again** — re-rolling the reaction check and re-applying composure damage.

#### Why it matters
Two-way: (a) a player who takes reaction damage, then reloads the autosave, re-rolls it — save-scum to avoid a bad roll or lost composure; (b) mid-encounter round progress (`currentRound`) is lost on reload, restarting the fight. The `onEnter` composure `-1` on the encounter scene is separately protected by `visitedScenes` (F-006), but the reaction check is a separate, unpersisted code path.

#### Adversarial review
Reachable only if an autosave lands on an encounter scene (autoSaveFrequency `scene` is the default, so yes) and the player reloads. Both skeptics upheld; confidence Medium because it depends on the reload behaviour and encounter state model being intended-transient (it appears unintended — nothing documents it). **Verdict: stands, Medium.**

#### Recommended action
Persist encounter state (`currentRound`, `reactionCheckPassed`) into the store/save, or suppress autosave on encounter-scene entry, or make `startEncounter`'s reaction damage idempotent via a `visitedScenes`-style guard.

#### Regression test
Simulate: enter supernatural encounter (reaction fails, composure drops), autosave, reload → assert composure is not decremented a second time and `currentRound` is preserved.

---

### F-106 — Dice-roll overlay and outcome banner leak across scene navigation

**Severity:** Medium → Low · **Confidence:** High · **Status:** Confirmed · **Category:** Correctness

#### Evidence
- `goToScene` (`narrativeSlice.ts:102-153`) does **not** clear `lastCheckResult` on navigation (it's cleared only in `resetForNewCase:53` and `setCheckResult`). `NarrativePanel.tsx:47-55` shows the dice overlay + banner `if (lastCheckResult)`.
- Flow: a faculty-check choice sets `lastCheckResult`, then `processChoice` navigates (`goToScene`) before returning. The overlay renders on the **new** scene and persists until the player manually dismisses the banner (`handleBannerDismiss:87-91`).

#### Why it matters
After a check, the dice result floats over the *destination* scene, which may be unrelated to the roll. It's dismissible, so not a block, but it misattributes a roll to the wrong scene and is visually confusing.

#### Adversarial review
Both skeptics downgraded to Low: the overlay is transient and user-dismissable, and showing the result after navigation is arguably intentional (the roll determined the navigation). But it can persist across *multiple* subsequent navigations if the player advances via a non-check choice without dismissing. **Verdict: stands, Low** — minor UX correctness.

#### Recommended action
Clear `lastCheckResult` in `goToScene` when the destination differs from the check's origin, or auto-dismiss the overlay on the next navigation, or clear it after the banner's display window.

#### Regression test
Set a check result, navigate to scene B via a non-check choice, assert the dice overlay is not shown on B.

---

### F-107 — Archetype abilities silently do nothing inside encounters

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed · **Category:** Correctness

#### Evidence
- `src/engine/encounters.ts:124-136` (`processEncounterChoice`) performs its own faculty check via `performCheck` directly. Unlike `computeChoiceResult` (`choiceResolution.ts:27-31`), it **does not** read the `ability-auto-succeed-*` flag, and it ignores `dynamicDifficulty` (it reads `choice.difficulty` only).

#### Why it matters
The mirror of F-101: the auto-succeed ability is *over-applied* in choices and *dead* in encounters. A Deductionist/Operator/Mesmerist who activated their ability gets no effect on an encounter check of their primary faculty — the two check pipelines have diverged. `dynamicDifficulty` is likewise silently ignored in encounters (any encounter choice authored with dynamic difficulty would use `undefined` → the `else` branch).

#### Adversarial review
Both skeptics upheld. Is it intentional that abilities don't apply in combat? Nothing documents such a rule, and the divergence (two hand-maintained copies of the check pipeline) is the classic drift smell. **Verdict: stands, Medium.**

#### Recommended action
Route encounter checks through the same auto-succeed/dynamic-difficulty logic as `computeChoiceResult` (extract a shared `resolveCheckOutcome(choice, state)` used by both paths). This also fixes the F-101 consumption in one place.

#### Regression test
With `flags['ability-auto-succeed-vigor']=true`, call `processEncounterChoice` on a Vigor encounter choice → assert it auto-succeeds (once), matching choice behaviour.

---

### F-108 — "Review previous scene" button stays stale-disabled during play

**Severity:** Medium → Low · **Confidence:** High/Medium · **Status:** Confirmed · **Category:** UX

#### Evidence
- `src/App.tsx:336` — `canGoBack={useStore.getState().sceneHistory.length > 0}` reads the store **non-reactively** at render via `getState()`. `HeaderBar` is not subscribed to `sceneHistory`, so `canGoBack` is computed once at App render and does not update as the player advances scenes (App re-renders on the state it *does* subscribe to, so it's incidental/stale).
- Same anti-pattern at `App.tsx:333-334` (`onReviewPrevious` reads `getState().sceneHistory`).

#### Why it matters
A shipped feature (review previous scene) has a button whose enabled/disabled state doesn't track the actual history reactively — it can be stale-disabled when history exists (or, combined with F-104, stale-enabled at case start). Interacts with F-104.

#### Adversarial review
One skeptic Medium, one Low: App *does* re-render on many store changes (so `getState()` is often coincidentally fresh), which masks the bug intermittently. But it's non-deterministic by design and wrong in principle. **Verdict: stands, Low/Medium.**

#### Recommended action
Subscribe reactively: `const canGoBack = useStore((s) => s.sceneHistory.length > 0)`.

#### Regression test
Render App, advance one scene via store action, assert the review button becomes enabled without an unrelated re-render trigger.

---

### F-112 — `npcBounds` property test validates a *copy* of the clamp, not the real slice

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed · **Category:** Testing (false confidence)

#### Evidence
- `src/engine/__tests__/npcBounds.property.test.ts` re-implements the clamp as local helper functions (`clampDisposition`/`clampSuspicion`) and asserts against those — it never touches `npcSlice.adjustDisposition`/`adjustSuspicion`. The real slice clamp (`npcSlice.ts:25,41`) is exercised by no direct boundary test.

#### Why it matters
A green property test named for NPC bounds gives false confidence that the *slice* clamps. A mutation removing `Math.max(-10, Math.min(10, ...))` from the real slice survives the entire 554-test suite. Same pattern for `worldSlice.adjustReputation` (F-113) — its ±10 clamp has no boundary test and is only ever `vi.fn()`-mocked in engine tests.

#### Adversarial review
Both skeptics confirmed the test structure; reachability of an *actual* clamp regression is Low (nobody's removing the clamp today), so revised confidence on impact is Low, but the coverage gap is real and High-confidence as a fact. **Verdict: stands as a test-quality gap.**

#### Recommended action
Add store-level tests: call `adjustDisposition`/`adjustReputation` at and past the boundaries and assert the *store* clamps. Delete or supplement the local-copy property test.

#### Regression test
`adjustReputation('X', +50)` → assert stored value `=== 10`; `adjustDisposition(npc,+50)` on a `+10` NPC → assert `=== 10`.

---

### F-113 – F-116 — Additional test-quality gaps (Medium/Low, Testing)

Grouped by root cause (tests exercise copies or transitive paths, not the real unit):

- **F-113 — `worldSlice.adjustReputation` ±10 clamp has no boundary test.** A clamp-removing mutation survives. (Medium→Low)
- **F-114 — `startEncounter` Nerve-vs-Lore reaction-faculty tiebreak is untested.** No test asserts which faculty is checked when scores tie (`encounters.ts:45-48`). (Medium)
- **F-115 — `resolveScene` variant-resolution predicate has no direct test.** Variant matching (`conditions.ts:107-126`) is only exercised transitively; combined with F-118 (variant `onEnter` drop, see below) this is an untested engine seam. (Medium)
- **F-116 — `metaSlice` eviction test is mislabeled and asserts nothing about eviction.** It passes for the wrong reason — a real eviction regression wouldn't fail it. (Low)

Each needs a targeted unit test naming the specific branch. See the correctness cross-check: the mundane vitality-only encounter-damage branch (`encounters.ts:167`) and `worldSlice.applyEffects` `flag`-false/string paths also have zero result-asserting coverage.

---

### F-118 — Variant `onEnter` effects are dropped when a hub scene is re-entered after its variant activates

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed · **Category:** Correctness
*(Found by the correctness cross-check; lead-verified against content.)*

#### Evidence
- `narrativeSlice.ts:118-124` gates `onEnter` on `visitedScenes.includes(sceneId)` keyed on the **base** `sceneId`, then resolves the scene (which may be a **variant** with a *different* `onEnter`).
- `variants.json` (Whitechapel) — `wc-act2-the-web-variant-lamplighter-rep` (variant of hub `wc-act2-the-web`, condition `factionReputation Lamplighters ≥ 3`) has `onEnter: [flag wc-met-finch=true, flag wc-knows-aldgate-name=true]`. The hub is an inbound target from ~100 edges (re-enterable). If first entered before rep ≥ 3 (base marked visited), then re-entered after crossing the threshold, the variant's `onEnter` never fires because the base id is already in `visitedScenes`.
- Both flags are read by downstream gates (`wc-met-finch` at `act2.json:66`, `wc-knows-aldgate-name` at `act2.json:862`). Second confirmed instance: Mayfair `ms-act2-the-seance-variant-lamplighter-rep` grants `reputation Lamplighters +1` and `composure -1` in its `onEnter` — silently dropped on re-entry.

#### Why it matters
F-006 fixed `onEnter` *re-firing*; this is the un-fixed flip side — a *different, newly-eligible* variant `onEnter` is *skipped*. Authored state mutations (flags gating later choices, reputation, composure) on hub scenes — which are designed for repeated visits — are lost. In Whitechapel both flags have alternate setters, softening it; the Mayfair reputation/composure grant has no alternate path.

#### Adversarial review
The once-per-scene gate is deliberate (F-006), but keying it on the *base* id when the *resolved* scene can differ is the defect. Reachable on any hub with a rep/flag-gated variant `onEnter`. **Verdict: stands, Medium.**

#### Recommended action
Key the `onEnter`-once gate on the *resolved* scene identity (base id + variant id), so a variant's distinct `onEnter` fires once when its condition first becomes true — while still never re-firing the same resolved scene.

#### Regression test
Case data with a base scene (`onEnter:[{composure:-1}]`) and a variant of it gated on a flag with a different `onEnter` (`[{composure:-3}]`). Enter with flag off (base fires), set flag, re-enter → assert the variant's `-3` fires exactly once.

---

### F-119 — `architecture.md` documents the exact F-006 anti-pattern as the invariant

**Severity:** High (synthesis) → Low/Medium (lead) · **Confidence:** High · **Status:** Confirmed · **Category:** Docs

#### Evidence
- `docs/architecture.md:101` — describing `applyEffects`: *"It is invoked from `NarrativePanel` on scene entry."*
- The code applies `onEnter` effects from `goToScene` (`narrativeSlice.ts:121-141`), and CLAUDE.md's Architectural Warnings explicitly forbid the view-layer path: *"Do **not** re-add effect application to the view layer"* (the F-006 fix).

#### Why it matters
This isn't cosmetic drift — a maintainer who trusts `architecture.md` would reintroduce the exact composure/vitality/reputation farming bug (F-006) that was fixed. The authoritative doc contradicts the guardrail.

#### Adversarial review
Severity is about *likelihood a maintainer acts on it*: the CLAUDE.md warning is prominent and would likely catch it, so the lead downgraded from the synthesis's High to Low/Medium. But it's a High-confidence factual contradiction in the primary architecture doc. **Verdict: stands; fix promptly.**

#### Recommended action
Correct `architecture.md:101` to state `applyEffects` is invoked from `goToScene`, gated on `visitedScenes` (once per playthrough), and that the view layer only *reads* `lastEffectMessages`.

---

### F-120 – F-122 — Documentation drift (Low, Docs)

- **F-120 — Scene counts stale.** `status.md` and `CLAUDE.md` state 66/49/43 per main case and 198 total; the validator (which `status.md` cites as the source of truth) reports **67/50/44** and **201**. (Medium→Low)
- **F-121 — Component enumeration stale.** `architecture.md` claims "16 component directories … all represented above"; there are **17** (`InvestigationHalted` is missing from both the tree and the list). (Low)
- **F-122 — Choices-per-scene claim wrong.** CLAUDE.md claims "Average 2.0+ choices per scene"; actual is ~1.77. (Low/Polish)

Each is a one-line doc fix. Fold into a `/checkpoint` doc-drift sweep.

---

### F-123 — CI build gate's `tsc` never type-checks `vite.config.ts` or `scripts/`

**Severity:** Low · **Confidence:** High · **Status:** Confirmed · **Category:** CI/CD

#### Evidence
- `tsconfig.json` `include: ["src"]` — so `npm run build`'s `tsc` step type-checks only `src/`. `vite.config.ts` is covered by `tsconfig.node.json` (referenced), but `scripts/` (including `scripts/validateCase.ts`, the content-validator source) is in **no** tsconfig `include`. A type error in the validator source wouldn't fail the build/CI gate; it would only surface when the `.mjs` shim runs it via vite-node.

#### Why it matters
The content validator is a CI correctness gate; its own source isn't type-checked by the gate. Low because the validator *is* executed in CI (so runtime errors surface), but type-level regressions in `scripts/` are ungated.

#### Recommended action
Add a `tsconfig` project (or extend `include`) covering `scripts/`, and add it to the `tsc` step (or a `tsc --noEmit -p tsconfig.scripts.json`).

---

## Rejected findings (false positives — do not re-file)

The adversarial pass refuted these; recorded so they aren't re-investigated:

1. **`isValidGameState` doesn't validate `settings.audioVolume`.** Refuted: `settings` is shape-guarded and `audioVolume` has safe defaults; the subscription reads `state.settings.audioVolume.sfx` but a malformed save is rejected upstream by the envelope + shape guard, and `defaultSettings` covers the store's own init. Not reachable to a crash.
2. **"Three clues discoverable only via critical-tier scenes deny advantage bonuses."** Refuted as a *separate* finding — it's a restatement of F-102's root cause, not an independent defect (advantage bonuses aren't "denied"; the clues are just critical-gated, which F-102 already covers).
3. **`ms-court-deal-made` flag written but consumed by nothing.** Refuted: the Debt of Smoke vignette intentionally unlocks from the *Whitechapel* Court-of-Smoke ending (`wc-court-deal-made`), and the Mayfair equivalent setting its own flag is harmless authored parallelism, not a dead-flag bug.
4. **Composure/vitality changes never announced to screen readers under reduced-motion.** Refuted: the meters and effect feedback use `aria-live` regions independent of the motion setting; the finder conflated the animation gating with the announcement path.

---

## Positive observations

Calibrating trust in the negatives — these are real strengths, verified:

- **Security posture is genuinely clean.** Locked CSP (`script-src 'self'`, no `unsafe-inline`; `frame-ancestors 'none'` in the real `_headers`), zero `dangerouslySetInnerHTML`/`innerHTML`/`eval`, no secrets, `npm ci --ignore-scripts` in CI, one SHA-pinned third-party action. The security finder found nothing, and the lead confirmed no reachable sink.
- **Engine/store boundary holds.** `src/engine/` has zero store imports (verified); the `EngineActions` seam is real; pure functions are genuinely pure (`computeChoiceResult`, `evaluateConditions`, `resolveScene`, `matchDeduction`).
- **All numeric state is clamped** at the slice boundary — composure/vitality/suspicion `[0,10]`, disposition/reputation `[-10,10]` (the F-101/F-104/F-118 bugs are *logic* bugs, not clamp failures).
- **Save system is defensively coded** — envelope guard + `isValidGameState` shape guard + a real, tested v0→v3 migration ladder with NaN-version coercion. The migration tests genuinely assert migrated *state fields*, not just version numbers.
- **The content validator is the best-tested module** — it asserts the validator *catches* specific broken content (dangling edges, unknown refs, tier-incompleteness, orphan variants), not just that clean content passes.
- **Dice band boundaries are pinned** by a table-driven test (`diceBands.test.ts`) complementing the property test.

---

## Quick wins (<30 min each, high value)

1. **F-104** — one line: `state.currentScene = ''` in `resetForNewCase`.
2. **F-108** — one line: make `canGoBack` a reactive `useStore` selector.
3. **F-119** — correct `architecture.md:101` (onEnter is applied from `goToScene`, not `NarrativePanel`).
4. **F-120/F-121/F-122** — refresh scene counts (67/50/44, 201), add `InvestigationHalted` to the component list, fix the choices-per-scene figure.
5. **F-106** — clear `lastCheckResult` in `goToScene` on cross-scene navigation.
6. **F-116** — fix the mislabeled `metaSlice` eviction test so it actually asserts eviction.

---

## Recommended roadmap

### Immediate — P0 (fix before further gameplay/feature work)
- **F-101** — consume the auto-succeed ability flag on use (and fix F-107 in the same change via a shared check-resolution helper). This is the single highest-value fix.
- **F-102** — dual-source the Mayfair true-ending clues so the best ending is reachable through skilled play.

### Short term — P1 (before serious playtesting / release)
- **F-103** — wrap `saveGame` in try/catch + surface an error toast.
- **F-105** — persist encounter state / make reaction damage idempotent.
- **F-118** — key the `onEnter`-once gate on resolved scene identity.
- **F-119** — correct the architecture-doc invariant (prevents F-006 reintroduction).

### Medium term — P2 (maintainability / correctness confidence)
- **F-106, F-104, F-108** — scene-transition state hygiene (clear `lastCheckResult`, `currentScene`; reactive `canGoBack`).
- **F-112–F-116** — replace copy-of-logic/transitive tests with real unit tests for the slice clamps, encounter faculty tiebreak, and `resolveScene` variant matching.
- **F-107** — unify the two check pipelines (`choiceResolution` vs `encounters`) to stop future drift.

### Long term — P3 (optional hardening)
- **F-123** — type-check `scripts/` in CI.
- **F-120–F-122** — automate doc-count drift detection in `/checkpoint`.
- Extend the content validator with per-tier reachability (would have caught F-102 mechanically).

---

## Suggested issues / backlog (copy-pasteable)

**P0**
- `[P0] Archetype auto-succeed ability never consumed — auto-crits all same-faculty checks for the case (F-101)`
- `[P0] Mayfair true ending RNG-locked behind two natural-20s — dual-source ms-clue-vesper-journal (F-102)`

**P1**
- `[P1] Manual save fails silently on localStorage throw — add try/catch + error toast (F-103)`
- `[P1] Encounter reaction-check damage re-rolls on save/reload — persist encounter state (F-105)`
- `[P1] Variant onEnter dropped when hub re-entered after variant activates — gate on resolved scene id (F-118)`
- `[P1] architecture.md:101 documents the F-006 anti-pattern (onEnter from NarrativePanel) — correct it (F-119)`

**P2**
- `[P2] Dice overlay leaks across scene navigation — clear lastCheckResult in goToScene (F-106)`
- `[P2] resetForNewCase leaks previous currentScene into new sceneHistory (F-104)`
- `[P2] Archetype abilities do nothing in encounters — unify check pipelines (F-107)`
- `[P2] "Review previous scene" button non-reactive (getState at render) (F-108)`
- `[P2] Slice clamp / encounter-tiebreak / resolveScene-variant tests missing or copy-of-logic (F-112–F-116)`

**P3**
- `[P3] tsc build gate doesn't type-check scripts/ incl. the validator source (F-123)`
- `[P3] Doc drift: scene counts, component list, choices-per-scene (F-120/F-121/F-122)`

---

## Suggested follow-up investigations
- Add a **per-tier reachability mode** to the content validator (BFS that distinguishes critical-only edges) — would mechanically catch F-102 and any future critical-gated clue.
- Run the store transition seam (`goToScene`/`resetForNewCase`) under a **state-invariant fuzzer**: after any sequence of case-load + navigate, assert `sceneHistory` contains only current-case ids, `lastCheckResult` matches the current scene, and no cross-case residue.
- **Audit every `useStore.getState()` at render time** in `App.tsx` (lines 206-207, 333, 336) for staleness (F-108 is one instance).
- Consider a **shared `resolveCheckOutcome(choice, state)`** unit that both `choiceResolution` and `encounters` call, then property-test that the two paths agree (would prevent F-107-class drift).

---

## Coverage map

**Examined in depth (read + traced):** `src/engine/{diceEngine,choiceResolution,conditions,encounters,advantage,flags,buildDeduction,caseProgression,hintEngine,contentLoader,contentValidation,audioManager,saveManager}.ts`; all six store slices + `store/index.ts` + `utils/gameState.ts` + `audioSubscription.ts`; `App.tsx`, `NarrativePanel`, `ChoicePanel`, `EncounterPanel`, `EvidenceBoard`, `DeductionButton`, `SceneText`, `AccessibilityProvider`, `AmbientAudio`, `useFocusTrap`; `index.html`, `_headers`, `wrangler.jsonc`, `vite.config.ts`, `eslint.config.js`, `tsconfig*.json`, both workflows, `dependabot.yml`, `package.json`; Whitechapel + Mayfair content JSON (acts, variants, deductions, clues, manifest); a representative test sample across engine/store/component suites.

**Skimmed:** remaining components (`CharacterCreation`, `CaseSelection`, `SettingsPanel`, `NPCGallery`, `CaseJournal`, `TitleScreen`, `StatusBar`, `HeaderBar` subcomponents); Lamplighter's Wake + vignette content (spot-checked reachability); `docs/` set.

**Skipped / light:** exhaustive per-scene read of all 201 scenes (sampled + validator-backed instead); `node_modules` internals beyond the React 19 `inert`/attribute paths; the design bible (referenced for intent only).

**Blind spots:** the content-integrity finder's second skeptic pass hit an API error mid-run (recovered via a dedicated re-run + lead verification of F-102), so vignette content reachability is verified less deeply than the main cases. No visual/browser QA was run (static + unit only).

---

## Hidden bug hotspots

1. **`src/engine/encounters.ts`** — the richest hotspot. It re-implements the check pipeline in parallel to `choiceResolution` and has already drifted three ways (ignores auto-succeed flag [F-107], ignores `dynamicDifficulty`, holds `currentRound`/reaction outcome as unpersisted transient state that re-rolls on reload [F-105]); its faculty tiebreak is untested [F-114]. Any future check-mechanic change made in `choiceResolution` will silently not reach encounters.
2. **`src/App.tsx`** — repeatedly reads store state non-reactively via `useStore.getState()` at render time (lines 206-207 for autosave inputs, 333/336 for `canGoBack`) and imperatively sets the ability flag. This `getState()`-at-render pattern already produces the stale review button (F-108) and is the kind of thing that recurs.
3. **`src/store/slices/narrativeSlice.ts`** (`goToScene` + `resetForNewCase`) — the transition/reset seam owning `sceneHistory`, `visitedScenes`, `lastCheckResult`, `lastEffectMessages`, `onEnter` gating, and autosave triggering. It already leaks `currentScene` (F-104), fails to clear `lastCheckResult` (F-106), and mis-gates variant `onEnter` (F-118). Because so many concerns funnel through two functions, any incomplete reset surfaces as a subtle cross-case/cross-scene bug.

---

## Confidence statement

Estimated false-positive rate of this report: **low (~5-10%)**. Every High/Medium finding was independently reproduced by the lead against source (not just agent-reported): F-101, F-102, F-104, F-106, F-118 were confirmed by direct code/JSON reads; the React 19 `inert` behaviour was confirmed against `node_modules/react-dom` internals (that specific finding did not survive into the top set only because the modal overlays are lazy/short-lived, but it is real — see note below). Four findings were rejected by the adversarial pass and are recorded above so they aren't re-filed.

**Note on a real defect not ranked above:** `App.tsx:315` sets `inert: '' as unknown as boolean` on the modal background with a comment describing **React 18** behaviour. In React 19 an empty-string `inert` is falsy and react-dom calls `removeAttribute` (confirmed in `react-dom-client` at the `inert` case, which falls through to the boolean handler and `removeAttribute`s a falsy value; the production bundle behaves identically). So the modal-background inert isolation (F-007) is silently defeated under React 19 — 3 of 4 overlays have no independent Tab trap and rely on it. Fix: `inert: true`. This was verified but arrived via lead analysis rather than the ranked agent set; treat it as an additional **P1 a11y regression** alongside F-119.

**Highest-value next step to deepen the audit:** wire the state-invariant fuzzer over `goToScene`/`resetForNewCase` (hotspot #3) — it would mechanically surface the whole F-104/F-106/F-118 class and any siblings, which are the survivors most likely to have undiscovered relatives.

---

## Appendix

**Test baseline:** 554 passed / 554, 56 files (`npm run test:run`, 2026-07-09).
**Build:** green — `tsc && vite build && nest-for-cloudflare`; entry chunks split (react 181 KB, motion 86 KB, audio 36 KB, index 95 KB).
**Dependencies:** 0 `npm audit` vulnerabilities; all majors current except TypeScript (held, ADR-0008).
**Content:** 201 scenes / 58 clues / 30 NPCs across 7 cases (validator-reported; docs say 198 — F-120). 10 distinct `ambientAudio` refs, all to files that don't yet exist (`public/audio/ambient/` absent — documented milestone M, not a regression). No `illustration` refs in content. 9 SFX files present.
**Audit provenance:** 71 agents (13 finders + adversarial verifiers + synthesis); 37 raw → 25 verified survivors → 23 root-cause-deduped; 4 rejected. One verifier hit an API error (content-integrity), recovered by a dedicated re-run and lead verification.

**Assumptions & limitations:** No browser/visual QA (static + unit only). "Reachable" for content findings assumes forward playthrough without external save editing. Severity reflects impact-if-real; confidence reflects certainty-it's-real; the two are reported separately per finding. This report deliberately excludes the 67 previously-closed findings (F-001…F-067) — new IDs start at F-101 to avoid collision.
