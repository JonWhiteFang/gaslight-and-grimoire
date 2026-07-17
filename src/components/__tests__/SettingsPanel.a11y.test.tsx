/**
 * SettingsPanel accessibility — focus-restore (Phase 4 WS2, Codex-verified gap).
 * The panel used a bespoke inline trap that never restored focus to the invoker.
 * Refactored to the shared useFocusTrap hook.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useStore } from '../../store';
import { SettingsPanel } from '../SettingsPanel/SettingsPanel';

function initStore() {
  useStore.setState({
    settings: {
      fontSize: 'standard', highContrast: false, reducedMotion: true,
      textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
  } as any);
}

afterEach(cleanup);

describe('SettingsPanel — focus management (WS2)', () => {
  it('restores focus to the invoking control on close', () => {
    initStore();
    render(<button type="button" data-testid="invoker">Open settings</button>);
    const invoker = screen.getByTestId('invoker');
    invoker.focus();
    expect(document.activeElement).toBe(invoker);

    const { unmount } = render(<SettingsPanel onClose={() => {}} />);
    // focus moved into the dialog
    expect(document.activeElement).not.toBe(invoker);

    unmount();
    expect(document.activeElement).toBe(invoker);
  });

  it('moves initial focus to the close button (first focusable descendant)', () => {
    initStore();
    render(<SettingsPanel onClose={() => {}} />);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /close settings/i }),
    );
  });

  it('closes on Escape', () => {
    // SettingsPanel now listens on window (Task 1 refactor, Codex Major 5), so a
    // window-dispatched Escape reaches the handler.
    initStore();
    let closed = false;
    render(<SettingsPanel onClose={() => { closed = true; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('wraps Tab from the last focusable to the first (Codex Major 5)', () => {
    initStore();
    render(<SettingsPanel onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable to the last (Codex Major 5)', () => {
    initStore();
    render(<SettingsPanel onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
