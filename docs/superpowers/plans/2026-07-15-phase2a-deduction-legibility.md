# Phase 2a — Deduction Feedback Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing deduction beat legible — a redundant cue for the `connected` clue state, and a board-owned, screen-reader-announced outcome banner with atmospheric directional copy — **without changing how deductions form**.

**Architecture:** Three small, isolated changes. (1) `ClueCard` gets a 🔗 badge for `connected` (WCAG 1.4.1). (2) `DeductionButton` keeps its roll + formation exactly as today but stops rendering its own outcome text and hands `(result, tier)` up. (3) `EvidenceBoard` renders a transient outcome banner (it stays mounted when connections clear — fixing the button-unmount message loss) and routes the message through the Phase-1 `announce()` API. **No correctness-model change, no clue-status-lifecycle change, does NOT enact ADR-0012.**

**Tech Stack:** React 19, Zustand, Vitest 4 + React Testing Library, Tailwind v4, framer-motion (`m`).

**Spec:** [`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md`](../specs/2026-07-14-phase2-deduction-feedback-design.md) — **Part A only**. Part B (2b) is explicitly out of scope.

**Start commit:** `430d003` (branch `feat/phase2-deduction-feedback`).

---

## File Structure

- **Modify** `src/components/EvidenceBoard/ClueCard.tsx` — add `connected` case to `StatusIndicator` (🔗 badge); update the six-state doc-comment.
- **Modify** `src/components/EvidenceBoard/DeductionButton.tsx` — remove the local `<m.p>` outcome label + its `aria-live`; widen the callback to `onResult(result, tier)`; keep roll/formation/status writes verbatim.
- **Modify** `src/components/EvidenceBoard/EvidenceBoard.tsx` — banner state; `handleDeductionResult(result, tier)` computes message + tone, sets the banner, calls `announce()`; render the visual-only banner; auto-clear timer.
- **Test** `src/components/__tests__/ClueCard.test.tsx` — 🔗 badge for `connected`.
- **Test** `src/components/__tests__/EvidenceBoard.test.tsx` — banner survives clear, `announce` called once, tone/message per (result, tier), formation unchanged.

**Message constants** live inline in `EvidenceBoard.tsx` (a local `const DEDUCTION_MESSAGES`), since the board is the only consumer. No new module (YAGNI).

---

## Task 1: `connected` clue-state 🔗 badge (backlog item 2)

**Files:**
- Modify: `src/components/EvidenceBoard/ClueCard.tsx` (`StatusIndicator`, ~lines 60-98; doc-comment ~lines 1-13)
- Test: `src/components/__tests__/ClueCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/__tests__/ClueCard.test.tsx` (after the `data-status` describe block):

```tsx
describe('ClueCard — connected redundant cue (WCAG 1.4.1)', () => {
  it('renders a link badge with an accessible label for the connected state', () => {
    render(<ClueCard clue={makeClue({ status: 'connected' })} />);
    // A non-colour cue must exist for `connected`, mirroring NEW/📌/❓/✓.
    expect(screen.getByLabelText('Connected')).toBeTruthy();
  });

  it('does not render the connected badge for examined clues', () => {
    render(<ClueCard clue={makeClue({ status: 'examined' })} />);
    expect(screen.queryByLabelText('Connected')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ClueCard.test.tsx -t "connected redundant cue"`
Expected: FAIL — `Unable to find a label with the text of: Connected`.

- [ ] **Step 3: Add the `connected` case to `StatusIndicator`**

In `src/components/EvidenceBoard/ClueCard.tsx`, inside `StatusIndicator`'s `switch (status)`, add a case (place it before `case 'deduced':` so the reading order matches the state list):

```tsx
    case 'connected':
      return (
        <span className="absolute -top-2 -right-2 text-lg" aria-label="Connected">
          🔗
        </span>
      );
```

- [ ] **Step 4: Update the doc-comment six-state list**

In the file header comment, change the `connected` line to:

```
 *   connected — gold border indicator + link icon (🔗)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/ClueCard.test.tsx`
