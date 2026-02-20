/**
 * Unit tests for AccessibilityProvider — settings propagation to DOM
 *
 * Req 12.1: Font size controls affect all narrative text, choice cards, and UI labels.
 * Req 12.4: Reduced motion mode disables animations.
 *
 * Sub-task 22.1
 *
 * Strategy: render <AccessibilityProvider> with a mocked store state and
 * assert document.documentElement class list and inline style.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { AccessibilityProvider } from '../AccessibilityProvider/AccessibilityProvider';
import type { GameSettings } from '../../types';

// ─── Mock the Zustand store ───────────────────────────────────────────────────

// We mock only the `useSettings` hook so we can control settings in tests
// without needing a real store.
const mockSettings: GameSettings = {
  fontSize: 'standard',
  highContrast: false,
  reducedMotion: false,
  textSpeed: 'typewriter',
  hintsEnabled: true,
  autoSaveFrequency: 'scene',
  audioVolume: { ambient: 0.6, sfx: 0.8 },
};

vi.mock('../../store', () => ({
  useSettings: () => mockSettings,
  useMetaActions: () => ({ updateSettings: vi.fn() }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderProvider(settings: Partial<GameSettings>) {
  Object.assign(mockSettings, settings);
  return render(
    <AccessibilityProvider>
      <div data-testid="child" />
    </AccessibilityProvider>,
  );
}

// ─── Cleanup DOM between tests ────────────────────────────────────────────────

beforeEach(() => {
  document.documentElement.classList.remove('reduced-motion', 'high-contrast');
  document.documentElement.style.removeProperty('--font-size-base');
  document.documentElement.style.removeProperty('--high-contrast');
  // Reset mock settings to defaults
  Object.assign(mockSettings, {
    fontSize: 'standard',
    highContrast: false,
    reducedMotion: false,
    textSpeed: 'typewriter',
    hintsEnabled: true,
    autoSaveFrequency: 'scene',
    audioVolume: { ambient: 0.6, sfx: 0.8 },
  });
});

afterEach(() => {
  document.documentElement.classList.remove('reduced-motion', 'high-contrast');
  document.documentElement.style.removeProperty('--font-size-base');
  document.documentElement.style.removeProperty('--high-contrast');
});

// ─── reducedMotion class (Req 12.4) ──────────────────────────────────────────

describe('AccessibilityProvider — reducedMotion class', () => {
  it('adds "reduced-motion" class to documentElement when reducedMotion is true', () => {
    renderProvider({ reducedMotion: true });
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });

  it('does not add "reduced-motion" class when reducedMotion is false', () => {
    renderProvider({ reducedMotion: false });
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
  });
});

// ─── highContrast class (Req 12.2) ───────────────────────────────────────────

describe('AccessibilityProvider — highContrast class', () => {
  it('adds "high-contrast" class to documentElement when highContrast is true', () => {
    renderProvider({ highContrast: true });
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
  });

  it('does not add "high-contrast" class when highContrast is false', () => {
    renderProvider({ highContrast: false });
    expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
  });
});

// ─── --font-size-base CSS custom property (Req 12.1) ─────────────────────────

describe('AccessibilityProvider — --font-size-base CSS property', () => {
  it('sets --font-size-base to "16px" when fontSize is "standard"', () => {
    renderProvider({ fontSize: 'standard' });
    expect(
      document.documentElement.style.getPropertyValue('--font-size-base'),
    ).toBe('16px');
  });

  it('sets --font-size-base to "20px" when fontSize is "large"', () => {
    renderProvider({ fontSize: 'large' });
    expect(
      document.documentElement.style.getPropertyValue('--font-size-base'),
    ).toBe('20px');
  });

  it('sets --font-size-base to "24px" when fontSize is "extraLarge"', () => {
    renderProvider({ fontSize: 'extraLarge' });
    expect(
      document.documentElement.style.getPropertyValue('--font-size-base'),
    ).toBe('24px');
  });

  it('sets --font-size-base to the numeric value in px when fontSize is a number', () => {
    renderProvider({ fontSize: 18 });
    expect(
      document.documentElement.style.getPropertyValue('--font-size-base'),
    ).toBe('18px');
  });
});

// ─── Children are rendered ────────────────────────────────────────────────────

describe('AccessibilityProvider — transparent wrapper', () => {
  it('renders children without adding wrapper DOM elements', () => {
    const { getByTestId } = renderProvider({});
    expect(getByTestId('child')).toBeInTheDocument();
  });
});
