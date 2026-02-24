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
