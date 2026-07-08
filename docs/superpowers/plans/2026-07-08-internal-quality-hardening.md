# Internal-Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate drift-prone duplication and loose typing across the engine/store core (GitHub issues #13, #14, #18, #19 — ~15 live findings), with no player-facing behavior change except one UI-badge correctness fix.

**Architecture:** Introduce single-source-of-truth modules for flag strings, factions, outcome tiers, and archetype tables; convert `Condition` to a discriminated union; add exhaustiveness guards to effect/condition dispatch; split the 604-line `narrativeEngine.ts` into focused modules; unify the 3 divergent advantage computations behind one pure `computeAdvantage`. Every task is test-green throughout; two items (F-022 encounter nav, F-015 save migration) are genuine correctness fixes with new TDD tests.

**Tech Stack:** React 18, TypeScript, Zustand + Immer, Vitest, fast-check.

---

## Ground-truth corrections (verified 2026-07-08, not the stale issue text)

The issues cite line numbers from before the #6/recipes work. Current reality:

- **F-027** (dead `_hasAdvantage` in `getEncounterChoices`) — **ALREADY DONE**. Removed; documented at `narrativeEngine.ts:561-563`. Dropped from scope.
- **F-022** (undefined-nav guard) — **PARTIALLY DONE**. Guard present in `computeChoiceResult` (`narrativeEngine.ts:313-325`). Only the **encounter twin** (`processEncounterChoice`, `narrativeEngine.ts:502`) is still unguarded. Scope = encounter branch only.
- **F-014** (advantage disagreement) — 3 implementations. Engine regular (`:298-303`) and encounter (`:467-480`) agree logically (encounter has a dead `hasOccultAdvantage` subset term). The **UI badge** `ChoiceCard.tsx:63-65` disagrees: it omits the Veil-Sight lore rule, so a Lore check with `ability-veil-sight-active` set rolls with advantage but shows no badge. Real fix = one shared `computeAdvantage(choice, state)` used by all three.
- **F-067** — a `FACTIONS` set already exists at `contentValidation.ts:72-77`; fix is centralize + reuse, not create.
- **F-064** — `worldSlice.ts` effect switch (`:37-63`) has **no `default:` at all** (silent no-op on a new type); `effectMessages.ts` and `evaluateCondition` have fallthrough `default:`, none use `assertNever`.

## File Structure

**New files:**
- `src/engine/flags.ts` — `FLAGS` constants + `KnownFlag` type (F-018).
- `src/engine/constants.ts` — `FACTIONS`, `OUTCOME_TIERS`, `assertNever` helper (F-067, F-064). *(If a natural home already exists, colocate; otherwise this file.)*
- `src/engine/advantage.ts` — pure `computeAdvantage(choice, state)` (F-014).
- `src/engine/contentLoader.ts`, `src/engine/conditions.ts`, `src/engine/choiceResolution.ts`, `src/engine/encounters.ts` — the `narrativeEngine.ts` split (F-019).
- Tests colocated in `src/engine/__tests__/`.

**Modified (high-traffic):** `src/engine/narrativeEngine.ts`, `src/store/slices/narrativeSlice.ts`, `src/store/slices/worldSlice.ts`, `src/store/slices/npcSlice.ts`, `src/engine/caseProgression.ts`, `src/engine/effectMessages.ts`, `src/engine/diceEngine.ts`, `src/data/archetypes.ts`, `src/App.tsx`, `src/types/index.ts`, `src/components/ChoicePanel/ChoiceCard.tsx`.

## Task ordering rationale

Foundational constants first (everything else imports them), then type-safety, then the correctness fixes, then the risky file-split **last** (so it rebases on a stable base, and a green suite before it isolates any split-introduced regression). Each task = one commit. Run `npm run test:run` + `node scripts/validateCase.mjs` before starting (baseline: 495 tests / 47 files green).

---

### Task 1: Central `flags.ts` constants (F-018)

**Files:**
- Create: `src/engine/flags.ts`
- Create test: `src/engine/__tests__/flags.test.ts`
- Modify: `src/engine/narrativeEngine.ts` (`:275-279`, `:300-301`, `:339-341`, `:478-479`, `:506-508`), `src/App.tsx` (`:26-31`, `:127-128`), `src/engine/caseProgression.ts` (`:65`, `:77`, `:95`), `src/store/slices/narrativeSlice.ts` (`:132-140`, `:187-193`), `src/components/CaseSelection/CaseSelection.tsx:60`, `src/components/CaseJournal/CaseJournal.tsx:8`

