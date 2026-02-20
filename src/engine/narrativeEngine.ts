/**
 * Narrative Engine
 *
 * Handles JSON content loading, condition evaluation, scene resolution,
 * onEnter effect application, and choice processing.
 *
 * Requirements: 2.1, 2.5, 2.6, 2.7, 2.8, 2.9, 8.1–8.9, 10.7, 17.1–17.5
 */

import type {
  CaseData,
  CaseMeta,
  Choice,
  ChoiceResult,
  Clue,
  ClueDiscovery,
  Condition,
  Effect,
  EncounterRound,
  EncounterState,
  Faculty,
  GameState,
  NPCState,
  NpcSuspicionTier,
  SceneNode,
  ValidationResult,
  VignetteData,
  VignetteMeta,
} from '../types';
import { useStore } from '../store';
import { performCheck, rollD20, resolveDC } from './diceEngine';

// ─── Content Loading ──────────────────────────────────────────────────────────

/**
 * Loads all JSON files for a case and assembles a CaseData object.
 * Req 17.1
 */
export async function loadCase(caseId: string): Promise<CaseData> {
  const base = `/content/cases/${caseId}`;

  const [meta, act1, act2, act3, cluesFile, npcsFile, variantsFile] =
    await Promise.all([
      fetchJson<CaseMeta>(`${base}/meta.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act1.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act2.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act3.json`),
      fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
      fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
      fetchJson<{ variants: SceneNode[] }>(`${base}/variants.json`),
    ]);

  const allScenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  const scenes = indexById(allScenes);
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs, variants: variantsFile.variants };
}

/**
 * Loads all JSON files for a vignette and assembles a VignetteData object.
 * Req 17.2
 */
export async function loadVignette(vignetteId: string): Promise<VignetteData> {
  const base = `/content/side-cases/${vignetteId}`;

  const [meta, scenesFile, cluesFile, npcsFile] = await Promise.all([
    fetchJson<VignetteMeta>(`${base}/meta.json`),
    fetchJson<{ scenes: SceneNode[] }>(`${base}/scenes.json`),
    fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
    fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
  ]);

  const scenes = indexById(scenesFile.scenes);
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs };
}

// ─── Content Validation ───────────────────────────────────────────────────────

/**
 * Validates a loaded CaseData for broken scene-graph edges and missing clue
 * references. Logs descriptive errors on failure.
 * Req 17.3, 17.4, 17.5
 */
