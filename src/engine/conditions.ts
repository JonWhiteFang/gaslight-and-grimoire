/**
 * Conditions & Scene Resolution
 *
 * Pure condition evaluation, scene/variant resolution, and clue-discovery gating.
 */

import type {
  CaseData,
  ClueDiscovery,
  Condition,
  GameState,
  SceneNode,
} from '../types';

// ─── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates an array of conditions against the current game state.
 * All conditions must be satisfied (AND logic).
 * This is a pure function — no side effects, no store access.
 */
export function evaluateConditions(
  conditions: Condition[],
  state: GameState,
): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((condition) => evaluateCondition(condition, state));
}

function evaluateCondition(condition: Condition, state: GameState): boolean {
  // `condition` is a discriminated union keyed on `type`; each case below
  // narrows `target`/`value` to their real shapes — no unchecked casts (F-026).
  switch (condition.type) {
    case 'hasClue': {
      const clue = state.clues[condition.target];
      return clue !== undefined && clue.isRevealed;
    }

    case 'hasDeduction': {
      return state.deductions[condition.target] !== undefined;
    }

    case 'hasFlag': {
      // Compare on truthiness, not identity: an unset flag is `undefined`, so
      // `{value:false}` (the "flag not yet set" gate used by breakdown/
      // incapacitation variants) must match undefined/false alike.
      const flagValue = state.flags[condition.target];
      if (condition.value === undefined) return flagValue === true;
      return Boolean(flagValue) === condition.value;
    }

    case 'facultyMin': {
      const score = state.investigator.faculties[condition.target];
      if (score === undefined) return false;
      return score >= condition.value;
    }

    case 'archetypeIs': {
      return state.investigator.archetype === condition.value;
    }

    case 'npcDisposition': {
      const npc = state.npcs[condition.target];
      if (!npc) return false;
      return npc.disposition >= condition.value;
    }

    case 'npcSuspicion': {
      // Maps suspicion tier names to numeric ranges
      const npc = state.npcs[condition.target];
      if (!npc) return false;
      const s = npc.suspicion;
      switch (condition.value) {
        case 'normal':     return s >= 0 && s <= 2;
        case 'evasive':    return s >= 3 && s <= 5;
        case 'concealing': return s >= 6 && s <= 8;
        case 'hostile':    return s >= 9 && s <= 10;
        default:           return false;
      }
    }

    case 'factionReputation': {
      const rep = state.factionReputation[condition.target] ?? 0;
      return rep >= condition.value;
    }

    case 'npcMemoryFlag': {
      const mnpc = state.npcs[condition.target];
      if (!mnpc) return false;
      return !!mnpc.memoryFlags[condition.value];
    }

    // Intentional defensive default: an unknown/unrecognised condition type fails
    // closed (returns false) rather than throwing. No assertNever here — that would
    // turn defensive-false into a hard throw on unexpected content.
    default:
      return false;
  }
}

// ─── Scene Resolution ─────────────────────────────────────────────────────────

/**
 * Returns the variant scene if its condition is met, otherwise the base scene.
 */
export function resolveScene(
  sceneId: string,
  state: GameState,
  caseData: CaseData,
): SceneNode {
  const baseScene = caseData.scenes[sceneId];
  if (!baseScene) {
    throw new Error(`[NarrativeEngine] Scene "${sceneId}" not found in case data`);
  }

  // Find a variant that targets this scene and whose condition is met
  const variant = caseData.variants.find(
    (v) =>
      v.variantOf === sceneId &&
      v.variantCondition !== undefined &&
      evaluateConditions([v.variantCondition], state),
  );

  return variant ?? baseScene;
}



// ─── Clue Discovery Gating ────────────────────────────────────────────────────

/**
 * Returns true if the given ClueDiscovery's gate requirements are satisfied
 * by the current game state.
 *
 * Gates checked:
 *   - requiresFaculty: investigator's faculty score must meet the minimum
 *   - requiresDeduction: the specified deduction ID must exist in the store
 *
 * This is a pure function — no side effects.
 */
export function canDiscoverClue(
  discovery: ClueDiscovery,
  state: GameState,
): boolean {
  if (discovery.requiresFaculty) {
    const { faculty, minimum } = discovery.requiresFaculty;
    const score = state.investigator.faculties[faculty];
    if (score === undefined || score < minimum) return false;
  }

  if (discovery.requiresDeduction) {
    if (!state.deductions[discovery.requiresDeduction]) return false;
  }

  return true;
}
