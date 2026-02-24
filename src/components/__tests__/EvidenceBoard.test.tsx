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

import { EvidenceBoard } from '../EvidenceBoard';

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
});
