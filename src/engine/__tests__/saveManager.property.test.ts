/**
 * Property-based tests for the Save/Load system.
 *
 * Property 11: `save` followed by `load` produces a `GameState` deeply equal to the original
 * Validates: Requirements 11.1, 11.7
 *
 * Property 12: `migrate` is idempotent — migrating an already-current save file returns an equivalent file
 * Validates: Requirements 11.3, 11.8
 */

import { describe, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SaveManager, CURRENT_SAVE_VERSION } from '../saveManager';
import type { GameState, SaveFile } from '../../types';

// ─── localStorage mock ────────────────────────────────────────────────────────
// jsdom's localStorage may not be fully available in all vitest environments,
// so we install a simple in-memory mock on globalThis.

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

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbArchetype = fc.constantFrom(
  'deductionist' as const,
  'occultist' as const,
  'operator' as const,
  'mesmerist' as const,
);

const arbFacultyRecord = fc.record({
  reason: fc.integer({ min: 1, max: 20 }),
  perception: fc.integer({ min: 1, max: 20 }),
  nerve: fc.integer({ min: 1, max: 20 }),
  vigor: fc.integer({ min: 1, max: 20 }),
  influence: fc.integer({ min: 1, max: 20 }),
  lore: fc.integer({ min: 1, max: 20 }),
});

const arbInvestigator = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }),
  archetype: arbArchetype,
  faculties: arbFacultyRecord,
  composure: fc.integer({ min: 0, max: 10 }),
  vitality: fc.integer({ min: 0, max: 10 }),
  abilityUsed: fc.boolean(),
});

const arbClueType = fc.constantFrom(
  'physical' as const,
  'testimony' as const,
  'occult' as const,
  'deduction' as const,
  'redHerring' as const,
);

const arbClueStatus = fc.constantFrom(
  'new' as const,
  'examined' as const,
  'connected' as const,
  'deduced' as const,
  'contested' as const,
  'spent' as const,
);

const arbClue = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  type: arbClueType,
  title: fc.string({ minLength: 1, maxLength: 60 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  sceneSource: fc.string({ minLength: 1, maxLength: 20 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  status: arbClueStatus,
  isRevealed: fc.boolean(),
});

const arbDeduction = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  clueIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  isRedHerring: fc.boolean(),
});

const arbNpcState = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  faction: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  disposition: fc.integer({ min: -10, max: 10 }),
  suspicion: fc.integer({ min: 0, max: 10 }),
  memoryFlags: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.boolean(),
    { maxKeys: 5 },
  ),
  isAlive: fc.boolean(),
  isAccessible: fc.boolean(),
});

const arbGameSettings = fc.record({
  fontSize: fc.constantFrom('standard' as const, 'large' as const, 'extraLarge' as const),
  highContrast: fc.boolean(),
  reducedMotion: fc.boolean(),
  textSpeed: fc.constantFrom('typewriter' as const, 'fast' as const, 'instant' as const),
  hintsEnabled: fc.boolean(),
  autoSaveFrequency: fc.constantFrom('choice' as const, 'scene' as const, 'manual' as const),
  audioVolume: fc.record({
    ambient: fc.float({ min: 0, max: 1, noNaN: true }),
    sfx: fc.float({ min: 0, max: 1, noNaN: true }),
  }),
});

/** Generates a unique-keyed record from an arbitrary that produces objects with an `id` field. */
function arbRecord<T extends { id: string }>(
  arbItem: fc.Arbitrary<T>,
  maxItems = 4,
): fc.Arbitrary<Record<string, T>> {
  return fc.array(arbItem, { maxLength: maxItems }).map((items) => {
    const record: Record<string, T> = {};
    items.forEach((item, i) => {
      // Ensure unique keys by appending index
      record[`${item.id}_${i}`] = { ...item, id: `${item.id}_${i}` };
    });
    return record;
  });
}

const arbGameState: fc.Arbitrary<GameState> = fc.record({
  investigator: arbInvestigator,
  currentScene: fc.string({ minLength: 1, maxLength: 30 }),
  currentCase: fc.string({ minLength: 1, maxLength: 30 }),
  clues: arbRecord(arbClue),
  deductions: arbRecord(arbDeduction),
  npcs: arbRecord(arbNpcState),
  flags: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.boolean(),
    { maxKeys: 10 },
  ),
  factionReputation: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: -100, max: 100 }),
    { maxKeys: 6 },
  ),
  sceneHistory: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 20 }),
  settings: arbGameSettings,
});

