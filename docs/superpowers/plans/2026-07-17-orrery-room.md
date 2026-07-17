# The Orrery Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build The Orrery Room — the flagship Grey Dawn side vignette carrying the Mythos thread's keystone deduction — plus the 5 engine changes that make vignette recipes/variants first-class (spec: `docs/superpowers/specs/2026-07-17-orrery-room-design.md`).

**Architecture:** Engine first (5 small TDD deltas: unlock registry, vignette loader, CLI validator loader, discoverable-clues warning fix, `KeyDeduction.onForm`), then content (18 base scenes + 4 variants + 7 clues + 2 recipes + 3 NPCs as JSON under `public/content/side-cases/the-orrery-room/`), then content-backed witness tests, docs, and the full review gate.

**Tech Stack:** React 19 + Zustand/Immer store, pure engine modules in `src/engine/`, Vitest 4, content JSON validated by `scripts/validateCase.mjs`.

**Branch:** `feat/orrery-room` (already created; spec + Codex trail committed).

**Non-negotiables (bind every task):**
- TDD: write the failing test, RUN it and watch it fail, then implement.
- `node scripts/validateCase.mjs` must end **zero errors, zero warnings** after every content task.
- Narrative tone: measured, atmospheric, never campy. The Order's courtesy is the dread.
- The Mythos pattern is **never named in prose** — not in scenes, clues, deductions, or gateReasons.
- Commit after every task (more often where steps say so). Never squash anything.

---

## File map

| File | Task | Change |
|---|---|---|
| `src/engine/caseProgression.ts` | T1 | Add `the-orrery-room` to `VIGNETTE_CONDITIONS` |
| `src/engine/__tests__/caseProgression.test.ts` | T1 | Unlock threshold tests |
| `src/types/index.ts` | T2, T5 | `VignetteData.recipes?/variants?`; `KeyDeduction.onForm?` |
| `src/engine/contentLoader.ts` | T2 | `loadVignette` optional `deductions.json` + `variants.json` |
| `src/engine/__tests__/contentLoader.vignette.test.ts` | T2 | New: loader presence/absence tests |
| `src/store/slices/narrativeSlice.ts` | T2 | `vignetteToCaseData` passthrough |
| `src/store/__tests__/narrativeSlice.test.ts` | T2 | Adapter passthrough test |
| `scripts/validateCase.ts` | T3 | `loadBundle` reads `variants.json` for vignettes too |
| `src/engine/contentValidation.ts` | T4, T5 | `computeDiscoverableClues` onEnter fix; validate `onForm` effects |
| `src/engine/__tests__/contentValidation.test.ts` | T4, T5 | Regression tests |
| `src/components/EvidenceBoard/EvidenceBoard.tsx` | T5 | Apply `onForm` once per newly formed recipe deduction |
| `src/components/__tests__/EvidenceBoard.onForm.test.tsx` | T5 | New: formation applies onForm; repeat-formation doesn't |
| `public/content/manifest.json` | T6 | New vignette entry |
| `public/content/side-cases/the-orrery-room/meta.json` | T6 | New |
| `public/content/side-cases/the-orrery-room/npcs.json` | T6 | New (3 NPCs) |
| `public/content/side-cases/the-orrery-room/clues.json` | T6 | New (7 clues) |
| `public/content/side-cases/the-orrery-room/deductions.json` | T6 | New (2 recipes) |
| `public/content/side-cases/the-orrery-room/scenes.json` | T7, T8 | New (18 base scenes) |
| `public/content/side-cases/the-orrery-room/variants.json` | T8 | New (4 variants) |
| `src/engine/__tests__/orreryRoom.content.test.ts` | T9 | New: content-backed witness tests |
| `docs/status.md`, `docs/engine-reference.md`, `docs/content-authoring.md`, `docs/architecture.md` | T10 | Doc deltas |

---

### Task 1: Unlock registry entry (Codex Blocker 1)

The manifest `triggerCondition` is display-only; Case Selection unlocks vignettes solely
via the `vignette-unlocked-<id>` flag minted from `VIGNETTE_CONDITIONS` in
`src/engine/caseProgression.ts`. Without this task the vignette renders permanently locked.

**Files:**
- Modify: `src/engine/caseProgression.ts` (the `VIGNETTE_CONDITIONS` array, ~line 34)
- Test: `src/engine/__tests__/caseProgression.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/caseProgression.test.ts` (match the file's existing
`makeGameState` helper — if it has one, reuse it; the shape below is a minimal
`GameState`):

```ts
describe('the-orrery-room unlock', () => {
  function stateWithGreyDawnRep(rep: number, flags: Record<string, boolean> = {}) {
    return {
      ...baseGameState(), // reuse the file's existing base-state helper/fixture
      factionReputation: { 'Hermetic Order of the Grey Dawn': rep },
      flags,
    };
  }

  it('unlocks at Grey Dawn reputation 2 (threshold inclusive)', () => {
    const unlocked = CaseProgression.checkVignetteUnlocks(stateWithGreyDawnRep(2));
    expect(unlocked).toContain('the-orrery-room');
  });

  it('does not unlock below threshold', () => {
    const unlocked = CaseProgression.checkVignetteUnlocks(stateWithGreyDawnRep(1));
    expect(unlocked).not.toContain('the-orrery-room');
  });

  it('skips when already unlocked', () => {
    const unlocked = CaseProgression.checkVignetteUnlocks(
      stateWithGreyDawnRep(5, { 'vignette-unlocked-the-orrery-room': true }),
    );
    expect(unlocked).not.toContain('the-orrery-room');
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/caseProgression.test.ts`
Expected: the first two new tests FAIL (`the-orrery-room` never in the list); third may
pass vacuously — that's fine, the pair proves the behavior.

- [ ] **Step 3: Implement**

In `src/engine/caseProgression.ts`, append to `VIGNETTE_CONDITIONS`:

```ts
  {
    id: 'the-orrery-room',
    factionReputation: { faction: 'Hermetic Order of the Grey Dawn', threshold: 2 },
  },
```