- [ ] **Step 1: Write the failing test** — `src/engine/__tests__/flags.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { FLAGS, abilityAutoSucceedFlag, vignetteUnlockedFlag, CASE_LOAD_CLEARED_FLAGS } from '../flags';

describe('FLAGS', () => {
  it('exposes the ability auto-succeed flags by faculty', () => {
    expect(abilityAutoSucceedFlag('reason')).toBe('ability-auto-succeed-reason');
    expect(abilityAutoSucceedFlag('vigor')).toBe('ability-auto-succeed-vigor');
    expect(abilityAutoSucceedFlag('influence')).toBe('ability-auto-succeed-influence');
  });
  it('exposes veil sight and last-critical-faculty', () => {
    expect(FLAGS.veilSight).toBe('ability-veil-sight-active');
    expect(FLAGS.lastCriticalFaculty).toBe('last-critical-faculty');
  });
  it('builds the vignette-unlocked flag for an id', () => {
    expect(vignetteUnlockedFlag('a-matter-of-shadows')).toBe('vignette-unlocked-a-matter-of-shadows');
  });
  it('lists exactly the flags cleared on case load', () => {
    expect(new Set(CASE_LOAD_CLEARED_FLAGS)).toEqual(new Set([
      'breakdown-occurred', 'incapacitated',
      'ability-auto-succeed-reason', 'ability-auto-succeed-vigor',
      'ability-auto-succeed-influence', 'ability-veil-sight-active',
      'last-critical-faculty',
    ]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/engine/__tests__/flags.test.ts` → FAIL ("has no exported member 'FLAGS'"). *(The `tsc` PostToolUse hook will block on the missing module — create the stub in Step 3 first, then this fails on assertions/import.)*

- [ ] **Step 3: Write `src/engine/flags.ts`**

```ts
import type { Faculty } from '../types';

/** Single source of truth for engine/progression flag string keys. */
export const FLAGS = {
  breakdownOccurred: 'breakdown-occurred',
  incapacitated: 'incapacitated',
  veilSight: 'ability-veil-sight-active',
  lastCriticalFaculty: 'last-critical-faculty',
} as const;

const ABILITY_AUTO_SUCCEED: Partial<Record<Faculty, string>> = {
  reason: 'ability-auto-succeed-reason',
  vigor: 'ability-auto-succeed-vigor',
  influence: 'ability-auto-succeed-influence',
};

export function abilityAutoSucceedFlag(faculty: Faculty): string | undefined {
  return ABILITY_AUTO_SUCCEED[faculty];
}

export function vignetteUnlockedFlag(vignetteId: string): string {
  return `vignette-unlocked-${vignetteId}`;
}

/** Flags wiped when a new case/vignette starts (see narrativeSlice load actions). */
export const CASE_LOAD_CLEARED_FLAGS: readonly string[] = [
  FLAGS.breakdownOccurred,
  FLAGS.incapacitated,
  'ability-auto-succeed-reason',
  'ability-auto-succeed-vigor',
  'ability-auto-succeed-influence',
  FLAGS.veilSight,
  FLAGS.lastCriticalFaculty,
];

/** Archetype → its ability flag (superset of auto-succeed; includes veil sight). */
export const ARCHETYPE_ABILITY_FLAG: Record<string, string> = {
  deductionist: 'ability-auto-succeed-reason',
  occultist: FLAGS.veilSight,
  operator: 'ability-auto-succeed-vigor',
  mesmerist: 'ability-auto-succeed-influence',
};
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run src/engine/__tests__/flags.test.ts` → PASS.

