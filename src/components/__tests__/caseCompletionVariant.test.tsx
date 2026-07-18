/**
 * Case Complete must quote the RESOLVED ending scene, not the base (whole-branch
 * review Major, Orrery Room). `currentScene` always holds the BASE id and
 * `caseData.scenes` is the base map — variants only resolve through
 * `resolveScene`. The Orrery Room ships the repo's first terminal-scene
 * variants (`-named` endings gated on `hasDeduction: mythos-pattern-named`),
 * so a completion handler that reads the base map silently drops the earned
 * keystone closing paragraph from the completion screen.
 *
 * Two layers (Codex impl review, Minor 3):
 *  - unit tests on the exported `resolveEndingNarrative` helper, and
 *  - an App-level seam test that loads a save, clicks the real "Case Complete"
 *    button, and asserts the completion screen quotes the VARIANT paragraph —
 *    so reverting App's wiring to the base-map lookup fails even with the
 *    helper still exported.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App, { resolveEndingNarrative } from '../../App';
import { resolveScene } from '../../engine/conditions';
import { _resetSharedScenesCache } from '../../engine/contentLoader';
import type { CaseData, GameState, SceneNode } from '../../types';

function scene(id: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, act: 2, narrative: `base ${id}`, cluesAvailable: [], choices: [], ...extra };
}

const VARIANT_PARAGRAPH = 'the closing paragraph the keystone earned';

const baseEnding = scene('ending', { narrative: 'the base ending' });
const namedVariant = scene('ending-named', {
  narrative: `the base ending — and ${VARIANT_PARAGRAPH}`,
  variantOf: 'ending',
  variantCondition: { type: 'hasDeduction', target: 'mythos-pattern-named' },
});

const caseData: CaseData = {
  meta: { id: 'v-test', title: 'V', synopsis: '', acts: 2, facultyDistribution: {} },
  scenes: { ending: baseEnding },
  clues: {},
  npcs: {},
  variants: [namedVariant],
};

const keystoneDeduction = {
  'mythos-pattern-named': {
    id: 'mythos-pattern-named', clueIds: [], title: '', description: '',
    isCorrect: true, formedAt: 0,
  },
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: 'Test', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    },
    currentScene: 'ending',
    currentCase: 'v-test',
    clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard', highContrast: false, reducedMotion: false,
      textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'manual',
      audioVolume: { ambient: 0, sfx: 0 },
    },
    ...overrides,
  } as GameState;
}

const withKeystone = makeState({
  deductions: keystoneDeduction as unknown as GameState['deductions'],
});

describe('resolveEndingNarrative (unit)', () => {
  it('sanity: resolveScene picks the -named variant with the deduction held', () => {
    expect(resolveScene('ending', withKeystone, caseData).id).toBe('ending-named');
  });

  it('returns the VARIANT narrative when the deduction is held', () => {
    expect(resolveEndingNarrative('ending', withKeystone, caseData)).toBe(
      `the base ending — and ${VARIANT_PARAGRAPH}`,
    );
  });

  it('returns the base narrative without the deduction', () => {
    expect(resolveEndingNarrative('ending', makeState(), caseData)).toBe('the base ending');
  });

  it('is null-safe on unknown scene / missing caseData', () => {
    expect(resolveEndingNarrative('nope', makeState(), caseData)).toBeNull();
    expect(resolveEndingNarrative('ending', makeState(), null)).toBeNull();
  });
});

// ── App-level seam test ────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

const sharedScene = (id: string) => ({ id, act: 1, narrative: id, cluesAvailable: [], choices: [] });

/** Serves the tiny terminal-variant vignette by URL suffix. */
function stubFetch() {
  const bySuffix: Record<string, unknown> = {
    'content/manifest.json': {
      cases: [{ id: 'v-test', title: 'V', synopsis: '', type: 'vignette' }],
    },
    'side-cases/v-test/meta.json': { id: 'v-test', title: 'V', synopsis: '', firstScene: 'ending' },
    'side-cases/v-test/scenes.json': { scenes: [baseEnding] },
    'side-cases/v-test/clues.json': { clues: [] },
    'side-cases/v-test/npcs.json': { npcs: [] },
    'side-cases/v-test/variants.json': { variants: [namedVariant] },
    'shared/breakdown.json': sharedScene('breakdown'),
    'shared/incapacitation.json': sharedScene('incapacitation'),
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const key = Object.keys(bySuffix).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response;
    return { ok: true, json: async () => bySuffix[key] } as Response;
  }));
}

describe('App completion seam (Codex impl Minor 3)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    _resetSharedScenesCache();
    stubFetch();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('clicking the real Case Complete button quotes the VARIANT paragraph', async () => {
    // Seed a save sitting ON the terminal base scene with the keystone held.
    const state = withKeystone;
    localStorage.setItem('gg_save_seam', JSON.stringify({
      version: 5, timestamp: '2026-07-18T00:00:00.000Z',
      state: { ...state, connections: [], visitedScenes: ['ending'], encounterState: null },
    }));
    localStorage.setItem('gg_save_index', JSON.stringify([
      { id: 'seam', timestamp: '2026-07-18T00:00:00.000Z', caseName: 'V', investigatorName: 'Test' },
    ]));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /continue a saved investigation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /load investigation/i }));

    // The terminal scene renders the real Case Complete button.
    const complete = await screen.findByRole('button', { name: /case complete/i });
    fireEvent.click(complete);

    // The lazy CaseCompletion screen quotes the RESOLVED (variant) narrative.
    await waitFor(() => {
      expect(document.body.textContent).toContain(VARIANT_PARAGRAPH);
    });
  });
});
