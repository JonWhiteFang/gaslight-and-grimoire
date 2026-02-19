/**
 * Unit tests for OutcomeBanner
 *
 * Req 16.1: Correct icon and colour for each of the five outcome tiers.
 * Req 16.5: reducedMotion — instant transitions (banner not rendered after
 *           the synchronous dismiss).
 *
 * Sub-task 8.1
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OutcomeBanner } from '../NarrativePanel/OutcomeBanner';
import type { OutcomeTier } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderBanner(
  tier: OutcomeTier,
  opts: { reducedMotion?: boolean; visible?: boolean } = {},
) {
  const { reducedMotion = false, visible = true } = opts;
  return render(
    <OutcomeBanner tier={tier} visible={visible} reducedMotion={reducedMotion} />,
  );
}

// ─── Tier config — icon and label (Req 16.1) ─────────────────────────────────

describe('OutcomeBanner — tier icons and labels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('critical: shows star icon and "Critical Success" label', () => {
    renderBanner('critical');
    expect(screen.getByRole('img', { name: /star/i })).toBeInTheDocument();
    expect(screen.getByText('Critical Success')).toBeInTheDocument();
  });

  it('success: shows checkmark icon and "Success" label', () => {
    renderBanner('success');
    expect(screen.getByRole('img', { name: /checkmark/i })).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('partial: shows warning icon and "Partial Success" label', () => {
    renderBanner('partial');
    expect(screen.getByRole('img', { name: /warning/i })).toBeInTheDocument();
    expect(screen.getByText('Partial Success')).toBeInTheDocument();
  });

  it('failure: shows X icon and "Failure" label', () => {
    renderBanner('failure');
    expect(screen.getByRole('img', { name: /^x$/i })).toBeInTheDocument();
    expect(screen.getByText('Failure')).toBeInTheDocument();
  });

  it('fumble: shows skull icon and "Critical Failure" label', () => {
    renderBanner('fumble');
    expect(screen.getByRole('img', { name: /skull/i })).toBeInTheDocument();
    expect(screen.getByText('Critical Failure')).toBeInTheDocument();
  });
});

// ─── Tier colours (Req 16.1) ─────────────────────────────────────────────────

describe('OutcomeBanner — tier colour classes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('critical: applies gold colour class', () => {
    renderBanner('critical');
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/yellow/);
  });

  it('success: applies amber colour class', () => {
    renderBanner('success');
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/amber/);
  });

  it('partial: applies muted amber colour class', () => {
    renderBanner('partial');
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/amber/);
  });

  it('failure: applies crimson colour class', () => {
    renderBanner('failure');
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/red/);
  });

  it('fumble: applies deep red colour class', () => {
    renderBanner('fumble');
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/red/);
  });
});

// ─── ARIA (Req 16.1) ─────────────────────────────────────────────────────────

describe('OutcomeBanner — ARIA labels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<[OutcomeTier, string]>([
    ['critical', 'Outcome: Critical Success'],
    ['success', 'Outcome: Success'],
    ['partial', 'Outcome: Partial Success'],
    ['failure', 'Outcome: Failure'],
    ['fumble', 'Outcome: Critical Failure'],
  ])('%s: aria-label describes the outcome', (tier, expectedLabel) => {
    renderBanner(tier);
    expect(screen.getByRole('status', { name: expectedLabel })).toBeInTheDocument();
  });
});

// ─── Not visible when visible=false ──────────────────────────────────────────

describe('OutcomeBanner — not visible', () => {
  it('renders nothing when visible is false', () => {
    const { container } = renderBanner('success', { visible: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no tier is provided', () => {
    const { container } = render(<OutcomeBanner visible={true} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─── reducedMotion: instant dismiss (Req 16.5) ───────────────────────────────

describe('OutcomeBanner — reducedMotion: true', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dismisses the banner instantly (after a single async tick)', () => {
    renderBanner('success', { reducedMotion: true });

    // The banner is shown synchronously on mount, then dismissed via
    // setTimeout(fn, 0). Advance timers to flush that callback.
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('calls onDismiss immediately when reducedMotion is true', () => {
    const onDismiss = vi.fn();
    render(
      <OutcomeBanner
        tier="success"
        visible={true}
        reducedMotion={true}
        onDismiss={onDismiss}
      />,
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ─── Normal mode: 2-second auto-dismiss (Req 16.2) ───────────────────────────

describe('OutcomeBanner — normal mode auto-dismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('banner is still visible before 2 seconds elapse', () => {
    renderBanner('success');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('banner is dismissed after 2 seconds', () => {
    renderBanner('success');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // After 2 s the shown state is false; AnimatePresence begins the exit
    // animation (opacity → 0). The element may still be in the DOM during
    // the fade, but it should have opacity 0 applied.
    const el = screen.queryByRole('status');
    if (el) {
      // Element is in exit animation — opacity should be 0
      expect(el).toHaveStyle({ opacity: '0' });
    } else {
      // Element already removed — also acceptable
      expect(el).not.toBeInTheDocument();
    }
  });

  it('calls onDismiss after 2 seconds', () => {
    const onDismiss = vi.fn();
    render(
      <OutcomeBanner
        tier="critical"
        visible={true}
        reducedMotion={false}
        onDismiss={onDismiss}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
