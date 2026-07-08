/**
 * Tests for npcMemoryFlag condition type.
 */
import { describe, it, expect } from 'vitest';
import { evaluateConditions } from '../narrativeEngine';
import type { Condition, GameState } from '../../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: '', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, flags: {}, factionReputation: {},
    currentScene: '', currentCase: '', sceneHistory: [],
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    npcs: {
      'npc-graves': {
        id: 'npc-graves', name: 'Inspector Graves', faction: 'Rationalists Circle',
        disposition: 2, suspicion: 0, memoryFlags: { 'confided-about-yard': true },
        isAlive: true, isAccessible: true,
      },
    },
    ...overrides,
  };
}

describe('npcMemoryFlag condition', () => {
  it('returns true when memory flag is set', () => {
    const cond: Condition[] = [{ type: 'npcMemoryFlag', target: 'npc-graves', value: 'confided-about-yard' }];
    expect(evaluateConditions(cond, makeState())).toBe(true);
  });

  it('returns false when memory flag is not set', () => {
    const cond: Condition[] = [{ type: 'npcMemoryFlag', target: 'npc-graves', value: 'unknown-flag' }];
    expect(evaluateConditions(cond, makeState())).toBe(false);
  });

  it('returns false when NPC does not exist', () => {
    const cond: Condition[] = [{ type: 'npcMemoryFlag', target: 'npc-nobody', value: 'confided-about-yard' }];
    expect(evaluateConditions(cond, makeState())).toBe(false);
  });
});

// Behavior-lock across the discriminated-union Condition change (F-026). One
// representative condition per variant — the results must be identical before
// and after the type conversion (no runtime behavior change).
describe('evaluateCondition — per-variant behavior lock (F-026)', () => {
  it('facultyMin: passes when score >= value, fails below', () => {
    const state = makeState({
      investigator: {
        name: '', archetype: 'deductionist', abilityUsed: false,
        faculties: { reason: 14, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
        composure: 10, vitality: 10,
      },
    });
    expect(evaluateConditions([{ type: 'facultyMin', target: 'reason', value: 14 }], state)).toBe(true);
    expect(evaluateConditions([{ type: 'facultyMin', target: 'reason', value: 15 }], state)).toBe(false);
  });

  it('archetypeIs: matches the investigator archetype', () => {
    expect(evaluateConditions([{ type: 'archetypeIs', target: 'occultist', value: 'deductionist' }], makeState())).toBe(true);
    expect(evaluateConditions([{ type: 'archetypeIs', target: 'occultist', value: 'occultist' }], makeState())).toBe(false);
  });

  it('npcSuspicion: maps tier names to numeric ranges', () => {
    const normal = makeState();
    expect(evaluateConditions([{ type: 'npcSuspicion', target: 'npc-graves', value: 'normal' }], normal)).toBe(true);
    const concealing = makeState({
      npcs: { 'npc-graves': { id: 'npc-graves', name: 'G', faction: null, disposition: 0, suspicion: 7, memoryFlags: {}, isAlive: true, isAccessible: true } },
    });
    expect(evaluateConditions([{ type: 'npcSuspicion', target: 'npc-graves', value: 'concealing' }], concealing)).toBe(true);
    expect(evaluateConditions([{ type: 'npcSuspicion', target: 'npc-graves', value: 'normal' }], concealing)).toBe(false);
  });

  it('hasFlag: value omitted requires the flag to be truthy', () => {
    expect(evaluateConditions([{ type: 'hasFlag', target: 'g' }], makeState())).toBe(false);
    expect(evaluateConditions([{ type: 'hasFlag', target: 'g' }], makeState({ flags: { g: true } }))).toBe(true);
  });

  it('hasFlag: value:false matches an unset flag', () => {
    expect(evaluateConditions([{ type: 'hasFlag', target: 'g', value: false }], makeState())).toBe(true);
  });

  it('hasClue: passes only when the clue is revealed', () => {
    const state = makeState({
      clues: { c1: { id: 'c1', type: 'physical', title: 'X', description: 'X', sceneSource: 's', tags: [], status: 'new', isRevealed: true } },
    });
    expect(evaluateConditions([{ type: 'hasClue', target: 'c1' }], state)).toBe(true);
    expect(evaluateConditions([{ type: 'hasClue', target: 'c1' }], makeState())).toBe(false);
  });

  it('hasDeduction: passes when the deduction is present', () => {
    const state = makeState({
      deductions: { d1: { id: 'd1', clueIds: [], description: '', isRedHerring: false } },
    });
    expect(evaluateConditions([{ type: 'hasDeduction', target: 'd1' }], state)).toBe(true);
    expect(evaluateConditions([{ type: 'hasDeduction', target: 'd1' }], makeState())).toBe(false);
  });

  it('npcDisposition: passes when disposition >= value', () => {
    const state = makeState({
      npcs: { 'npc-graves': { id: 'npc-graves', name: 'G', faction: null, disposition: 3, suspicion: 0, memoryFlags: {}, isAlive: true, isAccessible: true } },
    });
    expect(evaluateConditions([{ type: 'npcDisposition', target: 'npc-graves', value: 3 }], state)).toBe(true);
    expect(evaluateConditions([{ type: 'npcDisposition', target: 'npc-graves', value: 4 }], state)).toBe(false);
  });

  it('factionReputation: passes when reputation >= value (defaults to 0)', () => {
    expect(evaluateConditions([{ type: 'factionReputation', target: 'Lamplighters', value: 0 }], makeState())).toBe(true);
    expect(evaluateConditions([{ type: 'factionReputation', target: 'Lamplighters', value: 1 }], makeState())).toBe(false);
    const state = makeState({ factionReputation: { Lamplighters: 5 } });
    expect(evaluateConditions([{ type: 'factionReputation', target: 'Lamplighters', value: 5 }], state)).toBe(true);
  });
});
