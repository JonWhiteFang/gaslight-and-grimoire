# Codex task — Gate 2 adversarial review: Phase 1 Live Announcer (complete diff)

## Operating rules (READ FIRST)
- You are an **adversarial code reviewer** (Gate 2). You have NO memory of prior sessions — all
  context is in this file and the repo.
- **Make NO changes to the repository** except writing your review to the single output file named
  below. Do not edit, create, or delete any other file. Do not apply patches.
- **Output file (the ONLY thing you may write):**
  `codex/output/phase1-live-announcer-gate2-review.md`
- Be focused. The complete code diff is inlined below; you may also read the files directly at HEAD
  (`src/announcer.ts`, `src/components/LiveAnnouncer/*`, `src/main.tsx`) to confirm.

## What you are reviewing
The COMPLETE implementation diff for Phase 1 "Global Live Announcer", from the branch's start commit
`070a944` (branch point off main) to HEAD `953a0ce`. Assume the code contains at least one bug,
security issue, or missed edge case — and find it.

## Goal & the Gate-1 plan this implemented
A GLOBAL SCREEN-READER ANNOUNCER (pure substrate) for the game Gaslight & Grimoire (React 19 +
TypeScript, Vitest 4 + RTL/jsdom, Tailwind v4). It is the substrate later phases call via `announce()`.
Design + plan already passed Gate 1 (see `codex/output/phase1-live-announcer-gate1-review.md` and
`...-plan-gate1-review.md`). The plan specified:
- `src/announcer.ts` — framework-agnostic external store: state `{polite, assertive, politeSlot 0|1,
  assertiveSlot 0|1, ready}`; `announce()` trims + no-ops on blank, routes polite/assertive, queues
  latest-per-channel when not ready (WITHOUT populating the snapshot), else writes; `write` flips the
  channel's slot and replaces the snapshot object (cached-snapshot contract for useSyncExternalStore);
  `markAnnouncerReady()` idempotent, flips ready, flushes queue; `subscribeAnnouncer`, `getAnnouncerSnapshot`,
  `__resetAnnouncer`. No Date.now()/Math.random().
- `src/components/LiveAnnouncer/LiveAnnouncer.tsx` — `useSyncExternalStore(subscribeAnnouncer,
  getAnnouncerSnapshot)`; `markAnnouncerReady()` in a mount effect; renders FOUR sr-only aria-live
  nodes (two polite, two assertive), each showing the message only when its slot matches, else ''.
- `src/main.tsx` — mounts `<LiveAnnouncer/>` as a sibling BEFORE `<ErrorBoundary>` inside StrictMode.
- **No store-subscription** (Phase 1 emits no store events — they already have local aria-live coverage).

