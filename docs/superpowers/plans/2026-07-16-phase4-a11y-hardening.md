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
| `src/components/__tests__/reducedMotion.coverage.test.tsx` | Create | Structural CSS guard + ConnectionThread + OutcomeBanner reduced-motion DOM tests + coverage table |
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
    initStore();
    let closed = false;
    render(<SettingsPanel onClose={() => { closed = true; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — verify RED**

Run: `npm run test:run -- src/components/__tests__/SettingsPanel.a11y.test.tsx`
Expected: the *restores focus* test FAILS (`document.activeElement` is `<body>`, not the invoker) because the inline trap does not restore. The other two should pass.

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
  // it does not own Escape, so keep this handler.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
```

Remove the `ref={closeButtonRef}` attribute from the close `<button>` (`:95`). The inner panel `<div>` keeps `ref={panelRef}` (`:84`) — now the hook's ref. The close button is the first focusable descendant of that panel (the `<h2>` heading precedes it but is not focusable), so initial focus lands on it exactly as before.

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

Add to `src/components/__tests__/App.test.tsx` (near the existing `#57` inert describe). Match the file's existing helpers (`stubCaseFetch`, `makeLocalStorageMock`, `render(<App />)`); the title screen is the initial render, so no `reachGameScreen()` needed:

```tsx
// Phase 4 WS2 (Codex Major 1): opening Settings from the TITLE screen must make
// the title content inert — the title branch previously rendered TitleScreen and
// SettingsPanel side-by-side with no inert wrapper.
describe('App — title-screen background is inert while Settings is open (Phase 4)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('marks the title content inert when Settings opens, and clears it on close', async () => {
    render(<App />);
    // Open Settings from the title screen.
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    await waitFor(() => {
      const titleContent = screen.getByTestId('title-inert-region');
      expect(titleContent.hasAttribute('inert')).toBe(true);
    });

    // Close Settings.
    fireEvent.click(await screen.findByRole('button', { name: /close settings/i }));
    await waitFor(() => {
      const titleContent = screen.getByTestId('title-inert-region');
      expect(titleContent.hasAttribute('inert')).toBe(false);
    });
  });
});
```

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

## Task 4: Reduced-motion coverage — structural CSS guard + DOM-divergent gates + coverage table

**Honest scope (Codex Major 3 + Minor 7):** the transition-prop-only gates (Dice overlay, ClueDiscoveryCard, EffectFeedback, HintButton, DeductionButton, meter width) render **identical DOM** under reduced-motion — only Framer transition params differ, which jsdom cannot observe. We directly test the **DOM-divergent** gates (ConnectionThread, OutcomeBanner) + the structural CSS guard, and **document** the transition-only gates in a coverage table with their live-check verification, rather than pretend a jsdom test guards them.

**Files:**
- Create: `src/components/__tests__/reducedMotion.coverage.test.tsx`

- [ ] **Step 1: Write the coverage tests**

Create `src/components/__tests__/reducedMotion.coverage.test.tsx`:

```tsx
/**
 * Reduced-motion coverage (Phase 4 WS1).
 *
 * COVERAGE TABLE — every animation source, its mechanism, and how it is guarded:
 *
 *   Source                         | Mechanism                        | Guard here
 *   -------------------------------|----------------------------------|------------------------
 *   .reduced-motion * (index.css)  | CSS 0ms anim/transition          | structural CSS test ↓
 *   ConnectionThread m.path        | reducedMotion → plain <path>     | DOM test ↓
 *   OutcomeBanner AnimatePresence  | reducedMotion → plain status div | DOM test ↓
 *   StatusBar meter animate-pulse  | prop-gated off reducedMotion     | StatusBar.test.tsx (kept)
 *   SceneText typewriter           | instant/reduced path            | SceneText.test.tsx (kept)
 *   DiceRollOverlay, ClueDiscovery |                                  |
 *     Card, EffectFeedback,        | reducedMotion transition params  | DOM-identical → NOT jsdom-
 *     HintButton, DeductionButton, | (initial:false / duration:0)     | observable; verified by the
 *     meter width m.div            |                                  | live in-browser check (Task 9)
 *   Ghost thread m.path            | EXEMPT — pointer-tracking direct- | documented exemption (no test)
 *                                  | manipulation feedback, not reveal |
 *
 * All local m.* branches were verified gated at plan time; a sweep for ungated
 * initial=/whileHover= reveal paths returned zero.
 */
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import cssRaw from '../../index.css?raw';
import { ConnectionThread } from '../EvidenceBoard/ConnectionThread';
import { OutcomeBanner } from '../NarrativePanel/OutcomeBanner';

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

describe('reduced-motion — ConnectionThread (DOM-divergent gate)', () => {
  // Connection.state is 'active' | 'slack' (see ConnectionThread.tsx:11-18); the
  // reducedMotion non-slack branch renders a plain <path>.
  const conn = [{ fromId: 'a', toId: 'b', fromPoint: { x: 0, y: 0 }, toPoint: { x: 10, y: 10 }, state: 'active' as const }];

  it('renders a plain <path> (no framer m.path) when reducedMotion is true', () => {
    const { container } = render(
      <ConnectionThread connections={conn as any} ghostFrom={null} ghostTo={null} reducedMotion />,
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    // Framer's m.path adds a style attribute for its animation; the plain path does not.
    expect(path!.getAttribute('style')).toBeNull();
  });
});

describe('reduced-motion — OutcomeBanner (DOM-divergent gate)', () => {
  it('renders a plain status banner (no AnimatePresence) when reducedMotion is true', async () => {
    // The reduced-motion branch gates on an internal `shown` state set in a
    // useEffect (OutcomeBanner.tsx), so wait for it rather than assert sync.
    render(<OutcomeBanner tier="success" visible reducedMotion />);
    await waitFor(() => {
      const el = document.querySelector('[role="status"][aria-label^="Outcome"]');
      expect(el).not.toBeNull();
    });
  });
});
```

**Note:** verify `ConnectionThread`'s prop shape against `src/components/EvidenceBoard/ConnectionThread.tsx` and `OutcomeBanner`'s props against `src/components/NarrativePanel/OutcomeBanner.tsx` before running; adjust the `conn` object and `OutcomeBanner` props to match the real interfaces (e.g. the exact `state` union and `tier` values). If `OutcomeBanner` uses an internal `shown` delay even in the reduced-motion branch, wrap the assertion in `waitFor`.

- [ ] **Step 2: Run — verify GREEN (adjust props if a shape mismatch fails it)**

Run: `npm run test:run -- src/components/__tests__/reducedMotion.coverage.test.tsx`
Expected: all PASS. If a prop-shape error fails a test, fix the test's props to match the real interface (this is characterization of existing behaviour — the components are correct).

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/reducedMotion.coverage.test.tsx
git commit -m "test(a11y): reduced-motion coverage table + DOM-divergent gate guards (Phase 4 WS1)"
```

---

## Task 5: Focus-ring standardization

Migrate low-contrast stone rings and thin `ring-1` to the standard `focus-visible:ring-2 focus-visible:ring-amber-400`. **Preserve** the red autofocus ring on the LoadGameScreen delete-confirm (Minor 5) and the intentional `focus:ring-white` skip-link.

**Files:**
- Modify: `src/components/TitleScreen/TitleScreen.tsx:77,86`
- Modify: `src/components/TitleScreen/LoadGameScreen.tsx:136`
- Modify: `src/components/CaseSelection/CaseSelection.tsx:40,130`
- Modify: `src/components/NarrativePanel/ClueDiscoveryCard.tsx:57`
- Modify: `src/components/HeaderBar/HintButton.tsx:105`
- Test: `src/components/__tests__/focusRing.test.tsx` (create)

- [ ] **Step 1: Write the failing class-presence test**

Create `src/components/__tests__/focusRing.test.tsx`:

```tsx
/**
 * Focus-ring standardization (Phase 4 WS3). Low-contrast stone rings and thin
 * ring-1 indicators migrated to the standard focus-visible:ring-2 ring-amber-400.
 * Class-presence assertions (jsdom can't compute contrast — that's the live check).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TitleScreen } from '../TitleScreen/TitleScreen';

afterEach(cleanup);

describe('focus rings — standardized amber, no low-contrast stone (WS3)', () => {
  it('TitleScreen Load Game button uses amber-400, not a stone ring', () => {
    render(
      <TitleScreen
        onNewGame={() => {}} onLoadGame={() => {}} onSettings={() => {}}
        loadError={null} onDismissError={() => {}}
      />,
    );
    const load = screen.getByRole('button', { name: /load|continue/i });
    expect(load.className).toMatch(/ring-amber-400/);
    expect(load.className).not.toMatch(/ring-stone-[46]00/);
  });
});
```

**Note:** confirm the exact accessible name of the Load button in `TitleScreen.tsx` and adjust the `name` matcher; if Load is disabled with no saves, render with a state that enables it or assert on the Settings/New Game button that carries the migrated ring.

- [ ] **Step 2: Run — verify RED**

Run: `npm run test:run -- src/components/__tests__/focusRing.test.tsx`
Expected: FAIL — the button still has `ring-stone-400`/`ring-stone-600`.

- [ ] **Step 3: Migrate the rings**

In each site, replace the focus-ring classes as follows (leave all other classes intact):

- `TitleScreen.tsx:77` — `focus:outline-none focus:ring-2 focus:ring-stone-400` → `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
- `TitleScreen.tsx:86` — `focus:outline-none focus:ring-2 focus:ring-stone-600` → `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
- `LoadGameScreen.tsx:136` — `focus:outline-none focus:ring-2 focus:ring-stone-600` → `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
- `CaseSelection.tsx:40` — `focus:outline-none focus:ring-2 focus:ring-stone-600` → `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
- `CaseSelection.tsx:130` — `focus:outline-none focus:ring-2 focus:ring-stone-600` → `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
- `ClueDiscoveryCard.tsx:57` — `focus-visible:ring-1 focus-visible:ring-amber-400` → `focus-visible:ring-2 focus-visible:ring-amber-400`
- `HintButton.tsx:105` — `focus-visible:ring-1 focus-visible:ring-amber-400` → `focus-visible:ring-2 focus-visible:ring-amber-400`

**Do NOT touch** (documented exceptions):
- `LoadGameScreen.tsx:106-123` — the delete `✕` and autofocus `Confirm?` buttons keep `focus:ring-2 focus:ring-red-400` (Minor 5: programmatic `autoFocus` is not guaranteed to match `:focus-visible`; red is semantically intentional for a destructive action).
- `App.tsx:339` — the skip-link keeps `focus:ring-2 focus:ring-white` (intentional `focus:` so it shows on programmatic focus; white on the amber focus background is high-contrast).

- [ ] **Step 4: Run — verify GREEN**

Run: `npm run test:run -- src/components/__tests__/focusRing.test.tsx`
Expected: PASS.

- [ ] **Step 5: Compute contrast ratios for the findings table**

Run this one-liner (WCAG relative-luminance formula) to fill the findings table below:

```bash
node -e '
const L=h=>{const c=[h.slice(1,3),h.slice(3,5),h.slice(5,7)].map(x=>{let v=parseInt(x,16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const R=(a,b)=>{const l1=L(a),l2=L(b);return((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2)};
const ink="#1a1a2e",stone950="#0c0a09",amber400="#f5b544",fog="#b8c5d0",stone200="#e7e5e4",stone400="#a8a29e",amber300="#fcd34d";
console.log("ring amber-400 on ink:",R(amber400,ink),"(need >=3)");
console.log("ring amber-400 on stone-950:",R(amber400,stone950),"(need >=3)");
console.log("body fog on ink:",R(fog,ink),"(need >=4.5)");
console.log("stone-200 on ink:",R(stone200,ink),"(need >=4.5)");
console.log("stone-400 muted on ink:",R(stone400,ink),"(need >=4.5 / >=3 large)");
console.log("amber-300 heading on ink:",R(amber300,ink),"(need >=4.5)");
'
```

Record results in the findings table in the plan's Contrast section below (fill the ratio + pass/fail). `amber-400`'s exact hex is Tailwind's `oklch(82.8% 0.189 84.429)`; the `#f5b544` above is a close sRGB approximation — if any ring result is marginal (near 3.0), resolve the exact sRGB from the built CSS before deciding.

- [ ] **Step 6: Run lint + commit**

Run: `npm run lint`
Expected: clean.

```bash
git add src/components/TitleScreen/TitleScreen.tsx src/components/TitleScreen/LoadGameScreen.tsx src/components/CaseSelection/CaseSelection.tsx src/components/NarrativePanel/ClueDiscoveryCard.tsx src/components/HeaderBar/HintButton.tsx src/components/__tests__/focusRing.test.tsx
git commit -m "fix(a11y): standardize focus rings on amber-400; keep red autofocus + skip-link exceptions (Phase 4 WS3)"
```

### Contrast findings table (fill from Step 5)

| Pair | Purpose | Ratio | Threshold | Pass? | Action |
|------|---------|:-----:|:---------:|:-----:|--------|
| amber-400 / gaslight-ink | focus ring | _fill_ | 3:1 (1.4.11) | _fill_ | — |
| amber-400 / stone-950 | focus ring | _fill_ | 3:1 (1.4.11) | _fill_ | — |
| gaslight-fog / gaslight-ink | body prose | _fill_ | 4.5:1 (1.4.3) | _fill_ | — |
| stone-200 / gaslight-ink | body text | _fill_ | 4.5:1 (1.4.3) | _fill_ | — |
| stone-400 / gaslight-ink | muted text | _fill_ | 4.5:1 (1.4.3) | _fill_ | document if fail |
| amber-300 / gaslight-ink | heading/accent | _fill_ | 4.5:1 (1.4.3) | _fill_ | — |

Fix clear failures; **document** any marginal residual here rather than leave it silent.

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
    // Not a dialog and traps nothing: no dialog role, no focusable controls.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('button, a[href], input')).toBeNull();
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
- **Honest deviations from the spec's optimism:** all local Motion branches were already gated (WS1 has no code-gating work, only tests) and SceneText's skip control is already tested — both stated up front so the implementer doesn't invent work or misread green as incomplete.
- **jsdom limits** (transition-only reduced-motion, contrast) are handled by the coverage-table documentation + the live check (Task 8), not pretend unit tests — consistent with Codex Minor 7 and the repo's existing stance.
- **Type/name consistency:** test prop shapes are flagged "confirm against the real interface" wherever the plan couldn't guarantee them from the audit (ConnectionThread, OutcomeBanner, DiceRollOverlay, TitleScreen button name) — the implementer verifies before running rather than trusting a guessed shape.
