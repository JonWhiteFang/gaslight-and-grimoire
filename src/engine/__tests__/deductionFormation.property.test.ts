/**
 * Property-based tests for Deduction formation.
 *
 * Property 8: A Deduction formed from clues where any clue is a Red Herring
 *             always sets `isRedHerring = true`.
 * Validates: Requirements 7.10
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildDeduction } from '../buildDeduction';
import type { Clue, ClueType, ClueStatus } from '../../types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const clueTypes: ClueType[] = ['physical', 'testimony', 'occult', 'deduction', 'redHerring'];
const nonRedHerringTypes: ClueType[] = ['physical', 'testimony', 'occult', 'deduction'];

/** Generates a minimal valid Clue with a given type. */
function arbClue(type: ClueType): fc.Arbitrary<Clue> {
  return fc.record({
    id: fc.uuid(),
    type: fc.constant(type),
    title: fc.string({ minLength: 1, maxLength: 40 }),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    sceneSource: fc.string({ minLength: 1, maxLength: 20 }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 4 }),
    status: fc.constant<ClueStatus>('examined'),
    isRevealed: fc.constant(true),
  });
}

/** Generates a Clue with any type. */
const arbAnyClue: fc.Arbitrary<Clue> = fc.oneof(
  ...clueTypes.map((t) => arbClue(t)),
);

/** Generates a Clue that is NOT a Red Herring. */
const arbNonRedHerringClue: fc.Arbitrary<Clue> = fc.oneof(
  ...nonRedHerringTypes.map((t) => arbClue(t)),
);

/** Generates a Red Herring clue. */
const arbRedHerringClue: fc.Arbitrary<Clue> = arbClue('redHerring');

// ─── Property 8 ───────────────────────────────────────────────────────────────

describe('Property 8 — Deduction with any Red Herring clue always sets isRedHerring = true', () => {
  it('isRedHerring is true when at least one clue is a redHerring', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty array of non-red-herring clues (0 or more)
        fc.array(arbNonRedHerringClue, { minLength: 0, maxLength: 4 }),
        // Generate at least one red herring clue
        fc.array(arbRedHerringClue, { minLength: 1, maxLength: 3 }),
        // Generate more non-red-herring clues to pad the array
        fc.array(arbNonRedHerringClue, { minLength: 0, maxLength: 4 }),
        (before, redHerrings, after) => {
          const allClues = [...before, ...redHerrings, ...after];
          // Build a flat clue map keyed by ID
          const clueMap: Record<string, Clue> = {};
          for (const clue of allClues) {
            clueMap[clue.id] = clue;
          }
          const clueIds = allClues.map((c) => c.id);

          const deduction = buildDeduction(clueIds, clueMap);
          return deduction.isRedHerring === true;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('isRedHerring is false when no clue is a redHerring', () => {
    fc.assert(
      fc.property(
        fc.array(arbNonRedHerringClue, { minLength: 2, maxLength: 6 }),
        (clueList) => {
          const clueMap: Record<string, Clue> = {};
          for (const clue of clueList) {
            clueMap[clue.id] = clue;
          }
          const clueIds = clueList.map((c) => c.id);

          const deduction = buildDeduction(clueIds, clueMap);
          return deduction.isRedHerring === false;
        },
      ),
      { numRuns: 500 },
    );
  });

  it('isRedHerring is true even when the red herring is the only clue', () => {
    fc.assert(
      fc.property(
        arbRedHerringClue,
        (redHerring) => {
          const clueMap: Record<string, Clue> = { [redHerring.id]: redHerring };
          const deduction = buildDeduction([redHerring.id], clueMap);
          return deduction.isRedHerring === true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it('returned Deduction always contains all provided clueIds', () => {
    fc.assert(
      fc.property(
        fc.array(arbAnyClue, { minLength: 1, maxLength: 6 }),
        (clueList) => {
          const clueMap: Record<string, Clue> = {};
          for (const clue of clueList) {
            clueMap[clue.id] = clue;
          }
          const clueIds = clueList.map((c) => c.id);

          const deduction = buildDeduction(clueIds, clueMap);
          return clueIds.every((id) => deduction.clueIds.includes(id));
        },
      ),
      { numRuns: 500 },
    );
  });
});
