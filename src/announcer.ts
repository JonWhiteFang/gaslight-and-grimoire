/**
 * Global screen-reader announcer store (UI/UX roadmap Phase 1).
 *
 * A tiny framework-agnostic external store consumed by <LiveAnnouncer> via
 * useSyncExternalStore. Holds the current polite/assertive messages, an
 * active-slot toggle per channel (so a repeated identical message re-announces
 * by moving to a different DOM node — no zero-width nonce), a `ready` flag, and
 * a per-channel pre-ready queue so an announce() before the regions mount is not
 * rendered as initial content (which screen readers do not announce).
 *
 * Deterministic: no Date.now()/Math.random().
 */

export interface AnnouncerSnapshot {
  polite: string;
  assertive: string;
  politeSlot: 0 | 1;
  assertiveSlot: 0 | 1;
  ready: boolean;
}

const EMPTY: AnnouncerSnapshot = {
  polite: '',
  assertive: '',
  politeSlot: 0,
  assertiveSlot: 0,
  ready: false,
};

let snapshot: AnnouncerSnapshot = EMPTY;
const listeners = new Set<() => void>();

// Latest queued message per channel, held until markAnnouncerReady() flushes it.
let queuedPolite: string | null = null;
let queuedAssertive: string | null = null;

function emit(): void {
  for (const l of listeners) l();
}

/** Write a message into a channel, flipping that channel's active slot. */
function write(channel: 'polite' | 'assertive', message: string): void {
  if (channel === 'polite') {
    snapshot = { ...snapshot, polite: message, politeSlot: snapshot.politeSlot === 0 ? 1 : 0 };
  } else {
    snapshot = { ...snapshot, assertive: message, assertiveSlot: snapshot.assertiveSlot === 0 ? 1 : 0 };
  }
  emit();
}

export function announce(message: string, opts?: { assertive?: boolean }): void {
  const text = message.trim();
  if (text === '') return; // ignore empty/blank
  const channel = opts?.assertive ? 'assertive' : 'polite';

  if (!snapshot.ready) {
    // Queue the latest message per channel; do NOT populate the snapshot yet,
    // so the region's first DOM commit stays empty.
    if (channel === 'polite') queuedPolite = text;
    else queuedAssertive = text;
    return;
  }
  write(channel, text);
}

export function markAnnouncerReady(): void {
  if (snapshot.ready) return; // idempotent (StrictMode double-invoke, HMR)
  snapshot = { ...snapshot, ready: true };
  emit();
  // Flush any messages queued before mount.
  if (queuedPolite !== null) {
    const m = queuedPolite;
    queuedPolite = null;
    write('polite', m);
  }
  if (queuedAssertive !== null) {
    const m = queuedAssertive;
    queuedAssertive = null;
    write('assertive', m);
  }
}

export function subscribeAnnouncer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAnnouncerSnapshot(): AnnouncerSnapshot {
  return snapshot;
}

/**
 * Test-only: restore initial state. NOTE: this clears listeners, so never call
 * it after rendering a live subscriber within the same test — it silently drops
 * that subscription. Planned tests only call it in beforeEach(), before render.
 */
export function __resetAnnouncer(): void {
  snapshot = EMPTY;
  queuedPolite = null;
  queuedAssertive = null;
  listeners.clear();
}
