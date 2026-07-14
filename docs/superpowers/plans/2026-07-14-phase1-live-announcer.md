# Phase 1 Live Announcer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a global screen-reader announcer — an always-mounted pair of `aria-live` regions plus an `announce()` API any component can call — as pure substrate for later UI/UX phases.

**Architecture:** A framework-agnostic external store (`src/announcer.ts`) holds the current polite/assertive messages, an active-slot toggle per channel, and a `ready` flag with a per-channel pre-mount queue. A `<LiveAnnouncer>` React component subscribes via `useSyncExternalStore`, renders four `sr-only` `aria-live` nodes (two slots per channel so a repeated identical message re-announces), and calls `markAnnouncerReady()` from a mount effect. It mounts once in `main.tsx` at the true root (outside `ErrorBoundary`) so the region nodes never unmount across screen changes. **No store-subscription** — Phase 1 emits no store events (they already have local `aria-live` coverage).

**Tech Stack:** React 19 (`useSyncExternalStore`), TypeScript, Vitest 4 + React Testing Library (jsdom), Tailwind v4 (`sr-only` builtin).

**Spec:** `docs/superpowers/specs/2026-07-14-phase1-live-announcer-design.md` (revised after Codex Gate 1).

---

## File Structure

- **Create `src/announcer.ts`** — the external announcer store. Owns state (`polite`, `assertive`, `politeSlot`, `assertiveSlot`, `ready`), the per-channel pre-ready queue, the cached snapshot, and the public API: `announce()`, `subscribeAnnouncer()`, `getAnnouncerSnapshot()`, `markAnnouncerReady()`, `__resetAnnouncer()`. No React, no Zustand.
- **Create `src/components/LiveAnnouncer/LiveAnnouncer.tsx`** — the React component. Subscribes to the store, renders four `sr-only` `aria-live` nodes, calls `markAnnouncerReady()` on mount.
- **Create `src/components/LiveAnnouncer/index.ts`** — barrel export (repo convention).
- **Create `src/__tests__/announcer.test.ts`** — store unit tests.
- **Create `src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx`** — component RTL tests.
- **Modify `src/main.tsx`** — render `<LiveAnnouncer />` at the root, outside `ErrorBoundary`.

Types/API defined once in `src/announcer.ts` and reused everywhere:

```ts
export interface AnnouncerSnapshot {
  polite: string;
  assertive: string;
  politeSlot: 0 | 1;
  assertiveSlot: 0 | 1;
  ready: boolean;
}
export function announce(message: string, opts?: { assertive?: boolean }): void;
export function subscribeAnnouncer(listener: () => void): () => void;
export function getAnnouncerSnapshot(): AnnouncerSnapshot;
export function markAnnouncerReady(): void;
export function __resetAnnouncer(): void;
```

---

## Task 1: Announcer store — polite/assertive routing & cached snapshot

**Files:**
- Create: `src/announcer.ts`
- Test: `src/__tests__/announcer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/announcer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  announce,
  getAnnouncerSnapshot,
  markAnnouncerReady,
  __resetAnnouncer,
} from '../announcer';

describe('announcer store — routing & snapshot', () => {
  beforeEach(() => {
    __resetAnnouncer();
    markAnnouncerReady(); // most tests operate post-ready; readiness itself is tested in Task 3
  });

  it('starts empty', () => {
    __resetAnnouncer();
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
    expect(a).toBe(b); // same object identity — required by useSyncExternalStore
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/announcer.test.ts`
Expected: FAIL — `Cannot find module '../announcer'` / exports undefined.

- [ ] **Step 3: Write the minimal store implementation**

