# Phase 2b — Deduction Formation Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Enact [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md) — correctness gates
deduction formation, the Reason roll only flavours it — and fix the pre-existing board-plumbing defects
(N1–N5 + the latent revert bug) that made the current roll-gates model unsound.

**Architecture:** A new pure engine module `deductionOracle.ts` classifies each *player-connected
component* of the evidence board into `correct | false | partial | incorrect` using two graphs (authored
recipes matched against the player's topology; generic components classified against undirected
`connectsTo`). The board runs the oracle on each attempt and forms **every** qualifying deduction; the
`DeductionButton` is demoted to rolling the d20 for flavour only. `'connected'` clue status becomes
*derived* from `connections` membership (never written). The failed-attempt `contested → prior` revert
moves into the store with per-clue generation-token ownership. Generic deductions get a canonical stable
id. Save bumps v4 → v5.

**Tech Stack:** TypeScript, React 19, Zustand + Immer, Vitest 4 + React Testing Library, fast-check.

**Spec:** [`2026-07-15-phase2b-deduction-formation-design.md`](../specs/2026-07-15-phase2b-deduction-formation-design.md)
(read it — this plan implements it; the spec's §1–§4 map to Tasks 1–8 here). Codex spec-review round 1
(5 findings) is already folded into the spec.

**Ground truth verified against `main` (do not re-litigate):**
- 7 recipes across 4 main cases; the 4 vignettes ship **no** `deductions.json` (generic path is their only
  oracle).
- 2 of 7 recipes (`lw-deduction-croke-court-murder`, `ms-deduction-fraud-and-breach`) are **not**
  `connectsTo`-connected among their required clues → recipes MUST match player topology, never `connectsTo`.
- All clue ids match `^[a-z0-9-]+$`. `CURRENT_SAVE_VERSION = 4`. `'connected'` status written only in
  `EvidenceBoard.handleInitiateConnection`; read only in `ClueCard` rendering.

**Commit discipline:** one commit per task (RED+GREEN folded is fine, but commit at each task boundary).
Run `npm run test:run` (not watch) for scripted checks. Never squash-merge this branch.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/types/index.ts` | Add `DeductionCorrectness`, `ClassifiedComponent`. Document `'connected'` as deprecated. | 1 |
| `src/engine/deductionOracle.ts` (new) | Pure oracle: `classifyBoard(connections, clues, recipes)`. | 1 |
| `src/engine/__tests__/deductionOracle.test.ts` (new) | Oracle unit suite (load-bearing). | 1 |
| `src/engine/buildDeduction.ts` | Canonical generic id; drop `Date.now()`/`Math.random()`. | 2 |
| `src/engine/contentValidation.ts` | Reserve `deduction-generic-` namespace; assert clue-id charset. | 3 |
| `src/store/slices/evidenceSlice.ts` | `contestedTokens`/`attemptSeq` state; `contestClues`/`revertContested` actions. | 4 |
| `src/store/slices/narrativeSlice.ts` | Clear the new state in `resetForNewCase`. | 4 |
| `src/engine/saveManager.ts` | v4 → v5 migration (`connected`→`deduced`/`examined`; `contested`→`examined`). | 5 |
| `src/components/EvidenceBoard/ClueCard.tsx` | `isConnected` prop drives ring + 🔗; status no longer renders `connected`. | 6 |
| `src/components/EvidenceBoard/DeductionButton.tsx` | Roll only; `onResult(tier)`; no formation/status writes. | 7 |
| `src/components/EvidenceBoard/EvidenceBoard.tsx` | Run oracle, form all deductions, drive statuses/banner/announce. | 7 |
| `docs/DECISIONS/ADR-0012-*.md` + `DECISIONS/README.md` | Promote `Accepted → Enacted`. | 8 |
| `engine-reference.md`, `CLAUDE.md`, `content-authoring.md` | Doc updates. | 8 |

---

## Task 1: The correctness oracle (pure engine module)

**Files:**
- Modify: `src/types/index.ts` (add two types near the `Deduction`/`KeyDeduction` block, ~line 90-104)
- Create: `src/engine/deductionOracle.ts`
- Test: `src/engine/__tests__/deductionOracle.test.ts`

This is the load-bearing task. The oracle is pure (no store, no React, no `Date.now`/`Math.random`).

- [ ] **Step 1: Add the types**

In `src/types/index.ts`, after the `KeyDeduction` interface:

```ts
export type DeductionCorrectness = 'correct' | 'false' | 'partial' | 'incorrect';

/** One player-built connected component, classified by the deduction oracle. */
export interface ClassifiedComponent {
  /** Own-property, revealed clue ids in this component (sorted, deduped). */
  clueIds: string[];
  correctness: DeductionCorrectness;
  /**
   * EVERY recipe whose requiredClues ⊆ this component (ADR-0005 subset semantics).
   * Ordered for PRESENTATION only (non-red-herring first → largest requiredClues →
   * lowest id); the order never decides which recipes form — all of them do.
   * Empty on the generic path.
   */
  recipes: KeyDeduction[];
}
```

Also update the `ClueStatus` doc: add a line-comment above `'connected'` in the union noting it is
**deprecated / never written after Phase 2b** (derived from `connections` membership).

- [ ] **Step 2: Write the failing oracle test file**

Create `src/engine/__tests__/deductionOracle.test.ts`. Use lightweight inline fixtures (build `Clue`
records + `ClueConnection[]` + `KeyDeduction[]` by hand — do NOT load real content JSON in a unit test).
A helper to reduce noise:

```ts
import { describe, it, expect } from 'vitest';
import { classifyBoard } from '../deductionOracle';
import type { Clue, ClueConnection, KeyDeduction } from '../../types';

function clue(id: string, over: Partial<Clue> = {}): Clue {
  return {
    id, type: 'physical', title: id, description: '', sceneSource: 's',
    connectsTo: [], tags: [], status: 'examined', isRevealed: true, ...over,
  };
}
const edge = (fromId: string, toId: string): ClueConnection => ({ fromId, toId });
const recipe = (id: string, requiredClues: string[], isRedHerring = false): KeyDeduction =>
  ({ id, requiredClues, title: id, description: id, isRedHerring });

function clues(...cs: Clue[]): Record<string, Clue> {
  return Object.fromEntries(cs.map((c) => [c.id, c]));
}
```

Write these tests (all initially failing — module doesn't exist):

```ts
describe('classifyBoard — recipe path', () => {
  it('forms a correct component when a non-red-herring recipe subset is connected', () => {
    const cs = clues(clue('a'), clue('b'), clue('c'));
    const comps = classifyBoard([edge('a', 'b'), edge('b', 'c')], cs, [recipe('r1', ['a', 'b'])]);
    expect(comps).toHaveLength(1);
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('matches a recipe whose required clues are NOT connectsTo-connected (player topology, not connectsTo)', () => {
    // a,b,c,d have NO connectsTo edges between them, but the player connected them.
    const cs = clues(clue('a'), clue('b'), clue('c'), clue('d'));
    const comps = classifyBoard(
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')], cs, [recipe('r', ['a', 'b', 'c', 'd'])],
    );
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['r']);
  });

  it('forms BOTH recipes when one component satisfies two complete recipes (Blocker 1)', () => {
    const cs = clues(clue('w'), clue('s'), clue('q'), clue('d'));
    const recipes = [
      recipe('one-true-murder', ['w', 's']),        // non-red-herring
      recipe('poisoner', ['q', 's', 'd'], true),     // red-herring
    ];
    const comps = classifyBoard([edge('w', 's'), edge('s', 'q'), edge('q', 'd')], cs, recipes);
    expect(comps).toHaveLength(1);
    expect(comps[0].correctness).toBe('correct'); // a non-red-herring recipe matched
    expect(comps[0].recipes.map((r) => r.id).sort()).toEqual(['one-true-murder', 'poisoner']);
  });

  it('is `false` when ONLY a red-herring recipe matches', () => {
    const cs = clues(clue('q'), clue('s'), clue('d'));
    const comps = classifyBoard(
      [edge('q', 's'), edge('s', 'd')], cs, [recipe('poisoner', ['q', 's', 'd'], true)],
    );
    expect(comps[0].correctness).toBe('false');
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['poisoner']);
  });

  it('orders matched recipes deterministically for presentation (non-RH → largest → lowest id)', () => {
    const cs = clues(clue('a'), clue('b'), clue('c'));
    const recipes = [
      recipe('zzz', ['a', 'b'], true),          // red-herring → last
      recipe('big', ['a', 'b', 'c']),           // non-RH, 3 required → first
      recipe('small', ['a', 'b']),              // non-RH, 2 required → second
    ];
    const comps = classifyBoard([edge('a', 'b'), edge('b', 'c')], cs, recipes);
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['big', 'small', 'zzz']);
  });
});

