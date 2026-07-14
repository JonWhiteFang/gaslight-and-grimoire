# Design — Global Live Announcer (UI/UX Roadmap Phase 1)

_Date: 2026-07-14 · Status: approved (brainstorm), pending spec review · Author: session (Magikarp/Jon White)_

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
API any component or store-subscription can call. This unblocks Phases 2–3 (deduction and dice
feedback), which will simply call `announce()`.

This is [Phase 1 of the roadmap](../../research/ui-ux-roadmap.md); it consumes no prior phase and
gates the product-facing feedback work.

## Decisions (from brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Architecture | **Hybrid (C)** — a React `<LiveAnnouncer>` owns the persistent regions + `announce()` API; a thin store-subscription (mirroring `audioSubscription.ts`) calls `announce()` for store-driven events. Callable from anywhere *and* reuses the proven pattern. |
| 2 | Scope vs. the ~18 existing local regions | **Additive only** — build the substrate + wire events that currently have *no reliable SR home* (stat changes, scene transitions, halt entry). Leave already-correct local regions untouched (especially `SceneText`'s F-049 once-only logic and the save toast). Consolidation is a later, separate task. |

Both answered with the recommended option (standing "recommend + why" preference).

## Architecture

Three units, each independently testable.

### 1. `announcer` store — `src/announcer.ts`

A tiny, framework-agnostic external store. No React, no Zustand — a bare subscribe/snapshot module so
it can be unit-tested in isolation and consumed via `useSyncExternalStore`.

```ts
// Shape (illustrative — final signatures in the plan)
type AnnouncerSnapshot = { polite: string; assertive: string };

export function announce(message: string, opts?: { assertive?: boolean }): void;
export function subscribeAnnouncer(listener: () => void): () => void;
export function getAnnouncerSnapshot(): AnnouncerSnapshot;
export function __resetAnnouncer(): void; // test-only
```

- `announce()` writes `message` into the polite or assertive field and notifies listeners.
- **Message-identity nonce.** Screen readers do not re-announce an unchanged text node. To force
  re-announcement of a repeated identical message, each write appends an invisible disambiguator
  derived from a **monotonic counter held in the store**. **No `Date.now()`/`Math.random()`** — the
  counter is deterministic and resettable, per the repo's determinism warnings. The nonce must be
  invisible and must not alter the spoken text. Two candidate mechanisms — (a) append a trailing run
  of zero-width spaces to the message text, or (b) render the counter in a separate visually-hidden
  node the region includes — **the plan picks one** (leaning (a) for simplicity); both keep the nonce
  out of the audible string.

### 2. `<LiveAnnouncer>` component — `src/components/LiveAnnouncer/`

Renders **two** visually-hidden regions, both present and empty from first mount:

```tsx
<div aria-live="polite"    className="sr-only">{polite}</div>
<div aria-live="assertive" className="sr-only">{assertive}</div>
```

Plain `aria-live` (no `role="alert"`/`role="status"`) is deliberate: `role="alert"` is the documented
*exception* that announces content present at injection, which muddies the "region pre-exists, content
is added later" contract. Since both regions are always mounted, bare `aria-live` gives the clean,
well-defined behavior. (Confirm in the plan; trivial to add roles back if a target AT needs them.)

- Subscribes to the announcer store via `useSyncExternalStore(subscribeAnnouncer, getAnnouncerSnapshot)`
  and mirrors each field into its region.
- **Mounted once at the true root, above the screen switch** — NOT inside `AccessibilityProvider`.
  Placed at the top of `App`'s returned tree (outside every screen branch and every
  `AccessibilityProvider` wrapper) so the region nodes never unmount across screen changes. This is
  the crux of the fix.

### 3. `initAnnouncerSubscription()` — `src/store/announcerSubscription.ts`

Mirrors `audioSubscription.ts` exactly: one `useStore.subscribe((state, prev) => …)` diffing
prev/next and calling `announce()`. Called once in `main.tsx` beside `initAudioSubscription()`.

