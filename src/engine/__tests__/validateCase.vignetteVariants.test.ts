/**
 * Guards the CLI validator's vignette-variant loading (Orrery Room Task 3).
 *
 * `loadBundle` must read an optional `variants.json` for vignettes, not only
 * main cases — otherwise vignette variants receive NO CLI validation at all
 * (broken edges, missing variantOf, F-102 gated-recipe reachability… all
 * silently skipped). The fixture is a minimal vignette whose only variant
 * carries a choice pointing at a nonexistent scene: that error is findable
 * ONLY by validating the variant.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Explicit .ts extension: an extension-less specifier resolves to the
// validateCase.mjs launcher shim (Vite tries .mjs before .ts), which would
// spawn the whole CLI instead of importing loadBundle.
import { loadBundle } from '../../../scripts/validateCase.ts';
import { validateBundle } from '../contentValidation';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/vignette-broken-variant');

describe('CLI loadBundle — vignette variants', () => {
  it('feeds vignette variants to validation (broken variant edge is caught)', () => {
    const bundle = loadBundle(FIXTURE);
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('vf-nowhere'))).toBe(true);
  });
});
