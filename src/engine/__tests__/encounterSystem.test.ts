/**
 * Encounter System Tests
 *
 * Tests for startEncounter, processEncounterChoice, and getEncounterChoices.
 * Requirements: 9.1–9.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Choice, EncounterRound, GameState, Investigator } from '../../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the store so we can capture side-effect calls
const mockAdjustComposure = vi.fn();
const mockAdjustVitality = vi.fn();
const mockGoToScene = vi.fn();
const mockAdjustDisposition = vi.fn();
const mockAdjustSuspicion = vi.fn();

vi.mock('../../store', () => ({
  useStore: {
    getState: () => ({
      adjustComposure: mockAdjustComposure,
      adjustVitality: mockAdjustVitality,
      goToScene: mockGoToScene,
      adjustDisposition: mockAdjustDisposition,
      adjustSuspicion: mockAdjustSuspicion,
    }),
  },
}));

// Mock diceEngine so we can control roll outcomes
const mockPerformCheck = vi.fn();
const mockRollD20 = vi.fn();

vi.mock('../diceEngine', () => ({
  performCheck: (...args: unknown[]) => mockPerformCheck(...args),
  rollD20: () => mockRollD20(),
}));

import {
  startEncounter,
  processEncounterChoice,
  getEncounterChoices,
} from '../narrativeEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvestigator(overrides: Partial<Investigator> = {}): Investigator {
  return {
    name: 'Test',
    archetype: 'deductionist',
    faculties: {
      reason: 12,
      perception: 10,
      nerve: 10,
      vigor: 10,
      influence: 10,
      lore: 8,
    },
    composure: 10,
    vitality: 10,
    abilityUsed: false,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: makeInvestigator(),
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

function makeChoice(overrides: Partial<Choice> = {}): Choice {
  return {
    id: 'choice-1',
    text: 'Test choice',
    faculty: 'nerve',
    difficulty: 12,
    outcomes: {
      critical: 'scene-win',
      success: 'scene-win',
      partial: 'scene-partial',
      failure: 'scene-lose',
      fumble: 'scene-lose',
    },
    ...overrides,
  };
}

function makeRound(
  choices: Choice[],
  isSupernatural = false,
  roundNumber = 1,
): EncounterRound {
  return { roundNumber, choices, isSupernatural };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test 1: Reaction_Check failure reduces Composure by 1 or 2 ───────────────

describe('startEncounter — Reaction_Check', () => {
  it('reduces Composure by 1 when Reaction_Check fails and rollD20 returns odd', () => {
    // performCheck returns failure tier → reaction check fails
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 5, modifier: 0, total: 5, dc: 12, natural: 5 });
    // rollD20() % 2 + 1 → 1 % 2 + 1 = 2, but we want 1: use even number
    // rollD20() % 2 + 1: if rollD20 returns 2 → 2%2+1 = 1
    mockRollD20.mockReturnValue(2);

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-1);
  });

  it('reduces Composure by 2 when Reaction_Check fails and rollD20 returns odd', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 5, modifier: 0, total: 5, dc: 12, natural: 5 });
    // rollD20() % 2 + 1: if rollD20 returns 1 → 1%2+1 = 2
    mockRollD20.mockReturnValue(1);

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-2);
  });

  it('does NOT reduce Composure when Reaction_Check succeeds', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state);

    expect(mockAdjustComposure).not.toHaveBeenCalled();
  });

  it('does NOT perform Reaction_Check for mundane encounters', () => {
    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], false)];

    startEncounter('enc-1', rounds, false, state);

    expect(mockPerformCheck).not.toHaveBeenCalled();
    expect(mockAdjustComposure).not.toHaveBeenCalled();
  });

  it('replaces first choice with worseAlternative on Reaction_Check failure', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });
    mockRollD20.mockReturnValue(2); // damage = 1

    const worseChoice = makeChoice({ id: 'worse-choice', text: 'Worse option' });
    const originalChoice = makeChoice({ id: 'original', worseAlternative: worseChoice });
    const state = makeGameState();
    const rounds = [makeRound([originalChoice], true)];

    const encounterState = startEncounter('enc-1', rounds, true, state);

    expect(encounterState.rounds[0].choices[0].id).toBe('worse-choice');
  });

  it('sets reactionCheckPassed to false on failure', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });
    mockRollD20.mockReturnValue(2);

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    const encounterState = startEncounter('enc-1', rounds, true, state);

    expect(encounterState.reactionCheckPassed).toBe(false);
  });

  it('sets reactionCheckPassed to true on success', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    const encounterState = startEncounter('enc-1', rounds, true, state);

    expect(encounterState.reactionCheckPassed).toBe(true);
  });

  it('sets reactionCheckPassed to null for mundane encounters', () => {
    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], false)];

    const encounterState = startEncounter('enc-1', rounds, false, state);

    expect(encounterState.reactionCheckPassed).toBeNull();
  });
});

// ─── Test 2: Supernatural encounter applies dual-axis damage ──────────────────

describe('processEncounterChoice — dual-axis damage', () => {
  it('applies both Composure and Vitality damage on failure in supernatural encounter', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });

    const choice = makeChoice({
      encounterDamage: { composureDelta: -2, vitalityDelta: -1 },
    });
    const round = makeRound([choice], true);
    const encounterState = {
      id: 'enc-1',
      rounds: [round],
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: true,
    };
    const state = makeGameState();

    processEncounterChoice(choice, encounterState, state);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-2);
    expect(mockAdjustVitality).toHaveBeenCalledWith(-1);
  });

  it('applies only Composure damage on failure in mundane encounter', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });

    const choice = makeChoice({
      encounterDamage: { composureDelta: -2, vitalityDelta: -1 },
    });
    const round = makeRound([choice], false); // mundane
    const encounterState = {
      id: 'enc-1',
      rounds: [round],
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: null,
    };
    const state = makeGameState();

    processEncounterChoice(choice, encounterState, state);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-2);
    expect(mockAdjustVitality).not.toHaveBeenCalled();
  });

  it('does NOT apply damage on success', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const choice = makeChoice({
      encounterDamage: { composureDelta: -2, vitalityDelta: -1 },
    });
    const round = makeRound([choice], true);
    const encounterState = {
      id: 'enc-1',
      rounds: [round],
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: true,
    };
    const state = makeGameState();

    processEncounterChoice(choice, encounterState, state);

    expect(mockAdjustComposure).not.toHaveBeenCalled();
    expect(mockAdjustVitality).not.toHaveBeenCalled();
  });

  it('advances currentRound after processing a choice', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const choice = makeChoice();
    const rounds = [makeRound([choice], false, 1), makeRound([choice], false, 2)];
    const encounterState = {
      id: 'enc-1',
      rounds,
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: null,
    };
    const state = makeGameState();

    const { encounterState: updated } = processEncounterChoice(choice, encounterState, state);

    expect(updated.currentRound).toBe(1);
    expect(updated.isComplete).toBe(false);
  });

  it('sets isComplete when last round is processed', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const choice = makeChoice();
    const rounds = [makeRound([choice], false, 1)];
    const encounterState = {
      id: 'enc-1',
      rounds,
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: null,
    };
    const state = makeGameState();

    const { encounterState: updated } = processEncounterChoice(choice, encounterState, state);

    expect(updated.isComplete).toBe(true);
  });
});

// ─── Test 3: Escape path is available when flag condition is met ───────────────

describe('getEncounterChoices — escape path', () => {
  it('includes escape path choice when its flag condition is met', () => {
    const escapeChoice = makeChoice({
      id: 'escape',
      isEscapePath: true,
      requiresFlag: 'found_secret_passage',
    });
    const normalChoice = makeChoice({ id: 'fight' });
    const round = makeRound([normalChoice, escapeChoice], false);

    const state = makeGameState({
      flags: { found_secret_passage: true },
    });

    const choices = getEncounterChoices(round, state);

    expect(choices.some((c) => c.id === 'escape')).toBe(true);
  });

  it('excludes escape path choice when its flag condition is NOT met', () => {
    const escapeChoice = makeChoice({
      id: 'escape',
      isEscapePath: true,
      requiresFlag: 'found_secret_passage',
    });
    const normalChoice = makeChoice({ id: 'fight' });
    const round = makeRound([normalChoice, escapeChoice], false);

    const state = makeGameState({
      flags: {}, // flag not set
    });

    const choices = getEncounterChoices(round, state);

    expect(choices.some((c) => c.id === 'escape')).toBe(false);
  });

  it('includes escape path with no conditions unconditionally', () => {
    const escapeChoice = makeChoice({
      id: 'escape',
      isEscapePath: true,
      // no requiresFlag
    });
    const round = makeRound([escapeChoice], false);
    const state = makeGameState();

    const choices = getEncounterChoices(round, state);

    expect(choices.some((c) => c.id === 'escape')).toBe(true);
  });
});

// ─── Test 4: Occult Fragment clue grants Advantage ────────────────────────────

describe('getEncounterChoices — Occult Fragment advantage', () => {
  it('grants _hasAdvantage when investigator holds a relevant Occult Fragment clue', () => {
    const choice = makeChoice({
      id: 'occult-choice',
      advantageIf: ['clue-occult-1'],
    });
    const round = makeRound([choice], true);

    const state = makeGameState({
      clues: {
        'clue-occult-1': {
          id: 'clue-occult-1',
          type: 'occult',
          title: 'Strange Sigil',
          description: 'A sigil carved in blood.',
          sceneSource: 'scene-1',
          tags: ['occult'],
          status: 'examined',
          isRevealed: true,
        },
      },
    });

    const choices = getEncounterChoices(round, state);
    const found = choices.find((c) => c.id === 'occult-choice');

    expect(found).toBeDefined();
    expect(found?._hasAdvantage).toBe(true);
  });

  it('does NOT grant _hasAdvantage for a non-occult clue', () => {
    const choice = makeChoice({
      id: 'choice-with-physical-clue',
      advantageIf: ['clue-physical-1'],
    });
    const round = makeRound([choice], true);

    const state = makeGameState({
      clues: {
        'clue-physical-1': {
          id: 'clue-physical-1',
          type: 'physical', // not occult
          title: 'Muddy Boot',
          description: 'A muddy boot.',
          sceneSource: 'scene-1',
          tags: ['physical'],
          status: 'examined',
          isRevealed: true,
        },
      },
    });

    const choices = getEncounterChoices(round, state);
    const found = choices.find((c) => c.id === 'choice-with-physical-clue');

    // Choice is still included (standard advantage from any revealed clue)
    // but _hasAdvantage from occult fragment specifically is false
    expect(found).toBeDefined();
    expect(found?._hasAdvantage).toBe(false);
  });

  it('does NOT grant _hasAdvantage when the clue is not revealed', () => {
    const choice = makeChoice({
      id: 'occult-choice',
      advantageIf: ['clue-occult-1'],
    });
    const round = makeRound([choice], true);

    const state = makeGameState({
      clues: {
        'clue-occult-1': {
          id: 'clue-occult-1',
          type: 'occult',
          title: 'Strange Sigil',
          description: 'A sigil carved in blood.',
          sceneSource: 'scene-1',
          tags: ['occult'],
          status: 'new',
          isRevealed: false, // not revealed
        },
      },
    });

    const choices = getEncounterChoices(round, state);
    const found = choices.find((c) => c.id === 'occult-choice');

    expect(found?._hasAdvantage).toBe(false);
  });
});

// ─── Test 5: Round structure and encounter state initialisation ───────────────

describe('startEncounter — state initialisation', () => {
  it('returns correct initial EncounterState structure', () => {
    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], false)];

    const encounterState = startEncounter('enc-test', rounds, false, state);

    expect(encounterState.id).toBe('enc-test');
    expect(encounterState.currentRound).toBe(0);
    expect(encounterState.isComplete).toBe(false);
    expect(encounterState.rounds).toHaveLength(1);
  });
});
