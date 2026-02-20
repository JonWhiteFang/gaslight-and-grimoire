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
| 1.5 | All existing tests | ✅ PASS | `npm run test:run` — 18 files, 269 tests, 0 failures. Duration: 7.49s |

**Summary**: The codebase is in a clean state. TypeScript compiles without errors under strict mode. The production build succeeds. No dependency vulnerabilities. All content validates. All 269 tests pass.

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
| 5.5 | Encounter UI | ⚠️ KNOWN BROKEN | `encounterSystem.test.ts` passes (20 tests) — the engine works. But no component renders encounters. No integration test exists. |

**Summary**: 3 of 5 known-broken items fixed in Phase A. Remaining 2 (ClueDiscoveryCard stub, Encounter UI) are scheduled for Phase C and Phase D respectively.

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