## Constraints
- Determinism: no Date.now()/Math.random().
- Additive scope: NO existing aria-live region modified. (Verified: the only src files changed are
  announcer.ts, LiveAnnouncer/*, main.tsx.)
- aria-live pre-existence: the four region nodes must commit EMPTY before any content.

## Complete code diff (070a944 → HEAD)
```diff
diff --git a/src/__tests__/announcer.test.ts b/src/__tests__/announcer.test.ts
new file mode 100644
index 0000000..d5a6efa
--- /dev/null
+++ b/src/__tests__/announcer.test.ts
@@ -0,0 +1,156 @@
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
+    const s = getAnnouncerSnapshot();
+    expect(s.polite).toBe(''); // queued, not rendered — first DOM commit stays empty
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
index 0000000..0f5920e
--- /dev/null
+++ b/src/components/LiveAnnouncer/LiveAnnouncer.tsx
@@ -0,0 +1,31 @@
+/**
+ * LiveAnnouncer — the app's single, always-mounted screen-reader announcer
+ * (UI/UX roadmap Phase 1). Renders two sr-only aria-live nodes per channel
+ * (polite, assertive) so a repeated identical message re-announces by moving to
+ * the other slot. Subscribes to the announcer store and marks it ready on mount
+ * (after the empty regions have committed). Mount this ONCE at the app root
+ * (src/main.tsx), never inside a per-screen wrapper.
+ */
+import { useSyncExternalStore, useEffect } from 'react';
+import { subscribeAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../announcer';
+
+export function LiveAnnouncer() {
+  const snapshot = useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot);
+
+  // Mark ready AFTER the empty regions have committed, so the first DOM state is
+  // empty (screen readers only announce changes to a pre-existing region).
+  useEffect(() => {
+    markAnnouncerReady();
+  }, []);
+
+  const { polite, assertive, politeSlot, assertiveSlot } = snapshot;
+
+  return (
+    <>
+      <div aria-live="polite" className="sr-only">{politeSlot === 0 ? polite : ''}</div>
+      <div aria-live="polite" className="sr-only">{politeSlot === 1 ? polite : ''}</div>
+      <div aria-live="assertive" className="sr-only">{assertiveSlot === 0 ? assertive : ''}</div>
+      <div aria-live="assertive" className="sr-only">{assertiveSlot === 1 ? assertive : ''}</div>
+    </>
+  );
+}
diff --git a/src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx b/src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx
new file mode 100644
index 0000000..633ebb8
--- /dev/null
+++ b/src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx
@@ -0,0 +1,100 @@
+import { describe, it, expect, beforeEach } from 'vitest';
+import { useLayoutEffect } from 'react';
+import { render, act } from '@testing-library/react';
+import { LiveAnnouncer } from '../LiveAnnouncer';
+import { announce, __resetAnnouncer, getAnnouncerSnapshot } from '../../../announcer';
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
+    let textAtFirstCommit: string | null = null;
+    function Probe() {
+      // useLayoutEffect runs after commit but before passive effects → observes the
+      // first committed DOM state, before LiveAnnouncer's own (passive) mount effect.
+      useLayoutEffect(() => {
+        textAtFirstCommit = document.querySelector('[aria-live="polite"]')?.textContent ?? null;
+      }, []);
+      return null;
+    }
+    const { container } = render(<><LiveAnnouncer /><Probe /></>);
+    expect(textAtFirstCommit).toBe(''); // empty at first commit — the pre-existence guarantee
+    const texts = [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent);
+    expect(texts).toContain('Early message'); // flushed after ready
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

## Questions to address (prioritized findings — severity, concrete failure, suggested fix)
1. **Correctness of the store:** any bug in `announce`/`write`/`markAnnouncerReady`? Consider: trimmed
   text is stored (both queue and write) — consistent? pre-ready announce leaves snapshot empty?
   queue is latest-per-channel? idempotent ready? snapshot reference stable when unchanged and new on
   change (useSyncExternalStore contract)?
2. **Slot logic:** does exactly one node per channel ever hold the message (the other empty)? Does a
   repeated identical message always land in a DIFFERENT node (the re-announce guarantee)? Any state
   where the same node holds it twice consecutively?
3. **Pre-existence contract:** is the first committed DOM state guaranteed empty (ready starts false,
   snapshot empty, mount effect flips ready)? Could a pre-mount `announce()` ever render as initial
   content? Any React 19 / StrictMode double-invoke hazard given `markAnnouncerReady` idempotence?
4. **main.tsx placement:** correct that `<LiveAnnouncer/>` is outside ErrorBoundary and outside
   LazyMotion, sibling before ErrorBoundary inside StrictMode? Any regression risk?
5. **Test integrity:** do the tests actually verify behavior (not tautologies/mocks)? Is the
   useLayoutEffect first-commit probe a sound, non-flaky way to observe the pre-existence guarantee?
   Any gap that would let a real regression pass?
6. **Divergence from the Gate-1 plan:** anything implemented differently from the plan above? (e.g.
   an accidental store-subscription, a changed signature, an extra file.)
7. **Any security / a11y correctness issue** (e.g. bare aria-live vs role, sr-only visibility).
8. **Anything simpler** that's clearly better for Phase 1's scope.

## Output format
Write to `codex/output/phase1-live-announcer-gate2-review.md`:
- Prioritized findings — each with severity (High/Med/Low), concrete failure, suggested fix.
- Note genuinely-sound parts (don't invent problems).
- End with an **overall verdict**: is the implementation sound to merge as-is, or must specific things
  change first? List must-change items explicitly.
