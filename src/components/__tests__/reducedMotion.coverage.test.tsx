/**
 * Reduced-motion coverage (Phase 4 WS1).
 *
 * COVERAGE TABLE — every animation source, the observable prop each reduced-motion
 * branch neutralizes, and how it is guarded. The framer-motion mock serializes only
 * `initial`/`transition`/`whileTap` (animate/exit are derived and DISCARDED — see the
 * mock), so a row's "asserted prop" column names what this suite can actually observe,
 * NOT every prop the component gates:
 *   .reduced-motion * (index.css)       CSS 0ms anim/transition       structural CSS test
 *   ConnectionThread m.path             → plain <path> (no marker)    absence-of-m marker
 *   OutcomeBanner AnimatePresence       → plain div (no marker)       absence-of-m marker
 *   DiceRollOverlay (card + die)        initial=false + transition 0  captured-props assert
 *   ClueDiscoveryCard                   initial (no x) + transition 0 captured-props assert
 *   EffectFeedback                      initial (no x) + transition 0 captured-props assert
 *   HintButton trigger (m.button)       transition 0                  captured-props assert
 *   HintButton popover (m.div)          transition 0                  captured-props assert
 *   DeductionButton                     whileTap removed (null)       captured-props assert
 *   ComposureMeter width                transition 0                  captured-props assert
 *   VitalityMeter width                 transition 0                  captured-props assert
 *   StatusBar meter animate-pulse       prop-gated CSS class          StatusBar.test.tsx (kept)
 *   SceneText typewriter                instant/reduced path          SceneText.test.tsx (kept)
 *   Ghost thread m.path                 EXEMPT — pointer-tracking direct-manipulation, not reveal
 *
 * Approach (Codex Major 1): mock framer-motion so every m.<tag> renders a plain
 * host element that serializes its motion props into data-* attributes we can read.
 * Components that switch to a PLAIN element under reduced motion (ConnectionThread,
 * OutcomeBanner) are guarded by the ABSENCE of the data-motion marker; the rest are
 * guarded by inspecting the captured (serialized) motion props. `animate`/`exit` are
 * intentionally not serialized (they're derived from initial/transition and would just
 * duplicate the assertion surface), so no row claims to assert them.
 */
/// <reference types="node" />
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read src/index.css as source text. NOTE: Vite's `?raw` query resolves to an
// EMPTY string under Vitest (the CSS pipeline strips it), so we read the source
// off disk instead — this test is a source-deletion guard, not a behavioral one
// (jsdom applies no styles anyway). Resolve relative to THIS module (not cwd) so
// the read is independent of where Vitest is invoked from. `resolve` pops the
// filename first, so from src/components/__tests__/<file> the three `..` climb
// file → __tests__ → components → src, landing on src/index.css.
const cssRaw = readFileSync(
  resolve(fileURLToPath(import.meta.url), '../../../index.css'),
  'utf8',
);

vi.mock('framer-motion', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const makeTag = (tag: string) =>
    React.forwardRef((props: any, ref: any) => {
      // animate/exit/whileHover are destructured only to strip them from `rest`
      // (so they aren't spread onto a real DOM node); the branches we guard live
      // in initial/transition/whileTap, which we serialize below.
      const {
        initial,
        animate: _animate,
        exit: _exit,
        transition,
        whileTap,
        whileHover: _whileHover,
        children,
        ...rest
      } = props;
      return React.createElement(
        tag,
        {
          ...rest,
          ref,
          'data-motion': 'true',
          'data-initial': JSON.stringify(initial ?? null),
          'data-transition': JSON.stringify(transition ?? null),
          'data-whiletap': JSON.stringify(whileTap ?? null),
        },
        children,
      );
    });
  const m = new Proxy({}, { get: (_t, tag: string) => makeTag(tag) });
  return {
    m,
    motion: m,
    AnimatePresence: ({ children }: any) => children,
    LazyMotion: ({ children }: any) => children,
    domAnimation: {},
  };
});

// hintEngine is a stateful singleton; mock its gates so HintButton renders
// deterministically without waiting on real dwell/board thresholds.
vi.mock('../../engine/hintEngine', () => ({
  shouldShowHint: () => true,
  getHint: () => ({ level: 1, text: 'A hint.' }),
}));

