# Phase 5 — Choice-Gating Content Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give content authors a `visibility` / `gateReason` vocabulary so a gated choice can be shown **disabled-with-a-reason** instead of hard-hidden, backward-compatible with the 8 shipped cases.

**Architecture:** A new pure engine module `choiceVisibility.ts` (`choiceGateConditions` + `resolveChoiceVisibility`) becomes the single source of truth, replacing the two hand-rolled gate-builders in `ChoicePanel` and `encounters.ts`. The validator gains 5 errors + 1 warning. `ChoicePanel`/`EncounterPanel` render `disabled` choices via a shared non-interactive `LockedChoice` component. One shipped choice is converted as a live demo.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest 4 + React Testing Library, the existing `evaluateConditions` engine.

**Spec:** [`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md`](../specs/2026-07-17-phase5-choice-gating-design.md) (Codex-reviewed, 7 findings folded).

**Branch:** `feat/phase5-choice-gating` (already created).

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `src/types/index.ts` | Add `visibility` + `gateReason` to `Choice` | T1 |
| `src/engine/choiceVisibility.ts` (new) | Pure `choiceGateConditions` + `resolveChoiceVisibility` | T2 |
| `src/engine/__tests__/choiceVisibility.test.ts` (new) | Unit tests for the resolver | T2 |
| `src/engine/narrativeEngine.ts` | Re-export the new module from the barrel | T2 |
| `src/engine/contentValidation.ts` | `warnings` in `Ctx`; 5 errors + 1 warning in `validateChoice` | T3 |
| `src/engine/__tests__/contentValidation.*.test.ts` | Validator rule tests | T3 |
| `src/components/shared/LockedChoice.tsx` (new) | Non-interactive disabled-choice element | T4 |
| `src/components/shared/index.ts` | Export `LockedChoice` | T4 |
| `src/components/ChoicePanel/ChoicePanel.tsx` | Consume resolver; render `nav` + locked `ul` | T5 |
| `src/components/ChoicePanel/index.ts` | Remove stale `isChoiceVisible` re-export | T5 |
| `src/engine/encounters.ts` | `getEncounterChoices` uses `choiceGateConditions`; escape rule preserved | T6 |
| `src/components/EncounterPanel/EncounterPanel.tsx` | Render `nav` + locked `ul` | T6 |
| `public/content/**` (one case) | Demo: convert one gated choice to `disabled` | T7 |
| `docs/content-authoring.md`, `docs/engine-reference.md`, `docs/architecture.md` | Authoring rules + module docs | T8 |

---

## Task 1: Schema — add `visibility` + `gateReason` to `Choice`

**Files:**
- Modify: `src/types/index.ts` (the `Choice` interface, ~line 203-232)

- [ ] **Step 1: Add the two fields with doc comments**

In `src/types/index.ts`, inside `export interface Choice { ... }`, after the existing `requiresFaculty` field (line 219), add:

```ts
  /**
   * Governs what happens when this choice's requires* gates are UNMET.
   * - 'hidden'  (default when absent): filtered out — the option is not shown at all.
   * - 'disabled': rendered greyed & non-interactive, with gateReason explaining why.
   * - 'shown':   rendered normal & interactive despite unmet gates (soft-gate escape hatch).
   * No effect when the gates are MET, when the choice has no requires* gate, or on
   * isEscapePath choices (which the validator forbids from setting it).
   */
  visibility?: 'shown' | 'hidden' | 'disabled';
  /** Diegetic explanation shown when the choice is in the resolved disabled state. Required iff visibility === 'disabled'. */
  gateReason?: string;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build 2>&1 | tail -20`
