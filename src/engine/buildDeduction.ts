/**
 * buildDeduction — pure helper that constructs a Deduction from a set of clue IDs.
 *
 * Extracted as a standalone module so it can be property-tested in isolation.
 *
 * Req 7.10: If any connected clue is a Red Herring, isRedHerring must be true.
 */
import type { Clue, Deduction } from '../types';

/**
 * Builds a Deduction object from the given clue IDs and clue map.
 *
 * @param clueIds  - IDs of the clues being connected
 * @param clues    - flat map of all known clues (keyed by ID)
 * @returns a new Deduction with isRedHerring set correctly
 */
export function buildDeduction(
  clueIds: string[],
  clues: Record<string, Clue>,
): Deduction {
  const isRedHerring = clueIds.some(
    (id) => clues[id]?.type === 'redHerring',
  );

  return {
    id: `deduction-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    clueIds,
    description: isRedHerring
      ? 'A connection forms — but something feels off...'
      : 'The threads converge into a clear deduction.',
    isRedHerring,
  };
}