const arbCurrentSaveFile: fc.Arbitrary<SaveFile> = arbGameState.map((state) => ({
  version: CURRENT_SAVE_VERSION,
  timestamp: new Date().toISOString(),
  state,
}));

// ─── Property 11 ─────────────────────────────────────────────────────────────

describe('Property 11 — save then load produces a GameState deeply equal to the original', () => {
  /**
   * Validates: Requirements 11.1, 11.7
   * For any valid GameState, serialising it with SaveManager.save and then
   * deserialising it with SaveManager.load must return a state that is deeply
   * equal to the original.
   */
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('round-trip preserves the full GameState', () => {
    fc.assert(
      fc.property(arbGameState, (state) => {
        const saveId = 'prop11-test';
        SaveManager.save(saveId, state);
        const loaded = SaveManager.load(saveId);
        return JSON.stringify(loaded) === JSON.stringify(state);
      }),
      { numRuns: 200 },
    );
  });

  it('loaded investigator matches original', () => {
    fc.assert(
      fc.property(arbGameState, (state) => {
        SaveManager.save('prop11-inv', state);
        const loaded = SaveManager.load('prop11-inv');
        return JSON.stringify(loaded?.investigator) === JSON.stringify(state.investigator);
      }),
      { numRuns: 200 },
    );
  });

  it('loaded clues record matches original', () => {
    fc.assert(
      fc.property(arbGameState, (state) => {
        SaveManager.save('prop11-clues', state);
        const loaded = SaveManager.load('prop11-clues');
        return JSON.stringify(loaded?.clues) === JSON.stringify(state.clues);
      }),
      { numRuns: 200 },
    );
  });

  it('loaded flags and factionReputation match original', () => {
    fc.assert(
      fc.property(arbGameState, (state) => {
        SaveManager.save('prop11-flags', state);
        const loaded = SaveManager.load('prop11-flags');
        return (
          JSON.stringify(loaded?.flags) === JSON.stringify(state.flags) &&
          JSON.stringify(loaded?.factionReputation) === JSON.stringify(state.factionReputation)
        );
      }),
      { numRuns: 200 },
    );
  });

  it('load returns null for a non-existent save ID', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (saveId) => {
        // Ensure the key doesn't exist
        localStorage.removeItem(`gg_save_${saveId}`);
        return SaveManager.load(saveId) === null;
      }),
      { numRuns: 50 },
    );
  });
});

// ─── Property 12 ─────────────────────────────────────────────────────────────

describe('Property 12 — migrate is idempotent for current-version save files', () => {
  /**
   * Validates: Requirements 11.3, 11.8
   * Calling migrate twice on a current-version SaveFile must return a file
   * equivalent to calling it once. The version must always equal CURRENT_SAVE_VERSION.
   */
  it('migrating a current-version file twice yields the same result as once', () => {
    fc.assert(
      fc.property(arbCurrentSaveFile, (saveFile) => {
        const once = SaveManager.migrate(saveFile);
        const twice = SaveManager.migrate(once);
        return JSON.stringify(once) === JSON.stringify(twice);
      }),
      { numRuns: 200 },
    );
  });

  it('migrated file always has version === CURRENT_SAVE_VERSION', () => {
    fc.assert(
      fc.property(arbCurrentSaveFile, (saveFile) => {
        const migrated = SaveManager.migrate(saveFile);
        return migrated.version === CURRENT_SAVE_VERSION;
      }),
      { numRuns: 200 },
    );
  });

  it('migrate preserves state when version is already current', () => {
    fc.assert(
      fc.property(arbCurrentSaveFile, (saveFile) => {
        const migrated = SaveManager.migrate(saveFile);
        return JSON.stringify(migrated.state) === JSON.stringify(saveFile.state);
      }),
      { numRuns: 200 },
    );
  });

  it('migrate on a v0 file produces a file with version === CURRENT_SAVE_VERSION', () => {
    fc.assert(
      fc.property(arbGameState, (state) => {
        const v0File: SaveFile = {
          version: 0,
          timestamp: new Date().toISOString(),
          state: { ...state, factionReputation: undefined as unknown as Record<string, number> },
        };
        const migrated = SaveManager.migrate(v0File);
        return (
          migrated.version === CURRENT_SAVE_VERSION &&
          typeof migrated.state.factionReputation === 'object'
        );
      }),
      { numRuns: 100 },
    );
  });
});