Expected: no new TS errors (the fields are optional; nothing references them yet).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add Choice.visibility + gateReason fields (Phase 5)"
```

---

## Task 2: Engine resolver `choiceVisibility.ts` (the shared pure unit)

**Files:**
- Create: `src/engine/choiceVisibility.ts`
- Create: `src/engine/__tests__/choiceVisibility.test.ts`
- Modify: `src/engine/narrativeEngine.ts` (barrel export)

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/choiceVisibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { choiceGateConditions, resolveChoiceVisibility } from '../choiceVisibility';
import type { Choice, GameState } from '../../types';

// Minimal GameState stub: only the fields evaluateConditions reads for these gates.
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      archetype: 'detective',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    },
    clues: {},
    deductions: {},
    flags: {},
    npcs: {},
    factionReputation: {},
    ...overrides,
  } as unknown as GameState;
}

function choice(over: Partial<Choice> = {}): Choice {
  return { id: 'c1', text: 'do it', outcomes: { success: 'sceneA' } as Choice['outcomes'], ...over };
}

describe('choiceGateConditions', () => {
  it('returns [] when no requires* field is set', () => {
    expect(choiceGateConditions(choice())).toEqual([]);
  });

  it('builds one condition per truthy requires* field', () => {
    const c = choice({
      requiresClue: 'clue-1',
      requiresDeduction: 'ded-1',
      requiresFlag: 'flag-1',
      requiresFaculty: { faculty: 'reason', minimum: 12 },
    });
    expect(choiceGateConditions(c)).toEqual([
      { type: 'hasClue', target: 'clue-1' },
      { type: 'hasDeduction', target: 'ded-1' },
      { type: 'hasFlag', target: 'flag-1' },
      { type: 'facultyMin', target: 'reason', value: 12 },
    ]);
  });

  it('treats an empty-string requires* as ungated (backward-compat, Codex Major 3)', () => {
    expect(choiceGateConditions(choice({ requiresFlag: '' }))).toEqual([]);
    expect(choiceGateConditions(choice({ requiresClue: '' }))).toEqual([]);
  });
});

describe('resolveChoiceVisibility', () => {
  const state = makeState();

  it('is shown when there is no gate, regardless of visibility', () => {
    expect(resolveChoiceVisibility(choice(), state)).toBe('shown');
    expect(resolveChoiceVisibility(choice({ visibility: 'disabled' }), state)).toBe('shown');
  });

  it('is shown when the gate is met', () => {
    const withClue = makeState({ clues: { 'clue-1': { id: 'clue-1', isRevealed: true } } as unknown as GameState['clues'] });
    expect(resolveChoiceVisibility(choice({ requiresClue: 'clue-1' }), withClue)).toBe('shown');
  });

  it('is hidden when the gate is unmet and visibility is absent (today default)', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing' }), state)).toBe('hidden');
  });

  it('is hidden when the gate is unmet and visibility === "hidden"', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing', visibility: 'hidden' }), state)).toBe('hidden');
  });

  it('is disabled when the gate is unmet and visibility === "disabled"', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing', visibility: 'disabled', gateReason: 'r' }), state)).toBe('disabled');
  });

  it('is shown when the gate is unmet and visibility === "shown" (soft-gate)', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing', visibility: 'shown' }), state)).toBe('shown');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- choiceVisibility 2>&1 | tail -15`
Expected: FAIL — "Failed to resolve import '../choiceVisibility'".

- [ ] **Step 3: Write the module**

Create `src/engine/choiceVisibility.ts`:

```ts
/**
 * choiceVisibility — the single source of truth for whether a Choice is shown,
 * shown-but-disabled (with a gateReason), or hidden, given the current game state.
 *
 * Pure + RNG-free. Imports evaluateConditions directly from ./conditions (NOT via
 * the narrativeEngine barrel — that would create a barrel cycle; Phase 5 spec §4).
 *
 * `visibility` governs ONLY the unmet-gate case:
 *   - no gate, or gate met            -> 'shown'
 *   - gate unmet + 'disabled'         -> 'disabled'
 *   - gate unmet + 'shown'            -> 'shown'   (soft-gate escape hatch)
 *   - gate unmet + 'hidden'/absent    -> 'hidden'  (today's default)
 *
 * A choice "has a gate" iff choiceGateConditions(choice).length > 0. Conditions are
 * built ONLY for truthy requires* fields — matching the two former callers — so a
 * malformed requiresFlag:'' stays ungated and shown (backward-compat; spec §3).
 */
import { evaluateConditions } from './conditions';
import type { Choice, Condition, GameState } from '../types';

export type ChoiceVisibilityState = 'shown' | 'disabled' | 'hidden';

/** Builds the requires* -> Condition[] list. Single source of truth for choice gating. */
export function choiceGateConditions(choice: Choice): Condition[] {
  const conditions: Condition[] = [];
  if (choice.requiresClue) {
    conditions.push({ type: 'hasClue', target: choice.requiresClue });
  }
  if (choice.requiresDeduction) {
    conditions.push({ type: 'hasDeduction', target: choice.requiresDeduction });
  }
  if (choice.requiresFlag) {
    conditions.push({ type: 'hasFlag', target: choice.requiresFlag });
  }
  if (choice.requiresFaculty) {
    conditions.push({
      type: 'facultyMin',
      target: choice.requiresFaculty.faculty,
      value: choice.requiresFaculty.minimum,
    });
  }
  return conditions;
}

/** The resolved visibility state for a choice given current game state. */
export function resolveChoiceVisibility(choice: Choice, state: GameState): ChoiceVisibilityState {
  const conditions = choiceGateConditions(choice);
  if (conditions.length === 0 || evaluateConditions(conditions, state)) {
    return 'shown';
  }
  // Gate is unmet.
  if (choice.visibility === 'disabled') return 'disabled';
  if (choice.visibility === 'shown') return 'shown';
  return 'hidden';
}
```

