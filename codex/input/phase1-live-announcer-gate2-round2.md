# Codex task — Gate 2 RE-REVIEW (round 2): Phase 1 Live Announcer

## Operating rules (READ FIRST)
- Adversarial code reviewer, Gate 2 round 2. NO memory of prior sessions — all context is here.
- **Make NO repository changes except** writing to the single output file:
  `codex/output/phase1-live-announcer-gate2-round2-review.md`. Nothing else.

## Context
Round 1 (your prior review, `codex/output/phase1-live-announcer-gate2-review.md`) found two issues in
the Phase 1 Global Live Announcer (React 19 + TS, Vitest/RTL). Both were accepted and fixed:

- **Finding 1 (Med) — remount could commit non-empty live regions.** FIX: added a per-mount local
  `regionsCommitted` gate in `<LiveAnnouncer>` (state starts false; the mount effect calls
  `markAnnouncerReady()` then sets it true; while false, all four aria-live nodes render `''`
  regardless of the store snapshot). `src/announcer.ts` was deliberately NOT changed (its module-level
  persistence is correct). So every mount's first commit is empty even if the store is already
  ready+non-empty — the message then renders after the passive effect and re-announces.
- **Finding 2 (Low) — first-commit tests only covered the polite channel.** FIX: store pre-ready test
  now queues + asserts empty on BOTH channels; the component first-commit probe now inspects all four
  `[aria-live]` nodes; a new component test proves the per-mount gate (store pre-loaded ready+non-empty,
  first commit all-empty via a useLayoutEffect probe, message appears after passive effect).

Tests: 15 store + 9 component = 24 (both files green); full suite 635 pass; build green.

## Your job
Verify the fixes are correct and complete, and that they introduced NO new bug. Specifically:
1. Does the per-mount `regionsCommitted` gate actually guarantee an empty first commit on EVERY mount
   (including remount with a ready, non-empty store)? Any way text still reaches the first commit?
2. Does the gate correctly RELEASE after mount so the current message renders (not stuck empty)? Any
   race between `useSyncExternalStore` updates and the `regionsCommitted` state flip that could drop
   or duplicate an announcement?
3. StrictMode/React 19: mount effect double-invoke — `markAnnouncerReady` is idempotent and
   `setRegionsCommitted(true)` is idempotent; any concern?
4. Did the fix inadvertently break the normal first-load path, the slot-alternation re-announce, or
   the pre-mount queue flush?
5. Are the new/updated tests sound (not tautological), and do they actually exercise the remount /
   all-four-regions cases they claim?
6. Confirm `src/announcer.ts` was not changed by the fix and remains correct.
7. Any NEW issue introduced by the round-1 fixes.

