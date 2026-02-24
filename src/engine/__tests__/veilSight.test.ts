/**
 * Veil Sight Tests — verifies Lore advantage when ability-veil-sight-active flag is set.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Choice, GameState } from '../../types';

const mockPerformCheck = vi.fn();
vi.mock('../diceEngine', () => ({
  performCheck: (...args: unknown[]) => mockPerformCheck(...args),
  rollD20: () => 10,
  resolveDC: (_choice: unknown, _inv: unknown) => 12,
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
}));

import { computeChoiceResult } from '../narrativeEngine';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: '', archetype: 'occultist', abilityUsed: true,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 14 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, npcs: {}, flags: {},
    factionReputation: {}, currentScene: '', currentCase: '', sceneHistory: [],
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    ...overrides,
  };
}

const loreChoice: Choice = {
  id: 'c1', text: 'Use lore', faculty: 'lore', difficulty: 12,
  outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
};

const reasonChoice: Choice = {
  id: 'c2', text: 'Use reason', faculty: 'reason', difficulty: 12,
  outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
};

beforeEach(() => { mockPerformCheck.mockReset(); });

describe('Veil Sight — Lore advantage', () => {
  it('grants advantage on Lore checks when veil-sight flag is active', () => {
    mockPerformCheck.mockReturnValue({ roll: 15, modifier: 2, total: 17, tier: 'success' });
    const state = makeState({ flags: { 'ability-veil-sight-active': true } });
    computeChoiceResult(loreChoice, state);
    expect(mockPerformCheck).toHaveBeenCalledWith('lore', state.investigator, 12, true, false);
  });

  it('does not grant advantage on non-Lore checks when veil-sight flag is active', () => {
    mockPerformCheck.mockReturnValue({ roll: 15, modifier: 0, total: 15, tier: 'success' });
    const state = makeState({ flags: { 'ability-veil-sight-active': true } });
    computeChoiceResult(reasonChoice, state);
    expect(mockPerformCheck).toHaveBeenCalledWith('reason', state.investigator, 12, false, false);
  });

  it('does not grant advantage when veil-sight flag is not set', () => {
    mockPerformCheck.mockReturnValue({ roll: 15, modifier: 2, total: 17, tier: 'success' });
    computeChoiceResult(loreChoice, makeState());
    expect(mockPerformCheck).toHaveBeenCalledWith('lore', expect.anything(), 12, false, false);
  });

  it('combines veil-sight advantage with clue-based advantage', () => {
    mockPerformCheck.mockReturnValue({ roll: 15, modifier: 2, total: 17, tier: 'success' });
    const choice: Choice = { ...loreChoice, advantageIf: ['clue-1'] };
    const state = makeState({
      flags: { 'ability-veil-sight-active': true },
      clues: { 'clue-1': { id: 'clue-1', type: 'occult', status: 'new', title: 'X', description: 'X', sceneSource: 's1', connectsTo: [], tags: [], isRevealed: true } },
    });
    computeChoiceResult(choice, state);
    expect(mockPerformCheck).toHaveBeenCalledWith('lore', state.investigator, 12, true, false);
  });
});