describe('classifyBoard — generic path (no recipe)', () => {
  it('correct: all player-edges are authored connectsTo (undirected)', () => {
    const cs = clues(clue('a', { connectsTo: ['b'] }), clue('b')); // one-way authored edge
    const comps = classifyBoard([edge('a', 'b')], cs, []);
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes).toEqual([]);
  });

  it('false: all-authored but the component contains a redHerring clue (N4)', () => {
    const cs = clues(clue('a', { connectsTo: ['b'] }), clue('b', { type: 'redHerring' }));
    const comps = classifyBoard([edge('a', 'b')], cs, []);
    expect(comps[0].correctness).toBe('false');
  });

  it('partial: some player-edges authored, some not', () => {
    const cs = clues(clue('a', { connectsTo: ['b'] }), clue('b'), clue('c'));
    const comps = classifyBoard([edge('a', 'b'), edge('b', 'c')], cs, []); // b-c not authored
    expect(comps[0].correctness).toBe('partial');
  });

  it('incorrect: no player-edge is authored', () => {
    const cs = clues(clue('a'), clue('b'));
    const comps = classifyBoard([edge('a', 'b')], cs, []);
    expect(comps[0].correctness).toBe('incorrect');
  });
});

describe('classifyBoard — fail-closed + topology', () => {
  it('classifies a <2-clue component as incorrect', () => {
    const cs = clues(clue('a'));
    // a self-referential or lone edge endpoint: no valid 2-clue component
    const comps = classifyBoard([], cs, []);
    expect(comps).toEqual([]);
  });

  it('drops an edge with a missing or unrevealed endpoint', () => {
    const cs = clues(clue('a'), clue('b', { isRevealed: false }));
    const comps = classifyBoard([edge('a', 'b'), edge('a', 'missing')], cs, []);
    expect(comps).toEqual([]); // both edges dropped → no ≥2 component
  });

  it('does not read an inherited Object.prototype member as a clue', () => {
    const cs = clues(clue('a'));
    const comps = classifyBoard([edge('a', 'toString')], cs, []);
    expect(comps).toEqual([]);
  });

  it('classifies two disjoint clusters independently', () => {
    const cs = clues(
      clue('a', { connectsTo: ['b'] }), clue('b'),
      clue('x'), clue('y'),
    );
    const comps = classifyBoard([edge('a', 'b'), edge('x', 'y')], cs, []);
    const byKey = comps.map((c) => `${c.clueIds.join('+')}:${c.correctness}`).sort();
    expect(byKey).toEqual(['a+b:correct', 'x+y:incorrect']);
  });
});
```

- [ ] **Step 3: Run the test — verify it fails**

Run: `npm run test:run -- deductionOracle`
Expected: FAIL — `classifyBoard` is not defined / module missing.

- [ ] **Step 4: Implement `deductionOracle.ts`**

```ts
/**
 * deductionOracle — pure classification of the evidence board's player-connected
 * components. Enacts ADR-0012: correctness (not the roll) decides formation.
 *
 * Operates on the PLAYER's connection topology, never on authored `connectsTo`
 * for recipe-matching (2 of 7 shipped recipes are not connectsTo-connected).
 */