export function validateContent(caseData: CaseData): ValidationResult {
  const errors: string[] = [];
  const sceneIds = new Set(Object.keys(caseData.scenes));
  const clueIds = new Set(Object.keys(caseData.clues));

  // Also include variant scene IDs as valid targets
  for (const variant of caseData.variants) {
    sceneIds.add(variant.id);
  }

  for (const scene of Object.values(caseData.scenes)) {
    // Check choice outcome scene references
    for (const choice of scene.choices) {
      for (const [tier, targetId] of Object.entries(choice.outcomes)) {
        if (targetId && !sceneIds.has(targetId)) {
          const msg = `Scene "${scene.id}" → choice "${choice.id}" → outcome "${tier}" references unknown scene "${targetId}"`;
          errors.push(msg);
          console.error(`[NarrativeEngine] ${msg}`);
        }
      }

      // Check requiresClue references
      if (choice.requiresClue && !clueIds.has(choice.requiresClue)) {
        const msg = `Scene "${scene.id}" → choice "${choice.id}" → requiresClue references unknown clue "${choice.requiresClue}"`;
        errors.push(msg);
        console.error(`[NarrativeEngine] ${msg}`);
      }

      // Check advantageIf clue references
      if (choice.advantageIf) {
        for (const clueId of choice.advantageIf) {
          if (!clueIds.has(clueId)) {
            const msg = `Scene "${scene.id}" → choice "${choice.id}" → advantageIf references unknown clue "${clueId}"`;
            errors.push(msg);
            console.error(`[NarrativeEngine] ${msg}`);
          }
        }
      }

      // Check outcome tier completeness for faculty-check choices
      if (choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty)) {
        for (const tier of ['critical', 'success', 'partial', 'failure', 'fumble'] as const) {
          if (!choice.outcomes[tier]) {
            const msg = `Scene "${scene.id}" → choice "${choice.id}" → missing outcome tier "${tier}"`;
            errors.push(msg);
            console.error(`[NarrativeEngine] ${msg}`);
          }
        }
      }
    }

    // Check cluesAvailable references
    for (const discovery of scene.cluesAvailable) {
      if (!clueIds.has(discovery.clueId)) {
        const msg = `Scene "${scene.id}" → cluesAvailable references unknown clue "${discovery.clueId}"`;
        errors.push(msg);
        console.error(`[NarrativeEngine] ${msg}`);
      }
    }
  }

  // Also validate variant scenes
  for (const variant of caseData.variants) {
    for (const choice of variant.choices) {
      for (const [tier, targetId] of Object.entries(choice.outcomes)) {
        if (targetId && !sceneIds.has(targetId)) {
          const msg = `Variant "${variant.id}" → choice "${choice.id}" → outcome "${tier}" references unknown scene "${targetId}"`;
          errors.push(msg);
          console.error(`[NarrativeEngine] ${msg}`);
        }
      }
    }
    for (const discovery of variant.cluesAvailable) {
      if (!clueIds.has(discovery.clueId)) {
        const msg = `Variant "${variant.id}" → cluesAvailable references unknown clue "${discovery.clueId}"`;
        errors.push(msg);
        console.error(`[NarrativeEngine] ${msg}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates an array of conditions against the current game state.
 * All conditions must be satisfied (AND logic).
 * This is a pure function — no side effects, no store access.
 * Req 2.5, 2.9
 */
export function evaluateConditions(
  conditions: Condition[],
  state: GameState,
): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((condition) => evaluateCondition(condition, state));
}

function evaluateCondition(condition: Condition, state: GameState): boolean {
  const { type, target, value } = condition;

  switch (type) {
    case 'hasClue': {
      const clue = state.clues[target];
      return clue !== undefined && clue.isRevealed;
    }

    case 'hasDeduction': {
      return state.deductions[target] !== undefined;
    }

    case 'hasFlag': {
      const flagValue = state.flags[target];
      if (value === undefined) return flagValue === true;
      return flagValue === value;
    }

    case 'facultyMin': {
      const score = state.investigator.faculties[target as keyof typeof state.investigator.faculties];
      if (score === undefined) return false;
      return score >= (value as number);
    }

    case 'archetypeIs': {
      return state.investigator.archetype === value;
    }

    case 'npcDisposition': {
      const npc = state.npcs[target];
      if (!npc) return false;
      return npc.disposition >= (value as number);
    }

    case 'npcSuspicion': {
      // Maps suspicion tier names to numeric ranges (Req 8.3–8.6)
      const npc = state.npcs[target];
      if (!npc) return false;
      const tier = value as NpcSuspicionTier;
      const s = npc.suspicion;
      switch (tier) {
        case 'normal':     return s >= 0 && s <= 2;
        case 'evasive':    return s >= 3 && s <= 5;
        case 'concealing': return s >= 6 && s <= 8;
        case 'hostile':    return s >= 9 && s <= 10;
        default:           return false;
      }
    }

    case 'factionReputation': {
      const rep = state.factionReputation[target] ?? 0;
      return rep >= (value as number);
    }

    default:
      return false;
  }
}

// ─── Scene Resolution ─────────────────────────────────────────────────────────

/**
 * Returns the variant scene if its condition is met, otherwise the base scene.
 * Req 2.6, 10.7
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

// ─── onEnter Effect Application ───────────────────────────────────────────────

/**
 * Applies onEnter effects from a scene to the Zustand store.
 * Exported separately so it can be called from the narrative slice or a component.
 * Req 2.7
 */
export function applyOnEnterEffects(effects: Effect[]): void {
  if (!effects || effects.length === 0) return;

  const store = useStore.getState();

  for (const effect of effects) {
    switch (effect.type) {
      case 'composure':
        if (effect.delta !== undefined) {
          store.adjustComposure(effect.delta);
        }
        break;

      case 'vitality':
        if (effect.delta !== undefined) {
          store.adjustVitality(effect.delta);
        }
        break;

      case 'flag':
        if (effect.target !== undefined) {
          store.setFlag(effect.target, effect.value as boolean ?? true);
        }
        break;

      case 'disposition':
        if (effect.target !== undefined && effect.delta !== undefined) {
          store.adjustDisposition(effect.target, effect.delta);
        }
        break;

      case 'suspicion':
        if (effect.target !== undefined && effect.delta !== undefined) {
          store.adjustSuspicion(effect.target, effect.delta);
        }
        break;

      case 'reputation':
        if (effect.target !== undefined && effect.delta !== undefined) {
          store.adjustReputation(effect.target, effect.delta);
        }
        break;

      case 'discoverClue':
        if (effect.target !== undefined) {
          store.discoverClue(effect.target);
        }
        break;
    }
  }
}

// ─── Clue Discovery Gating ────────────────────────────────────────────────────

/**
 * Returns true if the given ClueDiscovery's gate requirements are satisfied
 * by the current game state.
 *
 * Gates checked (Req 6.2):
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

// ─── Ability Auto-Succeed Flags ───────────────────────────────────────────────

const ABILITY_AUTO_SUCCEED_FLAGS: Partial<Record<Faculty, string>> = {
  reason: 'ability-auto-succeed-reason',
  vigor: 'ability-auto-succeed-vigor',
  influence: 'ability-auto-succeed-influence',
};

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
    const abilityFlag = ABILITY_AUTO_SUCCEED_FLAGS[choice.faculty];
    if (abilityFlag && state.flags[abilityFlag]) {
      return { nextSceneId: choice.outcomes['critical'], tier: 'critical' };
    }

    const dc = resolveDC(choice, state.investigator);
    const hasAdvantage =
      choice.advantageIf?.some((clueId) => state.clues[clueId]?.isRevealed) ?? false;
    const result = performCheck(choice.faculty, state.investigator, dc, hasAdvantage, false);
    return {
      nextSceneId: choice.outcomes[result.tier],
      roll: result.roll,
      modifier: result.modifier,
      total: result.total,
      tier: result.tier,
    };
  }

  return {
    nextSceneId: choice.outcomes['success'] ?? choice.outcomes['critical'],
    tier: 'success',
  };
}

/**
 * Processes a player choice: computes the outcome, applies npcEffect,
 * and navigates to the next scene.
 * Req 8.2
 */
export function processChoice(
  choice: Choice,
  state: GameState,
): ChoiceResult {
  const store = useStore.getState();
  const result = computeChoiceResult(choice, state);

  if (choice.npcEffect) {
    const { npcId, dispositionDelta, suspicionDelta } = choice.npcEffect;
    store.adjustDisposition(npcId, dispositionDelta);
    store.adjustSuspicion(npcId, suspicionDelta);
  }

  store.goToScene(result.nextSceneId);
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? '/';
  const fullUrl = `${base.replace(/\/$/, '')}${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`[NarrativeEngine] Failed to fetch "${fullUrl}": ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  for (const item of items) {
    map[item.id] = item;
  }
  return map;
}

// ─── Encounter System ─────────────────────────────────────────────────────────

/**
 * Starts an encounter, performing a Reaction_Check for supernatural encounters.
 *
 * For supernatural encounters (Req 9.3, 9.4):
 *   - Performs a Nerve or Lore check at DC 12
 *   - On failure: reduces Composure by 1–2 and replaces the first choice in
 *     round 1 with its `worseAlternative` (if provided)
 *
 * Returns an EncounterState ready for the first round.
 * Req 9.1, 9.3, 9.4
 */
export function startEncounter(
  encounterId: string,
  rounds: EncounterRound[],
  isSupernatural: boolean,
  state: GameState,
): EncounterState {

  let reactionCheckPassed: boolean | null = null;
  let processedRounds = rounds.map((r) => ({ ...r, choices: [...r.choices] }));

  if (isSupernatural && rounds.length > 0) {
    // Use the higher of Nerve or Lore, with Nerve as tiebreaker (Req 9.3)
    const reactionFaculty =
      state.investigator.faculties['nerve'] >= state.investigator.faculties['lore']
        ? 'nerve' as const
        : 'lore' as const;

    const result = performCheck(reactionFaculty, state.investigator, 12, false, false);
    reactionCheckPassed = result.tier === 'success' || result.tier === 'critical';

    if (!reactionCheckPassed) {
      // Reduce Composure by 1 or 2 (Req 9.4)
      const composureDamage = (rollD20() % 2) + 1; // 1 or 2
      const store = useStore.getState();
      store.adjustComposure(-composureDamage);

      // Replace first choice in round 1 with worseAlternative if available (Req 9.4)
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
 * - For supernatural encounters: applies dual-axis damage (Composure + Vitality) on failure (Req 9.5)
 * - For mundane encounters: applies only the relevant damage type
 * - Advances currentRound; sets isComplete when all rounds are done
 * - Grants Advantage when the investigator holds a relevant Occult Fragment clue (Req 9.6)
 *
 * Returns updated EncounterState and ChoiceResult.
 * Req 9.1, 9.2, 9.5, 9.6
 */
export function processEncounterChoice(
  choice: Choice,
  encounterState: EncounterState,
  state: GameState,
): { encounterState: EncounterState; result: ChoiceResult } {
  const store = useStore.getState();

  const currentRound = encounterState.rounds[encounterState.currentRound];
  const isSupernatural = currentRound?.isSupernatural ?? false;

  // Determine Advantage: granted by Occult Fragment clues (Req 9.6)
  const hasOccultAdvantage =
    choice.advantageIf?.some((clueId) => {
      const clue = state.clues[clueId];
      return clue?.isRevealed && clue.type === 'occult';
    }) ?? false;

  // Also check standard advantage from any revealed clue
  const hasStandardAdvantage =
    choice.advantageIf?.some((clueId) => state.clues[clueId]?.isRevealed) ?? false;

  const hasAdvantage = hasOccultAdvantage || hasStandardAdvantage;

  let nextSceneId: string;
  let roll: number | undefined;
  let modifier: number | undefined;
  let total: number | undefined;
  let tier: ChoiceResult['tier'];

  if (choice.faculty && choice.difficulty !== undefined) {
    const result = performCheck(
      choice.faculty,
      state.investigator,
      choice.difficulty,
      hasAdvantage,
      false,
    );
    roll = result.roll;
    modifier = result.modifier;
    total = result.total;
    tier = result.tier;
    nextSceneId = choice.outcomes[result.tier];
  } else {
    nextSceneId = choice.outcomes['success'] ?? choice.outcomes['critical'];
    tier = 'success';
  }

  // Apply damage effects (Req 9.2, 9.5)
  const isFailure = tier === 'failure' || tier === 'fumble';
  if (isFailure && choice.encounterDamage) {
    const { composureDelta, vitalityDelta } = choice.encounterDamage;

    if (isSupernatural) {
      // Dual-axis: apply both Composure and Vitality damage (Req 9.5)
      if (composureDelta !== undefined) store.adjustComposure(composureDelta);
      if (vitalityDelta !== undefined) store.adjustVitality(vitalityDelta);
    } else {
      // Mundane: apply only the relevant damage type
      if (composureDelta !== undefined) store.adjustComposure(composureDelta);
      else if (vitalityDelta !== undefined) store.adjustVitality(vitalityDelta);
    }
  }

  // Apply NPC effects if present
  if (choice.npcEffect) {
    const { npcId, dispositionDelta, suspicionDelta } = choice.npcEffect;
    store.adjustDisposition(npcId, dispositionDelta);
    store.adjustSuspicion(npcId, suspicionDelta);
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
    store.goToScene(nextSceneId);
  }

  return {
    encounterState: updatedEncounterState,
    result: { nextSceneId, roll, modifier, total, tier },
  };
}

/**
 * Returns the filtered choices for a given encounter round.
 *
 * - Filters choices using `evaluateConditions`
 * - Grants Advantage on choices where the investigator holds a relevant Occult Fragment clue (Req 9.6)
 * - Always includes escape path choices when their flag condition is met (Req 9.7)
 *
 * Returns an array of choices with an `_hasAdvantage` annotation (via a wrapper type).
 * Req 9.6, 9.7
 */
export function getEncounterChoices(
  round: EncounterRound,
  state: GameState,
): Array<Choice & { _hasAdvantage?: boolean }> {
  const filtered: Array<Choice & { _hasAdvantage?: boolean }> = [];

  for (const choice of round.choices) {
    // Evaluate standard conditions
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

    const conditionsMet = evaluateConditions(conditions, state);

    // Escape paths are always included when their flag condition is met (Req 9.7)
    if (choice.isEscapePath) {
      if (conditionsMet) {
        filtered.push({ ...choice, _hasAdvantage: false });
      }
      continue;
    }

    if (!conditionsMet) continue;

    // Check for Occult Fragment advantage (Req 9.6)
    const hasOccultAdvantage =
      choice.advantageIf?.some((clueId) => {
        const clue = state.clues[clueId];
        return clue?.isRevealed && clue.type === 'occult';
      }) ?? false;

    filtered.push({ ...choice, _hasAdvantage: hasOccultAdvantage });
  }

  return filtered;
}
