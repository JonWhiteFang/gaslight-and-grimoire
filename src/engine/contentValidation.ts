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
  KeyDeduction,
  NPCState,
  NpcSuspicionTier,
  SceneNode,
} from '../types';
import { FACTIONS, OUTCOME_TIERS } from './constants';
import { isFacultyCheck } from './diceEngine';

// ─── Bundle shape ──────────────────────────────────────────────────────────

export interface ContentBundle {
  /** Base (non-variant) scenes. */
  scenes: SceneNode[];
  /** Variant scenes (resolve at runtime over a base scene; not graph nodes). */
  variants: SceneNode[];
  clues: Clue[];
  npcs: NPCState[];
  /** Authored key-deduction recipes; their ids form the hasDeduction/requiresDeduction registry. */
  recipes?: KeyDeduction[];
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
  const recipeIds = new Set((bundle.recipes ?? []).map((r) => r.id));

  const ctx: Ctx = { edgeTargetIds, clueIds, npcIds, recipeIds, errors };

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
    // Clue ids must match ^[a-z0-9-]+$ so the generic-deduction id signature
    // (deduction-generic-<ids joined by '+'>) can never collide (Phase 2b, Major 4).
    if (!/^[a-z0-9-]+$/.test(clue.id)) {
      errors.push(`Clue id "${clue.id}" is invalid — must match ^[a-z0-9-]+$`);
    }
  }

  // Key-deduction recipes: every required clue must exist.
  for (const recipe of bundle.recipes ?? []) {
    // A recipe id must not intrude on the machine-owned generic-deduction namespace,
    // or a generic connection could falsely satisfy its hasDeduction gate (Phase 2b, Major 4).
    if (recipe.id.startsWith('deduction-generic-')) {
      errors.push(`KeyDeduction "${recipe.id}" uses the reserved "deduction-generic-" id namespace`);
    }
    for (const clueId of recipe.requiredClues) {
      if (!clueIds.has(clueId)) {
        errors.push(`KeyDeduction "${recipe.id}" -> requiredClues references unknown clue "${clueId}"`);
      }
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

    // F-102: a key deduction that GATES content (via requiresDeduction /
    // hasDeduction) must be formable through skilled play — not only by rolling
    // criticals. For every clue such a recipe requires, at least one discovery
    // source must be reachable without depending on a `critical` outcome edge.
    // Otherwise the gated content (e.g. a case's true ending) is an RNG lottery.
    // This is an error, not a warning: it violates the CLAUDE.md content rule
    // ("no single Faculty / lucky roll should gate critical story progress").
    const gatedRecipeIds = collectGatedDeductionIds(bundle);
    if (gatedRecipeIds.size > 0) {
      // Use OBTAINABLE sources (cluesAvailable + onEnter discoverClue) here, not
      // the looser `discoverable` set — the latter also counts a clue merely
      // *referenced* by a reachable requiresClue/advantageIf, which would mask a
      // clue that is only actually GATHERED on a critical tier (the Mayfair bug).
      const obtainableAll = computeObtainableClues(bundle, reachable);
      const nonCritReachable = computeNonCriticalReachableScenes(bundle);
      const obtainableNonCrit = computeObtainableClues(bundle, nonCritReachable);
      for (const recipe of bundle.recipes ?? []) {
        if (!gatedRecipeIds.has(recipe.id)) continue;
        for (const clueId of recipe.requiredClues) {
          // Only meaningful for clues that exist and are obtainable at all (an
          // unknown clue is already an error above; a wholly-unobtainable clue is
          // already a warning — don't double-report either here).
          if (!clueIds.has(clueId)) continue;
          if (obtainableAll.has(clueId) && !obtainableNonCrit.has(clueId)) {
            errors.push(
              `clue "${clueId}" (required by gated key deduction "${recipe.id}") is only obtainable on a critical roll — the gated content is unreachable through skilled play (F-102)`,
            );
          }
        }
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
 * BFS from `firstScene` like {@link computeReachableScenes}, but a scene is only
 * reached through edges that a player can take WITHOUT rolling a critical: a
 * check choice's `success`/`partial`/`failure`/`fumble` tiers, and every
 * non-check edge. A destination reachable *only* via some choice's `critical`
 * tier is excluded. Used to detect critical-gated content (F-102).
 *
 * Note: a scene reachable both critically and non-critically stays in the set —
 * we drop an edge only when `critical` is its sole route from a given choice.
 */
export function computeNonCriticalReachableScenes(bundle: ContentBundle): Set<string> {
  const byId = new Map(bundle.scenes.map((s) => [s.id, s]));
  const reachable = new Set<string>();
  const { firstScene } = bundle;
  if (!firstScene || !byId.has(firstScene)) return reachable;

  const queue: string[] = [firstScene];
  reachable.add(firstScene);
  while (queue.length > 0) {
    const scene = byId.get(queue.shift()!);
    if (!scene) continue;
    for (const target of nonCriticalOutgoingEdges(scene)) {
      if (byId.has(target) && !reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  return reachable;
}

/**
 * The set of recipe ids that actually GATE content — referenced by any choice's
 * `requiresDeduction`, any scene/variant `hasDeduction` condition, or a
 * `ClueDiscovery.requiresDeduction`. A recipe nobody gates on has no reachability
 * obligation (F-102 only concerns gated content).
 */
function collectGatedDeductionIds(bundle: ContentBundle): Set<string> {
  const gated = new Set<string>();
  const scan = (scene: SceneNode) => {
    for (const condition of scene.conditions ?? []) {
      if (condition.type === 'hasDeduction') gated.add(condition.target);
    }
    if (scene.variantCondition?.type === 'hasDeduction') gated.add(scene.variantCondition.target);
    for (const discovery of scene.cluesAvailable ?? []) {
      if (discovery.requiresDeduction) gated.add(discovery.requiresDeduction);
    }
    for (const choice of allChoices(scene)) {
      if (choice.requiresDeduction) gated.add(choice.requiresDeduction);
    }
  };
  for (const scene of bundle.scenes) scan(scene);
  for (const variant of bundle.variants) scan(variant);
  return gated;
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
  recipeIds: Set<string>;
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

  if (choice.requiresDeduction && !ctx.recipeIds.has(choice.requiresDeduction)) {
    ctx.errors.push(`${at} -> requiresDeduction references unknown key deduction "${choice.requiresDeduction}"`);
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

  const isCheck = isFacultyCheck(choice);

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
  // Discriminated union: each case narrows `target`/`value` to its real shape.
  switch (condition.type) {
    case 'hasClue':
      if (!ctx.clueIds.has(condition.target)) {
        ctx.errors.push(`${where} -> hasClue references unknown clue "${condition.target}"`);
      }
      break;
    case 'npcDisposition':
    case 'npcMemoryFlag':
      if (!ctx.npcIds.has(condition.target)) {
        ctx.errors.push(`${where} -> ${condition.type} references unknown npc "${condition.target}"`);
      }
      break;
    case 'npcSuspicion':
      if (!ctx.npcIds.has(condition.target)) {
        ctx.errors.push(`${where} -> npcSuspicion references unknown npc "${condition.target}"`);
      }
      if (!SUSPICION_TIERS.has(condition.value)) {
        ctx.errors.push(`${where} -> npcSuspicion has invalid tier value "${String(condition.value)}"`);
      }
      break;
    case 'facultyMin':
      if (!FACULTIES.has(condition.target)) {
        ctx.errors.push(`${where} -> facultyMin references invalid faculty "${condition.target}"`);
      }
      break;
    case 'archetypeIs':
      if (!ARCHETYPES.has(condition.value)) {
        ctx.errors.push(`${where} -> archetypeIs has invalid archetype value "${String(condition.value)}"`);
      }
      break;
    case 'factionReputation':
      if (!FACTIONS.has(condition.target)) {
        ctx.errors.push(`${where} -> factionReputation references unknown faction "${condition.target}"`);
      }
      break;
    case 'hasFlag':
      // hasFlag targets are free-form and value:false is legitimate ("flag unset").
      break;
    case 'hasDeduction':
      // hasDeduction targets are authored recipe ids, so they must resolve.
      if (!ctx.recipeIds.has(condition.target)) {
        ctx.errors.push(`${where} -> hasDeduction references unknown key deduction "${condition.target}"`);
      }
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
 * Outgoing edges reachable without a critical roll (F-102). For a faculty check,
 * only the non-`critical` tiers count; for a non-check choice, its resolved
 * `success ?? critical` destination always counts (no roll is involved). A
 * destination that a check reaches only via `critical` is therefore dropped —
 * unless some other (non-check, or lower-tier) edge also reaches it.
 */
function nonCriticalOutgoingEdges(scene: SceneNode): string[] {
  const targets: string[] = [];
  for (const choice of allChoices(scene)) {
    const outcomes = choice.outcomes ?? {};
    const isCheck = isFacultyCheck(choice);
    if (isCheck) {
      for (const [tier, target] of Object.entries(outcomes)) {
        if (tier !== 'critical' && target) targets.push(target);
      }
    } else {
      // Non-check: resolves via success ?? critical, no roll — always traversable.
      const target = outcomes.success ?? outcomes.critical;
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

/**
 * Clues actually OBTAINABLE from the given reachable-scene set: only real
 * discovery points — a scene's `cluesAvailable`, or an `onEnter` `discoverClue`
 * effect. Unlike {@link computeDiscoverableClues}, this excludes clues merely
 * *referenced* by a choice's `requiresClue`/`advantageIf` (a reference is not a
 * source). Used by the F-102 critical-gating check so a clue only gathered on a
 * `critical` tier is correctly seen as not obtainable on the non-critical graph.
 */
function computeObtainableClues(bundle: ContentBundle, reachable: Set<string>): Set<string> {
  const obtainable = new Set<string>();

  const collect = (scene: SceneNode) => {
    for (const discovery of scene.cluesAvailable ?? []) {
      if (discovery.clueId) obtainable.add(discovery.clueId);
    }
    for (const effect of scene.onEnter ?? []) {
      if (effect.type === 'discoverClue' && effect.target) obtainable.add(effect.target);
    }
  };

  for (const scene of bundle.scenes) {
    if (reachable.has(scene.id)) collect(scene);
  }
  for (const variant of bundle.variants) {
    if (variant.variantOf && reachable.has(variant.variantOf)) collect(variant);
  }
  return obtainable;
}
