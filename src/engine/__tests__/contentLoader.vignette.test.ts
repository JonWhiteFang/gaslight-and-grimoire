/**
 * Tests for optional deductions.json / variants.json support in loadVignette.
 *
 * Vignettes historically load only meta/scenes/clues/npcs; main cases also load
 * key-deduction recipes and variant scenes. `loadVignette` must treat both
 * files as optional: absent files (404 → fetchJson throws → .catch fallback)
 * leave existing vignettes' adapter output identical, present files are loaded
 * through.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadVignette, _resetSharedScenesCache } from '../contentLoader';

const BREAKDOWN = { id: 'breakdown', act: 1, narrative: 'b', cluesAvailable: [], choices: [] };
const INCAP = { id: 'incapacitation', act: 1, narrative: 'i', cluesAvailable: [], choices: [] };
const META = { id: 'v-test', title: 'T', synopsis: 'S', firstScene: 'v-s1' };
const SCENES = { scenes: [{ id: 'v-s1', act: 1, narrative: 'n', cluesAvailable: [], choices: [] }] };
const CLUES = { clues: [] };
const NPCS = { npcs: [] };
const DEDUCTIONS = {
  deductions: [
    { id: 'v-recipe', requiredClues: [], title: 'R', description: 'd', isRedHerring: false },
  ],
};
const VARIANTS = {
  variants: [
    {
      id: 'v-s1-alt', act: 1, narrative: 'alt', cluesAvailable: [], choices: [],
      variantOf: 'v-s1', variantCondition: { type: 'hasFlag', target: 'x' },
    },
  ],
};

// Full-path keys so the vignette's own files can never cross-match the shared
// scene URLs (e.g. a bare 'scenes.json' key would also suffix-match nothing
// today, but full paths make the mapping unambiguous by construction).
// `overrides` maps a URL suffix to a custom Response (e.g. a 500, or ok-but-
// malformed JSON) that takes precedence over both the file map and the 404 path.
function mockFetch(files: Record<string, unknown>, overrides: Record<string, Response> = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const over = Object.keys(overrides).find((k) => url.endsWith(k));
    if (over) return overrides[over];
    const key = Object.keys(files).find((k) => url.endsWith(k));
    // deductions.json / variants.json are optional (.catch fallback); 404 them.
    if (!key) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response;
    return { ok: true, json: async () => files[key] } as Response;
  }));
}

const BASE_FILES = {
  'shared/breakdown.json': BREAKDOWN,
  'shared/incapacitation.json': INCAP,
  'side-cases/v-test/meta.json': META,
  'side-cases/v-test/scenes.json': SCENES,
  'side-cases/v-test/clues.json': CLUES,
  'side-cases/v-test/npcs.json': NPCS,
};

beforeEach(() => _resetSharedScenesCache());
afterEach(() => vi.unstubAllGlobals());

describe('loadVignette optional recipes/variants', () => {
  it('absent files -> recipes undefined, variants [] (existing vignettes unaffected)', async () => {
    mockFetch(BASE_FILES);
    const data = await loadVignette('v-test');
    expect(data.recipes).toBeUndefined();
    expect(data.variants).toEqual([]);
  });

  it('present files -> recipes and variants loaded', async () => {
    mockFetch({
      ...BASE_FILES,
      'side-cases/v-test/deductions.json': DEDUCTIONS,
      'side-cases/v-test/variants.json': VARIANTS,
    });
    const data = await loadVignette('v-test');
    expect(data.recipes).toHaveLength(1);
    expect(data.recipes![0].id).toBe('v-recipe');
    expect(data.variants).toHaveLength(1);
    expect(data.variants![0].variantOf).toBe('v-s1');
  });

  // Only a genuine 404 may fall back — any other failure on an optional file
  // must reject the load, or a transient 500/bad deploy would silently strip a
  // vignette's variants/recipes while it still played (Codex impl review, Major 1).
  it('a 500 on variants.json rejects the load (not silently dropped)', async () => {
    mockFetch(BASE_FILES, {
      'side-cases/v-test/variants.json': {
        ok: false, status: 500, statusText: 'Server Error', json: async () => ({}),
      } as Response,
    });
    await expect(loadVignette('v-test')).rejects.toThrow(/500/);
  });

  it('malformed JSON in deductions.json rejects the load (not silently dropped)', async () => {
    mockFetch(BASE_FILES, {
      'side-cases/v-test/deductions.json': {
        ok: true, json: async () => { throw new SyntaxError('Unexpected token'); },
      } as unknown as Response,
    });
    await expect(loadVignette('v-test')).rejects.toThrow(/Unexpected token/);
  });
});
