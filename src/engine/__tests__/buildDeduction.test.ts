import { describe, it, expect } from 'vitest';
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
