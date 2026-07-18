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

  it('validates onForm effect targets like any other effect list', () => {
    const recipes: KeyDeduction[] = [{
      id: 'r-onform', requiredClues: ['c-a'], title: 'T', description: 'D',
      isRedHerring: false,
      onForm: [{ type: 'disposition', target: 'npc-missing', delta: 1 }],
    }];
    const { errors } = validateBundle(bundle({ recipes }));
    expect(errors.some((e) => e.includes('npc-missing'))).toBe(true);
  });

  it('rejects an unknown effect type (the one shape that throws at runtime)', () => {
    // worldSlice.applyEffects hits assertNever on an unknown type — content JSON
    // bypasses the compile-time union, so the validator must catch it at load
    // (Codex impl review, Major 2).
    const recipes: KeyDeduction[] = [{
      id: 'r-badfx', requiredClues: ['c-a'], title: 'T', description: 'D',
      isRedHerring: false,
      onForm: [{ type: 'summonEntity' as never, target: 'x', value: true }],
    }];
    const { errors } = validateBundle(bundle({ recipes }));
    expect(errors.some((e) => e.includes('unknown effect type "summonEntity"'))).toBe(true);
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

// F-102: the Mayfair true ending was gated behind a key deduction whose required
// clues could only be gathered via natural-20 (critical) rolls — statistically
// unreachable through skilled play. This rule catches that class mechanically:
// every clue in a *gated* recipe must have at least one discovery source
// reachable WITHOUT relying on a critical outcome. Build-time only (needs the
// firstScene + full graph → opt-in via includeReachability, like other
// reachability checks), so the runtime validateContent is unaffected.
describe('validateBundle — deduction clues must be reachable without a critical roll (F-102)', () => {
  // firstScene s1 has a faculty check. Its `critical` tier goes to s-crit (which
  // is the ONLY source of c-gated); every other tier funnels to s-safe.
  const scenes: SceneNode[] = [
    {
      id: 's1', act: 1, narrative: 'start', cluesAvailable: [],
      choices: [{
        id: 'ch-check', text: 'investigate', faculty: 'reason', difficulty: 12,
        outcomes: { critical: 's-crit', success: 's-safe', partial: 's-safe', failure: 's-safe', fumble: 's-safe' },
      }],
    },
    {
      id: 's-crit', act: 1, narrative: 'crit-only room',
      cluesAvailable: [{ clueId: 'c-gated', method: 'exploration' }],
      choices: [{ id: 'ch-crit-go', text: 'go', outcomes: { critical: 's-end', success: 's-end', partial: 's-end', failure: 's-end', fumble: 's-end' } }],
    },
    {
      id: 's-safe', act: 2, narrative: 'safe room',
      cluesAvailable: [{ clueId: 'c-open', method: 'automatic' }],
      choices: [{ id: 'ch-accuse', text: 'accuse', requiresDeduction: 'r-true',
        outcomes: { critical: 's-end', success: 's-end', partial: 's-end', failure: 's-end', fumble: 's-end' } }],
    },
    { id: 's-end', act: 3, narrative: 'ending', cluesAvailable: [], choices: [] },
  ];
  const recipes: KeyDeduction[] = [{
    id: 'r-true', requiredClues: ['c-gated', 'c-open'], title: 't', description: 'd', isRedHerring: false,
  }];

  it('errors when a gated recipe clue is only sourced on a critical tier', () => {
    const { errors } = validateBundle(
      bundle({ scenes, clues: [clue('c-gated'), clue('c-open')], recipes, firstScene: 's1' }),
      { includeReachability: true },
    );
    expect(errors.some((e) => e.includes('c-gated') && /critical/i.test(e))).toBe(true);
  });

  it('does not fire without includeReachability (runtime path is unaffected)', () => {
    const { errors } = validateBundle(
      bundle({ scenes, clues: [clue('c-gated'), clue('c-open')], recipes, firstScene: 's1' }),
    );
    expect(errors.some((e) => e.includes('c-gated'))).toBe(false);
  });

  it('passes once the clue has a non-critical source', () => {
    // Add c-gated to the non-critical s-safe scene too.
    const fixed = scenes.map((s) =>
      s.id === 's-safe'
        ? { ...s, cluesAvailable: [...s.cluesAvailable, { clueId: 'c-gated', method: 'exploration' as const }] }
        : s,
    );
    const { errors } = validateBundle(
      bundle({ scenes: fixed, clues: [clue('c-gated'), clue('c-open')], recipes, firstScene: 's1' }),
      { includeReachability: true },
    );
    expect(errors).toEqual([]);
  });

  it('still errors when the crit-only clue is merely REFERENCED (requiresClue) on a non-crit scene', () => {
    // The exact Mayfair shape: the clue's only *source* (cluesAvailable) is on
    // the critical scene, but a non-crit scene references it via requiresClue.
    // A reference is not a source — the rule must still fire.
    const referencing = scenes.map((s) =>
      s.id === 's-safe'
        ? {
            ...s,
            choices: [{
              id: 'ch-need', text: 'use journal', requiresClue: 'c-gated',
              outcomes: { critical: 's-end', success: 's-end', partial: 's-end', failure: 's-end', fumble: 's-end' },
            }, ...s.choices],
          }
        : s,
    );
    const { errors } = validateBundle(
      bundle({ scenes: referencing, clues: [clue('c-gated'), clue('c-open')], recipes, firstScene: 's1' }),
      { includeReachability: true },
    );
    expect(errors.some((e) => e.includes('c-gated') && /critical/i.test(e))).toBe(true);
  });

  it('accepts an onEnter discoverClue as a valid non-critical source', () => {
    const viaEffect = scenes.map((s) =>
      s.id === 's-safe'
        ? { ...s, onEnter: [{ type: 'discoverClue' as const, target: 'c-gated' }] }
        : s,
    );
    const { errors } = validateBundle(
      bundle({ scenes: viaEffect, clues: [clue('c-gated'), clue('c-open')], recipes, firstScene: 's1' }),
      { includeReachability: true },
    );
    expect(errors).toEqual([]);
  });

  it('ignores recipes that are not gated by any requiresDeduction/hasDeduction', () => {
    // Same crit-only sourcing, but nothing references r-true as a gate → no error.
    const ungated = scenes.map((s) =>
      s.id === 's-safe'
        ? { ...s, choices: [{ id: 'ch-plain', text: 'end', outcomes: { critical: 's-end', success: 's-end', partial: 's-end', failure: 's-end', fumble: 's-end' } }] }
        : s,
    );
    const { errors } = validateBundle(
      bundle({ scenes: ungated, clues: [clue('c-gated'), clue('c-open')], recipes, firstScene: 's1' }),
      { includeReachability: true },
    );
    expect(errors.some((e) => e.includes('c-gated'))).toBe(false);
  });
});
