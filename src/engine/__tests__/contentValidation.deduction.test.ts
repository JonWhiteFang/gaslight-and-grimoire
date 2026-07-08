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
