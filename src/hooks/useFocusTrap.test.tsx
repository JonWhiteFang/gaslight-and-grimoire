/**
 * useFocusTrap — shared modal focus management (F-007, issue #8).
 *
 * On mount: capture the previously-focused element, move focus into the
 * container (first focusable, else the container itself).
 * While mounted: Tab / Shift+Tab cycle within the container.
 * On unmount: restore focus to the previously-focused element.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function Dialog({ onClose }: { onClose?: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>();
  return (
    <div ref={ref} role="dialog" aria-label="Test dialog">
      <button type="button">First</button>
      <button type="button">Second</button>
      <button type="button" onClick={onClose}>Last</button>
    </div>
  );
}

afterEach(cleanup);

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element on mount', () => {
    render(<Dialog />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  it('wraps focus from the last element to the first on Tab', () => {
    render(<Dialog />);
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  it('wraps focus from the first element to the last on Shift+Tab', () => {
    render(<Dialog />);
    const first = screen.getByRole('button', { name: 'First' });
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
  });

  it('restores focus to the previously-focused element on unmount', () => {
    // A trigger button outside the dialog holds focus before the dialog opens.
    render(<button type="button" data-testid="trigger">Open</button>);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(<Dialog />);
    // focus moved into the dialog
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));

    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  // Task 9b: when an `inert` ancestor blurs the invoker to <body> BEFORE the
  // trap mounts, the mount-time document.activeElement capture is <body>. The
  // caller instead captures the real invoker at open-time and passes it as
  // `restoreTo`; the trap must restore to THAT, not to whatever had focus at mount.
  it('restores to the explicit restoreTo target, not document.activeElement at mount', () => {
    render(<button type="button" data-testid="real-invoker">Invoker</button>);
    const invoker = screen.getByTestId('real-invoker');
    // Simulate the invoker being blurred (as inert does) BEFORE the trap mounts:
    // pass it as restoreTo while focus is actually on body.
    (document.activeElement as HTMLElement)?.blur?.();
    expect(document.activeElement).toBe(document.body);

    const RestoreDialog = () => {
      const ref = useFocusTrap<HTMLDivElement>({ restoreTo: invoker });
      return (
        <div ref={ref} role="dialog">
          <button type="button">Only</button>
        </div>
      );
    };
    const { unmount } = render(<RestoreDialog />);
    unmount();
    expect(document.activeElement).toBe(invoker);
  });
});
