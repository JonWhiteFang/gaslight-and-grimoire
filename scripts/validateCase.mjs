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
    }
    for (const discovery of scene.cluesAvailable || []) {
      if (!clueIds.has(discovery.clueId)) {
        errors.push(`Scene "${scene.id}" -> cluesAvailable references unknown clue "${discovery.clueId}"`);
      }
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
  const casesDir = join(process.cwd(), 'content/cases');
  const sideDir = join(process.cwd(), 'content/side-cases');
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
