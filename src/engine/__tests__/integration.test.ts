/**
 * Integration tests — choice → navigation → effect pipeline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Choice, GameState, Investigator } from '../../types';
import type { EngineActions } from '../engineActions';

const mockPerformCheck = vi.fn();
vi.mock('../diceEngine', () => ({
  performCheck: (...args: unknown[]) => mockPerformCheck(...args),
  rollD20: () => 10,
  resolveDC: (_c: unknown, _i: unknown) => 12,
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
}));

import { processChoice, evaluateConditions } from '../narrativeEngine';

const mockInvestigator: Investigator = {
  name: 'Test', archetype: 'deductionist', abilityUsed: false,
  faculties: { reason: 12, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
  composure: 10, vitality: 10,
};

// Typed as EngineActions (not `as any`) so a new required action field — or a
// renamed one — fails this test at compile time rather than silently passing (F-028).
const mockActions: EngineActions = {
  goToScene: vi.fn(),
  adjustComposure: vi.fn(),
  adjustVitality: vi.fn(),
  adjustDisposition: vi.fn(),
  adjustSuspicion: vi.fn(),
  setFlag: vi.fn(),
  adjustReputation: vi.fn(),
  discoverClue: vi.fn(),
  updateFaculty: vi.fn(),
  setLastCriticalFaculty: vi.fn(),
  investigator: mockInvestigator,
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 12, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, npcs: {
      'npc-a': { id: 'npc-a', name: 'NPC A', faction: null, disposition: 0, suspicion: 0, memoryFlags: {}, isAlive: true, isAccessible: true },
    },
    flags: {}, factionReputation: {},
    currentScene: 'scene-1', currentCase: 'test', sceneHistory: [],
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Choice → Navigation → Effect pipeline', () => {
  it('processChoice performs check, applies npcEffect, and navigates', () => {
    mockPerformCheck.mockReturnValue({ roll: 15, modifier: 1, total: 16, tier: 'success' });
    const choice: Choice = {
      id: 'c1', text: 'Test', faculty: 'reason', difficulty: 12,
      outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
      npcEffect: { npcId: 'npc-a', dispositionDelta: 2, suspicionDelta: -1 },
    };
    const result = processChoice(choice, makeState(), mockActions);
    expect(result.tier).toBe('success');
    expect(result.nextSceneId).toBe('s-ok');
    expect(mockActions.adjustDisposition).toHaveBeenCalledWith('npc-a', 2);
    expect(mockActions.adjustSuspicion).toHaveBeenCalledWith('npc-a', -1);
    expect(mockActions.goToScene).toHaveBeenCalledWith('s-ok');
  });

  it('processChoice records the critical faculty via the typed setter', () => {
    mockPerformCheck.mockReturnValue({ roll: 20, modifier: 1, total: 21, tier: 'critical' });
    const choice: Choice = {
      id: 'c1', text: 'Test', faculty: 'reason', difficulty: 12,
      outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
    };
    processChoice(choice, makeState(), mockActions);
    expect(mockActions.setLastCriticalFaculty).toHaveBeenCalledWith('reason');
  });

  it('non-check choice navigates to success outcome without dice', () => {
    const choice: Choice = {
      id: 'c1', text: 'Simple', outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
    };
    const result = processChoice(choice, makeState(), mockActions);
    expect(result.tier).toBe('success');
    expect(result.nextSceneId).toBe('s-ok');
    expect(mockPerformCheck).not.toHaveBeenCalled();
  });

  it('non-check choice falls back to critical when success is absent', () => {
    const choice: Choice = {
      id: 'c1', text: 'Simple', outcomes: { critical: 's-crit' } as Choice['outcomes'],
    };
    const result = processChoice(choice, makeState(), mockActions);
    expect(result.nextSceneId).toBe('s-crit');
  });

  it('throws a clear error for a non-check choice missing both success and critical outcomes (F-022)', () => {
    const choice: Choice = {
      id: 'c-broken', text: 'Dead end', outcomes: {} as Choice['outcomes'],
    };
    expect(() => processChoice(choice, makeState(), mockActions)).toThrow(/c-broken/);
    // Must not have navigated to an undefined scene.
    expect(mockActions.goToScene).not.toHaveBeenCalled();
  });
});

describe('Condition gating', () => {
  it('hasClue passes when clue is revealed', () => {
    const state = makeState({
      clues: { 'c1': { id: 'c1', type: 'physical', title: 'X', description: 'X', sceneSource: 's', connectsTo: [], tags: [], status: 'new', isRevealed: true } },
    });
    expect(evaluateConditions([{ type: 'hasClue', target: 'c1' }], state)).toBe(true);
  });

  it('hasClue fails when clue not revealed', () => {
    expect(evaluateConditions([{ type: 'hasClue', target: 'c1' }], makeState())).toBe(false);
  });

  it('npcDisposition gates correctly', () => {
    const state = makeState();
    expect(evaluateConditions([{ type: 'npcDisposition', target: 'npc-a', value: 0 }], state)).toBe(true);
    expect(evaluateConditions([{ type: 'npcDisposition', target: 'npc-a', value: 5 }], state)).toBe(false);
  });

  it('AND logic: all conditions must pass', () => {
    const state = makeState({ flags: { 'test-flag': true } });
    expect(evaluateConditions([
      { type: 'hasFlag', target: 'test-flag' },
      { type: 'npcDisposition', target: 'npc-a', value: 0 },
    ], state)).toBe(true);
    expect(evaluateConditions([
      { type: 'hasFlag', target: 'test-flag' },
      { type: 'npcDisposition', target: 'npc-a', value: 5 },
    ], state)).toBe(false);
  });

  // F-024: `{type:hasFlag, value:false}` is the "flag is not set" gate used by
  // the case-specific breakdown/incapacitation variants. An unset flag is
  // `undefined`, so a strict `undefined === false` never matched — the variants
  // were dead content. hasFlag must compare on truthiness, not identity.
  it('hasFlag value:false matches an unset flag', () => {
    expect(evaluateConditions([{ type: 'hasFlag', target: 'never-set', value: false }], makeState())).toBe(true);
  });

  it('hasFlag value:false matches a flag explicitly set false', () => {
    const state = makeState({ flags: { 'gate': false } });
    expect(evaluateConditions([{ type: 'hasFlag', target: 'gate', value: false }], state)).toBe(true);
  });

  it('hasFlag value:false does NOT match a truthy flag', () => {
    const state = makeState({ flags: { 'gate': true } });
    expect(evaluateConditions([{ type: 'hasFlag', target: 'gate', value: false }], state)).toBe(false);
  });

  it('hasFlag value:true still matches only a truthy flag', () => {
    expect(evaluateConditions([{ type: 'hasFlag', target: 'gate', value: true }], makeState())).toBe(false);
    const set = makeState({ flags: { 'gate': true } });
    expect(evaluateConditions([{ type: 'hasFlag', target: 'gate', value: true }], set)).toBe(true);
  });
});
