/**
 * Unit tests for the v1 -> v2 save migration.
 *
 * v2 backfills fields added after v1 was released:
 *   - sceneHistory (added in E7) — absence crashes goToScene's .push on load
 *   - connections  (evidence-board threads) — persisted from v2 onward
 */
import { describe, it, expect, vi } from 'vitest';
import { SaveManager, CURRENT_SAVE_VERSION } from '../saveManager';
import type { SaveFile } from '../../types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

function makeV1StateWithoutNewFields() {
  // A state object as serialised by v1, before sceneHistory/connections existed.
  return {
    investigator: {
      name: 'Holmes', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    },
    currentScene: 's1',
    currentCase: 'the-whitechapel-cipher',
    clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
    settings: {
      fontSize: 'standard', highContrast: false, reducedMotion: false,
      textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.6, sfx: 0.8 },
    },
    // note: no sceneHistory, no connections
  };
}

describe('SaveManager v2 migration', () => {
  it('CURRENT_SAVE_VERSION is at least 2', () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('backfills sceneHistory to [] for a pre-sceneHistory save', () => {
    const old = { version: 1, timestamp: 't', state: makeV1StateWithoutNewFields() } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);
    expect(migrated.state.sceneHistory).toEqual([]);
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('backfills connections to [] for a pre-connections save', () => {
    const old = { version: 1, timestamp: 't', state: makeV1StateWithoutNewFields() } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);
    expect(migrated.state.connections).toEqual([]);
  });

  it('load() of a v1 blob yields a defined sceneHistory (no crash on goToScene.push)', () => {
    localStorageMock.clear();
    const old = { version: 1, timestamp: 't', state: makeV1StateWithoutNewFields() };
    localStorageMock.setItem('gg_save_oldsave', JSON.stringify(old));
    const loaded = SaveManager.load('oldsave');
    expect(loaded).not.toBeNull();
    expect(Array.isArray(loaded!.sceneHistory)).toBe(true);
  });
});

describe('SaveManager v3 migration — visitedScenes', () => {
  it('backfills visitedScenes from sceneHistory + currentScene for a v2 save (F-006)', () => {
    // A v2 state: has sceneHistory/connections but no visitedScenes yet.
    const v2State = {
      ...makeV1StateWithoutNewFields(),
      currentScene: 's3',
      sceneHistory: ['s1', 's2'],
      connections: [],
    };
    const old = { version: 2, timestamp: 't', state: v2State } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);
    // Everything the player has already seen must count as visited, so reloading
    // an old save does not re-fire onEnter on scenes they already passed through.
    expect(migrated.state.visitedScenes).toEqual(expect.arrayContaining(['s1', 's2', 's3']));
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('leaves an existing visitedScenes array untouched', () => {
    const state = {
      ...makeV1StateWithoutNewFields(),
      currentScene: 's3',
      sceneHistory: ['s1', 's2'],
      connections: [],
      visitedScenes: ['s1'],
    };
    const old = { version: 2, timestamp: 't', state } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);
    expect(migrated.state.visitedScenes).toEqual(['s1']);
  });
});