## Complete post-fix code diff (070a944 → HEAD)
```diff
diff --git a/src/__tests__/announcer.test.ts b/src/__tests__/announcer.test.ts
new file mode 100644
index 0000000..51cadb8
--- /dev/null
+++ b/src/__tests__/announcer.test.ts
@@ -0,0 +1,158 @@
+import { describe, it, expect, beforeEach } from 'vitest';
+import {
+  announce,
+  getAnnouncerSnapshot,
+  markAnnouncerReady,
+  subscribeAnnouncer,
+  __resetAnnouncer,
+} from '../announcer';
+
+describe('announcer store — routing & snapshot', () => {
+  beforeEach(() => {
+    __resetAnnouncer();
+    markAnnouncerReady(); // these tests operate post-ready; readiness itself tested below
+  });
+
+  it('starts empty', () => {
+    __resetAnnouncer(); // undo the beforeEach ready
+    const s = getAnnouncerSnapshot();
+    expect(s.polite).toBe('');
+    expect(s.assertive).toBe('');
+    expect(s.ready).toBe(false);
+  });
+
+  it('routes a default message to the polite channel', () => {
+    announce('Composure restored');
+    const s = getAnnouncerSnapshot();
+    expect(s.polite).toBe('Composure restored');
+    expect(s.assertive).toBe('');
+  });
+
+  it('routes an assertive message to the assertive channel', () => {
+    announce('You have broken down', { assertive: true });
+    const s = getAnnouncerSnapshot();
+    expect(s.assertive).toBe('You have broken down');
+    expect(s.polite).toBe('');
+  });
+
+  it('returns a stable snapshot reference when nothing changed', () => {
+    const a = getAnnouncerSnapshot();
+    const b = getAnnouncerSnapshot();
+    expect(a).toBe(b); // same identity — required by useSyncExternalStore
+  });
+
+  it('returns a new snapshot reference after a change', () => {
+    const a = getAnnouncerSnapshot();
+    announce('New clue');
+    const b = getAnnouncerSnapshot();
+    expect(a).not.toBe(b);
+  });
+
+  it('ignores empty/blank messages (no-op)', () => {
+    announce('Real message');
+    const before = getAnnouncerSnapshot();
+    announce('');
+    announce('   ');
+    expect(getAnnouncerSnapshot()).toBe(before); // unchanged, same reference
+  });
+
+  it('stores a padded message trimmed', () => {
+    announce('  Clue  ');
+    expect(getAnnouncerSnapshot().polite).toBe('Clue');
+  });
+
+  it('holds both channels simultaneously without clobbering the sibling', () => {
+    announce('polite msg');
+    announce('alert', { assertive: true });
+    const s = getAnnouncerSnapshot();
+    expect(s.polite).toBe('polite msg');
+    expect(s.assertive).toBe('alert');
+  });
+});
+
+describe('announcer store — two-slot re-announce', () => {
+  beforeEach(() => {
+    __resetAnnouncer();
+    markAnnouncerReady();
+  });
+
+  it('flips the polite slot on each write so a repeat lands in a new node', () => {
+    announce('Clue added');
+    const first = getAnnouncerSnapshot().politeSlot;
+    announce('Clue added'); // identical message
+    const second = getAnnouncerSnapshot().politeSlot;
+    expect(second).not.toBe(first);
+    expect(getAnnouncerSnapshot().polite).toBe('Clue added'); // text unchanged, no nonce chars
+  });
+
+  it('keeps accessible text exactly equal to the message (no hidden chars)', () => {
+    announce('Suspicion rising');
+    expect(getAnnouncerSnapshot().polite).toBe('Suspicion rising');
+    announce('Suspicion rising');
+    expect(getAnnouncerSnapshot().polite).toBe('Suspicion rising');
+  });
+
+  it('flips the assertive slot independently of the polite slot', () => {
+    const startAssertive = getAnnouncerSnapshot().assertiveSlot;
+    announce('halt', { assertive: true });
+    expect(getAnnouncerSnapshot().assertiveSlot).not.toBe(startAssertive);
+    expect(getAnnouncerSnapshot().politeSlot).toBe(0); // polite untouched
+  });
+});
+
+describe('announcer store — readiness & queue', () => {
+  beforeEach(() => {
+    __resetAnnouncer(); // NOTE: no markAnnouncerReady() — testing pre-ready behavior
+  });
+
+  it('does not populate the snapshot before ready', () => {
+    announce('Early message');
+    announce('Early alert', { assertive: true });
+    const s = getAnnouncerSnapshot();
+    expect(s.polite).toBe(''); // queued, not rendered — first DOM commit stays empty
+    expect(s.assertive).toBe(''); // both channels stay empty pre-ready
+    expect(s.ready).toBe(false);
+  });
+
+  it('flushes the latest queued message per channel on ready', () => {
+    announce('First polite');
+    announce('Second polite'); // latest wins per channel
+    announce('An alert', { assertive: true });
+    markAnnouncerReady();
+    const s = getAnnouncerSnapshot();
+    expect(s.ready).toBe(true);
+    expect(s.polite).toBe('Second polite');
+    expect(s.assertive).toBe('An alert');
+  });
+
+  it('markAnnouncerReady is idempotent', () => {
+    markAnnouncerReady();
+    announce('After ready');
+    const afterFirst = getAnnouncerSnapshot();
+    markAnnouncerReady(); // second call must be a no-op
+    expect(getAnnouncerSnapshot()).toBe(afterFirst); // same reference, no reset
+  });
+});
+
+describe('announcer store — subscription', () => {
+  beforeEach(() => {
+    __resetAnnouncer(); // reset BEFORE subscribing (reset clears listeners)
+  });
+
+  it('notifies subscribers on ready + announce, and stops after dispose', () => {
+    let calls = 0;
+    const off = subscribeAnnouncer(() => {
+      calls += 1;
+    });
+
+    markAnnouncerReady(); // ready transition fires listeners
+    expect(calls).toBe(1);
+
+    announce('x'); // a write fires listeners
+    expect(calls).toBe(2);
+
+    off(); // disposer removes the listener
+    announce('y'); // no further notifications
+    expect(calls).toBe(2);
+  });
+});
diff --git a/src/announcer.ts b/src/announcer.ts
new file mode 100644
index 0000000..d3faffd
--- /dev/null
+++ b/src/announcer.ts
@@ -0,0 +1,104 @@
+/**
+ * Global screen-reader announcer store (UI/UX roadmap Phase 1).
+ *
+ * A tiny framework-agnostic external store consumed by <LiveAnnouncer> via
+ * useSyncExternalStore. Holds the current polite/assertive messages, an
+ * active-slot toggle per channel (so a repeated identical message re-announces
+ * by moving to a different DOM node — no zero-width nonce), a `ready` flag, and
+ * a per-channel pre-ready queue so an announce() before the regions mount is not
+ * rendered as initial content (which screen readers do not announce).
+ *
+ * Deterministic: no Date.now()/Math.random().
+ */
+
+export interface AnnouncerSnapshot {
+  polite: string;
+  assertive: string;
+  politeSlot: 0 | 1;
+  assertiveSlot: 0 | 1;
+  ready: boolean;
+}
+
+const EMPTY: AnnouncerSnapshot = {
+  polite: '',
+  assertive: '',
+  politeSlot: 0,
+  assertiveSlot: 0,
+  ready: false,
+};
+
+let snapshot: AnnouncerSnapshot = EMPTY;
+const listeners = new Set<() => void>();
+
+// Latest queued message per channel, held until markAnnouncerReady() flushes it.
+let queuedPolite: string | null = null;
+let queuedAssertive: string | null = null;
+
+function emit(): void {
+  for (const l of listeners) l();
+}
+
+/** Write a message into a channel, flipping that channel's active slot. */
+function write(channel: 'polite' | 'assertive', message: string): void {
+  if (channel === 'polite') {
+    snapshot = { ...snapshot, polite: message, politeSlot: snapshot.politeSlot === 0 ? 1 : 0 };
+  } else {
+    snapshot = { ...snapshot, assertive: message, assertiveSlot: snapshot.assertiveSlot === 0 ? 1 : 0 };
+  }
+  emit();
+}
+
+export function announce(message: string, opts?: { assertive?: boolean }): void {
+  const text = message.trim();
+  if (text === '') return; // ignore empty/blank
+  const channel = opts?.assertive ? 'assertive' : 'polite';
+
+  if (!snapshot.ready) {
+    // Queue the latest message per channel; do NOT populate the snapshot yet,
+    // so the region's first DOM commit stays empty.
+    if (channel === 'polite') queuedPolite = text;
+    else queuedAssertive = text;
+    return;
+  }
+  write(channel, text);
+}
+
+export function markAnnouncerReady(): void {
+  if (snapshot.ready) return; // idempotent (StrictMode double-invoke, HMR)
+  snapshot = { ...snapshot, ready: true };
+  emit();
+  // Flush any messages queued before mount.
+  if (queuedPolite !== null) {
+    const m = queuedPolite;
+    queuedPolite = null;
+    write('polite', m);
+  }
+  if (queuedAssertive !== null) {
+    const m = queuedAssertive;
+    queuedAssertive = null;
+    write('assertive', m);
+  }
+}
+
+export function subscribeAnnouncer(listener: () => void): () => void {
+  listeners.add(listener);
+  return () => {
+    listeners.delete(listener);
+  };
+}
+
+export function getAnnouncerSnapshot(): AnnouncerSnapshot {
+  return snapshot;
+}
+
+/**
+ * Test-only: restore initial state. NOTE: this clears listeners, so never call
+ * it after rendering a live subscriber within the same test — it silently drops
+ * that subscription. Planned tests only call it in beforeEach(), before render.
+ */
+export function __resetAnnouncer(): void {
+  snapshot = EMPTY;
+  queuedPolite = null;
+  queuedAssertive = null;
+  listeners.clear();
+}
diff --git a/src/components/LiveAnnouncer/LiveAnnouncer.tsx b/src/components/LiveAnnouncer/LiveAnnouncer.tsx
new file mode 100644
index 0000000..795599f
--- /dev/null
+++ b/src/components/LiveAnnouncer/LiveAnnouncer.tsx
@@ -0,0 +1,44 @@
+/**
+ * LiveAnnouncer — the app's single, always-mounted screen-reader announcer
+ * (UI/UX roadmap Phase 1). Renders two sr-only aria-live nodes per channel
+ * (polite, assertive) so a repeated identical message re-announces by moving to
+ * the other slot. Subscribes to the announcer store and marks it ready on mount
+ * (after the empty regions have committed). Mount this ONCE at the app root
+ * (src/main.tsx), never inside a per-screen wrapper.
+ */
+import { useSyncExternalStore, useEffect, useState } from 'react';
+import { subscribeAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../announcer';
+
+export function LiveAnnouncer() {
+  const snapshot = useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot);
+
+  // Per-mount empty-commit gate. The store's `ready` flag + messages persist at
+  // module level, so on a remount (Fast Refresh, tests, a future root swap) the
+  // snapshot may already be non-empty. Without this gate the first commit of the
+  // new mount would render that text as *initial* region content, which screen
+  // readers do not announce. Starting empty every mount, then flipping this flag
+  // in the passive effect below, guarantees each mount's first commit is empty so
+  // the message renders as a *change* to a pre-existing region.
+  const [regionsCommitted, setRegionsCommitted] = useState(false);
+
+  // Runs AFTER the empty regions have committed: mark the store ready (flushing
+  // any pre-mount queued message) and open the local gate so the snapshot text
+  // can render.
+  useEffect(() => {
+    markAnnouncerReady();
+    setRegionsCommitted(true);
+  }, []);
+
+  const { polite, assertive, politeSlot, assertiveSlot } = snapshot;
+  const politeText = regionsCommitted ? polite : '';
+  const assertiveText = regionsCommitted ? assertive : '';
+
+  return (
+    <>
+      <div aria-live="polite" className="sr-only">{politeSlot === 0 ? politeText : ''}</div>
+      <div aria-live="polite" className="sr-only">{politeSlot === 1 ? politeText : ''}</div>
+      <div aria-live="assertive" className="sr-only">{assertiveSlot === 0 ? assertiveText : ''}</div>
+      <div aria-live="assertive" className="sr-only">{assertiveSlot === 1 ? assertiveText : ''}</div>
+    </>
+  );
+}
diff --git a/src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx b/src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx
new file mode 100644
index 0000000..1d20ea7
--- /dev/null
+++ b/src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx
@@ -0,0 +1,128 @@
+import { describe, it, expect, beforeEach } from 'vitest';
+import { useLayoutEffect } from 'react';
+import { render, act } from '@testing-library/react';
+import { LiveAnnouncer } from '../LiveAnnouncer';
+import { announce, __resetAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../../announcer';
+
+describe('<LiveAnnouncer>', () => {
+  beforeEach(() => {
+    __resetAnnouncer();
+  });
+
+  it('renders four sr-only aria-live nodes (two polite, two assertive)', () => {
+    const { container } = render(<LiveAnnouncer />);
+    expect(container.querySelectorAll('[aria-live="polite"]').length).toBe(2);
+    expect(container.querySelectorAll('[aria-live="assertive"]').length).toBe(2);
+  });
+
+  it('marks the announcer ready on mount', () => {
+    render(<LiveAnnouncer />);
+    expect(getAnnouncerSnapshot().ready).toBe(true);
+  });
+
+  it('renders a polite announcement into exactly one polite slot', () => {
+    const { container } = render(<LiveAnnouncer />);
+    act(() => announce('Composure restored'));
+    const texts = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
+    expect(texts).toContain('Composure restored');
+    expect(texts.filter((t) => t === 'Composure restored').length).toBe(1);
+  });
+
+  it('renders an assertive announcement into an assertive slot only', () => {
+    const { container } = render(<LiveAnnouncer />);
+    act(() => announce('You have broken down', { assertive: true }));
+    const assertive = [...container.querySelectorAll('[aria-live="assertive"]')].map((n) => n.textContent);
+    const polite = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
+    expect(assertive).toContain('You have broken down');
+    expect(polite.every((t) => t === '')).toBe(true);
+  });
+
+  it('re-announces a repeated identical message by moving it to the other slot', () => {
+    const { container } = render(<LiveAnnouncer />);
+    const politeNodes = () => [...container.querySelectorAll('[aria-live="polite"]')];
+    act(() => announce('Clue added'));
+    const firstHolder = politeNodes().findIndex((n) => n.textContent === 'Clue added');
+    act(() => announce('Clue added'));
+    const secondHolder = politeNodes().findIndex((n) => n.textContent === 'Clue added');
+    expect(secondHolder).not.toBe(firstHolder); // different node → re-announced
+  });
+
+  it('re-announces a repeated identical assertive message by moving it to the other slot', () => {
+    const { container } = render(<LiveAnnouncer />);
+    const assertiveNodes = () => [...container.querySelectorAll('[aria-live="assertive"]')];
+    act(() => announce('Alarm', { assertive: true }));
+    const firstHolder = assertiveNodes().findIndex((n) => n.textContent === 'Alarm');
+    act(() => announce('Alarm', { assertive: true }));
+    const secondHolder = assertiveNodes().findIndex((n) => n.textContent === 'Alarm');
+    expect(secondHolder).not.toBe(firstHolder); // different node → re-announced
+  });
+
+  // Prove the pre-existence contract: a message announced BEFORE mount must NOT be
+  // present at first commit (it is queued), and must appear only after the mount
+  // effect flips ready and flushes it.
+  it('does not render a pre-mount queued message at first commit; flushes it after mount', () => {
+    announce('Early message'); // before <LiveAnnouncer> mounts
+    announce('Early alert', { assertive: true });
+    let textsAtFirstCommit: (string | null)[] | null = null;
+    function Probe() {
+      // useLayoutEffect runs after commit but before passive effects → observes the
+      // first committed DOM state, before LiveAnnouncer's own (passive) mount effect.
+      useLayoutEffect(() => {
+        textsAtFirstCommit = [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent);
+      }, []);
+      return null;
+    }
+    const { container } = render(<><LiveAnnouncer /><Probe /></>);
+    // All four regions (both polite + both assertive) empty at first commit — the
+    // pre-existence guarantee across both channels.
+    expect(textsAtFirstCommit).toEqual(['', '', '', '']);
+    const polite = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
+    const assertive = [...container.querySelectorAll('[aria-live="assertive"]')].map((n) => n.textContent);
+    expect(polite).toContain('Early message'); // flushed after ready
+    expect(assertive).toContain('Early alert');
+  });
+
+  // Per-mount empty-commit gate: even when the store is ALREADY ready and holds a
+  // non-empty message (as after a remount), the fresh mount's first commit must be
+  // empty so the message re-announces as a change to a pre-existing region.
+  it('starts empty on a mount into an already-ready, non-empty store, then renders the message', () => {
+    markAnnouncerReady(); // store is already ready...
+    announce('Pre-existing'); // ...and already holds a message (as after a remount)
+    expect(getAnnouncerSnapshot().ready).toBe(true);
+    expect(getAnnouncerSnapshot().polite).toBe('Pre-existing');
+
+    let textsAtFirstCommit: (string | null)[] | null = null;
+    function Probe() {
+      useLayoutEffect(() => {
+        textsAtFirstCommit = [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent);
+      }, []);
+      return null;
+    }
+    const { container } = render(<><LiveAnnouncer /><Probe /></>);
+    // Empty at first commit despite the store already being ready+non-empty.
+    expect(textsAtFirstCommit).toEqual(['', '', '', '']);
+    const polite = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
+    expect(polite).toContain('Pre-existing'); // rendered after the passive effect opens the gate
+  });
+
+  // A real screen-switch / error-boundary persistence guard: the announcer must sit
+  // ABOVE a conditionally-rendered app subtree and survive that subtree being swapped.
+  it('keeps its live-region nodes when a sibling app subtree is swapped (screen switch / error)', () => {
+    function Harness({ screen }: { screen: 'a' | 'b' }) {
+      return (
+        <>
+          <LiveAnnouncer />
+          {screen === 'a' ? <div data-testid="screen-a">A</div> : <div data-testid="screen-b">B</div>}
+        </>
+      );
+    }
+    const { container, rerender } = render(<Harness screen="a" />);
+    const before = container.querySelector('[aria-live="polite"]');
+    act(() => announce('Persisted'));
+    rerender(<Harness screen="b" />); // sibling subtree replaced, as on a screen change
+    const after = container.querySelector('[aria-live="polite"]');
+    expect(after).toBe(before); // same node — announcer never unmounted
+    const texts = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
+    expect(texts).toContain('Persisted'); // and its content survived the swap
+  });
+});
diff --git a/src/components/LiveAnnouncer/index.ts b/src/components/LiveAnnouncer/index.ts
new file mode 100644
index 0000000..6ccc6c6
--- /dev/null
+++ b/src/components/LiveAnnouncer/index.ts
@@ -0,0 +1 @@
+export { LiveAnnouncer } from './LiveAnnouncer';
diff --git a/src/main.tsx b/src/main.tsx
index e50c58a..785b28b 100644
--- a/src/main.tsx
+++ b/src/main.tsx
@@ -3,6 +3,7 @@ import ReactDOM from 'react-dom/client';
 import { LazyMotion, domAnimation } from 'framer-motion';
 import App from './App';
 import { ErrorBoundary } from './components/ErrorBoundary';
+import { LiveAnnouncer } from './components/LiveAnnouncer';
 import './index.css';
 import { initAudioSubscription } from './store/audioSubscription';
 
@@ -10,6 +11,10 @@ initAudioSubscription();
 
 ReactDOM.createRoot(document.getElementById('root')!).render(
   <React.StrictMode>
+    {/* Always-mounted screen-reader announcer (UI/UX Phase 1). Sits OUTSIDE
+        ErrorBoundary so a caught app error can't unmount the live regions;
+        components call announce() from src/announcer.ts. */}
+    <LiveAnnouncer />
     <ErrorBoundary>
       {/* LazyMotion + the `m` component (F-046): the animation feature bundle
           (`domAnimation`) loads once here instead of every `motion.*` import
```

## Output
Write `codex/output/phase1-live-announcer-gate2-round2-review.md`:
- Confirm each round-1 finding is properly resolved (or not).
- Any NEW findings (severity + concrete failure + fix).
- **Overall verdict:** sound to merge as-is, or must something still change? Be explicit.
