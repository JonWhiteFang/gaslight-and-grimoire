# Phase 4 — A11y Hardening Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the specific accessibility gaps found in the Phase 4 audit — a title-screen background-inertness bug, SettingsPanel's non-restoring focus trap, inconsistent focus-ring indicators — and lock in already-correct behaviour (reduced-motion, self-paced prose, save-toast roles, keyboard connect, dice-as-status) with regression tests.

**Architecture:** Components/CSS/tests only — no `public/content/` or `src/engine/` changes. Two real code changes: (1) refactor `SettingsPanel` to the shared `useFocusTrap` hook and make the title-screen background inert while Settings is open; (2) standardize focus rings on `focus-visible:ring-2 focus-visible:ring-amber-400`. Everything else is regression tests, most of them **GREEN characterization tests** guarding behaviour that is already correct.

**Tech Stack:** React 19, Zustand + Immer, Tailwind v4 (CSS-first `@theme`), Framer Motion (`LazyMotion` + `m`), Vitest 4 + React Testing Library, jsdom.

---

## Ground truth established during planning (read before starting)

An audit of `main` at spec time found the codebase **more complete than the roadmap assumed**. These facts shape the tasks — do not "discover" them again:

- **Every local Framer Motion (`m.*`) branch already has a `reducedMotion` gate.** Verified in ComposureMeter, VitalityMeter, ConnectionThread, DiceRollOverlay, ClueDiscoveryCard, EffectFeedback, HintButton, DeductionButton, OutcomeBanner. A sweep for `initial=`/`whileHover=`/`whileInView=` **not** guarded by `reducedMotion` returned **zero ungated reveal paths**. So WS1 is *tests + a structural CSS guard*, **not** gating ungated code.
- **The global CSS rule `.reduced-motion * { animation-duration: 0ms; transition-duration: 0ms }`** (`src/index.css:90-93`) neutralizes all CSS/Tailwind animation (`animate-pulse` etc.). It **cannot** reach JS-driven `m.*` — those are gated per-component (above).
- **`useFocusTrap`** (`src/hooks/useFocusTrap.ts`) captures `document.activeElement` on mount and **restores it on unmount**; already used by EvidenceBoard, CaseJournal, NPCGallery, and unit-tested at the hook level.
- **`SettingsPanel`** uses a *bespoke inline* trap that focuses the close button and traps Tab but **never restores focus** — the one real focus regression.
- **The `title` branch of `App.tsx` (lines 232-248)** renders `TitleScreen` + `SettingsPanel` with **no `inert` wrapper** and returns before `anyOverlayOpen` is computed — the real inertness bug.
- **SceneText's keyboard skip control is already fully tested** (`SceneText.test.tsx:169-201`), and the **save-failure toast is tested** (`App.test.tsx:241-261`). WS4 only adds the *missing* direct assertions (success-toast roles, keyboard connect, dice-as-status).
- **jsdom applies no stylesheets and computes no layout.** No unit test can prove animation *visibly* stops or measure a contrast ratio. Those are verified by the **live in-browser check** (final task). CSS-rule and contrast guards are structural/computed-value only.

**Two "amber" tokens (do not confuse — Codex Major 2):** `#d4a853` is `--color-gaslight-amber` → `ring-gaslight-amber`. Tailwind's built-in `ring-amber-400` is a **different**, brighter colour (`oklch(82.8% 0.189 84.429)`). **We standardize on `ring-amber-400`** (already the dominant ring, brighter → more contrast headroom).

**Commands** (run from repo root): tests `npm run test:run -- <path>`; full suite `npm run test:run`; lint `npm run lint`; validator `node scripts/validateCase.mjs`; build `npm run build`.

---

## File structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/components/SettingsPanel/SettingsPanel.tsx` | Modify | Replace inline trap with `useFocusTrap`; keep Escape handler |
| `src/App.tsx` | Modify | Wrap title-screen content so it is `inert` while Settings is open |
| `src/components/TitleScreen/TitleScreen.tsx` | Modify | Migrate two stone focus rings → amber |
| `src/components/TitleScreen/LoadGameScreen.tsx` | Modify | Migrate one stone focus ring → amber (keep red autofocus ring) |
| `src/components/CaseSelection/CaseSelection.tsx` | Modify | Migrate two stone focus rings → amber |
| `src/components/NarrativePanel/ClueDiscoveryCard.tsx` | Modify | Bump thin `ring-1` → `ring-2` |
| `src/components/HeaderBar/HintButton.tsx` | Modify | Bump thin `ring-1` → `ring-2` |
| `src/components/__tests__/SettingsPanel.a11y.test.tsx` | Create | SettingsPanel focus-restore + DOM-order + Escape + Tab-wrap |
| `src/components/__tests__/overlayFocusTrap.test.tsx` | Modify | Add consumer focus-restore for CaseJournal + NPCGallery |
| `src/components/__tests__/EvidenceBoard.test.tsx` | Modify | Add consumer focus-restore |
| `src/components/__tests__/App.test.tsx` | Modify | Title→Settings inert add/remove; success-toast roles |
| `src/components/__tests__/reducedMotion.coverage.test.tsx` | Create | framer-motion mock + direct per-component reduced-motion guards (every gate) + structural CSS guard + coverage table |
| `src/components/__tests__/focusRing.test.tsx` | Create | Class-presence assertions on migrated controls |
| `src/components/__tests__/EvidenceBoard.test.tsx` | Modify | Keyboard (Enter/Space) connect preserve test |
| `src/components/__tests__/DiceRollOverlay.status.test.tsx` | Create | Dice-as-status: role=status, non-interactive |

---

## Task 1: SettingsPanel — refactor to `useFocusTrap` (focus-restore fix)

**Files:**
- Test: `src/components/__tests__/SettingsPanel.a11y.test.tsx` (create)
- Modify: `src/components/SettingsPanel/SettingsPanel.tsx:10,21-64,83-107`

- [ ] **Step 1: Write the failing focus-restore test**

Create `src/components/__tests__/SettingsPanel.a11y.test.tsx`:

