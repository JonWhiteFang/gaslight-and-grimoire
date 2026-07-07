/**
 * Shared content validator — the single source of truth for "valid content".
 *
 * Consumed by:
 *   - the runtime `validateContent` (src/engine/narrativeEngine.ts), errors only
 *   - the build-time CLI (scripts/validateCase.ts via vite-node), errors + warnings
 *
 * Operates on a plain in-memory `ContentBundle` (arrays of scenes/variants/clues/
 * npcs), so it is independent of how content is loaded (fetch vs. filesystem).
 *
 * Pure: no I/O, no store access, no globals.
 */

import type {
  Archetype,
  Choice,
  Clue,
  Condition,
  Effect,
  Faculty,
  NPCState,
  NpcSuspicionTier,
  SceneNode,
} from '../types';

// ─── Bundle shape ──────────────────────────────────────────────────────────

export interface ContentBundle {
  /** Base (non-variant) scenes. */
  scenes: SceneNode[];
  /** Variant scenes (resolve at runtime over a base scene; not graph nodes). */
  variants: SceneNode[];
  clues: Clue[];
  npcs: NPCState[];
  /** Entry scene id for reachability analysis. */
  firstScene?: string;
  /**
   * Scene ids injected at runtime but not authored in this bundle's files
   * (breakdown / incapacitation). Treated as valid edge/variantOf targets and
   * excluded from unreachable-scene warnings.
   */
  sharedSceneIds?: string[];
}

export interface BundleValidationResult {
  errors: string[];
  warnings: string[];
}

export interface ValidateOptions {
  /** Emit reachability/undiscoverable warnings (build-time only). */
  includeReachability?: boolean;
}

// ─── Allowlists ──────────────────────────────────────────────────────────────

const FACULTIES: ReadonlySet<Faculty> = new Set<Faculty>([
  'reason', 'perception', 'nerve', 'vigor', 'influence', 'lore',
]);

const ARCHETYPES: ReadonlySet<Archetype> = new Set<Archetype>([
  'deductionist', 'occultist', 'operator', 'mesmerist',
]);

const SUSPICION_TIERS: ReadonlySet<NpcSuspicionTier> = new Set<NpcSuspicionTier>([
  'normal', 'evasive', 'concealing', 'hostile',
]);

const FACTIONS: ReadonlySet<string> = new Set<string>([
  'Rationalists Circle',
  'Hermetic Order of the Grey Dawn',
  'Lamplighters',
  'Court of Smoke',
]);

const OUTCOME_TIERS = ['critical', 'success', 'partial', 'failure', 'fumble'] as const;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Validates a content bundle. Structural defects are `errors`; reachability
 * observations (opt-in) are `warnings`.
 */
