/**
 * Unit tests for metaSlice.loadGame result signalling and vignette support.
 *
 * - loadGame must return false (not silently navigate) when a save is
 *   missing or corrupt.
 * - loadGame must return true and restore caseData for a valid save.
 * - loadGame must restore vignette saves via the side-cases loader rather
 *   than fetching /content/cases/<id>/ (which 404s for vignettes).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../index';
import { SaveManager } from '../../engine/saveManager';
import { snapshotGameState } from '../../utils/gameState';

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const caseScene = { id: 's1', narrative: 'x', choices: [], cluesAvailable: [], onEnter: [] };
const shared = (id: string) => ({ id, narrative: id, choices: [], cluesAvailable: [], onEnter: [] });

const MANIFEST = {
  cases: [
    { id: 'test-case', title: 'Test Case', synopsis: '', type: 'case' },
    { id: 'test-vignette', title: 'Test Vignette', synopsis: '', type: 'vignette' },
  ],
};

/** Serves a minimal case AND vignette by URL suffix. Tracks fetched URLs. */
function stubFetch() {
  const bySuffix: Record<string, unknown> = {
    'content/manifest.json': MANIFEST,
    'cases/test-case/meta.json': { id: 'test-case', title: 'Test Case', firstScene: 's1', acts: 3, facultyDistribution: {} },
    'cases/test-case/act1.json': { scenes: [caseScene] },
    'cases/test-case/act2.json': { scenes: [] },
    'cases/test-case/act3.json': { scenes: [] },
    'cases/test-case/clues.json': { clues: [] },
    'cases/test-case/npcs.json': { npcs: [] },
    'cases/test-case/variants.json': { variants: [] },
    'side-cases/test-vignette/meta.json': { id: 'test-vignette', title: 'Test Vignette', firstScene: 's1' },
    'side-cases/test-vignette/scenes.json': { scenes: [caseScene] },
    'side-cases/test-vignette/clues.json': { clues: [] },
    'side-cases/test-vignette/npcs.json': { npcs: [] },
    'shared/breakdown.json': shared('breakdown'),
    'shared/incapacitation.json': shared('incapacitation'),
  };
  const fetched: string[] = [];
  const fn = vi.fn(async (url: string) => {
    fetched.push(url);
    const key = Object.keys(bySuffix).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
    return { ok: true, json: async () => bySuffix[key] } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fetched;
}

function baseInvestigator() {
  return {
    name: 'Holmes', archetype: 'deductionist' as const,
    faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

describe('metaSlice.loadGame — result signalling', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', localStorageMock); localStorageMock.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it('returns false for a missing save', async () => {
    const ok = await useStore.getState().loadGame('does-not-exist');
    expect(ok).toBe(false);
  });

  it('returns false for a corrupt save without mutating currentScene', async () => {
    localStorageMock.setItem('gg_save_corrupt', '{ not valid json');
    useStore.setState({ currentScene: 'safe-scene' });
    const ok = await useStore.getState().loadGame('corrupt');
    expect(ok).toBe(false);
    expect(useStore.getState().currentScene).toBe('safe-scene');
  });

  it('returns true and restores caseData for a valid case save', async () => {
    useStore.setState({
      investigator: baseInvestigator(), currentScene: 's1', currentCase: 'test-case',
      clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
      sceneHistory: [], connections: [],
    });
    SaveManager.save('valid', snapshotGameState(useStore.getState()));

    const ok = await useStore.getState().loadGame('valid');
    expect(ok).toBe(true);
    expect(useStore.getState().caseData?.meta.id).toBe('test-case');
  });
});

describe('metaSlice.loadGame — vignette save restoration', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', localStorageMock); localStorageMock.clear(); });
  afterEach(() => vi.unstubAllGlobals());

  it('restores a vignette save without fetching /content/cases/ (which would 404)', async () => {
    const fetched = stubFetch();
    useStore.setState({
      investigator: baseInvestigator(), currentScene: 's1', currentCase: 'test-vignette',
      clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
      sceneHistory: [], connections: [],
    });
    SaveManager.save('vig', snapshotGameState(useStore.getState()));

    const ok = await useStore.getState().loadGame('vig');
    expect(ok).toBe(true);
    expect(useStore.getState().caseData?.meta.id).toBe('test-vignette');
    // Must not have attempted the main-case path (/content/cases/...) for a vignette.
    expect(fetched.some((u) => u.includes('content/cases/test-vignette/'))).toBe(false);
  });
});
