import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckOddsTag } from '../shared';
import type { CheckOdds } from '../../engine/checkOdds';

const odds: CheckOdds = {
  faculty: 'reason', modifier: 2, dc: 14,
  hasAdvantage: false, hasDisadvantage: false, autoSucceeds: false, band: 'uncertain',
};

describe('CheckOddsTag', () => {
  it('renders DC and the prospects band', () => {
    render(<CheckOddsTag odds={odds} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    expect(screen.getByText(/Uncertain/i)).toBeInTheDocument();
  });

  it('is aria-hidden (odds conveyed via the parent button label)', () => {
    const { container } = render(<CheckOddsTag odds={odds} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.querySelector('[aria-label]')).toBeNull();
  });

  it('shows the Assured treatment (no DC) when autoSucceeds', () => {
    render(<CheckOddsTag odds={{ ...odds, autoSucceeds: true }} />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
  });

  it('renders the literal "Prospects:" label', () => {
    render(<CheckOddsTag odds={odds} />);
    expect(screen.getByText(/Prospects:\s*Uncertain/i)).toBeInTheDocument();
  });

  it('does NOT render its own advantage glyph (ChoiceCard/prompt owns it — no duplicate)', () => {
    render(<CheckOddsTag odds={{ ...odds, hasAdvantage: true }} />);
    expect(screen.queryByText('◈')).not.toBeInTheDocument();
  });
});
