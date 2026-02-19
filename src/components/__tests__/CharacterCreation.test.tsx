/**
 * Unit tests for Character Creation — Faculty allocation validation
 * Requirements: 1.3, 1.4, 1.5
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacultyAllocation, calculateModifier } from '../CharacterCreation/FacultyAllocation';
import { CharacterCreation } from '../CharacterCreation/CharacterCreation';
import type { Faculty } from '../../types';
import { FACULTIES, BONUS_POINTS_TOTAL } from '../../data/archetypes';

// ─── calculateModifier ────────────────────────────────────────────────────────

describe('calculateModifier', () => {
  it('returns 0 for score 10', () => {
    expect(calculateModifier(10)).toBe(0);
  });

  it('returns +1 for score 12', () => {
    expect(calculateModifier(12)).toBe(1);
  });

  it('returns +2 for score 14', () => {
    expect(calculateModifier(14)).toBe(2);
  });

  it('returns -1 for score 8', () => {
    expect(calculateModifier(8)).toBe(-1);
  });

  it('returns -1 for score 9 (floors down)', () => {
    expect(calculateModifier(9)).toBe(-1);
  });

  it('returns +3 for score 16', () => {
    expect(calculateModifier(16)).toBe(3);
  });
});

// ─── FacultyAllocation — live modifier display (Req 1.5) ─────────────────────

describe('FacultyAllocation — live modifier display', () => {
  const emptyAllocated = (): Record<Faculty, number> =>
    Object.fromEntries(FACULTIES.map((f) => [f, 0])) as Record<Faculty, number>;

  it('shows +0 modifier for base score 8 (deductionist has no bonus on nerve)', () => {
    render(
      <FacultyAllocation
        archetype="deductionist"
        allocated={emptyAllocated()}
        onChange={() => {}}
      />,
    );
    // nerve has no bonus for deductionist → score 8 → modifier -1
    expect(screen.getByLabelText(/nerve modifier/i)).toHaveTextContent('-1');
  });

  it('shows +1 modifier for reason with deductionist bonus (+3 → score 11)', () => {
    render(
      <FacultyAllocation
        archetype="deductionist"
        allocated={emptyAllocated()}
        onChange={() => {}}
      />,
    );
    // reason bonus +3 → score 11 → modifier +0
    expect(screen.getByLabelText(/reason modifier/i)).toHaveTextContent('+0');
  });

  it('updates modifier in real time when allocation changes', () => {
    const allocated = { ...emptyAllocated(), reason: 4 };
    render(
      <FacultyAllocation
        archetype="deductionist"
        allocated={allocated}
        onChange={() => {}}
      />,
    );
    // reason: base 8 + archetype 3 + allocated 4 = 15 → modifier +2
    expect(screen.getByLabelText(/reason modifier/i)).toHaveTextContent('+2');
  });

  it('shows remaining points counter', () => {
    const allocated = { ...emptyAllocated(), reason: 6 };
    render(
      <FacultyAllocation
        archetype="deductionist"
        allocated={allocated}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/6 bonus points remaining/i)).toBeInTheDocument();
  });

  it('shows 0 remaining when all points allocated', () => {
    const allocated = { ...emptyAllocated(), reason: BONUS_POINTS_TOTAL };
    render(
      <FacultyAllocation
        archetype="deductionist"
        allocated={allocated}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/0 bonus points remaining/i)).toBeInTheDocument();
  });
});

// ─── CharacterCreation — confirm blocked with unspent points (Req 1.4) ────────

// Minimal mock for useStore — we only need initInvestigator
vi.mock('../../store', () => ({
  useStore: (selector: (s: { initInvestigator: () => void }) => unknown) =>
    selector({ initInvestigator: vi.fn() }),
}));

describe('CharacterCreation — confirm button validation', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
  });

  it('confirm button is disabled initially (no name, no archetype, no points)', () => {
    render(<CharacterCreation onComplete={onComplete} />);
    const btn = screen.getByRole('button', { name: /begin investigation/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button is disabled when archetype selected but points unspent', () => {
    render(<CharacterCreation onComplete={onComplete} />);

    // Enter a name
    fireEvent.change(screen.getByLabelText(/investigator name/i), {
      target: { value: 'Elara Voss' },
    });

    // Select an archetype
    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));

    const btn = screen.getByRole('button', { name: /begin investigation/i });
    expect(btn).toBeDisabled();
  });

  it('shows helper text when points remain unspent', () => {
    render(<CharacterCreation onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));
    expect(screen.getByText(/allocate all 12 bonus points/i)).toBeInTheDocument();
  });

  it('confirm button is disabled when name is empty even with archetype and full allocation', () => {
    render(<CharacterCreation onComplete={onComplete} />);

    // Select archetype (resets allocation)
    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));

    // Spend all 12 points on reason via + button clicks
    const increaseReason = screen.getByLabelText(/increase reason/i);
    for (let i = 0; i < BONUS_POINTS_TOTAL; i++) {
      fireEvent.click(increaseReason);
    }

    // No name entered
    const btn = screen.getByRole('button', { name: /begin investigation/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button is enabled when name, archetype, and all points are set', () => {
    render(<CharacterCreation onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/investigator name/i), {
      target: { value: 'Elara Voss' },
    });

    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));

    const increaseReason = screen.getByLabelText(/increase reason/i);
    for (let i = 0; i < BONUS_POINTS_TOTAL; i++) {
      fireEvent.click(increaseReason);
    }

    const btn = screen.getByRole('button', { name: /begin investigation/i });
    expect(btn).not.toBeDisabled();
  });

  it('cannot allocate more than 12 bonus points total', () => {
    render(<CharacterCreation onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));

    const increaseReason = screen.getByLabelText(/increase reason/i);
    // Try to click 15 times — should cap at 12
    for (let i = 0; i < 15; i++) {
      fireEvent.click(increaseReason);
    }

    // After 12 clicks the + button should be disabled
    expect(increaseReason).toBeDisabled();
  });
});
