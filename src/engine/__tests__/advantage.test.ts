/**
 * computeAdvantage Tests — single source of truth for whether a faculty check
 * rolls with advantage (revealed advantageIf clue OR Lore + Veil Sight active).
 */
import { describe, it, expect } from 'vitest';
import { computeAdvantage } from '../advantage';
import type { Choice, Clue, GameState } from '../../types';

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

function revealedClue(id: string): Clue {
  return { id, type: 'physical', status: 'new', title: 'X', description: 'X', sceneSource: 's1', connectsTo: [], tags: [], isRevealed: true };
}

const perceptionChoice: Choice = {
  id: 'c1', text: 'Look', faculty: 'perception', difficulty: 12,
  outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
};

const loreChoice: Choice = {
  id: 'c2', text: 'Use lore', faculty: 'lore', difficulty: 12,
  outcomes: { critical: 's-crit', success: 's-ok', partial: 's-part', failure: 's-fail', fumble: 's-fumble' },
};

describe('computeAdvantage', () => {
  it('grants advantage from a revealed advantageIf clue', () => {
    const choice: Choice = { ...perceptionChoice, advantageIf: ['clue-1'] };
    const state = makeState({ clues: { 'clue-1': revealedClue('clue-1') } });
    expect(computeAdvantage(choice, state)).toBe(true);
  });

  it('grants advantage for a lore check with veil sight active and no clue', () => {
    const state = makeState({ flags: { 'ability-veil-sight-active': true } });
    expect(computeAdvantage(loreChoice, state)).toBe(true);
  });

  it('no advantage for a non-lore check with no revealed clue', () => {
    expect(computeAdvantage(perceptionChoice, makeState())).toBe(false);
  });

  it('no advantage for a lore check when veil sight is NOT active', () => {
    expect(computeAdvantage(loreChoice, makeState())).toBe(false);
  });
});