**Events wired in Phase 1 (additive — each lacks a reliable SR home today):**

| Event (store diff) | Politeness | Example message |
|--------------------|-----------|-----------------|
| `investigator.composure` decreased/increased | polite | `Composure fell to 4` |
| `investigator.vitality` decreased/increased | polite | `Vitality fell to 6` |
| faction reputation / NPC suspicion shifts | polite | `Suspicion rising` (final user-facing copy chosen in the plan) |
| scene transition (`currentScene` changed, non-empty) | polite | a short scene **label**, NOT prose |
| halt / breakdown scene entry | **assertive** | `You have broken down.` |

The scene-transition announcement is a short label only — `SceneText` already handles reading the
scene narrative once (F-049); announcing full prose here would double-read and fight self-pacing.

## Data flow

```
store mutation ──▶ useStore.subscribe (announcerSubscription)
                        │  diff prev/next
                        ▼
                   announce(msg, {assertive?})           components (Phase 2/3) also call announce() directly
                        │  write field + bump nonce
                        ▼
                   announcer store  ──notify──▶  <LiveAnnouncer> (useSyncExternalStore)
                        │
                        ▼
                   sr-only aria-live region (already in DOM) ──▶ screen reader speaks
```

## Explicitly out of scope (untouched)

- `SceneText` (F-049 once-only scene narrative), the save toast (already correct polite/assertive),
  `DiceRollOverlay`, and the other ~14 local `aria-live` regions.
- **Deduction / dice announcements** — those are Phase 2/3's job; they will call `announce()`. Phase 1
  proves the API only via the store events above.
- Consolidating/removing existing local regions — deferred to a later task.

## Error handling & edge cases

- **Empty/blank message:** ignored (no-op) so a spurious diff can't blank a region mid-announcement.
- **Rapid successive announcements:** last-write-wins per channel; the nonce guarantees even identical
  consecutive messages re-announce. (No queue in Phase 1 — YAGNI; revisit only if playtest shows
  messages being clobbered.)
- **SSR/no-DOM:** N/A — static SPA, client-only.
- **Determinism:** monotonic counter only; no time/random. `__resetAnnouncer()` restores initial state
  for tests.

## Testing

- **Announcer store (unit):** `announce()` updates the correct field; assertive vs. polite routing;
  the nonce changes on a repeated identical message; `__resetAnnouncer()` clears state.
- **`<LiveAnnouncer>` (RTL):** both regions present and empty on mount; `announce('x')` populates the
  polite region and `announce('y',{assertive:true})` the assertive one; **the region node persists
  across a simulated screen change** (query the node, change screen, assert same node — the core
  regression guard).
- **Subscription (unit/integration):** a composure drop calls `announce` politely; a halt-scene entry
  calls it assertively; a scene change announces a label, not the prose.

## Files

**New:** `src/announcer.ts`; `src/components/LiveAnnouncer/{index.ts, LiveAnnouncer.tsx}`;
`src/store/announcerSubscription.ts`; matching `__tests__`.
**Edited:** `App.tsx` (mount `<LiveAnnouncer>` at root), `main.tsx` (call `initAnnouncerSubscription()`).
**Unchanged:** all existing `aria-live` regions.

## Review gates

Non-trivial code → both Codex gates: **Gate 1** on the implementation plan before any edit; **Gate 2**
on the complete diff vs. the start commit before completion. Standard TDD (RED watched) throughout.

## Follow-ups / links

- Roadmap: [`docs/research/ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md) (Phase 1)
- Research: [`docs/research/ui-ux-improvements.md`](../../research/ui-ux-improvements.md) (C2, E2, Part IV)
- Pattern precedent: `src/store/audioSubscription.ts`
- Enables: Phase 2 (deduction feedback) and Phase 3 (dice legibility) will call `announce()`.
