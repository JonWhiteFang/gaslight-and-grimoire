/**
 * Unit tests for SceneText — typewriter effect
 *
 * Req 2.2: Narrative text SHALL display with a typewriter effect.
 * Req 2.3: While reduced motion is enabled, text SHALL display instantly.
 *
 * Sub-task 6.1
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SceneText } from '../NarrativePanel/SceneText';

const SAMPLE_TEXT = 'The fog rolls in from the Thames, thick with secrets.';

// ─── Req 2.3 — Instant render when reducedMotion is true ─────────────────────

describe('SceneText — reducedMotion: true', () => {
  it('renders the full text immediately without any timer', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={true} />);
    expect(screen.getByText(SAMPLE_TEXT)).toBeInTheDocument();
  });

  it('calls onComplete immediately', () => {
    const onComplete = vi.fn();
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={true} onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders empty string instantly when text is empty', () => {
    render(<SceneText text="" reducedMotion={true} />);
    const el = screen.getByLabelText('Scene narrative');
    expect(el.textContent).toBe('');
  });

  it('renders updated text instantly when text prop changes', () => {
    const { rerender } = render(<SceneText text="First." reducedMotion={true} />);
    expect(screen.getByText('First.')).toBeInTheDocument();

    rerender(<SceneText text="Second." reducedMotion={true} />);
    expect(screen.getByText('Second.')).toBeInTheDocument();
  });
});

// ─── Req 2.2 — Typewriter mode (reducedMotion: false) ────────────────────────

describe('SceneText — typewriter mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty text before any ticks', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);
    const el = screen.getByLabelText('Scene narrative');
    // Before any timer fires, displayed text should be empty
    expect(el.textContent).toBe('');
  });

  it('reveals partial text after some ticks', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);
    const el = screen.getByLabelText('Scene narrative');

    // Advance a few ticks (30ms each, 2 chars per tick)
    act(() => {
      vi.advanceTimersByTime(90); // 3 ticks → up to 6 chars
    });

    const partial = el.textContent ?? '';
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(SAMPLE_TEXT.length);
    // Partial text must be a prefix of the full text
    expect(SAMPLE_TEXT.startsWith(partial)).toBe(true);
  });

  it('eventually renders the full text after enough time', () => {
    render(<SceneText text={SAMPLE_TEXT} reducedMotion={false} />);
    const el = screen.getByLabelText('Scene narrative');

    act(() => {
      // Advance well past the time needed to reveal all characters
      vi.advanceTimersByTime(SAMPLE_TEXT.length * 30 + 500);
    });

    expect(el.textContent).toBe(SAMPLE_TEXT);
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

    const el = screen.getByLabelText('Scene narrative');
    // After reset, displayed text should be empty again (or very early)
    act(() => {
      vi.advanceTimersByTime(0);
    });
    // The displayed text must be a prefix of the NEW text, not the old one
    const displayed = el.textContent ?? '';
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

    expect(screen.getByText(SAMPLE_TEXT)).toBeInTheDocument();
  });
});
