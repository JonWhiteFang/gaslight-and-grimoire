/**
 * ErrorBoundary tests (F-031) — catches render errors and shows a recovery UI
 * instead of a white screen; renders children normally when nothing throws.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

afterEach(cleanup);

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
});
