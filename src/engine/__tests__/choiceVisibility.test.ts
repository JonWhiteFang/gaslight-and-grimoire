import { describe, it, expect } from 'vitest';
import { choiceGateConditions, resolveChoiceVisibility } from '../choiceVisibility';
import type { Choice, GameState } from '../../types';

// Minimal GameState stub: only the fields evaluateConditions reads for these gates.
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      archetype: 'detective',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    },
    clues: {},
    deductions: {},
    flags: {},
    npcs: {},
    factionReputation: {},
    ...overrides,
  } as unknown as GameState;
}

function choice(over: Partial<Choice> = {}): Choice {
  return { id: 'c1', text: 'do it', outcomes: { success: 'sceneA' } as Choice['outcomes'], ...over };
}

describe('choiceGateConditions', () => {
  it('returns [] when no requires* field is set', () => {
    expect(choiceGateConditions(choice())).toEqual([]);
  });

  it('builds one condition per truthy requires* field', () => {
    const c = choice({
      requiresClue: 'clue-1',
      requiresDeduction: 'ded-1',
      requiresFlag: 'flag-1',
      requiresFaculty: { faculty: 'reason', minimum: 12 },
    });
    expect(choiceGateConditions(c)).toEqual([
      { type: 'hasClue', target: 'clue-1' },
      { type: 'hasDeduction', target: 'ded-1' },
      { type: 'hasFlag', target: 'flag-1' },
      { type: 'facultyMin', target: 'reason', value: 12 },
    ]);
  });

  it('treats an empty-string or null requires* as ungated (backward-compat)', () => {
    expect(choiceGateConditions(choice({ requiresFlag: '' }))).toEqual([]);
    expect(choiceGateConditions(choice({ requiresClue: '' }))).toEqual([]);
    expect(choiceGateConditions(choice({ requiresFlag: null as unknown as string }))).toEqual([]);
  });
});

describe('resolveChoiceVisibility', () => {
  const state = makeState();

  it('is shown when there is no gate, regardless of visibility', () => {
    expect(resolveChoiceVisibility(choice(), state)).toBe('shown');
    expect(resolveChoiceVisibility(choice({ visibility: 'disabled' }), state)).toBe('shown');
  });

  it('is shown when the gate is met', () => {
    const withClue = makeState({ clues: { 'clue-1': { id: 'clue-1', isRevealed: true } } as unknown as GameState['clues'] });
    expect(resolveChoiceVisibility(choice({ requiresClue: 'clue-1' }), withClue)).toBe('shown');
  });

  it('is hidden when the gate is unmet and visibility is absent (today default)', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing' }), state)).toBe('hidden');
  });

  it('is hidden when the gate is unmet and visibility === "hidden"', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing', visibility: 'hidden' }), state)).toBe('hidden');
  });

  it('is disabled when the gate is unmet and visibility === "disabled"', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing', visibility: 'disabled', gateReason: 'r' }), state)).toBe('disabled');
  });

  it('is shown when the gate is unmet and visibility === "shown" (soft-gate)', () => {
    expect(resolveChoiceVisibility(choice({ requiresClue: 'missing', visibility: 'shown' }), state)).toBe('shown');
  });
});
