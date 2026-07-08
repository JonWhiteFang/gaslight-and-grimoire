/**
 * Narrative Engine
 *
 * Handles JSON content loading, condition evaluation, scene resolution,
 * onEnter effect application, and choice processing.
 */

import type {
  CaseData,
  CaseManifest,
  CaseMeta,
  Choice,
  ChoiceResult,
  Clue,
  ClueDiscovery,
  Condition,
  EncounterRound,
  EncounterState,
  GameState,
  KeyDeduction,
  NPCState,
  NpcSuspicionTier,
  SceneNode,
  ValidationResult,
  VignetteData,
  VignetteMeta,
} from '../types';
import type { EngineActions } from './engineActions';
import { performCheck, rollD20, resolveDC } from './diceEngine';
import { validateBundle } from './contentValidation';
import { FLAGS, abilityAutoSucceedFlag } from './flags';

// ─── Content Loading ──────────────────────────────────────────────────────────

/**
 * Fetches the content manifest listing all available cases and vignettes.
 */
export async function fetchManifest(): Promise<CaseManifest> {
  return fetchJson<CaseManifest>('/content/manifest.json');
}


/** Loads shared scenes (breakdown, incapacitation) and injects them into a scenes record. */
async function injectSharedScenes(scenes: Record<string, SceneNode>): Promise<Record<string, SceneNode>> {
  const [breakdown, incapacitation] = await Promise.all([
    fetchJson<SceneNode>("/content/shared/breakdown.json"),
    fetchJson<SceneNode>("/content/shared/incapacitation.json"),
  ]);
  return { ...scenes, [breakdown.id]: breakdown, [incapacitation.id]: incapacitation };
}

/**
 * Loads all JSON files for a case and assembles a CaseData object.
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

  // deductions.json is optional — a case without key deductions simply has none.
  const recipes = await fetchJson<{ deductions: KeyDeduction[] }>(`${base}/deductions.json`)
    .then((f) => f.deductions)
    .catch(() => [] as KeyDeduction[]);

  const allScenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  const scenes = await injectSharedScenes(indexById(allScenes));
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs, variants: variantsFile.variants, recipes };
}

/**
 * Loads all JSON files for a vignette and assembles a VignetteData object.
 */
export async function loadVignette(vignetteId: string): Promise<VignetteData> {
  const base = `/content/side-cases/${vignetteId}`;

  const [meta, scenesFile, cluesFile, npcsFile] = await Promise.all([
    fetchJson<VignetteMeta>(`${base}/meta.json`),
    fetchJson<{ scenes: SceneNode[] }>(`${base}/scenes.json`),
    fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
    fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
  ]);

  const scenes = await injectSharedScenes(indexById(scenesFile.scenes));
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs };
}

// ─── Content Validation ───────────────────────────────────────────────────────

/**
 * Validates a loaded CaseData for broken scene-graph edges, missing clue/npc
 * references, condition targets, variant structure, encounter edges, and clue
 * sceneSource. Delegates to the shared {@link validateBundle} (errors only —
 * reachability is a CLI-only concern). Logs descriptive errors on failure.
 */
export function validateContent(caseData: CaseData): ValidationResult {
  const { errors } = validateBundle({
    scenes: Object.values(caseData.scenes),
    variants: caseData.variants,
    clues: Object.values(caseData.clues),
    npcs: Object.values(caseData.npcs),
    // Key-deduction recipes form the requiresDeduction/hasDeduction registry — must
    // be passed or every such reference reads as "unknown" and load-validation throws.
    recipes: caseData.recipes,
    // breakdown/incapacitation are injected into caseData.scenes as base scenes,
    // but declare them shared too so variantOf targets resolve if injection changes.
    sharedSceneIds: ['breakdown', 'incapacitation'],
  });

  for (const msg of errors) {
    console.error(`[NarrativeEngine] ${msg}`);
  }

  return { valid: errors.length === 0, errors };
}

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
      // Compare on truthiness, not identity: an unset flag is `undefined`, so
      // `{value:false}` (the "flag not yet set" gate used by breakdown/
      // incapacitation variants) must match undefined/false alike.
      const flagValue = state.flags[target];
      if (value === undefined) return flagValue === true;
      return Boolean(flagValue) === value;
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
      // Maps suspicion tier names to numeric ranges
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

    case 'npcMemoryFlag': {
      const mnpc = state.npcs[target];
      if (!mnpc) return false;
      return !!mnpc.memoryFlags[value as string];
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
    const clueAdvantage =
      choice.advantageIf?.some((clueId) => state.clues[clueId]?.isRevealed) ?? false;
    const veilSightAdvantage =
      choice.faculty === 'lore' && !!state.flags[FLAGS.veilSight];
    const hasAdvantage = clueAdvantage || veilSightAdvantage;
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
  let processedRounds = rounds.map((r) => ({ ...r, choices: [...r.choices] }));

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

  // Determine Advantage: granted by Occult Fragment clues
  const hasOccultAdvantage =
    choice.advantageIf?.some((clueId) => {
      const clue = state.clues[clueId];
      return clue?.isRevealed && clue.type === 'occult';
    }) ?? false;

  // Also check standard advantage from any revealed clue
  const hasStandardAdvantage =
    choice.advantageIf?.some((clueId) => state.clues[clueId]?.isRevealed) ?? false;

  const veilSightAdvantage =
    choice.faculty === 'lore' && !!state.flags[FLAGS.veilSight];
  const hasAdvantage = hasOccultAdvantage || hasStandardAdvantage || veilSightAdvantage;

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
    const fallbackScene = choice.outcomes['success'] ?? choice.outcomes['critical'];
    if (!fallbackScene) {
      // A non-check encounter choice must always name a destination. Without this
      // guard, navigation to `undefined` yields a blank scene (resolveScene throws,
      // useCurrentScene swallows it). Fail loudly at the source instead (F-022).
      throw new Error(
        `[NarrativeEngine] Encounter choice "${choice.id}" has no dice check and no "success"/"critical" outcome — nowhere to navigate.`,
      );
    }
    nextSceneId = fallbackScene;
    tier = 'success';
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
 * - Filters choices using `evaluateConditions`
 * - Always includes escape path choices when their flag condition is met
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

    // Escape paths are always included when their flag condition is met.
    if (choice.isEscapePath) {
      if (conditionsMet) filtered.push(choice);
      continue;
    }

    if (!conditionsMet) continue;
    filtered.push(choice);
  }

  return filtered;
}
