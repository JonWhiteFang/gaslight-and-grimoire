#!/usr/bin/env node
/**
 * Validates case content files for broken graph edges and missing clue references.
 * Usage:
 *   node scripts/validateCase.mjs                          # validate all cases
 *   node scripts/validateCase.mjs content/cases/my-case    # validate one case
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

/**
 * BFS from firstScene over choice-outcome edges (all tiers). Also collects the
 * set of clues discoverable from reachable scenes (via cluesAvailable).
 * Variants are not graph nodes — they resolve at runtime, so a variant's
 * cluesAvailable is only counted when its parent base scene is reachable.
 */
function computeReachability(baseScenes, firstScene) {
  const byId = new Map(baseScenes.map(s => [s.id, s]));
  const reachableScenes = new Set();
  const discoverableClues = new Set();
  if (!firstScene || !byId.has(firstScene)) {
    return { reachableScenes, discoverableClues };
  }

  const queue = [firstScene];
  reachableScenes.add(firstScene);
  while (queue.length > 0) {
    const scene = byId.get(queue.shift());
    if (!scene) continue;
    for (const discovery of scene.cluesAvailable || []) {
      if (discovery.clueId) discoverableClues.add(discovery.clueId);
    }
    for (const choice of scene.choices || []) {
      if (choice.requiresClue) discoverableClues.add(choice.requiresClue);
      for (const clueId of choice.advantageIf || []) discoverableClues.add(clueId);
      for (const target of Object.values(choice.outcomes || {})) {
        if (target && byId.has(target) && !reachableScenes.has(target)) {
          reachableScenes.add(target);
          queue.push(target);
        }
      }
    }
  }
  return { reachableScenes, discoverableClues };
}

