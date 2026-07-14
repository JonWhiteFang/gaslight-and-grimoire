# Gate 2 review - Phase 1 Live Announcer

## Prioritized findings

### 1. Med - A remounted `<LiveAnnouncer>` can commit non-empty live regions

**Concrete failure:** `ready` and the current messages live in the module-level store forever
(`src/announcer.ts:30`, `src/announcer.ts:66-80`), and `<LiveAnnouncer>` renders the snapshot text
directly on every render (`src/components/LiveAnnouncer/LiveAnnouncer.tsx:21-28`). That satisfies the
first page-load path, but it does not satisfy the live-region pre-existence contract per component
mount.

Repro path:

1. Mount `<LiveAnnouncer>`, let its effect call `markAnnouncerReady()`, then call
   `announce('A')`. The store is now `{ ready: true, polite: 'A', ... }`.
2. Unmount the announcer. This can happen in tests, Fast Refresh/root remounts, or any future
   integration that temporarily drops the root component.
3. Call `announce('B')` while no live-region DOM exists, or just remount with the stale `'A'` still in
   the snapshot.
4. On the next mount, `useSyncExternalStore()` reads the non-empty ready snapshot during render, so a
   live-region node commits with text as initial content. Screen readers generally do not announce
   initial content in a newly-created live region, so that announcement is lost.

**Suggested fix:** Add a per-mount empty-commit gate in `<LiveAnnouncer>`, not only the global store
`ready` flag. For example, keep local `regionsCommitted` state initialized to `false`; in the passive
mount effect call `markAnnouncerReady()` and then set `regionsCommitted` to `true`; render `''` in all
four nodes while `regionsCommitted` is false. That preserves the initial empty DOM commit even if the
store is already ready and already contains a message. Add an RTL test that leaves the store ready and
non-empty, unmounts the component, announces while unmounted, remounts with a `useLayoutEffect` probe,
asserts all four live regions are empty at first commit, then asserts the latest message appears after
the passive effect.

### 2. Low - The first-commit tests do not cover all four live regions

**Concrete failure:** The pre-ready store test queues only a polite message and asserts only
`s.polite` remains empty (`src/__tests__/announcer.test.ts:108-112`). The component first-commit test
also queues only polite text and probes only the first polite node
(`src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx:63-77`). A regression that accidentally
populates `assertive` before ready, or renders one of the inactive slots with stale text on first
commit, would not be caught by these tests.

**Suggested fix:** Extend the readiness tests to queue both polite and assertive messages before
mount/ready, assert both snapshot channels remain empty pre-ready, and have the first-commit probe
inspect all four `[aria-live]` nodes before passive effects run.

## Sound parts

- The core store behavior is sound for the normal single-mount path: blank messages no-op, text is
  trimmed consistently, pre-ready announcements are latest-per-channel, `markAnnouncerReady()` is
  idempotent, and snapshots are cached until mutation.
- Slot alternation is correct. Each write flips only that channel's slot, so a repeated identical
  message lands in the other pre-existing node while the accessible text remains exactly the message.
- The initial mount pre-existence path is correct when the store starts from `__resetAnnouncer()`:
  first render uses an empty snapshot, the passive effect marks readiness, and queued text is flushed
  after the empty commit.
- `main.tsx` placement is correct: `<LiveAnnouncer />` is before and outside `<ErrorBoundary>` and
  outside `<LazyMotion>`, so app screen switches and caught app errors should not remove the live
  regions.
- No announcer store-subscription was added, and existing local `aria-live`/`status`/`alert` regions
  in `src/App.tsx` and `src/components/**` were not modified.
- Bare `aria-live` nodes are consistent with the revised design. React text rendering also avoids an
  HTML injection issue for announcement strings.

Verification run: `npm run test:run -- src/__tests__/announcer.test.ts src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx` passed (2 files, 23 tests).

## Overall verdict

Do not merge as-is if the Gate 2 bar treats "live regions commit empty before content" as a per-mount
invariant. Must change: add the per-mount empty-commit guard for remounts and cover it with a test
that checks all four live regions. After that, the implementation is otherwise sound for Phase 1's
pure-substrate scope.
