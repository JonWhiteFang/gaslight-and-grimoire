import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiceRollOverlay } from '../NarrativePanel/DiceRollOverlay';

describe('DiceRollOverlay — DC display', () => {
  it('renders "vs DC N" when dc is supplied', () => {
    render(<DiceRollOverlay roll={17} modifier={2} total={19} dc={14} visible reducedMotion />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining('14'));
  });

  it('omits DC entirely when dc is absent (backward compatible)', () => {
    render(<DiceRollOverlay roll={17} modifier={2} total={19} visible reducedMotion />);
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
  });
});
