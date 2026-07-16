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

describe('SaveManager v4 migration — encounterState (F-105)', () => {
  it('defaults encounterState to null for a v3 save', () => {
    const v3State = {
      ...makeV1StateWithoutNewFields(),
      currentScene: 's1',
      sceneHistory: [],
      connections: [],
      visitedScenes: ['s1'],
    };
    const old = { version: 3, timestamp: 't', state: v3State } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);
    expect(migrated.state.encounterState).toBeNull();
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('leaves an existing encounterState untouched', () => {
    const enc = { id: 's1', rounds: [], currentRound: 2, isComplete: false, reactionCheckPassed: true };
    const state = {
      ...makeV1StateWithoutNewFields(),
      currentScene: 's1', sceneHistory: [], connections: [], visitedScenes: ['s1'],
      encounterState: enc,
    };
    const old = { version: 3, timestamp: 't', state } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);
    expect(migrated.state.encounterState).toEqual(enc);
  });
});

describe('SaveManager.migrate — v4 → v5 (clue status normalization)', () => {
  const base = (clues: Record<string, unknown>, deductions: Record<string, unknown> = {}) => ({
    version: 4,
    timestamp: 't',
    state: { ...makeV1StateWithoutNewFields(), clues, deductions, connections: [] },
  });

  it('restores a connected clue REFERENCED by a persisted deduction to deduced', () => {
    const sf = base(
      { c1: { id: 'c1', status: 'connected' } },
      { d: { id: 'd', clueIds: ['c1'], description: '', isRedHerring: false } },
    );
    const out = SaveManager.migrate(sf as unknown as SaveFile);
    expect((out.state.clues as Record<string, { status: string }>).c1.status).toBe('deduced');
  });

  it('maps a connected clue NOT referenced by any deduction to examined', () => {
    const sf = base({ c2: { id: 'c2', status: 'connected' } });
    const out = SaveManager.migrate(sf as unknown as SaveFile);
    expect((out.state.clues as Record<string, { status: string }>).c2.status).toBe('examined');
  });

  it('maps a persisted contested clue to examined on a v4 save', () => {
    const sf = base({ c3: { id: 'c3', status: 'contested' } });
    const out = SaveManager.migrate(sf as unknown as SaveFile);
    expect((out.state.clues as Record<string, { status: string }>).c3.status).toBe('examined');
  });

  it('ALSO normalizes contested→examined on a CURRENT-version (v5) save (Codex Major 4)', () => {
    // migrate() returns early when version === CURRENT, so contested hygiene must run
    // on every load regardless of version — not only inside the v4→v5 step.
    const sf = {
      version: CURRENT_SAVE_VERSION,
      timestamp: 't',
      state: { ...makeV1StateWithoutNewFields(), clues: { c3: { id: 'c3', status: 'contested' } }, deductions: {}, connections: [] },
    };
    const out = SaveManager.migrate(sf as unknown as SaveFile);
    expect((out.state.clues as Record<string, { status: string }>).c3.status).toBe('examined');
  });

  it('is idempotent — migrating an already-migrated file changes nothing further', () => {
    const once = SaveManager.migrate(base(
      { c1: { id: 'c1', status: 'connected' } },
      { d: { id: 'd', clueIds: ['c1'], description: '', isRedHerring: false } },
    ) as unknown as SaveFile);
    const twice = SaveManager.migrate(once as unknown as SaveFile);
    expect((twice.state.clues as Record<string, { status: string }>).c1.status).toBe('deduced');
    expect(twice.version).toBe(5);
  });

  it('stamps the migrated file at the current version', () => {
    expect(SaveManager.migrate(base({}) as unknown as SaveFile).version).toBe(5);
  });
});

describe('SaveManager — chained v0 → current migration (F-031)', () => {
  // A v0 blob predates factionReputation, sceneHistory, connections, and
  // visitedScenes. One migrate() call must walk every step and backfill them all.
  function makeV0State() {
    const base = makeV1StateWithoutNewFields() as Record<string, unknown>;
    delete base.factionReputation; // v0 had no faction reputation
    return { ...base, currentScene: 's2' };
  }

  it('walks v0 → 1 → 2 → 3 → 4 in a single call, backfilling every added field', () => {
    const old = { version: 0, timestamp: 't', state: makeV0State() } as unknown as SaveFile;
    const migrated = SaveManager.migrate(old);

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.state.factionReputation).toEqual({}); // v0 → 1
    expect(migrated.state.sceneHistory).toEqual([]);       // v1 → 2
    expect(migrated.state.connections).toEqual([]);        // v1 → 2
    // v2 → 3: visitedScenes seeded from (empty) sceneHistory + currentScene.
    expect(migrated.state.visitedScenes).toContain('s2');
    expect(migrated.state.encounterState).toBeNull();      // v3 → 4
  });

  it('load() of a v0 blob returns a fully-migrated, non-null state', () => {
    localStorageMock.clear();
    const old = { version: 0, timestamp: 't', state: makeV0State() };
    localStorageMock.setItem('gg_save_v0blob', JSON.stringify(old));
    const loaded = SaveManager.load('v0blob');
    expect(loaded).not.toBeNull();
    expect(loaded!.factionReputation).toEqual({});
    expect(Array.isArray(loaded!.sceneHistory)).toBe(true);
    expect(Array.isArray(loaded!.visitedScenes)).toBe(true);
  });
});

describe('SaveManager — versionless / NaN version save (F-015)', () => {
  // A legacy or hand-edited save may lack a `version` field entirely. Because
  // `undefined < N` is always false, every migration step was silently skipped
  // yet the file got stamped version 3 — leaving factionReputation/sceneHistory/
  // connections/visitedScenes undefined and crashing downstream. A missing/NaN
  // version must be treated as 0 so the full v0 → 3 chain runs.
  function makeVersionlessState() {
    const base = makeV1StateWithoutNewFields() as Record<string, unknown>;
    delete base.factionReputation; // legacy save predates faction reputation
    return { ...base, currentScene: 's', sceneHistory: [] };
  }

  it('migrates a versionless save through all steps (F-015)', () => {
    const legacy = {
      version: undefined as unknown as number,
      timestamp: 1 as unknown as string,
      state: makeVersionlessState(),
    } as unknown as SaveFile;
    const out = SaveManager.migrate(legacy);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(out.state.factionReputation).toEqual({});
    expect(out.state.connections).toEqual([]);
    expect(out.state.visitedScenes).toBeDefined();
  });

  it('migrates a NaN-version save through all steps (F-015)', () => {
    const legacy = {
      version: NaN,
      timestamp: 't',
      state: makeVersionlessState(),
    } as unknown as SaveFile;
    const out = SaveManager.migrate(legacy);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(out.state.factionReputation).toEqual({});
    expect(out.state.connections).toEqual([]);
    expect(out.state.visitedScenes).toBeDefined();
  });
});
