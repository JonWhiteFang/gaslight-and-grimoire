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
 * Pure computation of a choice outcome. No store access, no side effects.
 * Handles ability auto-succeed, dice checks, advantage, and DC resolution.
 */
export function computeChoiceResult(
  choice: Choice,
  state: GameState,
): ChoiceResult {
  if (choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty)) {
    const abilityFlag = abilityAutoSucceedFlag(choice.faculty);
    if (abilityFlag && state.flags[abilityFlag]) {
      return { nextSceneId: choice.outcomes['critical'], tier: 'critical' };
    }

    const dc = resolveDC(choice, state.investigator);
    const hasAdvantage = computeAdvantage(choice, state);
    const result = performCheck(choice.faculty, state.investigator, dc, hasAdvantage, false);
    return {
      nextSceneId: choice.outcomes[result.tier],
      roll: result.roll,
      modifier: result.modifier,
      total: result.total,
      tier: result.tier,
    };
  }

  const fallbackScene = choice.outcomes['success'] ?? choice.outcomes['critical'];
  if (!fallbackScene) {
    // A non-check choice must always name a destination. Without this guard,
    // navigation to `undefined` yields a blank scene (resolveScene throws,
    // useCurrentScene swallows it). Fail loudly at the source instead (F-022).
    throw new Error(
      `[NarrativeEngine] Choice "${choice.id}" has no dice check and no "success"/"critical" outcome — nowhere to navigate.`,
    );
  }
  return {
    nextSceneId: fallbackScene,
    tier: 'success',
  };
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
  const result = computeChoiceResult(choice, state);

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
