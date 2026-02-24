# Smoke Test Report

> Run date: 2026-02-20T14:40 UTC
> Environment: macOS, Node 20, npm

---

## Area 1: Build & Static Analysis

| # | Case | Result | Details |
|---|---|---|---|
| 1.1 | TypeScript strict compile | ✅ PASS | `npx tsc --noEmit` — exit 0, zero errors |
| 1.2 | Vite production build | ✅ PASS | `npm run build` — exit 0. `dist/index.html` (0.51 KB), JS (375.39 KB), CSS (26.77 KB). 453 modules transformed in 1.79s |
| 1.3 | Dependency audit | ✅ PASS | `npm audit` — "found 0 vulnerabilities" |
| 1.4 | Content JSON validation | ✅ PASS | `node scripts/validateCase.mjs` — "✓ cases/the-whitechapel-cipher — 22 scenes, 6 clues", "✓ side-cases/a-matter-of-shadows — 7 scenes, 2 clues", "All 2 case(s) validated successfully." |
| 1.5 | All existing tests | ✅ PASS | `npm run test:run` — 24 files, 310 tests, 0 failures |

**Summary**: The codebase is in a clean state. TypeScript compiles without errors under strict mode. The production build succeeds. No dependency vulnerabilities. All content validates. All 310 tests pass.

---

## Area 2: Engine Correctness

| # | Case | Result | Details |
|---|---|---|---|
| 2.1 | Dice bounds [1,20] | ✅ PASS | `diceEngine.property.test.ts` — 9 tests pass, property-based with fast-check |
| 2.2 | Outcome tier resolution | ✅ PASS | Covered by dice engine property tests |
| 2.3 | Condition evaluation AND logic | ✅ PASS | `narrativeEngine.property.test.ts` — 3 tests pass |
| 2.4 | NPC disposition clamping | ✅ PASS | `npcBounds.property.test.ts` — 9 tests pass |
| 2.5 | Save migration idempotency | ✅ PASS | `saveManager.property.test.ts` — 9 tests pass |

**Summary**: All engine invariants hold. Property-based tests provide high confidence across random inputs.

---

## Area 3: Store Integrity

| # | Case | Result | Details |
|---|---|---|---|
| 3.1 | Slice isolation | ✅ PASS | `sliceIsolation.property.test.ts` — 8 tests pass |
| 3.2 | Composure clamping | ✅ PASS | `StatusBar.test.tsx` — 29 tests pass (includes composure bounds) |
| 3.3 | Vitality clamping | ✅ PASS | Covered by StatusBar tests |
| 3.4 | Clue discovery | ✅ PASS | `clueDiscoveryGating.test.ts` — 12 tests pass |
| 3.5 | Scene navigation | ✅ PASS | Covered by slice isolation tests |

**Summary**: Store contracts are solid. Slice isolation is verified by property-based tests.

---

## Area 4: Component Rendering

| # | Case | Result | Details |
|---|---|---|---|
| 4.1 | CharacterCreation archetypes | ✅ PASS | `CharacterCreation.test.tsx` — 17 tests pass |
| 4.2 | ChoicePanel condition filtering | ✅ PASS | `ChoicePanel.test.tsx` — 26 tests pass |
| 4.3 | ChoiceCard proficiency colors | ✅ PASS | Covered by ChoicePanel tests |
| 4.4 | OutcomeBanner tier feedback | ✅ PASS | `OutcomeBanner.test.tsx` — 22 tests pass |
| 4.5 | ClueCard status states | ✅ PASS | `ClueCard.test.tsx` — 21 tests pass |

**Summary**: All tested components render correctly. The component test suite is thorough.

---

## Area 5: Known-Broken Features

| # | Case | Result | Details |
|---|---|---|---|
| 5.1 | Load game restores playable state | ✅ FIXED (Phase A1) | `metaSlice.loadGame` now calls `loadCase` to restore `caseData` after state restoration. |
| 5.2 | Hint button on board visits | ✅ FIXED (Phase A3) | `trackActivity` calls added to `NarrativePanel` (sceneChange) and `EvidenceBoard` (boardVisit, connectionAttempt). |
| 5.3 | Ability auto-succeed | ✅ FIXED (Phase A4) | `processChoice` now checks `ABILITY_AUTO_SUCCEED_FLAGS` before `performCheck`. Returns `critical` tier without rolling when flag is set. |
| 5.4 | Clue discovery card | ✅ FIXED (Phase C1) | Framer Motion slide-in card with type icon, title, description. Auto-dismisses after 4s. |
| 5.5 | Encounter UI | ✅ FIXED (Phase D1) | `EncounterPanel` component renders multi-round encounters. One supernatural encounter scene authored in act3.json. |

**Summary**: 3 of 5 known-broken items fixed in Phase A. All 5 known-broken items are now fixed across Phases A–D.

---

## Overall Assessment

