import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutEffect } from 'react';
import { render, act } from '@testing-library/react';
import { LiveAnnouncer } from '../LiveAnnouncer';
import { announce, __resetAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../../announcer';

describe('<LiveAnnouncer>', () => {
  beforeEach(() => {
    __resetAnnouncer();
  });

  it('renders four sr-only aria-live nodes (two polite, two assertive)', () => {
    const { container } = render(<LiveAnnouncer />);
    expect(container.querySelectorAll('[aria-live="polite"]').length).toBe(2);
    expect(container.querySelectorAll('[aria-live="assertive"]').length).toBe(2);
  });

  it('marks the announcer ready on mount', () => {
    render(<LiveAnnouncer />);
    expect(getAnnouncerSnapshot().ready).toBe(true);
  });

  it('renders a polite announcement into exactly one polite slot', () => {
    const { container } = render(<LiveAnnouncer />);
    act(() => announce('Composure restored'));
    const texts = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
    expect(texts).toContain('Composure restored');
    expect(texts.filter((t) => t === 'Composure restored').length).toBe(1);
  });

  it('renders an assertive announcement into an assertive slot only', () => {
    const { container } = render(<LiveAnnouncer />);
    act(() => announce('You have broken down', { assertive: true }));
    const assertive = [...container.querySelectorAll('[aria-live="assertive"]')].map((n) => n.textContent);
    const polite = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
    expect(assertive).toContain('You have broken down');
    expect(polite.every((t) => t === '')).toBe(true);
  });

  it('re-announces a repeated identical message by moving it to the other slot', () => {
    const { container } = render(<LiveAnnouncer />);
    const politeNodes = () => [...container.querySelectorAll('[aria-live="polite"]')];
    act(() => announce('Clue added'));
    const firstHolder = politeNodes().findIndex((n) => n.textContent === 'Clue added');
    act(() => announce('Clue added'));
    const secondHolder = politeNodes().findIndex((n) => n.textContent === 'Clue added');
    expect(secondHolder).not.toBe(firstHolder); // different node → re-announced
  });

  it('re-announces a repeated identical assertive message by moving it to the other slot', () => {
    const { container } = render(<LiveAnnouncer />);
    const assertiveNodes = () => [...container.querySelectorAll('[aria-live="assertive"]')];
    act(() => announce('Alarm', { assertive: true }));
    const firstHolder = assertiveNodes().findIndex((n) => n.textContent === 'Alarm');
    act(() => announce('Alarm', { assertive: true }));
    const secondHolder = assertiveNodes().findIndex((n) => n.textContent === 'Alarm');
    expect(secondHolder).not.toBe(firstHolder); // different node → re-announced
  });

  // Prove the pre-existence contract: a message announced BEFORE mount must NOT be
  // present at first commit (it is queued), and must appear only after the mount
  // effect flips ready and flushes it.
  it('does not render a pre-mount queued message at first commit; flushes it after mount', () => {
    announce('Early message'); // before <LiveAnnouncer> mounts
    announce('Early alert', { assertive: true });
    let textsAtFirstCommit: (string | null)[] | null = null;
    function Probe() {
      // useLayoutEffect runs after commit but before passive effects → observes the
      // first committed DOM state, before LiveAnnouncer's own (passive) mount effect.
      useLayoutEffect(() => {
        textsAtFirstCommit = [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent);
      }, []);
      return null;
    }
    const { container } = render(<><LiveAnnouncer /><Probe /></>);
    // All four regions (both polite + both assertive) empty at first commit — the
    // pre-existence guarantee across both channels.
    expect(textsAtFirstCommit).toEqual(['', '', '', '']);
    const polite = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
    const assertive = [...container.querySelectorAll('[aria-live="assertive"]')].map((n) => n.textContent);
    expect(polite).toContain('Early message'); // flushed after ready
    expect(assertive).toContain('Early alert');
  });

  // Per-mount empty-commit gate: even when the store is ALREADY ready and holds a
  // non-empty message (as after a remount), the fresh mount's first commit must be
  // empty so the message re-announces as a change to a pre-existing region.
  it('starts empty on a mount into an already-ready, non-empty store, then renders the message', () => {
    markAnnouncerReady(); // store is already ready...
    announce('Pre-existing'); // ...and already holds a message (as after a remount)
    expect(getAnnouncerSnapshot().ready).toBe(true);
    expect(getAnnouncerSnapshot().polite).toBe('Pre-existing');

    let textsAtFirstCommit: (string | null)[] | null = null;
    function Probe() {
      useLayoutEffect(() => {
        textsAtFirstCommit = [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent);
      }, []);
      return null;
    }
    const { container } = render(<><LiveAnnouncer /><Probe /></>);
    // Empty at first commit despite the store already being ready+non-empty.
    expect(textsAtFirstCommit).toEqual(['', '', '', '']);
    const polite = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
    expect(polite).toContain('Pre-existing'); // rendered after the passive effect opens the gate
  });

  // A real screen-switch / error-boundary persistence guard: the announcer must sit
  // ABOVE a conditionally-rendered app subtree and survive that subtree being swapped.
  it('keeps its live-region nodes when a sibling app subtree is swapped (screen switch / error)', () => {
    function Harness({ screen }: { screen: 'a' | 'b' }) {
      return (
        <>
          <LiveAnnouncer />
          {screen === 'a' ? <div data-testid="screen-a">A</div> : <div data-testid="screen-b">B</div>}
        </>
      );
    }
    const { container, rerender } = render(<Harness screen="a" />);
    const before = container.querySelector('[aria-live="polite"]');
    act(() => announce('Persisted'));
    rerender(<Harness screen="b" />); // sibling subtree replaced, as on a screen change
    const after = container.querySelector('[aria-live="polite"]');
    expect(after).toBe(before); // same node — announcer never unmounted
    const texts = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
    expect(texts).toContain('Persisted'); // and its content survived the swap
  });
});
