# Phase 3 — Dice / Probability Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the odds of a faculty check legible before and after the roll — DC + a diegetic "Prospects" band (Favourable/Uncertain/Forbidding) + advantage on the three check surfaces, and DC at the roll — without ever showing a literal percentage.

**Architecture:** One pure RNG-free engine helper (`checkOdds.ts`) computes the odds + band + an accessible-name phrase; a shared decorative `CheckOddsTag` renders it; the three faculty-check surfaces (`ChoiceCard`, `SceneCluePrompts`, encounter round choices via `ChoiceCard`) append the phrase to their existing outer-button `aria-label`. A shared `checkAutoSucceeds` predicate (extracted from the resolver) suppresses dice odds for guaranteed-critical ability checks. `CheckResult` gains an optional `dc` for the at-roll overlay (no save migration).

**Tech Stack:** TypeScript, React 19, Zustand+Immer, Vitest 4 + React Testing Library, Tailwind v4.

**Spec:** [`docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md`](../specs/2026-07-16-phase3-dice-legibility-design.md) (Codex-reviewed; 5 findings folded).

**Conventions to follow:**
- TDD: write the failing test, watch it fail, implement minimal code, watch it pass, commit.
- Run a single test file with `npx vitest run <path>`; full suite `npm run test:run`.
- Type-check via `npm run build` (or `npx tsc --noEmit -p tsconfig.json`); lint `npm run lint`.
- Baseline before starting: **684 tests / 64 files** on `main`. Branch is `feat/phase3-dice-legibility`.
- Commit after each task. Do NOT squash.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/engine/checkOdds.ts` | **NEW** — pure `computeCheckOdds`, `describeCheckOdds`, `ProspectsBand`, `CheckOdds`, thresholds |
| `src/engine/flags.ts` | **MODIFY** — add pure `checkAutoSucceeds(faculty, flags)` |
| `src/engine/choiceResolution.ts` | **MODIFY** — call `checkAutoSucceeds` (behaviour-preserving refactor) |
| `src/store/slices/narrativeSlice.ts` | **MODIFY** — `CheckResult.dc?: number` |
| `src/components/shared/CheckOddsTag.tsx` + `index.ts` | **NEW** — decorative (`aria-hidden`) tag |
| `src/components/ChoicePanel/ChoiceCard.tsx` | **MODIFY** — render tag; append odds to button `aria-label`; real-check + autoSucceeds props |
| `src/components/ChoicePanel/ChoicePanel.tsx` | **MODIFY** — pass `flags`/`autoSucceeds` + `dc` into result |
| `src/components/NarrativePanel/SceneCluePrompts.tsx` | **MODIFY** — tag (partialCountsAsSuccess) + append to label + pass `dc` |
| `src/components/NarrativePanel/NarrativePanel.tsx` | **MODIFY** — thread `dc` into `setCheckResult` |
| `src/components/NarrativePanel/DiceRollOverlay.tsx` | **MODIFY** — optional `dc` prop |
| `src/components/EncounterPanel/EncounterPanel.tsx` | **MODIFY** — pass `dc` through for round choices |
| `src/engine/__tests__/checkOdds.test.ts` | **NEW** |
| `src/engine/__tests__/checkAutoSucceeds.test.ts` | **NEW** |
| component tests (co-located under `src/components/__tests__/`) | **NEW/extended** |

---

## Task 1: `checkAutoSucceeds` predicate + resolver refactor

Extract the resolver's inline auto-succeed check into a pure, shared predicate so the pre-roll UI and the resolver agree (Codex Major 1).

**Files:**
- Modify: `src/engine/flags.ts`
- Modify: `src/engine/choiceResolution.ts:48-55`
- Test: `src/engine/__tests__/checkAutoSucceeds.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/checkAutoSucceeds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkAutoSucceeds } from '../flags';

