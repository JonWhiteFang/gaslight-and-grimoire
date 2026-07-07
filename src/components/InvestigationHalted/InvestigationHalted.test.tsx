/**
 * InvestigationHalted — the failure screen shown when composure/vitality hits 0
 * (F-011, issue #9). Distinct from the "Case Complete" success terminal.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvestigationHalted } from './InvestigationHalted';

describe('InvestigationHalted', () => {
  it('renders the halted heading, not "Case Complete"', () => {
    render(<InvestigationHalted reason="composure" onReturn={() => {}} />);
    expect(screen.getByText(/investigation halted/i)).toBeTruthy();
    expect(screen.queryByText(/case complete/i)).toBeNull();
  });

  it('shows composure-specific copy when reason is composure', () => {
    render(<InvestigationHalted reason="composure" onReturn={() => {}} />);
    expect(screen.getByText(/composure/i)).toBeTruthy();
  });

  it('shows vitality-specific copy when reason is vitality', () => {
    render(<InvestigationHalted reason="vitality" onReturn={() => {}} />);
    expect(screen.getByText(/your strength has failed you/i)).toBeTruthy();
  });

  it('calls onReturn when the return button is pressed', () => {
    const onReturn = vi.fn();
    render(<InvestigationHalted reason="composure" onReturn={onReturn} />);
    fireEvent.click(screen.getByRole('button', { name: /case list|return/i }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
