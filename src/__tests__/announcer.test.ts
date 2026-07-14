import { describe, it, expect, beforeEach } from 'vitest';
import {
  announce,
  getAnnouncerSnapshot,
  markAnnouncerReady,
  subscribeAnnouncer,
  __resetAnnouncer,
} from '../announcer';

describe('announcer store — routing & snapshot', () => {
  beforeEach(() => {
    __resetAnnouncer();
    markAnnouncerReady(); // these tests operate post-ready; readiness itself tested below
  });

  it('starts empty', () => {
    __resetAnnouncer(); // undo the beforeEach ready
    const s = getAnnouncerSnapshot();
    expect(s.polite).toBe('');
    expect(s.assertive).toBe('');
    expect(s.ready).toBe(false);
  });

  it('routes a default message to the polite channel', () => {
    announce('Composure restored');
    const s = getAnnouncerSnapshot();
    expect(s.polite).toBe('Composure restored');
    expect(s.assertive).toBe('');
  });

  it('routes an assertive message to the assertive channel', () => {
    announce('You have broken down', { assertive: true });
    const s = getAnnouncerSnapshot();
    expect(s.assertive).toBe('You have broken down');
    expect(s.polite).toBe('');
  });

  it('returns a stable snapshot reference when nothing changed', () => {
    const a = getAnnouncerSnapshot();
    const b = getAnnouncerSnapshot();
    expect(a).toBe(b); // same identity — required by useSyncExternalStore
  });

  it('returns a new snapshot reference after a change', () => {
    const a = getAnnouncerSnapshot();
    announce('New clue');
    const b = getAnnouncerSnapshot();
    expect(a).not.toBe(b);
  });

  it('ignores empty/blank messages (no-op)', () => {
    announce('Real message');
    const before = getAnnouncerSnapshot();
    announce('');
    announce('   ');
    expect(getAnnouncerSnapshot()).toBe(before); // unchanged, same reference
  });

  it('stores a padded message trimmed', () => {
    announce('  Clue  ');
    expect(getAnnouncerSnapshot().polite).toBe('Clue');
  });

  it('holds both channels simultaneously without clobbering the sibling', () => {
    announce('polite msg');
    announce('alert', { assertive: true });
    const s = getAnnouncerSnapshot();
    expect(s.polite).toBe('polite msg');
    expect(s.assertive).toBe('alert');
  });
});

describe('announcer store — two-slot re-announce', () => {
  beforeEach(() => {
    __resetAnnouncer();
    markAnnouncerReady();
  });

  it('flips the polite slot on each write so a repeat lands in a new node', () => {
    announce('Clue added');
    const first = getAnnouncerSnapshot().politeSlot;
    announce('Clue added'); // identical message
    const second = getAnnouncerSnapshot().politeSlot;
    expect(second).not.toBe(first);
    expect(getAnnouncerSnapshot().polite).toBe('Clue added'); // text unchanged, no nonce chars
  });

  it('keeps accessible text exactly equal to the message (no hidden chars)', () => {
    announce('Suspicion rising');
    expect(getAnnouncerSnapshot().polite).toBe('Suspicion rising');
    announce('Suspicion rising');
    expect(getAnnouncerSnapshot().polite).toBe('Suspicion rising');
  });

  it('flips the assertive slot independently of the polite slot', () => {
    const startAssertive = getAnnouncerSnapshot().assertiveSlot;
    announce('halt', { assertive: true });
    expect(getAnnouncerSnapshot().assertiveSlot).not.toBe(startAssertive);
    expect(getAnnouncerSnapshot().politeSlot).toBe(0); // polite untouched
  });
});

describe('announcer store — readiness & queue', () => {
  beforeEach(() => {
    __resetAnnouncer(); // NOTE: no markAnnouncerReady() — testing pre-ready behavior
  });

  it('does not populate the snapshot before ready', () => {
    announce('Early message');
    const s = getAnnouncerSnapshot();
    expect(s.polite).toBe(''); // queued, not rendered — first DOM commit stays empty
    expect(s.ready).toBe(false);
  });

  it('flushes the latest queued message per channel on ready', () => {
    announce('First polite');
    announce('Second polite'); // latest wins per channel
    announce('An alert', { assertive: true });
    markAnnouncerReady();
    const s = getAnnouncerSnapshot();
    expect(s.ready).toBe(true);
    expect(s.polite).toBe('Second polite');
    expect(s.assertive).toBe('An alert');
  });

  it('markAnnouncerReady is idempotent', () => {
    markAnnouncerReady();
    announce('After ready');
    const afterFirst = getAnnouncerSnapshot();
    markAnnouncerReady(); // second call must be a no-op
    expect(getAnnouncerSnapshot()).toBe(afterFirst); // same reference, no reset
  });
});

describe('announcer store — subscription', () => {
  beforeEach(() => {
    __resetAnnouncer(); // reset BEFORE subscribing (reset clears listeners)
  });

  it('notifies subscribers on ready + announce, and stops after dispose', () => {
    let calls = 0;
    const off = subscribeAnnouncer(() => {
      calls += 1;
    });

    markAnnouncerReady(); // ready transition fires listeners
    expect(calls).toBe(1);

    announce('x'); // a write fires listeners
    expect(calls).toBe(2);

    off(); // disposer removes the listener
    announce('y'); // no further notifications
    expect(calls).toBe(2);
  });
});