(The faction key must be byte-identical to `src/engine/constants.ts` line 5.)

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/caseProgression.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/caseProgression.ts src/engine/__tests__/caseProgression.test.ts
git commit -m "feat(engine): register the-orrery-room vignette unlock (Grey Dawn rep >= 2)"
```

---

### Task 2: Vignette loader + adapter support optional recipes/variants (spec §2.1–2.4)

**Files:**
- Modify: `src/types/index.ts` (the `VignetteData` interface, ~line 341)
- Modify: `src/engine/contentLoader.ts` (`loadVignette`, ~line 103)
- Modify: `src/store/slices/narrativeSlice.ts` (`vignetteToCaseData`, ~line 18)
- Create: `src/engine/__tests__/contentLoader.vignette.test.ts`
- Test (adapter): `src/store/__tests__/narrativeSlice.test.ts`

- [ ] **Step 1: Write the failing loader tests**

Create `src/engine/__tests__/contentLoader.vignette.test.ts`. Mock `fetch` the way
`sharedSceneCache.test.ts` does (a URL→response map; 404 = rejected/`ok:false` response):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadVignette } from '../contentLoader';

const SHARED = { scenes: [] };
const META = { id: 'v-test', title: 'T', synopsis: 'S', firstScene: 'v-s1' };
const SCENES = { scenes: [{ id: 'v-s1', act: 1, narrative: 'n', cluesAvailable: [], choices: [] }] };
const CLUES = { clues: [] };
const NPCS = { npcs: [] };
const DEDUCTIONS = {
  deductions: [
    { id: 'v-recipe', requiredClues: [], title: 'R', description: 'd', isRedHerring: false },
  ],
};
const VARIANTS = {
  variants: [
    {
      id: 'v-s1-alt', act: 1, narrative: 'alt', cluesAvailable: [], choices: [],
      variantOf: 'v-s1', variantCondition: { type: 'hasFlag', target: 'x' },
    },
  ],
};

function mockFetch(files: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const key = Object.keys(files).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    return { ok: true, json: async () => files[key] };
  }));
}

const BASE_FILES = {
  'shared/scenes.json': SHARED,
  'meta.json': META,
  'scenes.json': SCENES,
  'clues.json': CLUES,
  'npcs.json': NPCS,
};

beforeEach(() => vi.unstubAllGlobals());

describe('loadVignette optional recipes/variants', () => {
  it('absent files -> recipes undefined, variants [] (existing vignettes unaffected)', async () => {
    mockFetch(BASE_FILES);
    const data = await loadVignette('v-test');
    expect(data.recipes).toBeUndefined();
    expect(data.variants ?? []).toEqual([]);
  });

  it('present files -> recipes and variants loaded', async () => {
    mockFetch({ ...BASE_FILES, 'deductions.json': DEDUCTIONS, 'variants.json': VARIANTS });
    const data = await loadVignette('v-test');
    expect(data.recipes).toHaveLength(1);
    expect(data.recipes![0].id).toBe('v-recipe');
    expect(data.variants).toHaveLength(1);
    expect(data.variants![0].variantOf).toBe('v-s1');
  });
});
```

> Note: check how `contentLoader.ts`'s `fetchJson` treats a non-`ok` response before
> finalizing the mock — mirror whatever `sharedSceneCache.test.ts` already stubs so the
> 404 path exercises the real `.catch` fallback.

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/contentLoader.vignette.test.ts`
Expected: FAIL — `VignetteData` has no `recipes`/`variants` (TS error) or values undefined
where the presence test expects data.

- [ ] **Step 3: Implement types + loader**

`src/types/index.ts` — extend `VignetteData`:

```ts
export interface VignetteData {
  meta: VignetteMeta;
  scenes: Record<string, SceneNode>;
  clues: Record<string, Clue>;
  npcs: Record<string, NPCState>;
  /** Optional key-deduction recipes (deductions.json) — vignettes may omit. */
  recipes?: KeyDeduction[];
  /** Optional variant scenes (variants.json) — vignettes may omit. */
  variants?: SceneNode[];
}
```

`src/engine/contentLoader.ts` — in `loadVignette`, after the existing `Promise.all`,
add (same idiom as `loadCase`'s optional `deductions.json`):

```ts
  // deductions.json / variants.json are optional — most vignettes ship neither.
  const recipes = await fetchJson<{ deductions: KeyDeduction[] }>(`${base}/deductions.json`)
    .then((f) => f.deductions)
    .catch(() => undefined);
  const variants = await fetchJson<{ variants: SceneNode[] }>(`${base}/variants.json`)
    .then((f) => f.variants)
    .catch(() => [] as SceneNode[]);
```

and return them: `return { meta, scenes, clues, npcs, recipes, variants };`

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/contentLoader.vignette.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing adapter test**

Append to `src/store/__tests__/narrativeSlice.test.ts` (it already imports or can import
`vignetteToCaseData`):

```ts
describe('vignetteToCaseData recipes/variants passthrough', () => {
  const baseVignette = {
    meta: { id: 'v', title: 't', synopsis: 's', firstScene: 'v-s1' },
    scenes: {}, clues: {}, npcs: {},
  };

  it('passes recipes and variants through', () => {
    const recipes = [{ id: 'r1', requiredClues: [], title: 'T', description: 'D', isRedHerring: false }];
    const variants = [{ id: 'v-s1-alt', act: 1, narrative: 'n', cluesAvailable: [], choices: [], variantOf: 'v-s1' }];
    const caseData = vignetteToCaseData({ ...baseVignette, recipes, variants });
    expect(caseData.recipes).toBe(recipes);
    expect(caseData.variants).toBe(variants);
  });

  it('defaults absent fields (backward compatible)', () => {
    const caseData = vignetteToCaseData({ ...baseVignette });
    expect(caseData.recipes).toBeUndefined();
    expect(caseData.variants).toEqual([]);
  });
});
```

- [ ] **Step 6: Run to verify RED**

Run: `npx vitest run src/store/__tests__/narrativeSlice.test.ts`
Expected: FAIL — adapter stubs `variants: []` and drops recipes.

- [ ] **Step 7: Implement the adapter**

`src/store/slices/narrativeSlice.ts`:

```ts
export function vignetteToCaseData(data: VignetteData): CaseData {
  return {
    ...data,
    meta: { ...data.meta, acts: 2, facultyDistribution: {} },
    variants: data.variants ?? [],
    recipes: data.recipes,
  };
}
```

- [ ] **Step 8: Run to verify GREEN, then full suite**

Run: `npx vitest run src/store/__tests__/narrativeSlice.test.ts` → PASS.
Run: `npm run test:run` → all pass (regression check: 4 shipped vignettes still load in
integration tests).

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/engine/contentLoader.ts src/store/slices/narrativeSlice.ts \
  src/engine/__tests__/contentLoader.vignette.test.ts src/store/__tests__/narrativeSlice.test.ts
git commit -m "feat(engine): vignettes load optional deductions.json + variants.json (spec §2.1-2.4)"
```

---

### Task 3: CLI validator reads vignette variants (Codex Blocker 2)

**Files:**
- Modify: `scripts/validateCase.ts` (`loadBundle`, ~lines 30–46)

No unit-test harness exists for `scripts/`; verification is behavioral via the validator
CLI (T6+ depends on this, and `tsconfig.scripts.json` type-checks it in the build).

- [ ] **Step 1: Implement**

In `loadBundle`, move the `variants.json` read OUT of the `isMainCase` branch so both
content types get it:

