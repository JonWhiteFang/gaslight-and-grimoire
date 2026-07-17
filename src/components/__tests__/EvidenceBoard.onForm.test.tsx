/**
 * EvidenceBoard — KeyDeduction.onForm effects at formation time (Orrery Room §2.8).
 *
 * onForm fires exactly once, when the recipe's deduction is FIRST formed on the
 * board — and never again on repeat formation (the deductions record is the
 * once-guard). Drives the real formation path (DeductionButton → board handler).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';
import type { Clue, ClueConnection, KeyDeduction } from '../../types';

vi.mock('../../engine/hintEngine', () => ({
  trackActivity: vi.fn(),
}));

vi.mock('../../engine/diceEngine', () => ({
  performCheck: vi.fn(() => ({ roll: 10, modifier: 0, total: 10, dc: 14, tier: 'success' })),
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
  isFacultyCheck: (c: any) => c.faculty != null && (c.difficulty !== undefined || c.dynamicDifficulty != null),
}));

vi.mock('../../announcer', () => ({
  announce: vi.fn(),
}));

import { EvidenceBoard } from '../EvidenceBoard';

function initStore(
  clues: Record<string, Clue> = {},
  connections: ClueConnection[] = [],
  recipes: KeyDeduction[] = [],
) {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues,
    deductions: {},
    connections,
    contestedTokens: {}, contestedPrior: {}, attemptSeq: 0,
    currentScene: 's1', currentCase: 'test', sceneHistory: [],
    npcs: {}, flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: recipes.length ? ({ recipes } as never) : null,
    lastCheckResult: null,
  } as never);
}

const clue = (id: string, over: Partial<Clue> = {}): Clue => ({
  id, type: 'physical', title: id.toUpperCase(), description: 'x', sceneSource: 's1',
  connectsTo: [], tags: [], status: 'examined', isRevealed: true, ...over,
});

const recipeWithOnForm: KeyDeduction = {
  id: 'r-mythos', requiredClues: ['a', 'b'], title: 'Pattern', description: 'Named.',
  isRedHerring: false,
  onForm: [{ type: 'flag', target: 'mythos-test-flag', value: true }],
};

beforeEach(() => { vi.clearAllMocks(); });

describe('EvidenceBoard — KeyDeduction.onForm (Orrery Room §2.8)', () => {
  it('applies onForm effects when the recipe deduction is formed', () => {
    initStore(
      { a: clue('a'), b: clue('b') },
      [{ fromId: 'a', toId: 'b' }],
      [recipeWithOnForm],
    );
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));

    const st = useStore.getState();
    expect(st.deductions['r-mythos']).toBeDefined();
    expect(st.flags['mythos-test-flag']).toBe(true);
  });

  it('does not re-apply onForm when the same recipe forms again', () => {
    initStore(
      { a: clue('a'), b: clue('b') },
      [{ fromId: 'a', toId: 'b' }],
      [recipeWithOnForm],
    );
    render(<EvidenceBoard onClose={() => {}} />);
    // First formation: fires onForm.
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(useStore.getState().flags['mythos-test-flag']).toBe(true);

    // Reset the flag out-of-band so a re-fire would be observable.
    useStore.getState().setFlag('mythos-test-flag', false);

    // Reconnect the same clues in the same mounted board and form again.
    fireEvent.click(screen.getByRole('button', { name: /^Clue: A/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Clue: B/i }));
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));

    const st = useStore.getState();
    expect(st.deductions['r-mythos']).toBeDefined();
    // Once-guard held: the deduction already existed, so onForm did NOT re-apply.
    expect(st.flags['mythos-test-flag']).toBe(false);
  });
});
