# Codex task — Gate 1 adversarial review: Phase 1 Live Announcer *implementation plan*

## Operating rules (READ FIRST)
- You are an **adversarial plan reviewer** (Gate 1). You have NO memory of prior sessions — all
  context is in this file and the repo.
- **Make NO changes to the repository** except writing your review to the single output file named
  below. Do not edit, create, or delete any other file. Do not run formatters or apply patches.
- **Output file (the ONLY thing you may write):**
  `codex/output/phase1-live-announcer-plan-gate1-review.md`
- Be focused; don't burn budget exploring. Key code is inlined below — read a repo file only to
  confirm a specific claim (e.g. `src/main.tsx`, `src/test-setup.ts`).

## What you are reviewing
The **implementation plan**: `docs/superpowers/plans/2026-07-14-phase1-live-announcer.md`. Read it.
Then attack it — assume it contains at least one bug, incorrect test, ordering hazard, or divergence
from the spec, and find it.

The plan implements this **design spec** (already passed Gate 1 separately):
`docs/superpowers/specs/2026-07-14-phase1-live-announcer-design.md`. The prior design review is at
`codex/output/phase1-live-announcer-gate1-review.md` (its 5 findings are already folded into the spec
and plan). Do NOT re-litigate the design; review whether the PLAN correctly and safely implements it.

## Feature recap
A GLOBAL SCREEN-READER ANNOUNCER for "Gaslight & Grimoire" (React 19 + TypeScript, Vitest 4 + React
Testing Library / jsdom, Tailwind v4). Pure substrate for later phases. Two units:
- `src/announcer.ts` — framework-agnostic external store (state: `polite`, `assertive`, `politeSlot`,
  `assertiveSlot`, `ready`; a per-channel pre-ready queue; cached snapshot). API: `announce()`,
  `subscribeAnnouncer()`, `getAnnouncerSnapshot()`, `markAnnouncerReady()`, `__resetAnnouncer()`.
- `src/components/LiveAnnouncer/LiveAnnouncer.tsx` — subscribes via `useSyncExternalStore`, renders
  FOUR `sr-only` `aria-live` nodes (two per channel so a repeated identical message re-announces by
  moving to the other slot), calls `markAnnouncerReady()` from a mount effect. Mounted once in
  `src/main.tsx` at the root, OUTSIDE `ErrorBoundary`. **No store-subscription** (Phase 1 emits no
  store events — they already have local `aria-live` coverage).

## Design constraints the plan must honor
- **Determinism:** no `Date.now()`/`Math.random()`.
- **Additive scope:** must NOT modify the ~18 existing local `aria-live` regions (`SceneText` F-049,
  save toast, `EffectFeedback`, `ComposureMeter`/`VitalityMeter`, `DiceRollOverlay`, etc.).
- **aria-live pre-existence:** the region nodes must commit EMPTY before any content, or screen
  readers won't announce. Hence readiness + pre-mount queue, and mount above the screen switch.

## Inlined plan artifacts (so you needn't reconstruct them)

### `src/announcer.ts` (as the plan specifies)
```ts
export interface AnnouncerSnapshot {
  polite: string; assertive: string;
  politeSlot: 0 | 1; assertiveSlot: 0 | 1;
  ready: boolean;
}
const EMPTY: AnnouncerSnapshot = { polite:'', assertive:'', politeSlot:0, assertiveSlot:0, ready:false };
let snapshot: AnnouncerSnapshot = EMPTY;
const listeners = new Set<() => void>();
let queuedPolite: string | null = null;
let queuedAssertive: string | null = null;
function emit() { for (const l of listeners) l(); }
function write(channel: 'polite'|'assertive', message: string) {
  if (channel === 'polite') snapshot = { ...snapshot, polite: message, politeSlot: snapshot.politeSlot === 0 ? 1 : 0 };
  else snapshot = { ...snapshot, assertive: message, assertiveSlot: snapshot.assertiveSlot === 0 ? 1 : 0 };
  emit();
}
export function announce(message: string, opts?: { assertive?: boolean }) {
  const text = message.trim();
  if (text === '') return;
  const channel = opts?.assertive ? 'assertive' : 'polite';
  if (!snapshot.ready) { if (channel === 'polite') queuedPolite = message; else queuedAssertive = message; return; }
  write(channel, message);
}
export function markAnnouncerReady() {
  if (snapshot.ready) return;
  snapshot = { ...snapshot, ready: true }; emit();
  if (queuedPolite !== null) { const m = queuedPolite; queuedPolite = null; write('polite', m); }
  if (queuedAssertive !== null) { const m = queuedAssertive; queuedAssertive = null; write('assertive', m); }
}
export function subscribeAnnouncer(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getAnnouncerSnapshot() { return snapshot; }
export function __resetAnnouncer() { snapshot = EMPTY; queuedPolite = null; queuedAssertive = null; listeners.clear(); }
```

