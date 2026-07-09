/**
 * Direct tests for `resolveScene` variant-resolution (F-115).
 *
 * `resolveScene` returns a variant when its `variantCondition` is met, else the
 * base scene. Every other test that touches variants uses `variants: []`, so the
 * predicate itself (`conditions.ts` — the `variantOf` match + condition eval) was
 * only exercised transitively and never directly asserted. Combined with F-118
 * (variant onEnter drop), this seam was untested.
 */

import { describe, it, expect } from 'vitest';
import { resolveScene } from '../conditions';
import type { CaseData, GameState, SceneNode } from '../../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function scene(id: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, act: 1, narrative: `narrative ${id}`, cluesAvailable: [], choices: [], ...extra };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: 'Test',
      archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    },
    currentScene: 'hub',
    currentCase: 'case-1',
    clues: {},
    deductions: {},
    npcs: {},
    flags: {},
    factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      textSpeed: 'instant',
      hintsEnabled: false,
      autoSaveFrequency: 'manual',
      audioVolume: { ambient: 0, sfx: 0 },
    },
    ...overrides,
  };
}

function makeCaseData(scenes: SceneNode[], variants: SceneNode[]): CaseData {
  const byId: Record<string, SceneNode> = {};
  for (const s of scenes) byId[s.id] = s;
  return {
    meta: { id: 'case-1', title: 'Case', synopsis: '', acts: 3, facultyDistribution: {} },
    scenes: byId,
    clues: {},
    npcs: {},
    variants,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('resolveScene — variant resolution (F-115)', () => {
  const base = scene('hub', { narrative: 'the base hub' });
  const variant = scene('hub-variant', {
    narrative: 'the altered hub',
    variantOf: 'hub',
    variantCondition: { type: 'hasFlag', target: 'flip' },
  });
  const caseData = makeCaseData([base], [variant]);

  it('returns the VARIANT when its condition is met', () => {
    const resolved = resolveScene('hub', makeState({ flags: { flip: true } }), caseData);
    expect(resolved.id).toBe('hub-variant');
    expect(resolved.narrative).toBe('the altered hub');
  });

  it('returns the BASE scene when the variant condition is NOT met', () => {
    const resolved = resolveScene('hub', makeState({ flags: {} }), caseData);
    expect(resolved.id).toBe('hub');
    expect(resolved.narrative).toBe('the base hub');
  });

  it('returns the base scene when there is no variant targeting it', () => {
    const other = scene('lobby');
    const resolved = resolveScene('lobby', makeState({ flags: { flip: true } }), makeCaseData([other], [variant]));
    expect(resolved.id).toBe('lobby');
  });

  it('ignores a variant that targets a DIFFERENT scene even when its condition holds', () => {
    // The variant targets `hub`, not `other`; resolving `other` must not pick it up.
    const other = scene('other', { narrative: 'unrelated scene' });
    const resolved = resolveScene('other', makeState({ flags: { flip: true } }), makeCaseData([base, other], [variant]));
    expect(resolved.id).toBe('other');
  });

  it('selects the variant whose condition is met when several target the same scene', () => {
    const variantA = scene('hub-a', {
      variantOf: 'hub',
      variantCondition: { type: 'hasFlag', target: 'a' },
    });
    const variantB = scene('hub-b', {
      variantOf: 'hub',
      variantCondition: { type: 'hasFlag', target: 'b' },
    });
    const data = makeCaseData([base], [variantA, variantB]);

    expect(resolveScene('hub', makeState({ flags: { b: true } }), data).id).toBe('hub-b');
    expect(resolveScene('hub', makeState({ flags: { a: true } }), data).id).toBe('hub-a');
  });

  it('ignores a variant that has no variantCondition (falls through to base)', () => {
    // A variant with no condition is not a valid trigger — resolveScene requires
    // `variantCondition !== undefined`. It must not be silently always-on.
    const conditionless = scene('hub-bad', { variantOf: 'hub' });
    const data = makeCaseData([base], [conditionless]);
    expect(resolveScene('hub', makeState(), data).id).toBe('hub');
  });

  it('throws a clear error when the requested scene id is absent from the case', () => {
    expect(() => resolveScene('does-not-exist', makeState(), caseData)).toThrow(/not found/i);
  });
});
