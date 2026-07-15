import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';

vi.mock('../../engine/diceEngine', () => ({
  performCheck: vi.fn(() => ({ roll: 10, modifier: 0, total: 10, dc: 14, tier: 'success' })),
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
}));

import { DeductionButton } from '../EvidenceBoard/DeductionButton';

function initInvestigator() {
  useStore.setState({
    investigator: {
      name: 'T', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {
      a: { id: 'a', type: 'physical', title: 'A', description: '', sceneSource: 's', tags: [], status: 'connected', isRevealed: true },
      b: { id: 'b', type: 'physical', title: 'B', description: '', sceneSource: 's', tags: [], status: 'connected', isRevealed: true },
    },
    deductions: {}, caseData: null,
  } as any);
}

beforeEach(() => { vi.clearAllMocks(); initInvestigator(); });

describe('DeductionButton (Phase 2a)', () => {
  it('renders null below two connected clues', () => {
    const { container } = render(<DeductionButton connectedClueIds={['a']} onResult={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('threads the distinct roll tier through onResult and renders no aria-live outcome node', async () => {
    // A critical roll (tier !== result) proves the tier is threaded, not echoed.
    const { performCheck } = await import('../../engine/diceEngine');
    (performCheck as any).mockReturnValue({ roll: 20, modifier: 0, total: 20, dc: 14, tier: 'critical' });
    const onResult = vi.fn();
    const { container } = render(<DeductionButton connectedClueIds={['a', 'b']} onResult={onResult} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('success', 'critical');
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('reports failure with the failure tier', async () => {
    const { performCheck } = await import('../../engine/diceEngine');
    (performCheck as any).mockReturnValue({ roll: 3, modifier: 0, total: 3, dc: 14, tier: 'failure' });
    const onResult = vi.fn();
    render(<DeductionButton connectedClueIds={['a', 'b']} onResult={onResult} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(onResult).toHaveBeenCalledWith('failure', 'failure');
  });
});
