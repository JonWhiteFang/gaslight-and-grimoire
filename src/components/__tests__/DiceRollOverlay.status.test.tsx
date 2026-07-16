/**
 * DiceRollOverlay is a passive status card, NOT a modal (Phase 4 WS4 preserve).
 * Guards against a future "make the dice roll a modal dialog" regression.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DiceRollOverlay } from '../NarrativePanel/DiceRollOverlay';

describe('DiceRollOverlay — passive status, not a modal (preserve)', () => {
  it('exposes role=status / aria-live=polite and is non-interactive', () => {
    const { container } = render(
      <DiceRollOverlay roll={14} modifier={2} total={16} visible reducedMotion />,
    );
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.getAttribute('aria-live')).toBe('polite');
    // Not a dialog and traps nothing: no dialog role, no focusable control of ANY kind.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    expect(container.querySelector(FOCUSABLE)).toBeNull();
  });
});