- [ ] **Step 4: Add the barrel export**

In `src/engine/narrativeEngine.ts`, after the existing `export * from './encounters';` line, add:

```ts
export * from './choiceVisibility';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- choiceVisibility 2>&1 | tail -15`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add src/engine/choiceVisibility.ts src/engine/__tests__/choiceVisibility.test.ts src/engine/narrativeEngine.ts
git commit -m "feat(engine): pure choiceVisibility resolver + gate-conditions builder (Phase 5)"
```

---

## Task 3: Validator rules (5 errors + 1 warning)

**Files:**
- Modify: `src/engine/contentValidation.ts` (`Ctx` at ~line 44-53, ctx build at ~line 100, `validateChoice` at ~line 353)
- Create/Modify test: `src/engine/__tests__/contentValidation.choiceGating.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/contentValidation.choiceGating.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateBundle } from '../contentValidation';
import type { ContentBundle, Choice, SceneNode } from '../../types';

// Build a minimal bundle with one scene holding the given choice.
function bundleWithChoice(choice: Choice): ContentBundle {
  const scene: SceneNode = {
    id: 'scene-a',
    text: 'x',
    choices: [choice],
  } as unknown as SceneNode;
  return {
    firstScene: 'scene-a',
    scenes: [scene],
    variants: [],
    clues: [{ id: 'clue-1' } as never],
    npcs: [],
    recipes: [],
    sharedSceneIds: [],
  } as unknown as ContentBundle;
}

function baseChoice(over: Partial<Choice> = {}): Choice {
  return { id: 'c1', text: 't', outcomes: { success: 'scene-a' } as Choice['outcomes'], ...over };
}

const errorsOf = (c: Choice) => validateBundle(bundleWithChoice(c)).errors.filter((e) => e.includes('"c1"'));
const warningsOf = (c: Choice) => validateBundle(bundleWithChoice(c)).warnings.filter((w) => w.includes('"c1"'));

describe('choice-gating validation', () => {
  it('error: disabled without a gateReason', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'disabled' }));
    expect(errs.some((e) => /disabled but has no gateReason/.test(e))).toBe(true);
  });

  it('error: gateReason present but not disabled', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', gateReason: 'r' }));
    expect(errs.some((e) => /gateReason but is not disabled/.test(e))).toBe(true);
  });

  it('treats a whitespace-only gateReason as absent (disabled -> still errors as no reason)', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: '   ' }));
    expect(errs.some((e) => /disabled but has no gateReason/.test(e))).toBe(true);
  });

  it('error: disabled/shown on an ungated choice', () => {
    expect(errorsOf(baseChoice({ visibility: 'disabled', gateReason: 'r' })).some((e) => /no requires\* gate/.test(e))).toBe(true);
    expect(errorsOf(baseChoice({ visibility: 'shown' })).some((e) => /no requires\* gate/.test(e))).toBe(true);
  });

  it('allows explicit hidden on an ungated choice (documented no-op)', () => {
    expect(errorsOf(baseChoice({ visibility: 'hidden' }))).toEqual([]);
  });

  it('error: unknown visibility value', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'nope' as never }));
    expect(errs.some((e) => /invalid visibility/.test(e))).toBe(true);
  });

  it('error: escape-path choice sets visibility/gateReason', () => {
    const errs = errorsOf(baseChoice({ requiresFlag: 'f', isEscapePath: true, visibility: 'disabled', gateReason: 'r' }));
    expect(errs.some((e) => /escape-path choice .* may not set/.test(e))).toBe(true);
  });

  it('warning (not error): shown on a gated choice', () => {
    const c = baseChoice({ requiresClue: 'clue-1', visibility: 'shown' });
    expect(errorsOf(c).some((e) => /shown despite a gate/.test(e))).toBe(false);
    expect(warningsOf(c).some((w) => /shown despite a gate/.test(w))).toBe(true);
  });

  it('a valid disabled choice with a real gateReason produces no gating error', () => {
    const c = baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'The lock holds fast.' });
    const gating = errorsOf(c).filter((e) => /visibility|gateReason|gate/.test(e));
    expect(gating).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- contentValidation.choiceGating 2>&1 | tail -20`
Expected: FAIL (no rules yet; several assertions fail, `warnings` filter finds nothing).

- [ ] **Step 3: Thread `warnings` into `Ctx`**

In `src/engine/contentValidation.ts`:

Add to the `Ctx` interface (after `errors: string[];`, ~line 320):

```ts
  warnings: string[];
