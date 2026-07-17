/**
 * Build-time content validator (CLI).
 *
 * Reads case/vignette JSON from disk, assembles a ContentBundle per unit, and
 * runs the SAME shared validator the runtime uses (src/engine/contentValidation),
 * with reachability warnings enabled (CLI-only). This is the single source of
 * truth for "valid content" — the runtime `validateContent` and this CLI cannot
 * drift because they call one module.
 *
 * Run via `node scripts/validateCase.mjs` (a thin vite-node launcher shim), or
 * directly with `npx vite-node scripts/validateCase.ts [path]`.
 *
 * Usage:
 *   validateCase                          # validate all cases + vignettes
 *   validateCase content/cases/my-case    # validate one unit (path relative to cwd)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { Clue, KeyDeduction, NPCState, SceneNode } from '../src/types';
import { validateBundle, type ContentBundle } from '../src/engine/contentValidation';

const SHARED_SCENE_IDS = ['breakdown', 'incapacitation'];

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T;
}

/** Assembles a ContentBundle from a case or vignette directory. */
export function loadBundle(dir: string): ContentBundle {
  const isMainCase = existsSync(join(dir, 'act1.json'));

  let scenes: SceneNode[];
  let variants: SceneNode[] = [];

  if (isMainCase) {
    const act1 = readJson<{ scenes: SceneNode[] }>(join(dir, 'act1.json'));
    const act2 = readJson<{ scenes: SceneNode[] }>(join(dir, 'act2.json'));
    const act3 = readJson<{ scenes: SceneNode[] }>(join(dir, 'act3.json'));
    scenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  } else {
    scenes = readJson<{ scenes: SceneNode[] }>(join(dir, 'scenes.json')).scenes;
  }

  // variants.json is optional for BOTH cases and vignettes (Orrery Room spec §2.6):
  // vignette variants must reach validateBundle or they get no structural/Phase 5/
  // F-102 validation at all.
  if (existsSync(join(dir, 'variants.json'))) {
    variants = readJson<{ variants: SceneNode[] }>(join(dir, 'variants.json')).variants;
  }

  const clues = readJson<{ clues: Clue[] }>(join(dir, 'clues.json')).clues;
  const npcs = existsSync(join(dir, 'npcs.json'))
    ? readJson<{ npcs: NPCState[] }>(join(dir, 'npcs.json')).npcs
    : [];
  const recipes = existsSync(join(dir, 'deductions.json'))
    ? readJson<{ deductions: KeyDeduction[] }>(join(dir, 'deductions.json')).deductions
    : [];
  const meta = readJson<{ firstScene?: string }>(join(dir, 'meta.json'));

  return { scenes, variants, clues, npcs, recipes, firstScene: meta.firstScene, sharedSceneIds: SHARED_SCENE_IDS };
}

function validateUnit(dir: string): { errors: string[]; warnings: string[]; sceneCount: number; clueCount: number } {
  const bundle = loadBundle(dir);
  const meta = readJson<{ firstScene?: string }>(join(dir, 'meta.json'));

  const { errors, warnings } = validateBundle(bundle, { includeReachability: true });

  // meta.firstScene sanity (kept CLI-side: a warning vs. error nuance the
  // runtime doesn't need since it falls back to Object.keys).
  if (!meta.firstScene) {
    warnings.unshift('meta.json missing "firstScene" field — relying on Object.keys fallback');
  }

  const sceneCount = bundle.scenes.length + bundle.variants.length;
  return { errors, warnings, sceneCount, clueCount: bundle.clues.length };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const arg = process.argv[2];
  let dirs: string[];

  if (arg) {
    dirs = [join(process.cwd(), arg)];
  } else {
    dirs = [];
    const casesDir = join(process.cwd(), 'public/content/cases');
    const sideDir = join(process.cwd(), 'public/content/side-cases');
    for (const base of [casesDir, sideDir]) {
      if (!existsSync(base)) continue;
      for (const d of readdirSync(base, { withFileTypes: true })) {
        if (d.isDirectory()) dirs.push(join(base, d.name));
      }
    }
  }

  let totalErrors = 0;

  for (const dir of dirs) {
    const name = dir.split('/').slice(-2).join('/');
    const { errors, warnings, sceneCount, clueCount } = validateUnit(dir);

    if (errors.length === 0) {
      console.log(`✓ ${name} — ${sceneCount} scenes, ${clueCount} clues`);
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
}

// Skip CLI execution when this module is imported by the test suite
// (vitest sets VITEST=true); tests import loadBundle, not the CLI run.
if (!process.env.VITEST) {
  main();
}
