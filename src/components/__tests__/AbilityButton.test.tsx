/**
 * Unit tests for AbilityButton and ability lifecycle
 *
 * Req 15.5: Ability resets to available when a new Case begins.
 * Req 15.6: Ability is visually unavailable after use.
 *
 * Sub-task 18.1
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AbilityButton } from '../HeaderBar/AbilityButton';
import { useStore } from '../../store';

// ─── AbilityButton rendering ──────────────────────────────────────────────────

describe('AbilityButton — available state (Req 15.6)', () => {
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

describe('AbilityButton — used state (Req 15.6)', () => {
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

// ─── Store: useAbility / resetAbility lifecycle (Req 15.5, 15.6) ─────────────

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

  it('useAbility() sets abilityUsed to true (Req 15.6)', () => {
    useStore.getState().useAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(true);
  });

  it('resetAbility() restores abilityUsed to false (Req 15.5)', () => {
    useStore.getState().useAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(true);

    useStore.getState().resetAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(false);
  });

  it('startNewCase() resets abilityUsed to false (Req 15.5)', () => {
    useStore.getState().useAbility();
    expect(useStore.getState().investigator.abilityUsed).toBe(true);

    useStore.getState().startNewCase('case-2');
    expect(useStore.getState().investigator.abilityUsed).toBe(false);
  });

  it('startNewCase() sets the new case ID', () => {
    useStore.getState().startNewCase('whitechapel-cipher');
    expect(useStore.getState().currentCase).toBe('whitechapel-cipher');
  });

  it('startNewCase() clears ability flags from world slice', () => {
    useStore.getState().setFlag('ability-auto-succeed-reason', true);
    useStore.getState().setFlag('ability-veil-sight-active', true);

    useStore.getState().startNewCase('case-2');

    const flags = useStore.getState().flags;
    expect(flags['ability-auto-succeed-reason']).toBeUndefined();
    expect(flags['ability-veil-sight-active']).toBeUndefined();
  });
});