```

Update the ctx construction (~line 100) from:

```ts
  const ctx: Ctx = { edgeTargetIds, clueIds, npcIds, recipeIds, errors };
```

to:

```ts
  const ctx: Ctx = { edgeTargetIds, clueIds, npcIds, recipeIds, errors, warnings };
```

- [ ] **Step 4: Add a shared gate-predicate import + the rules to `validateChoice`**

At the top of `src/engine/contentValidation.ts`, add to the engine imports:

```ts
import { choiceGateConditions } from './choiceVisibility';
```

Inside `validateChoice`, after the existing `npcEffect` check and BEFORE the `worseAlternative` recursion (~line 399), add:

```ts
  // ── Phase 5: choice-gating vocabulary ──
  const VISIBILITY_VALUES = ['shown', 'hidden', 'disabled'];
  const hasGate = choiceGateConditions(choice).length > 0;
  const reasonPresent = choice.gateReason !== undefined;
  const reasonNonEmpty = typeof choice.gateReason === 'string' && choice.gateReason.trim().length > 0;

  if (choice.visibility !== undefined && !VISIBILITY_VALUES.includes(choice.visibility)) {
    ctx.errors.push(`${at} -> invalid visibility "${choice.visibility}" (expected shown | hidden | disabled)`);
  }

  if (choice.isEscapePath && (choice.visibility === 'disabled' || choice.visibility === 'shown' || reasonPresent)) {
    // Escape paths are out of the vocabulary's scope (spec §4.1); they stay hard-gated.
    ctx.errors.push(`${at} -> escape-path choice "${choice.id}" may not set visibility/gateReason`);
  } else {
    // Rule 1: disabled requires a non-empty gateReason.
    if (choice.visibility === 'disabled' && !reasonNonEmpty) {
      ctx.errors.push(`${at} -> is disabled but has no gateReason`);
    }
    // Rule 2: a gateReason is only allowed when disabled.
    if (reasonPresent && choice.visibility !== 'disabled') {
      ctx.errors.push(`${at} -> has a gateReason but is not disabled — the reason will never render`);
    }
    // Rule 3: disabled/shown are meaningless on an ungated choice (explicit hidden is an allowed no-op).
    if (!hasGate && (choice.visibility === 'disabled' || choice.visibility === 'shown')) {
      ctx.errors.push(`${at} -> sets visibility "${choice.visibility}" but has no requires* gate to act on`);
    }
    // Rule 6 (warning): shown on a gated choice is a legal-but-suspect soft-gate.
    if (hasGate && choice.visibility === 'shown') {
      ctx.warnings.push(`${at} -> is shown despite a gate — the gate will not hide or disable it`);
    }
  }
```

Note: the escape-path branch is exclusive so an escape choice reports only the scope error, not the derived rule-1/3 errors.

- [ ] **Step 5: Update the `validateBundle` doc comment**

Change the comment at ~line 77-78 from:

```ts
 * Validates a content bundle. Structural defects are `errors`; reachability
 * observations (opt-in) are `warnings`.
```

to:

```ts
 * Validates a content bundle. Structural defects are `errors`; non-fatal
 * observations are `warnings` — the opt-in reachability checks plus the
 * always-on choice-gating soft-gate warning (Phase 5).
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- contentValidation.choiceGating 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 7: Run the full validator on shipped content (regression)**

Run: `node scripts/validateCase.mjs 2>&1 | tail -10`
Expected: 8 cases, zero errors (the shipped cases set no `visibility`, so no new errors). Warnings from shipped content should be zero (no shipped choice uses `visibility: 'shown'`).

- [ ] **Step 8: Commit**

```bash
git add src/engine/contentValidation.ts src/engine/__tests__/contentValidation.choiceGating.test.ts
git commit -m "feat(validator): choice-gating rules — 5 errors + soft-gate warning, warnings in Ctx (Phase 5)"
```