```tsx
/**
 * SettingsPanel accessibility — focus-restore (Phase 4 WS2, Codex-verified gap).
 * The panel used a bespoke inline trap that never restored focus to the invoker.
 * Refactored to the shared useFocusTrap hook.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useStore } from '../../store';
import { SettingsPanel } from '../SettingsPanel/SettingsPanel';

function initStore() {
  useStore.setState({
    settings: {
      fontSize: 'standard', highContrast: false, reducedMotion: true,
      textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
  } as any);
}

afterEach(cleanup);

describe('SettingsPanel — focus management (WS2)', () => {
  it('restores focus to the invoking control on close', () => {
    initStore();
    render(<button type="button" data-testid="invoker">Open settings</button>);
    const invoker = screen.getByTestId('invoker');
    invoker.focus();
    expect(document.activeElement).toBe(invoker);

    const { unmount } = render(<SettingsPanel onClose={() => {}} />);
    // focus moved into the dialog
    expect(document.activeElement).not.toBe(invoker);

    unmount();
    expect(document.activeElement).toBe(invoker);
  });

  it('moves initial focus to the close button (first focusable descendant)', () => {
    initStore();
    render(<SettingsPanel onClose={() => {}} />);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /close settings/i }),
    );
  });

  it('closes on Escape', () => {
    // SettingsPanel now listens on window (Task 1 refactor, Codex Major 5), so a
    // window-dispatched Escape reaches the handler.
    initStore();
    let closed = false;
    render(<SettingsPanel onClose={() => { closed = true; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('wraps Tab from the last focusable to the first (Codex Major 5)', () => {
    initStore();
    render(<SettingsPanel onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable to the last (Codex Major 5)', () => {
    initStore();
    render(<SettingsPanel onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
```

- [ ] **Step 2: Run the test — verify RED**

