# Design — Global Live Announcer (UI/UX Roadmap Phase 1)

_Date: 2026-07-14 · Status: revised after Codex Gate 1 (`codex/output/phase1-live-announcer-gate1-review.md`), pending spec re-review · Author: session (Magikarp/Jon White)_

> **Gate 1 outcome (2026-07-14).** Codex found the original design not sound to proceed. All five
> findings accepted. Net effect: **Phase 1 becomes a pure substrate** — the store-subscription that
> wired stat/scene events is **dropped**, because those events already have local `aria-live` coverage
> (`EffectFeedback`, the meters) and announcing them globally would double/triple-speak. The mount
> moves from `App.tsx` (which has no shared tree) to `main.tsx`. A readiness/queue contract, cached
> snapshot, and a re-announce mechanism that keeps accessible text == message are now specified. See
> the [Gate 1 revisions](#gate-1-revisions-2026-07-14) section for the point-by-point changes.

## Problem

Screen-reader users miss dynamic state changes. Per the UI/UX research
([`docs/research/ui-ux-improvements.md`](../../research/ui-ux-improvements.md), findings C2/E2), an
`aria-live` region **only announces changes to a region that already existed in the DOM before the
content changed** — a freshly-mounted region stays silent. The repo audit found the app has ~18
*local* `aria-live` regions, several of which mount only when their content appears (so they can fail
to announce), and **no single always-present announcer**. `AccessibilityProvider` — the intuitive
host — is mounted ~7× in `App.tsx` (once per screen branch), so it unmounts/remounts on every screen
change and cannot host a persistent region.

Phase 1 builds the missing substrate: one always-mounted pair of live regions plus an `announce()`
API any component can call. This unblocks Phases 2–3 (deduction and dice feedback), which will simply
call `announce()` at points that are **not** already covered by an existing local region. Phase 1
itself wires **no** store events (see [Gate 1 revisions](#gate-1-revisions-2026-07-14)) — it ships and
proves the API only.

This is [Phase 1 of the roadmap](../../research/ui-ux-roadmap.md); it consumes no prior phase and
gates the product-facing feedback work.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Architecture | **React `<LiveAnnouncer>` + external announcer store + `announce()` API.** The component owns the persistent regions and subscribes via `useSyncExternalStore`; `announce()` is callable from anywhere. *(The originally-planned store-subscription is dropped — see #3.)* |
| 2 | Scope vs. the ~18 existing local regions | **Pure substrate.** Build and prove the API only. Leave every existing local region untouched (`SceneText` F-049, save toast, meters, `EffectFeedback`, etc.). Consolidation is a later, separate task. |
| 3 | Store-driven announcements in Phase 1 | **None (post-Gate-1 decision).** The stat/scene events the substrate would have auto-announced already surface through local regions (`EffectFeedback` for onEnter stat/suspicion/reputation messages; `ComposureMeter`/`VitalityMeter` descriptors); a global subscription would double/triple-speak. Phases 2/3 call `announce()` only at genuinely-uncovered points. |
| 4 | Mount point | **`main.tsx`, at the true root** — `App` has ~7 early-return branches with no shared tree, so there is no in-`App` mount point above the screen switch. |

## Architecture

Two units, each independently testable. *(A third unit — a store-subscription — was in the original
design and was removed at Gate 1.)*

### 1. `announcer` store — `src/announcer.ts`

A tiny, framework-agnostic external store. No React, no Zustand — a bare subscribe/snapshot module so
it can be unit-tested in isolation and consumed via `useSyncExternalStore`.

```ts
// Shape (illustrative — final signatures in the plan)
type AnnouncerSnapshot = {
  polite: string;
  assertive: string;
  politeSlot: 0 | 1;     // which slot currently holds the polite message
  assertiveSlot: 0 | 1;  // which slot currently holds the assertive message
  ready: boolean;        // flipped true once <LiveAnnouncer> has committed empty regions
};

export function announce(message: string, opts?: { assertive?: boolean }): void;
export function subscribeAnnouncer(listener: () => void): () => void;
export function getAnnouncerSnapshot(): AnnouncerSnapshot;
export function markAnnouncerReady(): void; // called from <LiveAnnouncer> mount effect
export function __resetAnnouncer(): void;   // test-only
```

- `announce()` writes `message` into the polite or assertive channel and notifies listeners.
- **Cached snapshot (finding 5).** `getAnnouncerSnapshot()` MUST return a **stable, module-level cached
  object** that is replaced with a new object only when `announce()`/`markAnnouncerReady()` mutate
  state — never a fresh object per call. Returning a fresh object each call makes
  `useSyncExternalStore` re-render indefinitely. `subscribeAnnouncer()` only adds/removes listeners,
  no side effects.
- **Re-announcement without a nonce (finding 4).** Screen readers don't re-announce an unchanged text
  node, but the zero-width-space nonce is unreliable and leaks into `textContent`/tests. Instead use a
  **two-slot alternation per channel**: each channel renders two `aria-live` nodes; a new message is
  written to the *empty* slot while the other is cleared, so a repeat of an identical string still
  lands in a different DOM node and re-announces. **Accessible text always equals the message** — no
  hidden characters. `politeSlot`/`assertiveSlot` track which slot is active. This replaces the
  monotonic-nonce idea entirely; no `Date.now()`/`Math.random()` needed, fully deterministic.
- **Readiness + pre-mount queue (finding 2).** `ready` starts `false` and `snapshot` starts empty, so
  the regions' *first* DOM commit is guaranteed empty (satisfying "region pre-exists before content").
  `<LiveAnnouncer>` calls `markAnnouncerReady()` from a mount effect (after the empty commit). An
  `announce()` before readiness does **not** populate the initial snapshot — it queues the latest
  message per channel; on `markAnnouncerReady()` the queued message flushes into a slot. This closes
  the ordering hazard where an early announcement would otherwise render as initial content (and go
  unspoken) or be lost.

### 2. `<LiveAnnouncer>` component — `src/components/LiveAnnouncer/`

Renders **two slots per channel** (four `sr-only` nodes), all present and empty from first mount:

```tsx
<div aria-live="polite"    className="sr-only">{politeSlot === 0 ? polite : ''}</div>
<div aria-live="polite"    className="sr-only">{politeSlot === 1 ? polite : ''}</div>
<div aria-live="assertive" className="sr-only">{assertiveSlot === 0 ? assertive : ''}</div>
<div aria-live="assertive" className="sr-only">{assertiveSlot === 1 ? assertive : ''}</div>
```

Plain `aria-live` (no `role="alert"`/`role="status"`) is deliberate: `role="alert"` is the documented
*exception* that announces content present at injection, which muddies the "region pre-exists, content
added later" contract. Bare `aria-live` on always-mounted nodes is the clean baseline. (Confirm in the
plan; trivial to add roles for a target AT later.) The two-slot alternation (finding 4) makes a
repeated identical message re-announce because it lands in a *different* node; accessible text always
equals the message.

- Subscribes via `useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot)` (cached snapshot,
  finding 5) and mirrors each channel's message into its active slot.
- Calls `markAnnouncerReady()` from a **mount effect** so the first committed DOM state is the empty
  regions; only then do queued/subsequent announcements flush (finding 2).
- **Mounted once in `main.tsx` at the true root** (finding 1), NOT in `App.tsx`. `App` has ~7
  early-return branches, each with its own `<AccessibilityProvider>`, so there is no shared in-`App`
  parent above the screen switch. Placed as a root-level sibling of `<App>` inside `React.StrictMode`
  and **outside `ErrorBoundary`** (so an app error that unmounts the `ErrorBoundary` subtree does not
  also unmount the announcer). It does not need `LazyMotion` context.

  ```tsx
  <React.StrictMode>
    <LiveAnnouncer />
    <ErrorBoundary>
      <LazyMotion features={domAnimation}><App /></LazyMotion>
    </ErrorBoundary>
  </React.StrictMode>
  ```

  **StrictMode note (finding 5):** the mount effect double-invokes in dev; `markAnnouncerReady()` must
  be idempotent, and `__resetAnnouncer()` is available for tests.

*(No third unit. The `initAnnouncerSubscription()` store-subscription from the original design is
removed — see Decision #3.)*

## Data flow

```
component (Phase 2/3) or a future caller
        │  announce(msg, {assertive?})
        ▼
   announcer store  ──(cached snapshot; write to empty slot / queue if not ready)──┐
        │  notify listeners                                                          │
        ▼                                                                            │
   <LiveAnnouncer> (useSyncExternalStore) ── mount effect ── markAnnouncerReady() ──┘
        │  mirror channel message into its active sr-only slot
        ▼
   sr-only aria-live node (already committed empty) ──▶ screen reader speaks
```

## Explicitly out of scope (untouched)

- **All ~18 existing local regions** — `SceneText` (F-049), the save toast, `DiceRollOverlay`,
  `EffectFeedback`, `ComposureMeter`/`VitalityMeter` descriptors, `OutcomeBanner`, `ClueDiscoveryCard`,
  encounter feedback, loading states, etc. Phase 1 adds no announcements that overlap these
  (finding 3).
- **No store-subscription.** No stat/scene/reputation/suspicion auto-announcements in Phase 1 — those
  already have local coverage. Deferred.
- **Deduction / dice announcements** are Phase 2/3's job; they'll call `announce()` at uncovered
  points. Phase 1 ships and proves the API only.
- Consolidating/removing existing local regions — a later task.

## Error handling & edge cases

- **Empty/blank message:** ignored (no-op) so it can't clear an active slot spuriously.
- **Announce before ready:** queued per channel; flushed on `markAnnouncerReady()`; the initial DOM
  commit stays empty (finding 2).
- **Repeated identical message:** re-announces via two-slot alternation — the message lands in the
  other (previously-empty) node (finding 4).
- **Rapid successive announcements (finding 6):** last-write-wins **per channel** is acceptable in
  Phase 1 *only because Phase 1 emits no bursts* (no subscription). When Phases 2/3 add callers that
  could burst, they must define a per-channel queue policy — flagged as a follow-up, not built now.
- **SSR/no-DOM:** N/A — static SPA, client-only.
- **StrictMode / double-init:** `markAnnouncerReady()` idempotent; `__resetAnnouncer()` for tests.
- **Determinism:** no `Date.now()`/`Math.random()`; slot alternation is a deterministic toggle.

## Testing

- **Announcer store (unit):** `announce()` writes the correct channel; polite vs. assertive routing;
  a repeated identical message flips the active slot (so the accessible text moves nodes) with **no
  hidden characters** in either node's text; snapshot object identity is stable when nothing changed
  (cached-snapshot guard); an `announce()` before `markAnnouncerReady()` leaves the snapshot empty,
  then flushes on ready; `__resetAnnouncer()` clears state.
- **`<LiveAnnouncer>` (RTL):** all four slot nodes present and empty on first commit; `announce('x')`
  populates a polite slot and `announce('y',{assertive:true})` an assertive slot; a repeat re-lands in
  the sibling slot; **the region nodes persist across a simulated screen change** (query nodes, change
  screen, assert same nodes — the core regression guard, now meaningful because the mount is in
  `main.tsx`); accessible text equals the message exactly.
- **No subscription test** — there is no subscription in Phase 1.

## Files

**New:** `src/announcer.ts`; `src/components/LiveAnnouncer/{index.ts, LiveAnnouncer.tsx}`; matching
`__tests__`.
**Edited:** `src/main.tsx` (render `<LiveAnnouncer/>` at root, outside `ErrorBoundary`).
**Unchanged:** `App.tsx` and all existing `aria-live` regions. *(No `announcerSubscription.ts` — removed at Gate 1.)*

## Review gates

Non-trivial code → both Codex gates: **Gate 1** on the implementation plan before any edit; **Gate 2**
on the complete diff vs. the start commit before completion. Standard TDD (RED watched) throughout.

## Gate 1 revisions (2026-07-14)

Codex reviewed the original design (`codex/output/phase1-live-announcer-gate1-review.md`) and found it
**not sound to proceed as-is**. All five findings were verified against code and accepted:

1. **High — mount point doesn't exist in `App.tsx`.** Confirmed: `App` has ~7 early-return branches,
   no shared tree. → Mount moved to `main.tsx` root, outside `ErrorBoundary`.
2. **High — announce-before-region-exists.** → Added `ready` flag + per-channel pre-mount queue;
   `markAnnouncerReady()` from the component's mount effect; initial snapshot stays empty.
3. **High — proposed events weren't additive.** Verified: `EffectFeedback` (`aria-live="polite"`)
   already announces onEnter stat/suspicion/reputation messages, and the meters announce descriptors.
   → **Store-subscription dropped entirely; Phase 1 emits no store events** (user-approved: pure
   substrate).
4. **Med — zero-width nonce unreliable + leaks into text/tests.** → Replaced with **two-slot
   alternation per channel**; accessible text always equals the message.
5. **Med — `useSyncExternalStore` needs cached snapshot + idempotent init.** → Specified module-level
   cached snapshot; `markAnnouncerReady()` idempotent for StrictMode double-invoke.
6. **Med — last-write-wins vs. bursts.** → Moot in Phase 1 (no burst source); flagged as a
   Phase 2/3 follow-up to define a per-channel queue policy before adding bursty callers.

No findings were disputed.

## Follow-ups / links

- Roadmap: [`docs/research/ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md) (Phase 1)
- Research: [`docs/research/ui-ux-improvements.md`](../../research/ui-ux-improvements.md) (C2, E2, Part IV)
- Gate 1 review: [`codex/output/phase1-live-announcer-gate1-review.md`](../../../codex/output/phase1-live-announcer-gate1-review.md)
- Enables: Phase 2 (deduction feedback) and Phase 3 (dice legibility) will call `announce()` at
  points not already covered by a local region.
- **Follow-up (Phase 2/3):** define a per-channel queue policy before adding callers that can emit
  bursts of announcements in one user action (finding 6).
