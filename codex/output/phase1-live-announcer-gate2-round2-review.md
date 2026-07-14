# Gate 2 round 2 review - Phase 1 Live Announcer

## Findings

No new findings.

## Round-1 fix verification

### Finding 1 - Remount could commit non-empty live regions

Resolved.

`LiveAnnouncer` now initializes a per-mount `regionsCommitted` state to `false` and derives both rendered channel texts from that gate (`src/components/LiveAnnouncer/LiveAnnouncer.tsx:22`, `src/components/LiveAnnouncer/LiveAnnouncer.tsx:33-34`). All four live-region nodes still render on the first commit, but their text children are forced to `''` while the gate is closed (`src/components/LiveAnnouncer/LiveAnnouncer.tsx:38-41`).

The gate is released only from the passive mount effect, after the empty DOM has committed (`src/components/LiveAnnouncer/LiveAnnouncer.tsx:27-30`). That covers both cases that mattered:

- Fresh first load: pre-ready announcements stay out of the snapshot until `markAnnouncerReady()` flushes them after the empty commit.
- Remount / ready non-empty store: `useSyncExternalStore()` may read a non-empty snapshot during render, but the local gate still renders empty text for that mount's first commit; the current snapshot text appears only after the passive effect flips `regionsCommitted`.

I do not see a race that drops or duplicates the announcement. `markAnnouncerReady()` flushes queued messages synchronously before `setRegionsCommitted(true)` returns control, and any intermediate external-store re-render while the local gate is still false would keep the DOM empty. The final render after the gate opens reads the latest snapshot. When the store is already ready, `markAnnouncerReady()` is a no-op and the local state flip alone releases the existing message. StrictMode's extra effect invocation is also safe: `markAnnouncerReady()` is idempotent, and setting `regionsCommitted` to `true` again is a no-op.

### Finding 2 - First-commit tests only covered the polite channel

Resolved.

The store pre-ready test now queues both polite and assertive messages and asserts both snapshot channels remain empty before ready (`src/__tests__/announcer.test.ts:109-114`). The component first-commit probe now captures all `[aria-live]` nodes and asserts all four are empty before passive effects (`src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx:70-82`).

The new ready/non-empty mount test is not tautological: it primes the external store outside the component, mounts `LiveAnnouncer`, records DOM text from a sibling `useLayoutEffect` before passive effects, and then asserts the stored message appears after the passive effect opens the gate (`src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx:88-105`). It synthesizes the relevant remount condition directly rather than performing an actual unmount/remount, but that still exercises the bug's operative state: a fresh component mount reading an already-ready, non-empty module snapshot.

## Regression check

Normal first load remains intact: an empty snapshot renders first, then the passive effect marks the store ready and releases queued messages. Slot alternation still works because the fix only gates rendered text, not the stored `politeSlot` / `assertiveSlot` values. Pre-mount queue flushing is unchanged in `src/announcer.ts`, and `git blame` confirms the Gate 2 fix commit did not modify `src/announcer.ts`; the module-level persistence remains the right place for cross-component announcement state.

Focused verification passed:

```text
npm run test:run -- src/__tests__/announcer.test.ts src/components/LiveAnnouncer/__tests__/LiveAnnouncer.test.tsx
Test Files  2 passed (2)
Tests       24 passed (24)
```

## Overall verdict

Sound to merge as-is. The accepted round-1 issues are fixed, the tests cover the missing first-commit/all-four-region cases, and I found no new bug introduced by the per-mount gate.