Run: `npm run test:run -- src/components/__tests__/SettingsPanel.a11y.test.tsx`
Expected RED against the **pre-refactor** panel: the *restores focus* test FAILS (activeElement is `<body>` — the inline trap never restores), and the *closes on Escape* test FAILS (the test dispatches on `window` but the old handler listens on `document`, so it won't fire). The *initial focus to close button* and the two *Tab-wrap* tests should PASS (the inline trap already does both). All five go green after Step 3.

- [ ] **Step 3: Refactor SettingsPanel to `useFocusTrap`**

In `src/components/SettingsPanel/SettingsPanel.tsx`:

Change the import line (`:10`) from:
```tsx
import { useEffect, useRef } from 'react';
```
to:
```tsx
import { useEffect } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
```

Replace the ref + three effects (`:21-64`) — the `panelRef`/`closeButtonRef` refs, the mount-focus effect, and the inline Tab-trap effect — with the hook and just the Escape handler:

```tsx
  const panelRef = useFocusTrap<HTMLDivElement>();

  // Close on Escape. useFocusTrap owns focus-in, Tab-wrap, and focus-restore;
  // it does not own Escape, so keep this handler. Listen on `window` to match
  // the other three overlays (CaseJournal/NPCGallery/EvidenceBoard all use
  // window.addEventListener) — Codex Major 5: a window-dispatched Escape does
  // not propagate down to a document listener, so consistency matters for tests
  // and for real keydowns that bubble to window.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
```

Remove the `ref={closeButtonRef}` attribute from the close `<button>` (`:95`). The inner panel `<div>` keeps `ref={panelRef}` (`:84`) — now the hook's ref. The close button is the first focusable descendant of that panel (the `<h2>` heading precedes it but is not focusable — Codex-verified), so initial focus lands on it exactly as before.

- [ ] **Step 4: Run the test — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/SettingsPanel.a11y.test.tsx`
Expected: all three PASS.

- [ ] **Step 5: Run lint + typecheck to confirm no dangling refs**

Run: `npm run lint`
Expected: clean (no unused `useRef`/`closeButtonRef`).

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel/SettingsPanel.tsx src/components/__tests__/SettingsPanel.a11y.test.tsx
git commit -m "fix(a11y): SettingsPanel restores focus via shared useFocusTrap (Phase 4 WS2)"
```

---

## Task 2: Title-screen background inertness (Codex Major 1 — real bug)

**Files:**
- Modify: `src/App.tsx:232-248`
- Test: `src/components/__tests__/App.test.tsx` (add a describe block)

- [ ] **Step 1: Write the failing test**

Add to `src/components/__tests__/App.test.tsx` (near the existing `#57` inert describe). The title screen is the initial render, so no `reachGameScreen()` needed.

**Codex Major 4 — the test must prove inert holds DURING the Suspense fallback, not only after the lazy panel resolves.** A plain `waitFor` on inert would pass even if a future impl set inert only once the close button appeared. Because `inert` is gated on the synchronous `isSettingsOpen` state (not the resolved chunk), it flips in the **same commit** as the fallback — so assert synchronously right after the click that the `OverlayFallback` ("Loading…") and the inert title region coexist, *then* resolve and verify close removes inert:

```tsx
// Phase 4 WS2 (Codex Major 1 + Major 4): opening Settings from the TITLE screen
// must make the title content inert — gated on state, so it holds DURING the
// Suspense fallback, not only after the lazy panel resolves.
describe('App — title-screen background is inert while Settings is open (Phase 4)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('is inert together with the Loading fallback, and clears on close', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // Synchronous window: the inert region and the OverlayFallback ("Loading…")
    // coexist before the lazy chunk resolves (inert is bound to state, not chunk).
    const region = screen.getByTestId('title-inert-region');
    expect(region.hasAttribute('inert')).toBe(true);
    expect(screen.getByText(/^Loading…$/)).toBeInTheDocument();

    // After the chunk resolves, still inert; then close removes it.
    fireEvent.click(await screen.findByRole('button', { name: /close settings/i }));
    await waitFor(() =>
      expect(screen.getByTestId('title-inert-region').hasAttribute('inert')).toBe(false),
    );
  });
});
```

**Fallback if flaky:** if module caching from an earlier test in the file makes the chunk resolve before the synchronous assertion (no `Loading…`), make the assertion deterministic by mocking the lazy import with a manually-resolved (deferred) promise so the fallback window is held open; assert coexistence, then resolve. Note which approach you used in the commit message.

- [ ] **Step 2: Run the test — verify RED**

Run: `npm run test:run -- src/components/__tests__/App.test.tsx -t "title-screen background"`
Expected: FAIL — `getByTestId('title-inert-region')` throws (no such element yet).

- [ ] **Step 3: Wrap the title content in an inert region**

In `src/App.tsx`, replace the `title` branch (`:232-248`) body so `TitleScreen` sits inside a wrapper gated on `isSettingsOpen` (gate on the **state**, not the lazy chunk, so it is inert even while `OverlayFallback` shows):

```tsx
  if (screen === 'title') {
    return (
      <AccessibilityProvider>
        {/* Background is inert while Settings is open, so focus/pointer/AT
            cannot reach the title behind the overlay. Gate on the state (not the
            resolved lazy chunk) so isolation holds during the Suspense fallback.
            React 19 sets/removes the real `inert` boolean attribute. */}
        <div data-testid="title-inert-region" inert={isSettingsOpen}>
          <TitleScreen
            onNewGame={() => setScreen('character-creation')}
            onLoadGame={() => setScreen('load-game')}
            onSettings={() => setIsSettingsOpen(true)}
            loadError={loadError}
            onDismissError={() => setLoadError(null)}
          />
        </div>
        <Suspense fallback={<OverlayFallback />}>
          {isSettingsOpen && (
            <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
          )}
        </Suspense>
      </AccessibilityProvider>
    );
  }
```

- [ ] **Step 4: Run the test — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/App.test.tsx -t "title-screen background"`
Expected: PASS.

- [ ] **Step 5: Run the App suite to confirm no regression**

Run: `npm run test:run -- src/components/__tests__/App.test.tsx`
Expected: all PASS (incl. the existing `#57` game-branch inert tests).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/__tests__/App.test.tsx
git commit -m "fix(a11y): title-screen background inert while Settings open (Phase 4 WS2, Codex Major 1)"
```

---

## Task 3: Consumer focus-restore guards for the other three overlays

These are **GREEN characterization tests** — the overlays already use `useFocusTrap`, so they pass immediately. They guard against a consumer silently dropping the hook (exactly the SettingsPanel regression), which the hook-level test cannot catch.

**Files:**
- Modify: `src/components/__tests__/overlayFocusTrap.test.tsx` (add restore tests for CaseJournal + NPCGallery)
- Modify: `src/components/__tests__/EvidenceBoard.test.tsx` (add restore test)

- [ ] **Step 1: Add restore tests to `overlayFocusTrap.test.tsx`**

Add inside the existing `CaseJournal — focus trap` describe (the file already imports `render, screen, fireEvent` and defines `initStore` in `beforeEach`):

```tsx
  it('restores focus to the invoker on close', () => {
    render(<button type="button" data-testid="invoker">Open journal</button>);
    const invoker = screen.getByTestId('invoker');
    invoker.focus();
    const { unmount } = render(<CaseJournal onClose={() => {}} />);
    expect(document.activeElement).not.toBe(invoker);
    unmount();
    expect(document.activeElement).toBe(invoker);
  });
```

Add the analogous test inside the `NPCGallery — focus trap` describe (swap `CaseJournal` → `NPCGallery`, label `Open gallery`).

- [ ] **Step 2: Add restore test to `EvidenceBoard.test.tsx`**

Inside the main `describe('EvidenceBoard', ...)` block (uses `initStore(sampleClues)`):

```tsx
  it('restores focus to the invoker on close (WS2)', () => {
    initStore(sampleClues);
    render(<button type="button" data-testid="invoker">Open board</button>);
    const invoker = screen.getByTestId('invoker');
    invoker.focus();
    const { unmount } = render(<EvidenceBoard onClose={() => {}} />);
    expect(document.activeElement).not.toBe(invoker);
    unmount();
    expect(document.activeElement).toBe(invoker);
  });
```

- [ ] **Step 3: Run the tests — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/overlayFocusTrap.test.tsx src/components/__tests__/EvidenceBoard.test.tsx`
Expected: all PASS (behaviour already correct; these are guards).

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/overlayFocusTrap.test.tsx src/components/__tests__/EvidenceBoard.test.tsx
git commit -m "test(a11y): consumer focus-restore guards for all overlays (Phase 4 WS2)"
```

---

## Task 4: Reduced-motion coverage — direct guards for EVERY Motion gate + structural CSS guard

**Corrected scope (Codex Major 1).** The earlier draft classified the transition-prop-only gates as "DOM-identical, untestable in jsdom" and skipped them. That was wrong: even when only Framer *props* differ (`initial`/`animate`/`exit`/`transition`/`whileTap`), a test can **mock the Framer primitive to capture the props** and assert the reduced-motion branch passes motion-free values. The spec requires a direct guard for every reveal/idle gate, so we mock `framer-motion`'s `m` in this file and assert per-component. Only the **ghost thread** stays exempt (pointer-tracking direct-manipulation feedback, not a reveal), documented in the coverage table. The `.reduced-motion` CSS rule keeps a **structural** deletion guard (Minor 7 — jsdom applies no styles).

**Files:**
- Create: `src/components/__tests__/reducedMotion.coverage.test.tsx`

**Mock strategy.** `vi.mock('framer-motion')` with a factory that returns an `m` proxy whose every tag renders a plain host element **spreading a `data-*` capture of the motion props**, plus pass-through `AnimatePresence`/`LazyMotion`/`domAnimation`. Then each component's reduced-motion branch is asserted by reading the captured props (e.g. `initial` is `false`/`{opacity:...}` with no `x`, `transition.duration` is `0`, `whileTap` absent). Components that switch to a **plain** element under reduced motion (ConnectionThread, OutcomeBanner) are asserted by the **absence** of the captured `data-motion` marker.

- [ ] **Step 1: Write the coverage tests**

Create `src/components/__tests__/reducedMotion.coverage.test.tsx`:

```tsx
/**
 * Reduced-motion coverage (Phase 4 WS1).
 *
 * COVERAGE TABLE — every animation source, its mechanism, and how it is guarded:
 *
 *   Source                              | Mechanism                       | Guard here
 *   ------------------------------------|---------------------------------|-------------------------
 *   .reduced-motion * (index.css)       | CSS 0ms anim/transition         | structural CSS test
 *   ConnectionThread m.path             | reducedMotion → plain <path>    | absence-of-m marker
 *   OutcomeBanner AnimatePresence       | reducedMotion → plain div       | absence-of-m marker
 *   DiceRollOverlay (card + die)        | initial/exit/animate gated      | captured-props assert
 *   ClueDiscoveryCard                   | initial/exit x gated            | captured-props assert
 *   EffectFeedback                      | initial gated                   | captured-props assert
 *   HintButton (button + popover)       | initial/exit + transition gated | captured-props assert
 *   DeductionButton                     | whileTap removed                | captured-props assert
 *   ComposureMeter/VitalityMeter width  | transition duration → 0         | captured-props assert
 *   StatusBar meter animate-pulse       | prop-gated CSS class            | StatusBar.test.tsx (kept)
 *   SceneText typewriter                | instant/reduced path            | SceneText.test.tsx (kept)
 *   Ghost thread m.path                 | EXEMPT — pointer-tracking direct | documented, no test
 *                                       | manipulation feedback, not reveal|
 *
 * Approach (Codex Major 1): mock framer-motion so every `m.<tag>` renders a plain
 * host element that serializes its motion props into data-* attributes we can read.
 * Components that switch to a *plain* element under reduced motion (ConnectionThread,
 * OutcomeBanner) are asserted by the ABSENCE of the data-motion marker.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import cssRaw from '../../index.css?raw';

// --- framer-motion mock: capture motion props on a plain host element ---------
vi.mock('framer-motion', () => {
  const React = require('react');
  const makeTag = (tag: string) =>
    React.forwardRef((props: any, ref: any) => {
      const { initial, animate, exit, transition, whileTap, whileHover, children, ...rest } = props;
      return React.createElement(
        tag,
        {
          ...rest,
          ref,
          'data-motion': 'true',
          'data-initial': JSON.stringify(initial ?? null),
          'data-transition': JSON.stringify(transition ?? null),
          'data-whiletap': JSON.stringify(whileTap ?? null),
        },
        children,
      );
    });
  const m = new Proxy({}, { get: (_t, tag: string) => makeTag(tag) });
  return {
    m,
    motion: m,
    AnimatePresence: ({ children }: any) => children,
    LazyMotion: ({ children }: any) => children,
    domAnimation: {},
  };
});

// Imports AFTER the mock so the components pick up the mocked `m`.
import { ConnectionThread } from '../EvidenceBoard/ConnectionThread';
import { OutcomeBanner } from '../NarrativePanel/OutcomeBanner';
import { DiceRollOverlay } from '../NarrativePanel/DiceRollOverlay';
import { ClueDiscoveryCard } from '../NarrativePanel/ClueDiscoveryCard';

describe('reduced-motion — structural CSS guard (Minor 7: structural, not behavioral)', () => {
  it('index.css keeps the .reduced-motion rule zeroing animation + transition duration', () => {
    // jsdom applies no stylesheets, so this is a deletion guard on the source,
    // not proof that motion visibly stops (that is the live browser check).
    const block = cssRaw.match(/\.reduced-motion \*\s*\{[^}]*\}/);
    expect(block, '.reduced-motion * rule present').not.toBeNull();
    expect(block![0]).toMatch(/animation-duration:\s*0ms/);
    expect(block![0]).toMatch(/transition-duration:\s*0ms/);
  });
});

describe('reduced-motion — plain-element gates (absence of the motion marker)', () => {
  it('ConnectionThread renders a plain <path> (no data-motion) when reducedMotion', () => {
    // ghostFrom/ghostTo are ThreadPoint | undefined (NOT null — ConnectionThread.tsx:23-24).
    const conn = [{ fromId: 'a', toId: 'b', fromPoint: { x: 0, y: 0 }, toPoint: { x: 10, y: 10 }, state: 'active' as const }];
    const { container } = render(<ConnectionThread connections={conn} reducedMotion />);
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('data-motion')).toBeNull();
  });

  it('OutcomeBanner renders a plain status div (no data-motion) when reducedMotion', () => {
    render(<OutcomeBanner tier="success" visible reducedMotion />);
    const el = document.querySelector('[role="status"][aria-label^="Outcome"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute('data-motion')).toBeNull();
  });
});

describe('reduced-motion — captured-prop gates (motion params neutralized)', () => {
  it('DiceRollOverlay: die shake transition is duration 0 and card initial is false', () => {
    const { container } = render(
      <DiceRollOverlay roll={14} modifier={2} total={16} visible reducedMotion />,
    );
    const motionEls = Array.from(container.querySelectorAll('[data-motion]'));
    expect(motionEls.length).toBeGreaterThan(0);
    // Every motion element's transition must be duration:0 (or the die's animate {} → transition {duration:0}).
    for (const el of motionEls) {
      const t = JSON.parse(el.getAttribute('data-transition') || 'null');
      if (t && typeof t === 'object' && 'duration' in t) {
        expect(t.duration).toBe(0);
      }
    }
    // The card's initial is `false` under reduced motion (DiceRollOverlay.tsx:42).
    const initials = motionEls.map((el) => el.getAttribute('data-initial'));
    expect(initials).toContain('false');
  });

  it('ClueDiscoveryCard: initial has no x offset under reduced motion', () => {
    const clue = { id: 'c1', title: 'A Clue', type: 'document', status: 'new' } as any;
    render(<ClueDiscoveryCard clue={clue} visible reducedMotion />);
    const el = document.querySelector('[data-motion]');
    expect(el).not.toBeNull();
    const initial = JSON.parse(el!.getAttribute('data-initial') || 'null');
    // Reduced motion uses { opacity: 0 } with NO x (ClueDiscoveryCard.tsx:35).
    expect(initial).not.toBeNull();
    expect(initial.x).toBeUndefined();
  });
});
```

**Notes for the implementer:**
- Verify each component's exact prop interface before running (`ConnectionThread` `Connection`/`ThreadPoint`; `OutcomeBanner` `tier`/`visible`; `DiceRollOverlay` requires `visible && roll != null && total != null`; `ClueDiscoveryCard` `clue`/`visible`/`reducedMotion`/`variant`). Adjust fixtures to match.
- `OutcomeBanner`'s reduced-motion branch gates on an internal `shown` state (a `useEffect`). If the status div is not present synchronously, wrap that assertion in `await waitFor(...)` (import `waitFor`).
- The `require('react')` inside the mock factory is needed because `vi.mock` factories are hoisted above imports; if the project's ESLint forbids `require`, use `await vi.importActual('react')` in an async factory instead.
- **EffectFeedback / HintButton / DeductionButton / the meter width `m.div`** follow the same captured-props pattern — add one assertion each (EffectFeedback: `initial` has no `x`; HintButton popover: `transition.duration` 0; DeductionButton: `whileTap` is `null`; meters: render `<ComposureMeter value={2} reducedMotion />` and assert the `composure-bar` element's `data-transition` duration is 0). Write them following the two examples above; each is ~6 lines.

- [ ] **Step 2: Run — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/reducedMotion.coverage.test.tsx`
Expected: all PASS. If a captured-prop assertion fails, first confirm it reflects the component's *actual* reduced-motion branch (read the source) — the branches are already correct, so a failure means the assertion's expectation is off, not the component.

- [ ] **Step 3: Mutation-check two guards (prove they're not false-green)**

Temporarily break one reduced-motion branch (e.g. in `DiceRollOverlay.tsx` change `initial={reducedMotion ? false : {...}}` to always the object), run the test, watch the DiceRollOverlay assertion FAIL, then restore. Do the same for ConnectionThread (force the `m.path` branch). This is the honest RED for already-correct code.

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/reducedMotion.coverage.test.tsx
git commit -m "test(a11y): direct reduced-motion guards for every Motion gate + structural CSS guard (Phase 4 WS1, Codex Major 1)"
```

---

## Task 5: Focus-ring standardization (all keyboard controls)

**Corrected scope (Codex Major 2).** The spec standard is `focus-visible:ring-2 focus-visible:ring-amber-400`, and it requires migrating **ordinary keyboard-focusable controls off bare `focus:ring-*`** — not only the stone/thin outliers. So this task migrates **every** bare `focus:ring-*` on a keyboard-operable control to the `focus-visible:` amber standard, with two documented exceptions, and a **source-inventory test** that fails if any un-excepted bare-focus ring remains.

**Full site inventory (verified at plan time — re-grep before editing).** Migrate the ring classes at each:

| File:line | Current | Migrate to |
|-----------|---------|-----------|
| `App.tsx:76` | `focus:ring-2 focus:ring-amber-400` | `focus-visible:ring-2 focus-visible:ring-amber-400` |
| `App.tsx:102` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/ErrorBoundary/ErrorBoundary.tsx:38` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/TitleScreen/TitleScreen.tsx:63` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/TitleScreen/TitleScreen.tsx:77` | `focus:ring-2 focus:ring-stone-400` | same (also fixes low-contrast) |
| `components/TitleScreen/TitleScreen.tsx:86` | `focus:ring-2 focus:ring-stone-600` | same |
| `components/TitleScreen/LoadGameScreen.tsx:89` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/TitleScreen/LoadGameScreen.tsx:136` | `focus:ring-2 focus:ring-stone-600` | same |
| `components/CaseSelection/CaseSelection.tsx:40` | `focus:ring-2 focus:ring-stone-600` | same |
| `components/CaseSelection/CaseSelection.tsx:83` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/CaseSelection/CaseSelection.tsx:105` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/CaseSelection/CaseSelection.tsx:130` | `focus:ring-2 focus:ring-stone-600` | same |
| `components/CaseCompletion/CaseCompletion.tsx:72` | `focus:ring-2 focus:ring-amber-400` | same |
| `components/ChoicePanel/ChoiceCard.tsx:131` | `focus:ring-2 focus:ring-gaslight-amber/60` | `focus-visible:ring-2 focus-visible:ring-amber-400` |
| `components/NarrativePanel/ClueDiscoveryCard.tsx:57` | `focus-visible:ring-1 focus-visible:ring-amber-400` | `focus-visible:ring-2 focus-visible:ring-amber-400` (thin→2) |
| `components/HeaderBar/HintButton.tsx:105` | `focus-visible:ring-1 focus-visible:ring-amber-400` | same (thin→2) |

**Do NOT migrate (documented exceptions — the inventory test must allowlist these):**
- `components/TitleScreen/LoadGameScreen.tsx` delete `✕` + autofocus `Confirm?` buttons — keep `focus:ring-2 focus:ring-red-400` (Minor 5: `autoFocus` fires programmatically and may not match `:focus-visible`; red is semantic for a destructive action).
- `App.tsx` skip-to-content link — keeps `focus:ring-2 focus:ring-white` (needs `focus:` so it shows on programmatic focus after activation; white-on-amber is high-contrast).

**Files:**
- Modify: the 16 sites above.
- Test: `src/components/__tests__/focusRing.test.tsx` (create) — a **source-inventory** guard + a rendered spot-check.

- [ ] **Step 1: Write the failing inventory + spot-check test**

Create `src/components/__tests__/focusRing.test.tsx`. The inventory test reads component **source** via `?raw` and fails if any bare `focus:ring-` survives outside the allowlist — this is what makes "standardize *all* rings" enforceable, not just one spot-check (Codex Major 2).

```tsx
/**
 * Focus-ring standardization (Phase 4 WS3, Codex Major 2).
 * All keyboard-focusable controls use focus-visible:ring-2 ring-amber-400.
 * The inventory test reads source and fails if a bare `focus:ring-` remains
 * outside the two documented exceptions (red autofocus confirm, white skip-link).
 * jsdom can't compute contrast — that's the live check (Task 8).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TitleScreen } from '../TitleScreen/TitleScreen';

// Component sources scanned for stray bare-focus rings.
import appRaw from '../../App.tsx?raw';
import titleRaw from '../TitleScreen/TitleScreen.tsx?raw';
import loadRaw from '../TitleScreen/LoadGameScreen.tsx?raw';
import caseSelRaw from '../CaseSelection/CaseSelection.tsx?raw';
import caseComplRaw from '../CaseCompletion/CaseCompletion.tsx?raw';
import choiceRaw from '../ChoicePanel/ChoiceCard.tsx?raw';
import errBoundaryRaw from '../ErrorBoundary/ErrorBoundary.tsx?raw';

afterEach(cleanup);

// A bare `focus:ring-<color>` (not focus-visible:) on a keyboard control is a
// finding UNLESS it is one of the allowlisted intentional exceptions.
function strayBareFocusRings(src: string): string[] {
  const matches = src.match(/(?<!focus-visible:)\bfocus:ring-[a-z0-9/-]+/g) ?? [];
  return matches.filter((m) => {
    if (m.startsWith('focus:ring-red-')) return false;   // red autofocus confirm (Minor 5)
    if (m === 'focus:ring-white') return false;          // skip-link
    if (m === 'focus:ring-2') return false;              // the width utility, paired with focus-visible color
    return true;
  });
}

describe('focus rings — inventory: no stray bare focus:ring on keyboard controls (WS3)', () => {
  const sources: Array<[string, string]> = [
    ['App', appRaw], ['TitleScreen', titleRaw], ['LoadGameScreen', loadRaw],
    ['CaseSelection', caseSelRaw], ['CaseCompletion', caseComplRaw],
    ['ChoiceCard', choiceRaw], ['ErrorBoundary', errBoundaryRaw],
  ];
  for (const [name, src] of sources) {
    it(`${name} has no stray bare focus:ring color utility`, () => {
      expect(strayBareFocusRings(src)).toEqual([]);
    });
  }
});

describe('focus rings — no low-contrast stone / thin ring-1 anywhere scanned (WS3)', () => {
  const all = [appRaw, titleRaw, loadRaw, caseSelRaw, caseComplRaw, choiceRaw, errBoundaryRaw].join('\n');
  it('no ring-stone-400 / ring-stone-600 focus ring remains', () => {
    expect(all).not.toMatch(/ring-stone-[46]00/);
  });
});

describe('focus rings — rendered spot-check (WS3)', () => {
  it('TitleScreen New Investigation button uses focus-visible amber-400', () => {
    render(
      <TitleScreen
        onNewGame={() => {}} onLoadGame={() => {}} onSettings={() => {}}
        loadError={null} onDismissError={() => {}}
      />,
    );
    // Use the New-game button — always enabled (the Load button's accessible name
    // is "No saved investigations available" when there are no saves, Codex Major 2).
    const newGame = screen.getByRole('button', { name: /new investigation|new game/i });
    expect(newGame.className).toMatch(/focus-visible:ring-amber-400/);
    expect(newGame.className).not.toMatch(/(?<!focus-visible:)\bfocus:ring-amber-400/);
  });
});
```

**Notes:** confirm the New-game button's accessible name in `TitleScreen.tsx` and adjust the matcher. Confirm the `ChoiceCard` ring is on a keyboard-focusable element (it is a choice button). If the regex lookbehind is unsupported in the project's Node, replace `strayBareFocusRings` with a split-and-filter that excludes `focus-visible:` occurrences.

- [ ] **Step 2: Run — verify RED**

Run: `npm run test:run -- src/components/__tests__/focusRing.test.tsx`
Expected: multiple FAILs — the inventory finds bare `focus:ring-amber-400`/`focus:ring-stone-*`/`focus:ring-gaslight-amber` across the scanned files.

- [ ] **Step 3: Migrate all 16 sites** per the inventory table above (replace each `focus:ring-<x>` → `focus-visible:ring-2 focus-visible:ring-amber-400`, keeping every other class). Leave the two exceptions untouched.

- [ ] **Step 4: Run — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/focusRing.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Compute contrast ratios from RESOLVED token values (Codex Major 3)**

The plan must measure the **actual resolved** colors, not sRGB guesses. Resolve each token first:
- `amber-400` is Tailwind `oklch(82.8% 0.189 84.429)` — convert to sRGB hex (use a converter, or read the compiled value from the built CSS after `npm run build`: `grep -o 'oklch([^)]*84.429[^)]*)' dist/**/*.css` then convert, or compute via `culori` if available).
- `gaslight-amber` = `#d4a853`, `gaslight-gold` = `#c9a84c` (from `src/index.css:11-16`), `gaslight-ink` = `#1a1a2e`, `gaslight-fog` = `#b8c5d0`.
- `amber-300`, `stone-200`, `stone-400`, `stone-950` — resolve from Tailwind's `theme.css` (all oklch) to sRGB.

Then compute WCAG ratios (fill the table). Helper (feed **resolved** hex values):

```bash
node -e '
const L=h=>{const c=[h.slice(1,3),h.slice(3,5),h.slice(5,7)].map(x=>{let v=parseInt(x,16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const R=(a,b)=>{const l1=L(a),l2=L(b);return((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2)};
// REPLACE the amber400 hex with the resolved oklch→sRGB value before running.
const ink="#1a1a2e",amber400="RESOLVE_ME";
console.log("ring amber-400 on ink:",R(amber400,ink),"(need >=3)");
'
```

- [ ] **Step 6: Run lint + commit**

Run: `npm run lint`
Expected: clean.

```bash
git add src/App.tsx src/components/ErrorBoundary/ErrorBoundary.tsx src/components/TitleScreen/TitleScreen.tsx src/components/TitleScreen/LoadGameScreen.tsx src/components/CaseSelection/CaseSelection.tsx src/components/CaseCompletion/CaseCompletion.tsx src/components/ChoicePanel/ChoiceCard.tsx src/components/NarrativePanel/ClueDiscoveryCard.tsx src/components/HeaderBar/HintButton.tsx src/components/__tests__/focusRing.test.tsx
git commit -m "fix(a11y): standardize ALL keyboard focus rings on focus-visible amber-400; keep red autofocus + skip-link (Phase 4 WS3, Codex Major 2)"
```

### Contrast findings table (fill from Step 5 with RESOLVED values)

Resolved sRGB hex (oklch→sRGB via OKLab, cross-checked against the compiled `dist` `--color-*` tokens): `amber-400 = #ffb900`, `amber-300 = #ffd230`, `stone-200 = #e7e5e4`, `stone-400 = #a6a09b`, `stone-950 = #0c0a09`, `stone-900 = #1c1917`, `red-400 = #ff6467`, `white = #ffffff`. Project tokens: `gaslight-ink = #1a1a2e`, `gaslight-fog = #b8c5d0`, `gaslight-amber = #d4a853`, `gaslight-gold = #c9a84c`.

| Pair | Purpose | Ratio | Threshold | Pass? | Action |
|------|---------|:-----:|:---------:|:-----:|--------|
| amber-400 / gaslight-ink | focus ring | 9.90 | 3:1 (1.4.11) | ✅ PASS | — |
| amber-400 / stone-950 | focus ring | 11.47 | 3:1 (1.4.11) | ✅ PASS | — |
| gaslight-fog / gaslight-ink | body prose | 9.69 | 4.5:1 (1.4.3) | ✅ PASS | — |
| gaslight-amber / gaslight-ink | accent (heading/label) | 7.74 | 4.5:1 (1.4.3) | ✅ PASS | — |
| gaslight-gold / gaslight-ink | accent | 7.46 | 4.5:1 (1.4.3) | ✅ PASS | — |
| amber-300 / gaslight-ink | heading/accent | 11.79 | 4.5:1 (1.4.3) | ✅ PASS | — |
| stone-200 / gaslight-ink | body text | 13.59 | 4.5:1 (1.4.3) | ✅ PASS | — |
| stone-400 / gaslight-ink | muted text | 6.60 | 4.5:1 (1.4.3) | ✅ PASS | — |
| red-400 / stone-900 | destructive confirm ring | 6.05 | 3:1 (1.4.11) | ✅ PASS | retained exception — red is semantic for destructive; ratio clears 3:1 comfortably |
| white / gaslight-amber | skip-link ring on amber bg | 2.20 | 3:1 (1.4.11) | ⚠️ FAIL vs amber bg | retained exception — see note below |

**Standardized amber-400 focus ring:** every migrated control uses `focus-visible:ring-2 focus-visible:ring-amber-400` (`#ffb900`) on a dark ink/stone surface — 9.9–11.5:1, far above the 3:1 non-text-contrast floor (1.4.11), so the ring itself is never the weak link.

**Documented residual — skip-link white ring:** the white (`#ffffff`) ring on the skip-link's `gaslight-amber` (`#d4a853`) focus background is only **2.20:1**, below the 3:1 non-text floor when measured *against the button's own amber fill*. This is a **retained exception**, justified because (a) the ring's outer edge sits against the near-black page background (`stone-950`, white/stone-950 ≈ 20:1), where it is extremely legible, and (b) the skip-link needs bare `focus:` (not `focus-visible:`) so it appears on programmatic focus after activation. The ring remains clearly perceivable in practice; flagged here rather than hidden. (Ratios computed with the WCAG relative-luminance helper from resolved hex; jsdom cannot compute contrast, so this is confirmed live in Task 8.)

---

## Task 6: Preserve regression tests — save toast, keyboard connect, dice-as-status

SceneText's self-paced-prose skip control is **already fully tested** (`SceneText.test.tsx:169-201`) — no new test needed; note it in the commit. This task adds the three missing direct assertions.

**Files:**
- Modify: `src/components/__tests__/App.test.tsx` (success-toast roles)
- Modify: `src/components/__tests__/EvidenceBoard.test.tsx` (keyboard connect)
- Create: `src/components/__tests__/DiceRollOverlay.status.test.tsx`

- [ ] **Step 1: Success-toast roles test (App.test.tsx)**

The file already tests the *failure* toast. Add a success-path assertion. Reuse the existing save flow the failure test uses, but with a save that succeeds (the default `makeLocalStorageMock`), then assert:

```tsx
// Phase 4 WS4 (preserve): a successful manual save is a POLITE status, not an alert.
describe('App — successful save toast is a polite status (F-052 preserve)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('renders role=status / aria-live=polite on save success', async () => {
    stubCaseFetch();
    render(<App />);
    await reachGameScreen();
    fireEvent.click(screen.getByRole('button', { name: /save game/i }));
    const toast = await screen.findByText(/Game saved/i);
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });
});
```

**Note:** confirm the Save button's accessible name and the success message text against `App.tsx`; the toast element carrying `role`/`aria-live` is the container — if `findByText` returns an inner node, walk to the `role`-bearing ancestor (`toast.closest('[role]')`).

**Also (Codex Minor 7):** the existing *failure*-toast test (`App.test.tsx:241-261`) asserts `role="alert"` + message but **not** `aria-live="assertive"`, though the component sets both. Add that missing assertion to the existing failure test:

```tsx
    // (inside the existing failure-toast test, after finding the alert)
    expect(alert.getAttribute('aria-live')).toBe('assertive');
```
Locate the alert element the existing test already grabs (or `screen.getByRole('alert')`) and add the line.

- [ ] **Step 2: Keyboard-connect preserve test (EvidenceBoard.test.tsx)**

The suite tests *click* connect; add the keyboard path (WCAG 2.5.7 conforming). ClueCard is `role="button"` `tabIndex=0` with an `onKeyDown` handling Enter/Space:

```tsx
  it('connects two clues via keyboard (Enter) — no pointer (WCAG 2.5.7 preserve)', () => {
    initStore(sampleClues);
    render(<EvidenceBoard onClose={() => {}} />);
    const a = screen.getByRole('button', { name: /Cipher Note/i });
    const b = screen.getByRole('button', { name: /Witness Account/i });
    fireEvent.keyDown(a, { key: 'Enter' });
    fireEvent.keyDown(b, { key: 'Enter' });
    expect(useStore.getState().connections).toContainEqual({ fromId: 'c1', toId: 'c2' });
  });
```

- [ ] **Step 3: Dice-as-status test (create DiceRollOverlay.status.test.tsx)**

```tsx
/**
 * DiceRollOverlay is a passive status card, NOT a modal (Phase 4 WS4 preserve).
 * Guards against a future "make the dice roll a modal dialog" regression.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DiceRollOverlay } from '../NarrativePanel/DiceRollOverlay';

describe('DiceRollOverlay — passive status, not a modal (preserve)', () => {
  it('exposes role=status / aria-live=polite and is non-interactive', () => {
    // DiceRollOverlay returns null unless visible && roll != null && total != null
    // (DiceRollOverlay.tsx:26) — pass visible.
    const { container } = render(
      <DiceRollOverlay roll={14} modifier={2} total={16} visible reducedMotion />,
    );
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.getAttribute('aria-live')).toBe('polite');
    // Not a dialog and traps nothing: no dialog role, no focusable control of ANY
    // kind (Codex Minor 7 — use the full focusable selector, not just button/a/input).
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    expect(container.querySelector(FOCUSABLE)).toBeNull();
  });
});
```

**Note:** confirm `DiceRollOverlay`'s required props against `src/components/NarrativePanel/DiceRollOverlay.tsx` (e.g. `roll`, `modifier`/`modifierLabel`, `total`, optional `dc`, `reducedMotion`) and adjust the props to match.

- [ ] **Step 4: Run the three tests — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/App.test.tsx src/components/__tests__/EvidenceBoard.test.tsx src/components/__tests__/DiceRollOverlay.status.test.tsx`
Expected: all PASS (behaviour already correct; these are preserve guards).

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/App.test.tsx src/components/__tests__/EvidenceBoard.test.tsx src/components/__tests__/DiceRollOverlay.status.test.tsx
git commit -m "test(a11y): preserve guards — save-toast roles, keyboard connect, dice-as-status (Phase 4 WS4)"
```

---

## Task 7: Full gate — lint, validator, suite, build

- [ ] **Step 1: Run the full gate**

```bash
npm run lint && node scripts/validateCase.mjs && npm run test:run && npm run build
```
Expected: lint clean; validator "8 cases", zero errors/warnings; full suite green (baseline 733/74 + the new tests); build succeeds (incl. `typecheck:scripts`).

- [ ] **Step 2: Record the new baseline**

Note the new `passed (N)` / file count from the suite output for the checkpoint.

- [ ] **Step 3: Commit anything outstanding (should be nothing)**

```bash
git status   # expect clean
```

---

## Task 8: Live in-browser verification (WS3 + reduced-motion — the part tests can't cover)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the local URL).

- [ ] **Step 2: Focus-ring visibility (dark theme)**

Tab through: Title (New Game / Load / Settings), Case Selection, the in-game header (8 buttons), a scene's choices, the Evidence Board cards + close, Settings controls. **Confirm every interactive control shows a visible amber focus ring** on the dark background. No control should focus invisibly.

- [ ] **Step 3: Focus-ring visibility (high-contrast mode)**

Open Settings → enable High Contrast. Repeat the tab-through. Confirm the focus ring stays visible. **If the ring disappears in HC mode** (the HC remaps target text, not rings — Codex Major 2), add an explicit HC ring rule to `src/index.css` (e.g. `.high-contrast *:focus-visible { --tw-ring-color: var(--color-accent); }`), re-verify, and commit separately.

- [ ] **Step 4: Reduced-motion suppression**

Settings → enable Reduced Motion. Confirm: StatusBar meters don't pulse at critical; the dice roll appears without the shake/spring; clue-discovery card appears without slide; evidence-board threads appear without the draw animation. Then set OS `prefers-reduced-motion: reduce` and reload the title — confirm it's detected on first mount.

- [ ] **Step 5: Title-screen inertness (manual)**

On the title screen, open Settings; confirm you cannot Tab to the title buttons behind it and clicking through does nothing; close and confirm focus returns to the Settings button.

- [ ] **Step 6: Record the verification outcome** in the PR description / checkpoint notes (what was checked, screenshots optional, any HC ring fix applied).

---

## Task 9: Codex implementation review (third checkpoint) + PR

- [ ] **Step 1: Push the branch and open the PR (merge commit, never squash)**

```bash
git push -u origin feat/phase4-a11y-sweep
gh pr create --title "Phase 4 — A11y hardening sweep" --body "…"   # include Closes/refs, baseline delta, live-verify notes
```

- [ ] **Step 2: Write the Codex impl-review prompt**

Create `codex/input/2026-07-16-phase4-a11y-hardening-impl.md`: self-contained, carrying the branch + `git diff main..feat/phase4-a11y-sweep`, the production files touched, the spec + this plan paths (fidelity check), and the adversarial charge ("assume ≥1 real defect the internal reviews missed — a false-green/missing test, an integration seam, a place the code diverges from the spec — ground every finding in committed code; run build/tests only if the sandbox allows; cite file:line"). Tell it to write the review to `codex/output/2026-07-16-phase4-a11y-hardening-impl-review.md`.

- [ ] **Step 3: Tell the user to run Codex (read-only), then wait.**

- [ ] **Step 4: Read the review; fold all valid findings** (fix on-branch, keep the gate green, re-verify). State any disagreement explicitly with reasoning.

- [ ] **Step 5: `/checkpoint`** — update PROJECT_STATE + RUN_LOG + status.md baseline; add an ADR only if a non-trivial decision emerged (none expected — this enacts existing roadmap decisions).

---

## Self-review notes (author)

- **Spec coverage:** WS1 → Task 4 (+ kept StatusBar/SceneText tests); WS2 → Tasks 1–3 (SettingsPanel refactor, title inert, consumer restore); WS3 → Task 5 + Task 8 live check; WS4 → Task 6 (+ SceneText already covered). All six §6 success criteria map to a task.
- **Honest deviations from the spec's optimism:** all local Motion branches were already `reducedMotion`-gated (WS1 has no code-gating work — only tests, now *direct* guards per Codex Major 1) and SceneText's skip control is already tested — both stated up front so the implementer doesn't invent work or misread green as incomplete.
- **Codex plan-review (2026-07-16) folded — 6 Major + 1 Minor, all verified:** Major 1 → Task 4 now mocks framer-motion and directly guards **every** Motion gate (not just DOM-divergent ones) + mutation-checks two; Major 2 → Task 5 migrates **all** bare-focus keyboard controls with a source-inventory test + fixes the Load-button-name false-green; Major 3 → contrast table computed from **resolved** oklch→sRGB values + adds the named accent pairs + exception rows; Major 4 → title-inert test asserts inert coexists with the Suspense fallback (state-gated, synchronous); Major 5 → SettingsPanel Escape moved to `window` (matches the other 3 overlays) so the window-dispatched test fires + Tab-wrap tests added; Major 6 → ConnectionThread test passes `undefined`/omits (not `null`) to satisfy the `npm run build` typecheck; Minor 7 → failure-toast `aria-live="assertive"` assertion + broadened dice focusable selector.
- **jsdom limits** (contrast measurement) are handled by resolved-value computation + the live check (Task 8), not pretend unit tests. The `.reduced-motion` CSS rule keeps a structural deletion guard only.
- **Type/name consistency:** test prop shapes are flagged "confirm against the real interface" wherever the plan couldn't guarantee them from the audit (ConnectionThread, OutcomeBanner, DiceRollOverlay, TitleScreen button name) — the implementer verifies before running rather than trusting a guessed shape.
