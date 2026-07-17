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
import { vignetteToCaseData } from '../slices/narrativeSlice';
import type { KeyDeduction, SceneNode, VignetteData } from '../../types';

function resetNarrative() {
  useStore.setState({
    currentScene: '',
    currentCase: '',
    sceneHistory: [],
    visitedScenes: [],
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

// ─── onEnter effects fire once per scene per playthrough (F-006) ───────────────

/** Builds a minimal caseData whose scenes carry the given onEnter effects. */
function stubCaseDataWithOnEnter(scenes: Record<string, { onEnter?: unknown[] }>) {
  const sceneRecord: Record<string, unknown> = {};
  for (const [id, def] of Object.entries(scenes)) {
    sceneRecord[id] = {
      id,
      narrative: id,
      choices: [],
      cluesAvailable: [],
      onEnter: def.onEnter ?? [],
    };
  }
  useStore.setState({
    caseData: {
      meta: { id: 'c', title: 'C', firstScene: Object.keys(scenes)[0], acts: 3, facultyDistribution: {} },
      scenes: sceneRecord,
      clues: {},
      npcs: {},
      variants: [],
    },
  } as never);
}

describe('narrativeSlice.goToScene — onEnter effects are idempotent per scene (F-006)', () => {
  beforeEach(() => {
    resetNarrative();
    useStore.setState((s) => ({ investigator: { ...s.investigator, composure: 10, vitality: 10 } }));
  });

  it('applies a scene\'s onEnter effect on first entry', () => {
    stubCaseDataWithOnEnter({
      'scene-a': { onEnter: [{ type: 'composure', delta: -2 }] },
    });
    useStore.getState().goToScene('scene-a');
    expect(useStore.getState().investigator.composure).toBe(8);
    expect(useStore.getState().visitedScenes).toContain('scene-a');
  });

  it('does NOT re-apply onEnter effects when the same scene is entered again', () => {
    stubCaseDataWithOnEnter({
      'scene-a': { onEnter: [{ type: 'composure', delta: -2 }] },
      'scene-b': { onEnter: [] },
    });
    useStore.getState().goToScene('scene-a'); // composure 10 -> 8
    useStore.getState().goToScene('scene-b'); // no effect
    useStore.getState().goToScene('scene-a'); // revisit: must NOT drop to 6

    expect(useStore.getState().investigator.composure).toBe(8);
  });

  it('records the effect feedback message for the entered scene, and clears it on an effectless scene', () => {
    stubCaseDataWithOnEnter({
      'scene-a': { onEnter: [{ type: 'composure', delta: -2 }] },
      'scene-b': { onEnter: [] },
    });
    useStore.getState().goToScene('scene-a');
    expect(useStore.getState().lastEffectMessages.length).toBeGreaterThan(0);
    useStore.getState().goToScene('scene-b');
    expect(useStore.getState().lastEffectMessages).toEqual([]);
  });

  it('does not emit feedback messages on revisit of a scene whose effects already fired', () => {
    stubCaseDataWithOnEnter({
      'scene-a': { onEnter: [{ type: 'composure', delta: -2 }] },
      'scene-b': { onEnter: [] },
    });
    useStore.getState().goToScene('scene-a');
    useStore.getState().goToScene('scene-b');
    useStore.getState().goToScene('scene-a'); // revisit
    expect(useStore.getState().lastEffectMessages).toEqual([]);
  });
});

describe('narrativeSlice.loadAndStartCase — lastCriticalFaculty is reset (F-013)', () => {
  beforeEach(() => {
    resetNarrative();
    stubFetchWithFixture();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resets a leftover investigator.lastCriticalFaculty from a previous case', async () => {
    // Simulate a critical success earned in a prior case.
    useStore.setState((s) => ({
      investigator: { ...s.investigator, lastCriticalFaculty: 'lore' },
    }));
    expect(useStore.getState().investigator.lastCriticalFaculty).toBe('lore');

    await useStore.getState().loadAndStartCase('test-case');

    expect(useStore.getState().investigator.lastCriticalFaculty).toBeUndefined();
  });
});

// Guards the confirmed HIGH review finding: after a knockout (composure/vitality
// = 0 + breakdown/incapacitated flags set), starting a new case must reset the
// meters and clear those flags, or every case instantly re-halts (and the
// autosave written at 0 is poisoned).
describe('narrativeSlice.loadAndStartCase — recovers meters after a halt', () => {
  beforeEach(() => {
    resetNarrative();
    stubFetchWithFixture();
    useStore.setState((s) => ({
      investigator: { ...s.investigator, composure: 0, vitality: 0 },
      flags: { 'breakdown-occurred': true, 'incapacitated': true },
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores composure and vitality to full on case load', async () => {
    await useStore.getState().loadAndStartCase('test-case');
    expect(useStore.getState().investigator.composure).toBe(10);
    expect(useStore.getState().investigator.vitality).toBe(10);
  });

  it('clears the breakdown-occurred and incapacitated flags on case load', async () => {
    await useStore.getState().loadAndStartCase('test-case');
    expect(useStore.getState().flags['breakdown-occurred']).toBeUndefined();
    expect(useStore.getState().flags['incapacitated']).toBeUndefined();
  });

  it('does not immediately route back to the breakdown scene', async () => {
    await useStore.getState().loadAndStartCase('test-case');
    // With composure restored, the first scene stands — no re-halt.
    expect(useStore.getState().currentScene).toBe('test-scene-1');
  });
});

// F-104: resetForNewCase must clear the previous case's currentScene. Otherwise
// the new case's first goToScene pushes the stale foreign scene id into the
// fresh sceneHistory (phantom id in autosave + a live-but-no-op "Review previous
// scene" button at case start).
describe('narrativeSlice.loadAndStartCase — does not leak the previous scene into new history (F-104)', () => {
  beforeEach(() => {
    resetNarrative();
    stubFetchWithFixture();
    // Simulate finishing a prior case: a real currentScene + some history.
    useStore.setState({ currentScene: 'prev-case-final-scene', sceneHistory: ['prev-a', 'prev-b'] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts the new case with an empty sceneHistory (no foreign previous-case id)', async () => {
    await useStore.getState().loadAndStartCase('test-case');
    expect(useStore.getState().sceneHistory).toEqual([]);
    expect(useStore.getState().currentScene).toBe('test-scene-1');
  });
});

// Orrery Room T2: vignettes may ship optional deductions.json (recipes) and
// variants.json — the adapter must pass both through to CaseData instead of
// stubbing variants: [] and dropping recipes.
describe('vignetteToCaseData recipes/variants passthrough', () => {
  const baseVignette: VignetteData = {
    meta: { id: 'v', title: 't', synopsis: 's', firstScene: 'v-s1' },
    scenes: {}, clues: {}, npcs: {},
  };

  it('passes recipes and variants through', () => {
    const recipes: KeyDeduction[] = [
      { id: 'r1', requiredClues: [], title: 'T', description: 'D', isRedHerring: false },
    ];
    const variants: SceneNode[] = [
      { id: 'v-s1-alt', act: 1, narrative: 'n', cluesAvailable: [], choices: [], variantOf: 'v-s1' },
    ];
    const caseData = vignetteToCaseData({ ...baseVignette, recipes, variants });
    expect(caseData.recipes).toBe(recipes);
    expect(caseData.variants).toBe(variants);
  });

  it('defaults absent fields (backward compatible)', () => {
    const caseData = vignetteToCaseData({ ...baseVignette });
    expect(caseData.recipes).toBeUndefined();
    expect(caseData.variants).toEqual([]);
  });
});
