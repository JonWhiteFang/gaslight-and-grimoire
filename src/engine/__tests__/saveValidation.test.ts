/**
 * Tests for save-shape validation on load (F-036).
 *
 * `SaveManager.load` used to `JSON.parse` a blob and hand its `.state` straight
 * to the store. A truncated / malformed / hand-edited save (missing
 * `investigator`, `clues` not an object, `state` not an object, …) would then be
 * written wholesale into the store and crash rendering. Load must reject a
 * structurally-invalid save (return `null`) instead of committing garbage.
 */
import { describe, it, expect, vi } from 'vitest';
import { SaveManager, isValidGameState } from '../saveManager';

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

/** A minimal well-formed GameState (migration backfills the optional fields). */
function validState() {
  return {
    investigator: {
      name: 'Holmes', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    },
    currentScene: 's1',
    currentCase: 'the-whitechapel-cipher',
    clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard', highContrast: false, reducedMotion: false,
      textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.6, sfx: 0.8 },
    },
  };
}

describe('isValidGameState', () => {
  it('accepts a well-formed state', () => {
    expect(isValidGameState(validState())).toBe(true);
  });

  it.each([
    ['null', null],
    ['a non-object', 42],
    ['an array', []],
    ['missing investigator', (() => { const s = validState() as Record<string, unknown>; delete s.investigator; return s; })()],
    ['investigator without faculties', { ...validState(), investigator: { name: 'X', archetype: 'operator' } }],
    ['currentScene not a string', { ...validState(), currentScene: 123 }],
    ['currentCase not a string', { ...validState(), currentCase: null }],
    ['clues not an object', { ...validState(), clues: 'nope' }],
    ['npcs missing', (() => { const s = validState() as Record<string, unknown>; delete s.npcs; return s; })()],
    ['settings missing', (() => { const s = validState() as Record<string, unknown>; delete s.settings; return s; })()],
  ])('rejects %s', (_label, bad) => {
    expect(isValidGameState(bad)).toBe(false);
  });
});

describe('SaveManager.load — rejects structurally-invalid saves (F-036)', () => {
  it('returns null for a save whose state is missing required fields', () => {
    localStorageMock.clear();
    localStorageMock.setItem('gg_save_bad', JSON.stringify({ version: 3, timestamp: 't', state: { foo: 1 } }));
    expect(SaveManager.load('bad')).toBeNull();
  });

  it('returns null for a save file that is not even an object', () => {
    localStorageMock.clear();
    localStorageMock.setItem('gg_save_scalar', JSON.stringify('just a string'));
    expect(SaveManager.load('scalar')).toBeNull();
  });

  it('returns null when clues is the wrong type', () => {
    localStorageMock.clear();
    const blob = { version: 3, timestamp: 't', state: { ...validState(), clues: [] } };
    localStorageMock.setItem('gg_save_wrongtype', JSON.stringify(blob));
    expect(SaveManager.load('wrongtype')).toBeNull();
  });

  it('still loads a valid save', () => {
    localStorageMock.clear();
    localStorageMock.setItem('gg_save_ok', JSON.stringify({ version: 3, timestamp: 't', state: validState() }));
    const loaded = SaveManager.load('ok');
    expect(loaded).not.toBeNull();
    expect(loaded!.currentScene).toBe('s1');
  });
});