```ts
  if (isMainCase) {
    const act1 = readJson<{ scenes: SceneNode[] }>(join(dir, 'act1.json'));
    const act2 = readJson<{ scenes: SceneNode[] }>(join(dir, 'act2.json'));
    const act3 = readJson<{ scenes: SceneNode[] }>(join(dir, 'act3.json'));
    scenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  } else {
    scenes = readJson<{ scenes: SceneNode[] }>(join(dir, 'scenes.json')).scenes;
  }
  // variants.json is optional for BOTH cases and vignettes (Orrery Room spec §2.6):
  // vignette variants must reach validateBundle or they get no structural/Phase 5/
  // F-102 validation at all.
  if (existsSync(join(dir, 'variants.json'))) {
    variants = readJson<{ variants: SceneNode[] }>(join(dir, 'variants.json')).variants;
  }
```

(Delete the old `variants` read from inside the `isMainCase` block.)

- [ ] **Step 2: Verify**

Run: `npm run typecheck:scripts` → clean.
Run: `node scripts/validateCase.mjs` → 8 cases, zero errors, zero warnings (unchanged —
no vignette ships variants yet; T8 exercises the new path for real).

- [ ] **Step 3: Commit**

```bash
git add scripts/validateCase.ts
git commit -m "fix(validator): CLI loads variants.json for vignettes, not only main cases"
```

---

### Task 4: `computeDiscoverableClues` counts onEnter discoverClue (Codex Major 4)

**Files:**
- Modify: `src/engine/contentValidation.ts` (`computeDiscoverableClues`, ~line 615)
- Test: `src/engine/__tests__/contentValidation.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/contentValidation.test.ts` (reuse the file's existing
bundle-builder helpers; the shape below shows the required content):

```ts
describe('computeDiscoverableClues counts onEnter discoverClue (F-102 sibling parity)', () => {
  it('does not warn "never discoverable" for a clue granted only via onEnter', () => {
    const bundle = {
      scenes: [
        {
          id: 's1', act: 1, narrative: 'n', cluesAvailable: [],
          choices: [{
            id: 'c1', text: 'go',
            outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2' },
          }],
        },
        {
          id: 's2', act: 1, narrative: 'n', cluesAvailable: [], choices: [],
          onEnter: [{ type: 'discoverClue', target: 'clue-on-enter' }],
        },
      ],
      variants: [],
      clues: [{ id: 'clue-on-enter', title: 't', description: 'd', type: 'physical', discovered: false }],
      npcs: [],
      recipes: [],
      firstScene: 's1',
      sharedSceneIds: [],
    };
    const { warnings } = validateBundle(bundle, { includeReachability: true });
    expect(warnings.filter((w) => w.includes('never discoverable'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/contentValidation.test.ts`
Expected: FAIL — the warning fires because `computeDiscoverableClues` ignores `onEnter`.

- [ ] **Step 3: Implement**

In `computeDiscoverableClues`'s `collect`, add after the choices loop:

```ts
    // Parity with computeObtainableClues: an onEnter discoverClue IS a source.
    for (const effect of scene.onEnter ?? []) {
      if (effect.type === 'discoverClue' && effect.target) discoverable.add(effect.target);
    }
```

- [ ] **Step 4: Run to verify GREEN + validator baseline**

Run: `npx vitest run src/engine/__tests__/contentValidation.test.ts` → PASS.
Run: `node scripts/validateCase.mjs` → still zero errors / zero warnings (the fix only
*removes* false warnings).

- [ ] **Step 5: Commit**

```bash
git add src/engine/contentValidation.ts src/engine/__tests__/contentValidation.test.ts
git commit -m "fix(validator): onEnter discoverClue counts as a clue source in reachability warnings"
```

---

### Task 5: `KeyDeduction.onForm` — effects at formation time (Codex Major 5)

**Files:**
- Modify: `src/types/index.ts` (the `KeyDeduction` interface, ~line 101)
- Modify: `src/engine/contentValidation.ts` (recipe loop, ~line 144)
- Modify: `src/components/EvidenceBoard/EvidenceBoard.tsx` (`handleDeductionAttempt`, ~line 296)
- Create: `src/components/__tests__/EvidenceBoard.onForm.test.tsx`
- Test (validator): `src/engine/__tests__/contentValidation.deduction.test.ts`

- [ ] **Step 1: Extend the type**

`src/types/index.ts`:

```ts
export interface KeyDeduction {
  id: string;
  requiredClues: string[];
  title: string;
  description: string;
  isRedHerring: boolean;
  /**
   * Optional effects applied exactly once, at the moment this recipe's deduction
   * is first formed on the evidence board (never re-applied on repeat formation
   * or save/load — the deductions record is the once-guard). Orrery Room spec §2.8:
   * scene-entry effects can't record a mint that happens after entering a terminal
   * scene; formation-time effects can.
   */
  onForm?: Effect[];
}
```

- [ ] **Step 2: Write the failing validator test**

Append to `src/engine/__tests__/contentValidation.deduction.test.ts` (reuse its bundle
helpers):

```ts
it('validates onForm effect targets like any other effect list', () => {
  const bundle = bundleWith({
    recipes: [{
      id: 'r-onform', requiredClues: ['clue-a'], title: 'T', description: 'D',
      isRedHerring: false,
      onForm: [{ type: 'disposition', target: 'npc-missing', delta: 1 }],
    }],
  });
  const { errors } = validateBundle(bundle);
  expect(errors.some((e) => e.includes('npc-missing'))).toBe(true);
});
```

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/contentValidation.deduction.test.ts`
Expected: FAIL — `onForm` is never validated, no error emitted.

- [ ] **Step 4: Implement validator support**

In `validateBundle`'s recipe loop (`for (const recipe of bundle.recipes ?? [])`), add:

```ts
    for (const effect of recipe.onForm ?? []) {
      validateEffect(effect, `KeyDeduction "${recipe.id}" -> onForm`, ctx);
    }
```

Run the validator test → PASS.

- [ ] **Step 5: Write the failing board test**

Create `src/components/__tests__/EvidenceBoard.onForm.test.tsx`. Model setup on the
existing EvidenceBoard tests (see `src/components/__tests__/` for the store-seeding
pattern — seed `caseData` with clues + a recipe, add revealed clues, connect them, then
invoke formation). The behavioral assertions:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../store';

// Seed: two revealed clues, one recipe requiring both, with
// onForm: [{ type: 'flag', target: 'mythos-test-flag', value: true }].
// Drive formation the way existing board tests do (render EvidenceBoard, connect
// clue-a -> clue-b, fire handleDeductionAttempt via the DeductionButton onResult,
// or invoke the extracted formation handler if the existing tests do that).

describe('KeyDeduction.onForm', () => {
  it('applies onForm effects when the recipe deduction is formed', () => {
    // ...setup + form...
    expect(useStore.getState().flags['mythos-test-flag']).toBe(true);
  });

  it('does not re-apply onForm when the same recipe forms again', () => {
    // ...form once, clear the flag manually, reconnect the same clues, form again...
    useStore.getState().setFlag('mythos-test-flag', false);
    // ...second formation attempt...
    expect(useStore.getState().flags['mythos-test-flag']).toBe(false); // NOT re-set
  });
});
```

