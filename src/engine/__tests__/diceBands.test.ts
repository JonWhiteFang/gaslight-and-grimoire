/**
 * Table-driven boundary tests for the dice engine (F-029).
 *
 * These lock down the *exact* tier boundaries and the trained bonus that the
 * property tests don't pin down:
 *   - resolveCheck: success (total ≥ dc), partial (dc-3 ≤ total < dc, the
 *     documented DC-3 band), failure (total < dc-3), and nat-20/nat-1 override.
 *   - getTrainedBonus: +1 for the archetype's primary faculty, 0 otherwise.
 *   - resolveDC: static difficulty, default 12, and dynamic scaling.
 *   - performCheck: modifier = floor((score-10)/2) + trained bonus; dc echoed.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveCheck,
  getTrainedBonus,
  resolveDC,
  performCheck,
} from '../diceEngine';
import type { Archetype, Faculty, Investigator, Choice, OutcomeTier } from '../../types';

// ─── resolveCheck tier boundaries (dc = 15, modifier = 0) ─────────────────────

describe('resolveCheck — tier boundaries', () => {
  // roll is the natural die; modifier folded in via `total = roll + modifier`.
  const cases: Array<{ roll: number; modifier: number; dc: number; tier: OutcomeTier; why: string }> = [
    { roll: 20, modifier: -50, dc: 15, tier: 'critical', why: 'nat 20 overrides everything' },
    { roll: 1, modifier: 50, dc: 15, tier: 'fumble', why: 'nat 1 overrides everything' },
    { roll: 15, modifier: 0, dc: 15, tier: 'success', why: 'total == dc' },
    { roll: 16, modifier: 0, dc: 15, tier: 'success', why: 'total > dc' },
    { roll: 14, modifier: 0, dc: 15, tier: 'partial', why: 'total == dc-1' },
    { roll: 12, modifier: 0, dc: 15, tier: 'partial', why: 'total == dc-3 (bottom of partial band)' },
    { roll: 11, modifier: 0, dc: 15, tier: 'failure', why: 'total == dc-4 (just below partial band)' },
    { roll: 2, modifier: 0, dc: 15, tier: 'failure', why: 'well below dc' },
    // modifier participates in the band arithmetic
    { roll: 10, modifier: 5, dc: 15, tier: 'success', why: 'total 15 via +5 modifier' },
    { roll: 9, modifier: 3, dc: 15, tier: 'partial', why: 'total 12 == dc-3' },
  ];

  it.each(cases)('roll $roll +$modifier vs dc $dc → $tier ($why)', ({ roll, modifier, dc, tier }) => {
    expect(resolveCheck(roll, modifier, dc)).toBe(tier);
  });

  it('partial band spans exactly dc-3..dc-1 (3 wide)', () => {
    const dc = 12;
    // dc-3=9, dc-2=10, dc-1=11 → partial; dc-4=8 → failure; dc=12 → success
    expect(resolveCheck(8, 0, dc)).toBe('failure');
    expect(resolveCheck(9, 0, dc)).toBe('partial');
    expect(resolveCheck(10, 0, dc)).toBe('partial');
    expect(resolveCheck(11, 0, dc)).toBe('partial');
    expect(resolveCheck(12, 0, dc)).toBe('success');
  });
});

// ─── getTrainedBonus per archetype ────────────────────────────────────────────

describe('getTrainedBonus — +1 for the archetype primary faculty', () => {
  const primary: Record<Archetype, Faculty> = {
    deductionist: 'reason',
    occultist: 'lore',
    operator: 'vigor',
    mesmerist: 'influence',
  };
  const archetypes = Object.keys(primary) as Archetype[];
  const faculties: Faculty[] = ['reason', 'perception', 'nerve', 'vigor', 'influence', 'lore'];

  it.each(archetypes)('%s gets +1 on its primary faculty and 0 elsewhere', (archetype) => {
    for (const faculty of faculties) {
      const expected = faculty === primary[archetype] ? 1 : 0;
      expect(getTrainedBonus(faculty, archetype)).toBe(expected);
    }
  });
});

// ─── resolveDC ────────────────────────────────────────────────────────────────

function inv(overrides: Partial<Investigator> = {}): Investigator {
  return {
    name: 'T', archetype: 'deductionist', abilityUsed: false,
    faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10,
    ...overrides,
  };
}

describe('resolveDC', () => {
  it('uses the static difficulty when set', () => {
    const choice = { id: 'c', text: 't', difficulty: 14 } as Choice;
    expect(resolveDC(choice, inv())).toBe(14);
  });

  it('defaults to 12 when no difficulty is given', () => {
    const choice = { id: 'c', text: 't' } as Choice;
    expect(resolveDC(choice, inv())).toBe(12);
  });

  it('applies the high DC when the scaling faculty meets the threshold', () => {
    const choice = {
      id: 'c', text: 't',
      dynamicDifficulty: { baseDC: 10, scaleFaculty: 'reason', highThreshold: 14, highDC: 18 },
    } as Choice;
    expect(resolveDC(choice, inv({ faculties: { reason: 14, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 } }))).toBe(18);
  });

  it('applies the base DC when the scaling faculty is below the threshold', () => {
    const choice = {
      id: 'c', text: 't',
      dynamicDifficulty: { baseDC: 10, scaleFaculty: 'reason', highThreshold: 14, highDC: 18 },
    } as Choice;
    expect(resolveDC(choice, inv({ faculties: { reason: 13, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 } }))).toBe(10);
  });
});

// ─── performCheck modifier assembly (no advantage) ────────────────────────────

describe('performCheck — modifier assembly', () => {
  it('folds calculateModifier + trained bonus into the total and echoes the dc', () => {
    // reason 16 → floor((16-10)/2)=+3; deductionist primary reason → +1 → modifier +4
    const result = performCheck('reason', inv({ faculties: { reason: 16, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 } }), 15, false, false);
    expect(result.modifier).toBe(4);
    expect(result.total).toBe(result.roll + 4);
    expect(result.dc).toBe(15);
    expect(result.roll).toBeGreaterThanOrEqual(1);
    expect(result.roll).toBeLessThanOrEqual(20);
  });

  it('gives no trained bonus for a non-primary faculty', () => {
    // vigor 14 → +2, deductionist primary is reason so no trained bonus → +2
    const result = performCheck('vigor', inv({ faculties: { reason: 10, perception: 10, nerve: 10, vigor: 14, influence: 10, lore: 10 } }), 12, false, false);
    expect(result.modifier).toBe(2);
  });
});
