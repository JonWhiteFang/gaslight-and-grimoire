import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceCard } from '../ChoicePanel/ChoiceCard';
import type { Choice, Investigator } from '../../types';

function inv(): Investigator {
  return {
    name: 'T', archetype: 'deductionist',
    faculties: { reason: 14, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

const checkChoice: Choice = {
  id: 'c1', text: 'Force the lock', faculty: 'reason', difficulty: 14,
  outcomes: { critical: 's', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
} as Choice;

const facultyOnlyChoice: Choice = {
  id: 'c2', text: 'Ponder', faculty: 'reason', // NO difficulty / dynamicDifficulty
  outcomes: { critical: 's', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
} as Choice;

const common = {
  investigator: inv(), revealedClueIds: new Set<string>(), deductionIds: new Set<string>(),
  hasAdvantage: false, autoSucceeds: false, onSelect: () => {},
};

describe('ChoiceCard — pre-roll odds', () => {
  it('shows the Prospects tag and folds odds into the button accessible name on a real check', () => {
    render(<ChoiceCard choice={checkChoice} {...common} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    const btn = screen.getByRole('button');
    expect(btn).toHaveAccessibleName(/difficulty 14/);
    expect(btn).toHaveAccessibleName(/prospects/);
  });

  it('omits DC/Prospects on a faculty-only (non-check) choice', () => {
    render(<ChoiceCard choice={facultyOnlyChoice} {...common} />);
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/prospects/i);
  });

  it('shows Assured when autoSucceeds', () => {
    render(<ChoiceCard choice={checkChoice} {...common} autoSucceeds />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAccessibleName(/assured success/i);
  });

  it('shows exactly one advantage glyph when advantaged (tag must not duplicate it)', () => {
    render(<ChoiceCard choice={checkChoice} {...common} hasAdvantage />);
    expect(screen.getAllByText('◈')).toHaveLength(1);
  });
});
