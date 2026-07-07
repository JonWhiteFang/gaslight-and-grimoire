/**
 * SaveManager save-index title behaviour (F-010, issue #10).
 *
 * The save summary's `caseName` must carry the readable case title when one is
 * supplied, so the Load-game list shows "The Whitechapel Cipher" rather than the
 * raw slug. When no title is supplied it falls back to the slug (currentCase).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../saveManager';
import type { GameState } from '../../types';

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}
const localStorageMock = makeLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

function makeState(): GameState {
  return {
    investigator: {
      name: 'Ada', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    currentScene: 's1', currentCase: 'the-whitechapel-cipher',
    clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
    sceneHistory: [], connections: [], visitedScenes: [],
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
  };
}

beforeEach(() => localStorageMock.clear());

describe('SaveManager.save — readable caseName (F-010)', () => {
  it('stores the supplied title as the summary caseName', () => {
    SaveManager.save('s-title', makeState(), 'The Whitechapel Cipher');
    const summary = SaveManager.listSaves().find((s) => s.id === 's-title');
    expect(summary?.caseName).toBe('The Whitechapel Cipher');
  });

  it('falls back to the slug when no title is supplied', () => {
    SaveManager.save('s-noslug', makeState());
    const summary = SaveManager.listSaves().find((s) => s.id === 's-noslug');
    expect(summary?.caseName).toBe('the-whitechapel-cipher');
  });

  it('does not alter the persisted GameState (title is index-only)', () => {
    SaveManager.save('s-state', makeState(), 'The Whitechapel Cipher');
    const loaded = SaveManager.load('s-state');
    // currentCase remains the slug — the title lives only in the index summary.
    expect(loaded?.currentCase).toBe('the-whitechapel-cipher');
  });
});

describe('SaveManager — connections & visitedScenes round-trip (F-031)', () => {
  it('preserves evidence-board connections through save/load', () => {
    const state = makeState();
    state.connections = [{ fromId: 'c1', toId: 'c2' }, { fromId: 'c3', toId: 'c4' }];
    SaveManager.save('s-conn', state);
    const loaded = SaveManager.load('s-conn');
    expect(loaded?.connections).toEqual([{ fromId: 'c1', toId: 'c2' }, { fromId: 'c3', toId: 'c4' }]);
  });

  it('preserves visitedScenes through save/load', () => {
    const state = makeState();
    state.visitedScenes = ['scene-a', 'scene-b'];
    SaveManager.save('s-visited', state);
    const loaded = SaveManager.load('s-visited');
    expect(loaded?.visitedScenes).toEqual(['scene-a', 'scene-b']);
  });
});