### `src/components/LiveAnnouncer/LiveAnnouncer.tsx` (as specified)
```tsx
import { useSyncExternalStore, useEffect } from 'react';
import { subscribeAnnouncer, getAnnouncerSnapshot, markAnnouncerReady } from '../../announcer';
export function LiveAnnouncer() {
  const snapshot = useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot);
  useEffect(() => { markAnnouncerReady(); }, []);
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

### `src/main.tsx` change (the plan renders `<LiveAnnouncer/>` before `<ErrorBoundary>`)
```tsx
<React.StrictMode>
  <LiveAnnouncer />
  <ErrorBoundary>
    <LazyMotion features={domAnimation}><App /></LazyMotion>
  </ErrorBoundary>
</React.StrictMode>
```

### Repo test facts
- Vitest 4 + React Testing Library + jsdom; `src/test-setup.ts` mocks `howler`. Tests run via
  `npx vitest run <file>` or `npm run test:run`.
- The plan's component tests use `render`, `rerender`, and `act` from `@testing-library/react`.

## Questions to address (prioritized findings — each: severity, concrete failure, suggested fix)
1. **Slot-toggle correctness.** Trace the two-slot logic. Initial `politeSlot=0`. After
   `announce('x')`, `write` sets `politeSlot=1`, so the component renders `x` in the node guarded by
   `politeSlot === 1` (the SECOND node). After a repeat, `politeSlot=0` → FIRST node. (a) Is the
   re-announce guarantee actually satisfied (message lands in a different DOM node each time)? (b) Do
   the plan's assertions in Task 2 (store `politeSlot` flips) and Task 4 (component `findIndex`
   differs) both hold given this trace? (c) Is there any state where the *same* node holds the message
   twice in a row?
2. **`useSyncExternalStore` + StrictMode.** The store snapshot is a cached module-level object
   replaced only on change — good. But: (a) `subscribeAnnouncer` returns a fresh unsubscribe closure
   each call — fine? (b) Under React 19 StrictMode, the mount effect runs twice and `__resetAnnouncer`
   is NOT called between; is `markAnnouncerReady()`'s idempotence sufficient, or can the double-invoke
   cause a missed/duplicate announcement? (c) Any tearing risk given a single module store?
3. **Readiness race in tests.** In the component tests, `render(<LiveAnnouncer/>)` runs the mount
   effect (→ `markAnnouncerReady`) — but does RTL flush effects synchronously so that a subsequent
   `act(() => announce(...))` sees `ready === true`? If effects are deferred, could the announce be
   queued instead of written, breaking the assertion? Suggest a fix if so.
4. **`__resetAnnouncer` clears listeners.** It empties the `listeners` set. In a test that renders
   `<LiveAnnouncer/>` (subscribing) and then calls `__resetAnnouncer()` mid-test, the component's
   subscription would be silently dropped. Do any planned tests call `__resetAnnouncer()` AFTER a
   render (they use `beforeEach`, so probably not) — but flag the footgun and whether the plan's
   ordering avoids it.
5. **main.tsx placement.** Is rendering `<LiveAnnouncer/>` as a sibling before `<ErrorBoundary>` sound
   (survives app errors), and does it correctly sit above the per-screen `AccessibilityProvider`
   switch? Any downside to it being outside `LazyMotion` (it uses no `m` components — should be fine)?
6. **Additive scope.** Does any task touch an existing `aria-live` region? The plan's Task 6 Step 2
   greps to prove it doesn't — is that check sufficient?
7. **TDD honesty.** Tasks 2 and 3 say tests should PASS immediately (behavior implemented in Task 1).
   Is labeling these "tests" acceptable, or does it violate RED-first TDD? Is the plan's framing
   ("prove it; if it fails, fix Task 1") reasonable?
8. **Any simpler/al ternative** that's clearly better for Phase 1's actual scope.

## Output format
Write to `codex/output/phase1-live-announcer-plan-gate1-review.md`:
- Prioritized findings — each with **severity (High/Med/Low)**, concrete failure, suggested fix.
- Note genuinely-sound parts (don't invent problems).
- End with an **overall verdict**: is the plan sound to execute as-is, or must specific things change
  first? List must-change items explicitly.