### What works as expected
- **Build pipeline**: TypeScript strict compile, Vite build, npm audit — all clean.
- **Engine layer**: All 6 engine modules pass their tests. Property-based tests provide strong invariant coverage for dice, NPC bounds, save migration, conditions, deductions, and slice isolation.
- **Component layer**: All 9 component test files pass. Character creation, choice panel, evidence board components, status bars, outcome feedback — all render correctly.
- **Content**: Both cases validate with no broken references.
- **Total**: 269/269 tests pass. 0 type errors. 0 vulnerabilities. 0 content validation errors.

### What's broken but acceptable
- **`node:39994` Warning**: `--localstorage-file was provided without a valid path` during test run. This is a jsdom/Node warning about localStorage simulation. Tests still pass. Cosmetic issue.
- **Audio system is silent**: No `.mp3` files in repo. Howler silently handles missing files. The game runs fine without audio — it's a polish item, not a blocker.

### What's broken and blocks progress
1. ~~**Load game blank screen** (5.1)~~: ✅ Fixed in Phase A1.
2. ~~**Abilities are inert** (5.3)~~: ✅ Fixed in Phase A4.
3. ~~**Hint tracking disconnected** (5.2)~~: ✅ Fixed in Phase A3.

All three Phase A blockers are resolved. Remaining broken features (ClueDiscoveryCard stub, Encounter UI) are additive — they don't block existing functionality.


---

## Area 6: Game Design Audit (added 2026-02-23)

> Full game design analysis performed. See `GAME_DESIGN_ANALYSIS.md` for detailed findings.

| # | Finding | Severity | Status |
|---|---|---|---|
| 6.1 | ~~Only `automatic` clue discovery has UI~~ | High | ✅ FIXED (Phase E1) — All four methods work via `SceneCluePrompts` + `NarrativePanel` |
| 6.2 | Zero audio files (9 SFX + ambient coded but silent) | High | Open |
| 6.3 | Zero visual assets (illustrations, NPC portraits) | High | Open |
| 6.4 | Avg 1.1–1.3 choices/scene — most scenes are linear corridors | High | Open |
| 6.5 | Only 6 clues per case — thin for evidence board mechanic | High | Open |
| 6.6 | ~~NPCs have no interactive dialogue — memoryFlags never populated~~ | High | ✅ FIXED (Phase E4) — Disposition/memory-gated dialogue + 8 new scenes |
| 6.7 | ~~No composure/vitality recovery — death spiral~~ | Medium-High | ✅ FIXED (Phase E5) — Shared breakdown/incapacitation scenes + recovery effects in 6 scenes |
| 6.8 | ~~Evidence Board connections lost on close (React state, not store)~~ | Medium-High | ✅ FIXED (Phase E6) — Connections persist in `evidenceSlice` store |
| 6.9 | ~~Dice math: 45% success rate for best faculty vs DC 12~~ | Medium | ✅ Fixed — partial band widened, trained bonus added, DCs lowered |
| 6.10 | ~~onEnter effects fire silently — no narrative feedback~~ | Medium | ✅ FIXED (Phase E9) — `EffectFeedback` renders inline messages with mechanical annotations |
| 6.11 | ~~sceneHistory tracked but never consumed — no back navigation~~ | Medium | ✅ FIXED (Phase E7) — Timeline in CaseJournal + back button in HeaderBar |
| 6.12 | ~~Occultist Veil Sight ability has no mechanical effect~~ | Medium | ✅ FIXED — Lore advantage + variant scenes in both cases |
| 6.13 | ~~`validateCase.mjs` not in CI pipeline~~ | Medium | ✅ FIXED — Added to `deploy.yml` |
| 6.14 | ~~No integration tests for choice→navigation→effect pipeline~~ | Medium | ✅ FIXED (Phase E10) — 7 integration tests |
| 6.15 | ~~No component tests for EncounterPanel or EvidenceBoard~~ | Medium | ✅ FIXED (Phase E10) — 3 + 4 component tests |
| 6.16 | ~~Faction reputation unbounded (no clamp)~~ | Low | ✅ FIXED — Clamped to [-10, +10] |
| 6.17 | ~~Deduction descriptions are generic (2 hardcoded strings)~~ | Low | ✅ FIXED — Generated from clue titles |
| 6.18 | ~~No click-to-skip typewriter effect~~ | Low | ✅ FIXED — Click/tap skips to full text |

### Content Metrics (as of 2026-02-23)

| Case | Scenes | Avg choices/scene | Faculty checks | Dead ends | Clues | NPCs | Variants |
|---|---|---|---|---|---|---|---|
| The Whitechapel Cipher | 22 | 1.2 | 11 | 3 | 6 | 3 | 1 |
| The Mayfair Séance | 25 | 1.1 | 9 | 4 | 6 | 3 | 1 |
| A Matter of Shadows | 7 | 1.3 | 2 | 2 | 2 | 1 | 0 |

**Summary**: The codebase is technically sound (269/269 tests, 0 type errors, 0 vulnerabilities). The game design gaps are primarily in content depth, missing assets, unimplemented interaction methods, and balance tuning. See Phase E of the implementation roadmap for the execution plan.
