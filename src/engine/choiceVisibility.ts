/**
 * choiceVisibility — the single source of truth for whether a Choice is shown,
 * shown-but-disabled (with a gateReason), or hidden, given the current game state.
 *
 * Pure + RNG-free. Imports evaluateConditions directly from ./conditions (NOT via
 * the narrativeEngine barrel — that would create a barrel cycle; Phase 5 spec §4).
 *
 * `visibility` governs ONLY the unmet-gate case:
 *   - no gate, or gate met            -> 'shown'
 *   - gate unmet + 'disabled'         -> 'disabled'
 *   - gate unmet + 'shown'            -> 'shown'   (soft-gate escape hatch)
 *   - gate unmet + 'hidden'/absent    -> 'hidden'  (today's default)
 *
 * A choice "has a gate" iff choiceGateConditions(choice).length > 0. Conditions are
 * built ONLY for truthy requires* fields — matching the two former callers — so a
 * malformed requiresFlag:'' stays ungated and shown (backward-compat; spec §3).
 */
import { evaluateConditions } from './conditions';
import type { Choice, Condition, GameState } from '../types';

export type ChoiceVisibilityState = 'shown' | 'disabled' | 'hidden';

/** Builds the requires* -> Condition[] list. Single source of truth for choice gating. */
export function choiceGateConditions(choice: Choice): Condition[] {
  const conditions: Condition[] = [];
  if (choice.requiresClue) {
    conditions.push({ type: 'hasClue', target: choice.requiresClue });
  }
  if (choice.requiresDeduction) {
    conditions.push({ type: 'hasDeduction', target: choice.requiresDeduction });
  }
  if (choice.requiresFlag) {
    conditions.push({ type: 'hasFlag', target: choice.requiresFlag });
  }
  if (choice.requiresFaculty) {
    conditions.push({
      type: 'facultyMin',
      target: choice.requiresFaculty.faculty,
      value: choice.requiresFaculty.minimum,
    });
  }
  return conditions;
}

/** The resolved visibility state for a choice given current game state. */
export function resolveChoiceVisibility(choice: Choice, state: GameState): ChoiceVisibilityState {
  const conditions = choiceGateConditions(choice);
  if (conditions.length === 0 || evaluateConditions(conditions, state)) {
    return 'shown';
  }
  // Gate is unmet.
  if (choice.visibility === 'disabled') return 'disabled';
  if (choice.visibility === 'shown') return 'shown';
  return 'hidden';
}