function validateCase(dir) {
  const isMainCase = existsSync(join(dir, 'act1.json'));
  let allScenes;

  if (isMainCase) {
    const act1 = readJson(join(dir, 'act1.json'));
    const act2 = readJson(join(dir, 'act2.json'));
    const act3 = readJson(join(dir, 'act3.json'));
    allScenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  } else {
    const scenesFile = readJson(join(dir, 'scenes.json'));
    allScenes = scenesFile.scenes;
  }

  const cluesFile = readJson(join(dir, 'clues.json'));
  const sceneIds = new Set(allScenes.map(s => s.id));
  const clueIds = new Set(cluesFile.clues.map(c => c.id));

  // NPC ids (for onEnter effect-target validation). Shared injected scenes
  // (breakdown/incapacitation) target no npcs, so this set is case-local.
  const npcIds = new Set(
    existsSync(join(dir, 'npcs.json')) ? readJson(join(dir, 'npcs.json')).npcs.map(n => n.id) : [],
  );

  // Base (non-variant) scenes only — used for reachability, which must not
  // treat a variant as a graph node (variants resolve at runtime, not as edges).
  const baseScenes = [...allScenes];

  // Add variant IDs if variants.json exists
  if (existsSync(join(dir, 'variants.json'))) {
    const variantsFile = readJson(join(dir, 'variants.json'));
    for (const v of variantsFile.variants) {
      sceneIds.add(v.id);
      allScenes.push(v);
    }
  }

  const errors = [];
  const warnings = [];

  // Check firstScene reference
  const meta = readJson(join(dir, 'meta.json'));
  if (!meta.firstScene) {
    warnings.push('meta.json missing "firstScene" field — relying on Object.keys fallback');
  } else if (!sceneIds.has(meta.firstScene)) {
    errors.push(`meta.json "firstScene" references unknown scene "${meta.firstScene}"`);
  }

  for (const scene of allScenes) {
    for (const choice of scene.choices || []) {
      for (const [tier, targetId] of Object.entries(choice.outcomes || {})) {
        if (targetId && !sceneIds.has(targetId)) {
          errors.push(`Scene "${scene.id}" -> choice "${choice.id}" -> outcome "${tier}" references unknown scene "${targetId}"`);
        }
      }
      if (choice.requiresClue && !clueIds.has(choice.requiresClue)) {
        errors.push(`Scene "${scene.id}" -> choice "${choice.id}" -> requiresClue references unknown clue "${choice.requiresClue}"`);
      }
      if (choice.advantageIf) {
        for (const clueId of choice.advantageIf) {
          if (!clueIds.has(clueId)) {
            errors.push(`Scene "${scene.id}" -> choice "${choice.id}" -> advantageIf references unknown clue "${clueId}"`);
          }
        }
      }

      // Check outcome tier completeness for faculty-check choices
      if (choice.faculty && choice.difficulty !== undefined) {
        for (const tier of ['critical', 'success', 'partial', 'failure', 'fumble']) {
          if (!choice.outcomes?.[tier]) {
            errors.push(`Scene "${scene.id}" -> choice "${choice.id}" -> missing outcome tier "${tier}"`);
          }
        }
      }
    }
    for (const discovery of scene.cluesAvailable || []) {
      if (!clueIds.has(discovery.clueId)) {
        errors.push(`Scene "${scene.id}" -> cluesAvailable references unknown clue "${discovery.clueId}"`);
      }
    }

    // Validate onEnter effect targets: a typo'd target silently no-ops at
    // runtime (guarded by `if (clue)` / `if (npc)`), so catch it here.
    for (const effect of scene.onEnter || []) {
      if (effect.type === 'discoverClue' && effect.target && !clueIds.has(effect.target)) {
        errors.push(`Scene "${scene.id}" -> onEnter discoverClue references unknown clue "${effect.target}"`);
      }
      if (['disposition', 'suspicion', 'setMemoryFlag'].includes(effect.type) && effect.target && !npcIds.has(effect.target)) {
        errors.push(`Scene "${scene.id}" -> onEnter ${effect.type} references unknown npc "${effect.target}"`);
      }
    }
  }

  // ── Reachability (warnings) ──────────────────────────────────────────────
  // Graph-walk from firstScene following every choice outcome edge. Scenes
  // that are authored but never reachable are surfaced as warnings, along with
  // clues that no reachable scene can discover.
  const reach = computeReachability(baseScenes, meta.firstScene);
  const SHARED = new Set(['breakdown', 'incapacitation']);
  for (const scene of baseScenes) {
    if (!reach.reachableScenes.has(scene.id) && !SHARED.has(scene.id)) {
      warnings.push(`scene "${scene.id}" is unreachable from firstScene`);
    }
  }
  for (const clueId of clueIds) {
    if (!reach.discoverableClues.has(clueId)) {
      warnings.push(`clue "${clueId}" is never discoverable (no reachable scene lists it in cluesAvailable)`);
    }
  }

  return { sceneIds, clueIds, errors, warnings };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const arg = process.argv[2];
let dirs;

if (arg) {
  dirs = [join(process.cwd(), arg)];
} else {
  dirs = [];
  const casesDir = join(process.cwd(), 'public/content/cases');
  const sideDir = join(process.cwd(), 'public/content/side-cases');
  if (existsSync(casesDir)) {
    for (const d of readdirSync(casesDir, { withFileTypes: true })) {
      if (d.isDirectory()) dirs.push(join(casesDir, d.name));
    }
  }
  if (existsSync(sideDir)) {
    for (const d of readdirSync(sideDir, { withFileTypes: true })) {
      if (d.isDirectory()) dirs.push(join(sideDir, d.name));
    }
  }
}

let totalErrors = 0;

for (const dir of dirs) {
  const name = dir.split('/').slice(-2).join('/');
  const { sceneIds, clueIds, errors, warnings } = validateCase(dir);

  if (errors.length === 0) {
    console.log(`✓ ${name} — ${sceneIds.size} scenes, ${clueIds.size} clues`);
  } else {
    console.error(`✗ ${name} — ${errors.length} error(s):`);
    for (const e of errors) console.error(`    ${e}`);
    totalErrors += errors.length;
  }
  for (const w of warnings) console.warn(`  ⚠ ${name}: ${w}`);
}

if (totalErrors > 0) {
  process.exit(1);
} else {
  console.log(`\nAll ${dirs.length} case(s) validated successfully.`);
}
