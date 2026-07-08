/**
 * Unit tests for SceneText — typewriter effect
 *
 * Sub-task 6.1; F-049 restructure — the VISIBLE text node carries
 * `data-testid="scene-text-visible"` (aria-hidden), and a separate sr-only
 * region labelled "Scene narrative" exposes the FULL text to screen readers
 * only once the animation completes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SceneText } from '../NarrativePanel/SceneText';

const SAMPLE_TEXT = 'The fog rolls in from the Thames, thick with secrets.';

/** The visible (typewriter) text node. */
const visible = () => screen.getByTestId('scene-text-visible');
/** The screen-reader narrative region. */
const srRegion = () => screen.getByLabelText('Scene narrative');

// ─── Instant render when reducedMotion is true ─────────────────────

describe('SceneText — reducedMotion: true', () => {
  it('renders the full text immediately without any timer', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={true} />);
    expect(visible().textContent).toBe(SAMPLE_TEXT);
  });

  it('exposes the full text to screen readers immediately', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={true} />);
    expect(srRegion().textContent).toBe(SAMPLE_TEXT);
  });

  it('calls onComplete immediately', () => {
    const onComplete = vi.fn();
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={true} onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders empty string instantly when text is empty', () => {
    render(<SceneText text="" reducedMotion={true} />);
    expect(visible().textContent).toBe('');
  });

  it('renders updated text instantly when text prop changes', () => {
    const { rerender } = render(<SceneText text="First." reducedMotion={true} />);
    expect(visible().textContent).toBe('First.');

    rerender(<SceneText text="Second." reducedMotion={true} />);
    expect(visible().textContent).toBe('Second.');
  });
});

// ─── Typewriter mode (reducedMotion: false) ────────────────────────

describe('SceneText — typewriter mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty text before any ticks', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);
    // Before any timer fires, displayed text should be empty
    expect(visible().textContent).toBe('');
  });

  it('does not announce partial text to screen readers mid-animation (F-049)', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);
    act(() => { vi.advanceTimersByTime(90); });
    // The visible node has partial text, but the SR region stays empty until done.
    expect((visible().textContent ?? '').length).toBeGreaterThan(0);
    expect(srRegion().textContent).toBe('');
  });

  it('reveals partial text after some ticks', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);

    // Advance a few ticks (30ms each, 2 chars per tick)
    act(() => {
      vi.advanceTimersByTime(90); // 3 ticks → up to 6 chars
    });

    const partial = visible().textContent ?? '';
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(SAMPLE_TEXT.length);
    // Partial text must be a prefix of the full text
    expect(SAMPLE_TEXT.startsWith(partial)).toBe(true);
  });

  it('eventually renders the full text after enough time', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);

    act(() => {
      // Advance well past the time needed to reveal all characters
      vi.advanceTimersByTime(SAMPLE_TEXT.length * 30 + 500);
    });

    expect(visible().textContent).toBe(SAMPLE_TEXT);
    // Once complete, the SR region carries the full text (announced once).
    expect(srRegion().textContent).toBe(SAMPLE_TEXT);
  });

  it('calls onComplete when the full text is revealed', () => {
    const onComplete = vi.fn();
    render(
      <SceneText text={SAMPLE_TEXT} reducedMotion={false} onComplete={onComplete} />,
    );

    act(() => {
      vi.advanceTimersByTime(SAMPLE_TEXT.length * 30 + 500);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete before text is fully revealed', () => {
    const onComplete = vi.fn();
    render(
      <SceneText text={SAMPLE_TEXT} reducedMotion={false} onComplete={onComplete} />,
    );

    act(() => {
      vi.advanceTimersByTime(60); // only 2 ticks
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('resets and restarts typewriter when text prop changes mid-animation', () => {
    const { rerender } = render(
      <SceneText text="First sentence." reducedMotion={false} />,
    );

    act(() => {
      vi.advanceTimersByTime(60); // partial reveal of first text
    });

    rerender(<SceneText text="Second sentence." reducedMotion={false} />);

    // After reset, displayed text should be empty again (or very early)
    act(() => {
      vi.advanceTimersByTime(0);
    });
    // The displayed text must be a prefix of the NEW text, not the old one
    const displayed = visible().textContent ?? '';
    expect('Second sentence.'.startsWith(displayed)).toBe(true);
  });

  it('switching from typewriter to reducedMotion mid-animation shows full text', () => {
    const { rerender } = render(
      <SceneText text={SAMPLE_TEXT} reducedMotion={false} />,
    );

    act(() => {
      vi.advanceTimersByTime(60); // partial
    });

    rerender(<SceneText text={SAMPLE_TEXT} reducedMotion={true} />);

    expect(visible().textContent).toBe(SAMPLE_TEXT);
  });
});

// ─── Skip control (click + keyboard) ─────────────────────────────────────────

describe('SceneText — skip control (F-049)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('clicking the visible text during animation reveals full text immediately', () => {
    render(<SceneText text={SAMPLE_TEXT} textSpeed="typewriter" />);
    act(() => { vi.advanceTimersByTime(60); });
    expect(visible().textContent).not.toBe(SAMPLE_TEXT);
    act(() => { visible().click(); });
    expect(visible().textContent).toBe(SAMPLE_TEXT);
  });

  it('exposes a real focusable skip button while animating', () => {
    render(<SceneText text={SAMPLE_TEXT} textSpeed="typewriter" />);
    act(() => { vi.advanceTimersByTime(60); });
    const btn = screen.getByRole('button', { name: /skip text animation/i });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('activating the skip button reveals the full text and calls onComplete', () => {
    const onComplete = vi.fn();
    render(<SceneText text={SAMPLE_TEXT} textSpeed="typewriter" onComplete={onComplete} />);
    act(() => { vi.advanceTimersByTime(60); });
    act(() => { screen.getByRole('button', { name: /skip text animation/i }).click(); });
    expect(visible().textContent).toBe(SAMPLE_TEXT);
    expect(onComplete).toHaveBeenCalled();
  });

  it('removes the skip button once the animation completes', () => {
    render(<SceneText text={SAMPLE_TEXT} textSpeed="typewriter" />);
    act(() => { vi.advanceTimersByTime(SAMPLE_TEXT.length * 30 + 500); });
    expect(screen.queryByRole('button', { name: /skip text animation/i })).toBeNull();
  });
});
