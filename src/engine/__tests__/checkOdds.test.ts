import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeCheckOdds, describeCheckOdds } from '../checkOdds';
import type { Investigator } from '../../types';

// Valid Investigator fixture. Archetype 'deductionist' has primaryFaculty 'reason'
// so a reason check gets +1 trained bonus. lastCriticalFaculty is OPTIONAL (omit).
function inv(reasonScore = 10, archetype: Investigator['archetype'] = 'deductionist'): Investigator {
  return {
    name: 'Test', archetype,
    faculties: { reason: reasonScore, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

const base = {
  investigator: inv(10, 'deductionist'), // reason 10 → mod 0, +1 trained (reason primary) = +1
  hasAdvantage: false, hasDisadvantage: false, autoSucceeds: false, partialCountsAsSuccess: false,
};

describe('computeCheckOdds — band thresholds at the EXACT .65 / .35 boundaries', () => {
  // needed = dc - modifier; p = clamp((21-needed)/20, .05, .95).
  // Favourable ≥ .65, Uncertain [.35,.65), Forbidding < .35. mod +1 (deductionist/reason).
  it('p == .65 exactly → Favourable (inclusive lower bound)', () => {
    // p .65 → needed = 8 → dc = 9
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 9 });
    expect(o.band).toBe('favourable');
  });
  it('just below .65 → Uncertain', () => {
    // needed 9 → p .60 → dc = 10
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 10 });
    expect(o.band).toBe('uncertain');
  });
  it('p == .35 exactly → Uncertain (inclusive lower bound)', () => {
    // p .35 → needed = 14 → dc = 15
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 15 });
    expect(o.band).toBe('uncertain');
  });
  it('just below .35 → Forbidding', () => {
    // needed 15 → p .30 → dc = 16
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 16 });
    expect(o.band).toBe('forbidding');
  });
});

describe('computeCheckOdds — clamp is load-bearing (fails if clamp deleted)', () => {
  it('extreme-high DC + disadvantage → Forbidding (guards the p<0 floor)', () => {
    // dc 40, mod +1 → needed 39 → raw p = -0.9. clamped p=.05 → disadv .0025 → Forbidding.
    // UNCLAMPED: (-0.9)^2 = .81 → Favourable (wrong) — this flips if clamp deleted.
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 40, hasDisadvantage: true });
    expect(o.band).toBe('forbidding');
  });
  it('extreme-low DC + advantage → Favourable (guards the p>1 ceiling)', () => {
    // dc -20, mod +1 → needed -21 → raw p = 2.1. clamped p=.95 → adv .9975 → Favourable.
    // UNCLAMPED: 1-(1-2.1)^2 = -0.21 → Forbidding (wrong) — flips if clamp deleted.
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: -20, hasAdvantage: true });
    expect(o.band).toBe('favourable');
  });
});

describe('computeCheckOdds — advantage / disadvantage', () => {
  it('advantage lifts a Forbidding bare check to Uncertain', () => {
    // dc 17 → needed 16 → p .25 (forbidding). adv pEff = 1-(1-.25)^2 = .4375 → uncertain.
    const bare = computeCheckOdds({ ...base, faculty: 'reason', dc: 17 });
    const adv = computeCheckOdds({ ...base, faculty: 'reason', dc: 17, hasAdvantage: true });
    expect(bare.band).toBe('forbidding');
    expect(adv.band).toBe('uncertain');
  });
  it('disadvantage lowers a bare Uncertain check to Forbidding', () => {
    // dc 13 → needed 12 → p .45; disadv .45^2 = .2025 → forbidding.
    const dis = computeCheckOdds({ ...base, faculty: 'reason', dc: 13, hasDisadvantage: true });
    expect(dis.band).toBe('forbidding');
  });
  it('advantage + disadvantage cancel', () => {
    const both = computeCheckOdds({ ...base, faculty: 'reason', dc: 13, hasAdvantage: true, hasDisadvantage: true });
    const plain = computeCheckOdds({ ...base, faculty: 'reason', dc: 13 });
    expect(both.band).toBe(plain.band);
  });
});

describe('computeCheckOdds — partialCountsAsSuccess', () => {
  it('including partial can raise the band on a clue prompt', () => {
    // perception mod 0 (score 10, NOT the deductionist primary). dc 10:
    //   strict:  needed 10 → p .55 → uncertain
    //   partial: needed dc-3 = 7 → p .70 → favourable
    const strict = computeCheckOdds({ ...base, faculty: 'perception', dc: 10 });
    const lenient = computeCheckOdds({ ...base, faculty: 'perception', dc: 10, partialCountsAsSuccess: true });
    expect(strict.band).toBe('uncertain');
    expect(lenient.band).toBe('favourable');
  });
});

describe('computeCheckOdds — autoSucceeds', () => {
  it('marks autoSucceeds and defaults band to favourable regardless of DC', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 40, autoSucceeds: true });
    expect(o.autoSucceeds).toBe(true);
    expect(o.band).toBe('favourable');
  });
});

describe('describeCheckOdds', () => {
  it('phrases a normal check', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 13 });
    expect(describeCheckOdds(o)).toBe('Reason check, modifier +1, difficulty 13, prospects uncertain');
  });
  it('appends advantage', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 9, hasAdvantage: true });
    expect(describeCheckOdds(o)).toContain('advantage');
  });
  it('phrases an assured check without probability language', () => {
    const o = computeCheckOdds({ ...base, faculty: 'reason', dc: 13, autoSucceeds: true });
    expect(describeCheckOdds(o)).toBe('Reason check, assured success');
  });
});

describe('computeCheckOdds — monotonic in modifier (property)', () => {
  const order = { forbidding: 0, uncertain: 1, favourable: 2 } as const;
  it('higher modifier never yields a worse band at fixed DC', () => {
    fc.assert(fc.property(
      fc.integer({ min: 4, max: 20 }), fc.integer({ min: 4, max: 20 }), fc.integer({ min: 1, max: 25 }),
      (loScore, hiScore, dc) => {
        const lo = Math.min(loScore, hiScore), hi = Math.max(loScore, hiScore);
        const oLo = computeCheckOdds({ ...base, investigator: inv(lo), faculty: 'reason', dc });
        const oHi = computeCheckOdds({ ...base, investigator: inv(hi), faculty: 'reason', dc });
        expect(order[oHi.band]).toBeGreaterThanOrEqual(order[oLo.band]);
      },
    ));
  });
});
