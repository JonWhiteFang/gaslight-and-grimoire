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
