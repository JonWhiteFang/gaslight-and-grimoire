#!/usr/bin/env node
/**
 * Validates the Whitechapel Cipher case content files.
 * Reads JSON directly and runs the same logic as validateContent.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const base = join(process.cwd(), 'content/cases/the-whitechapel-cipher');

function readJson(file) {
  return JSON.parse(readFileSync(join(base, file), 'utf-8'));
}

const act1 = readJson('act1.json');
const act2 = readJson('act2.json');
const act3 = readJson('act3.json');
const cluesFile = readJson('clues.json');
const variantsFile = readJson('variants.json');

const allScenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
const sceneIds = new Set(allScenes.map(s => s.id));
const clueIds = new Set(cluesFile.clues.map(c => c.id));

// Add variant IDs as valid targets
for (const v of variantsFile.variants) {
  sceneIds.add(v.id);
}

const errors = [];

function validateScene(scene, label) {
  for (const choice of scene.choices || []) {
    for (const [tier, targetId] of Object.entries(choice.outcomes || {})) {
      if (targetId && !sceneIds.has(targetId)) {
        errors.push(`${label} "${scene.id}" -> choice "${choice.id}" -> outcome "${tier}" references unknown scene "${targetId}"`);
      }
    }
    if (choice.requiresClue && !clueIds.has(choice.requiresClue)) {
      errors.push(`${label} "${scene.id}" -> choice "${choice.id}" -> requiresClue references unknown clue "${choice.requiresClue}"`);
    }
    if (choice.advantageIf) {
      for (const clueId of choice.advantageIf) {
        if (!clueIds.has(clueId)) {
          errors.push(`${label} "${scene.id}" -> choice "${choice.id}" -> advantageIf references unknown clue "${clueId}"`);
        }
      }
    }
  }
  for (const discovery of scene.cluesAvailable || []) {
    if (!clueIds.has(discovery.clueId)) {
      errors.push(`${label} "${scene.id}" -> cluesAvailable references unknown clue "${discovery.clueId}"`);
    }
  }
}

for (const scene of allScenes) {
  validateScene(scene, 'Scene');
}
for (const variant of variantsFile.variants) {
  validateScene(variant, 'Variant');
}

if (errors.length === 0) {
  console.log('Validation passed -- no broken graph edges or missing clue references.');
  console.log('Scene IDs defined:', [...sceneIds].sort().join(', '));
  console.log('Clue IDs defined:', [...clueIds].sort().join(', '));
} else {
  console.error('Validation FAILED:');
  for (const e of errors) {
    console.error('  -', e);
  }
  process.exit(1);
}