// Imports AFTER the mock so components pick up the mocked m.
import { ConnectionThread } from '../EvidenceBoard/ConnectionThread';
import { OutcomeBanner } from '../NarrativePanel/OutcomeBanner';
import { DiceRollOverlay } from '../NarrativePanel/DiceRollOverlay';
import { ClueDiscoveryCard } from '../NarrativePanel/ClueDiscoveryCard';
import { EffectFeedback } from '../NarrativePanel/EffectFeedback';
import { HintButton } from '../HeaderBar/HintButton';
import { DeductionButton } from '../EvidenceBoard/DeductionButton';
import { ComposureMeter } from '../StatusBar/ComposureMeter';
import { VitalityMeter } from '../StatusBar/VitalityMeter';
import { useStore } from '../../store';
import type { Clue, GameSettings, GameState, Investigator } from '../../types';

// Baselines for the store-touching tests (HintButton, DeductionButton). Typed so a
// future Investigator/GameSettings shape change is caught at compile time rather
// than silently accepted (avoids `as never`).
const baseInvestigator: Investigator = {
  name: 'T',
  archetype: 'deductionist',
  abilityUsed: false,
  faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
  composure: 10,
  vitality: 10,
};

const baseSettings: GameSettings = {
  fontSize: 'standard',
  highContrast: false,
  reducedMotion: false,
  textSpeed: 'typewriter',
  hintsEnabled: true,
  autoSaveFrequency: 'scene',
  audioVolume: { ambient: 0.6, sfx: 0.8 },
};

// Reset barrier: the store is a shared singleton, so tests that mutate settings /
// investigator must not bleed into siblings. Restore a clean baseline after each.
afterEach(() => {
  useStore.setState({ settings: { ...baseSettings }, investigator: { ...baseInvestigator } });
});

// NOTE: no diceEngine mock — the DeductionButton test only inspects the rendered
// `data-whiletap` attribute and never clicks, so performCheck is never called.
// diceEngine has no import-time side effects, so the real module imports cleanly.

const parse = (el: Element | null, attr: string): unknown =>
  JSON.parse(el?.getAttribute(attr) ?? 'null');

// ─── 1. Structural CSS guard ────────────────────────────────────────────────
describe('reduced-motion — structural CSS guard', () => {
  it('.reduced-motion * zeroes animation and transition duration', () => {
    const match = cssRaw.match(/\.reduced-motion \*\s*\{[^}]*\}/);
    expect(match).not.toBeNull();
    const rule = match![0];
    expect(rule).toContain('animation-duration: 0ms');
    expect(rule).toContain('transition-duration: 0ms');
  });
});

// ─── 2. Plain-element gates (absence of data-motion) ─────────────────────────
describe('reduced-motion — components that drop to a plain element', () => {
  it('ConnectionThread renders a plain <path> (no data-motion) for an active thread', () => {
    const { container } = render(
      <ConnectionThread
        connections={[
          {
            fromId: 'a',
            toId: 'b',
            fromPoint: { x: 0, y: 0 },
            toPoint: { x: 100, y: 100 },
            state: 'active',
          },
        ]}
        reducedMotion
      />,
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('data-motion')).toBeNull();
  });

  it('OutcomeBanner renders a plain status div (no data-motion) under reduced motion', async () => {
    render(<OutcomeBanner tier="success" visible reducedMotion />);
    // shown is set in a useEffect, so wait for the status element to appear.
    const banner = await waitFor(() =>
      screen.getByRole('status', { name: /^Outcome/ }),
    );
    expect(banner.getAttribute('data-motion')).toBeNull();
  });
});

