/**
 * EvidenceBoard component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';

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

function initStore(clues: Record<string, any> = {}, connections: any[] = []) {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues,
    deductions: {},
    connections,
    currentScene: 's1', currentCase: 'test', sceneHistory: [],
    npcs: {}, flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: null, lastCheckResult: null,
  });
}

const sampleClues = {
  'c1': { id: 'c1', type: 'physical', title: 'Cipher Note', description: 'A coded message', sceneSource: 's1', connectsTo: ['c2'], tags: ['paper'], status: 'new', isRevealed: true },
  'c2': { id: 'c2', type: 'testimony', title: 'Witness Account', description: 'A witness saw...', sceneSource: 's2', connectsTo: ['c1'], tags: ['testimony'], status: 'new', isRevealed: true },
  'c3': { id: 'c3', type: 'physical', title: 'Hidden Clue', description: 'Not found yet', sceneSource: 's3', connectsTo: [], tags: [], status: 'new', isRevealed: false },
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

  // ─── F-002: connection works on click/tap + persistent first-time hint ───────

  it('shows a persistent connection hint when the board opens with clues and no connection in progress', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    // A first-time prompt must be visible before any Space press.
    expect(screen.getByText(/select two clues to connect/i)).toBeTruthy();
  });

  it('does not show the connect hint when there are no clues', () => {
    initStore({});
    render(<EvidenceBoard onClose={() => {}} />);
    expect(screen.queryByText(/select two clues to connect/i)).toBeNull();
  });

  it('clicking two clue cards connects them and marks both connected', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Cipher Note/i }));
    fireEvent.click(screen.getByRole('button', { name: /Witness Account/i }));

    const state = useStore.getState();
    expect(state.connections).toContainEqual({ fromId: 'c1', toId: 'c2' });
    expect(state.clues.c1.status).toBe('connected');
    expect(state.clues.c2.status).toBe('connected');
  });

  it('clicking the same card twice cancels the pending connection', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    const first = screen.getByRole('button', { name: /Cipher Note/i });
    fireEvent.click(first);
    fireEvent.click(first);
    expect(useStore.getState().connections).toHaveLength(0);
  });

  // ─── F-007: focus trap ───────────────────────────────────────────────────────

  it('moves focus inside the dialog on open', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('EvidenceBoard — deduction outcome banner (Phase 2a)', () => {
  const connectedPair = {
    'c1': { id: 'c1', type: 'physical', title: 'Cipher Note', description: 'x', sceneSource: 's1', connectsTo: ['c2'], tags: ['paper'], status: 'connected', isRevealed: true },
    'c2': { id: 'c2', type: 'testimony', title: 'Witness Account', description: 'y', sceneSource: 's2', connectsTo: ['c1'], tags: ['paper'], status: 'connected', isRevealed: true },
  };

  function attempt(tier: string) {
    (performCheck as any).mockReturnValue({ roll: 10, modifier: 0, total: 10, dc: 14, tier });
    initStore(connectedPair, [{ fromId: 'c1', toId: 'c2' }]);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
  }

  it('shows a green success banner and announces once, even after connections clear', () => {
    attempt('success');
    expect(useStore.getState().connections).toHaveLength(0);
    const banner = screen.getByText('The connection holds.');
    expect(banner).toBeTruthy();
    expect(banner).toHaveAttribute('data-tone', 'green');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('The connection holds.');
  });

  it('shows the critical-success line on a critical-tier success', () => {
    attempt('critical');
    expect(screen.getByText('The connection holds — a sharp, decisive insight.')).toBeTruthy();
  });

  it('shows the directional AMBER message on a partial-tier failure', () => {
    attempt('partial');
    const banner = screen.getByText("Some of these belong together, but the reasoning won't quite hold.");
    expect(banner).toHaveAttribute('data-tone', 'amber');
    expect(announce).toHaveBeenCalledWith("Some of these belong together, but the reasoning won't quite hold.");
  });

  it('shows the RED hard-failure message on a plain failure', () => {
    attempt('failure');
    expect(screen.getByText("These clues don't connect — not like this.")).toHaveAttribute('data-tone', 'red');
  });

  it('treats a fumble as a hard (red) failure', () => {
    attempt('fumble');
    expect(screen.getByText("These clues don't connect — not like this.")).toHaveAttribute('data-tone', 'red');
  });

  it('a success still forms exactly one deduction and marks both clues deduced', () => {
    attempt('success');
    const st = useStore.getState();
    expect(Object.keys(st.deductions)).toHaveLength(1);
    expect(st.clues.c1.status).toBe('deduced');
    expect(st.clues.c2.status).toBe('deduced');
  });

  it('a failure forms no deduction and marks the clues contested', () => {
    attempt('failure');
    const st = useStore.getState();
    expect(Object.keys(st.deductions)).toHaveLength(0);
    expect(st.clues.c1.status).toBe('contested');
    expect(st.clues.c2.status).toBe('contested');
  });
});
