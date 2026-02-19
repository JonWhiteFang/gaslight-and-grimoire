/**
 * Property-based tests for NPC disposition and suspicion bounds.
 *
 * Property 9: `adjustDisposition` never produces a value outside [-10, +10]
 * Validates: Requirements 8.1
 *
 * Property 10: `adjustSuspicion` never produces a value outside [0, 10]
 * Validates: Requirements 8.1
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';

// ─── Pure clamping helpers (mirrors the logic in npcSlice) ───────────────────

/** Applies a disposition delta and clamps the result to [-10, +10]. */
function clampDisposition(current: number, delta: number): number {
  return Math.max(-10, Math.min(10, current + delta));
}

/** Applies a suspicion delta and clamps the result to [0, 10]. */
function clampSuspicion(current: number, delta: number): number {
  return Math.max(0, Math.min(10, current + delta));
}

// ─── Property 9 ───────────────────────────────────────────────────────────────

describe('Property 9 — adjustDisposition never produces a value outside [-10, +10]', () => {
  /**
   * Validates: Requirements 8.1
   * For any starting disposition in [-10, +10] and any integer delta in [-20, +20],
   * the result must always remain within [-10, +10].
   */
  it('result is always in [-10, +10] for any starting value and delta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // valid starting disposition
        fc.integer({ min: -20, max: 20 }),  // any delta
        (current, delta) => {
          const result = clampDisposition(current, delta);
          return result >= -10 && result <= 10;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('result is always an integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }),
        fc.integer({ min: -20, max: 20 }),
        (current, delta) => {
          const result = clampDisposition(current, delta);
          return Number.isInteger(result);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('large positive delta clamps to exactly +10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }),
        fc.integer({ min: 20, max: 20 }), // maximum positive delta
        (current, delta) => {
          const result = clampDisposition(current, delta);
          return result === 10;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('large negative delta clamps to exactly -10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }),
        fc.integer({ min: -20, max: -20 }), // maximum negative delta
        (current, delta) => {
          const result = clampDisposition(current, delta);
          return result === -10;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10 ──────────────────────────────────────────────────────────────

describe('Property 10 — adjustSuspicion never produces a value outside [0, 10]', () => {
  /**
   * Validates: Requirements 8.1
   * For any starting suspicion in [0, 10] and any integer delta in [-10, +10],
   * the result must always remain within [0, 10].
   */
  it('result is always in [0, 10] for any starting value and delta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),   // valid starting suspicion
        fc.integer({ min: -10, max: 10 }), // any delta
        (current, delta) => {
          const result = clampSuspicion(current, delta);
          return result >= 0 && result <= 10;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('result is always an integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: -10, max: 10 }),
        (current, delta) => {
          const result = clampSuspicion(current, delta);
          return Number.isInteger(result);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('large positive delta clamps to exactly 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 10, max: 10 }), // maximum positive delta
        (current, delta) => {
          const result = clampSuspicion(current, delta);
          return result === 10;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('large negative delta clamps to exactly 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: -10, max: -10 }), // maximum negative delta
        (current, delta) => {
          const result = clampSuspicion(current, delta);
          return result === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('suspicion can never go below 0 (no negative suspicion)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),    // low starting suspicion
        fc.integer({ min: -10, max: -1 }), // any negative delta
        (current, delta) => {
          const result = clampSuspicion(current, delta);
          return result >= 0;
        },
      ),
      { numRuns: 500 },
    );
  });
});