- [ ] **Step 6: Run to verify RED**

Run: `npx vitest run src/components/__tests__/EvidenceBoard.onForm.test.tsx`
Expected: FAIL — flag never set.

- [ ] **Step 7: Implement in the board**

In `EvidenceBoard.tsx`:

1. Add store hooks near the existing ones (~line 109):

```ts
  const applyEffects = useStore((s) => s.applyEffects);
```

2. In `handleDeductionAttempt`'s recipe branch (~line 318), apply `onForm` **only for
   recipes not already formed** (the deductions record is the once-guard — check BEFORE
   `addDeduction` overwrites it):

```ts
        if (comp.recipes.length > 0) {
          // Blocker 1: form EVERY matched recipe, not just one.
          const members = new Set<string>();
          const alreadyFormed = useStore.getState().deductions;
          for (const r of comp.recipes) {
            const isNew = !alreadyFormed[r.id];
            addDeduction(buildDeductionFromRecipe(r, comp.clueIds));
            // onForm fires exactly once per playthrough: only on first formation
            // (spec §2.8 — formation-time so a mint on a terminal scene still records).
            if (isNew && r.onForm?.length) applyEffects(r.onForm);
            for (const id of r.requiredClues) members.add(id);
            formedCount += 1;
          }
          deducedIds = [...members];
        }
```

- [ ] **Step 8: Run to verify GREEN, then full suite + lint**

Run: `npx vitest run src/components/__tests__/EvidenceBoard.onForm.test.tsx` → PASS.
Run: `npm run test:run` → all pass. Run: `npm run lint` → clean.

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/engine/contentValidation.ts \
  src/components/EvidenceBoard/EvidenceBoard.tsx \
  src/components/__tests__/EvidenceBoard.onForm.test.tsx \
  src/engine/__tests__/contentValidation.deduction.test.ts
git commit -m "feat(engine): KeyDeduction.onForm — effects applied once at formation time (spec §2.8)"
```

---

### Task 6: Content skeleton — meta, manifest, NPCs, clues, recipes

**Files:**
- Create: `public/content/side-cases/the-orrery-room/meta.json`
- Create: `public/content/side-cases/the-orrery-room/npcs.json`
- Create: `public/content/side-cases/the-orrery-room/clues.json`
- Create: `public/content/side-cases/the-orrery-room/deductions.json`
- Modify: `public/content/manifest.json`

> The validator cannot pass until scenes exist (T7/T8) — clue `sceneSource` references
> forward-reference scene ids defined below. Run the validator at the END of T7 and T8,
> not here. Prose in these files is final copy — write it to the tone bar (measured,
> atmospheric, never campy), using the beats given.

- [ ] **Step 1: meta.json**

```json
{
  "id": "the-orrery-room",
  "title": "The Orrery Room",
  "synopsis": "The Hermetic Order of the Grey Dawn asks you — politely, which is itself alarming — to appraise an orrery seized from a dead member's estate before the Order's factions go to war over it. It is beautiful, old, and wrong: it models a sky with one body too many.",
  "firstScene": "or-act1-summons",
  "triggerCondition": {
    "type": "factionReputation",
    "target": "Hermetic Order of the Grey Dawn",
    "value": 2
  }
}
```

- [ ] **Step 2: manifest.json entry**

Append to the `cases` array (after `the-unfinished-case`):

```json
    {
      "id": "the-orrery-room",
      "title": "The Orrery Room",
      "synopsis": "The Grey Dawn asks you to appraise an orrery seized from a dead member's estate before the Order's factions go to war over it. It models a sky with one body too many.",
      "type": "vignette",
      "triggerCondition": {
        "type": "factionReputation",
        "target": "Hermetic Order of the Grey Dawn",
        "value": 2
      }
    }
