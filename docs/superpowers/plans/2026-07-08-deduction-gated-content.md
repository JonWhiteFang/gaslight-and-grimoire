# Deduction-Gated Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give deductions a stable, authorable identity ("key deduction recipes") so `hasDeduction`/`requiresDeduction` gates finally work, then author one deduction-gated true ending in each of the three main cases.

**Architecture:** A new `KeyDeduction` content type (id + required clue set) lives in a per-case `deductions.json`, loaded onto `caseData.recipes`. A pure `matchDeduction(connectedIds, recipes)` uses **subset** matching; `DeductionButton` stores a matched deduction under the recipe's authored id (so gates resolve) and falls back to the existing random-id generic deduction when nothing matches. The content validator gains rules for recipe clue refs and `requiresDeduction`/`hasDeduction` targets. Then three cases each get one recipe, one gated `requiresDeduction` choice in the reckoning scene, and one new true-ending scene.

**Tech Stack:** TypeScript, React 18, Zustand + Immer, Vitest (+ fast-check), Vite. Content is JSON under `public/content/`. Engine is pure functions under `src/engine/`.

---

## File Structure

**Engine / types (the mechanic):**
- `src/types/index.ts` — add `KeyDeduction` interface; add optional `recipes?: KeyDeduction[]` to `CaseData`.
- `src/engine/buildDeduction.ts` — add pure `matchDeduction`; add `buildDeductionFromRecipe`.
- `src/engine/narrativeEngine.ts` — `loadCase` fetches `deductions.json` → `caseData.recipes`.
- `src/engine/contentValidation.ts` — validate recipe clue refs + `requiresDeduction`/`hasDeduction` targets against a recipe-id registry.
- `scripts/validateCase.ts` — read `deductions.json` into the CLI bundle.
- `src/components/EvidenceBoard/DeductionButton.tsx` — use `matchDeduction` to store under the authored id.

**Tests:**
- `src/engine/__tests__/matchDeduction.test.ts` (new)
- `src/engine/__tests__/contentValidation.test.ts` (extend, or new `contentValidation.deduction.test.ts`)