---

## Task 4: `LockedChoice` shared component (disabled-choice rendering)

**Files:**
- Create: `src/components/shared/LockedChoice.tsx`
- Modify: `src/components/shared/index.ts`
- Create test: `src/components/__tests__/LockedChoice.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/LockedChoice.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LockedChoice } from '../shared';

describe('LockedChoice', () => {
  it('renders the choice text and the gateReason as visible prose', () => {
    render(<LockedChoice text="Force the door" gateReason="The lock holds fast." />);
    expect(screen.getByText('Force the door')).toBeInTheDocument();
    expect(screen.getByText('The lock holds fast.')).toBeInTheDocument();
  });

  it('is not a button and exposes no interactive role', () => {
    render(<LockedChoice text="Force the door" gateReason="Locked." />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders as a listitem (for placement inside the locked <ul>)', () => {
    render(
      <ul>
        <LockedChoice text="Force the door" gateReason="Locked." />
      </ul>,
    );
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- LockedChoice 2>&1 | tail -15`
Expected: FAIL — "does not provide an export named 'LockedChoice'".

- [ ] **Step 3: Write the component**

Create `src/components/shared/LockedChoice.tsx`:

```tsx
/**
 * LockedChoice — a disabled, non-interactive choice (Phase 5). Renders a gated
 * choice the author chose to SHOW rather than hide, greyed out with a diegetic
 * gateReason. Redundant cues (icon + text + colour, per G2). Static — no live region.
 *
 * Rendered as an <li> so it lives inside a proper locked-choices <ul>, OUTSIDE the
 * interactive "Available choices" <nav> (Phase 5 spec §6). Not focusable, not a button.
 */
export interface LockedChoiceProps {
  text: string;
  gateReason: string;
}

export function LockedChoice({ text, gateReason }: LockedChoiceProps) {
  return (
    <li className="w-full px-4 py-3 rounded-lg border border-stone-700/40 bg-gaslight-ink/30 opacity-60">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-stone-400 text-sm mt-0.5">🔒</span>
        <div className="flex-1">
          <span className="text-stone-400 font-serif leading-snug line-through decoration-stone-600/50">
            {text}
          </span>
          <p className="mt-1 text-xs text-stone-500 italic font-serif not-italic">{gateReason}</p>
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Export from the shared barrel**

In `src/components/shared/index.ts`, add:

```ts
export { LockedChoice } from './LockedChoice';
export type { LockedChoiceProps } from './LockedChoice';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- LockedChoice 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/LockedChoice.tsx src/components/shared/index.ts src/components/__tests__/LockedChoice.test.tsx
git commit -m "feat(ui): LockedChoice — non-interactive disabled-choice element (Phase 5)"
```

---

## Task 5: `ChoicePanel` consumes the resolver + renders the locked group

**Files:**
- Modify: `src/components/ChoicePanel/ChoicePanel.tsx`
- Modify: `src/components/ChoicePanel/index.ts`
- Modify test: `src/components/__tests__/ChoicePanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/__tests__/ChoicePanel.test.tsx` (import `render`, `screen` from RTL and the store as the existing tests do — match the file's existing setup helpers). Add a describe block:

```tsx
describe('Phase 5 — disabled choices', () => {
  it('renders a disabled choice greyed & non-interactive with its reason, in a list', () => {
    // A gated choice with visibility 'disabled' whose gate is unmet.
    const choices = [
      { id: 'open', text: 'Open ledger', outcomes: { success: 's2' } },
      { id: 'force', text: 'Force the safe', requiresClue: 'missing-clue',
        visibility: 'disabled', gateReason: 'You would need the key first.',
        outcomes: { success: 's3' } },
    ] as unknown as import('../../types').Choice[];

    render(<ChoicePanel choices={choices} />);

    // Interactive choice is a button; disabled one is not.
    expect(screen.getByRole('button', { name: /Open ledger/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Force the safe/ })).toBeNull();
    // Reason visible; rendered in a listitem.
    expect(screen.getByText('You would need the key first.')).toBeInTheDocument();
    expect(screen.getByText('Force the safe')).toBeInTheDocument();
  });

  it('still hides a gated choice with default (absent) visibility', () => {
    const choices = [
      { id: 'open', text: 'Open ledger', outcomes: { success: 's2' } },
      { id: 'secret', text: 'Secret path', requiresClue: 'missing-clue', outcomes: { success: 's3' } },
    ] as unknown as import('../../types').Choice[];
    render(<ChoicePanel choices={choices} />);
    expect(screen.queryByText('Secret path')).toBeNull();
  });
});
```

(If the existing test file seeds a store with a loaded case, reuse that harness; the two choices above need no clue in the store so `missing-clue` stays unmet.)

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- ChoicePanel 2>&1 | tail -20`
Expected: FAIL — the disabled choice is currently filtered out entirely (no reason text, `Force the safe` absent).