```

- [ ] **Step 3: npcs.json** — 3 NPCs, matching the shipped NPC shape (copy field set from
`the-rationalists-dilemma/npcs.json`; disposition/suspicion start 0 unless noted):

| id | name | faction | disposition seed | voice brief |
|---|---|---|---|---|
| `npc-vervain` | Sister Vervain | `Hermetic Order of the Grey Dawn` | 0 | Iconoclast. Wants the orrery destroyed. Speaks in short declaratives; treats the investigator as an instrument, then — if respected — as a colleague. Her fear is real and never stated. |
| `npc-coyle` | Magister Coyle | `Hermetic Order of the Grey Dawn` | 1 | Preservationist. Wants it enshrined. Expansive, scholarly warmth over an acquisitive core; quotes dead members approvingly. |
| `npc-finch` | Mr. Abelard Finch | `Rationalists Circle` | 0 | Horologist consulted for the appraisal. Found the gearing sound and cannot say so. Precise, miserable, over-explains small mechanisms to avoid the large one. |

- [ ] **Step 4: clues.json** — 7 clues (shape per shipped clues; `discovered: false`):

| id | type | sceneSource | title | description brief |
|---|---|---|---|---|
| `or-clue-gear-train` | `physical` | `or-act1-orrery-room` | The Thirteenth Gear Train | No forger's shortcuts anywhere in it; wear consistent with centuries of running. Whoever added the extra body did so when the orrery was made. |
| `or-clue-finch-admission` | `testimony` | `or-act1-finch-admission` | Finch's Private Admission | The gearing is sound, original, and correct to a tolerance he cannot reproduce — and he will deny saying so. |
| `or-clue-adjustment-diary` | `occult` | `or-act1-collectors-rooms` | The Adjustment Diary | Months of nightly corrections in the collector's hand. The entries do not degrade as his health fails. The handwriting improves. |
| `or-clue-laudanum-arithmetic` | `physical` | `or-act1-collectors-rooms` | The Laudanum Arithmetic | Bottle, dosage book, pharmacist's dates. The sums are exact and the conclusion is ordinary: a failing heart, hastened. |
| `or-clue-orrery-period` | `occult` | `or-act1-period-match` | The Extra Body's Period | The thirteenth gearing resolves to a period. You have seen the figure before, computed by a dead astronomer's hand. |
| `or-clue-night-observation` | `occult` | `or-act2-night-vigil` | What the Orrery Does at Night | Left running in the dark, the twelve bodies orbit. The thirteenth does something else. |
| `or-clue-forged-provenance` | `redHerring` | `or-act1-seller` | The Forged Provenance | The paperwork is fake — recent ink, wrong watermarks. A seller's fraud wrapped around a genuine article. |

Add `connectsTo` edges (undirected authored hints for the generic oracle path):
- `or-clue-gear-train` ↔ `or-clue-finch-admission` (the genuine-instrument recipe pair)
- `or-clue-adjustment-diary` ↔ `or-clue-night-observation` (the occult strand)
- `or-clue-forged-provenance` ↔ `or-clue-gear-train` (the authored trap — spec §4:
  a provenance+gear-train-only component forms a **false generic** deduction)
- `or-clue-orrery-period` ↔ `or-clue-adjustment-diary` and `or-clue-orrery-period` ↔
  `or-clue-night-observation` (keystone strand)

(Match the exact `connectsTo` field shape used by shipped clues — check
`the-comet-club/clues.json`.)

- [ ] **Step 5: deductions.json**

```json
{
  "deductions": [
    {
      "id": "or-genuine-instrument",
      "requiredClues": ["or-clue-gear-train", "or-clue-finch-admission"],
      "title": "A Genuine Instrument",
      "description": "The gear train carries no forger's shortcuts and the one man qualified to fake doubt could not manage it. The orrery is exactly as old as it looks, and the thirteenth body was always there.",
      "isRedHerring": false
    },
    {
      "id": "mythos-pattern-named",
      "requiredClues": ["or-clue-orrery-period", "or-clue-adjustment-diary", "or-clue-night-observation"],
      "title": "The Period Holds",
      "description": "The dead astronomer's figure, the collector's corrections, the thirteenth body's motion at night: three hands, none acquainted, keeping the same number. The orrery is not predicting anything. It is keeping time with it.",
      "isRedHerring": false,
      "onForm": [
        { "type": "flag", "target": "mythos-pattern-named", "value": true }
      ]
    }
  ]
}
```

(Note the description names no pattern — it describes convergence only. Keep it that way.)

- [ ] **Step 6: Commit**

```bash
git add public/content/side-cases/the-orrery-room/ public/content/manifest.json
git commit -m "content: Orrery Room skeleton — meta, manifest entry, 3 NPCs, 7 clues, 2 recipes"
```

---

### Task 7: Act 1 scenes (10 scenes)

**Files:**
- Create: `public/content/side-cases/the-orrery-room/scenes.json` (act-1 half)

Prose is final copy, 2–4 paragraphs per scene, tone bar as above. Structure is binding;
narrative briefs say what each scene must accomplish. Every choice id below is binding
(witness tests reference them). Choices marked *(check)* carry `faculty` + `difficulty`
+ four `outcomes` (all four tiers required; `partial` routes where noted).

- [ ] **Step 1: Author the act-1 scenes**

**`or-act1-summons`** (first scene) — The chapterhouse. The Order's request delivered
with unbearable courtesy. Brief: establish the commission, the dead collector
(unnamed member, rooms sealed), and that both factions are watching the appraisal.
Choices (ungated): `or-choice-summons-accept` → `or-act1-commission`.

**`or-act1-commission`** — Vervain and Coyle, together, briefly, hating it. Each states
their position in two sentences; the player feels the war under the varnish. onEnter:
none. Choices: `or-choice-commission-orrery` → `or-act1-orrery-room`;
`or-choice-commission-rooms` → `or-act1-collectors-rooms`.

**`or-act1-orrery-room`** (hub — revisitable) — The machine itself, running. Brief:
the orrery described exactly once in full; the thirteenth body present but never
emphasized by the narrator. cluesAvailable:
`{ "clueId": "or-clue-gear-train", "method": "exploration" }`.
Choices:
- `or-choice-hub-rooms` (ungated) → `or-act1-collectors-rooms`
- `or-choice-hub-finch` (ungated) → `or-act1-finch-workshop`
- `or-choice-hub-gallery` (ungated) → `or-act1-whispering-gallery`
- `or-choice-hub-onward` (ungated) → `or-act1-close`
- **`or-choice-hub-period-match`** — the keystone choice (spec §5):

```json
{
  "id": "or-choice-hub-period-match",
  "text": "Set the extra body's gearing against a figure you have seen before.",
  "faculty": "reason",
  "difficulty": 12,
  "requiresFlag": "mythos-period-computed",
  "visibility": "disabled",
  "gateReason": "The gearing implies a period. You have nothing to set it against.",
  "outcomes": {
    "critical": "or-act1-period-match",
    "success": "or-act1-period-match",
    "partial": "or-act1-period-match",
    "failure": "or-act1-orrery-room"
  }
}
```

(Failure routes back to the hub — retry allowed, keystone never lost to one roll.
`partial` counts as success here: the comparison either lands or it doesn't; the tier
flavours the check overlay only.)

**`or-act1-period-match`** — The comparison lands. Brief: the number agrees; the prose
reports the agreement and the silence in the room afterward, and does NOT say what it
means. onEnter:

```json
[{ "type": "discoverClue", "target": "or-clue-orrery-period", "description": "The figures agree. You write nothing down." }]
```

Choices: `or-choice-period-back` (ungated) → `or-act1-orrery-room`.
**This scene must be the clue's SOLE source and the flag-gated choice its sole inbound
edge** (spec §4 — flagless unobtainability by construction).

**`or-act1-collectors-rooms`** — Sealed rooms; dust regimes; the diary open on the desk.
cluesAvailable:
`{ "clueId": "or-clue-adjustment-diary", "method": "exploration" }`,
`{ "clueId": "or-clue-laudanum-arithmetic", "method": "check", "requiresFaculty": { "faculty": "perception", "minimum": 8 } }`.
Choices: `or-choice-rooms-back` → `or-act1-orrery-room`; `or-choice-rooms-finch` →
`or-act1-finch-workshop`.

**`or-act1-finch-workshop`** — Finch among his escapements, over-explaining. Brief: he
has finished the appraisal and not delivered it. Choices:
- `or-choice-finch-press` *(check: influence, difficulty 13)* — outcomes: critical/
  success → `or-act1-finch-admission`; partial → `or-act1-finch-doorstep`; failure →
  `or-act1-finch-doorstep`.
- `or-choice-finch-leave` (ungated) → `or-act1-orrery-room`.

**`or-act1-finch-admission`** — He tells the truth once, quietly, with the door shut.
onEnter: `[{ "type": "discoverClue", "target": "or-clue-finch-admission" }, { "type": "disposition", "target": "npc-finch", "delta": 1 }]`.
Choices: `or-choice-admission-back` → `or-act1-orrery-room`.

**`or-act1-finch-doorstep`** — He shows you out with unfailing manners and gives you
nothing. Brief: the refusal itself is information; a Mesmerist hook in flavour only.
Choices: `or-choice-doorstep-back` → `or-act1-orrery-room` (hub is revisitable —
the influence check can be retried on a later visit).

**`or-act1-whispering-gallery`** — The map-and-curio trade; the seller found by asking
wrong questions correctly. Choices: `or-choice-gallery-seller` (ungated) →
`or-act1-seller`; `or-choice-gallery-back` → `or-act1-orrery-room`.

**`or-act1-seller`** — The previous seller, cornered politely. cluesAvailable:
`{ "clueId": "or-clue-forged-provenance", "method": "exploration" }`. Brief: he forged
the provenance to move an article he could not date; his fraud is real and his fear of
the article is older than the fraud. Choices: `or-choice-seller-back` →
`or-act1-orrery-room`.

**`or-act1-close`** — Act transition. Brief: the appraisal is due; the Order offers the
chapterhouse's hospitality for the night; the player knows the instrument question and
the death question are separate. Choices: `or-choice-close-vigil` (ungated) →
`or-act2-night-vigil`. (`act: 1` for all scenes above; `act: 2` below.)

- [ ] **Step 2: Validate**

Run: `node scripts/validateCase.mjs public/content/side-cases/the-orrery-room`
Expected: errors ONLY for the not-yet-authored act-2 scene references
(`or-act2-night-vigil`) — every other reference resolves. (If the validator has no
single-target mode flag, run it plain and filter output for `the-orrery-room`.)

- [ ] **Step 3: Commit**

```bash
git add public/content/side-cases/the-orrery-room/scenes.json
git commit -m "content: Orrery Room act 1 — 10 scenes incl. keystone period-match beat (Phase 5 disabled-with-reason)"
```

---

### Task 8: Act 2 scenes (8 scenes) + variants (4)

**Files:**
- Modify: `public/content/side-cases/the-orrery-room/scenes.json` (append act-2 scenes)
- Create: `public/content/side-cases/the-orrery-room/variants.json`

- [ ] **Step 1: Author the act-2 scenes**

**`or-act2-night-vigil`** — Alone with the running orrery at night. Choice
`or-choice-vigil-watch` *(check: nerve, difficulty 12)*: critical/success →
`or-act2-vigil-held`; partial/failure → `or-act2-vigil-broken`. Brief: the vigil scene
carries the dread; the machine's sound changes when the gas is down.

**`or-act2-vigil-held`** — The player holds and watches. cluesAvailable:
`{ "clueId": "or-clue-night-observation", "method": "automatic" }`. Brief: twelve bodies
orbit; the thirteenth does something else — describe the difference behaviorally
(pauses, waits, resumes), never interpretively. Choices: `or-choice-vigil-morning` →
`or-act2-dosage`.

**`or-act2-vigil-broken`** — Nerve fails; the player leaves the room before dawn.
onEnter: `[{ "type": "composure", "delta": -1 }]`. The clue is NOT granted here — but
the scene offers `or-choice-vigil-return` *(check: nerve, difficulty 12)*: critical/
success → `or-act2-vigil-held`; partial/failure → `or-act2-dosage` (the night is spent;
the observation clue is missable, and with it the keystone — acceptable: the keystone
is optional by design). Also `or-choice-vigil-leave` (ungated) → `or-act2-dosage`.

**`or-act2-dosage`** (critical path) — Morning; the death resolved. Brief: the laudanum
arithmetic walked through in prose; the death is heart failure, hastened, ordinary, and
sad. If the player holds `or-clue-laudanum-arithmetic` this lands as confirmation;
either way the scene states the mundane conclusion plainly (every player gets the full
mundane solution — spec §3.8). Choices: `or-choice-dosage-vervain` →
`or-act2-vervain-pressure`; `or-choice-dosage-coyle` → `or-act2-coyle-pressure`;
`or-choice-dosage-verdict` (ungated) → `or-act2-verdict-hub`.

**`or-act2-vervain-pressure`** — Her case and her offer. Brief: destruction as mercy;
what she has seen members become. Choices: `or-choice-vervain-coyle` →
`or-act2-coyle-pressure`; `or-choice-vervain-verdict` → `or-act2-verdict-hub`.

**`or-act2-coyle-pressure`** — His case and his offer. Brief: enshrinement as
stewardship; the Order keeps what it fears, that is what the Order is for. Choices:
`or-choice-coyle-vervain` → `or-act2-vervain-pressure`; `or-choice-coyle-verdict` →
`or-act2-verdict-hub`.

**`or-act2-verdict-hub`** — The appraisal delivered; the choice of verdicts. Choices:
- `or-choice-verdict-vervain` (ungated) → `or-act2-ending-destroyed`
- `or-choice-verdict-coyle` (ungated) → `or-act2-ending-enshrined`
- `or-choice-verdict-broker`:

```json
{
  "id": "or-choice-verdict-broker",
  "text": "Propose that the Order seal the orrery under joint custody — neither destroyed nor enshrined.",
  "faculty": "influence",
  "difficulty": 13,
  "requiresDeduction": "or-genuine-instrument",
  "outcomes": {
    "critical": "or-act2-ending-sealed",
    "success": "or-act2-ending-sealed",
    "partial": "or-act2-verdict-hub",
    "failure": "or-act2-verdict-hub"
  }
}
```

(Default `hidden` visibility — an unearned verdict shouldn't advertise itself, spec
§3.10. Partial/failure return to the hub: the two partisan endings remain available, so
no soft-lock and the scene always has ungated choices.)

**`or-act2-ending-destroyed`** — Terminal (choices: `[]`). Brief: the breaking of a
machine that took centuries to be wrong; Vervain does it herself; the sound it makes
is the worst line in the vignette and must be understated. onEnter (disposition BEFORE
reputation — clamp-ordering rule, spec §3):

```json
[
  { "type": "disposition", "target": "npc-coyle", "delta": -3 },
  { "type": "reputation", "target": "Hermetic Order of the Grey Dawn", "delta": 2 },
  { "type": "flag", "target": "or-case-complete", "value": true },
  { "type": "flag", "target": "or-orrery-destroyed", "value": true }
]
```

**`or-act2-ending-enshrined`** — Terminal. Brief: the orrery installed in the Order's
inner rooms; Coyle's gratitude; the last line notes it is still running. onEnter:

```json
[
  { "type": "disposition", "target": "npc-vervain", "delta": -3 },
  { "type": "reputation", "target": "Hermetic Order of the Grey Dawn", "delta": 2 },
  { "type": "flag", "target": "or-case-complete", "value": true },
  { "type": "flag", "target": "or-orrery-enshrined", "value": true }
]
```

**`or-act2-ending-sealed`** — Terminal. Brief: joint custody, both factions bound,
neither satisfied; the compromise as craft. onEnter:

```json
[
  { "type": "disposition", "target": "npc-vervain", "delta": 1 },
  { "type": "disposition", "target": "npc-coyle", "delta": 1 },
  { "type": "reputation", "target": "Hermetic Order of the Grey Dawn", "delta": 1 },
  { "type": "flag", "target": "or-case-complete", "value": true },
  { "type": "flag", "target": "or-orrery-sealed", "value": true }
]
```

- [ ] **Step 2: Author variants.json (4 variants)**

**`or-act2-night-vigil-veil`** — `variantOf: "or-act2-night-vigil"`,
`variantCondition: { "type": "hasFlag", "target": "ability-veil-sight-active" }`.
Identical `cluesAvailable` and choices to the base night-vigil scene; narrative adds ONE
paragraph — the Occultist perceives the extra body's motion as *arrival, not orbit*.
Never explained (spec §3.7; the Mayfair Séance veil-variant idiom).

**Three ending variants** — `or-act2-ending-destroyed-named` / `-enshrined-named` /
`-sealed-named`, each `variantOf` its base ending,
`variantCondition: { "type": "hasDeduction", "target": "mythos-pattern-named" }`,
same onEnter as the base (variants replace the scene wholesale — copy the base
effect list verbatim; onEnter fires once per resolved scene id, no double-fire), same
empty choices; narrative = base narrative + ONE closing paragraph: the player leaves
knowing what the number is, and says nothing. The pattern is not named.

- [ ] **Step 3: Validate — full run, zero/zero**

Run: `node scripts/validateCase.mjs`
Expected: **9 units (8 cases + new vignette), zero errors, zero warnings.** This
exercises T3 (vignette variants now loaded) and T4 (onEnter clue source) for real.
Fix any finding before committing.

- [ ] **Step 4: Full suite**

Run: `npm run test:run` → all pass (integration tests load all content).

- [ ] **Step 5: Commit**

```bash
git add public/content/side-cases/the-orrery-room/
git commit -m "content: Orrery Room act 2 — vigil, dosage resolution, 3 endings + 4 variants (veil sight, keystone-named)"
```

---

### Task 9: Content-backed witness tests

**Files:**
- Create: `src/engine/__tests__/orreryRoom.content.test.ts`

Model on `phase5DemoChoice.test.ts`: load the real JSON with `readFileSync` (no fetch),
assert against actual shipped content. All ids referenced here were fixed in T6–T8.

- [ ] **Step 1: Write the tests** (these are GREEN-on-arrival guards against future
content edits — mutation-check each by temporarily breaking the content field it
watches, seeing it fail, and restoring):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Clue, KeyDeduction, SceneNode, Choice } from '../../types';
import { choiceGateConditions, resolveChoiceVisibility } from '../choiceVisibility';

const DIR = join(__dirname, '../../../public/content/side-cases/the-orrery-room');
const scenes: SceneNode[] = JSON.parse(readFileSync(join(DIR, 'scenes.json'), 'utf-8')).scenes;
const variants: SceneNode[] = JSON.parse(readFileSync(join(DIR, 'variants.json'), 'utf-8')).variants;
const clues: Clue[] = JSON.parse(readFileSync(join(DIR, 'clues.json'), 'utf-8')).clues;
const recipes: KeyDeduction[] = JSON.parse(readFileSync(join(DIR, 'deductions.json'), 'utf-8')).deductions;

const allScenes = [...scenes, ...variants];
const sceneById = (id: string) => allScenes.find((s) => s.id === id)!;
const allChoices = allScenes.flatMap((s) => s.choices.map((c) => ({ scene: s.id, choice: c })));

describe('keystone gating chain (spec §4/§5)', () => {
  const KEYSTONE_CLUE = 'or-clue-orrery-period';
  const COMPARISON = 'or-act1-period-match';

  it('the comparison scene is the keystone clue\'s SOLE source', () => {
    for (const s of allScenes) {
      const inClues = (s.cluesAvailable ?? []).some((d) => d.clueId === KEYSTONE_CLUE);
      const inOnEnter = (s.onEnter ?? []).some(
        (e) => e.type === 'discoverClue' && e.target === KEYSTONE_CLUE,
      );
      if (s.id === COMPARISON) expect(inOnEnter).toBe(true);
      else expect(inClues || inOnEnter).toBe(false);
    }
  });

  it('the flag-gated choice is the comparison scene\'s sole inbound edge', () => {
    const inbound = allChoices.filter(({ choice }) =>
      Object.values(choice.outcomes ?? {}).includes(COMPARISON),
    );
    expect(inbound).toHaveLength(1);
    expect(inbound[0].choice.id).toBe('or-choice-hub-period-match');
    expect(inbound[0].choice.requiresFlag).toBe('mythos-period-computed');
  });

  it('keystone choice is disabled-with-reason flagless, selectable with the flag', () => {
    const choice = sceneById('or-act1-orrery-room').choices.find(
      (c) => c.id === 'or-choice-hub-period-match',
    )!;
    expect(choice.visibility).toBe('disabled');
    expect(choice.gateReason).toBeTruthy();
    // Resolve through the real Phase 5 resolver, flagless then flagged
    // (match resolveChoiceVisibility's actual GameState-shaped signature —
    // see choiceVisibility.test.ts for the state fixture it uses):
    const flagless = resolveChoiceVisibility(choice, stateWith({ flags: {} }));
    expect(flagless).toBe('disabled'); // locked list, non-interactive
    const flagged = resolveChoiceVisibility(
      choice, stateWith({ flags: { 'mythos-period-computed': true } }),
    );
    expect(flagged).toBe('shown');
  });

  it('the hub always carries ungated choices (no soft-lock)', () => {
    const hub = sceneById('or-act1-orrery-room');
    const ungated = hub.choices.filter((c) => choiceGateConditions(c).length === 0);
    expect(ungated.length).toBeGreaterThanOrEqual(1);
  });

  it('the keystone recipe carries the onForm persistent flag', () => {
    const keystone = recipes.find((r) => r.id === 'mythos-pattern-named')!;
    expect(keystone.onForm).toEqual([
      { type: 'flag', target: 'mythos-pattern-named', value: true },
    ]);
    expect(keystone.requiredClues).toContain(KEYSTONE_CLUE);
  });
});

describe('endings (spec §3.10)', () => {
  const ENDINGS = ['or-act2-ending-destroyed', 'or-act2-ending-enshrined', 'or-act2-ending-sealed'];

  it('all three endings exist, are terminal, and set or-case-complete', () => {
    for (const id of ENDINGS) {
      const s = sceneById(id);
      expect(s.choices).toEqual([]);
      expect(s.onEnter).toContainEqual({ type: 'flag', target: 'or-case-complete', value: true });
    }
  });

  it('two partisan endings are reachable via ungated verdict choices (flagless completability)', () => {
    const hub = sceneById('or-act2-verdict-hub');
    for (const target of ['or-act2-ending-destroyed', 'or-act2-ending-enshrined']) {
      const route = hub.choices.find(
        (c) => choiceGateConditions(c).length === 0 && Object.values(c.outcomes ?? {}).includes(target),
      );
      expect(route, `ungated route to ${target}`).toBeTruthy();
    }
  });

  it('the brokered ending is gated on the genuine-instrument deduction', () => {
    const broker = sceneById('or-act2-verdict-hub').choices.find(
      (c) => c.id === 'or-choice-verdict-broker',
    )!;
    expect(broker.requiresDeduction).toBe('or-genuine-instrument');
  });

  it('disposition effects precede the reputation effect in every ending (clamp-ordering rule)', () => {
    for (const id of ENDINGS) {
      const effects = sceneById(id).onEnter ?? [];
      const lastDisposition = effects.map((e) => e.type).lastIndexOf('disposition');
      const firstReputation = effects.map((e) => e.type).indexOf('reputation');
      expect(lastDisposition).toBeLessThan(firstReputation);
    }
  });

  it('each ending has a keystone-named variant gated on hasDeduction', () => {
    for (const id of ENDINGS) {
      const v = variants.find((x) => x.variantOf === id);
      expect(v, `variant of ${id}`).toBeTruthy();
      expect(v!.variantCondition).toEqual({ type: 'hasDeduction', target: 'mythos-pattern-named' });
      expect(v!.choices).toEqual([]);
      expect(v!.onEnter).toEqual(sceneById(id).onEnter); // wholesale replacement, same effects
    }
  });
});

describe('rep clamp behavior at the boundary (spec §3 rep-math note)', () => {
  // Store-level: apply a partisan ending's effect list from mid-range and near-clamp
  // reputations via the real worldSlice applyEffects + npcSlice propagation, and
  // assert net movement. Seed the store the way sliceIsolation.property.test.ts does.
  it('partisan ending nets +0.5 from mid-range rep', () => { /* rep 0 -> expect 0.5 */ });
  it('partisan ending never *increases* loss ordering at the clamp (rep 10 -> >= 8.5, ordering honored)', () => {
    /* disposition first (-1.5 -> 8.5), then +2 clamps to 10 -> final 10; assert final >= 8.5 and
       specifically == 10 with the authored order (disposition-before-reputation) */
  });
});
```

