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
