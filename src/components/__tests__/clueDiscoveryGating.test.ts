/**
 * Unit tests for clue discovery gating — Task 10.1
 *
 * Req 6.2: A Clue requiring a specific Faculty score or prior Deduction
 *          is only discoverable when the requirement is met.
 */
import { describe, it, expect } from 'vitest';
import { canDiscoverClue } from '../../engine/narrativeEngine';
import type { ClueDiscovery, Deduction, GameState, Investigator } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseInvestigator: Investigator = {
  name: 'Elara Voss',
  archetype: 'deductionist',
  faculties: {
    reason: 14,
    perception: 12,
    nerve: 8,
    vigor: 10,
    influence: 10,
    lore: 10,
  },
  composure: 10,
  vitality: 10,
  abilityUsed: false,
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: baseInvestigator,
    currentScene: 'scene-1',
    currentCase: 'case-1',
    clues: {},
    deductions: {},
    npcs: {},
    flags: {},
    factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      textSpeed: 'typewriter',
      hintsEnabled: true,
      autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
    ...overrides,
  };
}

function makeDeduction(id: string): Deduction {
  return { id, clueIds: [], description: '', isRedHerring: false };
}

// ─── requiresFaculty gate ─────────────────────────────────────────────────────

describe('canDiscoverClue — requiresFaculty gate (Req 6.2)', () => {
  const discovery: ClueDiscovery = {
    clueId: 'clue-cipher',
    method: 'check',
    requiresFaculty: { faculty: 'reason', minimum: 14 },
  };

  it('returns false when investigator faculty score is below the minimum', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, reason: 10 },
      },
    });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns false when faculty score is one below the minimum', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, reason: 13 },
      },
    });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns true when faculty score exactly meets the minimum', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, reason: 14 },
      },
    });
    expect(canDiscoverClue(discovery, state)).toBe(true);
  });

  it('returns true when faculty score exceeds the minimum', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, reason: 18 },
      },
    });
    expect(canDiscoverClue(discovery, state)).toBe(true);
  });
});

// ─── requiresDeduction gate ───────────────────────────────────────────────────

describe('canDiscoverClue — requiresDeduction gate (Req 6.2)', () => {
  const discovery: ClueDiscovery = {
    clueId: 'clue-hidden-passage',
    method: 'exploration',
    requiresDeduction: 'deduction-001',
  };

  it('returns false when the required deduction is absent from the store', () => {
    const state = makeState({ deductions: {} });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns false when a different deduction exists but not the required one', () => {
    const state = makeState({
      deductions: { 'deduction-002': makeDeduction('deduction-002') },
    });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns true when the required deduction is present', () => {
    const state = makeState({
      deductions: { 'deduction-001': makeDeduction('deduction-001') },
    });
    expect(canDiscoverClue(discovery, state)).toBe(true);
  });
});

// ─── Both gates together ──────────────────────────────────────────────────────

describe('canDiscoverClue — both gates combined (Req 6.2)', () => {
  const discovery: ClueDiscovery = {
    clueId: 'clue-occult-symbol',
    method: 'dialogue',
    requiresFaculty: { faculty: 'lore', minimum: 12 },
    requiresDeduction: 'deduction-ritual',
  };

  it('returns false when faculty is too low and deduction is absent', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, lore: 8 },
      },
      deductions: {},
    });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns false when faculty meets minimum but deduction is absent', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, lore: 14 },
      },
      deductions: {},
    });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns false when deduction is present but faculty is too low', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, lore: 8 },
      },
      deductions: { 'deduction-ritual': makeDeduction('deduction-ritual') },
    });
    expect(canDiscoverClue(discovery, state)).toBe(false);
  });

  it('returns true when both faculty and deduction requirements are met', () => {
    const state = makeState({
      investigator: {
        ...baseInvestigator,
        faculties: { ...baseInvestigator.faculties, lore: 12 },
      },
      deductions: { 'deduction-ritual': makeDeduction('deduction-ritual') },
    });
    expect(canDiscoverClue(discovery, state)).toBe(true);
  });
});

// ─── No gates ─────────────────────────────────────────────────────────────────

describe('canDiscoverClue — no gates', () => {
  it('returns true for an automatic discovery with no requirements', () => {
    const discovery: ClueDiscovery = {
      clueId: 'clue-footprint',
      method: 'automatic',
    };
    expect(canDiscoverClue(discovery, makeState())).toBe(true);
  });
});