Expected: PASS (all ClueCard tests, incl. the two new ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/EvidenceBoard/ClueCard.tsx src/components/__tests__/ClueCard.test.tsx
git commit -m "feat(evidence): add 🔗 redundant cue for connected clue state (WCAG 1.4.1)"
```

---

## Task 2: `DeductionButton` — surface tier, drop the local outcome label

Keep the roll, formation, and status writes exactly as on `main`. Only change: remove the local `<m.p>` label (the piece that unmounts with the button — this is why the message must move to the board) and pass the roll `tier` up through `onResult`.

**Files:**
- Modify: `src/components/EvidenceBoard/DeductionButton.tsx`
- Test: covered by the `EvidenceBoard` integration test in Task 3 (the button's own contract is the callback shape; assert it there to avoid brittle isolated-render mocking of the store).

- [ ] **Step 1: Widen the callback type**

In `src/components/EvidenceBoard/DeductionButton.tsx`, change the props interface:

```tsx
interface DeductionButtonProps {
  connectedClueIds: string[];
  /** Called after an attempt with the outcome and the roll tier so the board can
   *  render + announce the message. `tier` is the raw performCheck tier. */
  onResult: (result: 'success' | 'failure', tier: string) => void;
}
```

- [ ] **Step 2: Pass `tier` at both call sites**

In `handleAttempt`, update the two `onResult(...)` calls to include `result.tier`:

```tsx
      // success/critical branch, after setPhase('success'):
      onResult('success', result.tier);
```
```tsx
      // failure/partial/fumble branch, after setPhase('failure'):
      onResult('failure', result.tier);
```

(`result` is the `performCheck(...)` return already in scope; `result.tier` is the value the old `<m.p>` displayed.)

- [ ] **Step 3: Remove the local outcome label**

Delete the entire trailing `<AnimatePresence>…</AnimatePresence>` block that renders the `lastTier` `<m.p>` (the element with `aria-live="polite"`), and remove the now-unused `lastTier`/`setLastTier` state and the `tierLabel` map. Keep everything else (the `m.button`, phase state, `idsRef`, roll, formation, status writes) unchanged. Remove the `AnimatePresence` import if it is no longer referenced.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: no errors (if `AnimatePresence`/`lastTier` left dangling, fix the unused symbol).

- [ ] **Step 5: Commit**

```bash
git add src/components/EvidenceBoard/DeductionButton.tsx
git commit -m "refactor(evidence): DeductionButton passes roll tier up, drops local outcome label

The local aria-live <p> unmounts when connections clear (the button returns null
below 2 clues), so the outcome message must live on the always-mounted board.
Formation/roll/status writes are unchanged. onResult now carries (result, tier)."
```

---

## Task 3: `EvidenceBoard` — board-owned outcome banner + `announce()`

The board is always mounted while open, so its banner survives `clearConnections()`. It computes the message from the existing `(result, tier)` signal — **no new correctness model** — and announces it once.

**Files:**
- Modify: `src/components/EvidenceBoard/EvidenceBoard.tsx`
- Test: `src/components/__tests__/EvidenceBoard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/__tests__/EvidenceBoard.test.tsx`. First extend the top-of-file mocks with an announcer spy (place beside the existing `vi.mock` calls, before `import { EvidenceBoard }`):

```tsx
vi.mock('../../announcer', () => ({
  announce: vi.fn(),
}));
import { announce } from '../../announcer';
```

Then add this describe block:

```tsx
describe('EvidenceBoard — deduction outcome banner (Phase 2a)', () => {
  // Two connected clues so DeductionButton renders and an attempt is possible.
  const connectedPair = {
    'c1': { id: 'c1', type: 'physical', title: 'Cipher Note', description: 'x', sceneSource: 's1', connectsTo: ['c2'], tags: ['paper'], status: 'connected', isRevealed: true },
    'c2': { id: 'c2', type: 'testimony', title: 'Witness Account', description: 'y', sceneSource: 's2', connectsTo: ['c1'], tags: ['paper'], status: 'connected', isRevealed: true },
  };

  it('shows a success banner and announces once, even after connections clear', async () => {
    const { performCheck } = await import('../../engine/diceEngine');
    (performCheck as any).mockReturnValue({ roll: 10, modifier: 0, total: 10, tier: 'success' });
    initStore(connectedPair, [{ fromId: 'c1', toId: 'c2' }]);
    render(<EvidenceBoard onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));

    // Connections are cleared by handleDeductionResult, but the board banner persists.
    expect(useStore.getState().connections).toHaveLength(0);
    expect(screen.getByText('The connection holds.')).toBeTruthy();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('The connection holds.');
  });

  it('shows the critical-success line on a natural 20', async () => {
    const { performCheck } = await import('../../engine/diceEngine');
    (performCheck as any).mockReturnValue({ roll: 20, modifier: 0, total: 20, tier: 'critical' });
    initStore(connectedPair, [{ fromId: 'c1', toId: 'c2' }]);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(screen.getByText('The connection holds — a sharp, decisive insight.')).toBeTruthy();
  });

  it('shows the directional (amber) message on a partial-tier failure', async () => {
    const { performCheck } = await import('../../engine/diceEngine');
    (performCheck as any).mockReturnValue({ roll: 11, modifier: 0, total: 11, tier: 'partial' });
    initStore(connectedPair, [{ fromId: 'c1', toId: 'c2' }]);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(screen.getByText("Some of these belong together, but the reasoning won't quite hold.")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("Some of these belong together, but the reasoning won't quite hold.");
  });

  it('shows the hard-failure message on a plain failure', async () => {
    const { performCheck } = await import('../../engine/diceEngine');
    (performCheck as any).mockReturnValue({ roll: 3, modifier: 0, total: 3, tier: 'failure' });
    initStore(connectedPair, [{ fromId: 'c1', toId: 'c2' }]);
    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));
    expect(screen.getByText("These clues don't connect — not like this.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/EvidenceBoard.test.tsx -t "deduction outcome banner"`
Expected: FAIL — banner text not found / `announce` not called (and the `onResult` arity change from Task 2 means the old handler ignores `tier`).

- [ ] **Step 3: Add the message constants + banner state**

In `src/components/EvidenceBoard/EvidenceBoard.tsx`, add the import and a module-level constant (top of file, after the existing imports):

```tsx
import { announce } from '../../announcer';

const DEDUCTION_MESSAGES = {
  criticalSuccess: 'The connection holds — a sharp, decisive insight.',
  success: 'The connection holds.',
  partial: "Some of these belong together, but the reasoning won't quite hold.",
  failure: "These clues don't connect — not like this.",
} as const;

interface OutcomeBanner {
  message: string;
  tone: 'green' | 'amber' | 'red';
}
```

Inside the component, add banner state beside the other `useState` calls:

```tsx
  const [outcomeBanner, setOutcomeBanner] = useState<OutcomeBanner | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 4: Rewrite `handleDeductionResult` to compute + show + announce**

Replace the existing `handleDeductionResult` with:

```tsx
  // Deduction result handler — formation happens in DeductionButton; the board
  // owns the transient outcome banner (survives clearConnections) + the single
  // screen-reader announcement. NOTE: this does NOT change what forms a deduction
  // (still the DC-14 Reason roll); it only surfaces the existing outcome legibly.
  function handleDeductionResult(result: 'success' | 'failure', tier: string) {
    const message =
      result === 'success'
        ? tier === 'critical'
          ? DEDUCTION_MESSAGES.criticalSuccess
          : DEDUCTION_MESSAGES.success
        : tier === 'partial'
          ? DEDUCTION_MESSAGES.partial
          : DEDUCTION_MESSAGES.failure;
    const tone: OutcomeBanner['tone'] =
      result === 'success' ? 'green' : tier === 'partial' ? 'amber' : 'red';

    setOutcomeBanner({ message, tone });
    announce(message);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setOutcomeBanner(null), 2500);

    if (result === 'failure') {
      setSlackConnections(connections.map((c) => ({ ...c, state: 'slack' as const })));
      clearConnections();
      setTimeout(() => setSlackConnections([]), 1400);
    } else {
      clearConnections();
    }
  }
```

- [ ] **Step 5: Clean up the banner timer on unmount**

Add an effect near the other `useEffect`s so a pending timer can't fire after the board closes:

```tsx
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);
```

- [ ] **Step 6: Render the visual-only banner**

In the header bar's right-hand `<div className="flex items-center gap-4">`, immediately before the `<DeductionButton .../>`, add the banner (visual-only — the screen-reader path is `announce()`, so **no** `aria-live` here to avoid double-speak):

```tsx
            {outcomeBanner && (
              <span
                aria-hidden="true"
                className={[
                  'text-xs font-medium max-w-[16rem] leading-snug',
                  outcomeBanner.tone === 'green'
                    ? 'text-green-400'
                    : outcomeBanner.tone === 'amber'
                      ? 'text-amber-300'
                      : 'text-red-400',
                ].join(' ')}
              >
                {outcomeBanner.message}
              </span>
            )}
```

- [ ] **Step 7: Run the new tests to verify they pass**

Run: `npx vitest run src/components/__tests__/EvidenceBoard.test.tsx -t "deduction outcome banner"`
Expected: PASS (all four).

- [ ] **Step 8: Run the full EvidenceBoard suite (regression)**

Run: `npx vitest run src/components/__tests__/EvidenceBoard.test.tsx`
Expected: PASS — existing tests unaffected (formation/connection behaviour unchanged).

- [ ] **Step 9: Commit**

```bash
git add src/components/EvidenceBoard/EvidenceBoard.tsx src/components/__tests__/EvidenceBoard.test.tsx
git commit -m "feat(evidence): board-owned deduction outcome banner + global announce (fixes B3)

The outcome message now lives on the always-mounted board (survives
clearConnections) and is announced once via the Phase-1 announcer; partial-tier
failures read as directional (amber) rather than a flat fail. Formation is
unchanged — this is legibility only, and does NOT enact ADR-0012."
```

---

## Task 4: Full verification + docs

**Files:**
- Modify: `docs/status.md` (test baseline), `CLAUDE.md` (DeductionButton architectural note), `docs/engine-reference.md` (if it documents the DeductionButton callback).

- [ ] **Step 1: Run the full gate**

Run: `npm run lint && node scripts/validateCase.mjs && npm run test:run`
Expected: lint clean; validator 8/8 cases zero errors; all tests pass (baseline 635 + new tests, ~641-644).

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: green (tsc src + scripts + vite build + nest).

- [ ] **Step 3: Update `docs/status.md` test baseline**

Change the test baseline line to the new count from Step 1 (e.g. `635/60 → <new>/60`). Do not invent the number — use the actual `test:run` output.

- [ ] **Step 4: Update `CLAUDE.md` DeductionButton architectural note**

In the Architectural Warnings section, add/adjust the note to record: the deduction **outcome banner + `announce()` live on `EvidenceBoard`** (not `DeductionButton`, which unmounts when connections clear); `DeductionButton.onResult` carries `(result, tier)`. Explicitly note **Phase 2a did NOT change formation and did NOT enact ADR-0012** (still `Accepted`; 2b enacts it).

- [ ] **Step 5: Commit docs**

```bash
git add docs/status.md CLAUDE.md docs/engine-reference.md
git commit -m "docs: record Phase 2a — board-owned deduction banner, test baseline bump"
```

- [ ] **Step 6: Manual verification (real app)**

Run: `npm run dev`, open the Evidence Board, connect two clues, press Attempt Deduction. Confirm: on success the green banner "The connection holds." appears and persists briefly after the threads clear; the 🔗 badge shows on connected clue cards; a screen reader (or the DOM's `polite` region) announces the message once. This is the `/run`-style observation the repo expects before declaring done.

---

## Self-review notes (author)

- **Spec coverage:** Part A items — (1) 🔗 fix → Task 1; (2) board banner + announce fixing B3 → Tasks 2-3; (3) directional copy → Task 3 message table. All covered. Part B is explicitly deferred (not in this plan).
- **Type consistency:** `onResult(result, tier)` defined in Task 2 and consumed in Task 3's `handleDeductionResult(result, tier)` — match. `DEDUCTION_MESSAGES` keys (`criticalSuccess`/`success`/`partial`/`failure`) used consistently. Banner tone union `'green'|'amber'|'red'` consistent.
- **No new correctness model / no status-lifecycle change** — verified: Task 2 keeps DeductionButton's `updateClueStatus` writes verbatim; the board only clears connections as it already did.
- **Announce-once:** Task 3 removes the button's `aria-live` (Task 2 Step 3) and the banner is `aria-hidden`, so `announce()` is the sole SR path — one announcement per attempt (asserted in the test).
