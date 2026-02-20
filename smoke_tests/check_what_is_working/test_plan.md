# Smoke Test Plan

25 cases across 5 areas. No mocks — uses real store, real engine functions, real content data structures.

---

## Area 1: Build & Static Analysis (5 cases)

Validates that the codebase compiles, bundles, and passes static checks.

| # | Case | Command | Pass criteria |
|---|---|---|---|
| 1.1 | TypeScript compiles with strict mode | `npx tsc --noEmit` | Exit code 0, no errors |
| 1.2 | Vite production build succeeds | `npm run build` | Exit code 0, `dist/` contains `index.html` + JS + CSS |
| 1.3 | No high/critical dependency vulnerabilities | `npm audit --audit-level=high` | Exit code 0 |
| 1.4 | Content JSON validates (all cases) | `node scripts/validateCase.mjs` | Exit code 0, "All N case(s) validated successfully" |
| 1.5 | All 269 existing tests pass | `npm run test:run` | 18 files, 269 tests, 0 failures |

---

## Area 2: Engine Correctness (5 cases)

Validates core engine functions with real data structures (no mocks). These are covered by existing tests but called out explicitly as smoke-critical.

| # | Case | Existing test file | What it validates |
|---|---|---|---|
| 2.1 | Dice rolls are bounded [1,20] | `diceEngine.property.test.ts` | `rollD20()` always returns integer in [1,20] across 1000+ random inputs |
| 2.2 | Outcome tiers are correct for all roll/DC combinations | `diceEngine.property.test.ts` | nat 20 → critical, nat 1 → fumble, total ≥ DC → success, total ≥ DC-2 → partial, else failure |
| 2.3 | Condition evaluation is pure AND logic | `narrativeEngine.property.test.ts` | Empty conditions → true. Any false condition → false. All true → true |
| 2.4 | NPC disposition clamped to [-10,+10] | `npcBounds.property.test.ts` | Any delta applied to any starting value stays in bounds |
| 2.5 | Save migration is idempotent | `saveManager.property.test.ts` | `migrate(migrate(file))` equals `migrate(file)` for any input |

---

## Area 3: Store Integrity (5 cases)

Validates that store slices maintain their contracts.

| # | Case | Existing test file | What it validates |
|---|---|---|---|
| 3.1 | Slice isolation — mutations don't leak across slices | `sliceIsolation.property.test.ts` | Mutating one slice's state doesn't affect another slice's state |
| 3.2 | `adjustComposure` clamps to [0,10] | `StatusBar.test.tsx` | Composure never goes below 0 or above 10 |
| 3.3 | `adjustVitality` clamps to [0,10] | `StatusBar.test.tsx` | Vitality never goes below 0 or above 10 |
| 3.4 | `discoverClue` sets `isRevealed` and status `new` | `clueDiscoveryGating.test.ts` | Clue transitions from unrevealed to revealed with correct status |
| 3.5 | `goToScene` pushes to history and updates `currentScene` | `sliceIsolation.property.test.ts` | Scene history grows, current scene changes |

---

## Area 4: Component Rendering (5 cases)

Validates that key components render without crashing and display correct content.

| # | Case | Existing test file | What it validates |
|---|---|---|---|
| 4.1 | CharacterCreation renders all 4 archetypes | `CharacterCreation.test.tsx` | All archetype names visible, selectable |
| 4.2 | ChoicePanel filters choices by conditions | `ChoicePanel.test.tsx` | Choices with unmet requirements are hidden |
| 4.3 | ChoiceCard shows proficiency color coding | `ChoicePanel.test.tsx` | Green/amber/red based on modifier |
| 4.4 | OutcomeBanner renders correct tier feedback | `OutcomeBanner.test.tsx` | Each tier shows correct color/icon/label |
| 4.5 | ClueCard renders all 6 status states | `ClueCard.test.tsx` | new/examined/connected/deduced/contested/spent all render distinctly |

---

## Area 5: Known-Broken Features (5 cases)

Documents features that are expected to fail or be inert. These are NOT test failures — they are the known gaps from the archaeology phase. Documenting them here prevents false alarms during gap closure.

| # | Case | Status | Why |
|---|---|---|---|
| 5.1 | Load game restores playable state | KNOWN BROKEN | `loadGame` doesn't restore `caseData` → `useCurrentScene()` returns null |
| 5.2 | Hint button appears after 3 board visits | KNOWN BROKEN | `trackActivity({ type: 'boardVisit' })` never called |
| 5.3 | Archetype ability auto-succeeds a check | KNOWN BROKEN | Ability flags set but never read by engine |
| 5.4 | Clue discovery card slides in on discovery | KNOWN BROKEN | `ClueDiscoveryCard` is a stub (Task 10) |
| 5.5 | Encounter scenes render with round progression | KNOWN BROKEN | No encounter UI component exists |

These 5 items correspond to gap_analysis.md items 1.1–1.5 and will be resolved by the gap closure plan.