- [ ] **Step 5: Replace usages** (mechanical, no behavior change):
  - `narrativeEngine.ts:275-279` — delete local `ABILITY_AUTO_SUCCEED_FLAGS`; at `:292` use `abilityAutoSucceedFlag(choice.faculty)`.
  - `narrativeEngine.ts:300-301`, `:478-479` — `state.flags[FLAGS.veilSight]`.
  - `narrativeEngine.ts:339-341`, `:506-508` — `actions.setFlag(FLAGS.lastCriticalFaculty, ...)` (the cast is addressed in Task 5; keep it here).
  - `App.tsx:26-31` — delete local `ABILITY_FLAGS`; import `ARCHETYPE_ABILITY_FLAG`; `:127-128` use it. **Note:** `App.tsx` currently `export`s `ABILITY_FLAGS`; grep for external importers first (`grep -rn "ABILITY_FLAGS" src`) — if any test imports it, point them at `ARCHETYPE_ABILITY_FLAG`.
  - `caseProgression.ts:65` `state.flags[FLAGS.lastCriticalFaculty]`; `:77` `setFlag(vignetteUnlockedFlag(vignetteUnlocked), true)`; `:95` `state.flags[vignetteUnlockedFlag(vignette.id)]`.
  - `narrativeSlice.ts:132-140` and `:187-193` — replace both delete blocks with `for (const f of CASE_LOAD_CLEARED_FLAGS) delete state.flags[f];`. *(Task 6 dedupes the two load actions further; this just removes the literal lists.)*
  - `CaseSelection.tsx:60` — `flags[vignetteUnlockedFlag(entry.id)]`.
  - `CaseJournal.tsx:8` — leave the display-prefix list as-is (it's a UI concern, prefixes not full keys) OR reference `FLAGS`-derived prefixes; **leave as-is** to avoid scope creep — note in commit.

- [ ] **Step 6: Verify + commit**

```bash
npm run test:run   # 495 + 4 (flags.test) = 499, all green
grep -rn "'ability-auto-succeed" src --include=*.ts --include=*.tsx | grep -v flags.ts   # only flags.ts defines them
git add src/engine/flags.ts src/engine/__tests__/flags.test.ts src/engine/narrativeEngine.ts src/App.tsx src/engine/caseProgression.ts src/store/slices/narrativeSlice.ts src/components/CaseSelection/CaseSelection.tsx
git commit -m "refactor(#13): central flags.ts — single source for ability/progression flag keys (F-018)"
```

---

### Task 2: Central `constants.ts` — FACTIONS, OUTCOME_TIERS, assertNever (F-067, F-064 groundwork)

**Files:**
- Create: `src/engine/constants.ts`
- Create test: `src/engine/__tests__/constants.test.ts`
- Modify: `src/engine/contentValidation.ts` (`:72-77` FACTIONS, `:79` OUTCOME_TIERS), `src/components/NarrativePanel/OutcomeBanner.tsx:34` (reference the shared tier list where sensible)

- [ ] **Step 1: Write the failing test** — `src/engine/__tests__/constants.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { FACTIONS, OUTCOME_TIERS, assertNever } from '../constants';

describe('constants', () => {
  it('lists the four canonical factions', () => {
    expect(FACTIONS.has('Rationalists Circle')).toBe(true);
    expect(FACTIONS.has('Hermetic Order of the Grey Dawn')).toBe(true);
    expect(FACTIONS.has('Lamplighters')).toBe(true);
    expect(FACTIONS.has('Court of Smoke')).toBe(true);
    expect(FACTIONS.size).toBe(4);
  });
  it('lists the five outcome tiers', () => {
    expect([...OUTCOME_TIERS]).toEqual(['critical', 'success', 'partial', 'failure', 'fumble']);
  });
  it('assertNever throws when reached', () => {
    expect(() => assertNever('x' as never)).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/__tests__/constants.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write `src/engine/constants.ts`**

```ts
import type { OutcomeTier } from '../types';

export const FACTIONS: ReadonlySet<string> = new Set<string>([
  'Rationalists Circle',
  'Hermetic Order of the Grey Dawn',
  'Lamplighters',
  'Court of Smoke',
]);

export const OUTCOME_TIERS = ['critical', 'success', 'partial', 'failure', 'fumble'] as const satisfies readonly OutcomeTier[];

/** Compile-time exhaustiveness guard for switch statements. */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/engine/__tests__/constants.test.ts` → PASS.

- [ ] **Step 5: Replace usages** — `contentValidation.ts:72-77` import `FACTIONS` from `./constants` (delete local); `:79` import `OUTCOME_TIERS` (delete local). `OutcomeBanner.tsx:34` keeps its `Record<OutcomeTier, TierConfig>` (it's a config map keyed by the type, not a redundant list) — leave; note in commit.

- [ ] **Step 6: Verify + commit**

```bash
npm run test:run          # green
node scripts/validateCase.mjs   # 7 cases clean (faction validation still works)
git add src/engine/constants.ts src/engine/__tests__/constants.test.ts src/engine/contentValidation.ts
git commit -m "refactor(#19): central constants.ts — FACTIONS, OUTCOME_TIERS, assertNever (F-067)"
```

---

### Task 3: Exhaustiveness guards on effect/condition dispatch (F-064)

**Files:**
- Modify: `src/store/slices/worldSlice.ts` (`:37-63` — add `default: assertNever`), `src/engine/effectMessages.ts` (`:48-65`), `src/engine/narrativeEngine.ts` (`evaluateCondition` `:150-213`)
- Test: extend `src/engine/__tests__/constants.test.ts` or add `src/store/slices/__tests__/worldSlice.test.ts` if one exists

- [ ] **Step 1: Write the failing test** — verify every effect type is handled (add to an existing worldSlice test if present, else new). Example assertion: applying each of the 8 effect types mutates state as expected and none throws.

```ts
// src/store/slices/__tests__/worldSlice.effects.test.ts
import { describe, it, expect } from 'vitest';
import { useStore } from '../../index';
import type { Effect } from '../../../types';

const ALL_EFFECT_TYPES: Effect['type'][] = ['composure','vitality','flag','disposition','suspicion','reputation','discoverClue','setMemoryFlag'];

describe('applyEffects handles every Effect type', () => {
  it('does not throw for any known effect type', () => {
    // minimal smoke: each type routed without hitting assertNever
    for (const type of ALL_EFFECT_TYPES) {
      expect(() => useStore.getState().applyEffects([{ type, target: 't', value: 1 } as Effect])).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run to verify** — it should PASS already (guards are additive). This test locks current behavior before adding `assertNever`. If your framework requires a RED, instead write the guard first as a deliberate typo-catch: skip strict RED here since this task hardens types, not behavior — **note in commit that this is a type-safety hardening task with a lock-in test, not a bug fix.**

- [ ] **Step 3: Add guards:**
  - `worldSlice.ts` — add `default: assertNever(effect.type as never);` (import from `./../../engine/constants`). *(effect is `Effect`; `effect.type` after all cases is `never`.)*
  - `effectMessages.ts` — the `default: return null` is intentional (5-of-8 handled by design). Leave it, but add a comment clarifying it's intentional-partial, not exhaustiveness. **Do not** add `assertNever` here (would throw on the deliberately-unhandled types).
  - `evaluateCondition` — replace `default: return false` with `default: return assertNever(type as never)`? **NO** — `evaluateCondition` intentionally returns false for unknown (defensive). Instead leave the runtime default AND add a separate compile check: after the switch, TypeScript already narrows. **Decision: add `assertNever` only to `worldSlice` (the silent-no-op risk); document the other two defaults as intentional.**

- [ ] **Step 4: Verify** — `npm run test:run` green; `tsc` green (assertNever compiles = switch is exhaustive).

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/worldSlice.ts src/store/slices/__tests__/worldSlice.effects.test.ts src/engine/effectMessages.ts
git commit -m "refactor(#19): exhaustiveness guard on worldSlice effect dispatch; document intentional partial defaults (F-064)"
```

---

### Task 4: Consolidate archetype tables (F-065)

**Files:**
- Modify: `src/data/archetypes.ts` (extend the `ARCHETYPES` table to carry primaryFaculty + abilityFlag), `src/engine/diceEngine.ts:49-54` (derive `PRIMARY_FACULTY` from the table), consumers of `ARCHETYPE_ABILITY_FLAG` (Task 1's `flags.ts` — decide the single home)
- Test: `src/data/__tests__/archetypes.test.ts` (or extend dice tests)

- [ ] **Step 1: Write the failing test** — assert derived maps match the table for all archetypes.

```ts
import { describe, it, expect } from 'vitest';
import { ARCHETYPES, primaryFacultyOf } from '../archetypes';

describe('archetype table is the single source', () => {
  it('exposes primary faculty per archetype', () => {
    expect(primaryFacultyOf('deductionist')).toBe('reason');
    expect(primaryFacultyOf('occultist')).toBe('lore');
    expect(primaryFacultyOf('operator')).toBe('vigor');
    expect(primaryFacultyOf('mesmerist')).toBe('influence');
  });
  it('covers every archetype in the ARCHETYPES array', () => {
    for (const a of ARCHETYPES) expect(primaryFacultyOf(a.id)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (`primaryFacultyOf` missing).

- [ ] **Step 3: Implement** — add `primaryFaculty: Faculty` to each `ArchetypeDefinition` in `archetypes.ts` (values: deductionist→reason, occultist→lore, operator→vigor, mesmerist→influence), export `primaryFacultyOf(id)`. In `diceEngine.ts:49-54`, replace the hardcoded `PRIMARY_FACULTY` literal with one built from `ARCHETYPES` (`Object.fromEntries(ARCHETYPES.map(a => [a.id, a.primaryFaculty]))` typed `Record<Archetype, Faculty>`), OR call `primaryFacultyOf` in `getTrainedBonus`. Keep `getTrainedBonus` behavior identical.

- [ ] **Step 4: Verify** — `npx vitest run src/engine/__tests__/diceEngine*.test.ts src/data/__tests__/archetypes.test.ts` → PASS; full suite green (trained-bonus property tests must still pass).

- [ ] **Step 5: Commit**

```bash
git add src/data/archetypes.ts src/engine/diceEngine.ts src/data/__tests__/archetypes.test.ts
git commit -m "refactor(#19): derive dice PRIMARY_FACULTY from the ARCHETYPES table (F-065)"
```

---

### Task 5: Type `lastCriticalFaculty` properly (F-013)

**Files:**
- Modify: `src/types/index.ts` (add `lastCriticalFaculty?: Faculty` to the relevant state interface — likely `InvestigatorState` or `GameState`; verify where `flags` lives and where progression reads it), `src/engine/narrativeEngine.ts:339-341,506-508` (write the field, not the flag), `src/engine/caseProgression.ts:65` (read the field), `src/store/slices/*` (the setter), `src/engine/flags.ts` (remove `lastCriticalFaculty` from `CASE_LOAD_CLEARED_FLAGS` and reset the field on load instead)
- Test: `src/engine/__tests__/caseProgression.test.ts` (or existing)

- [ ] **Step 1: Write the failing test** — critical outcome records the faculty as a typed field; case-completion faculty bonus reads it.

```ts
// assert: after a critical on a `reason` choice, state exposes lastCriticalFaculty === 'reason'
// and completeCase grants +1 to that faculty. Use the existing caseProgression test harness.
```

*(Read the existing `caseProgression.test.ts` to match its harness; write one concrete assertion that fails because the field doesn't exist yet.)*

- [ ] **Step 2: Run to verify it fails** — FAIL (field undefined / type error).

- [ ] **Step 3: Implement** — add `lastCriticalFaculty?: Faculty` to the state shape; add a store action `setLastCriticalFaculty(f)` (or reuse an investigator action); replace the `setFlag('last-critical-faculty', ... as unknown as boolean)` casts with the typed setter; `caseProgression.ts:65` reads `state.lastCriticalFaculty` directly (drop the `as unknown as Faculty`); reset it on case load (Task 6's `resetForNewCase`). Remove `lastCriticalFaculty` from `CASE_LOAD_CLEARED_FLAGS`.

- [ ] **Step 4: Verify** — full suite green; `grep -n "as unknown as boolean" src/engine` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(#18): model lastCriticalFaculty as a typed state field, not a smuggled flag (F-013)"
```

---

### Task 6: Dedup case/vignette load — resetForNewCase + vignetteToCaseData (F-063, F-066)

**Files:**
- Modify: `src/store/slices/narrativeSlice.ts` (`loadAndStartCase` `:108-160`, `loadAndStartVignette` `:165-208`), `src/store/slices/metaSlice.ts:82` (the duplicated adapter)
- Test: existing `src/store/slices/__tests__/narrativeSlice.test.ts` (reset behavior is already covered — those tests are the regression net)

- [ ] **Step 1** — Read `narrativeSlice.test.ts`; confirm it asserts meters reset to 10 and halt flags cleared on load (from the earlier #9 fix). These are the safety net; ensure they're green before refactor.

- [ ] **Step 2: Extract helpers.** Create a module-local (not exported unless tested directly) `resetForNewCase(state, data)` applying the shared block (currency, meters, flag clears via `CASE_LOAD_CLEARED_FLAGS`, clues/npcs/deductions/connections reset, `lastCheckResult=null`, firstScene fallback). Create exported `vignetteToCaseData(data)` returning `{ ...data, meta: { ...data.meta, acts: 2, facultyDistribution: {} }, variants: [] }`.

- [ ] **Step 3** — `loadAndStartCase` and `loadAndStartVignette` both call `resetForNewCase`; the vignette path uses `vignetteToCaseData(data)`; `metaSlice.ts:82` imports and uses `vignetteToCaseData` (delete its inline copy).

- [ ] **Step 4: Verify** — full suite green (no behavior change; the existing reset tests prove it).

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/narrativeSlice.ts src/store/slices/metaSlice.ts
git commit -m "refactor(#19): extract resetForNewCase + vignetteToCaseData (F-063, F-066)"
```

---

### Task 7: Guard encounter undefined-navigation (F-022, encounter twin)

**Files:**
- Modify: `src/engine/narrativeEngine.ts:502` (`processEncounterChoice` non-check branch)
- Test: `src/engine/__tests__/encounterSystem.test.ts`

- [ ] **Step 1: Write the failing test** — an encounter choice with no dice check and no `success`/`critical` outcome should throw a clear error (mirroring `computeChoiceResult`'s F-022 guard), not navigate to `undefined`.

```ts
it('throws when a non-check encounter choice has no success/critical outcome (F-022)', () => {
  // build an encounter choice with faculty undefined and outcomes = {} (or only failure)
  // expect processEncounterChoice(...) to throw /nowhere to navigate/
});
```

- [ ] **Step 2: Run to verify it fails** — currently returns `nextSceneId: undefined` (no throw) → test FAILS.

- [ ] **Step 3: Implement** — at `:502`, mirror the `computeChoiceResult` guard: compute `const fallback = choice.outcomes['success'] ?? choice.outcomes['critical']; if (!fallback) throw new Error('[NarrativeEngine] Encounter choice "'+choice.id+'" has no dice check and no success/critical outcome — nowhere to navigate.');` then assign.

- [ ] **Step 4: Verify** — new test passes; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrativeEngine.ts src/engine/__tests__/encounterSystem.test.ts
git commit -m "fix(#18): guard undefined navigation in processEncounterChoice non-check branch (F-022)"
```

---

### Task 8: Fix save migration for missing/NaN version (F-015)

**Files:**
- Modify: `src/engine/saveManager.ts:140-141` (coerce version to 0)
- Test: `src/engine/__tests__/saveManager*.test.ts`

- [ ] **Step 1: Write the failing test** — a SaveFile with `version: undefined` (legacy/hand-edited) must run all migrations (get `factionReputation`, `sceneHistory`, `connections`, `visitedScenes` backfilled), not silently skip to v3.

```ts
it('migrates a versionless save through all steps (F-015)', () => {
  const legacy = { version: undefined as unknown as number, timestamp: 1, state: { currentScene: 's', sceneHistory: [] } as any };
  const out = SaveManager.migrate(legacy);
  expect(out.version).toBe(3);
  expect(out.state.factionReputation).toEqual({});   // v0→1 ran
  expect(out.state.connections).toEqual([]);          // v1→2 ran
  expect(out.state.visitedScenes).toBeDefined();      // v2→3 ran
});
```

- [ ] **Step 2: Run to verify it fails** — currently `factionReputation` is undefined (all steps skipped) → FAIL.

- [ ] **Step 3: Implement** — at `:141` change `let version = saveFile.version;` to `let version = Number.isFinite(saveFile.version) ? saveFile.version : 0;`. *(The early `=== CURRENT_SAVE_VERSION` return at :136 still correctly short-circuits real current saves.)*

- [ ] **Step 4: Verify** — new test passes; existing migration tests (v0→v3 chain) stay green; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/saveManager.ts src/engine/__tests__/saveManager.test.ts
git commit -m "fix(#18): treat missing/NaN save version as 0 so migrations run (F-015)"
```

---

### Task 9: Discriminated-union `Condition` (F-026)

**Files:**
- Modify: `src/types/index.ts:114-127` (convert to discriminated union), `src/engine/narrativeEngine.ts:147-213` (`evaluateCondition` — remove casts), `src/engine/contentValidation.ts` (condition validation), any content-facing typing. **High blast radius — own commit.**
- Test: `src/engine/__tests__/narrativeEngine.property.test.ts`, `npcMemoryFlag.test.ts` (existing condition tests are the net)

- [ ] **Step 1** — Read all `Condition` consumers (`grep -rn "Condition" src --include=*.ts`). Confirm the eval branches and validators are the only value-readers.

- [ ] **Step 2: Write/extend a test** — a `facultyMin` condition's `value` is `number`, an `archetypeIs` condition's `value` is `Archetype`, an `npcSuspicion` condition's `value` is `NpcSuspicionTier` — assert these narrow without casts (compile-level; add a runtime eval assertion per branch to lock behavior).

- [ ] **Step 3: Convert the type.** Replace the flat interface with a union:

```ts
export type Condition =
  | { type: 'hasClue'; target: string }
  | { type: 'hasDeduction'; target: string }
  | { type: 'hasFlag'; target: string; value?: boolean }
  | { type: 'facultyMin'; target: Faculty; value: number }
  | { type: 'archetypeIs'; target: string; value: Archetype }
  | { type: 'npcDisposition'; target: string; value: number }
  | { type: 'npcSuspicion'; target: string; value: NpcSuspicionTier }
  | { type: 'factionReputation'; target: string; value: number }
  | { type: 'npcMemoryFlag'; target: string; value: string };
```

*(Verify each branch's actual `target`/`value` usage in `evaluateCondition` before finalizing — e.g. `hasFlag` uses `value?` as boolean; `archetypeIs` compares `value` to `state.investigator.archetype`. Match the union to reality.)*

- [ ] **Step 4: Update `evaluateCondition`** — remove the `value as number` / `value as NpcSuspicionTier` casts (now narrowed by `type`). Update `contentValidation.ts` condition checks similarly.

- [ ] **Step 5: Verify** — `tsc` green (proves all consumers satisfy the union); full suite + validator green.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/engine/narrativeEngine.ts src/engine/contentValidation.ts
git commit -m "refactor(#18): discriminated-union Condition; drop unchecked value casts (F-026)"
```

---

### Task 10: Unify advantage via `computeAdvantage`; fix badge (F-014)

**Files:**
- Create: `src/engine/advantage.ts`
- Create test: `src/engine/__tests__/advantage.test.ts`
- Modify: `src/engine/narrativeEngine.ts` (`:298-303` regular, `:467-480` encounter), `src/components/ChoicePanel/ChoiceCard.tsx:63-65` (badge)

- [ ] **Step 1: Write the failing test** — `computeAdvantage(choice, state)` returns true for a revealed `advantageIf` clue, true for a lore check with veil-sight active (no clue), false otherwise.

```ts
import { describe, it, expect } from 'vitest';
import { computeAdvantage } from '../advantage';
// minimal GameState/Choice fixtures
it('grants advantage from a revealed advantageIf clue', () => { /* ... */ });
it('grants advantage for a lore check with veil sight active and no clue', () => { /* ... */ });
it('no advantage for a non-lore check with no revealed clue', () => { /* ... */ });
```

- [ ] **Step 2: Run to verify it fails** — module missing → FAIL.

- [ ] **Step 3: Implement `src/engine/advantage.ts`**

```ts
import type { Choice, GameState } from '../types';
import { FLAGS } from './flags';

/** Single source of truth for whether a faculty check rolls with advantage. */
export function computeAdvantage(choice: Choice, state: GameState): boolean {
  const clueAdvantage = choice.advantageIf?.some((id) => state.clues[id]?.isRevealed) ?? false;
  const veilSightAdvantage = choice.faculty === 'lore' && !!state.flags[FLAGS.veilSight];
  return clueAdvantage || veilSightAdvantage;
}
```

- [ ] **Step 4: Route all three call sites through it:**
  - `narrativeEngine.ts:298-303` — `const hasAdvantage = computeAdvantage(choice, state);`
  - `narrativeEngine.ts:467-480` — replace the 3-variable block (incl. dead `hasOccultAdvantage`) with `const hasAdvantage = computeAdvantage(choice, state);`
  - **Badge fix (verified plumbing):** `ChoiceCard` receives only `revealedClueIds: Set<string>` (`ChoiceCardProps` at `ChoiceCard.tsx:44-48`), NOT `GameState` — so `computeAdvantage` can't be called inside it directly. Both callers already hold `gameState`: `ChoicePanel.tsx:53` (`const gameState = useStore(buildGameState)`) and `EncounterPanel.tsx` (`buildGameState`). **Approach:** add a `hasAdvantage: boolean` prop to `ChoiceCardProps`; compute it in each parent via `computeAdvantage(choice, gameState)` at the `<ChoiceCard>` call sites (`ChoicePanel.tsx:104-108` and EncounterPanel's usage); `ChoiceCard` renders the badge from the prop instead of its local clue-only expression (`:63-65`). This keeps `ChoiceCard` presentational and routes all advantage through the one function. Update the `ChoiceCard` render (`:124-132`) to key off the prop.

- [ ] **Step 5: Verify** — new test + full suite green. **Manual/Playwright check (ADR-0003):** an Occultist with Veil Sight active on a Lore choice now shows the Advantage badge (previously hidden). This is the one intended behavior change.

- [ ] **Step 6: Commit**

```bash
git add src/engine/advantage.ts src/engine/__tests__/advantage.test.ts src/engine/narrativeEngine.ts src/components/ChoicePanel/ChoiceCard.tsx
git commit -m "refactor(#14): unify advantage in computeAdvantage; badge now matches engine (Veil Sight) (F-014)"
```

---

### Task 11: Split `narrativeEngine.ts` (F-019) — RISKIEST, LAST

**Files:**
- Create: `src/engine/contentLoader.ts`, `src/engine/conditions.ts`, `src/engine/choiceResolution.ts`, `src/engine/encounters.ts`
- Modify: `src/engine/narrativeEngine.ts` (becomes a barrel re-export, OR delete and update importers), all importers (listed below)
- No new tests — the existing suite is the regression net (must stay green with zero behavior change).

**Importers to update (from the map):** `SceneCluePrompts.tsx`, `NarrativePanel.tsx`, `ChoicePanel.tsx`, `CaseSelection.tsx`, `store/index.ts`, `metaSlice.ts`, `narrativeSlice.ts`, `EncounterPanel.tsx`, and tests: `CaseSelection.test.tsx`, `clueDiscoveryGating.test.ts`, `narrativeEngine.property.test.ts`, `validateContent.test.ts`, `npcMemoryFlag.test.ts`, `veilSight.test.ts`, `integration.test.ts`, `encounterSystem.test.ts`.

- [ ] **Step 1** — Confirm green baseline (`npm run test:run`).

- [ ] **Step 2: Create the four modules by moving functions** (no logic edits):
  - `contentLoader.ts` ← `fetchManifest`, `injectSharedScenes`, `loadCase`, `loadVignette`, `validateContent`, private `fetchJson`, `indexById`.
  - `conditions.ts` ← `evaluateConditions`, `evaluateCondition`, `resolveScene`, `canDiscoverClue`.
  - `choiceResolution.ts` ← `computeChoiceResult`, `processChoice` (imports `computeAdvantage` from `advantage.ts`, `abilityAutoSucceedFlag`/`FLAGS` from `flags.ts`, condition helpers from `conditions.ts`).
  - `encounters.ts` ← `startEncounter`, `processEncounterChoice`, `getEncounterChoices` (imports from `conditions.ts`, `advantage.ts`).

- [ ] **Step 3: Make `narrativeEngine.ts` a barrel** — re-export everything the importers use: `export * from './contentLoader'; export * from './conditions'; export * from './choiceResolution'; export * from './encounters';`. This keeps all existing import paths working — **zero importer edits needed**, lowest-risk approach.

- [ ] **Step 4: Verify** — `tsc` green; `npm run test:run` → all 495+ still green (no test should need editing); `node scripts/validateCase.mjs` clean; `npm run build` green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/contentLoader.ts src/engine/conditions.ts src/engine/choiceResolution.ts src/engine/encounters.ts src/engine/narrativeEngine.ts
git commit -m "refactor(#14): split narrativeEngine.ts into contentLoader/conditions/choiceResolution/encounters; keep barrel (F-019)"
```

*(Optional follow-up, NOT this PR: migrate importers off the barrel to direct module paths, then delete the barrel. Deferred to avoid churn.)*

---

## Final verification (before PR)

- [ ] `npm run test:run` → all green (expect ~505+ tests: +flags 4, +constants 3, +archetypes 2, +worldSlice effects 1, +encounter guard 1, +versionless save 1, +advantage 3, plus any condition-branch additions).
- [ ] `node scripts/validateCase.mjs` → 7 cases clean.
- [ ] `npm run build` → green.
- [ ] **Playwright (ADR-0003):** load a main case (regression on the split + condition union); confirm the Veil Sight advantage badge now shows on a Lore choice for an Occultist (the F-014 behavior change).
- [ ] `grep` sweeps confirm single definition sites: `'ability-` (only flags.ts), faction literals (only constants.ts), `as unknown as boolean` (gone), `as unknown as Faculty` (gone).

## Findings coverage map

| Issue | Findings | Task(s) |
|---|---|---|
| #13 | F-018 | 1 |
| #14 | F-019, F-014, ~~F-027 (done)~~ | 11, 10 |
| #18 | F-013, F-026, F-022, F-015 | 5, 9, 7, 8 |
| #19 | F-063, F-064, F-065, F-066, F-067 | 6, 3, 4, 6, 2 |

F-027 pre-completed (verified). F-022 reduced to the encounter branch only (regular path already guarded).
