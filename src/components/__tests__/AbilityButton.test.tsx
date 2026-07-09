/**
 * Unit tests for AbilityButton and ability lifecycle
 *
 * Sub-task 18.1
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AbilityButton } from '../HeaderBar/AbilityButton';
import { useStore } from '../../store';
import { resetForNewCase } from '../../store/slices/narrativeSlice';
import type { CaseData } from '../../types';

/** Minimal CaseData for exercising the real resetForNewCase (no content fetch). */
function makeCaseData(): CaseData {
  return {
    meta: {
      id: 'test-case', title: 'Test', synopsis: '', acts: 3,
      firstScene: 'scene-1', facultyDistribution: {},
    } as CaseData['meta'],
    scenes: {}, clues: {}, npcs: {}, variants: [],
  };
}

// ─── AbilityButton rendering ──────────────────────────────────────────────────

describe('AbilityButton — available state', () => {
  it('renders the ability name when abilityUsed is false', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={false}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByText('Elementary')).toBeInTheDocument();
  });

  it('has correct aria-label when available', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={false}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Use Elementary ability' })).toBeInTheDocument();
  });

  it('is not disabled when abilityUsed is false', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={false}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('shows ability name for each archetype', () => {
    const cases = [
      { archetype: 'deductionist' as const, name: 'Elementary' },
      { archetype: 'occultist' as const, name: 'Veil Sight' },
      { archetype: 'operator' as const, name: 'Street Survivor' },
      { archetype: 'mesmerist' as const, name: 'Silver Tongue' },
    ];
    for (const { archetype, name } of cases) {
      const { unmount } = render(
        <AbilityButton archetype={archetype} abilityUsed={false} onActivate={vi.fn()} />,
      );
      expect(screen.getByText(name)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('AbilityButton — used state', () => {
  it('is disabled when abilityUsed is true', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={true}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('has aria-disabled="true" when abilityUsed is true', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={true}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('has correct aria-label when used', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={true}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Elementary ability used' })).toBeInTheDocument();
  });

  it('shows "Used" label when abilityUsed is true', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={true}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByText('(Used)')).toBeInTheDocument();
  });

  it('applies opacity-50 class when abilityUsed is true', () => {
    render(
      <AbilityButton
        archetype="deductionist"
        abilityUsed={true}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button').className).toMatch(/opacity-50/);
  });
});

// ─── AbilityButton interaction ────────────────────────────────────────────────

describe('AbilityButton — click behaviour', () => {
  it('calls onActivate when clicked and ability is available', () => {
    const onActivate = vi.fn();
    render(
      <AbilityButton
        archetype="operator"
        abilityUsed={false}
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onActivate when abilityUsed is true', () => {
    const onActivate = vi.fn();
    render(
      <AbilityButton
        archetype="operator"
        abilityUsed={true}
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onActivate).not.toHaveBeenCalled();
  });
});

// ─── Store: useAbility / resetAbility lifecycle ─────────────

describe('Store — ability lifecycle', () => {
  beforeEach(() => {
    // Reset store to clean state before each test
    useStore.setState((s) => {
      s.investigator.abilityUsed = false;
    });
  });

  it('abilityUsed starts as false', () => {
    expect(useStore.getState().investigator.abilityUsed).toBe(false);
  });

  it('useAbility() sets abilityUsed to true', () => {
    useStore.getState().useAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(true);
  });

  it('resetAbility() restores abilityUsed to false', () => {
    useStore.getState().useAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(true);

    useStore.getState().resetAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(false);
  });

  // These drive the REAL case-load reset (resetForNewCase, the unit
  // loadAndStartCase runs inside its set() block) rather than hand-simulating it
  // with setState/delete. A hand-simulated test passes even if the production
  // reset is broken; this one fails if the reset ever stops clearing the flag.
  it('resetForNewCase (the loadAndStartCase reset) restores abilityUsed to false', () => {
    useStore.getState().useAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(true);

    useStore.setState((s) => resetForNewCase(s, makeCaseData()));
    expect(useStore.getState().investigator.abilityUsed).toBe(false);
  });

  it('resetForNewCase sets the new case ID', () => {
    useStore.setState((s) => resetForNewCase(s, makeCaseData()));
    expect(useStore.getState().currentCase).toBe('test-case');
  });

  it('resetForNewCase clears ability auto-succeed and veil-sight flags from world slice', () => {
    useStore.getState().setFlag('ability-auto-succeed-reason', true);
    useStore.getState().setFlag('ability-veil-sight-active', true);

    useStore.setState((s) => resetForNewCase(s, makeCaseData()));

    expect(useStore.getState().flags['ability-auto-succeed-reason']).toBeUndefined();
    expect(useStore.getState().flags['ability-veil-sight-active']).toBeUndefined();
  });
});
