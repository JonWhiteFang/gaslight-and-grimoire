/**
 * Encounter System
 *
 * Multi-round encounter setup, choice processing, and available-choice filtering.
 */

import type {
  Choice,
  ChoiceResult,
  EncounterRound,
  EncounterState,
  GameState,
} from '../types';
import type { EngineActions } from './engineActions';
import { performCheck, rollD20 } from './diceEngine';
import { evaluateConditions } from './conditions';
import { choiceGateConditions, resolveChoiceVisibility } from './choiceVisibility';
import { resolveCheckOutcome } from './choiceResolution';

// ─── Encounter System ─────────────────────────────────────────────────────────

/**
 * Starts an encounter, performing a Reaction_Check for supernatural encounters.
 *
 * For supernatural encounters:
 *   - Performs a Nerve or Lore check at DC 12
 *   - On failure: reduces Composure by 1–2 and replaces the first choice in
 *     round 1 with its `worseAlternative` (if provided)
 *
 * Returns an EncounterState ready for the first round.
 */
export function startEncounter(
  encounterId: string,
  rounds: EncounterRound[],
  isSupernatural: boolean,
  state: GameState,
  actions: EngineActions,
): EncounterState {

  let reactionCheckPassed: boolean | null = null;
  const processedRounds = rounds.map((r) => ({ ...r, choices: [...r.choices] }));

  if (isSupernatural && rounds.length > 0) {
    // Use the higher of Nerve or Lore, with Nerve as tiebreaker
    const reactionFaculty =
      state.investigator.faculties['nerve'] >= state.investigator.faculties['lore']
        ? 'nerve' as const
        : 'lore' as const;

    const result = performCheck(reactionFaculty, state.investigator, 12, false, false);
    reactionCheckPassed = result.tier === 'success' || result.tier === 'critical';

    if (!reactionCheckPassed) {
      // Reduce Composure by 1 or 2
      const composureDamage = (rollD20() % 2) + 1; // 1 or 2
      actions.adjustComposure(-composureDamage);

      // Replace first choice in round 1 with worseAlternative if available
      const firstRound = processedRounds[0];
      if (firstRound.choices.length > 0 && firstRound.choices[0].worseAlternative) {
        const replacement = firstRound.choices[0].worseAlternative;
        processedRounds[0] = {
          ...firstRound,
          choices: [replacement, ...firstRound.choices.slice(1)],
        };
      }
    }
  }

  return {
    id: encounterId,
    rounds: processedRounds,
    currentRound: 0,
    isComplete: false,
    reactionCheckPassed,
  };
}

/**
 * Processes a player's choice within an encounter round.
 *
 * - Performs the Faculty_Check for the choice
 * - For supernatural encounters: applies dual-axis damage (Composure + Vitality) on failure
 * - For mundane encounters: applies only the relevant damage type
 * - Advances currentRound; sets isComplete when all rounds are done
 * - Grants Advantage when the investigator holds a relevant Occult Fragment clue
 *
 * Returns updated EncounterState and ChoiceResult.
 */
export function processEncounterChoice(
  choice: Choice,
  encounterState: EncounterState,
  state: GameState,
  actions: EngineActions,
): { encounterState: EncounterState; result: ChoiceResult } {

  const currentRound = encounterState.rounds[encounterState.currentRound];
  const isSupernatural = currentRound?.isSupernatural ?? false;

  // Escape paths are terminal: they leave the encounter immediately for their
  // fixed outcome scene, rather than advancing to the next round. Without this
  // an escape choice in a non-final round silently continues the fight (F-004).
  if (choice.isEscapePath) {
    const escapeScene = choice.outcomes['success'] ?? choice.outcomes['critical'];
    if (escapeScene) {
      actions.goToScene(escapeScene);
    }
    return {
      encounterState: { ...encounterState, isComplete: true },
      result: { nextSceneId: escapeScene, tier: 'success' },
    };
  }

  // Resolve the check through the SAME shared unit as choice processing so the
  // two paths cannot drift (F-107). This gives encounters the archetype
  // auto-succeed ability, dynamic-difficulty DCs, and advantage (clue OR Veil
  // Sight) for free — all of which the old parallel pipeline silently ignored.
  const { result, consumedAbilityFlag } = resolveCheckOutcome(choice, state, 'Encounter choice');
  const { nextSceneId, roll, modifier, total, tier } = result;

  // Consume the once-per-case auto-succeed ability on use (F-101).
  if (consumedAbilityFlag) {
    actions.setFlag(consumedAbilityFlag, false);
  }

  if (tier === 'critical' && choice.faculty) {
    actions.setLastCriticalFaculty(choice.faculty);
  }

  // Apply damage effects
  const isFailure = tier === 'failure' || tier === 'fumble';
  if (isFailure && choice.encounterDamage) {
    const { composureDelta, vitalityDelta } = choice.encounterDamage;

    if (isSupernatural) {
      // Dual-axis: apply both Composure and Vitality damage
      if (composureDelta !== undefined) actions.adjustComposure(composureDelta);
      if (vitalityDelta !== undefined) actions.adjustVitality(vitalityDelta);
    } else {
      // Mundane: apply only the relevant damage type
      if (composureDelta !== undefined) actions.adjustComposure(composureDelta);
      else if (vitalityDelta !== undefined) actions.adjustVitality(vitalityDelta);
    }
  }

  // Apply NPC effects if present
  if (choice.npcEffect) {
    const { npcId, dispositionDelta, suspicionDelta } = choice.npcEffect;
    actions.adjustDisposition(npcId, dispositionDelta);
    actions.adjustSuspicion(npcId, suspicionDelta);
  }

  // Advance round counter
  const nextRound = encounterState.currentRound + 1;
  const isComplete = nextRound >= encounterState.rounds.length;

  const updatedEncounterState: EncounterState = {
    ...encounterState,
    currentRound: nextRound,
    isComplete,
  };

  // Navigate to the resolved scene when encounter is complete
  if (isComplete && nextSceneId) {
    actions.goToScene(nextSceneId);
  }

  return {
    encounterState: updatedEncounterState,
    result: { nextSceneId, roll, modifier, total, tier },
  };
}

/**
 * Returns the choices available for a given encounter round.
 *
 * - Non-escape choices resolve through the shared `resolveChoiceVisibility`
 *   resolver: included when 'shown' OR 'disabled' (the panel greys disabled
 *   ones), excluded when 'hidden'.
 * - Escape paths stay hard-gated: included only when their gate conditions
 *   are met, never disabled.
 *
 * The occult/Veil-Sight Advantage that applies to the actual roll is computed
 * in `processEncounterChoice` (the single source of truth for the roll), so this
 * function no longer annotates it — the former `_hasAdvantage` field had no
 * consumer and could disagree with the real rule (F-027).
 */
export function getEncounterChoices(
  round: EncounterRound,
  state: GameState,
): Choice[] {
  const filtered: Choice[] = [];

  for (const choice of round.choices) {
    if (choice.isEscapePath) {
      // Escape paths stay hard-gated (spec §4.1): included only when their gate
      // is met, never disabled.
      const conditions = choiceGateConditions(choice);
      if (evaluateConditions(conditions, state)) filtered.push(choice);
      continue;
    }

    // Non-escape: include when shown OR disabled (the panel greys disabled ones).
    const visibility = resolveChoiceVisibility(choice, state);
    if (visibility === 'shown' || visibility === 'disabled') {
      filtered.push(choice);
    }
  }

  return filtered;
}