export function validateBundle(
  bundle: ContentBundle,
  options: ValidateOptions = {},
): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const shared = new Set(bundle.sharedSceneIds ?? []);
  const baseSceneIds = new Set(bundle.scenes.map((s) => s.id));
  const variantIds = new Set(bundle.variants.map((v) => v.id));
  // Valid targets for choice/encounter edges: base + variants + shared.
  const edgeTargetIds = new Set<string>([...baseSceneIds, ...variantIds, ...shared]);
  // Valid targets for variantOf and clue.sceneSource: base + shared (a variant
  // is a variant *of* a base/shared scene, never of another variant).
  const baseOrSharedIds = new Set<string>([...baseSceneIds, ...shared]);

  const clueIds = new Set(bundle.clues.map((c) => c.id));
  const npcIds = new Set(bundle.npcs.map((n) => n.id));

  const ctx: Ctx = { edgeTargetIds, clueIds, npcIds, errors };

  // Scenes + their conditions/onEnter/choices/encounters.
  for (const scene of bundle.scenes) {
    validateScene(scene, ctx);
  }

  // Variants: same content checks, plus structural variantOf/variantCondition.
  for (const variant of bundle.variants) {
    validateScene(variant, ctx);

    if (variant.variantOf === undefined) {
      errors.push(`Variant "${variant.id}" is missing "variantOf"`);
    } else if (!baseOrSharedIds.has(variant.variantOf)) {
      errors.push(`Variant "${variant.id}" -> variantOf references unknown base scene "${variant.variantOf}"`);
    }
    if (variant.variantCondition === undefined) {
      errors.push(`Variant "${variant.id}" is missing "variantCondition" (can never resolve)`);
    } else {
      validateCondition(variant.variantCondition, `Variant "${variant.id}" -> variantCondition`, ctx);
    }
  }

  // Clue sceneSource must point at a real scene (F-023).
  for (const clue of bundle.clues) {
    if (clue.sceneSource && !baseOrSharedIds.has(clue.sceneSource) && !variantIds.has(clue.sceneSource)) {
      errors.push(`Clue "${clue.id}" -> sceneSource references unknown scene "${clue.sceneSource}"`);
    }
  }

  // ── Reachability (warnings, opt-in) ──
  if (options.includeReachability) {
    const reachable = computeReachableScenes(bundle);
    for (const scene of bundle.scenes) {
      if (!reachable.has(scene.id) && !shared.has(scene.id)) {
        warnings.push(`scene "${scene.id}" is unreachable from firstScene`);
      }
    }
    const discoverable = computeDiscoverableClues(bundle, reachable);
    for (const clue of bundle.clues) {
      if (!discoverable.has(clue.id)) {
        warnings.push(`clue "${clue.id}" is never discoverable (no reachable scene lists it in cluesAvailable)`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * BFS from `firstScene` over every choice-outcome edge (all tiers), recursing
 * into encounter-round choices. Returns the set of reachable base-scene ids.
 * Variants are not graph nodes (they resolve at runtime over their base scene).
 */
export function computeReachableScenes(bundle: ContentBundle): Set<string> {
  const byId = new Map(bundle.scenes.map((s) => [s.id, s]));
  const reachable = new Set<string>();
  const { firstScene } = bundle;
  if (!firstScene || !byId.has(firstScene)) return reachable;

  const queue: string[] = [firstScene];
  reachable.add(firstScene);
  while (queue.length > 0) {
    const scene = byId.get(queue.shift()!);
    if (!scene) continue;
    for (const target of outgoingEdges(scene)) {
      if (byId.has(target) && !reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  return reachable;
}

/**
 * Maximum disposition attainable for `npcId` within this bundle: the npc's
 * starting disposition plus every positive disposition delta reachable from
 * `firstScene` (onEnter effects + choice npcEffects on reachable scenes).
 * Used to check whether a disposition-gated vignette threshold is attainable.
 */
export function computeMaxDisposition(bundle: ContentBundle, npcId: string): number {
  const start = bundle.npcs.find((n) => n.id === npcId)?.disposition ?? 0;
  const reachable = computeReachableScenes(bundle);
  let gains = 0;

  const scan = (scene: SceneNode) => {
    for (const effect of scene.onEnter ?? []) {
      if (effect.type === 'disposition' && effect.target === npcId && (effect.delta ?? 0) > 0) {
        gains += effect.delta!;
      }
    }
    for (const choice of allChoices(scene)) {
      const eff = choice.npcEffect;
      if (eff && eff.npcId === npcId && eff.dispositionDelta > 0) {
        gains += eff.dispositionDelta;
      }
    }
  };

  for (const scene of bundle.scenes) {
    if (reachable.has(scene.id)) scan(scene);
  }
  return start + gains;
}

// ─── Internal: per-scene validation ───────────────────────────────────────────

interface Ctx {
  edgeTargetIds: Set<string>;
  clueIds: Set<string>;
  npcIds: Set<string>;
  errors: string[];
}

function validateScene(scene: SceneNode, ctx: Ctx): void {
  const where = `Scene "${scene.id}"`;

  for (const condition of scene.conditions ?? []) {
    validateCondition(condition, `${where} -> conditions`, ctx);
  }

  for (const choice of scene.choices ?? []) {
    validateChoice(choice, where, ctx);
  }

  for (const discovery of scene.cluesAvailable ?? []) {
    if (!ctx.clueIds.has(discovery.clueId)) {
      ctx.errors.push(`${where} -> cluesAvailable references unknown clue "${discovery.clueId}"`);
    }
  }

  for (const effect of scene.onEnter ?? []) {
    validateEffect(effect, where, ctx);
  }

  if (scene.encounter) {
    for (const round of scene.encounter.rounds ?? []) {
      for (const choice of round.choices ?? []) {
        validateChoice(choice, `${where} -> encounter round ${round.roundNumber}`, ctx);
      }
    }
  }
}

function validateChoice(choice: Choice, where: string, ctx: Ctx): void {
  const at = `${where} -> choice "${choice.id}"`;

  for (const [tier, targetId] of Object.entries(choice.outcomes ?? {})) {
    if (targetId && !ctx.edgeTargetIds.has(targetId)) {
      ctx.errors.push(`${at} -> outcome "${tier}" references unknown scene "${targetId}"`);
    }
  }

  if (choice.requiresClue && !ctx.clueIds.has(choice.requiresClue)) {
    ctx.errors.push(`${at} -> requiresClue references unknown clue "${choice.requiresClue}"`);
  }

  if (choice.advantageIf) {
    for (const clueId of choice.advantageIf) {
      if (!ctx.clueIds.has(clueId)) {
        ctx.errors.push(`${at} -> advantageIf references unknown clue "${clueId}"`);
      }
    }
  }

  if (choice.requiresFaculty && !FACULTIES.has(choice.requiresFaculty.faculty)) {
    ctx.errors.push(`${at} -> requiresFaculty references invalid faculty "${choice.requiresFaculty.faculty}"`);
  }

  const isCheck = !!choice.faculty && (choice.difficulty !== undefined || !!choice.dynamicDifficulty);

  // Tier completeness for faculty checks (fixed OR dynamic difficulty).
  if (isCheck) {
    for (const tier of OUTCOME_TIERS) {
      if (!choice.outcomes?.[tier]) {
        ctx.errors.push(`${at} -> missing outcome tier "${tier}"`);
      }
    }
  } else if (!choice.outcomes?.success && !choice.outcomes?.critical) {
    // A non-check choice resolves via success ?? critical. Without one of them
    // it navigates to `undefined` (blank scene) at runtime — reject it (F-022).
    ctx.errors.push(`${at} -> non-check choice has no "success" or "critical" outcome (nowhere to navigate)`);
  }

  if (choice.npcEffect && !ctx.npcIds.has(choice.npcEffect.npcId)) {
    ctx.errors.push(`${at} -> npcEffect references unknown npc "${choice.npcEffect.npcId}"`);
  }

  // Recurse into the Reaction_Check replacement choice, if any.
  if (choice.worseAlternative) {
    validateChoice(choice.worseAlternative, `${at} (worseAlternative)`, ctx);
  }
}

function validateEffect(effect: Effect, where: string, ctx: Ctx): void {
  if (effect.type === 'discoverClue' && effect.target && !ctx.clueIds.has(effect.target)) {
    ctx.errors.push(`${where} -> onEnter discoverClue references unknown clue "${effect.target}"`);
  }
  if (
    (effect.type === 'disposition' || effect.type === 'suspicion' || effect.type === 'setMemoryFlag') &&
    effect.target &&
    !ctx.npcIds.has(effect.target)
  ) {
    ctx.errors.push(`${where} -> onEnter ${effect.type} references unknown npc "${effect.target}"`);
  }
}

function validateCondition(condition: Condition, where: string, ctx: Ctx): void {
  const { type, target, value } = condition;
  switch (type) {
    case 'hasClue':
      if (!ctx.clueIds.has(target)) {
        ctx.errors.push(`${where} -> hasClue references unknown clue "${target}"`);
      }
      break;
    case 'npcDisposition':
    case 'npcMemoryFlag':
      if (!ctx.npcIds.has(target)) {
        ctx.errors.push(`${where} -> ${type} references unknown npc "${target}"`);
      }
      break;
    case 'npcSuspicion':
      if (!ctx.npcIds.has(target)) {
        ctx.errors.push(`${where} -> npcSuspicion references unknown npc "${target}"`);
      }
      if (!SUSPICION_TIERS.has(value as NpcSuspicionTier)) {
        ctx.errors.push(`${where} -> npcSuspicion has invalid tier value "${String(value)}"`);
      }
      break;
    case 'facultyMin':
      if (!FACULTIES.has(target as Faculty)) {
        ctx.errors.push(`${where} -> facultyMin references invalid faculty "${target}"`);
      }
      break;
    case 'archetypeIs':
      if (!ARCHETYPES.has(value as Archetype)) {
        ctx.errors.push(`${where} -> archetypeIs has invalid archetype value "${String(value)}"`);
      }
      break;
    case 'factionReputation':
      if (!FACTIONS.has(target)) {
        ctx.errors.push(`${where} -> factionReputation references unknown faction "${target}"`);
      }
      break;
    case 'hasFlag':
    case 'hasDeduction':
      // hasFlag targets are free-form and value:false is legitimate ("flag unset").
      // hasDeduction targets are runtime-derived, so there is no authored registry.
      break;
    default:
      break;
  }
}

// ─── Internal: graph helpers ──────────────────────────────────────────────────

/** All choices on a scene, including encounter-round choices. */
function allChoices(scene: SceneNode): Choice[] {
  const choices: Choice[] = [...(scene.choices ?? [])];
  if (scene.encounter) {
    for (const round of scene.encounter.rounds ?? []) {
      choices.push(...(round.choices ?? []));
    }
  }
  return choices;
}

/** All outgoing scene-id edges from a scene (choice + encounter outcome targets). */
function outgoingEdges(scene: SceneNode): string[] {
  const targets: string[] = [];
  for (const choice of allChoices(scene)) {
    for (const target of Object.values(choice.outcomes ?? {})) {
      if (target) targets.push(target);
    }
  }
  return targets;
}

/**
 * Clues discoverable from reachable scenes: any clue listed in a reachable
 * scene's cluesAvailable, or referenced by a reachable choice's requiresClue /
 * advantageIf. Variant cluesAvailable count when the variant's base is reachable.
 */
function computeDiscoverableClues(bundle: ContentBundle, reachable: Set<string>): Set<string> {
  const discoverable = new Set<string>();

  const collect = (scene: SceneNode) => {
    for (const discovery of scene.cluesAvailable ?? []) {
      if (discovery.clueId) discoverable.add(discovery.clueId);
    }
    for (const choice of allChoices(scene)) {
      if (choice.requiresClue) discoverable.add(choice.requiresClue);
      for (const clueId of choice.advantageIf ?? []) discoverable.add(clueId);
    }
  };

  for (const scene of bundle.scenes) {
    if (reachable.has(scene.id)) collect(scene);
  }
  // A variant contributes its clues only when its base scene is reachable.
  for (const variant of bundle.variants) {
    if (variant.variantOf && reachable.has(variant.variantOf)) collect(variant);
  }
  return discoverable;
}
