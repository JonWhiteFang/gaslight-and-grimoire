/**
 * Property-based tests for the Dice Engine.
 *
 * Property 2: `rollD20` always returns an integer in [1, 20]
 * Validates: Requirements 4.1
 *
 * Property 3: Advantage result is always ≥ either individual roll;
 *             Disadvantage result is always ≤ either individual roll
 * Validates: Requirements 4.3, 4.4
 *
 * Property 4: `calculateModifier` is monotonically non-decreasing and matches
 *             the floor formula for all scores 1–20
 * Validates: Requirements 4.1
 *
 * Property 5: `resolveCheck` with natural 20 always returns `critical`;
 *             natural 1 always returns `fumble`
 * Validates: Requirements 4.2
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  rollD20,
  rollWithAdvantage,
  rollWithDisadvantage,
  calculateModifier,
  resolveCheck,
} from '../diceEngine';

// ─── Property 2 ───────────────────────────────────────────────────────────────

describe('Property 2 — rollD20 always returns an integer in [1, 20]', () => {
  it('rollD20 result is an integer between 1 and 20 inclusive', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const result = rollD20();
        return (
          Number.isInteger(result) &&
          result >= 1 &&
          result <= 20
        );
      }),
      { numRuns: 1000 },
    );
  });
});

// ─── Property 3 ───────────────────────────────────────────────────────────────

describe('Property 3 — Advantage / Disadvantage roll bounds', () => {
  it('rollWithAdvantage result is always ≥ both individual rolls', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { roll1, roll2, result } = rollWithAdvantage();
        return result >= roll1 && result >= roll2;
      }),
      { numRuns: 1000 },
    );
  });

  it('rollWithDisadvantage result is always ≤ both individual rolls', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { roll1, roll2, result } = rollWithDisadvantage();
        return result <= roll1 && result <= roll2;
      }),
      { numRuns: 1000 },
    );
  });

  it('rollWithAdvantage result is one of the two rolls', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { roll1, roll2, result } = rollWithAdvantage();
        return result === roll1 || result === roll2;
      }),
      { numRuns: 1000 },
    );
  });

  it('rollWithDisadvantage result is one of the two rolls', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { roll1, roll2, result } = rollWithDisadvantage();
        return result === roll1 || result === roll2;
      }),
      { numRuns: 1000 },
    );
  });
});

// ─── Property 4 ───────────────────────────────────────────────────────────────

describe('Property 4 — calculateModifier is monotonically non-decreasing and matches floor formula', () => {
  it('matches Math.floor((score - 10) / 2) for all scores 1–20', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (score) => {
        return calculateModifier(score) === Math.floor((score - 10) / 2);
      }),
    );
  });

  it('is monotonically non-decreasing: higher score never yields lower modifier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 19 }),
        (score) => {
          return calculateModifier(score + 1) >= calculateModifier(score);
        },
      ),
    );
  });
});

// ─── Property 5 ───────────────────────────────────────────────────────────────

describe('Property 5 — resolveCheck natural 20 / natural 1 detection', () => {
  it('natural 20 always returns "critical" regardless of modifier and DC', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 10 }), // modifier range
        fc.integer({ min: 1, max: 30 }),   // DC range
        (modifier, dc) => {
          return resolveCheck(20, modifier, dc) === 'critical';
        },
      ),
    );
  });

  it('natural 1 always returns "fumble" regardless of modifier and DC', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 10 }), // modifier range
        fc.integer({ min: 1, max: 30 }),   // DC range
        (modifier, dc) => {
          return resolveCheck(1, modifier, dc) === 'fumble';
        },
      ),
    );
  });
});