(The two clamp tests must be REAL — seed the actual store, run `applyEffects` with the
ending's literal onEnter array read from content, assert
`factionReputation['Hermetic Order of the Grey Dawn']`. Flesh out the bodies; no
`expect(true)` stubs. And note the ordering asymmetry the second test encodes: with
disposition-first the +2 lands last and clamps UP to 10 — the authored order is
strictly better at the boundary, which is the point of the rule.)

- [ ] **Step 2: Run + mutation-verify**

Run: `npx vitest run src/engine/__tests__/orreryRoom.content.test.ts` → PASS.
Mutation-check at least: flip the keystone choice's `visibility` to `"hidden"` → sole-
gating test fails; swap an ending's effect order → ordering test fails. Restore.

- [ ] **Step 3: Full gate**

Run: `npm run test:run && npm run lint && node scripts/validateCase.mjs` → all green,
zero/zero.

- [ ] **Step 4: Commit**

```bash
git add src/engine/__tests__/orreryRoom.content.test.ts
git commit -m "test: Orrery Room content witness tests — keystone chain, endings, clamp ordering"
```

---

### Task 10: Docs

**Files:**
- Modify: `docs/status.md` — content inventory: 9 units; add the-orrery-room row
  (scene/clue/NPC counts from the validator output); update test baseline after T9.
