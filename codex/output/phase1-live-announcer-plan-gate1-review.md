# Gate 1 review - Phase 1 Live Announcer implementation plan

## Prioritized findings

### 1. Med - Additive-scope verification command is incomplete and its expected result is wrong

**Concrete failure:** Task 6 Step 2 says:

```bash
git diff main --stat -- src/components src/store | grep -vE 'LiveAnnouncer|announcer'
```

and expects "only `src/main.tsx` appears". That command can never show `src/main.tsx`, because the
pathspec excludes it. It also excludes `src/App.tsx`, which contains existing live regions including
loading/status/save-toast/error UI, so it would miss an accidental edit to several in-scope local
`aria-live` regions. Finally, `--stat` only proves files changed, not whether an `aria-live`,
`role="status"`, or `role="alert"` line changed.

**Suggested fix:** Replace this with a targeted diff check over all existing live-region locations,
excluding only the new announcer files. For example:

```bash
git diff main -U0 -- src/App.tsx src/components ':!src/components/LiveAnnouncer' \
  | rg 'aria-live|role="status"|role="alert"'
```

Expected: no output. Pair it with a name-only check that the source diff is limited to
`src/announcer.ts`, `src/components/LiveAnnouncer/**`, new tests, and `src/main.tsx`.

### 2. Med - The component "persistence guard" does not prove root placement or screen-switch persistence

**Concrete failure:** Task 4's persistence test renders `<div><LiveAnnouncer /></div>` and rerenders
the same tree. That will preserve the DOM node even if the eventual integration mistakenly mounts
`<LiveAnnouncer>` inside an app screen branch or inside `ErrorBoundary`. The test therefore does not
cover the actual regression the design is trying to prevent: the live regions disappearing across
screen switches or when the app subtree is replaced by the error boundary fallback.

**Suggested fix:** Keep the simple rerender test only as a component stability test, but do not label
it as the root persistence guard. Add either:

- a small integration/harness test where `<LiveAnnouncer />` is a sibling before a conditional app
  branch and before an `ErrorBoundary`, then switch the branch / trigger a caught app error and assert
  the original live-region nodes remain; or
- an explicit Task 5 source-inspection checklist that verifies the `main.tsx` tree has
  `<LiveAnnouncer />` as a sibling before `<ErrorBoundary>`, with Gate 2 required to catch divergence.

### 3. Low - The "empty on first commit" RTL test overclaims what it observes

**Concrete failure:** In this repo, RTL `render()` is act-wrapped and flushes effects before returning.
The planned test has no pre-ready queued message, so the nodes are empty after render regardless of
whether the first commit was meaningfully protected. It would not catch an implementation drift where
readiness is moved into a layout effect or render path and a queued pre-mount message appears too
early.

**Suggested fix:** Add a queued-message component test that calls `announce('Early message')` before
rendering `<LiveAnnouncer />`. Use a `useLayoutEffect` probe in the same render tree to assert the
live-region text is still empty immediately after commit and before passive effects, then assert that
the queued message appears after `render()` completes. This directly tests the pre-existence contract.

### 4. Low - The plan's TDD framing is internally inconsistent

**Concrete failure:** Tasks 2 and 3 say "write the failing tests" but then expect those tests to pass
because Task 1 already implemented slot toggling and readiness/queue behavior. That contradicts the
plan's own "Standard TDD throughout: every implementation step is preceded by a failing test" review
gate.

**Suggested fix:** Either move the Task 2/3 tests into Task 1 before writing the store implementation,
or split Task 1's implementation so it only satisfies Task 1 tests, then add the two-slot logic and
readiness queue after watching Task 2/3 tests fail. If the team is comfortable with "prove already
implemented behavior" tests, rename those steps so the plan is honest and remove the RED-first claim
for those tasks.

## Sound parts

- The two-slot trace is correct. Initial `politeSlot=0`; first `announce('x')` flips to `1` and
  renders in the second polite node; the repeat flips to `0` and renders in the first node. For
  consecutive nonblank writes on the same channel, the same node does not hold the new message twice
  in a row.
- The Task 2 store assertions and Task 4 `findIndex` assertion both hold for the specified
  implementation, assuming the two repeated announcements are in separate `act()` calls as planned.
- `useSyncExternalStore` usage is sound: the snapshot is cached and replaced only on mutation;
  returning a fresh unsubscribe closure from `subscribeAnnouncer()` is normal; a single module store
  has no meaningful tearing risk here.
- React StrictMode double-invoking the mount effect should not duplicate or drop Phase 1
  announcements. `markAnnouncerReady()` is idempotent, and Phase 1 has no app callers that emit
  during StrictMode effect replay.
- The component-test readiness race is acceptable in this repo: RTL `render()` is act-wrapped under
  jsdom, so the subsequent `act(() => announce(...))` should see `ready === true`. If this ever moves
  to a custom renderer, use `waitFor(() => expect(getAnnouncerSnapshot().ready).toBe(true))`.
- `__resetAnnouncer()` clearing listeners is a real footgun if called after rendering a subscriber,
  but the planned tests only call it in `beforeEach()` before render. That ordering avoids the issue.
- Mounting `<LiveAnnouncer />` before and outside `<ErrorBoundary>` in `main.tsx` is the right shape
  for surviving caught app errors and sitting above the per-screen `AccessibilityProvider` branches.
  Being outside `LazyMotion` is fine because the component uses no motion primitives.
- The plan does not add a store subscription and does not intentionally touch existing local
  `aria-live` regions.

## Overall verdict

The implementation approach is sound, but the plan should not execute as-is without tightening the
verification steps. Must-change items before execution: fix the additive-scope diff command, and stop
claiming the current component rerender test proves root/screen-switch persistence. Strongly
recommended: add the queued-message first-commit test and make the TDD wording match the actual
workflow.