- [ ] **Step 3: Rewrite the render path to use the resolver**

In `src/components/ChoicePanel/ChoicePanel.tsx`:

Replace the import of the local helper usage. Remove the `isChoiceVisible` function (lines ~20-47) and its use. Add at the top imports:

```ts
import { resolveChoiceVisibility } from '../../engine/choiceVisibility';
import { LockedChoice } from '../shared';
```

Replace:

```ts
  const visibleChoices = choices.filter((c) => isChoiceVisible(c, gameState));
```

with:

```ts
  const shownChoices: Choice[] = [];
  const lockedChoices: Choice[] = [];
  for (const c of choices) {
    const state = resolveChoiceVisibility(c, gameState);
    if (state === 'shown') shownChoices.push(c);
    else if (state === 'disabled') lockedChoices.push(c);
    // 'hidden' -> dropped
  }
```

Replace the early return and the JSX:

```ts
  if (visibleChoices.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Available choices"
      className="flex flex-col gap-2 p-4 max-w-2xl mx-auto w-full"
    >
      {visibleChoices.map((choice) => (
        <ChoiceCard
          ...
        />
      ))}
    </nav>
  );
```

with:

```ts
  if (shownChoices.length === 0 && lockedChoices.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 p-4 max-w-2xl mx-auto w-full">
      {shownChoices.length > 0 && (
        <nav aria-label="Available choices" className="flex flex-col gap-2">
          {shownChoices.map((choice) => (
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
          ))}
        </nav>
      )}
      {lockedChoices.length > 0 && (
        <ul aria-label="Locked choices" className="flex flex-col gap-2 list-none">
          {lockedChoices.map((choice) => (
            <LockedChoice key={choice.id} text={choice.text} gateReason={choice.gateReason ?? ''} />
          ))}
        </ul>
      )}
    </section>
  );
```

- [ ] **Step 4: Remove the stale re-export**

In `src/components/ChoicePanel/index.ts`, delete the line:

```ts
export { isChoiceVisible } from './ChoicePanel';
```

- [ ] **Step 5: Fix any other `isChoiceVisible` importers**

Run: `grep -rn "isChoiceVisible" src/`
Expected after edits: only test files (if any). Migrate any remaining test that imported `isChoiceVisible` to call `resolveChoiceVisibility` from `../../engine/choiceVisibility` and assert `=== 'shown'` / `'hidden'`. If none remain, skip.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- ChoicePanel 2>&1 | tail -20`
Expected: PASS (both new tests + existing ChoicePanel tests still green).

- [ ] **Step 7: Commit**

```bash
git add src/components/ChoicePanel/
git commit -m "feat(ui): ChoicePanel renders disabled choices via resolver + locked <ul> (Phase 5)"
```

---

## Task 6: Encounter path — resolver + escape rule preserved

**Files:**
- Modify: `src/engine/encounters.ts` (`getEncounterChoices`, ~line 185-224)
- Modify: `src/components/EncounterPanel/EncounterPanel.tsx` (render, ~line 145-159)
- Modify test: `src/engine/__tests__/encounterSystem.test.ts` (the existing `getEncounterChoices` test file).

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/encounterSystem.test.ts` (reuse its existing state/round builders). Add:

```ts
import { getEncounterChoices } from '../encounters';
// (reuse the file's existing GameState/EncounterRound builders)

describe('getEncounterChoices — Phase 5 visibility', () => {
  it('includes a non-escape disabled choice (gate unmet, visibility disabled)', () => {
    const round = { roundNumber: 1, isSupernatural: false, choices: [
      { id: 'a', text: 'fight', outcomes: { success: 's' } },
      { id: 'b', text: 'ritual', requiresClue: 'missing', visibility: 'disabled', gateReason: 'r', outcomes: { success: 's' } },
    ]} as never;
    const state = /* state with no clues */ makeEmptyState();
    const ids = getEncounterChoices(round, state).map((c) => c.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b'); // disabled, but returned so the panel can grey it
  });

  it('keeps an escape path hard-gated (excluded when its gate is unmet)', () => {
    const round = { roundNumber: 1, isSupernatural: false, choices: [
      { id: 'esc', text: 'flee', isEscapePath: true, requiresFlag: 'has-exit', outcomes: { success: 's' } },
    ]} as never;
    const state = makeEmptyState(); // has-exit not set
    expect(getEncounterChoices(round, state).map((c) => c.id)).not.toContain('esc');
  });
});
```

