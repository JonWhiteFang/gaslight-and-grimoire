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

// partial routes to the SAME scene as success/critical → a partial roll reaches the
// good destination, so odds must be computed with the wider (partial-counts) band.
// Perception 10 (mod 0 for a deductionist), DC 10: strict → p .55 (Uncertain),
// lenient → p .70 (Favourable). The two bands differ, so the assertion is load-bearing.
const successEquivalentPartialChoice: Choice = {
  id: 'c3', text: 'Watch the room', faculty: 'perception', difficulty: 10,
  outcomes: { critical: 'x', success: 'x', partial: 'x', failure: 'f', fumble: 'f' },
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

  it('counts partial toward the band when partial routes to the success/critical scene', () => {
    render(<ChoiceCard choice={successEquivalentPartialChoice} {...common} />);
    // partial === success destination → wider band: perception mod 0 vs DC 10,
    // pass at total >= 7 → p .70 → Favourable (NOT the strict .55 Uncertain).
    expect(screen.getByText(/Prospects: Favourable/)).toBeInTheDocument();
  });

  it('computes strictly when partial routes to a distinct scene', () => {
    // checkChoice: reason 14 (mod +2, +1 trained = +3) vs DC 14 → strict pass at
    // total >= 14 → nat 11 → p .50 → Uncertain. partial ('p') is distinct from
    // success ('s'), so the wider band must NOT be applied.
    render(<ChoiceCard choice={checkChoice} {...common} />);
    expect(screen.getByText(/Prospects: Uncertain/)).toBeInTheDocument();
  });
});
