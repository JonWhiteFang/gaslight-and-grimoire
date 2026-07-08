import { describe, it, expect } from 'vitest';
import { matchDeduction, buildDeductionFromRecipe } from '../buildDeduction';
import type { KeyDeduction } from '../../types';

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
