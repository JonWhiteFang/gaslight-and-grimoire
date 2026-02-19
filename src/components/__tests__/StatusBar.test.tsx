/**
 * Unit tests for StatusBar — ComposureMeter and VitalityMeter
 *
 * Req 5.4: Critical-threshold styling activates at ≤ 2.
 * Req 5.5: Breakdown event fires when composure reaches 0.
 * Req 5.6: Incapacitation event fires when vitality reaches 0.
 * Req 5.2: On decrease, pulse red and show descriptor for 3 s.
 * Req 5.3: On increase, pulse warm gold and show descriptor for 3 s.
 * Req 5.7: reducedMotion suppresses all pulse animations.
 *
 * Sub-task 9.1
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ComposureMeter } from '../StatusBar/ComposureMeter';
import { VitalityMeter } from '../StatusBar/VitalityMeter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderComposure(
  value: number,
  opts: { reducedMotion?: boolean; onBreakdown?: () => void } = {},
) {
  return render(
    <ComposureMeter
      value={value}
      reducedMotion={opts.reducedMotion ?? false}
      onBreakdown={opts.onBreakdown}
    />,
  );
}

function renderVitality(
  value: number,
  opts: { reducedMotion?: boolean; onIncapacitation?: () => void } = {},
) {
  return render(
    <VitalityMeter
      value={value}
      reducedMotion={opts.reducedMotion ?? false}
      onIncapacitation={opts.onIncapacitation}
    />,
  );
}

// ─── Req 5.5: Breakdown fires when composure reaches 0 ───────────────────────

describe('ComposureMeter — Breakdown event (Req 5.5)', () => {
  it('calls onBreakdown when value is 0', () => {
    const onBreakdown = vi.fn();
    renderComposure(0, { onBreakdown });
    expect(onBreakdown).toHaveBeenCalledTimes(1);
  });

  it('does not call onBreakdown when value is above 0', () => {
    const onBreakdown = vi.fn();
    renderComposure(5, { onBreakdown });
    expect(onBreakdown).not.toHaveBeenCalled();
  });

  it('calls onBreakdown when value transitions to 0 via rerender', () => {
    const onBreakdown = vi.fn();
    const { rerender } = renderComposure(1, { onBreakdown });
    expect(onBreakdown).not.toHaveBeenCalled();

    rerender(
      <ComposureMeter value={0} reducedMotion={false} onBreakdown={onBreakdown} />,
    );
    expect(onBreakdown).toHaveBeenCalledTimes(1);
  });
});

// ─── Req 5.6: Incapacitation fires when vitality reaches 0 ───────────────────

describe('VitalityMeter — Incapacitation event (Req 5.6)', () => {
  it('calls onIncapacitation when value is 0', () => {
    const onIncapacitation = vi.fn();
    renderVitality(0, { onIncapacitation });
    expect(onIncapacitation).toHaveBeenCalledTimes(1);
  });

  it('does not call onIncapacitation when value is above 0', () => {
    const onIncapacitation = vi.fn();
    renderVitality(7, { onIncapacitation });
    expect(onIncapacitation).not.toHaveBeenCalled();
  });

  it('calls onIncapacitation when value transitions to 0 via rerender', () => {
    const onIncapacitation = vi.fn();
    const { rerender } = renderVitality(1, { onIncapacitation });
    expect(onIncapacitation).not.toHaveBeenCalled();

    rerender(
      <VitalityMeter value={0} reducedMotion={false} onIncapacitation={onIncapacitation} />,
    );
    expect(onIncapacitation).toHaveBeenCalledTimes(1);
  });
});

// ─── Req 5.4: Critical-threshold styling at ≤ 2 ──────────────────────────────

describe('ComposureMeter — critical threshold styling (Req 5.4)', () => {
  it('applies red bar class when value is 2', () => {
    renderComposure(2);
    const bar = screen.getByTestId('composure-bar');
    expect(bar.className).toMatch(/red/);
  });

  it('applies red bar class when value is 1', () => {
    renderComposure(1);
    const bar = screen.getByTestId('composure-bar');
    expect(bar.className).toMatch(/red/);
  });

  it('does not apply critical red class when value is 3', () => {
    renderComposure(3);
    const bar = screen.getByTestId('composure-bar');
    // Should be the default blue, not red
    expect(bar.className).not.toMatch(/red/);
    expect(bar.className).toMatch(/blue/);
  });

  it('applies animate-pulse class at critical threshold when reducedMotion is false', () => {
    renderComposure(2, { reducedMotion: false });
    const bar = screen.getByTestId('composure-bar');
    expect(bar.className).toMatch(/animate-pulse/);
  });

  it('does NOT apply animate-pulse at critical threshold when reducedMotion is true', () => {
    renderComposure(2, { reducedMotion: true });
    const bar = screen.getByTestId('composure-bar');
    expect(bar.className).not.toMatch(/animate-pulse/);
  });
});

describe('VitalityMeter — critical threshold styling (Req 5.4)', () => {
  it('applies red bar class when value is 2', () => {
    renderVitality(2);
    const bar = screen.getByTestId('vitality-bar');
    expect(bar.className).toMatch(/red/);
  });

  it('applies red bar class when value is 1', () => {
    renderVitality(1);
    const bar = screen.getByTestId('vitality-bar');
    expect(bar.className).toMatch(/red/);
  });

  it('does not apply critical red class when value is 3', () => {
    renderVitality(3);
    const bar = screen.getByTestId('vitality-bar');
    expect(bar.className).not.toMatch(/red/);
    expect(bar.className).toMatch(/green/);
  });

  it('applies animate-pulse class at critical threshold when reducedMotion is false', () => {
    renderVitality(2, { reducedMotion: false });
    const bar = screen.getByTestId('vitality-bar');
    expect(bar.className).toMatch(/animate-pulse/);
  });

  it('does NOT apply animate-pulse at critical threshold when reducedMotion is true', () => {
    renderVitality(2, { reducedMotion: true });
    const bar = screen.getByTestId('vitality-bar');
    expect(bar.className).not.toMatch(/animate-pulse/);
  });
});

// ─── Req 5.2: Decrease descriptor shown for 3 s ──────────────────────────────

describe('ComposureMeter — decrease descriptor (Req 5.2)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows "Shaken" descriptor after composure decreases', () => {
    const { rerender } = renderComposure(8);
    rerender(<ComposureMeter value={6} reducedMotion={false} />);
    expect(screen.getByText('Shaken')).toBeInTheDocument();
  });

  it('clears descriptor after 3 seconds', () => {
    const { rerender } = renderComposure(8);
    rerender(<ComposureMeter value={6} reducedMotion={false} />);
    expect(screen.getByText('Shaken')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Shaken')).not.toBeInTheDocument();
  });
});

describe('VitalityMeter — decrease descriptor (Req 5.2)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows "Bruised" descriptor after vitality decreases', () => {
    const { rerender } = renderVitality(8);
    rerender(<VitalityMeter value={6} reducedMotion={false} />);
    expect(screen.getByText('Bruised')).toBeInTheDocument();
  });

  it('clears descriptor after 3 seconds', () => {
    const { rerender } = renderVitality(8);
    rerender(<VitalityMeter value={6} reducedMotion={false} />);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Bruised')).not.toBeInTheDocument();
  });
});

// ─── Req 5.3: Increase descriptor shown for 3 s ──────────────────────────────

describe('ComposureMeter — increase descriptor (Req 5.3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows "Steadied" descriptor after composure increases', () => {
    const { rerender } = renderComposure(5);
    rerender(<ComposureMeter value={7} reducedMotion={false} />);
    expect(screen.getByText('Steadied')).toBeInTheDocument();
  });

  it('clears descriptor after 3 seconds', () => {
    const { rerender } = renderComposure(5);
    rerender(<ComposureMeter value={7} reducedMotion={false} />);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Steadied')).not.toBeInTheDocument();
  });
});

describe('VitalityMeter — increase descriptor (Req 5.3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows "Mended" descriptor after vitality increases', () => {
    const { rerender } = renderVitality(5);
    rerender(<VitalityMeter value={7} reducedMotion={false} />);
    expect(screen.getByText('Mended')).toBeInTheDocument();
  });
});

// ─── Req 5.7: reducedMotion suppresses all pulse animations ──────────────────

describe('ComposureMeter — reducedMotion suppresses descriptors (Req 5.7)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not show "Shaken" when reducedMotion is true', () => {
    const { rerender } = renderComposure(8, { reducedMotion: true });
    rerender(<ComposureMeter value={5} reducedMotion={true} />);
    expect(screen.queryByText('Shaken')).not.toBeInTheDocument();
  });

  it('does not show "Steadied" when reducedMotion is true', () => {
    const { rerender } = renderComposure(5, { reducedMotion: true });
    rerender(<ComposureMeter value={8} reducedMotion={true} />);
    expect(screen.queryByText('Steadied')).not.toBeInTheDocument();
  });
});

describe('VitalityMeter — reducedMotion suppresses descriptors (Req 5.7)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not show "Bruised" when reducedMotion is true', () => {
    const { rerender } = renderVitality(8, { reducedMotion: true });
    rerender(<VitalityMeter value={5} reducedMotion={true} />);
    expect(screen.queryByText('Bruised')).not.toBeInTheDocument();
  });

  it('does not show "Mended" when reducedMotion is true', () => {
    const { rerender } = renderVitality(5, { reducedMotion: true });
    rerender(<VitalityMeter value={8} reducedMotion={true} />);
    expect(screen.queryByText('Mended')).not.toBeInTheDocument();
  });
});

// ─── ARIA / accessibility ─────────────────────────────────────────────────────

describe('ComposureMeter — ARIA attributes', () => {
  it('has correct role and aria-valuenow', () => {
    renderComposure(7);
    const meter = screen.getByRole('meter', { name: /composure/i });
    expect(meter).toHaveAttribute('aria-valuenow', '7');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '10');
  });
});

describe('VitalityMeter — ARIA attributes', () => {
  it('has correct role and aria-valuenow', () => {
    renderVitality(4);
    const meter = screen.getByRole('meter', { name: /vitality/i });
    expect(meter).toHaveAttribute('aria-valuenow', '4');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '10');
  });
});