```ts
// src/announcer.ts
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
    snapshot = {
      ...snapshot,
      polite: message,
      politeSlot: snapshot.politeSlot === 0 ? 1 : 0,
    };
  } else {
    snapshot = {
      ...snapshot,
      assertive: message,
      assertiveSlot: snapshot.assertiveSlot === 0 ? 1 : 0,
    };
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
    if (channel === 'polite') queuedPolite = message;
    else queuedAssertive = message;
    return;
  }
  write(channel, message);
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

/** Test-only: restore initial state. */
export function __resetAnnouncer(): void {
  snapshot = EMPTY;
  queuedPolite = null;
  queuedAssertive = null;
  listeners.clear();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/announcer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/announcer.ts src/__tests__/announcer.test.ts
git commit -m "feat: announcer store — polite/assertive routing + cached snapshot"
```

---

## Task 2: Announcer store — two-slot re-announce (repeat handling)

**Files:**
- Modify: `src/announcer.ts` (no code change expected — this task proves the slot behavior; if a test fails, fix here)
- Test: `src/__tests__/announcer.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/__tests__/announcer.test.ts
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
    expect(second).not.toBe(first); // slot toggled → different DOM node → re-announced
    expect(getAnnouncerSnapshot().polite).toBe('Clue added'); // text unchanged, no nonce chars
  });

  it('keeps the accessible text exactly equal to the message (no hidden chars)', () => {
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
```

- [ ] **Step 2: Run tests to verify status**

Run: `npx vitest run src/__tests__/announcer.test.ts`
Expected: PASS (the Task 1 `write()` already toggles slots). If any FAIL, fix `write()` in `src/announcer.ts` until green — do not weaken the tests.

- [ ] **Step 3: (Only if a test failed) fix `write()`**

