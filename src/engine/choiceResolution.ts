/**
 * Choice Resolution
 *
 * Pure choice-outcome computation and the store-facing processChoice action.
 */

import type {
  Choice,
  ChoiceResult,
  GameState,
} from '../types';
import type { EngineActions } from './engineActions';
import { performCheck, resolveDC } from './diceEngine';
import { abilityAutoSucceedFlag } from './flags';
import { computeAdvantage } from './advantage';

// ─── Choice Processing ────────────────────────────────────────────────────────

/**
 * The outcome of a check plus, when the archetype auto-succeed ability fired,
 * the flag that must be consumed (F-101). The consuming caller (`processChoice`,
 * `processEncounterChoice`) clears it via `actions.setFlag(flag, false)` so the
 * once-per-case ability works exactly once.
 */
export interface CheckOutcome {
  result: ChoiceResult;
  consumedAbilityFlag?: string;
}

/**
 * Shared, pure check-resolution unit used by BOTH choice processing and
 * encounters so the two paths cannot drift (F-107). Handles:
 *   - the archetype auto-succeed ability (returns tier `critical` and names the
 *     flag to consume — F-101),
 *   - dynamic-difficulty DC resolution,
 *   - advantage (clue OR Veil-Sight),
 *   - the dice roll,
 *   - and the non-check `success`/`critical` fallback destination.
 *
 * No store access, no side effects. `label` only shapes the error message so
 * choices and encounters keep their distinct wording.
 */
export function resolveCheckOutcome(
  choice: Choice,
  state: GameState,
  label = 'Choice',
): CheckOutcome {
  if (choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty)) {
    const abilityFlag = abilityAutoSucceedFlag(choice.faculty);
    if (abilityFlag && state.flags[abilityFlag]) {
      return {
        result: { nextSceneId: choice.outcomes['critical'], tier: 'critical' },
        consumedAbilityFlag: abilityFlag,
      };
    }

    const dc = resolveDC(choice, state.investigator);
    const hasAdvantage = computeAdvantage(choice, state);
    const check = performCheck(choice.faculty, state.investigator, dc, hasAdvantage, false);
    return {
      result: {
        nextSceneId: choice.outcomes[check.tier],
        roll: check.roll,
        modifier: check.modifier,
        total: check.total,
        tier: check.tier,
      },
    };
  }

  const fallbackScene = choice.outcomes['success'] ?? choice.outcomes['critical'];
  if (!fallbackScene) {
    // A non-check choice must always name a destination. Without this guard,
    // navigation to `undefined` yields a blank scene (resolveScene throws,
    // useCurrentScene swallows it). Fail loudly at the source instead (F-022).
    throw new Error(
      `[NarrativeEngine] ${label} "${choice.id}" has no dice check and no "success"/"critical" outcome — nowhere to navigate.`,
    );
  }
  return { result: { nextSceneId: fallbackScene, tier: 'success' } };
}

/**
 * Pure computation of a choice outcome. No store access, no side effects.
 * Thin wrapper over the shared {@link resolveCheckOutcome}; the ability-flag
 * consumption it signals is applied by the impure `processChoice`.
 */
export function computeChoiceResult(
  choice: Choice,
  state: GameState,
): ChoiceResult {
  return resolveCheckOutcome(choice, state).result;
}

/**
 * Processes a player choice: computes the outcome, applies npcEffect,
 * and navigates to the next scene.
 */
export function processChoice(
  choice: Choice,
  state: GameState,
  actions: EngineActions,
): ChoiceResult {
  const { result, consumedAbilityFlag } = resolveCheckOutcome(choice, state);

  // Consume the once-per-case auto-succeed ability so it cannot auto-crit every
  // subsequent same-faculty check for the rest of the case (F-101).
  if (consumedAbilityFlag) {
    actions.setFlag(consumedAbilityFlag, false);
  }

  if (result.tier === 'critical' && choice.faculty) {
    actions.setLastCriticalFaculty(choice.faculty);
  }

  if (choice.npcEffect) {
    const { npcId, dispositionDelta, suspicionDelta } = choice.npcEffect;
    actions.adjustDisposition(npcId, dispositionDelta);
    actions.adjustSuspicion(npcId, suspicionDelta);
  }

  actions.goToScene(result.nextSceneId);
  return result;
}
