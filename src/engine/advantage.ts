import type { Choice, GameState } from '../types';
import { FLAGS } from './flags';

/**
 * Single source of truth for whether a faculty check rolls with advantage.
 *
 * Two independent grants, OR'd together:
 *   - clue advantage: any of the choice's `advantageIf` clue IDs is revealed
 *   - Veil Sight: a Lore check while the veil-sight ability flag is active
 *
 * Used by regular checks (computeChoiceResult), encounter checks
 * (processEncounterChoice), and the UI Advantage badge (via the parents that
 * hold GameState) so all three agree (F-014).
 */
export function computeAdvantage(choice: Choice, state: GameState): boolean {
  const clueAdvantage = choice.advantageIf?.some((id) => state.clues[id]?.isRevealed) ?? false;
  const veilSightAdvantage = choice.faculty === 'lore' && !!state.flags[FLAGS.veilSight];
  return clueAdvantage || veilSightAdvantage;
}
