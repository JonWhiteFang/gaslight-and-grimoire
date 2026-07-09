/**
 * ErrorBoundary tests (F-031) — catches render errors and shows a recovery UI
 * instead of a white screen; renders children normally when nothing throws.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import { SaveManager } from '../../engine/saveManager';

function Boom(): never {
  throw new Error('kaboom');
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ErrorBoundary', () => {
  it('renders children when they do not throw', () => {
    render(
      <ErrorBoundary>
        <div data-testid="ok">healthy</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('ok')).toBeTruthy();
  });

  it('renders the fallback UI when a child throws', () => {
    // Silence the expected React error log for this deliberate throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /return to title/i })).toBeTruthy();
    spy.mockRestore();
  });

  // #57: the "your progress has been auto-saved" reassurance was unconditional,
  // but in Manual save mode no autosave slot is ever written — a false promise.
  // Gate it on an autosave actually existing.
  it('claims auto-save only when an autosave slot exists', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(SaveManager, 'listSaves').mockReturnValue([
      { id: 'autosave', timestamp: 't', caseName: 'c', investigatorName: 'i' },
    ]);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/auto-saved/i)).toBeTruthy();
    spy.mockRestore();
  });

  it('does NOT claim auto-save when no autosave slot exists (manual mode)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(SaveManager, 'listSaves').mockReturnValue([
      { id: 'save-1', timestamp: 't', caseName: 'c', investigatorName: 'i' },
    ]);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.queryByText(/auto-saved/i)).toBeNull();
    // Still shows the recovery UI.
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    spy.mockRestore();
  });
});
