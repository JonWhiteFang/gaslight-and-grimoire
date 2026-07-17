/**
 * Encounter System Tests
 *
 * Tests for startEncounter, processEncounterChoice, and getEncounterChoices.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Choice, Clue, EncounterRound, GameState, Investigator } from '../../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock actions passed to engine functions
const mockAdjustComposure = vi.fn();
const mockAdjustVitality = vi.fn();
const mockGoToScene = vi.fn();
const mockAdjustDisposition = vi.fn();
const mockAdjustSuspicion = vi.fn();
const mockSetFlag = vi.fn();

const mockActions = {
  adjustComposure: mockAdjustComposure,
  adjustVitality: mockAdjustVitality,
  goToScene: mockGoToScene,
  adjustDisposition: mockAdjustDisposition,
  adjustSuspicion: mockAdjustSuspicion,
  setFlag: mockSetFlag,
  adjustReputation: vi.fn(),
  discoverClue: vi.fn(),
  updateFaculty: vi.fn(),
  setLastCriticalFaculty: vi.fn(),
  investigator: { name: '', archetype: 'deductionist' as const, faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 }, composure: 10, vitality: 10, abilityUsed: false },
} as any;

// Mock diceEngine so we can control roll outcomes
const mockPerformCheck = vi.fn();
const mockRollD20 = vi.fn();

vi.mock('../diceEngine', () => ({
  performCheck: (...args: unknown[]) => mockPerformCheck(...args),
  rollD20: () => mockRollD20(),
  // resolveDC is consulted once encounters route checks through the shared
  // computeChoiceResult unit (F-107). Faithful enough for these tests: honour
  // dynamicDifficulty's baseDC, else the fixed difficulty.
  resolveDC: (c: any) => (c.dynamicDifficulty ? c.dynamicDifficulty.baseDC : (c.difficulty ?? 12)),
  isFacultyCheck: (c: any) => c.faculty != null && (c.difficulty !== undefined || c.dynamicDifficulty != null),
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

    startEncounter('enc-1', rounds, true, state, mockActions);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-1);
  });

  it('reduces Composure by 2 when Reaction_Check fails and rollD20 returns odd', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 5, modifier: 0, total: 5, dc: 12, natural: 5 });
    // rollD20() % 2 + 1: if rollD20 returns 1 → 1%2+1 = 2
    mockRollD20.mockReturnValue(1);

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state, mockActions);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-2);
  });

  it('does NOT reduce Composure when Reaction_Check succeeds', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state, mockActions);

    expect(mockAdjustComposure).not.toHaveBeenCalled();
  });

  it('does NOT perform Reaction_Check for mundane encounters', () => {
    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], false)];

    startEncounter('enc-1', rounds, false, state, mockActions);

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

    const encounterState = startEncounter('enc-1', rounds, true, state, mockActions);

    expect(encounterState.rounds[0].choices[0].id).toBe('worse-choice');
  });

  it('sets reactionCheckPassed to false on failure', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });
    mockRollD20.mockReturnValue(2);

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    const encounterState = startEncounter('enc-1', rounds, true, state, mockActions);

    expect(encounterState.reactionCheckPassed).toBe(false);
  });

  it('sets reactionCheckPassed to true on success', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });

    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], true)];

    const encounterState = startEncounter('enc-1', rounds, true, state, mockActions);

    expect(encounterState.reactionCheckPassed).toBe(true);
  });

  it('sets reactionCheckPassed to null for mundane encounters', () => {
    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], false)];

    const encounterState = startEncounter('enc-1', rounds, false, state, mockActions);

    expect(encounterState.reactionCheckPassed).toBeNull();
  });

  // F-114: the reaction faculty is `nerve >= lore ? nerve : lore`, so on a TIE it
  // must resolve to Nerve. Nothing asserted which faculty was checked at the
  // boundary, so flipping the tiebreak (>= → >) survived the suite.
  it('checks NERVE (not Lore) when nerve and lore scores are tied', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });
    const state = makeGameState({ investigator: makeInvestigator({ faculties: { reason: 10, perception: 10, nerve: 11, vigor: 10, influence: 10, lore: 11 } }) });
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state, mockActions);

    // performCheck(faculty, investigator, dc, hasAdvantage, hasDisadvantage)
    expect(mockPerformCheck.mock.calls[0][0]).toBe('nerve');
  });

  it('checks LORE when lore strictly exceeds nerve', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });
    const state = makeGameState({ investigator: makeInvestigator({ faculties: { reason: 10, perception: 10, nerve: 8, vigor: 10, influence: 10, lore: 14 } }) });
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state, mockActions);

    expect(mockPerformCheck.mock.calls[0][0]).toBe('lore');
  });

  it('checks NERVE when nerve strictly exceeds lore', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });
    const state = makeGameState({ investigator: makeInvestigator({ faculties: { reason: 10, perception: 10, nerve: 14, vigor: 10, influence: 10, lore: 8 } }) });
    const rounds = [makeRound([makeChoice()], true)];

    startEncounter('enc-1', rounds, true, state, mockActions);

    expect(mockPerformCheck.mock.calls[0][0]).toBe('nerve');
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

    processEncounterChoice(choice, encounterState, state, mockActions);

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

    processEncounterChoice(choice, encounterState, state, mockActions);

    expect(mockAdjustComposure).toHaveBeenCalledWith(-2);
    expect(mockAdjustVitality).not.toHaveBeenCalled();
  });

  // Mundane single-axis damage: the `else if (vitalityDelta !== undefined)`
  // branch (encounters.ts) — a mundane choice carrying ONLY vitality damage must
  // apply it. Only the composure-only mundane path was covered, so deleting the
  // `else if` (or its guard) survived the suite.
  it('applies only Vitality damage on failure in a mundane encounter with vitality-only damage', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });

    const choice = makeChoice({
      encounterDamage: { vitalityDelta: -2 }, // no composureDelta
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

    processEncounterChoice(choice, encounterState, state, mockActions);

    expect(mockAdjustVitality).toHaveBeenCalledWith(-2);
    expect(mockAdjustComposure).not.toHaveBeenCalled();
  });

  // Guards the mundane `else` exclusivity: when BOTH deltas are present in a
  // mundane encounter, only composure is applied (composure takes precedence;
  // vitality is NOT also applied). This is the flip side of the vitality-only
  // test — together they pin the single-axis rule.
  it('applies ONLY composure (never vitality) when a mundane choice carries both deltas', () => {
    mockPerformCheck.mockReturnValue({ tier: 'failure', roll: 3, modifier: 0, total: 3, dc: 12, natural: 3 });

    const choice = makeChoice({
      encounterDamage: { composureDelta: -2, vitalityDelta: -3 },
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

    processEncounterChoice(choice, encounterState, state, mockActions);

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

    processEncounterChoice(choice, encounterState, state, mockActions);

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

    const { encounterState: updated } = processEncounterChoice(choice, encounterState, state, mockActions);

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

    const { encounterState: updated } = processEncounterChoice(choice, encounterState, state, mockActions);

    expect(updated.isComplete).toBe(true);
  });
});

// ─── Test 2a: Guard undefined navigation in non-check branch (F-022) ───────────

describe('processEncounterChoice — undefined navigation guard (F-022)', () => {
  it('throws when a non-check choice has no success/critical outcome', () => {
    // A non-escape choice with no faculty/difficulty AND no success/critical
    // outcome would otherwise assign nextSceneId = undefined and later crash
    // resolveScene with an opaque error. Guard fails loudly at the source.
    const malformedChoice = makeChoice({
      id: 'no-destination',
      faculty: undefined,
      difficulty: undefined,
      // Malformed content: no success/critical destination for a non-check choice.
      outcomes: {
        partial: 'scene-partial',
        failure: 'scene-lose',
        fumble: 'scene-lose',
      } as any,
    });
    const round = makeRound([malformedChoice], false);
    const encounterState = {
      id: 'enc-1',
      rounds: [round],
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: null,
    };
    const state = makeGameState();

    expect(() =>
      processEncounterChoice(malformedChoice, encounterState, state, mockActions),
    ).toThrow(/nowhere to navigate/i);
  });
});

// ─── Test 2b: Escape path terminates the encounter immediately (F-004) ─────────

describe('processEncounterChoice — escape path is terminal', () => {
  it('navigates to the escape outcome and completes the encounter in a non-final round', () => {
    // An escape choice has no faculty/difficulty; its outcome is fixed.
    const escapeChoice = makeChoice({
      id: 'escape',
      faculty: undefined,
      difficulty: undefined,
      isEscapePath: true,
      outcomes: {
        critical: 'scene-escaped',
        success: 'scene-escaped',
        partial: 'scene-escaped',
        failure: 'scene-escaped',
        fumble: 'scene-escaped',
      },
    });
    // Two rounds: escaping in round 0 must NOT advance to round 1.
    const rounds = [
      makeRound([escapeChoice], false, 1),
      makeRound([makeChoice()], false, 2),
    ];
    const encounterState = {
      id: 'enc-1',
      rounds,
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: null,
    };
    const state = makeGameState();

    const { encounterState: updated } = processEncounterChoice(escapeChoice, encounterState, state, mockActions);

    expect(updated.isComplete).toBe(true);
    expect(mockGoToScene).toHaveBeenCalledWith('scene-escaped');
  });

  it('does not apply encounter damage when escaping (escape is not a failed round)', () => {
    const escapeChoice = makeChoice({
      id: 'escape',
      faculty: undefined,
      difficulty: undefined,
      isEscapePath: true,
      encounterDamage: { composureDelta: -3, vitalityDelta: -3 },
      outcomes: {
        critical: 'scene-escaped',
        success: 'scene-escaped',
        partial: 'scene-escaped',
        failure: 'scene-escaped',
        fumble: 'scene-escaped',
      },
    });
    const rounds = [
      makeRound([escapeChoice], true, 1),
      makeRound([makeChoice()], true, 2),
    ];
    const encounterState = {
      id: 'enc-1',
      rounds,
      currentRound: 0,
      isComplete: false,
      reactionCheckPassed: true,
    };
    const state = makeGameState();

    processEncounterChoice(escapeChoice, encounterState, state, mockActions);

    expect(mockAdjustComposure).not.toHaveBeenCalled();
    expect(mockAdjustVitality).not.toHaveBeenCalled();
  });
});

// ─── Test 2c: Archetype auto-succeed ability works (once) in encounters (F-107) ─
//
// The mirror of F-101: encounters ran their own check pipeline that ignored the
// ability-auto-succeed flag entirely, so a Deductionist/Operator/Mesmerist got no
// effect from their ability on an encounter check of their primary faculty. After
// routing through the shared unit, the ability auto-crits once and is consumed.

describe('processEncounterChoice — ability auto-succeed (F-107)', () => {
  it('auto-succeeds a same-faculty encounter check without rolling, and consumes the flag', () => {
    const choice = makeChoice({ id: 'vigor-check', faculty: 'vigor', difficulty: 18 });
    const round = makeRound([choice], false);
    const encounterState = {
      id: 'enc-1', rounds: [round], currentRound: 0, isComplete: false, reactionCheckPassed: null,
    };
    const state = makeGameState({ flags: { 'ability-auto-succeed-vigor': true } });

    const { result } = processEncounterChoice(choice, encounterState, state, mockActions);

    expect(result.tier).toBe('critical');
    expect(mockPerformCheck).not.toHaveBeenCalled();
    expect(mockSetFlag).toHaveBeenCalledWith('ability-auto-succeed-vigor', false);
  });

  it('honours dynamicDifficulty in encounter checks (previously ignored)', () => {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 10, natural: 15 });
    const choice = makeChoice({
      id: 'dyn-check', faculty: 'nerve', difficulty: undefined,
      dynamicDifficulty: { baseDC: 10, scaleFaculty: 'nerve', highThreshold: 14, highDC: 16 },
    });
    const round = makeRound([choice], false);
    const encounterState = {
      id: 'enc-1', rounds: [round], currentRound: 0, isComplete: false, reactionCheckPassed: null,
    };
    const state = makeGameState();

    processEncounterChoice(choice, encounterState, state, mockActions);

    // Fourth arg is the DC — resolveDC(baseDC) = 10, not the old undefined→non-check path.
    expect(mockPerformCheck).toHaveBeenCalledWith('nerve', state.investigator, 10, false, false);
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

// ─── Phase 5: visibility-aware filtering ──────────────────────────────────────

describe('getEncounterChoices — Phase 5 visibility', () => {
  it('includes a non-escape disabled choice (gate unmet, visibility disabled)', () => {
    const round = makeRound([
      makeChoice({ id: 'a', text: 'fight' }),
      makeChoice({
        id: 'b',
        text: 'ritual',
        requiresClue: 'missing',
        visibility: 'disabled',
        gateReason: 'r',
      }),
    ]);
    const state = makeGameState(); // empty clues -> 'missing' is unmet

    const ids = getEncounterChoices(round, state).map((c) => c.id);

    expect(ids).toContain('a');
    expect(ids).toContain('b'); // disabled, but returned so the panel can grey it
  });

  it('keeps an escape path hard-gated (excluded when its gate is unmet)', () => {
    const round = makeRound([
      makeChoice({ id: 'esc', text: 'flee', isEscapePath: true, requiresFlag: 'has-exit' }),
    ]);
    const state = makeGameState(); // has-exit flag not set

    expect(getEncounterChoices(round, state).map((c) => c.id)).not.toContain('esc');
  });

  it('drops a non-escape gated choice with default (absent) visibility', () => {
    const round = makeRound([
      makeChoice({ id: 'h', text: 'hidden ritual', requiresClue: 'missing' }), // no visibility field
    ]);
    const state = makeGameState(); // empty clues -> gate unmet -> hidden

    expect(getEncounterChoices(round, state).map((c) => c.id)).not.toContain('h');
  });

  // The validator forbids visibility/gateReason on escape paths, but the engine's
  // "escape paths are never disabled" claim deserves its own pin (defense in depth).
  it('excludes an escape path with unmet gate even if it (invalidly) sets visibility disabled', () => {
    const round = makeRound([
      makeChoice({
        id: 'esc-bad',
        text: 'flee',
        isEscapePath: true,
        requiresFlag: 'has-exit',
        visibility: 'disabled',
        gateReason: 'r',
      }),
    ]);
    const state = makeGameState(); // has-exit flag not set

    expect(getEncounterChoices(round, state).map((c) => c.id)).not.toContain('esc-bad');
  });
});

// ─── Test 4: Revealed advantage clue grants Advantage on the roll ─────────────
//
// Advantage is applied where it actually matters — the roll in
// processEncounterChoice (the 4th arg to performCheck). getEncounterChoices no
// longer annotates a `_hasAdvantage` field (it had no consumer; F-027).

describe('processEncounterChoice — advantage on the roll', () => {
  const occultClue: Clue = {
    id: 'clue-occult-1', type: 'occult', title: 'Strange Sigil',
    description: 'A sigil carved in blood.', sceneSource: 'scene-1',
    tags: ['occult'], status: 'examined', isRevealed: true,
  };

  function runWithClue(clue: Clue | null, advantageIf: string[]): boolean {
    mockPerformCheck.mockReturnValue({ tier: 'success', roll: 15, modifier: 0, total: 15, dc: 12, natural: 15 });
    const choice = makeChoice({ id: 'adv-choice', advantageIf });
    const round = makeRound([choice], true);
    const encounterState = { id: 'enc-1', rounds: [round], currentRound: 0, isComplete: false, reactionCheckPassed: true };
    const state = makeGameState({ clues: clue ? { [clue.id]: clue } : {} });
    processEncounterChoice(choice, encounterState, state, mockActions);
    // performCheck(faculty, investigator, dc, hasAdvantage, hasDisadvantage)
    return mockPerformCheck.mock.calls[0][3] as boolean;
  }

  it('rolls with advantage when a relevant revealed Occult Fragment is held', () => {
    expect(runWithClue(occultClue, ['clue-occult-1'])).toBe(true);
  });

  it('rolls with advantage for any revealed advantageIf clue (standard advantage)', () => {
    const physicalClue = { ...occultClue, id: 'clue-physical-1', type: 'physical' as const };
    expect(runWithClue(physicalClue, ['clue-physical-1'])).toBe(true);
  });

  it('does NOT roll with advantage when the advantage clue is not revealed', () => {
    const hiddenClue = { ...occultClue, status: 'new' as const, isRevealed: false };
    expect(runWithClue(hiddenClue, ['clue-occult-1'])).toBe(false);
  });

  it('does NOT roll with advantage when no advantage clue is present', () => {
    expect(runWithClue(null, ['clue-occult-1'])).toBe(false);
  });
});

// ─── Test 5: Round structure and encounter state initialisation ───────────────

describe('startEncounter — state initialisation', () => {
  it('returns correct initial EncounterState structure', () => {
    const state = makeGameState();
    const rounds = [makeRound([makeChoice()], false)];

    const encounterState = startEncounter('enc-test', rounds, false, state, mockActions);

    expect(encounterState.id).toBe('enc-test');
    expect(encounterState.currentRound).toBe(0);
    expect(encounterState.isComplete).toBe(false);
    expect(encounterState.rounds).toHaveLength(1);
  });
});
