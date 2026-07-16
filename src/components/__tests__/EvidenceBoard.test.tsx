/**
 * EvidenceBoard component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useStore } from '../../store';
import type { Clue, ClueConnection, KeyDeduction } from '../../types';

vi.mock('../../engine/hintEngine', () => ({
  trackActivity: vi.fn(),
}));

vi.mock('../../engine/diceEngine', () => ({
  performCheck: vi.fn(() => ({ roll: 10, modifier: 0, total: 10, tier: 'success' })),
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
}));

vi.mock('../../announcer', () => ({
  announce: vi.fn(),
}));

import { EvidenceBoard } from '../EvidenceBoard';
import { announce } from '../../announcer';
import { performCheck } from '../../engine/diceEngine';

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

const sampleClues: Record<string, Clue> = {
  c1: clue('c1', { title: 'Cipher Note', connectsTo: ['c2'], tags: ['paper'] }),
  c2: clue('c2', { type: 'testimony', title: 'Witness Account', connectsTo: ['c1'], tags: ['paper'] }),
  c3: clue('c3', { title: 'Hidden Clue', isRevealed: false }),
};

beforeEach(() => { vi.clearAllMocks(); });

describe('EvidenceBoard', () => {
  it('renders revealed clues as cards', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    expect(screen.getByText('Cipher Note')).toBeTruthy();
    expect(screen.getByText('Witness Account')).toBeTruthy();
    expect(screen.queryByText('Hidden Clue')).toBeNull();
  });

  it('shows empty message when no clues discovered', () => {
    initStore({});
    render(<EvidenceBoard onClose={() => {}} />);
    expect(screen.getByText(/no clues discovered/i)).toBeTruthy();
  });

  it('Escape key closes the board', () => {
    initStore(sampleClues);
    const onClose = vi.fn();
    render(<EvidenceBoard onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('has accessible dialog role', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows a persistent connection hint when the board opens with clues and no connection in progress', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    expect(screen.getByText(/select two clues to connect/i)).toBeTruthy();
  });

  it('does not show the connect hint when there are no clues', () => {
    initStore({});
    render(<EvidenceBoard onClose={() => {}} />);
    expect(screen.queryByText(/select two clues to connect/i)).toBeNull();
  });

  it('clicking two clue cards connects them and writes NO connected status (N1)', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Cipher Note/i }));
    fireEvent.click(screen.getByRole('button', { name: /Witness Account/i }));

    const state = useStore.getState();
    expect(state.connections).toContainEqual({ fromId: 'c1', toId: 'c2' });
    // Status stays semantic — the connected cue is derived, not stored (N1).
    expect(state.clues.c1.status).toBe('examined');
    expect(state.clues.c2.status).toBe('examined');
    // Both cards render the derived Connected cue.
    expect(screen.getAllByLabelText('Connected')).toHaveLength(2);
  });

  it('clicking the same card twice cancels the pending connection', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    const first = screen.getByRole('button', { name: /Cipher Note/i });
    fireEvent.click(first);
    fireEvent.click(first);
    expect(useStore.getState().connections).toHaveLength(0);
  });

  it('moves focus inside the dialog on open', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('EvidenceBoard — oracle-driven formation (Phase 2b, ADR-0012)', () => {
  const recipePair: Record<string, Clue> = {
    a: clue('a'), b: clue('b'),
  };
  const recipe: KeyDeduction = { id: 'r1', requiredClues: ['a', 'b'], title: 'R', description: 'R desc', isRedHerring: false };

  function attempt(tier: string, clues: Record<string, Clue>, connections: ClueConnection[], recipes: KeyDeduction[] = []) {
    (performCheck as ReturnType<typeof vi.fn>).mockReturnValue({ roll: 10, modifier: 0, total: 10, dc: 14, tier });
    initStore(clues, connections, recipes);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
  }

  it('CONFIRMATION: a recipe-matching component forms its deduction on a FAILURE roll', () => {
    attempt('failure', recipePair, [{ fromId: 'a', toId: 'b' }], [recipe]);
    const st = useStore.getState();
    expect(st.deductions.r1).toBeDefined(); // formed despite the failure roll
    expect(st.clues.a.status).toBe('deduced');
    expect(st.clues.b.status).toBe('deduced');
  });

  it('CONFIRMATION: a non-qualifying set forms NOTHING on a CRITICAL roll', () => {
    // no recipe; a-b not connectsTo → incorrect
    attempt('critical', { a: clue('a'), b: clue('b') }, [{ fromId: 'a', toId: 'b' }], []);
    const st = useStore.getState();
    expect(Object.keys(st.deductions)).toHaveLength(0);
  });

  it('forms BOTH deductions when a component matches two recipes (Blocker 1)', () => {
    const clues = { w: clue('w'), s: clue('s'), q: clue('q'), d: clue('d') };
    const recipes: KeyDeduction[] = [
      { id: 'one-true-murder', requiredClues: ['w', 's'], title: 'M', description: 'M', isRedHerring: false },
      { id: 'poisoner', requiredClues: ['q', 's', 'd'], title: 'P', description: 'P', isRedHerring: true },
    ];
    attempt('success', clues, [{ fromId: 'w', toId: 's' }, { fromId: 's', toId: 'q' }, { fromId: 'q', toId: 'd' }], recipes);
    const st = useStore.getState();
    expect(st.deductions['one-true-murder']).toBeDefined();
    expect(st.deductions.poisoner).toBeDefined();
    expect(st.deductions.poisoner.isRedHerring).toBe(true);
  });

  it('a generic correct component (all connectsTo) forms one generic deduction', () => {
    const clues = { a: clue('a', { connectsTo: ['b'] }), b: clue('b') };
    attempt('success', clues, [{ fromId: 'a', toId: 'b' }], []);
    const st = useStore.getState();
    expect(st.deductions['deduction-generic-a+b']).toBeDefined();
  });

  it('an incorrect attempt marks clues contested then the store reverts them (fake timers)', () => {
    vi.useFakeTimers();
    try {
      attempt('failure', { a: clue('a'), b: clue('b') }, [{ fromId: 'a', toId: 'b' }], []);
      expect(useStore.getState().clues.a.status).toBe('contested');
      act(() => { vi.advanceTimersByTime(2000); });
      expect(useStore.getState().clues.a.status).toBe('examined');
    } finally {
      vi.useRealTimers();
    }
  });

  it('empty classified result (all edges stale) → red banner, forms nothing, clears (Minor 5)', () => {
    attempt('success', { a: clue('a'), b: clue('b') }, [{ fromId: 'a', toId: 'missing' }], []);
    const st = useStore.getState();
    expect(Object.keys(st.deductions)).toHaveLength(0);
    expect(st.connections).toHaveLength(0);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(screen.getByText("These clues don't connect — not like this.")).toBeTruthy();
  });

  it('REPEAT ATTEMPT (Major 5): after forming one deduction, a new pair can be attempted without reopening', () => {
    (performCheck as ReturnType<typeof vi.fn>).mockReturnValue({ roll: 10, modifier: 0, total: 10, dc: 14, tier: 'success' });
    const clues = { a: clue('a', { connectsTo: ['b'] }), b: clue('b'), c: clue('c', { connectsTo: ['d'] }), d: clue('d') };
    initStore(clues, [{ fromId: 'a', toId: 'b' }], []);
    render(<EvidenceBoard onClose={() => {}} />);
    // 1st attempt forms a-b, clears connections.
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(useStore.getState().deductions['deduction-generic-a+b']).toBeDefined();
    expect(useStore.getState().connections).toHaveLength(0);
    // 2nd: connect a different pair c-d in the same mounted board.
    fireEvent.click(screen.getByRole('button', { name: /^Clue: C/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Clue: D/i }));
    // Button is enabled again (not stuck 'Deduction Locked').
    const btn = screen.getByRole('button', { name: /Attempt Deduction/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(useStore.getState().deductions['deduction-generic-c+d']).toBeDefined();
  });
});

describe('EvidenceBoard — banner tone by correctness (Phase 2b)', () => {
  function attempt(tier: string, clues: Record<string, Clue>, connections: ClueConnection[], recipes: KeyDeduction[] = []) {
    (performCheck as ReturnType<typeof vi.fn>).mockReturnValue({ roll: 10, modifier: 0, total: 10, dc: 14, tier });
    initStore(clues, connections, recipes);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
  }

  it('correct → green banner + one announce', () => {
    attempt('success', { a: clue('a', { connectsTo: ['b'] }), b: clue('b') }, [{ fromId: 'a', toId: 'b' }], []);
    const banner = screen.getByText('The connection holds.');
    expect(banner).toHaveAttribute('data-tone', 'green');
    expect(banner).toHaveAttribute('aria-hidden', 'true');
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('correct + critical → sharper green copy', () => {
    attempt('critical', { a: clue('a', { connectsTo: ['b'] }), b: clue('b') }, [{ fromId: 'a', toId: 'b' }], []);
    expect(screen.getByText('The connection holds — a sharp, decisive insight.')).toHaveAttribute('data-tone', 'green');
  });

  it('false (red-herring cluster) → amber uneasy banner', () => {
    attempt('success', { a: clue('a', { connectsTo: ['b'] }), b: clue('b', { type: 'redHerring' }) }, [{ fromId: 'a', toId: 'b' }], []);
    expect(screen.getByText('A connection forms — but an uneasy, questionable one.')).toHaveAttribute('data-tone', 'amber');
  });

  it('partial → amber directional banner', () => {
    attempt('success', { a: clue('a', { connectsTo: ['b'] }), b: clue('b'), c: clue('c') }, [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'c' }], []);
    expect(screen.getByText("Some of these belong together, but the reasoning won't quite hold.")).toHaveAttribute('data-tone', 'amber');
  });

  it('incorrect → red banner', () => {
    attempt('success', { a: clue('a'), b: clue('b') }, [{ fromId: 'a', toId: 'b' }], []);
    expect(screen.getByText("These clues don't connect — not like this.")).toHaveAttribute('data-tone', 'red');
  });
});