(Adapt `makeEmptyState` to the test file's existing helper.)

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- encounters 2>&1 | tail -20`
Expected: FAIL — the disabled choice `b` is currently dropped (unmet gate → excluded).

- [ ] **Step 3: Rewrite `getEncounterChoices`**

In `src/engine/encounters.ts`, replace the body of `getEncounterChoices` (the loop building `conditions` inline) with a version using the shared helpers:

```ts
export function getEncounterChoices(
  round: EncounterRound,
  state: GameState,
): Choice[] {
  const filtered: Choice[] = [];

  for (const choice of round.choices) {
    if (choice.isEscapePath) {
      // Escape paths stay hard-gated (spec §4.1): included only when their gate
      // is met, never disabled.
      const conditions = choiceGateConditions(choice);
      if (evaluateConditions(conditions, state)) filtered.push(choice);
      continue;
    }

    // Non-escape: include when shown OR disabled (the panel greys disabled ones).
    const visibility = resolveChoiceVisibility(choice, state);
    if (visibility === 'shown' || visibility === 'disabled') {
      filtered.push(choice);
    }
  }

  return filtered;
}
```

Add the imports at the top of `encounters.ts` if not already present:

```ts
import { choiceGateConditions, resolveChoiceVisibility } from './choiceVisibility';
```

(`evaluateConditions` is already imported in this file; confirm with `grep -n "evaluateConditions" src/engine/encounters.ts`.)

- [ ] **Step 4: Render the locked group in EncounterPanel**

In `src/components/EncounterPanel/EncounterPanel.tsx`, add imports:

```ts
import { resolveChoiceVisibility } from '../../engine/choiceVisibility';
import { LockedChoice } from '../shared';
```

Replace the choices block (the single `<nav aria-label="Encounter choices">` mapping `availableChoices`, ~line 146-159). First partition:

```ts
  const shownChoices = availableChoices.filter((c) => resolveChoiceVisibility(c, gameState) === 'shown');
  const lockedChoices = availableChoices.filter((c) => resolveChoiceVisibility(c, gameState) === 'disabled');
```

Then render:

```tsx
      {shownChoices.length > 0 && (
        <nav aria-label="Encounter choices" className="flex flex-col gap-2">
          {shownChoices.map((choice) => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              investigator={investigator}
              revealedClueIds={revealedClueIds}
              deductionIds={deductionIds}
              hasAdvantage={computeAdvantage(choice, gameState)}
              autoSucceeds={choice.faculty ? checkAutoSucceeds(choice.faculty, flags) : false}
              onSelect={handleChoiceSelect}
            />
          ))}
        </nav>
      )}
      {lockedChoices.length > 0 && (
        <ul aria-label="Locked choices" className="flex flex-col gap-2 list-none">
          {lockedChoices.map((choice) => (
            <LockedChoice key={choice.id} text={choice.text} gateReason={choice.gateReason ?? ''} />
          ))}
        </ul>
      )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- encounters 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 6: Run the full suite (integration guard)**

Run: `npm run test:run 2>&1 | tail -12`
Expected: all green (baseline + the new tests).

- [ ] **Step 7: Commit**

```bash
git add src/engine/encounters.ts src/components/EncounterPanel/ src/engine/__tests__/
git commit -m "feat(engine/ui): encounter choices via shared resolver; escape paths stay hard-gated (Phase 5)"
```

---

## Task 7: Demo — convert one shipped gated choice to `disabled`

**Files:**
- Modify: one choice in `public/content/**` (chosen during this task)

- [ ] **Step 1: Find candidate gated choices**

Run: `grep -rln "requiresClue\|requiresDeduction\|requiresFlag\|requiresFaculty" public/content/ | head`
Then inspect a few. Pick a choice where a **visible-but-locked** presentation reads well narratively (e.g. a physically-locked action the player can attempt once they hold a specific clue/key), NOT one whose mere existence spoils a twist. Prefer a main-scene choice (not an encounter round, not an escape path).

- [ ] **Step 2: Convert it**

Add to the chosen choice's JSON:

```json
"visibility": "disabled",
"gateReason": "<measured, diegetic reason — e.g. 'The strongbox is locked fast; you'd need Ackroyd's key.'>"
```

Keep the existing `requires*` gate. The reason must be Victorian-measured, never mechanical ("Requires: …").

- [ ] **Step 3: Validate the case**

Run: `node scripts/validateCase.mjs 2>&1 | tail -10`
Expected: 8 cases, zero errors (the converted choice has a real gateReason + a gate).

- [ ] **Step 4: Run the content-integrity reviewer on the tone**

Use the `/review-content` skill (content-integrity-reviewer subagent) against the changed case, focused on the `gateReason` tone. Fold any tone feedback.

- [ ] **Step 5: Commit**

```bash
git add public/content/
git commit -m "content: demo one disabled-with-reason choice (Phase 5 end-to-end anchor)"
```

---

## Task 8: Docs

**Files:**
- Modify: `docs/content-authoring.md`
- Modify: `docs/engine-reference.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Authoring rules in `docs/content-authoring.md`**

Add a "Choice visibility (hide vs. disable-with-reason)" subsection near the choice-gating rules. Content:
- The `visibility` field: `hidden` (default) | `disabled` | `shown`, and that it governs the **unmet-gate** case only.
- **When to hide:** when the option's very existence would spoil a twist or confuse (default; do nothing).
- **When to disable-with-reason:** when a visible-but-locked state builds tension or teaches a prerequisite the player can pursue.
- `gateReason` **required** for `disabled`; tone rule — measured, diegetic ("The lock holds fast; you'd want Ackroyd's key"), never mechanical ("Requires: Occult 12").
- The `shown` soft-gate escape hatch is rare and warns in the validator.
- Escape-path choices may **not** use the vocabulary.

- [ ] **Step 2: Engine module list in `docs/engine-reference.md`**

Add a `choiceVisibility` entry: `choiceGateConditions(choice)` → `Condition[]`; `resolveChoiceVisibility(choice, state)` → `'shown' | 'disabled' | 'hidden'`; note it's the single source of truth consumed by `ChoicePanel` + `encounters`, exported via the `narrativeEngine` barrel.

- [ ] **Step 3: `docs/architecture.md`**

Add `choiceVisibility.ts` to the engine module list and note the data flow: content `visibility`/`gateReason` → resolver → ChoicePanel/EncounterPanel three-way render. Note the stale `ChoicePanel/index.ts` `isChoiceVisible` re-export was removed.

- [ ] **Step 4: Commit**

```bash
git add docs/content-authoring.md docs/engine-reference.md docs/architecture.md
git commit -m "docs: Phase 5 choice-gating — authoring rules + engine/architecture module notes"
```

---

## Task 9: Full gate + whole-branch review prep

- [ ] **Step 1: Run the complete gate**

```bash
npm run lint && node scripts/validateCase.mjs && npm run test:run && npm run build
```
Expected: lint clean; validator 8 cases zero errors; all tests pass (baseline 766 + new tests); build green (incl. `typecheck:scripts`).

- [ ] **Step 2: Record the new baseline**

Note the new test count for the checkpoint (was 766/78).

- [ ] **Step 3: Whole-branch internal review**

Use `superpowers:requesting-code-review` for a whole-branch review before the Codex impl pass.

- [ ] **Step 4: Live verify in-browser**

Load a case in the dev server (or Playwright) that reaches the demo choice while its gate is unmet; confirm the locked choice renders greyed with the reason, is not focusable/clickable, and appears after the interactive choices; 0 console errors.

---

## Self-Review notes (author)

- **Spec coverage:** §3 schema → T1; §4 resolver + barrel + index cleanup → T2/T5; §5 validator (5 errors + warning + Ctx plumbing) → T3; §6 rendering (nav + locked ul, LockedChoice) → T4/T5/T6; §7 tests → across T2/T3/T4/T5/T6; §8 docs → T8; §9 demo → T7; §10 review path → T9 + the Codex impl pass after. All covered.
- **Type consistency:** `resolveChoiceVisibility`/`choiceGateConditions` names, `ChoiceVisibilityState` union, and the `LockedChoice` props (`text`, `gateReason`) are used identically across tasks.
- **Backward-compat:** the `requiresFlag: ''` compat test (T2) and the shipped-content validator run (T3 step 7) guard it.
