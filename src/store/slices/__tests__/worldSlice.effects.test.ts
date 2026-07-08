import { describe, it, expect } from 'vitest';
import { useStore } from '../../index';
import type { Effect } from '../../../types';

const ALL_EFFECT_TYPES: Effect['type'][] = [
  'composure',
  'vitality',
  'flag',
  'disposition',
  'suspicion',
  'reputation',
  'discoverClue',
  'setMemoryFlag',
];

describe('applyEffects handles every Effect type', () => {
  it('does not throw for any known effect type', () => {
    for (const type of ALL_EFFECT_TYPES) {
      expect(() =>
        useStore.getState().applyEffects([{ type, target: 't', delta: 1 } as Effect]),
      ).not.toThrow();
    }
  });
});
