#!/usr/bin/env node
/**
 * Launcher shim for the content validator.
 *
 * The real validator is TypeScript (scripts/validateCase.ts) so it can import
 * the shared src/engine/contentValidation module — the single source of truth
 * shared with the runtime validateContent. This shim runs it through vite-node
 * so the long-standing `node scripts/validateCase.mjs [path]` invocation (used
 * by deploy.yml, .claude settings, the /validate-case skill, and the docs)
 * keeps working unchanged.
 *
 * Usage:
 *   node scripts/validateCase.mjs                          # validate all cases
 *   node scripts/validateCase.mjs content/cases/my-case    # validate one unit
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'validateCase.ts');
const viteNode = join(here, '..', 'node_modules', '.bin', 'vite-node');

const result = spawnSync(viteNode, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: join(here, '..'),
});

if (result.error) {
  console.error('[validateCase] Failed to launch vite-node:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
