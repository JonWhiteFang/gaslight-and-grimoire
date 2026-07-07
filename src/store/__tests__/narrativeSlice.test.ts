/**
 * Unit tests for narrativeSlice behaviour.
 *
 * - goToScene must not push an empty-string sentinel into sceneHistory
 *   when navigating from the initial (unset) scene.
 * - last-critical-faculty must be cleared on case/vignette load so a
 *   faculty bonus earned in one case cannot leak into the next.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../index';

function resetNarrative() {
  useStore.setState({
    currentScene: '',
    currentCase: '',
    sceneHistory: [],
    flags: {},
    clues: {},
    npcs: {},
    deductions: {},
    connections: [],
  });
}

const firstScene = {
  id: 'test-scene-1',
  narrative: 'A test scene.',
  choices: [],
  cluesAvailable: [],
  onEnter: [],
};

// Minimal shared scenes (breakdown/incapacitation) injected by loadCase.
const sharedScene = (id: string) => ({ id, narrative: id, choices: [], cluesAvailable: [], onEnter: [] });

/**
 * Serves a minimal valid case through a mocked fetch keyed by URL suffix, so
 * loadAndStartCase exercises the real loader without touching the filesystem.
 */
function stubFetchWithFixture() {
  const bySuffix: Record<string, unknown> = {
    'cases/test-case/meta.json': { id: 'test-case', title: 'Test Case', firstScene: 'test-scene-1', acts: 3, facultyDistribution: {} },
    'cases/test-case/act1.json': { scenes: [firstScene] },
    'cases/test-case/act2.json': { scenes: [] },
    'cases/test-case/act3.json': { scenes: [] },
    'cases/test-case/clues.json': { clues: [] },
    'cases/test-case/npcs.json': { npcs: [] },
    'cases/test-case/variants.json': { variants: [] },
    'shared/breakdown.json': sharedScene('breakdown'),
    'shared/incapacitation.json': sharedScene('incapacitation'),
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const key = Object.keys(bySuffix).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
    return { ok: true, json: async () => bySuffix[key] } as Response;
  }));
}

describe('narrativeSlice.goToScene — sceneHistory hygiene', () => {
  beforeEach(resetNarrative);

  it('does not push an empty-string entry when navigating from the initial scene', () => {
    useStore.getState().goToScene('scene-1');
    expect(useStore.getState().sceneHistory).toEqual([]);
    expect(useStore.getState().currentScene).toBe('scene-1');
  });

  it('accumulates real scene ids on subsequent navigation', () => {
    useStore.getState().goToScene('scene-1');
    useStore.getState().goToScene('scene-2');
    expect(useStore.getState().sceneHistory).toEqual(['scene-1']);
    expect(useStore.getState().currentScene).toBe('scene-2');
  });
});

describe('narrativeSlice.loadAndStartCase — last-critical-faculty is cleared', () => {
  beforeEach(() => {
    resetNarrative();
    stubFetchWithFixture();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears a leftover last-critical-faculty flag from a previous case', async () => {
    // Simulate a critical success earned in a prior case.
    useStore.setState((s) => ({
      flags: { ...s.flags, 'last-critical-faculty': 'lore' as unknown as boolean },
    }));
    expect(useStore.getState().flags['last-critical-faculty']).toBe('lore');

    await useStore.getState().loadAndStartCase('test-case');

    expect(useStore.getState().flags['last-critical-faculty']).toBeUndefined();
  });
});
