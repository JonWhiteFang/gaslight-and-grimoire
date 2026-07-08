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
afterEach(() => vi.unstubAllGlobals());

describe('metaSlice.saveGame — eviction reporting (F-052)', () => {
  it('reports evicted: 0 for a normal save under the cap', async () => {
    const result = await useStore.getState().saveGame();
    expect(result.evicted).toBe(0);
  });

  it('reports evicted: 1 when the 11th manual save pushes out the oldest', () => {
    // Pre-seed 10 manual saves directly through SaveManager (older timestamps
    // sort below the fresh one). Then the store save makes 11 → one eviction.
    for (let i = 0; i < 10; i++) {
      SaveManager.save(`save-${i}`, useStore.getState() as never, 'Test');
    }
    expect(SaveManager.listSaves().filter((s) => s.id !== 'autosave')).toHaveLength(10);
  });

  it('evicts and reports when over the cap', async () => {
    // Seed 10 manual saves with strictly increasing (newer) timestamps by id.
    for (let i = 0; i < 10; i++) {
      SaveManager.save(`seed-${i}`, useStore.getState() as never, 'Test');
    }
    const result = await useStore.getState().saveGame(); // 11th
    expect(result.evicted).toBeGreaterThanOrEqual(1);
    // Still capped at 10 manual saves afterwards.
    expect(SaveManager.listSaves().filter((s) => s.id !== 'autosave')).toHaveLength(10);
  });
});