**Content (per case — Whitechapel, Mayfair, Lamplighter's):**
- `public/content/cases/<case>/deductions.json` (new)
- `public/content/cases/<case>/act3.json` (add one gated choice to the reckoning scene + one new true-ending scene)

---

## Task 1: Add the `KeyDeduction` type and `recipes` on `CaseData`

**Files:**
- Modify: `src/types/index.ts` (Evidence section ~line 74; `CaseData` ~line 257)

- [ ] **Step 1: Add the `KeyDeduction` interface**

In `src/types/index.ts`, immediately after the `Deduction` interface (ends ~line 81), add:

```typescript
/**
 * An authored "key deduction" recipe. When the player connects a set of clues
 * whose ids are a superset of `requiredClues`, the resulting Deduction is stored
 * under this stable `id` (instead of a random one), so `hasDeduction` /
 * `requiresDeduction` gates can reference it. Authored in a case's deductions.json.
 */
export interface KeyDeduction {
  id: string;
  requiredClues: string[];
  title: string;
  description: string;
  isRedHerring: boolean;
}
```

- [ ] **Step 2: Add `recipes` to `CaseData`**

In `src/types/index.ts`, in the `CaseData` interface (~line 257), add a line after `variants`:

```typescript
export interface CaseData {
  meta: CaseMeta;
  scenes: Record<string, SceneNode>; // all scenes keyed by id
  clues: Record<string, Clue>;
  npcs: Record<string, NPCState>;
  variants: SceneNode[];
  /** Authored key-deduction recipes (main cases only; optional so vignettes may omit). */
  recipes?: KeyDeduction[];
}
```

> `recipes` is **optional** on purpose: `loadAndStartVignette` casts `VignetteData` to `CaseData` (`narrativeSlice.ts:167`), and vignettes have no recipes. Optional keeps that cast valid.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (existing code doesn't reference `recipes` yet).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(#6): add KeyDeduction type + optional CaseData.recipes"
```

---

## Task 2: Pure `matchDeduction` + `buildDeductionFromRecipe`

**Files:**
- Modify: `src/engine/buildDeduction.ts`
- Test: `src/engine/__tests__/matchDeduction.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/matchDeduction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { matchDeduction, buildDeductionFromRecipe } from '../buildDeduction';
import type { KeyDeduction, Clue } from '../../types';

const recipes: KeyDeduction[] = [
  {
    id: 'r-harland',
    requiredClues: ['c-cipher', 'c-letters', 'c-memo'],
    title: 'The Hand Behind the Cipher',
    description: 'Harland is the architect; the clerk is the instrument.',
    isRedHerring: false,
  },
];

describe('matchDeduction (subset semantics)', () => {
  it('matches when connected ids exactly equal a recipe', () => {
    expect(matchDeduction(['c-cipher', 'c-letters', 'c-memo'], recipes)?.id).toBe('r-harland');
  });

  it('matches when connected ids are a superset of a recipe (extras allowed)', () => {
    expect(
      matchDeduction(['c-extra', 'c-cipher', 'c-letters', 'c-memo', 'c-noise'], recipes)?.id,
    ).toBe('r-harland');
  });

  it('does not match when one required clue is missing', () => {
    expect(matchDeduction(['c-cipher', 'c-letters'], recipes)).toBeNull();
  });

  it('returns null for empty recipe list (vignette-safe)', () => {
    expect(matchDeduction(['c-cipher', 'c-letters', 'c-memo'], [])).toBeNull();
  });

  it('returns null for empty connected set', () => {
    expect(matchDeduction([], recipes)).toBeNull();
  });
});

describe('buildDeductionFromRecipe', () => {
  it('stores under the authored id with authored title/description', () => {
    const d = buildDeductionFromRecipe(recipes[0], ['c-extra', 'c-cipher', 'c-letters', 'c-memo']);
    expect(d.id).toBe('r-harland');
    expect(d.description).toBe('Harland is the architect; the clerk is the instrument.');
    expect(d.isRedHerring).toBe(false);
    // clueIds records exactly the recipe's required clues (the meaningful set), not the noise.
    expect(d.clueIds).toEqual(['c-cipher', 'c-letters', 'c-memo']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/matchDeduction.test.ts`
Expected: FAIL — `matchDeduction`/`buildDeductionFromRecipe` are not exported.

- [ ] **Step 3: Implement in `src/engine/buildDeduction.ts`**

Add these exports to `src/engine/buildDeduction.ts` (keep the existing `buildDeduction`; add the `KeyDeduction` import):

```typescript
import type { Clue, Deduction, KeyDeduction } from '../types';
```

```typescript
/**
 * Returns the first recipe whose requiredClues are all present in `connectedIds`
 * (subset match — extra connected clues are allowed), or null if none match.
 * Pure; no store access.
 */
export function matchDeduction(
  connectedIds: string[],
  recipes: KeyDeduction[],
): KeyDeduction | null {
  const connected = new Set(connectedIds);
  for (const recipe of recipes) {
    if (recipe.requiredClues.every((id) => connected.has(id))) {
      return recipe;
    }
  }
  return null;
}

/**
 * Builds a Deduction stored under the recipe's stable authored id, so
 * `hasDeduction` gates can reference it. `clueIds` records the recipe's required
 * clues (the meaningful set), not any extra connected noise.
 */
export function buildDeductionFromRecipe(
  recipe: KeyDeduction,
  _connectedIds: string[],
): Deduction {
  return {
    id: recipe.id,
    clueIds: [...recipe.requiredClues],
    description: recipe.description,
    isRedHerring: recipe.isRedHerring,
  };
}
```

> `_connectedIds` is accepted (and unused) to keep the call site symmetric with `buildDeduction`; the underscore silences the unused-param lint. Keep it — a later iteration may record the full connected set.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/matchDeduction.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/buildDeduction.ts src/engine/__tests__/matchDeduction.test.ts
git commit -m "feat(#6): pure matchDeduction (subset) + buildDeductionFromRecipe"
```

---

## Task 3: `loadCase` fetches `deductions.json`

**Files:**
- Modify: `src/engine/narrativeEngine.ts` (`loadCase` ~lines 54-74; imports ~line 9)

- [ ] **Step 1: Import `KeyDeduction`**

In `src/engine/narrativeEngine.ts`, add `KeyDeduction` to the type import block that includes `CaseData` (~line 9).

- [ ] **Step 2: Fetch `deductions.json` with a graceful fallback**

Replace the `loadCase` body (lines 54-74) with:

```typescript
export async function loadCase(caseId: string): Promise<CaseData> {
  const base = `/content/cases/${caseId}`;

  const [meta, act1, act2, act3, cluesFile, npcsFile, variantsFile] =
    await Promise.all([
      fetchJson<CaseMeta>(`${base}/meta.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act1.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act2.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act3.json`),
      fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
      fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
      fetchJson<{ variants: SceneNode[] }>(`${base}/variants.json`),
    ]);

  // deductions.json is optional — a case without key deductions simply has none.
  const recipes = await fetchJson<{ deductions: KeyDeduction[] }>(`${base}/deductions.json`)
    .then((f) => f.deductions)
    .catch(() => [] as KeyDeduction[]);

  const allScenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  const scenes = await injectSharedScenes(indexById(allScenes));
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs, variants: variantsFile.variants, recipes };
}
```

> Kept out of the `Promise.all` so a missing file (`.catch`) can't reject the whole load. All three real cases will ship `deductions.json`, so the catch is defensive.

- [ ] **Step 3: Verify it compiles + existing engine tests pass**

Run: `npx tsc --noEmit && npx vitest run src/engine/__tests__/narrativeEngine`
Expected: no type errors; existing narrativeEngine tests PASS (recipes is additive).

- [ ] **Step 4: Commit**

```bash
git add src/engine/narrativeEngine.ts
git commit -m "feat(#6): loadCase fetches optional deductions.json into caseData.recipes"
```

---

## Task 4: `DeductionButton` stores matched deductions under the authored id

**Files:**
- Modify: `src/components/EvidenceBoard/DeductionButton.tsx`

- [ ] **Step 1: Import the matcher + read recipes from the store**

In `DeductionButton.tsx`, update the import (line 8) and add a recipes selector:

```typescript
import { buildDeduction, buildDeductionFromRecipe, matchDeduction } from '../../engine/buildDeduction';
```

Inside the component, after the `addDeduction` selector (~line 23), add:

```typescript
  const recipes = useStore((s) => s.caseData?.recipes ?? []);
```

- [ ] **Step 2: Use the matcher in the success branch**

Replace the success branch (lines 40-46) with:

```typescript
    if (result.tier === 'success' || result.tier === 'critical') {
      // Prefer a named key-deduction recipe (stored under its stable authored id
      // so hasDeduction gates resolve); otherwise fall back to a generic deduction.
      const recipe = matchDeduction(connectedClueIds, recipes);
      const deduction = recipe
        ? buildDeductionFromRecipe(recipe, connectedClueIds)
        : buildDeduction(connectedClueIds, clues);
      addDeduction(deduction);
      connectedClueIds.forEach((id) => updateClueStatus(id, 'deduced'));
      setPhase('success');
      onResult('success');
    } else {
```

- [ ] **Step 3: Verify it compiles + component tests pass**

Run: `npx tsc --noEmit && npx vitest run src/components`
Expected: no type errors; existing EvidenceBoard/DeductionButton tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/EvidenceBoard/DeductionButton.tsx
git commit -m "feat(#6): DeductionButton stores recipe matches under authored id"
```

---

## Task 5: Validator — recipe clue refs + gate-target registry

**Files:**
- Modify: `src/engine/contentValidation.ts` (`ContentBundle` ~line 28; `Ctx` ~line 211; `validateBundle` ~line 84; `validateChoice` ~line 248; `validateCondition` ~line 348)
- Test: `src/engine/__tests__/contentValidation.deduction.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/contentValidation.deduction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateBundle, type ContentBundle } from '../contentValidation';
import type { Clue, KeyDeduction, SceneNode } from '../../types';

const clue = (id: string): Clue => ({
  id, type: 'physical', title: id, description: '', sceneSource: 's1',
  tags: [], status: 'new', isRevealed: false,
});

const baseScene: SceneNode = {
  id: 's1', act: 1, narrative: 'x', cluesAvailable: [],
  choices: [{ id: 'ch1', text: 'go', outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1', fumble: 's1' } }],
};

function bundle(over: Partial<ContentBundle>): ContentBundle {
  return { scenes: [baseScene], variants: [], clues: [clue('c-a'), clue('c-b')], npcs: [], ...over };
}

describe('validateBundle — key deductions', () => {
  it('errors when a recipe references an unknown clue', () => {
    const recipes: KeyDeduction[] = [{ id: 'r1', requiredClues: ['c-a', 'c-missing'], title: 't', description: 'd', isRedHerring: false }];
    const { errors } = validateBundle(bundle({ recipes }));
    expect(errors.some((e) => e.includes('c-missing'))).toBe(true);
  });

  it('errors when a choice.requiresDeduction targets no recipe', () => {
    const scene: SceneNode = {
      ...baseScene,
      choices: [{ id: 'ch1', text: 'accuse', requiresDeduction: 'r-nope',
        outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1', fumble: 's1' } }],
    };
    const { errors } = validateBundle(bundle({ scenes: [scene], recipes: [] }));
    expect(errors.some((e) => e.includes('r-nope'))).toBe(true);
  });

  it('errors when a hasDeduction condition targets no recipe', () => {
    const scene: SceneNode = {
      ...baseScene,
      conditions: [{ type: 'hasDeduction', target: 'r-ghost' }],
    };
    const recipes: KeyDeduction[] = [{ id: 'r1', requiredClues: ['c-a'], title: 't', description: 'd', isRedHerring: false }];
    const { errors } = validateBundle(bundle({ scenes: [scene], recipes }));
    expect(errors.some((e) => e.includes('r-ghost'))).toBe(true);
  });

  it('passes when recipe clues exist and gates target a real recipe', () => {
    const recipes: KeyDeduction[] = [{ id: 'r1', requiredClues: ['c-a', 'c-b'], title: 't', description: 'd', isRedHerring: false }];
    const scene: SceneNode = {
      ...baseScene,
      choices: [{ id: 'ch1', text: 'accuse', requiresDeduction: 'r1',
        outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1', fumble: 's1' } }],
    };
    const { errors } = validateBundle(bundle({ scenes: [scene], recipes }));
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/contentValidation.deduction.test.ts`
Expected: FAIL — `recipes` not on `ContentBundle`; no recipe validation yet.

- [ ] **Step 3: Add `recipes` to `ContentBundle`**

In `contentValidation.ts`, add to the `ContentBundle` interface (after `npcs`, ~line 34):

```typescript
  /** Authored key-deduction recipes; their ids form the hasDeduction/requiresDeduction registry. */
  recipes?: KeyDeduction[];
```

Add `KeyDeduction` to the type imports at the top of the file (the import that already pulls `Clue`, `SceneNode`, etc.).

- [ ] **Step 4: Add `recipeIds` to `Ctx` and populate it**

Extend the `Ctx` interface (~line 211):

```typescript
interface Ctx {
  edgeTargetIds: Set<string>;
  clueIds: Set<string>;
  npcIds: Set<string>;
  recipeIds: Set<string>;
  errors: string[];
}
```

In `validateBundle`, after `const npcIds = ...` (~line 101), add:

```typescript
  const recipeIds = new Set((bundle.recipes ?? []).map((r) => r.id));
```

Update the `ctx` construction (~line 103):

```typescript
  const ctx: Ctx = { edgeTargetIds, clueIds, npcIds, recipeIds, errors };
```

- [ ] **Step 5: Validate recipe clue refs**

In `validateBundle`, after the clue `sceneSource` loop (ends ~line 131), add:

```typescript
  // Key-deduction recipes: every required clue must exist.
  for (const recipe of bundle.recipes ?? []) {
    for (const clueId of recipe.requiredClues) {
      if (!clueIds.has(clueId)) {
        errors.push(`KeyDeduction "${recipe.id}" -> requiredClues references unknown clue "${clueId}"`);
      }
    }
  }
```

- [ ] **Step 6: Validate `requiresDeduction` on choices**

In `validateChoice` (~line 248), after the `requiresClue` check (ends ~line 259), add:

```typescript
  if (choice.requiresDeduction && !ctx.recipeIds.has(choice.requiresDeduction)) {
    ctx.errors.push(`${at} -> requiresDeduction references unknown key deduction "${choice.requiresDeduction}"`);
  }
```

- [ ] **Step 7: Validate `hasDeduction` conditions**

In `validateCondition` (~line 348), split the combined `hasFlag`/`hasDeduction` case so `hasDeduction` is checked against the registry:

```typescript
    case 'hasFlag':
      // hasFlag targets are free-form and value:false is legitimate ("flag unset").
      break;
    case 'hasDeduction':
      if (!ctx.recipeIds.has(target)) {
        ctx.errors.push(`${where} -> hasDeduction references unknown key deduction "${target}"`);
      }
      break;
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/contentValidation.deduction.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 9: Run the full engine suite (regression guard)**

Run: `npx vitest run src/engine`
Expected: PASS. (No existing content uses `hasDeduction`/`requiresDeduction`, so the new strict rule flags nothing yet.)

- [ ] **Step 10: Commit**

```bash
git add src/engine/contentValidation.ts src/engine/__tests__/contentValidation.deduction.test.ts
git commit -m "feat(#6): validate recipe clue refs + hasDeduction/requiresDeduction targets"
```

---

## Task 6: CLI validator reads `deductions.json`

**Files:**
- Modify: `scripts/validateCase.ts` (`loadBundle` ~lines 30-55; imports ~line 21)

- [ ] **Step 1: Import `KeyDeduction`**

In `scripts/validateCase.ts`, add `KeyDeduction` to the type import from `../src/types` (the import that already brings in `Clue`, `SceneNode`, `NPCState`).

- [ ] **Step 2: Read `deductions.json` in `loadBundle`**

In `loadBundle`, after the `clues` line (~line 48), add:

```typescript
  const recipes = existsSync(join(dir, 'deductions.json'))
    ? readJson<{ deductions: KeyDeduction[] }>(join(dir, 'deductions.json')).deductions
    : [];
```

Update the return (~line 54) to include `recipes`:

```typescript
  return { scenes, variants, clues, npcs, recipes, firstScene: meta.firstScene, sharedSceneIds: SHARED_SCENE_IDS };
```

- [ ] **Step 3: Verify the CLI still passes on current content**

Run: `node scripts/validateCase.mjs`
Expected: all 7 cases clean (no `deductions.json` exists yet → `recipes: []` → no new errors).

- [ ] **Step 4: Commit**

```bash
git add scripts/validateCase.ts
git commit -m "feat(#6): CLI validator reads deductions.json into the bundle"
```

---

## Task 7: Whitechapel content — recipe, gated choice, true ending

**Files:**
- Create: `public/content/cases/the-whitechapel-cipher/deductions.json`
- Modify: `public/content/cases/the-whitechapel-cipher/act3.json` (scene `wc-act3-the-reckoning`: add one choice; append one new ending scene)

- [ ] **Step 1: Create `deductions.json`**

```json
{
  "deductions": [
    {
      "id": "wc-deduction-harland-mastermind",
      "requiredClues": ["wc-clue-cipher-note", "wc-clue-aldgate-letters", "wc-clue-harland-memo"],
      "title": "The Hand Behind the Cipher",
      "description": "The cipher notes, Aldgate's correspondence, and Harland's suppression order line up into a single fact: Aldgate is a clerk following orders. Superintendent Harland is the architect, and the trail runs past him to the Deputy Commissioner.",
      "isRedHerring": false
    }
  ]
}
```

- [ ] **Step 2: Add the gated true-accusation choice to the reckoning**

In `act3.json`, in scene `wc-act3-the-reckoning`, add this object to the END of its `choices` array (after `wc-choice-occult-seal`):

```json
{
  "id": "wc-choice-name-harland",
  "text": "You are a clerk taking dictation, Aldgate. I can name the man who wrote your orders — Superintendent Harland — and the desk above his. Give me that, and you are a witness, not the murderer.",
  "requiresDeduction": "wc-deduction-harland-mastermind",
  "faculty": "reason",
  "difficulty": 12,
  "advantageIf": ["wc-clue-harland-memo"],
  "outcomes": {
    "critical": "wc-act3-ending-true-exposure",
    "success": "wc-act3-ending-true-exposure",
    "partial": "wc-act3-ending-true-exposure",
    "failure": "wc-act3-ending-negotiate",
    "fumble": "wc-act3-ending-negotiate"
  }
}
```

> Gated by `requiresDeduction` (choice is invisible until the recipe is made). Failure/fumble fall back to the existing `wc-act3-ending-negotiate`, so a botched roll still resolves — no soft-lock. It IS a faculty check (`faculty`+`difficulty`), so all five outcome tiers are present (validator tier-completeness).

- [ ] **Step 3: Add the new true-ending scene**

In `act3.json`, append this scene to the `scenes` array (mirror the structure of `wc-act3-ending-negotiate`: terminal — empty `cluesAvailable`/`choices`, `onEnter` sets the case-complete flag):

```json
{
  "id": "wc-act3-ending-true-exposure",
  "act": 3,
  "narrative": "You lay it out the way the cipher itself was built — piece by piece, until the pattern is undeniable. Aldgate breaks first, then the paper trail does the rest: Harland's suppression order, the requisitioned printshop, the names struck from three case files by the same hand. When Graves arrives you give him not a frightened clerk but a superintendent of the Metropolitan Police and the Deputy Commissioner standing behind him. It is not a quiet victory. Careers end. Some of them belonged to men who shook your hand. But the cover-up does not survive the morning, and for once the rot is cut out at the root rather than the branch.",
  "cluesAvailable": [],
  "choices": [],
  "onEnter": [
    { "type": "flag", "target": "wc-case-complete", "value": true },
    { "type": "flag", "target": "wc-harland-exposed", "value": true },
    { "type": "disposition", "target": "npc-graves", "delta": 3 },
    { "type": "reputation", "target": "Rationalists Circle", "delta": -2 },
    { "type": "reputation", "target": "Lamplighters", "delta": 2 }
  ]
}
```

- [ ] **Step 4: Validate the case**

Run: `node scripts/validateCase.mjs public/content/cases/the-whitechapel-cipher`
Expected: clean — `wc-deduction-harland-mastermind` clues all exist, `requiresDeduction` target resolves, the new ending scene is a valid edge target, tier completeness satisfied.

- [ ] **Step 5: Commit**

```bash
git add public/content/cases/the-whitechapel-cipher/deductions.json public/content/cases/the-whitechapel-cipher/act3.json
git commit -m "content(#6): Whitechapel key deduction + gated true-exposure ending"
```

---

## Task 8: Mayfair content — recipe, gated choice, true ending

**Files:**
- Create: `public/content/cases/the-mayfair-seance/deductions.json`
- Modify: `public/content/cases/the-mayfair-seance/act3.json` (scene `ms-act3-the-reckoning`: add one choice; append one new ending scene)

- [ ] **Step 1: Create `deductions.json`**

```json
{
  "deductions": [
    {
      "id": "ms-deduction-fraud-and-breach",
      "requiredClues": ["ms-clue-hidden-mechanism", "ms-clue-vesper-journal", "ms-clue-grey-dawn-sigil"],
      "title": "The Fraud That Woke Something Real",
      "description": "The hidden mechanism proves the séance was staged. But Vesper's journal and the Grey Dawn sigil prove the other half: the counterfeit ritual, performed in earnest by frightened people, drew a genuine presence. Both truths are true at once — the fraud is what opened the door.",
      "isRedHerring": false
    }
  ]
}
```

- [ ] **Step 2: Add the gated true-account choice to the reckoning**

In `act3.json`, in scene `ms-act3-the-reckoning`, add this object to the END of its `choices` array:

```json
{
  "id": "ms-choice-full-account",
  "text": "Give the whole truth, not half of it: the séance was staged — and the fraud is precisely what opened the door to what came through it.",
  "requiresDeduction": "ms-deduction-fraud-and-breach",
  "faculty": "reason",
  "difficulty": 12,
  "advantageIf": ["ms-clue-vesper-journal"],
  "outcomes": {
    "critical": "ms-act3-ending-true-account",
    "success": "ms-act3-ending-true-account",
    "partial": "ms-act3-ending-true-account",
    "failure": "ms-act3-ending-exposure",
    "fumble": "ms-act3-ending-exposure"
  }
}
```

> Failure/fumble fall back to the existing `ms-act3-ending-exposure` (which names only the fraud) — always resolves.

- [ ] **Step 3: Add the new true-ending scene**

In `act3.json`, append this scene to the `scenes` array (mirror the `onEnter` shape of the existing `ms-act3-ending-exposure`; if that scene sets flags/reputation, keep this one consistent in kind — set the case-complete flag plus a distinguishing flag):

```json
{
  "id": "ms-act3-ending-true-account",
  "act": 3,
  "narrative": "You do not choose between the two explanations, because the truth needs both. Lady Ashworth and Lord Pemberton rigged the table — the mechanism under the boards, the confederate in the dark, every cheap miracle accounted for. And then you show them the rest: the sigil they copied without understanding, the words Vesper's journal warned should never be spoken over a lie. The fraud was the key, and something on the far side of the Veil turned it. The guests leave believing neither a comfortable ghost story nor a tidy swindle, but the far worse thing — that both were real, and that the one summoned the other.",
  "cluesAvailable": [],
  "choices": [],
  "onEnter": [
    { "type": "flag", "target": "ms-case-complete", "value": true },
    { "type": "flag", "target": "ms-full-truth-told", "value": true },
    { "type": "reputation", "target": "Hermetic Order of the Grey Dawn", "delta": 2 },
    { "type": "reputation", "target": "Rationalists Circle", "delta": -1 }
  ]
}
```

> The case-complete flag key `ms-case-complete` is confirmed against the existing `ms-act3-ending-exposure` (verified during planning) — the `onEnter` above matches it, so `completeCase` fires identically.

- [ ] **Step 4: Validate the case**

Run: `node scripts/validateCase.mjs public/content/cases/the-mayfair-seance`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add public/content/cases/the-mayfair-seance/deductions.json public/content/cases/the-mayfair-seance/act3.json
git commit -m "content(#6): Mayfair key deduction + gated true-account ending"
```

---

## Task 9: Lamplighter's content — recipe, gated choice, true ending

**Files:**
- Create: `public/content/cases/the-lamplighters-wake/deductions.json`
- Modify: `public/content/cases/the-lamplighters-wake/act3.json` (scene `lw-act3-the-reckoning`: add one choice; append one new ending scene)

- [ ] **Step 1: Create `deductions.json`**

```json
{
  "deductions": [
    {
      "id": "lw-deduction-croke-court-murder",
      "requiredClues": ["lw-clue-locked-room-key", "lw-clue-poison-vial", "lw-clue-court-manifest", "lw-clue-croke-testimony"],
      "title": "The Locked Room, Unlocked",
      "description": "The missing key explains how the room was sealed from outside. The vial explains how Marsh died. The Court's shipping records explain why, and Croke's own words name the hand: he poisoned the agent and staged the locked room so the Court of Smoke could bury the Veil-fragment trafficking before Marsh could report it.",
      "isRedHerring": false
    }
  ]
}
```

- [ ] **Step 2: Add the gated true-accusation choice to the reckoning**

In `act3.json`, in scene `lw-act3-the-reckoning`, add this object to the END of its `choices` array:

```json
{
  "id": "lw-choice-name-croke",
  "text": "Name it plainly: Croke poisoned Marsh and sealed the room with the missing key, so the Court could bury the trafficking before the report was ever filed.",
  "requiresDeduction": "lw-deduction-croke-court-murder",
  "faculty": "reason",
  "difficulty": 12,
  "advantageIf": ["lw-clue-croke-testimony"],
  "outcomes": {
    "critical": "lw-act3-ending-true-reckoning",
    "success": "lw-act3-ending-true-reckoning",
    "partial": "lw-act3-ending-true-reckoning",
    "failure": "lw-act3-ending-exposed",
    "fumble": "lw-act3-ending-exposed"
  }
}
```

> Failure/fumble fall back to the existing `lw-act3-ending-exposed` — always resolves.

- [ ] **Step 3: Add the new true-ending scene**

In `act3.json`, append this scene to the `scenes` array (mirror `lw-act3-ending-exposed`'s `onEnter` — set the case-complete flag plus a distinguishing flag):

```json
{
  "id": "lw-act3-ending-true-reckoning",
  "act": 3,
  "narrative": "Inspector Bell wanted a tidy arrest and a sealed breach. You give him the whole ledger instead. The key that was never missing, only pocketed. The vial matched to the residue on Marsh's collar. The Court's own manifests, and Foreman Croke's confession folding in on itself the moment the three are laid side by side. Marsh did not die in a locked room by misadventure — he was murdered to keep a shipment quiet, and the room was theatre. Bell's constables take Croke, and this time the paperwork names the Court of Smoke as more than a rumour. Marsh's final message finally means something: not a warning that failed, but a case that closed.",
  "cluesAvailable": [],
  "choices": [],
  "onEnter": [
    { "type": "flag", "target": "lw-case-complete", "value": true },
    { "type": "flag", "target": "lw-croke-convicted", "value": true },
    { "type": "reputation", "target": "Court of Smoke", "delta": -2 },
    { "type": "reputation", "target": "Lamplighters", "delta": 2 }
  ]
}
```

> The case-complete flag key `lw-case-complete` is confirmed against the existing `lw-act3-ending-exposed` (verified during planning) — the `onEnter` above matches it.

- [ ] **Step 4: Validate the case**

Run: `node scripts/validateCase.mjs public/content/cases/the-lamplighters-wake`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add public/content/cases/the-lamplighters-wake/deductions.json public/content/cases/the-lamplighters-wake/act3.json
git commit -m "content(#6): Lamplighter's key deduction + gated true-reckoning ending"
```

---

## Task 10: Full verification + docs

**Files:**
- Modify: `docs/status.md`, `docs/PROJECT_STATE.md`, `CLAUDE.md` (deduction/recipe references + test baseline), `docs/content-authoring.md` (document `deductions.json` + `KeyDeduction`), `docs/engine-reference.md` (document `matchDeduction`).

- [ ] **Step 1: Full test suite**

Run: `npm run test:run`
Expected: all pass (previous baseline 481 + the new matchDeduction + contentValidation.deduction tests).

- [ ] **Step 2: Validator on all cases**

Run: `node scripts/validateCase.mjs`
Expected: all 7 cases clean.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `tsc && vite build` green.

- [ ] **Step 4: Playwright MCP click-through (Whitechapel)**

Start `npm run dev`, then via Playwright MCP:
1. New game → create any investigator → start The Whitechapel Cipher.
2. Play to `wc-act3-the-reckoning` WITHOUT connecting the recipe clues. Assert the choice "You are a clerk taking dictation, Aldgate…" (`wc-choice-name-harland`) is **absent**.
3. In a second run: open the Evidence Board, connect `wc-clue-cipher-note` + `wc-clue-aldgate-letters` + `wc-clue-harland-memo`, pass the Reason (Deduction) check. Return to the reckoning. Assert the choice is now **present** and selecting it routes to `wc-act3-ending-true-exposure`.

> This is the load-bearing proof. If the choice never appears, check that the deduction was stored under `wc-deduction-harland-mastermind` (recipes reached `caseData`), not a random id.

- [ ] **Step 5: content-integrity-reviewer pass**

Dispatch the `content-integrity-reviewer` subagent over the three edited `act3.json` files (tone + design-rule check on the new gated choices and true endings). Address any blockers/warnings.

- [ ] **Step 6: Update docs**

- `docs/content-authoring.md`: document `deductions.json` schema (`KeyDeduction`), subset-match semantics, and that `requiresDeduction`/`hasDeduction` targets must be a defined recipe id (validator-enforced).
- `docs/engine-reference.md`: add `matchDeduction` / `buildDeductionFromRecipe` to `buildDeduction.ts`; note `loadCase` now attaches `recipes`.
- `CLAUDE.md`: content authoring rules — mention key-deduction recipes; update test baseline number.
- `docs/status.md` + `docs/PROJECT_STATE.md`: mark #6 done; update test baseline.

- [ ] **Step 7: Commit docs**

```bash
git add docs/ CLAUDE.md
git commit -m "docs(#6): document key-deduction recipes + refresh state/baseline"
```

- [ ] **Step 8: Push + open PR**

```bash
git push -u origin feat/deduction-gated-content-6
gh pr create --title "feat(#6): deduction-gated true endings + stable deduction identity" --body "Closes #6. Adds KeyDeduction recipes (stable authorable deduction identity), recipe-aware DeductionButton, validator rules, and one deduction-gated true ending per main case. See docs/superpowers/plans/2026-07-08-deduction-gated-content.md."
```

---

## Notes for the implementer

- **The gate plumbing already exists.** `Choice.requiresDeduction`, `isChoiceVisible` (`ChoicePanel.tsx`), the encounter choice filter (`narrativeEngine.ts`), and the `hasDeduction` condition eval all already translate/handle a deduction gate. Do NOT re-implement them. The only reason the gate was dead is that no deduction ever had a stable id (Tasks 1–4) and no content used it (Tasks 7–9).
- **Subset match is intentional.** A player with many connections trips a recipe as soon as its members are all connected. That rewards thoroughness; it is the chosen semantics (see spec Decision 4).
- **Vignettes are out of scope.** They ship no `deductions.json`; `loadCase`'s `.catch` / the CLI's `existsSync` guard yields `recipes: []`, and `matchDeduction` returns `null` — all graceful.
- **Determinism caveat:** `DeductionButton` runs a real `performCheck` (dice). Playwright verification may need several attempts to pass the DC-14 Reason check, or use an investigator with high Reason. This is existing behavior, not introduced here.
```