describe('checkAutoSucceeds', () => {
  it('is true when the faculty has an active auto-succeed flag', () => {
    expect(checkAutoSucceeds('reason', { 'ability-auto-succeed-reason': true })).toBe(true);
    expect(checkAutoSucceeds('vigor', { 'ability-auto-succeed-vigor': true })).toBe(true);
    expect(checkAutoSucceeds('influence', { 'ability-auto-succeed-influence': true })).toBe(true);
  });

  it('is false when the flag is absent or false', () => {
    expect(checkAutoSucceeds('reason', {})).toBe(false);
    expect(checkAutoSucceeds('reason', { 'ability-auto-succeed-reason': false })).toBe(false);
  });

  it('is false for faculties that have no auto-succeed ability', () => {
    expect(checkAutoSucceeds('perception', { 'ability-auto-succeed-reason': true })).toBe(false);
    expect(checkAutoSucceeds('nerve', {})).toBe(false);
    expect(checkAutoSucceeds('lore', {})).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/checkAutoSucceeds.test.ts`
Expected: FAIL — `checkAutoSucceeds is not a function` / not exported.

- [ ] **Step 3: Add the predicate to `flags.ts`**

In `src/engine/flags.ts`, directly after the `abilityAutoSucceedFlag` function (line 18):

```ts
/**
 * True when `faculty` has an auto-succeed ability whose flag is currently active.
 * Shared by resolveCheckOutcome (guaranteed critical) and the Phase 3 pre-roll
 * odds display so the UI never shows dice odds for a guaranteed check.
 */
export function checkAutoSucceeds(faculty: Faculty, flags: Record<string, boolean>): boolean {
  const flag = abilityAutoSucceedFlag(faculty);
  return !!flag && !!flags[flag];
}
```

- [ ] **Step 4: Refactor the resolver to use it (behaviour-preserving)**

In `src/engine/choiceResolution.ts`, import `checkAutoSucceeds` alongside `abilityAutoSucceedFlag` (line 14), then change lines 49-55 from:

```ts
    const abilityFlag = abilityAutoSucceedFlag(choice.faculty);
    if (abilityFlag && state.flags[abilityFlag]) {
      return {
        result: { nextSceneId: choice.outcomes['critical'], tier: 'critical' },
        consumedAbilityFlag: abilityFlag,
      };
    }
```

to:

```ts
    const abilityFlag = abilityAutoSucceedFlag(choice.faculty);
    if (abilityFlag && checkAutoSucceeds(choice.faculty, state.flags)) {
      return {
        result: { nextSceneId: choice.outcomes['critical'], tier: 'critical' },
        consumedAbilityFlag: abilityFlag,
      };
    }
```

(`abilityFlag` is retained because it is returned as `consumedAbilityFlag`; the guard now routes through the shared predicate.)

- [ ] **Step 5: Add a resolver behaviour-preservation assertion + run tests**

There is **no** `choiceResolution*.test.ts` (an unmatched glob aborts under zsh). Add a direct resolver case to the
new test file so the refactor is guarded, then run an exact path. Append to `checkAutoSucceeds.test.ts`:

```ts
import { resolveCheckOutcome } from '../choiceResolution';
import type { Choice, GameState } from '../../types';

describe('resolveCheckOutcome — auto-succeed still short-circuits after the refactor', () => {
  it('returns a guaranteed critical and consumes the ability flag', () => {
    const choice = {
      id: 'x', text: 't', faculty: 'reason', difficulty: 14,
      outcomes: { critical: 'crit', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
    } as Choice;
    const state = { flags: { 'ability-auto-succeed-reason': true }, investigator: {
      name: 'T', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    } } as unknown as GameState;
    const out = resolveCheckOutcome(choice, state);
    expect(out.result.tier).toBe('critical');
    expect(out.result.nextSceneId).toBe('crit');
    expect(out.consumedAbilityFlag).toBe('ability-auto-succeed-reason');
  });
});
```

> **Implementer note:** confirm `GameState`'s required fields (`clues`, `deductions`, etc.) and add the minimum the
> cast needs — check an existing engine test that builds a `GameState` (e.g. `integration.test.ts`) for the shape.

Run: `npx vitest run src/engine/__tests__/checkAutoSucceeds.test.ts src/engine/__tests__/integration.test.ts`
Expected: PASS — new predicate + resolver tests green AND the existing integration suite still green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/flags.ts src/engine/choiceResolution.ts src/engine/__tests__/checkAutoSucceeds.test.ts
git commit -m "feat(engine): shared checkAutoSucceeds predicate (Phase 3 T1)"
```

---

## Task 2: `checkOdds.ts` — probability, band, thresholds

The load-bearing pure module. Heaviest test coverage.

**Files:**
- Create: `src/engine/checkOdds.ts`
- Test: `src/engine/__tests__/checkOdds.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/checkOdds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeCheckOdds, describeCheckOdds } from '../checkOdds';
import type { Investigator } from '../../types';

// Valid Investigator fixture. Archetype 'deductionist' has primaryFaculty 'reason'
// (src/data/archetypes.ts), so a reason check gets +1 trained bonus. Required
// fields per src/types/index.ts: name, archetype, faculties, composure, vitality,
// abilityUsed. lastCriticalFaculty is OPTIONAL (omit it — do not pass null).
function inv(reasonScore = 10, archetype: Investigator['archetype'] = 'deductionist'): Investigator {
  return {
    name: 'Test', archetype,
    faculties: { reason: reasonScore, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

const base = {
  investigator: inv(10, 'deductionist'), // reason 10 → mod 0, +1 trained (reason primary) = +1
  hasAdvantage: false, hasDisadvantage: false, autoSucceeds: false, partialCountsAsSuccess: false,
};

describe('computeCheckOdds — band thresholds at the EXACT .65 / .35 boundaries', () => {
  // needed = dc - modifier; p = clamp((21-needed)/20, .05, .95).
  // Favourable ≥ .65, Uncertain [.35,.65), Forbidding < .35 — pin the boundaries.
  // mod +1 (deductionist/reason).
  it('p == .65 exactly → Favourable (inclusive lower bound)', () => {
    // p .65 needs (21-needed)/20 = .65 → needed = 8 → dc = needed + mod = 9
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 9 });
    expect(o.band).toBe('favourable');
  });
  it('just below .65 → Uncertain', () => {
    // needed 9 → p .60 → dc = 10
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 10 });
    expect(o.band).toBe('uncertain');
  });
  it('p == .35 exactly → Uncertain (inclusive lower bound)', () => {
    // p .35 → needed = 14 → dc = 15
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 15 });
    expect(o.band).toBe('uncertain');
  });
  it('just below .35 → Forbidding', () => {
    // needed 15 → p .30 → dc = 16
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 16 });
    expect(o.band).toBe('forbidding');
  });
});

describe('computeCheckOdds — clamp is load-bearing (fails if clamp deleted)', () => {
  // Each pairs an extreme DC (raw p outside [0,1]) with adv/disadv so the fold-in
  // squares the WRONG number if the clamp is removed. Guard = the band flips.
  it('extreme-high DC + disadvantage → Forbidding (guards the p<0 floor)', () => {
    // dc 40, mod +1 → needed 39 → raw p = (21-39)/20 = -0.9.
    //   clamped:   p=.05 → disadv .05^2 = .0025 → Forbidding ✓
    //   UNCLAMPED: (-0.9)^2 = .81 → Favourable ✗  ← flips if clamp deleted
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 40, hasDisadvantage: true });
    expect(o.band).toBe('forbidding');
  });
  it('extreme-low DC + advantage → Favourable (guards the p>1 ceiling)', () => {
    // dc -20, mod +1 → needed -21 → raw p = (21+21)/20 = 2.1.
    //   clamped:   p=.95 → adv 1-(1-.95)^2 = .9975 → Favourable ✓
    //   UNCLAMPED: 1-(1-2.1)^2 = 1-1.21 = -0.21 → Forbidding ✗  ← flips if clamp deleted
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: -20, hasAdvantage: true });
    expect(o.band).toBe('favourable');
  });
});

describe('computeCheckOdds — advantage / disadvantage', () => {
  it('advantage lifts a Forbidding bare check to Uncertain', () => {
    // dc 17, mod +1 → needed 16 → p = .25 (forbidding). adv pEff = 1-(1-.25)^2 = .4375 → uncertain.
    const bare = computeCheckOdds({ ...base, faculty: 'reason', dc: 17 });
    const adv = computeCheckOdds({ ...base, faculty: 'reason', dc: 17, hasAdvantage: true });
    expect(bare.band).toBe('forbidding');
    expect(adv.band).toBe('uncertain');
  });
  it('disadvantage lowers a bare Uncertain check to Forbidding', () => {
    // dc 13 → needed 12 → p .45 (uncertain); disadv pEff = .45^2 = .2025 → forbidding.
    const dis = computeCheckOdds({ ...base, faculty: 'reason', dc: 13, hasDisadvantage: true });
    expect(dis.band).toBe('forbidding');
  });
  it('advantage + disadvantage cancel', () => {
    const both = computeCheckOdds({ ...base, faculty: 'reason', dc: 13, hasAdvantage: true, hasDisadvantage: true });
    const plain = computeCheckOdds({ ...base, faculty: 'reason', dc: 13 });
    expect(both.band).toBe(plain.band);
  });
});

describe('computeCheckOdds — partialCountsAsSuccess', () => {
  it('including partial can raise the band on a clue prompt', () => {
    // perception mod 0 (score 10, NOT the deductionist primary). dc 10:
    //   strict:  needed 10 → p .55 → uncertain
    //   partial: needed dc-3 = 7 → p .70 → favourable
    const strict = computeCheckOdds({ ...base, faculty: 'perception', dc: 10 });
    const lenient = computeCheckOdds({ ...base, faculty: 'perception', dc: 10, partialCountsAsSuccess: true });
    expect(strict.band).toBe('uncertain');
    expect(lenient.band).toBe('favourable');
  });
});

describe('computeCheckOdds — autoSucceeds', () => {
  it('marks autoSucceeds and defaults band to favourable regardless of DC', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 40, autoSucceeds: true });
    expect(o.autoSucceeds).toBe(true);
    expect(o.band).toBe('favourable');
  });
});

describe('describeCheckOdds', () => {
  it('phrases a normal check', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 13 });
    expect(describeCheckOdds(o)).toBe('Reason check, modifier +1, difficulty 13, prospects uncertain');
  });
  it('appends advantage', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 9, hasAdvantage: true });
    expect(describeCheckOdds(o)).toContain('advantage');
  });
  it('phrases an assured check without probability language', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 13, autoSucceeds: true });
    expect(describeCheckOdds(o)).toBe('Reason check, assured success');
  });
});

describe('computeCheckOdds — monotonic in modifier (property)', () => {
  const order = { forbidding: 0, uncertain: 1, favourable: 2 } as const;
  it('higher modifier never yields a worse band at fixed DC', () => {
    fc.assert(fc.property(
      fc.integer({ min: 4, max: 20 }), fc.integer({ min: 4, max: 20 }), fc.integer({ min: 1, max: 25 }),
      (loScore, hiScore, dc) => {
        const lo = Math.min(loScore, hiScore), hi = Math.max(loScore, hiScore);
        const oLo = computeCheckOdds({ ...base, investigator: inv(lo), faculty: 'reason', dc });
        const oHi = computeCheckOdds({ ...base, investigator: inv(hi), faculty: 'reason', dc });
        expect(order[oHi.band]).toBeGreaterThanOrEqual(order[oLo.band]);
      },
    ));
  });
});
```

> **Implementer note (verified against repo):** `Investigator` requires `name, archetype, faculties,
> composure, vitality, abilityUsed`; `lastCriticalFaculty` is **optional** (omit — never pass `null`).
> There are **no** `maxComposure`/`maxVitality` fields. Valid archetype ids are `deductionist` (reason
> primary), and the others in `src/data/archetypes.ts` — use `deductionist` for reason-check expectations.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/checkOdds.test.ts`
Expected: FAIL — `computeCheckOdds`/`describeCheckOdds` not found.

- [ ] **Step 3: Implement `checkOdds.ts`**

Create `src/engine/checkOdds.ts`:

```ts
import type { Faculty, Investigator } from '../types';
import { calculateModifier, getTrainedBonus } from './diceEngine';

export type ProspectsBand = 'favourable' | 'uncertain' | 'forbidding';

export interface CheckOdds {
  faculty: Faculty;
  modifier: number;
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  autoSucceeds: boolean;
  band: ProspectsBand;
}

export interface ComputeCheckOddsArgs {
  faculty: Faculty;
  investigator: Investigator;
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  autoSucceeds: boolean;
  /** true where a `partial` tier yields the advertised benefit (clue prompts) */
  partialCountsAsSuccess: boolean;
}

// Band thresholds on the EFFECTIVE success probability.
const FAVOURABLE_MIN = 0.65;
const UNCERTAIN_MIN = 0.35;

// Natural-roll clamp: nat-1 always fails, nat-20 always succeeds.
const P_MIN = 1 / 20;
const P_MAX = 19 / 20;

const FACULTY_DISPLAY: Record<Faculty, string> = {
  reason: 'Reason', perception: 'Perception', nerve: 'Nerve',
  vigor: 'Vigor', influence: 'Influence', lore: 'Lore',
};

function clamp(p: number): number {
  return Math.max(P_MIN, Math.min(P_MAX, p));
}

function bandFor(pEff: number): ProspectsBand {
  if (pEff >= FAVOURABLE_MIN) return 'favourable';
  if (pEff >= UNCERTAIN_MIN) return 'uncertain';
  return 'forbidding';
}

export function computeCheckOdds(args: ComputeCheckOddsArgs): CheckOdds {
  const { faculty, investigator, dc, hasAdvantage, hasDisadvantage, autoSucceeds, partialCountsAsSuccess } = args;
  const modifier =
    calculateModifier(investigator.faculties[faculty]) + getTrainedBonus(faculty, investigator.archetype);

  if (autoSucceeds) {
    return { faculty, modifier, dc, hasAdvantage, hasDisadvantage, autoSucceeds: true, band: 'favourable' };
  }

  // Lowest passing natural roll. resolveCheck: success at total >= dc; partial at total >= dc-3.
  const passThreshold = partialCountsAsSuccess ? dc - 3 : dc;
  const needed = passThreshold - modifier;
  // P(nat >= needed) over a d20 = (21 - needed)/20, then clamped.
  const p = clamp((21 - needed) / 20);

  // advantage/disadvantage cancel
  const adv = hasAdvantage && !hasDisadvantage;
  const dis = hasDisadvantage && !hasAdvantage;
  const pEff = adv ? 1 - (1 - p) * (1 - p) : dis ? p * p : p;

  return { faculty, modifier, dc, hasAdvantage, hasDisadvantage, autoSucceeds: false, band: bandFor(pEff) };
}

export function describeCheckOdds(odds: CheckOdds): string {
  const name = FACULTY_DISPLAY[odds.faculty];
  if (odds.autoSucceeds) return `${name} check, assured success`;
  const mod = odds.modifier >= 0 ? `+${odds.modifier}` : `${odds.modifier}`;
  let phrase = `${name} check, modifier ${mod}, difficulty ${odds.dc}, prospects ${odds.band}`;
  if (odds.hasAdvantage && !odds.hasDisadvantage) phrase += ', advantage';
  else if (odds.hasDisadvantage && !odds.hasAdvantage) phrase += ', disadvantage';
  return phrase;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/checkOdds.test.ts`
Expected: PASS (all describe blocks). If the `inv()` archetype assumption was off, fix the helper — not the source.

- [ ] **Step 5: Commit**

```bash
git add src/engine/checkOdds.ts src/engine/__tests__/checkOdds.test.ts
git commit -m "feat(engine): checkOdds — prospects band + accessible phrase (Phase 3 T2)"
```

---

## Task 3: `CheckResult.dc` store field + `DiceRollOverlay` DC display

**Files:**
- Modify: `src/store/slices/narrativeSlice.ts:77-82`
- Modify: `src/components/NarrativePanel/DiceRollOverlay.tsx`
- Test: `src/components/__tests__/DiceRollOverlay.dc.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/DiceRollOverlay.dc.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiceRollOverlay } from '../NarrativePanel/DiceRollOverlay';

describe('DiceRollOverlay — DC display', () => {
  it('renders "vs DC N" when dc is supplied', () => {
    render(<DiceRollOverlay roll={17} modifier={2} total={19} dc={14} visible reducedMotion />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    // aria-label mentions the DC
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining('14'));
  });

  it('omits DC entirely when dc is absent (backward compatible)', () => {
    render(<DiceRollOverlay roll={17} modifier={2} total={19} visible reducedMotion />);
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DiceRollOverlay.dc.test.tsx`
Expected: FAIL — no `dc` prop; "DC 14" not rendered.

- [ ] **Step 3: Add `dc` to the store `CheckResult`**

In `src/store/slices/narrativeSlice.ts`, change the `CheckResult` interface (lines 77-82) to add the optional field:

```ts
export interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  tier: OutcomeTier;
  dc?: number;
}
```

- [ ] **Step 4: Add the `dc` prop to `DiceRollOverlay`**

In `src/components/NarrativePanel/DiceRollOverlay.tsx`, add `dc?: number` to `DiceRollOverlayProps`, destructure it, extend the `aria-label`, and render `vs DC {dc}` after the total. Replace the props interface + the `aria-label` and the roll-breakdown block:

Props interface — add the field:

```tsx
export interface DiceRollOverlayProps {
  roll?: number;
  modifier?: number;
  total?: number;
  dc?: number;
  visible?: boolean;
  reducedMotion?: boolean;
}
```

Destructure `dc` in the params, then set the container `aria-label` to include the DC when present:

```tsx
      aria-label={
        dc == null
          ? `Dice roll: ${roll} ${modifierLabel} = ${total}`
          : `Dice roll: ${roll} ${modifierLabel} = ${total}, versus difficulty ${dc}`
      }
```

Inside the roll-breakdown `<div className="flex items-center gap-2 ...">`, after the total `<span>`, add:

```tsx
          {dc != null && (
            <>
              <span className="text-gaslight-fog/60" aria-hidden="true">vs</span>
              <span className="text-gaslight-fog/80" aria-hidden="true">DC {dc}</span>
            </>
          )}
```

- [ ] **Step 5: Wire the DC into the overlay's render call (Codex plan-review Major 2)**

The prop is useless until `NarrativePanel` passes it. In `src/components/NarrativePanel/NarrativePanel.tsx`, the
`<DiceRollOverlay>` element (around line 125) currently passes `roll`/`modifier`/`total`/`visible`/`reducedMotion`
but **not** `dc`. Add it:

```tsx
      <DiceRollOverlay
        roll={lastCheckResult?.roll}
        modifier={lastCheckResult?.modifier}
        total={lastCheckResult?.total}
        dc={lastCheckResult?.dc}
        visible={diceVisible}
        reducedMotion={reducedMotion}
      />
```

- [ ] **Step 6: Add a NarrativePanel integration test proving the DC reaches the overlay**

Append to a new `src/components/__tests__/NarrativePanel.dc.test.tsx` (seed a `lastCheckResult` with `dc` via the
store, mirroring the existing NarrativePanel store-seeding helper — check `src/components/__tests__` for it):

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NarrativePanel } from '../NarrativePanel/NarrativePanel';
import { useStore } from '../../store';

describe('NarrativePanel — DC reaches the dice overlay', () => {
  beforeEach(() => {
    // Reuse the repo's store-reset/seed helper if one exists; otherwise set the
    // minimum: a current scene + investigator so the panel renders, then the result.
    useStore.setState({ lastCheckResult: { roll: 17, modifier: 2, total: 19, tier: 'success', dc: 14 } });
  });

  it('renders "vs DC 14" from lastCheckResult.dc', () => {
    render(<NarrativePanel />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
  });
});
```

> **Implementer note:** confirm what minimum store state `NarrativePanel` needs to render (it reads
> `currentScene`, `investigator`, `clues`, `settings`, `lastCheckResult`). Reuse the established seeding
> pattern from the existing NarrativePanel tests rather than hand-rolling. If a full render is heavy, an
> acceptable alternative is asserting the overlay receives `dc` — but the DOM assertion above is preferred.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/DiceRollOverlay.dc.test.tsx src/components/__tests__/NarrativePanel.dc.test.tsx`
Expected: PASS. The NarrativePanel test is the one that would stay RED if Step 5's render-call wiring were skipped.

- [ ] **Step 8: Commit**

```bash
git add src/store/slices/narrativeSlice.ts src/components/NarrativePanel/DiceRollOverlay.tsx src/components/NarrativePanel/NarrativePanel.tsx src/components/__tests__/DiceRollOverlay.dc.test.tsx src/components/__tests__/NarrativePanel.dc.test.tsx
git commit -m "feat: CheckResult.dc + DiceRollOverlay 'vs DC' display, wired through NarrativePanel (Phase 3 T3)"
```

---

## Task 4: `CheckOddsTag` shared decorative component

**Files:**
- Create: `src/components/shared/CheckOddsTag.tsx`
- Create: `src/components/shared/index.ts`
- Test: `src/components/__tests__/CheckOddsTag.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/CheckOddsTag.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckOddsTag } from '../shared';
import type { CheckOdds } from '../../engine/checkOdds';

const odds: CheckOdds = {
  faculty: 'reason', modifier: 2, dc: 14,
  hasAdvantage: false, hasDisadvantage: false, autoSucceeds: false, band: 'uncertain',
};

describe('CheckOddsTag', () => {
  it('renders DC and the prospects band', () => {
    render(<CheckOddsTag odds={odds} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    expect(screen.getByText(/Uncertain/i)).toBeInTheDocument();
  });

  it('is aria-hidden (odds conveyed via the parent button label)', () => {
    const { container } = render(<CheckOddsTag odds={odds} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    // no independent aria-label competing with the parent button name
    expect(container.querySelector('[aria-label]')).toBeNull();
  });

  it('shows the Assured treatment (no DC) when autoSucceeds', () => {
    render(<CheckOddsTag odds={{ ...odds, autoSucceeds: true }} />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
  });

  it('renders the literal "Prospects:" label', () => {
    render(<CheckOddsTag odds={odds} />);
    expect(screen.getByText(/Prospects:\s*Uncertain/i)).toBeInTheDocument();
  });

  it('does NOT render its own advantage glyph (ChoiceCard/prompt owns it — no duplicate)', () => {
    render(<CheckOddsTag odds={{ ...odds, hasAdvantage: true }} />);
    expect(screen.queryByText('◈')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/CheckOddsTag.test.tsx`
Expected: FAIL — module `../shared` / `CheckOddsTag` not found.

- [ ] **Step 3: Implement the component + barrel**

Create `src/components/shared/CheckOddsTag.tsx`:

```tsx
/**
 * CheckOddsTag — decorative pre-roll odds display (DC + Prospects band + advantage,
 * or an "Assured" treatment for guaranteed auto-succeed checks).
 *
 * DECORATIVE ONLY (aria-hidden): the odds are conveyed to assistive tech by the
 * PARENT control appending `describeCheckOdds(odds)` to its own button aria-label,
 * because the button's explicit aria-label overrides descendant text (Phase 3 spec §2.3).
 */
import type { CheckOdds, ProspectsBand } from '../../engine/checkOdds';

const BAND_LABEL: Record<ProspectsBand, string> = {
  favourable: 'Favourable', uncertain: 'Uncertain', forbidding: 'Forbidding',
};

const BAND_STYLE: Record<ProspectsBand, string> = {
  favourable: 'text-green-300 border-green-700',
  uncertain: 'text-amber-300 border-amber-700',
  forbidding: 'text-red-300 border-red-700',
};

const ASSURED_STYLE = 'text-yellow-300 border-yellow-400/60';

export interface CheckOddsTagProps {
  odds: CheckOdds;
}

export function CheckOddsTag({ odds }: CheckOddsTagProps) {
  if (odds.autoSucceeds) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ASSURED_STYLE}`}
      >
        Assured
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${BAND_STYLE[odds.band]}`}
    >
      <span>vs DC {odds.dc}</span>
      <span className="opacity-75">· Prospects: {BAND_LABEL[odds.band]}</span>
    </span>
  );
}
```

> **Note:** the tag deliberately does **not** render the ◈ advantage glyph — `ChoiceCard` already renders its own
> advantage indicator (`ChoiceCard.tsx:126-135`), and `SceneCluePrompts` clue checks never have advantage. Rendering
> it here too would double the glyph (Codex plan-review Minor). The advantage is still conveyed to AT via the
> button's appended `aria-label` phrase.

Create `src/components/shared/index.ts`:

```ts
export { CheckOddsTag } from './CheckOddsTag';
export type { CheckOddsTagProps } from './CheckOddsTag';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/CheckOddsTag.test.tsx`
Expected: PASS all four.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/CheckOddsTag.tsx src/components/shared/index.ts src/components/__tests__/CheckOddsTag.test.tsx
git commit -m "feat(ui): decorative CheckOddsTag (Phase 3 T4)"
```

---

## Task 5: `ChoiceCard` — render tag + append odds to button label

`ChoiceCard` is used by BOTH `ChoicePanel` and `EncounterPanel`, so this covers encounter round choices transitively (spec §4.3). The card needs the check flags; `ChoicePanel`/`EncounterPanel` already build a `GameState`, so pass `autoSucceeds` as a prop (computed by the parent) to keep `ChoiceCard` presentational.

**Files:**
- Modify: `src/components/ChoicePanel/ChoiceCard.tsx`
- Test: `src/components/__tests__/ChoiceCard.odds.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ChoiceCard.odds.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceCard } from '../ChoicePanel/ChoiceCard';
import type { Choice, Investigator } from '../../types';

function inv(): Investigator {
  return {
    name: 'T', archetype: 'deductionist',
    faculties: { reason: 14, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

const checkChoice: Choice = {
  id: 'c1', text: 'Force the lock', faculty: 'reason', difficulty: 14,
  outcomes: { critical: 's', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
} as Choice;

const facultyOnlyChoice: Choice = {
  id: 'c2', text: 'Ponder', faculty: 'reason', // NO difficulty / dynamicDifficulty
  outcomes: { critical: 's', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
} as Choice;

const common = {
  investigator: inv(), revealedClueIds: new Set<string>(), deductionIds: new Set<string>(),
  hasAdvantage: false, autoSucceeds: false, onSelect: () => {},
};

describe('ChoiceCard — pre-roll odds', () => {
  it('shows the Prospects tag and folds odds into the button accessible name on a real check', () => {
    render(<ChoiceCard choice={checkChoice} {...common} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    const btn = screen.getByRole('button');
    expect(btn).toHaveAccessibleName(/difficulty 14/);
    expect(btn).toHaveAccessibleName(/prospects/);
  });

  it('omits DC/Prospects on a faculty-only (non-check) choice', () => {
    render(<ChoiceCard choice={facultyOnlyChoice} {...common} />);
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/prospects/i);
  });

  it('shows Assured when autoSucceeds', () => {
    render(<ChoiceCard choice={checkChoice} {...common} autoSucceeds />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAccessibleName(/assured success/i);
  });

  it('shows exactly one advantage glyph when advantaged (tag must not duplicate it)', () => {
    render(<ChoiceCard choice={checkChoice} {...common} hasAdvantage />);
    expect(screen.getAllByText('◈')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ChoiceCard.odds.test.tsx`
Expected: FAIL — no `autoSucceeds` prop; no tag rendered; accessible name lacks the odds phrase.

- [ ] **Step 3: Implement**

In `src/components/ChoicePanel/ChoiceCard.tsx`:

1. Add imports:

```tsx
import { computeCheckOdds, describeCheckOdds } from '../../engine/checkOdds';
import { resolveDC } from '../../engine/diceEngine';
import { CheckOddsTag } from '../shared';
```

2. Add `autoSucceeds` to `ChoiceCardProps`:

```tsx
  /** Whether an active auto-succeed ability guarantees this check (spec §2.2). */
  autoSucceeds?: boolean;
```

3. In the component params, destructure `autoSucceeds = false`.

4. After the existing `facultyTag` block, compute the odds ONLY for a real check:

```tsx
  const isCheck = choice.faculty != null && (choice.difficulty !== undefined || choice.dynamicDifficulty != null);
  const odds = isCheck && choice.faculty
    ? computeCheckOdds({
        faculty: choice.faculty,
        investigator,
        dc: resolveDC(choice, investigator),
        hasAdvantage,
        hasDisadvantage: false,
        autoSucceeds,
        partialCountsAsSuccess: false,
      })
    : null;
```

5. Compose the button accessible name — replace `aria-label={choice.text}` on the `<button>` with:

```tsx
      aria-label={odds ? `${choice.text}. ${describeCheckOdds(odds)}` : choice.text}
```

6. Render the decorative tag in the faculty-tag row. Replace the `{facultyTag && (...)}` block at the bottom with:

```tsx
      {(facultyTag || odds) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {facultyTag}
          {odds && <CheckOddsTag odds={odds} />}
        </div>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/ChoiceCard.odds.test.tsx`
Expected: PASS all three. Also run the existing ChoiceCard/ChoicePanel tests: `npx vitest run src/components/__tests__ -t ChoiceCard` — no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChoicePanel/ChoiceCard.tsx src/components/__tests__/ChoiceCard.odds.test.tsx
git commit -m "feat(ui): ChoiceCard pre-roll odds tag + accessible name (Phase 3 T5)"
```

---

## Task 6: Wire the parents — `ChoicePanel` + `EncounterPanel` (autoSucceeds prop + `dc` in results)

**Files:**
- Modify: `src/components/ChoicePanel/ChoicePanel.tsx`
- Modify: `src/components/EncounterPanel/EncounterPanel.tsx`
- Test: `src/components/__tests__/ChoicePanel.odds.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ChoicePanel.odds.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoicePanel } from '../ChoicePanel/ChoicePanel';
import { useStore } from '../../store';
import type { Choice } from '../../types';

// Uses the real store. Set an investigator + an active auto-succeed flag, then
// assert the card for a reason check shows Assured.
const reasonCheck: Choice = {
  id: 'c1', text: 'Deduce', faculty: 'reason', difficulty: 14,
  outcomes: { critical: 's', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
} as Choice;

describe('ChoicePanel — autoSucceeds plumbing', () => {
  it('renders Assured for a reason check when the auto-succeed flag is active', () => {
    useStore.setState({ flags: { 'ability-auto-succeed-reason': true } });
    render(<ChoicePanel choices={[reasonCheck]} />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
  });

  it('renders the Prospects band when no auto-succeed flag is set', () => {
    useStore.setState({ flags: {} });
    render(<ChoicePanel choices={[reasonCheck]} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
  });

  it('writes the DC into lastCheckResult when a check choice is selected (guards the dc wiring)', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    useStore.setState({ flags: {}, lastCheckResult: null });
    render(<ChoicePanel choices={[reasonCheck]} />);
    await userEvent.default.click(screen.getByRole('button', { name: /Deduce/ }));
    // Only assert the DC field — roll/tier are RNG. resolveDC(reasonCheck) === 14.
    expect(useStore.getState().lastCheckResult?.dc).toBe(14);
  });
});
```

> **Note for implementer:** confirm the store exposes `flags` and whether an investigator must be seeded for
> `ChoicePanel` to render (it reads `useStore(s => s.investigator)`). Seed a valid investigator + reset `flags`/
> `lastCheckResult` in `beforeEach`, mirroring existing ChoicePanel tests. Check `src/components/__tests__` for the
> established store-seeding/reset helper and reuse it. For the click test, use the repo's existing `user-event`
> import idiom (adjust the import above if the repo imports it differently).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ChoicePanel.odds.test.tsx`
Expected: FAIL — `ChoicePanel` doesn't pass `autoSucceeds`, so the flag has no effect / Assured not shown.

- [ ] **Step 3: Implement `ChoicePanel` changes**

In `src/components/ChoicePanel/ChoicePanel.tsx`:

1. Import the predicate + DC resolver:

```tsx
import { checkAutoSucceeds } from '../../engine/flags';
import { resolveDC } from '../../engine/diceEngine';
```

2. In the `visibleChoices.map`, pass `autoSucceeds` to `ChoiceCard`:

```tsx
        <ChoiceCard
          key={choice.id}
          choice={choice}
          investigator={investigator}
          revealedClueIds={revealedClueIds}
          deductionIds={deductionIds}
          hasAdvantage={computeAdvantage(choice, gameState)}
          autoSucceeds={choice.faculty ? checkAutoSucceeds(choice.faculty, gameState.flags) : false}
          onSelect={handleSelect}
        />
```

3. In `handleSelect`, pass the DC into the check result. Replace the `setCheckResult({...})` block (lines 78-83) with:

```tsx
        setCheckResult({
          roll: result.roll,
          modifier: result.modifier ?? 0,
          total: result.total ?? result.roll,
          tier: result.tier,
          dc: choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty != null)
            ? resolveDC(choice, currentState.investigator)
            : undefined,
        });
```

- [ ] **Step 4: Implement `EncounterPanel` changes**

In `src/components/EncounterPanel/EncounterPanel.tsx`:

1. Import `checkAutoSucceeds` + `resolveDC`:

```tsx
import { checkAutoSucceeds } from '../../engine/flags';
import { resolveDC } from '../../engine/diceEngine';
```

2. **Make flags reactive (Codex plan-review Minor).** The render body builds `gameState` via
`buildGameState(useStore.getState())` (line ~111), which is a non-reactive snapshot — a flag-only store update
(e.g. an ability activating mid-encounter) would NOT re-render the panel, so the memoized `ChoiceCard` would keep a
stale `autoSucceeds`. Subscribe to `flags` reactively. Add near the other `useStore` selectors (top of component):

```tsx
  const flags = useStore((s) => s.flags);
```

Then pass `autoSucceeds` from that reactive `flags` to each round-choice `ChoiceCard` (line 140-148 map):

```tsx
            autoSucceeds={choice.faculty ? checkAutoSucceeds(choice.faculty, flags) : false}
```

(Leave the `gameState = buildGameState(...)` for `getEncounterChoices`/`computeAdvantage` as-is; only the
`autoSucceeds` source must be the reactive `flags` selector.)

3. In `handleChoiceSelect`, add `dc` to the `setCheckResult` call (lines 86-93):

```tsx
      if (result.roll !== undefined && result.tier) {
        setCheckResult({
          roll: result.roll,
          modifier: result.modifier ?? 0,
          total: result.total ?? result.roll,
          tier: result.tier,
          dc: choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty != null)
            ? resolveDC(choice, gameState.investigator)
            : undefined,
        });
      }
```

(`gameState` is already built at the top of `handleChoiceSelect` — reuse it.)

- [ ] **Step 4b: Add an encounter round-choice test (Codex plan-review Major 5)**

`ChoicePanel`-only tests leave the `EncounterPanel` edits unexercised. Add `src/components/__tests__/EncounterPanel.odds.test.tsx` proving a round choice shows the tag and reflects a reactive flag update. Encounters use the real store + `startEncounter`; model it on the existing EncounterPanel tests (find them in `src/components/__tests__`):

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EncounterPanel } from '../EncounterPanel/EncounterPanel';
import { useStore } from '../../store';
import type { EncounterRound } from '../../types';

const rounds: EncounterRound[] = [
  {
    roundNumber: 1,
    // A round choice that is a real reason check.
    choices: [{ id: 'e1', text: 'Reason it out', faculty: 'reason', difficulty: 14,
      outcomes: { critical: 'w', success: 'w', partial: 'w', failure: 'l', fumble: 'l' } }],
  } as unknown as EncounterRound,
];

describe('EncounterPanel — round-choice odds', () => {
  beforeEach(() => {
    // Seed a valid investigator; mirror the existing EncounterPanel test setup.
    useStore.setState({ flags: {}, encounterState: null });
  });

  it('shows the Prospects tag on a round choice (transitive via ChoiceCard)', () => {
    render(<EncounterPanel sceneId="enc1" rounds={rounds} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
  });

  it('shows Assured when the auto-succeed flag is active for that faculty', () => {
    useStore.setState({ flags: { 'ability-auto-succeed-reason': true } });
    render(<EncounterPanel sceneId="enc2" rounds={rounds} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
  });
});
```

> **Implementer note:** confirm the `EncounterRound`/encounter fixture shape and the store seeding an encounter
> needs (investigator, and whatever `startEncounter` reads) against `src/engine/encounters.ts` + the existing
> EncounterPanel tests. If a supernatural reaction roll interferes, keep `isSupernatural={false}`. The two
> assertions above are the ones that stay RED if the `EncounterPanel` `autoSucceeds`/flags edits are skipped.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/ChoicePanel.odds.test.tsx src/components/__tests__/EncounterPanel.odds.test.tsx`
Expected: PASS all (incl. the click-level DC test and the encounter Assured test). Then existing panel tests:
`npx vitest run src/components/__tests__ -t ChoicePanel` and `-t Encounter` — no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChoicePanel/ChoicePanel.tsx src/components/EncounterPanel/EncounterPanel.tsx src/components/__tests__/ChoicePanel.odds.test.tsx src/components/__tests__/EncounterPanel.odds.test.tsx
git commit -m "feat(ui): plumb autoSucceeds + DC through ChoicePanel/EncounterPanel (Phase 3 T6)"
```

---

## Task 7: `SceneCluePrompts` — visible DC + tag (partialCountsAsSuccess) + `dc` to result

**Files:**
- Modify: `src/components/NarrativePanel/SceneCluePrompts.tsx`
- Modify: `src/components/NarrativePanel/NarrativePanel.tsx`
- Test: `src/components/__tests__/SceneCluePrompts.odds.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/SceneCluePrompts.odds.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SceneCluePrompts } from '../NarrativePanel/SceneCluePrompts';
import type { Clue, ClueDiscovery, GameState, Investigator } from '../../types';

function inv(): Investigator {
  return {
    name: 'T', archetype: 'deductionist',
    faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

const clue: Clue = { id: 'k1', title: 'Torn ledger', type: 'physical', isRevealed: false, status: 'unknown' } as Clue;
const disc: ClueDiscovery = { clueId: 'k1', method: 'check', requiresFaculty: { faculty: 'perception', minimum: 10 } } as ClueDiscovery;
const explore: ClueDiscovery = { clueId: 'k2', method: 'exploration' } as ClueDiscovery;
const exploreClue: Clue = { id: 'k2', title: 'Open drawer', type: 'physical', isRevealed: false, status: 'unknown' } as Clue;
const gs = { clues: {}, flags: {}, deductions: {}, investigator: inv() } as unknown as GameState;

describe('SceneCluePrompts — pre-roll odds', () => {
  it('surfaces the DC visibly and the band on a check prompt', () => {
    render(
      <SceneCluePrompts sceneId="s1" cluesAvailable={[disc]} clues={{ k1: clue }} gameState={gs}
        investigator={inv()} onClueDiscovered={() => {}} onCheckResult={() => {}} discoverClue={() => {}} />,
    );
    expect(screen.getByText(/DC 10/)).toBeInTheDocument();
    // partialCountsAsSuccess=true: perception mod 0, dc 10 → clue-discovery 70% → Favourable
    expect(screen.getByText(/Prospects:\s*Favourable/i)).toBeInTheDocument();
  });

  it('folds the odds phrase into the check button accessible name (Codex plan-review Minor)', () => {
    render(
      <SceneCluePrompts sceneId="s1" cluesAvailable={[disc]} clues={{ k1: clue }} gameState={gs}
        investigator={inv()} onClueDiscovered={() => {}} onCheckResult={() => {}} discoverClue={() => {}} />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAccessibleName(/Perception check/i);
    expect(btn).toHaveAccessibleName(/difficulty 10/i);
    expect(btn).toHaveAccessibleName(/prospects favourable/i);
  });

  it('leaves an exploration (non-check) prompt unchanged — no DC / Prospects', () => {
    render(
      <SceneCluePrompts sceneId="s1" cluesAvailable={[explore]} clues={{ k2: exploreClue }} gameState={gs}
        investigator={inv()} onClueDiscovered={() => {}} onCheckResult={() => {}} discoverClue={() => {}} />,
    );
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prospects/i)).not.toBeInTheDocument();
  });
});
```

> **Note for implementer:** confirm `Clue`/`ClueDiscovery`/`GameState` field names against `src/types/index.ts` and
> adjust fixtures (esp. `ClueDiscovery` for `exploration` — it may not need `requiresFaculty`). The band expectation
> depends on `partialCountsAsSuccess: true` and perception being mod 0; recompute if the fixture differs.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/SceneCluePrompts.odds.test.tsx`
Expected: FAIL — DC not visible / band tag absent.

- [ ] **Step 3: Implement `SceneCluePrompts` changes**

In `src/components/NarrativePanel/SceneCluePrompts.tsx`:

1. Import the odds helpers + tag:

```tsx
import { computeCheckOdds, describeCheckOdds } from '../../engine/checkOdds';
import { CheckOddsTag } from '../shared';
```

2. Inside the `prompts.map`, in the `d.method === 'check' && d.requiresFaculty` branch (the block that currently renders the `<button>` with `aria-label={`Examine: ${FACULTY_DISPLAY[faculty]} check, DC ${minimum}`}`), compute odds before the return:

```tsx
          const odds = computeCheckOdds({
            faculty,
            investigator,
            dc: minimum,
            hasAdvantage: false,
            hasDisadvantage: false,
            // autoSucceeds is HARD false here (spec §4.2, Codex plan-review Major 1):
            // handleCheck calls performCheck directly and does NOT honor/consume the
            // auto-succeed ability, so an "Assured" tag would lie. Do NOT read the flag.
            autoSucceeds: false,
            partialCountsAsSuccess: true,
          });
```

3. Change the button `aria-label` to fold in the odds phrase and render the decorative tag alongside the existing proficiency chip. Replace the button `aria-label` with:

```tsx
              aria-label={`Examine: ${describeCheckOdds(odds)}`}
```

and after the existing proficiency `<span className={...PROFICIENCY_STYLES[tier]...}>` add:

```tsx
              <CheckOddsTag odds={odds} />
```

- [ ] **Step 4: Implement `NarrativePanel` change (thread `dc`)**

In `src/components/NarrativePanel/NarrativePanel.tsx`, the `onCheckResult` callback currently drops the DC. `SceneCluePrompts.handleCheck` must forward the DC. Two sub-edits:

(a) In `SceneCluePrompts.tsx` `handleCheck`, extend the `onCheckResult` call to include `dc`:

Change:
```tsx
    onCheckResult({ roll: result.roll, modifier: result.modifier, total: result.total, tier: result.tier });
```
to:
```tsx
    onCheckResult({ roll: result.roll, modifier: result.modifier, total: result.total, tier: result.tier, dc });
```

(b) Widen the `onCheckResult` prop type in `SceneCluePromptsProps`:

```tsx
  onCheckResult: (result: { roll: number; modifier: number; total: number; tier: string; dc?: number }) => void;
```

(c) In `NarrativePanel.tsx`, update `handleCheckResult` to pass `dc` through:

Change the signature + body of `handleCheckResult` (lines 100-107):
```tsx
  function handleCheckResult(result: { roll: number; modifier: number; total: number; tier: string; dc?: number }) {
    setCheckResult({
      roll: result.roll,
      modifier: result.modifier,
      total: result.total,
      tier: result.tier as import('../../types').OutcomeTier,
      dc: result.dc,
    });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/SceneCluePrompts.odds.test.tsx`
Expected: PASS. Then `npx vitest run src/components/__tests__ -t SceneCluePrompts` and `-t NarrativePanel` — no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/NarrativePanel/SceneCluePrompts.tsx src/components/NarrativePanel/NarrativePanel.tsx src/components/__tests__/SceneCluePrompts.odds.test.tsx
git commit -m "feat(ui): clue-prompt DC + prospects (partial counts) + dc to overlay (Phase 3 T7)"
```

---

## Task 8: Full-suite verification, docs, spine

**Files:**
- Modify: `docs/status.md` (test baseline)
- Modify: `CLAUDE.md` (dice-legibility note, if the Architectural Warnings need it), `docs/architecture.md` / `docs/engine-reference.md` (add `checkOdds` module + `CheckResult.dc`)
- (Spine update handled by `/checkpoint` at session end, not here.)

- [ ] **Step 1: Run the full gate**

```bash
npm run lint
node scripts/validateCase.mjs
npm run test:run
npm run build
```
Expected: lint clean; validator 8 cases clean; tests all green (baseline 684 + the new tests); build green (incl. `typecheck:scripts`). Record the new test/file count.

- [ ] **Step 2: Update `docs/engine-reference.md`**

Add a `checkOdds` entry documenting `computeCheckOdds` (pure; inputs incl. `partialCountsAsSuccess`, `autoSucceeds`; returns band + fields) and `describeCheckOdds`; note `checkAutoSucceeds` in `flags`. Add `CheckResult.dc?` to the narrative-slice/save notes with "transient, not persisted, no migration."

- [ ] **Step 3: Update `docs/architecture.md`**

Add `checkOdds` to the engine module list and `src/components/shared/CheckOddsTag` to the component hierarchy. Note that `ChoiceCard` is shared by `ChoicePanel` + `EncounterPanel` (so the odds tag reaches encounter round choices transitively; reaction checks are out of scope).

- [ ] **Step 4: Update `docs/status.md`**

Bump the test baseline (e.g. `684/64 → <new>`).

- [ ] **Step 5: Commit docs**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: Phase 3 dice-legibility — engine-reference/architecture/status (Phase 3 T8)"
```

---

## Post-plan gates (not tasks — process)

1. **Internal whole-branch review** (in-session subagent) per `superpowers:requesting-code-review`.
2. **Live browser verify** (Playwright): DC + Prospects band visible on a choice, a clue prompt, and an encounter round choice; `vs DC` in the roll overlay; Assured on an auto-succeed check; screen-reader name folds in the odds phrase; zero console errors.
3. **File-based Codex impl pass** (ADR-0013): prompt to `codex/input/2026-07-16-phase3-dice-legibility-impl.md`, review to `codex/output/...-impl-review.md`; fold all valid findings.
4. **PR** (merge commit, never squash); `Closes` the relevant tracking item if one exists.

---

## Self-review notes (spec coverage)

- Spec §2.1 helper → T2. §2.2 predicate → T1. §2.3 tag + accessible-name → T4/T5/T7. §2.4 store `dc` → T3.
- §3 band math incl. `partialCountsAsSuccess` → T2. §4.1 ChoiceCard + guard → T5. §4.2 clue prompts → T7. §4.3 encounter scope (transitive; reaction out) → T5 (transitive) + T6 (dc). §4.4 a11y → T5/T7 accessible-name tests. §5 overlay `dc` → T3.
- §6 testing: engine T2, flags T1, components T4–T7. §7 edge cases covered across T2 (clamp/partial/autoSucceeds), T5 (faculty-only guard), T6 (autoSucceeds plumbing).
- All **spec-review** findings mapped: Major1→T1/T2/T5/T6; Major2→T2/T7; Major3→T4/T5/T7; Major4→T5/T6 (+ spec scope); Minor5→T5.
- All **plan-review** findings folded: Major (clue-prompt Assured lie)→T7 `autoSucceeds:false` + spec §4.2; Major (DC never reached overlay)→T3 Step 5 render-call wiring + NarrativePanel integration test; Major (`detective` archetype/invalid fixtures)→T2/T5/T7 use `deductionist` + valid `Investigator` (no `maxComposure`/`maxVitality`, `abilityUsed:false`, no `null` `lastCriticalFaculty`); Major (weak clamp/boundary tests)→T2 exact .65/.35 boundaries + clamp-flip guards; Major (Task 6 vacuous GREEN)→T6 click-level `lastCheckResult.dc` test + EncounterPanel.odds test; Minor (non-reactive encounter flags)→T6 Step 4 `useStore(s=>s.flags)` selector; Minor (Task 1 glob abort)→T1 direct resolver test + exact paths; Minor (dropped "Prospects:" + duplicate glyph)→T4 literal label + no tag glyph + T5 one-glyph assertion; Minor (missing clue-prompt accessible name)→T7 button accessible-name + exploration-unchanged assertions.
