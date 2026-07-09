import { describe, it, expect, beforeEach } from 'vitest';
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

// The "does not throw" test above is a smoke test — it never checks the RESULT
// of a flag effect. The flag path is `setFlag(target, value ?? true)`: `?? true`
// defaults ONLY when value is null/undefined, so an authored `value:false` must
// be stored as false, not coerced true. Nothing asserted that, so swapping `??`
// for `||` (which flips false→true) survived the suite. These pin the result.
describe('applyEffects — flag effect result (guards the `?? true` default)', () => {
  beforeEach(() => {
    useStore.setState({ flags: {} });
  });

  it('stores true for a flag effect with no explicit value (the default)', () => {
    useStore.getState().applyEffects([{ type: 'flag', target: 'seen-ghost' }]);
    expect(useStore.getState().flags['seen-ghost']).toBe(true);
  });

  it('stores false for a flag effect with value:false (NOT coerced to true)', () => {
    useStore.getState().applyEffects([{ type: 'flag', target: 'door-locked', value: false }]);
    expect(useStore.getState().flags['door-locked']).toBe(false);
  });

  it('stores true for a flag effect with value:true', () => {
    useStore.getState().applyEffects([{ type: 'flag', target: 'alarm-raised', value: true }]);
    expect(useStore.getState().flags['alarm-raised']).toBe(true);
  });

  it('stores a string value verbatim for a string-valued flag effect', () => {
    // setFlag accepts boolean | string; the flag map stores it as-is (the
    // `as boolean` cast is only to satisfy the record type — the value survives).
    useStore.getState().applyEffects([{ type: 'flag', target: 'ending', value: 'court-deal' }]);
    expect(useStore.getState().flags['ending'] as unknown).toBe('court-deal');
  });
});

// The composure/vitality/reputation effect paths are guarded (`delta !== undefined`);
// assert the delta actually reaches state so a dropped guard or wrong action is caught.
describe('applyEffects — numeric effect results reach the store', () => {
  beforeEach(() => {
    useStore.setState({
      investigator: {
        name: 'Test', archetype: 'deductionist', abilityUsed: false,
        faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
        composure: 10, vitality: 10,
      },
      factionReputation: {},
    });
  });

  it('applies a composure delta to the investigator', () => {
    useStore.getState().applyEffects([{ type: 'composure', delta: -3 }]);
    expect(useStore.getState().investigator.composure).toBe(7);
  });

  it('applies a vitality delta to the investigator', () => {
    useStore.getState().applyEffects([{ type: 'vitality', delta: -2 }]);
    expect(useStore.getState().investigator.vitality).toBe(8);
  });

  it('applies a reputation delta to the named faction', () => {
    useStore.getState().applyEffects([{ type: 'reputation', target: 'Lamplighters', delta: 4 }]);
    expect(useStore.getState().factionReputation['Lamplighters']).toBe(4);
  });
});