// ─── 3. Captured-prop gates (motion params neutralized) ──────────────────────
describe('reduced-motion — captured motion props are neutralized', () => {
  it('DiceRollOverlay: card initial is false and every transition has duration 0', () => {
    const { container } = render(
      <DiceRollOverlay roll={12} modifier={2} total={14} dc={10} visible reducedMotion />,
    );
    // card is the sole element carrying initial={reducedMotion ? false : ...}
    const withInitialFalse = Array.from(container.querySelectorAll('[data-initial]')).filter(
      (el) => el.getAttribute('data-initial') === 'false',
    );
    expect(withInitialFalse.length).toBeGreaterThan(0);

    // Every motion element that carries an object transition must have duration 0.
    const transitioned = Array.from(container.querySelectorAll('[data-transition]'))
      .map((el) => parse(el, 'data-transition'))
      .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object');
    expect(transitioned.length).toBeGreaterThan(0);
    for (const t of transitioned) {
      expect(t.duration).toBe(0);
    }
  });

  it('ClueDiscoveryCard: reduced-motion initial has no x offset', () => {
    const clue: Clue = {
      id: 'c1',
      type: 'physical',
      title: 'A Torn Ticket',
      description: 'Half a railway stub.',
      sceneSource: 's',
      connectsTo: [],
      tags: [],
      status: 'examined',
      isRevealed: true,
    };
    render(<ClueDiscoveryCard clue={clue} visible reducedMotion />);
    const card = screen.getByRole('status', { name: /Clue Discovered/ });
    const initial = parse(card, 'data-initial') as Record<string, unknown>;
    expect(initial).not.toBeNull();
    expect(initial).not.toHaveProperty('x');
    expect(initial).toEqual({ opacity: 0 });
    // The slide-in ALSO gates its transition to duration 0 (independent branch);
    // neutralizing only `initial` would still leave a 0.3s fade otherwise.
    const transition = parse(card, 'data-transition') as Record<string, unknown>;
    expect(transition).not.toBeNull();
    expect(transition.duration).toBe(0);
  });

  it('EffectFeedback: reduced-motion initial has no x offset', () => {
    render(<EffectFeedback messages={['Your composure steadies.']} reducedMotion />);
    const msg = screen.getByRole('status');
    const initial = parse(msg, 'data-initial') as Record<string, unknown>;
    expect(initial).not.toBeNull();
    expect(initial).not.toHaveProperty('x');
    expect(initial).toEqual({ opacity: 1 });
    // Independent transition gate: reduced motion also zeroes the fade/delay
    // (the non-reduced branch is { duration: 0.3, delay: i * 0.15 }).
    const transition = parse(msg, 'data-transition') as Record<string, unknown>;
    expect(transition).not.toBeNull();
    expect(transition.duration).toBe(0);
  });

  it('HintButton: reduced-motion trigger AND popover transition duration is 0', () => {
    useStore.getState().updateSettings({ reducedMotion: true, hintsEnabled: true });
    const gameState = { currentScene: 'scene-1' } as GameState;
    render(<HintButton gameState={gameState} />);
    // The trigger button (m.button) has its OWN reduced-motion transition gate,
    // independent of the popover's — the fade-in is { duration: 0.6 } otherwise.
    const trigger = screen.getByRole('button', { name: /Show hint/i });
    const triggerTransition = parse(trigger, 'data-transition') as Record<string, unknown>;
    expect(triggerTransition).not.toBeNull();
    expect(triggerTransition.duration).toBe(0);
    // Click the trigger to reveal the popover, which carries its own transition prop.
    fireEvent.click(trigger);
    const popover = screen.getByRole('status', { name: /Hint level/i });
    const transition = parse(popover, 'data-transition') as Record<string, unknown>;
    expect(transition).not.toBeNull();
    expect(transition.duration).toBe(0);
  });

  it('DeductionButton: reduced-motion removes whileTap (captured as null)', () => {
    useStore.setState({ investigator: { ...baseInvestigator } });
    useStore.getState().updateSettings({ reducedMotion: true });
    render(<DeductionButton connectedClueIds={['a', 'b']} onResult={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Attempt Deduction/i });
    expect(btn.getAttribute('data-whiletap')).toBe('null');
  });

  it('ComposureMeter: reduced-motion width bar transition duration is 0', () => {
    render(<ComposureMeter value={2} reducedMotion />);
    const bar = document.querySelector('[data-testid="composure-bar"]');
    expect(bar).not.toBeNull();
    const transition = parse(bar, 'data-transition') as Record<string, unknown>;
    expect(transition).not.toBeNull();
    expect(transition.duration).toBe(0);
  });

  it('VitalityMeter: reduced-motion width bar transition duration is 0', () => {
    // VitalityMeter's width bar has its OWN reduced-motion transition gate,
    // independent of ComposureMeter's — { duration: 0.4, ease: 'easeOut' } otherwise.
    render(<VitalityMeter value={2} reducedMotion />);
    const bar = document.querySelector('[data-testid="vitality-bar"]');
    expect(bar).not.toBeNull();
    const transition = parse(bar, 'data-transition') as Record<string, unknown>;
    expect(transition).not.toBeNull();
    expect(transition.duration).toBe(0);
  });
});