import type { Clue, ClueConnection, KeyDeduction, ClassifiedComponent } from '../types';

const has = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/** Undirected authored relationship between two clues. */
function connectsToUndirected(a: Clue, b: Clue): boolean {
  return !!a.connectsTo?.includes(b.id) || !!b.connectsTo?.includes(a.id);
}

/** Deterministic PRESENTATION order: non-red-herring → most required clues → lowest id. */
function orderRecipes(recipes: KeyDeduction[]): KeyDeduction[] {
  return [...recipes].sort((x, y) => {
    if (x.isRedHerring !== y.isRedHerring) return x.isRedHerring ? 1 : -1;
    if (x.requiredClues.length !== y.requiredClues.length) {
      return y.requiredClues.length - x.requiredClues.length;
    }
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

export function classifyBoard(
  connections: ClueConnection[],
  clues: Record<string, Clue>,
  recipes: KeyDeduction[],
): ClassifiedComponent[] {
  // 1. Fail-closed: keep only edges whose BOTH endpoints are own-property, revealed clues.
  const validEdges = connections.filter(
    (e) =>
      e.fromId !== e.toId &&
      has(clues, e.fromId) && clues[e.fromId].isRevealed &&
      has(clues, e.toId) && clues[e.toId].isRevealed,
  );

  // 2. Union-find over the valid edges → connected components.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  for (const e of validEdges) union(e.fromId, e.toId);

  const groups = new Map<string, Set<string>>();
  for (const e of validEdges) {
    const root = find(e.fromId);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root)!.add(e.fromId);
    groups.get(root)!.add(e.toId);
  }

  const out: ClassifiedComponent[] = [];
  for (const set of groups.values()) {
    if (set.size < 2) continue; // fail-closed
    const clueIds = [...set].sort();
    const S = new Set(clueIds);

    // 3a. Recipe path — every recipe whose requiredClues ⊆ S.
    const matches = recipes.filter((r) => r.requiredClues.every((id) => S.has(id)));
    if (matches.length > 0) {
      const ordered = orderRecipes(matches);
      const correctness = ordered.some((r) => !r.isRedHerring) ? 'correct' : 'false';
      out.push({ clueIds, correctness, recipes: ordered });
      continue;
    }

    // 3b. Generic path — classify player-edges against undirected connectsTo.
    const internal = validEdges.filter((e) => S.has(e.fromId) && S.has(e.toId));
    const authored = internal.filter((e) => connectsToUndirected(clues[e.fromId], clues[e.toId]));
    let correctness: ClassifiedComponent['correctness'];
    if (authored.length === internal.length) {
      const hasRedHerring = clueIds.some((id) => clues[id].type === 'redHerring');
      correctness = hasRedHerring ? 'false' : 'correct';
    } else if (authored.length > 0) {
      correctness = 'partial';
    } else {
      correctness = 'incorrect';
    }
    out.push({ clueIds, correctness, recipes: [] });
  }
  return out;
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `npm run test:run -- deductionOracle`
Expected: PASS (all oracle tests green).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/engine/deductionOracle.ts src/engine/__tests__/deductionOracle.test.ts
git commit -m "feat(engine): deduction oracle — classify player-connected components (ADR-0012)"
```

---

## Task 2: Canonical generic deduction id (N5)

**Files:**
- Modify: `src/engine/buildDeduction.ts:11-29`
- Test: `src/engine/__tests__/buildDeduction.test.ts` (add cases; create if absent)

- [ ] **Step 1: Write the failing test**

Add to the buildDeduction test file:

```ts
import { buildDeduction } from '../buildDeduction';
import type { Clue } from '../../types';

const c = (id: string, over: Partial<Clue> = {}): Clue => ({
  id, type: 'physical', title: id.toUpperCase(), description: '', sceneSource: 's',
  connectsTo: [], tags: [], status: 'examined', isRevealed: true, ...over,
});

describe('buildDeduction — canonical stable id (N5)', () => {
  const clues = { b: c('b'), a: c('a') };

  it('produces the same id regardless of clue-id order (sorted signature)', () => {
    const d1 = buildDeduction(['a', 'b'], clues);
    const d2 = buildDeduction(['b', 'a'], clues);
    expect(d1.id).toBe('deduction-generic-a+b');
    expect(d2.id).toBe(d1.id);
  });

  it('uses no Date.now / Math.random (id is pure of the clue set)', () => {
    const d1 = buildDeduction(['a', 'b'], clues);
    const d2 = buildDeduction(['a', 'b'], clues);
    expect(d1.id).toBe(d2.id); // deterministic
  });

  it('flags a red-herring set', () => {
    const rh = { a: c('a'), r: c('r', { type: 'redHerring' }) };
    expect(buildDeduction(['a', 'r'], rh).isRedHerring).toBe(true);
  });
});
```

Run: `npm run test:run -- buildDeduction` → Expected: FAIL (id is still `deduction-<ts>-<rand>`).

- [ ] **Step 2: Implement the canonical id**

In `src/engine/buildDeduction.ts`, replace the `id` line in the returned object:

```ts
  return {
    id: `deduction-generic-${[...clueIds].sort().join('+')}`,
    clueIds,
    description,
    isRedHerring,
  };
```

Remove any now-unused imports. `Date.now()`/`Math.random()` leave this file entirely.

- [ ] **Step 3: Run the test — verify it passes**

Run: `npm run test:run -- buildDeduction` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/buildDeduction.ts src/engine/__tests__/buildDeduction.test.ts
git commit -m "feat(engine): canonical stable id for generic deductions (idempotent, fixes N5)"
```

---

## Task 3: Validator — reserve the generic namespace + clue-id charset (Codex Major 4)

**Files:**
- Modify: `src/engine/contentValidation.ts` (in the recipe-validation loop, ~line 129-136)
- Test: `src/engine/__tests__/contentValidation.test.ts` (add cases)

- [ ] **Step 1: Write the failing test**

Add validator tests (match the existing bundle-fixture style in that test file — build a minimal
`ContentBundle` and assert `errors` contains the message):

```ts
it('errors when a recipe id begins with the reserved deduction-generic- prefix', () => {
  const bundle = makeBundle({
    recipes: [{ id: 'deduction-generic-a+b', requiredClues: ['clue-a'], title: 't', description: 'd', isRedHerring: false }],
    clues: [minimalClue('clue-a')],
  });
  const errors = validateBundle(bundle).errors;
  expect(errors.some((e) => /reserved.*deduction-generic/i.test(e))).toBe(true);
});

it('errors when a clue id contains a character outside [a-z0-9-]', () => {
  const bundle = makeBundle({ clues: [minimalClue('clue+bad')] });
  const errors = validateBundle(bundle).errors;
  expect(errors.some((e) => /clue.*id.*invalid|invalid.*clue id/i.test(e))).toBe(true);
});
```

(Use whatever bundle-builder helper the existing test file uses; if none, construct the object literal
inline matching the shape `validateBundle` expects.)

Run: `npm run test:run -- contentValidation` → Expected: FAIL.

- [ ] **Step 2: Implement the two rules**

In `contentValidation.ts`, add a clue-id charset check in the clue loop and a reserved-namespace check in
the recipe loop:

```ts
  // Clue ids must match ^[a-z0-9-]+$ so the generic-deduction id signature
  // (deduction-generic-<ids joined by '+'>) can never collide (Phase 2b, Major 4).
  for (const clue of bundle.clues) {
    if (!/^[a-z0-9-]+$/.test(clue.id)) {
      errors.push(`Clue id "${clue.id}" is invalid — must match ^[a-z0-9-]+$`);
    }
  }
```

```ts
  // A recipe id must not intrude on the machine-owned generic-deduction namespace,
  // or a generic connection could falsely satisfy its hasDeduction gate (Phase 2b, Major 4).
  for (const recipe of bundle.recipes ?? []) {
    if (recipe.id.startsWith('deduction-generic-')) {
      errors.push(`KeyDeduction "${recipe.id}" uses the reserved "deduction-generic-" id namespace`);
    }
    // (existing requiredClues existence check stays)
  }
```

- [ ] **Step 3: Run test + full validator — verify pass and no shipped-content regression**

Run: `npm run test:run -- contentValidation` → Expected: PASS.
Run: `node scripts/validateCase.mjs` → Expected: all 8 cases clean (no shipped id violates either rule —
verified: all ids are `[a-z0-9-]`, no recipe id starts with `deduction-generic-`).

- [ ] **Step 4: Commit**

```bash
git add src/engine/contentValidation.ts src/engine/__tests__/contentValidation.test.ts
git commit -m "feat(validator): reserve deduction-generic- namespace + enforce clue-id charset (Phase 2b)"
```

---

## Task 4: Store — derive `connected`, store-owned contested-revert ownership (N1, N2, Blocker 2)

**Files:**
- Modify: `src/store/slices/evidenceSlice.ts`
- Modify: `src/store/slices/narrativeSlice.ts:53-59` (`resetForNewCase` clears the new state)
- Test: `src/store/slices/__tests__/evidenceSlice.test.ts` (create if absent, else extend)

The revert timer moves OUT of `DeductionButton` and INTO the store, with per-clue generation-token
ownership so overlapping attempts and board-unmount can't corrupt or lose it.

- [ ] **Step 1: Write the failing tests (fake timers)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../../index'; // adjust to the store entry

function seed(status: Record<string, any>) {
  useStore.setState({ clues: status, connections: [], deductions: {} } as any);
}
const clue = (id: string, s: string) => ({
  id, type: 'physical', title: id, description: '', sceneSource: 's',
  connectsTo: [], tags: [], status: s, isRevealed: true,
});

beforeEach(() => vi.useRealTimers());

describe('evidenceSlice — store-owned contested revert (Blocker 2)', () => {
  it('reverts contested clues to their PRIOR status after 2s', () => {
    vi.useFakeTimers();
    seed({ a: clue('a', 'examined'), b: clue('b', 'new') });
    useStore.getState().contestClues(['a', 'b'], { a: 'examined', b: 'new' });
    expect(useStore.getState().clues.a.status).toBe('contested');
    vi.advanceTimersByTime(2000);
    expect(useStore.getState().clues.a.status).toBe('examined');
    expect(useStore.getState().clues.b.status).toBe('new'); // prior, not hardcoded examined
  });

  it('a later success on a shared clue wins — the stale revert does NOT clobber it', () => {
    vi.useFakeTimers();
    seed({ c1: clue('c1', 'examined'), c2: clue('c2', 'examined'), c3: clue('c3', 'examined') });
    const st = useStore.getState();
    st.contestClues(['c1', 'c2'], { c1: 'examined', c2: 'examined' }); // attempt A fails
    st.updateClueStatus('c1', 'deduced'); // attempt B succeeds on c1 (bumps token via updateClueStatus? no)
    // B explicitly takes ownership of c1 by a fresh attempt token:
    st.claimClues(['c1', 'c3']); // see note below
    st.updateClueStatus('c1', 'deduced');
    vi.advanceTimersByTime(2000);
    expect(useStore.getState().clues.c1.status).toBe('deduced'); // A's revert must not fire on c1
    expect(useStore.getState().clues.c2.status).toBe('examined'); // A still owns c2
  });

  it('resetForNewCase clears contested tokens and pending state', () => {
    seed({ a: clue('a', 'contested') });
    useStore.getState().contestClues(['a'], { a: 'examined' });
    // load a new case (via the store's load path) then assert tokens cleared
    // (assert contestedTokens is empty and no clue stuck contested after load)
  });
});
```

**Design note for the implementer:** the token-ownership contract is: an attempt gets a fresh `gen`
(`++attemptSeq`); each contested clue records `contestedTokens[id] = gen`; the revert only restores a clue
if `contestedTokens[id] === gen`. Any *newer* write to that clue (a success forming a deduction, or a
later failed attempt) must first claim the clue by bumping its token so the stale revert's ownership check
fails. Provide a small internal helper the success path calls to bump the token (the test calls it
`claimClues`; name it as you see fit, e.g. fold the bump into the formation path in Task 7 rather than a
public action — the test can assert the *behaviour* rather than the exact method name). Keep the public
surface minimal: `contestClues(clueIds, priorStatuses)` is the one new action the board calls; the
ownership bump on success can be internal to the formation flow.

- [ ] **Step 2: Run — verify fail**

Run: `npm run test:run -- evidenceSlice` → Expected: FAIL (`contestClues` undefined).

- [ ] **Step 3: Implement the slice changes**

Add to `EvidenceSlice` state + actions in `src/store/slices/evidenceSlice.ts`:

```ts
export interface EvidenceSlice {
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  connections: ClueConnection[];
  /** clue id → the attempt generation that last marked it contested (ownership). */
  contestedTokens: Record<string, number>;
  /** Monotonic attempt counter; each attempt claims a fresh generation. */
  attemptSeq: number;
  discoverClue: (clueId: string) => void;
  updateClueStatus: (clueId: string, status: ClueStatus) => void;
  addDeduction: (deduction: Deduction) => void;
  addConnection: (fromId: string, toId: string) => void;
  clearConnections: () => void;
  /** Mark clues contested with fresh ownership; schedule a 2s revert to prior status. */
  contestClues: (clueIds: string[], priorStatuses: Record<string, ClueStatus>) => void;
}
```

Initial state: `contestedTokens: {}, attemptSeq: 0`.

`contestClues` implementation (the timer lives in the closure but restoration is ownership-gated, so it is
safe across board unmount — the store outlives the component):

```ts
  contestClues: (clueIds, priorStatuses) =>
    set((state) => {
      const gen = ++state.attemptSeq;
      for (const id of clueIds) {
        if (state.clues[id]) {
          state.clues[id].status = 'contested';
          state.contestedTokens[id] = gen;
        }
      }
      // Schedule the ownership-gated revert. Reads/writes go through get()/set()
      // so it operates on live state, not the captured draft.
      setTimeout(() => {
        set((s) => {
          for (const id of clueIds) {
            if (s.contestedTokens[id] === gen && s.clues[id]) {
              s.clues[id].status = priorStatuses[id] ?? 'examined';
              delete s.contestedTokens[id];
            }
          }
        });
      }, 2000);
    }),
```

Make the success path (Task 7) bump the token before setting `deduced`: when forming a deduction, for each
clue set `state.contestedTokens[id] = ++state.attemptSeq` (claim) then `status = 'deduced'`. Simplest: add
the claim inside the existing `updateClueStatus` when the new status is `'deduced'` — OR do it explicitly
in the board's formation loop. Prefer explicit in Task 7 to keep `updateClueStatus` generic. Expose a tiny
internal claim if needed; the test asserts behaviour, not the method name.

In `narrativeSlice.ts` `resetForNewCase`, alongside the existing clears (line 53-59) add:

```ts
  state.contestedTokens = {};
  state.attemptSeq = 0;
```

- [ ] **Step 4: Run — verify pass**

Run: `npm run test:run -- evidenceSlice` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/evidenceSlice.ts src/store/slices/narrativeSlice.ts src/store/slices/__tests__/evidenceSlice.test.ts
git commit -m "feat(store): store-owned contested revert with per-clue generation tokens (fixes N2 + Blocker 2)"
```

---

## Task 5: Save migration v4 → v5 (Codex Major 3)

**Files:**
- Modify: `src/engine/saveManager.ts` (`CURRENT_SAVE_VERSION`, add v4→v5 step)
- Test: `src/engine/__tests__/saveManager.test.ts` (add migration cases)

- [ ] **Step 1: Write the failing test**

```ts
describe('SaveManager.migrate — v4 → v5 (clue status normalization)', () => {
  const base = (clues: Record<string, any>, deductions: Record<string, any> = {}) => ({
    version: 4, timestamp: 't',
    state: { clues, deductions, connections: [], /* ...minimal valid GameState fields... */ } as any,
  });

  it('restores a connected clue REFERENCED by a persisted deduction to deduced', () => {
    const sf = base(
      { c1: { id: 'c1', status: 'connected' } },
      { d: { id: 'd', clueIds: ['c1'], description: '', isRedHerring: false } },
    );
    const out = SaveManager.migrate(sf as any);
    expect(out.state.clues.c1.status).toBe('deduced');
  });

  it('maps a connected clue NOT referenced by any deduction to examined', () => {
    const sf = base({ c2: { id: 'c2', status: 'connected' } });
    expect(SaveManager.migrate(sf as any).state.clues.c2.status).toBe('examined');
  });

  it('maps a persisted contested clue to examined (no stranded transient)', () => {
    const sf = base({ c3: { id: 'c3', status: 'contested' } });
    expect(SaveManager.migrate(sf as any).state.clues.c3.status).toBe('examined');
  });

  it('stamps the migrated file at the current version', () => {
    expect(SaveManager.migrate(base({}) as any).version).toBe(5);
  });
});
```

Run: `npm run test:run -- saveManager` → Expected: FAIL (version still 4; no normalization).

- [ ] **Step 2: Implement**

Bump `CURRENT_SAVE_VERSION` to `5`. Add after the `v3 → 4` block in `migrate()`:

```ts
    // v4 → v5: 'connected' is no longer a written clue status (derived from
    // connections). Restore it: a clue referenced by a persisted deduction was
    // 'deduced' before the v4 bug overwrote it → deduced; otherwise → examined.
    // Also normalize the transient 'contested' (no owning timer survives a reload).
    if (version < 5) {
      const deducedClueIds = new Set<string>();
      for (const d of Object.values(state.deductions ?? {})) {
        for (const id of (d as { clueIds?: string[] }).clueIds ?? []) deducedClueIds.add(id);
      }
      const clues = { ...(state.clues ?? {}) };
      for (const [id, clue] of Object.entries(clues)) {
        const c = clue as { status?: string };
        if (c.status === 'connected') {
          clues[id] = { ...c, status: deducedClueIds.has(id) ? 'deduced' : 'examined' } as never;
        } else if (c.status === 'contested') {
          clues[id] = { ...c, status: 'examined' } as never;
        }
      }
      state = { ...state, clues };
      version = 5;
    }
```

(Match the exact `migrate` style already in the file — it reassigns `state`/`version` step by step.)

- [ ] **Step 3: Run — verify pass**

Run: `npm run test:run -- saveManager` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/saveManager.ts src/engine/__tests__/saveManager.test.ts
git commit -m "feat(save): v4->v5 migration — connected->deduced/examined, contested->examined (Major 3)"
```

---

## Task 6: `ClueCard` — derive the connected cue from `isConnected` (N1)

**Files:**
- Modify: `src/components/EvidenceBoard/ClueCard.tsx`
- Test: `src/components/__tests__/ClueCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('renders the 🔗 badge + gold ring from isConnected, independent of status', () => {
  const clue = { id: 'x', type: 'physical', title: 'X', description: '', sceneSource: 's',
    connectsTo: [], tags: [], status: 'deduced', isRevealed: true } as const;
  render(<ClueCard clue={clue} isConnected />);
  expect(screen.getByLabelText('Connected')).toBeTruthy(); // 🔗 shows though status is 'deduced'
});

it('does not render 🔗 when not connected', () => {
  const clue = { /* same, */ status: 'examined' } as any;
  render(<ClueCard clue={clue} isConnected={false} />);
  expect(screen.queryByLabelText('Connected')).toBeNull();
});

it('appends ", connected" to the card aria-label when connected', () => {
  const clue = { /* ... */ status: 'examined', title: 'X' } as any;
  render(<ClueCard clue={clue} isConnected />);
  expect(screen.getByRole('button', { name: /status: examined, connected/i })).toBeTruthy();
});
```

Run: `npm run test:run -- ClueCard` → Expected: FAIL (`isConnected` prop doesn't exist; 🔗 tied to status).

- [ ] **Step 2: Implement**

- Add `isConnected?: boolean` to `ClueCardProps`.
- Remove the `case 'connected'` from both `getStatusClasses` and `StatusIndicator` (status no longer
  carries `connected`).
- Render the gold ring + 🔗 from `isConnected`:

```tsx
function ClueCardComponent({ clue, onInitiateConnection, isConnecting = false, isBrightened = false, isConnected = false }: ClueCardProps) {
  // ...
  const connectedClass = isConnected ? 'ring-2 ring-yellow-500 border-yellow-500' : '';
  // add connectedClass into the className array (after statusClasses)
  // aria-label:
  aria-label={`Clue: ${clue.title}, status: ${clue.status}${isConnected ? ', connected' : ''}`}
  // badge: render 🔗 when isConnected (in addition to the StatusIndicator for the semantic status)
  {isConnected && (
    <span className="absolute -top-2 -right-2 text-lg" aria-label="Connected">🔗</span>
  )}
```

Note: a clue can be both `deduced` (📌) and `isConnected` (🔗) transiently. Place the 🔗 so it doesn't
visually collide — e.g. render 🔗 only when `!isConnected`-conflicting statuses; simplest correct choice:
show 🔗 when `isConnected`, and keep the status badge; if both occupy `-top-2 -right-2`, offset one (e.g.
🔗 at `-top-2 -left-2`). Pick a non-overlapping slot; the test only asserts both labels are present.
Update the six-state doc-comment header: `connected` is now derived, not a status.

- [ ] **Step 3: Run — verify pass**

Run: `npm run test:run -- ClueCard` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/EvidenceBoard/ClueCard.tsx src/components/__tests__/ClueCard.test.tsx
git commit -m "feat(evidence): derive connected cue (ring + 🔗) from isConnected, not clue.status (N1)"
```

---

## Task 7: Board + button — oracle-driven formation (the integration, enacts ADR-0012)

**Files:**
- Modify: `src/components/EvidenceBoard/DeductionButton.tsx`
- Modify: `src/components/EvidenceBoard/EvidenceBoard.tsx`
- Test: `src/components/__tests__/DeductionButton.test.tsx`, `src/components/__tests__/EvidenceBoard.test.tsx`

This is the integration task — it wires the oracle (Task 1), the store revert (Task 4), and the generic id
(Task 2) into the board, and demotes the button to a flavour roll. **The ADR-0012 Confirmation test lands
here.**

- [ ] **Step 1: Write the failing tests**

DeductionButton (simplified callback):

```ts
it('rolls and reports only the tier — forms nothing, writes no clue status', async () => {
  const { performCheck } = await import('../../engine/diceEngine');
  (performCheck as any).mockReturnValue({ roll: 3, total: 3, dc: 14, tier: 'failure' });
  const onResult = vi.fn();
  render(<DeductionButton connectedClueIds={['a', 'b']} onResult={onResult} />);
  fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
  expect(onResult).toHaveBeenCalledWith('failure'); // tier only, no result arg
  expect(useStore.getState().deductions).toEqual({}); // button forms nothing now
});
```

EvidenceBoard — the ADR-0012 Confirmation + multi-recipe + status derivation:

```ts
describe('EvidenceBoard — oracle-driven formation (Phase 2b, ADR-0012)', () => {
  // fixtures: two clues that match a recipe, wired by a connection
  it('CONFIRMATION: a recipe-matching component forms its deduction on a FAILURE roll', () => {
    // mock performCheck → tier 'failure'; recipe r=[a,b]; connect a-b; attempt
    // assert deductions[r.id] exists and clues a,b are 'deduced'
  });

  it('CONFIRMATION: a non-qualifying set forms NOTHING on a CRITICAL roll', () => {
    // mock performCheck → tier 'critical'; no recipe; a-b not connectsTo (incorrect)
    // assert deductions is empty; clues contested (then would revert)
  });

  it('forms BOTH deductions when a component matches two recipes (Blocker 1)', () => {
    // recipes one-true-murder=[w,s], poisoner=[q,s,d] (red-herring); connect w-s-q-d
    // assert both deduction ids present; poisoner isRedHerring true
  });

  it('handleInitiateConnection writes NO connected status; card shows 🔗 via membership', () => {
    // connect a-b; assert clues.a.status stays 'examined' (not 'connected')
    // assert both cards render the Connected label (isConnected derived)
  });

  it('an incorrect attempt marks clues contested then the store reverts them (fake timers)', () => {
    // tier failure, incorrect topology; assert contested; advance 2s; assert prior status
  });

  it('empty classified result (all edges stale) → red banner, forms nothing, clears (Minor 5)', () => {
    // connections reference missing clue ids; attempt; assert incorrect banner + announce once + deductions empty
  });
});
```

Run: `npm run test:run -- DeductionButton EvidenceBoard` → Expected: FAIL.

- [ ] **Step 2: Implement `DeductionButton` (roll only)**

Strip formation from `DeductionButton.tsx`:
- Remove imports of `buildDeduction`/`buildDeductionFromRecipe`/`matchDeduction`, `useStore` clue/recipe
  selectors, `updateClueStatus`, `addDeduction`.
- `onResult` signature → `(tier: OutcomeTier) => void`.
- `handleAttempt`: roll `performCheck('reason', investigator, DEDUCTION_DC, false, false)`; set button
  phase from tier for its own label (keep `🔒 Deduction Locked` on `success`/`critical`, `🔴 Attempt
  Failed` otherwise — purely cosmetic button text); call `onResult(result.tier)`. No store writes.
- Keep the `< 2` → `null` guard and `NO_RECIPES` removal (recipes no longer read here).

- [ ] **Step 3: Implement `EvidenceBoard.handleDeductionAttempt(tier)`**

Replace `handleDeductionResult` with `handleDeductionAttempt(tier: OutcomeTier)`:

```tsx
import { classifyBoard } from '../../engine/deductionOracle';
import { buildDeduction, buildDeductionFromRecipe } from '../../engine/buildDeduction';

function handleDeductionAttempt(tier: OutcomeTier) {
  const recipes = caseData?.recipes ?? [];
  const components = classifyBoard(storeConnections, clues, recipes);

  // Minor 5: an attempt with no classifiable component → single incorrect outcome.
  if (components.length === 0) {
    showBanner('incorrect', tier); clearConnections(); return;
  }

  let formedCount = 0;
  let best: DeductionCorrectness = 'incorrect';
  for (const comp of components) {
    if (comp.correctness === 'correct' || comp.correctness === 'false') {
      if (comp.recipes.length > 0) {
        for (const r of comp.recipes) { addDeduction(buildDeductionFromRecipe(r, comp.clueIds)); formedCount++; }
      } else {
        addDeduction(buildDeduction(comp.clueIds, clues)); formedCount++;
      }
      comp.clueIds.forEach((id) => updateClueStatus(id, 'deduced')); // claim + deduced (Task 4 note)
    } else {
      const prior = Object.fromEntries(comp.clueIds.map((id) => [id, clues[id].status]));
      contestClues(comp.clueIds, prior);
    }
    best = rank(comp.correctness, best, tier);
  }
  showBanner(best, tier, formedCount);
  // clear connections for formed components (or all, matching today's clear-on-attempt behaviour);
  // slack-animate failed components as today.
}
```

- Compute `connectedIds` and pass `isConnected={connectedIds.includes(clue.id)}` to each `ClueCard`.
- **Stop** calling `updateClueStatus(_, 'connected')` in `handleInitiateConnection` (delete lines 194-195).
- The banner uses the correctness→message/tone table from the spec §Banner; `announce()` once with the
  chosen message. Multi-recipe/multi-component: best-outcome-led + `formedCount` in the copy.
- The `updateClueStatus(id, 'deduced')` call must also **claim** the clue's contested token (per Task 4
  note) so a pending stale revert from an earlier failed attempt can't clobber it — do this in the store
  action or inline here.

- [ ] **Step 4: Run — verify pass (incl. the ADR-0012 Confirmation)**

Run: `npm run test:run -- DeductionButton EvidenceBoard` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/EvidenceBoard/DeductionButton.tsx src/components/EvidenceBoard/EvidenceBoard.tsx src/components/__tests__/DeductionButton.test.tsx src/components/__tests__/EvidenceBoard.test.tsx
git commit -m "feat(evidence): oracle-driven formation — correctness gates, roll flavours (enacts ADR-0012)"
```

---

## Task 8: ADR-0012 enactment + docs

**Files:**
- Modify: `docs/DECISIONS/ADR-0012-deduction-roll-semantics.md` (front matter + Confirmation + Links only —
  NOT the decision body, per MADR immutability)
- Modify: `docs/DECISIONS/README.md` (index row)
- Modify: `docs/engine-reference.md`, `CLAUDE.md`, `docs/content-authoring.md`

- [ ] **Step 1: Promote ADR-0012**

- Front matter: `status: Accepted` → `status: Enacted`.
- Confirmation section: append a dated note that the enacting test landed (board integration:
  recipe-matching component forms on a `failure`-tier roll; non-qualifying forms nothing on `critical`),
  cite the PR.
- Links `Commits / PRs`: fill in the PR number.
- Do **not** edit the Context/Decision/Alternatives/Consequences bodies.
- Update the ADR-0012 row in `DECISIONS/README.md` (status → Enacted, dated).

- [ ] **Step 2: Update the engine + architecture docs**

- `docs/engine-reference.md`: add the `deductionOracle` module (signature + the two-graph behaviour, the
  correctness enum, fail-closed rule); note `buildDeduction`'s canonical generic id; note the save v4→v5
  migration; note the store `contestClues`/token ownership.
- `CLAUDE.md` Architectural Warnings: **rewrite** the Phase-2a deduction warning — formation is now
  **oracle-driven + board-owned**; `'connected'` is **derived, not stored**; the deferred `contested`-revert
  bug is **fixed** (store-owned, token-gated); `Date.now()`/`Math.random()` removed from `buildDeduction`
  (update the "used directly" list). Bump the save-version reference to v5 (+ the v4→v5 migration line
  wherever v3/v4 migrations are listed).
- `docs/content-authoring.md`: what makes a generic connection "correct" (all player-edges authored via
  `connectsTo`); a red-herring clue in an otherwise-correct cluster forms an *uneasy* deduction; the new
  authoring rule that a recipe id must not start with `deduction-generic-` and clue ids must be
  `^[a-z0-9-]+$`.

- [ ] **Step 3: Verify the full gate**

Run: `npm run lint` → clean.
Run: `node scripts/validateCase.mjs` → 8 cases clean.
Run: `npm run test:run` → all green (baseline 649/61 + the Phase-2b additions).
Run: `npm run build` → green (build-compiles + `typecheck:scripts`).

- [ ] **Step 4: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: enact ADR-0012 (Accepted->Enacted) + Phase 2b engine/authoring docs"
```

---

## Post-implementation (controller, after all tasks)

1. **Final whole-branch review** (subagent-driven-development's final reviewer) — spec fidelity + quality
   across the whole diff.
2. **Live verification** (verify skill) — run the app, open the board, drive: connect a recipe set → form
   on a low roll (ADR-0012); connect a wrong set → red, no formation, contested reverts; connect two
   clusters → both classify; a red-herring cluster → uneasy. Capture the screen.
3. **File-based Codex implementation pass** — `codex/input/2026-07-16-phase2b-deduction-formation-impl.md`
   → review → fold findings. (Per ADR-0013; charge = fidelity to spec + integration seams.)
4. **finishing-a-development-branch** → PR (merge commit, never squash). Then **/checkpoint**.

---

## Self-Review (author)

- **Spec coverage:** §1 oracle → Task 1; §2 status/revert/migration → Tasks 4-6 (+ save in 5); §3 formation
  ownership + generic id + banner → Tasks 2, 7; §4 enactment/tests/docs → Task 8. All five Codex findings
  map to a task: Blocker 1 → Task 1/7 (recipes list), Blocker 2 → Task 4, Major 3 → Task 5, Major 4 →
  Task 3, Minor 5 → Task 7 empty-guard. ✔
- **Type consistency:** `classifyBoard(connections, clues, recipes): ClassifiedComponent[]` used identically
  in Task 1 (def) and Task 7 (call). `ClassifiedComponent.recipes` is a list everywhere. `onResult(tier)`
  simplified consistently in Task 7's button + board. `contestClues(clueIds, priorStatuses)` matches Task 4
  def and Task 7 call. ✔
- **Placeholder scan:** the Task 4 fail→success ownership test names an internal `claimClues` helper but the
  plan explicitly says the implementer may fold the token-bump into the formation path and assert behaviour
  rather than that method name — flagged, not a hidden placeholder. Task 7 test bodies are described as
  comments (fixtures are mechanical) — acceptable since the assertions are spelled out; an implementer
  following TDD writes the concrete fixture. ✔
- **Ordering:** oracle (1) → id (2) → validator (3) → store (4) → save (5) → card (6) → integration (7) →
  docs (8). Integration depends on 1/2/4; correct order. ✔