If the slot toggle was wrong, the fix is in the `write()` function from Task 1: ensure each write sets the channel's slot to the opposite of its current value. No new code otherwise.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/announcer.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/announcer.test.ts src/announcer.ts
git commit -m "test: announcer two-slot re-announce keeps text == message"
```

---

## Task 3: Announcer store — readiness & pre-mount queue

**Files:**
- Modify: `src/announcer.ts` (no change expected — Task 1 implemented this; prove it)
- Test: `src/__tests__/announcer.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/__tests__/announcer.test.ts
describe('announcer store — readiness & queue', () => {
  beforeEach(() => {
    __resetAnnouncer(); // NOTE: no markAnnouncerReady() here — testing pre-ready behavior
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
```

- [ ] **Step 2: Run tests to verify status**

Run: `npx vitest run src/__tests__/announcer.test.ts`
Expected: PASS (Task 1 already implements readiness + queue + idempotence). If FAIL, fix `announce()`/`markAnnouncerReady()` in `src/announcer.ts`.

- [ ] **Step 3: (Only if failed) fix readiness logic**

Ensure: pre-ready `announce()` writes to `queuedPolite`/`queuedAssertive` and leaves `snapshot` empty; `markAnnouncerReady()` sets `ready`, emits, then flushes queued messages; a second `markAnnouncerReady()` returns early.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/announcer.test.ts`
Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/announcer.test.ts src/announcer.ts
git commit -m "test: announcer readiness gate + pre-mount queue flush"
```

---

## Task 4: `<LiveAnnouncer>` component

**Files:**
- Create: `src/components/LiveAnnouncer/LiveAnnouncer.tsx`
- Create: `src/components/LiveAnnouncer/index.ts`
- Test: `src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { LiveAnnouncer } from '../LiveAnnouncer';
import { announce, __resetAnnouncer, getAnnouncerSnapshot } from '../../../announcer';

describe('<LiveAnnouncer>', () => {
  beforeEach(() => {
    __resetAnnouncer();
  });

  it('renders four sr-only aria-live nodes (two polite, two assertive), empty on first commit', () => {
    const { container } = render(<LiveAnnouncer />);
    const polite = container.querySelectorAll('[aria-live="polite"]');
    const assertive = container.querySelectorAll('[aria-live="assertive"]');
    expect(polite.length).toBe(2);
    expect(assertive.length).toBe(2);
    // All empty at first paint (the pre-exist requirement).
    [...polite, ...assertive].forEach((n) => expect(n.textContent).toBe(''));
  });

  it('marks the announcer ready on mount', () => {
    render(<LiveAnnouncer />);
    expect(getAnnouncerSnapshot().ready).toBe(true);
  });

  it('renders a polite announcement into exactly one polite slot', () => {
    const { container } = render(<LiveAnnouncer />);
    act(() => announce('Composure restored'));
    const polite = container.querySelectorAll('[aria-live="polite"]');
    const texts = [...polite].map((n) => n.textContent);
    expect(texts).toContain('Composure restored');
    expect(texts.filter((t) => t === 'Composure restored').length).toBe(1); // only one slot holds it
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
    expect(secondHolder).not.toBe(firstHolder); // different node → screen reader re-announces
  });

  it('keeps the same DOM nodes across a parent re-render (persistence guard)', () => {
    const { container, rerender } = render(
      <div><LiveAnnouncer /></div>,
    );
    const before = container.querySelector('[aria-live="polite"]');
    rerender(<div><LiveAnnouncer /></div>); // simulate a surrounding re-render / screen switch
    const after = container.querySelector('[aria-live="polite"]');
    expect(after).toBe(before); // identical node — never unmounted
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx`
Expected: FAIL — `Cannot find module '../LiveAnnouncer'`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/LiveAnnouncer/LiveAnnouncer.tsx
/**
 * LiveAnnouncer — the app's single, always-mounted screen-reader announcer
 * (UI/UX roadmap Phase 1). Renders two sr-only aria-live nodes per channel
 * (polite, assertive) so a repeated identical message re-announces by moving to
 * the other slot. Subscribes to the announcer store and marks it ready on mount
 * (after the empty regions have committed). Mount this ONCE at the app root
 * (src/main.tsx), never inside a per-screen wrapper.
 */
import { useSyncExternalStore, useEffect } from 'react';
import {
  subscribeAnnouncer,
  getAnnouncerSnapshot,
  markAnnouncerReady,
} from '../../announcer';

export function LiveAnnouncer() {
  const snapshot = useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot);

  // Mark ready AFTER the empty regions have committed, so the first DOM state
  // is empty (screen readers only announce changes to a pre-existing region).
  useEffect(() => {
    markAnnouncerReady();
  }, []);

  const { polite, assertive, politeSlot, assertiveSlot } = snapshot;

  return (
    <>
      <div aria-live="polite" className="sr-only">{politeSlot === 0 ? polite : ''}</div>
      <div aria-live="polite" className="sr-only">{politeSlot === 1 ? polite : ''}</div>
      <div aria-live="assertive" className="sr-only">{assertiveSlot === 0 ? assertive : ''}</div>
      <div aria-live="assertive" className="sr-only">{assertiveSlot === 1 ? assertive : ''}</div>
    </>
  );
}
```

```ts
// src/components/LiveAnnouncer/index.ts
export { LiveAnnouncer } from './LiveAnnouncer';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx`
Expected: PASS (6 tests).

Note on the slot logic: after the first `announce('Clue added')`, `politeSlot` toggled to `1`, so the message renders in the *second* node (`politeSlot === 1 ? polite`). After the repeat, `politeSlot` toggles to `0`, rendering in the *first* node. Each write lands in the opposite node — the re-announce guarantee.

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveAnnouncer/
git commit -m "feat: LiveAnnouncer component (four sr-only slots, ready-on-mount)"
```

---

## Task 5: Mount `<LiveAnnouncer>` at the app root

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Read the current `main.tsx`**

Run: `sed -n '1,25p' src/main.tsx`
Confirm it matches the "before" below before editing.

- [ ] **Step 2: Edit `main.tsx` — add the import and mount the component outside `ErrorBoundary`**

Before:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initAudioSubscription } from './store/audioSubscription';

initAudioSubscription();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* LazyMotion + the `m` component (F-046): ... */}
      <LazyMotion features={domAnimation}>
        <App />
      </LazyMotion>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

After (add the `LiveAnnouncer` import; render it as a sibling BEFORE `ErrorBoundary` so an app error that unmounts the boundary subtree does not unmount the announcer):
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import './index.css';
import { initAudioSubscription } from './store/audioSubscription';

initAudioSubscription();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Always-mounted screen-reader announcer (UI/UX Phase 1). Sits OUTSIDE
        ErrorBoundary so a caught app error can't unmount the live regions;
        components call announce() from src/announcer.ts. */}
    <LiveAnnouncer />
    <ErrorBoundary>
      {/* LazyMotion + the `m` component (F-046): ... */}
      <LazyMotion features={domAnimation}>
        <App />
      </LazyMotion>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

(Keep the existing `LazyMotion` comment text as-is; only the import line and the `<LiveAnnouncer />` line + its comment are added.)

- [ ] **Step 3: Verify the app still builds and the full suite is green**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean; all tests pass (including the new announcer + LiveAnnouncer suites); build succeeds.

- [ ] **Step 4: Manually verify in the browser (evidence before completion)**

Run: `npm run dev`, open the app, and in DevTools confirm four `[aria-live]` nodes exist at the root (siblings of the app container) and are empty on load. Optionally, in the console: `import('/src/announcer.ts').then(m => m.announce('test'))` is not available in prod build — instead trigger a real path in a later phase. For Phase 1, DOM presence + empty-on-load is the observable behavior.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx
git commit -m "feat: mount LiveAnnouncer at app root (outside ErrorBoundary)"
```

---

## Task 6: Full-suite regression + docs

**Files:**
- (No source changes) — verification + optional status note.

- [ ] **Step 1: Run the full CI-equivalent battery**

Run: `npm run lint && node scripts/validateCase.mjs && npm run test:run && npm run build`
Expected: all green. Record the new test count (previous baseline 611 + the new announcer/LiveAnnouncer tests).

- [ ] **Step 2: Confirm no existing `aria-live` region changed**

Run: `git diff main --stat -- src/components src/store | grep -vE 'LiveAnnouncer|announcer'`
Expected: only `src/main.tsx` appears (plus non-`aria-live` files if any). No edits to `SceneText`, meters, `EffectFeedback`, save toast, `DiceRollOverlay`, etc. (additive-scope guarantee).

- [ ] **Step 3: Commit any doc/status note (if the repo's status.md tracks the test baseline)**

```bash
# only if you updated docs/status.md test baseline
git add docs/status.md
git commit -m "docs: bump test baseline for Phase 1 announcer"
```

---

## Review gates

- **Gate 1 (this plan):** submit to Codex via `codex/input/` before starting Task 1; address findings; re-review if needed.
- **Gate 2 (the diff):** before declaring complete, submit the full diff vs. the start commit to Codex via `codex/input/`. Tell it the Gate-1 plan so it can flag divergence.
- Standard TDD throughout: every implementation step is preceded by a failing test (RED watched), then made green.

---

## Self-review notes

- **Spec coverage:** announcer store (Tasks 1–3), `<LiveAnnouncer>` (Task 4), `main.tsx` mount outside `ErrorBoundary` (Task 5), no store-subscription (absent by design), readiness/queue (Task 3), two-slot re-announce (Tasks 2, 4), cached snapshot (Task 1), StrictMode-idempotent ready (Task 3 + Task 4 mount), additive-scope guard (Task 6 Step 2). All spec sections map to a task.
- **Types consistent:** `AnnouncerSnapshot`, `announce`, `subscribeAnnouncer`, `getAnnouncerSnapshot`, `markAnnouncerReady`, `__resetAnnouncer` are defined once in Task 1 and used identically in Tasks 2–5.
- **Determinism:** no `Date.now()`/`Math.random()`; slot toggle is a deterministic boolean flip.
