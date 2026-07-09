/**
 * Unit tests for metaSlice.saveGame eviction signalling (F-052).
 *
 * A manual save caps at 10 (excluding the autosave slot). When the cap is
 * exceeded the oldest manual save is evicted — saveGame must report how many
 * were removed so the UI can warn instead of losing a save silently.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../index';
import { SaveManager } from '../../engine/saveManager';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock.clear();
  useStore.setState({
    investigator: {
      name: 'Holmes', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    },
    currentScene: 's1',
    currentCase: 'the-whitechapel-cipher',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Seed exactly 10 manual saves (`seed-0`..`seed-9`) plus an `autosave` slot,
 * then OVERWRITE the index with deterministic, strictly-increasing timestamps so
 * eviction order is unambiguous: `seed-0` is the oldest MANUAL save; `autosave`
 * is given the oldest timestamp of all (so a broken filter that treats it as a
 * manual candidate would evict IT first — that's what the protection test bites).
 * The real save that `saveGame` writes uses the live clock, so it sorts newest.
 */
function seedTenManualSavesPlusAutosave() {
  const state = useStore.getState() as never;
  for (let i = 0; i < 10; i++) SaveManager.save(`seed-${i}`, state, 'Test');
  SaveManager.save('autosave', state, 'Test');

  const index = [
    // autosave: oldest timestamp of all — must survive eviction regardless.
    { id: 'autosave', timestamp: '2019-01-01T00:00:00.000Z', caseName: 'Test', investigatorName: 'Holmes' },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `seed-${i}`,
      // seed-0 oldest → seed-9 newest, all before the live-clock save.
      timestamp: `2020-01-01T00:00:0${i}.000Z`,
      caseName: 'Test',
      investigatorName: 'Holmes',
    })),
  ];
  localStorageMock.setItem('gg_save_index', JSON.stringify(index));
}

describe('metaSlice.saveGame — eviction reporting (F-052)', () => {
  it('reports evicted: 0 for a normal save under the cap', async () => {
    const result = await useStore.getState().saveGame();
    expect(result.evicted).toBe(0);
    // And the one save we wrote is actually there.
    expect(SaveManager.listSaves().filter((s) => s.id !== 'autosave')).toHaveLength(1);
  });

  it('evicts exactly the OLDEST manual save when the 11th pushes over the cap', async () => {
    seedTenManualSavesPlusAutosave();

    const result = await useStore.getState().saveGame(); // the 11th manual save

    expect(result.ok).toBe(true);
    expect(result.evicted).toBe(1);

    const manualIds = SaveManager.listSaves()
      .filter((s) => s.id !== 'autosave')
      .map((s) => s.id);

    // Still capped at 10 manual saves.
    expect(manualIds).toHaveLength(10);
    // The oldest manual save (seed-0) is the one evicted...
    expect(manualIds).not.toContain('seed-0');
    expect(SaveManager.load('seed-0')).toBeNull();
    // ...and every newer manual save survives.
    for (let i = 1; i < 10; i++) expect(manualIds).toContain(`seed-${i}`);
  });

  it('never evicts the autosave slot, even at the manual cap', async () => {
    seedTenManualSavesPlusAutosave();

    await useStore.getState().saveGame(); // pushes manual count to 11 → one eviction

    // autosave has the oldest timestamp of all; a filter that mistook it for a
    // manual candidate would evict it first. It must remain.
    expect(SaveManager.listSaves().map((s) => s.id)).toContain('autosave');
  });
});

// F-103: a manual save that hits a localStorage throw (QuotaExceededError,
// private browsing, storage disabled) must NOT become an unhandled rejection
// while the UI shows "Game saved". saveGame resolves to a failure signal so the
// caller can surface an error toast. (autoSave already swallows the throw; this
// makes the manual path consistent — and honest.)
describe('metaSlice.saveGame — surfaces a localStorage failure instead of throwing (F-103)', () => {
  it('resolves to { ok: false } (no unhandled rejection) when setItem throws', async () => {
    vi.spyOn(localStorageMock, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const result = await useStore.getState().saveGame();
    expect(result.ok).toBe(false);
  });

  it('reports ok: true on a normal save', async () => {
    const result = await useStore.getState().saveGame();
    expect(result.ok).toBe(true);
    expect(result.evicted).toBe(0);
  });
});