- Modify: `docs/engine-reference.md` — `loadVignette` now loads optional
  `deductions.json`/`variants.json`; `KeyDeduction.onForm` semantics (applied once at
  first formation by the board via `applyEffects`; validated like other effect lists);
  `computeDiscoverableClues` counts `onEnter` sources; `VIGNETTE_CONDITIONS` gains
  the-orrery-room.
- Modify: `docs/content-authoring.md` — vignettes MAY ship `deductions.json` +
  `variants.json` (same shapes as cases); `onForm` authoring rules (use for persistent
  flags that must record a deduction mint; effects must be idempotent-safe since the
  once-guard is per-playthrough); the disposition-before-reputation ordering rule for
  faction-aligned NPC ending effects.
- Modify: `docs/architecture.md` — EvidenceBoard formation now applies `onForm` once
  per newly formed recipe.

- [ ] **Step 1: Make the edits** (each doc owns its facts — no cross-restating).
- [ ] **Step 2: Verify claims** — every stated count/behavior against the code/validator
  output, not memory.
- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: vignette recipes/variants, KeyDeduction.onForm, Orrery Room inventory"
```

---

### Task 11: Full gate + reviews (protocol, not code)

- [ ] **Step 1:** Full gate: `npm run test:run` + `npm run lint` +
  `node scripts/validateCase.mjs` (zero/zero) + `npm run build` — all green.
- [ ] **Step 2:** Content-integrity reviewer subagent over
  `public/content/side-cases/the-orrery-room/` (design/tone layer). Fold findings,
  separate commits.
- [ ] **Step 3:** Whole-branch integration review (internal). Fold findings.
- [ ] **Step 4:** Live Playwright verify: unlock via Grey Dawn rep (edited save);
  keystone choice locked flagless (🔒 + reason, non-focusable) and selectable with
  `mythos-period-computed`; form the keystone on the board → `mythos-pattern-named`
  flag set; ending variant renders with the extra paragraph; all three endings
  reachable; zero console errors.
- [ ] **Step 5:** Codex implementation pass (ADR-0013 checkpoint 3): write
  `codex/input/2026-07-17-orrery-room-impl.md` (branch + diff range + spec/plan paths +
  production files + adversarial charge), user runs it, fold findings from
  `codex/output/2026-07-17-orrery-room-impl-review.md`.
- [ ] **Step 6:** Push branch, open PR (merge commit, never squash), `/checkpoint`.

---

## Self-review notes (already applied)

- Spec §2.5→T1, §2.1–2.4→T2, §2.6→T3, §2.7→T4, §2.8→T5, §3/§5 content→T6–T8,
  §8 witness tests→T9, docs→T10, §8 pipeline→T11. §7 out-of-scope respected (no oracle/
  save-schema changes; the pre-change-save compatibility case is covered by T2's
  absent-files test + the unchanged `loadGame` path).
- Type names checked: `VignetteData.recipes?/variants?` (T2) match T5's
  `KeyDeduction.onForm?` and T9's imports; choice/scene ids in T9 all defined in T7/T8.
- Known judgment calls the implementer must NOT "fix": the night-observation clue (and
  therefore the keystone) is missable on a failed nerve chain — intentional (optional
  thread); the brokered ending choice is `hidden` not `disabled` — intentional (§3.10).
