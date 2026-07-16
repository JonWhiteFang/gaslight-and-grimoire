# Phase 4 — A11y Hardening Sweep (design spec)

> **Type:** Design spec for a single implementation cycle (spec → Codex-gated plan → impl).
> **Date:** 2026-07-16 · **Branch (planned):** `feat/phase4-a11y-sweep` (from `main`; never squash-merge).
> **Roadmap position:** the **last scheduled UI/UX phase** — [`ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md) Phase 4,
> backlog items **3, 4, 5** + the designated home for the four "preserve" regression tests.
> **Evidence base:** [`ui-ux-improvements.md`](../../research/ui-ux-improvements.md) Parts I / IV / VI.

---

## 1. Framing — this is a verify-and-close-gaps sweep, not greenfield

A code-grounded audit of `main` (2026-07-16) found the codebase **already implements most of items 3/4/5**.
Phase 4 is therefore: **(a)** fix the specific regressions/gaps the audit found, **(b)** standardize focus
indicators, **(c)** lock correct behaviour in with regression tests so a future refactor can't silently lose it.

No new features. No design decisions live inside the work — it is a checklist sweep against WCAG success
criteria, which is exactly why the roadmap batches it into **one coherent plan + diff PR**.

**Expected, legitimate outcome:** Workstreams 1 (reduced-motion) and 4 (preserve) may land as *mostly tests* —
the behaviour is already correct. That is the point of a hardening sweep; it is not a sign of missing scope.
The only behavioural code changes are the **SettingsPanel focus refactor** (WS2) and the **focus-ring
migrations** (WS3).

### In scope

| # | Workstream | Backlog item | Nature |
|--:|-----------|:------------:|--------|
| 1 | Reduced-motion coverage | 3 | Verify every animation source respects the flag; regression-test each; gate any unguarded JS-driven Motion path |
| 2 | Focus-restore + background inertness across **all** overlays | 4 | Fix SettingsPanel (only real gap); test focus-restore for all four overlays |
| 3 | Contrast / focus-indicator pass (**targeted**) | 5 | Standardize focus rings; spot-check primary color pairs against SC 1.4.3/1.4.11/2.4.7/2.4.11 |
| 4 | Preserve regression tests (rides-along) | — | Lock in four already-correct behaviours |

### Explicitly out of scope

- **Touch fallback** (research item G3) — deprioritized; separate follow-up.
- **Choice-gating content model** (Phase 5) — the next phase, not this one.
- Any **deduction or dice logic** change — Phases 2b/3 are done and frozen here.
- A **comprehensive token-wide contrast ledger** — the contrast pass is *targeted* (user decision); it produces
  a findings table for the pairs actually in use, not an exhaustive audit of every token combination.

---

## 2. Current-state audit (verified against `main`, 2026-07-16)

| Surface / concern | Verified state | Gap for Phase 4 |
|-------------------|----------------|-----------------|
| **Global reduced-motion CSS** (`src/index.css:90`) | `.reduced-motion * { animation-duration: 0ms !important; transition-duration: 0ms !important; }` — neutralizes **all** CSS/Tailwind animation incl. `animate-pulse`. | None functionally; **no regression test** guards the rule's existence/effect. |
| **`.reduced-motion` class application** (`AccessibilityProvider.tsx:60`) | Applied to `<html>` from the store `reducedMotion` flag; seeded from OS `prefers-reduced-motion` on first mount. | Covered by `accessibilitySettings.test.tsx`; keep. |
| **StatusBar meters** (`ComposureMeter.tsx:100`, `VitalityMeter.tsx:99`) | `animate-pulse` prop-gated off when `reducedMotion` (belt-and-braces over the CSS rule). | Already tested (`StatusBar.test.tsx`); keep. |
| **ConnectionThread** (`ConnectionThread.tsx:50`) | JS-driven `m.path`; renders final state with **no** draw/fade when `reducedMotion` (CSS rule can't reach JS-driven Motion). | Needs an explicit regression test; sweep for any *other* unguarded `m.*` path. |
| **Typewriter prose** (`SceneText.tsx`) | Instant / reduced-motion path renders full text immediately; keyboard skip `<button>`; `sr-only aria-live` full text once (F-049). | Covered by `SceneText.test.tsx`; strengthen the specific skip-control + instant-path assertions (WS4). |
| **Background inertness** (`App.tsx:333`) | `inert={anyOverlayOpen}` — React-19-correct boolean; background focus/pointer/AT isolated while any overlay is open. | Already tested; confirm and leave. |
| **`useFocusTrap`** (`hooks/useFocusTrap.ts`) | Captures `document.activeElement` on mount, traps Tab with wrap, **restores focus on unmount**. Used by EvidenceBoard, CaseJournal, NPCGallery. | Focus-**restore** is untested for every consumer (existing tests only cover focus-in + Escape). |
| **SettingsPanel focus** (`SettingsPanel.tsx:24–64`) | **Bespoke inline trap**: focuses close button on mount, traps Tab — but **never captures/restores the invoking control**. Closing Settings drops focus to `<body>`. | **The one real focus regression.** Refactor to `useFocusTrap` (user decision). |
| **Focus-ring indicators** (app-wide) | Inconsistent: `ring-amber-400` dominant (~19), plus `ring-white` (5), `ring-stone-600` (4), `ring-stone-400` (1), `ring-red-400` (2), `ring-gaslight-crimson` (1), two thin `ring-1`. | Low-contrast stone rings + thin `ring-1` are likely SC 2.4.7/2.4.11 failures on the dark theme. Standardize. |
| **Text/UI contrast** (dark gaslit theme) | Not measured against the palette (`gaslight-*` tokens + `stone-*`). | Spot-check primary pairs; document residuals. |
| **Save toast** (`App.tsx`) | Success `role="status"`/`aria-live="polite"`; failure `role="alert"`/`aria-live="assertive"` (F-052/F-103). | Correct; add a preserve regression test (WS4). |
| **Dice overlay** (`DiceRollOverlay.tsx`) | `role="status"`/`aria-live="polite"`, non-interactive, **not** a modal. | Correct; add a preserve test guarding against a future "make it modal" regression (WS4). |

---

## 3. Workstreams

### WS1 — Reduced-motion coverage (item 3)

**Goal:** every animation source demonstrably respects the reduced-motion flag, with a test per source, and
no JS-driven Motion path left ungated.

1. **Audit + classify every animation source** into a coverage table (source → mechanism → test), embedded in
   the plan. Known sources: CSS/Tailwind `animate-pulse` (App loading screens, StatusBar meters, HeaderBar
   notification dot, `ClueCard` connected glow); JS-driven Motion `m.*` (ConnectionThread; **sweep for others** —
   `grep` for `m\.` / `initial=` / `animate=` across components); timer-driven typewriter (SceneText, gated via
   `textSpeed`/reduced-motion). No auto-advancing timers block progress (confirmed — none exist).
2. **Gate any unguarded JS-driven Motion path** found in the sweep, following the ConnectionThread pattern
   (branch on the `reducedMotion` prop; render the final state with no transform/opacity animation). The global
   CSS rule cannot reach JS-driven Motion, so props are the only mechanism there.
3. **Regression tests, one per source class:**
   - The `.reduced-motion` global rule exists and its selector matches (guards `src/index.css:90` against
     deletion — assert the CSS text is present in the built stylesheet / a static import assertion).
   - StatusBar meters drop `animate-pulse` when `reducedMotion` (exists — keep).
   - ConnectionThread renders its final-state path (no `initial`/`animate` draw) when `reducedMotion`.
   - SceneText renders full text immediately under the instant / reduced-motion path (strengthen).

**Acceptance:** coverage table complete; every row has a mechanism and a test; no `m.*` path lacks a
`reducedMotion` branch.

### WS2 — Focus-restore + background inertness (item 4)

**Goal:** all four overlays (EvidenceBoard, CaseJournal, NPCGallery, SettingsPanel) trap focus, close on Escape,
and **restore focus to the invoking control on close**; background stays inert while any overlay is open.

1. **Refactor `SettingsPanel` to `useFocusTrap`** (user decision):
   - Attach the hook's returned ref to the panel container (`panelRef` → `useFocusTrap<HTMLDivElement>()`).
   - Delete the inline Tab-trap effect (`SettingsPanel.tsx:39–64`) and the mount-focus effect
     (`:24–27`) — the hook owns both focus-in and Tab-wrap.
   - **Keep** the Escape-to-close effect (`:29–36`) — `useFocusTrap` does not own Escape.
   - **Focus-in nuance:** the inline version focuses the *close button*; `useFocusTrap` focuses the *first
     focusable descendant*. In SettingsPanel's DOM the close `<button>` is the first focusable element (the
     `<h2>` heading is not focusable and precedes it). Behaviour is preserved. **Verify DOM order and assert
     it in a test** so a future markup change that inserts a focusable before the close button is caught.
   - Net effect: focus-restore-on-close for free; one trap implementation across all four overlays; ~−25 lines.
2. **Confirm background inertness** — `inert={anyOverlayOpen}` on the App root (`App.tsx:333`). Already tested;
   verify the test still asserts the boolean attribute is set/removed, and leave it.
3. **Tests:**
   - **Focus-restore-on-close for all four overlays**: render with a known invoking `<button>` focused → mount
     overlay → unmount (close) → assert `document.activeElement` is the invoker. (This is the untested invariant
     across the board — `useFocusTrap`'s restore is real but unguarded by tests.)
   - SettingsPanel: focus moves into the dialog on open (lands on the close button = first focusable); Escape
     closes; Tab wraps first↔last.

**Acceptance:** all four overlays pass the focus-restore test; SettingsPanel uses `useFocusTrap`; no bespoke
trap implementation remains; inertness test intact.

### WS3 — Contrast / focus-indicator pass (item 5, targeted)

**Goal:** a consistent, WCAG-conformant focus indicator across the app, and primary color pairs spot-checked
against contrast thresholds with residuals documented.

1. **Standardize the focus indicator** on `focus-visible:ring-2 focus-visible:ring-amber-400` (the `#d4a853`
   amber token) — applied on `focus-visible` (not bare `focus`, so it doesn't fire on mouse click):
   - Migrate the low-contrast / thin outliers: `ring-stone-600`, `ring-stone-400`, and the two `ring-1` sites
     → the standard `ring-2 ring-amber-400`.
   - Migrate bare `focus:ring-*` → `focus-visible:ring-*` where the element is keyboard-focusable and the mouse
     ring is unwanted.
   - **Leave semantically-intentional rings** that already meet ≥3:1 on their surface (e.g. `ring-red-400` on a
     destructive control; `ring-white` where the surface makes it high-contrast) — but **verify each against
     its actual surface** rather than assume; migrate any that fail.
2. **Compute the amber-on-dark ring ratio** as a non-text indicator (SC 1.4.11, ≥3:1): `#d4a853` on
   `--color-gaslight-ink #1a1a2e` and on `bg-stone-950`. *Preliminary calc: ≈7.7:1 on ink — comfortably passes;
   verify live.* If any surface fails, escalate (brighter ring / focus offset).
3. **Spot-check primary text pairs** (SC 1.4.3, ≥4.5:1 for body text; ≥3:1 for large): body prose
   (`text-stone-200` / `gaslight-fog` on dark surfaces), amber headings/accents (`text-amber-300/400`,
   `gaslight-amber/gold`), muted/disabled text (`text-stone-400`). Compute ratios; fix clear failures;
   **document residuals in the plan's findings table** (pair → ratio → pass/fail → action) rather than silently
   leaving them.
4. **High-contrast-mode composition:** confirm the ring standardization composes with the existing
   `.high-contrast` remaps (amber → `#ffea00`, borders → white); the focus ring must not be overridden away in
   that mode.

**Verification note:** contrast ratios are not meaningfully unit-testable in jsdom (no layout / computed color).
This workstream's verification is the **computed-ratio findings table** (in the plan) plus a **live in-browser
check**. The focus-ring standardization *is* testable as a class-presence assertion on representative controls.

**Acceptance:** focus rings standardized; findings table complete with every checked pair and its action; live
in-browser confirmation that keyboard focus is visible on the dark theme (and in high-contrast mode).

### WS4 — Preserve regression tests (rides-along)

**Goal:** lock in four already-correct behaviours so a future refactor can't silently lose them. These are
**characterization tests** — they encode *current* behaviour and are written **GREEN** (behaviour is already
correct), not RED-first. Before adding, audit existing coverage; strengthen indirect/weak coverage rather than
duplicate it.

1. **Self-paced prose** (`SceneText`) — the keyboard skip `<button>` is present and operable (Enter/click skips
   to full text); the instant / reduced-motion path renders full text immediately.
2. **Polite/assertive save toast** (`App.tsx`) — success toast is `role="status"` + `aria-live="polite"`;
   failure is `role="alert"` + `aria-live="assertive"` (F-052/F-103).
3. **Board keyboard-connect** (`EvidenceBoard` / `ClueCard`) — Space/Enter select-then-select forms a connection
   with no pointer event (the WCAG 2.5.7 conforming path).
4. **Dice-as-status** (`DiceRollOverlay`) — `role="status"` + `aria-live="polite"`, non-interactive, not a focus
   trap (guards against a future "make it a modal" regression).

**Acceptance:** each behaviour has a direct assertion; a plausible refactor that broke it would fail a test.

---

## 4. Cross-cutting

- **One PR** on `feat/phase4-a11y-sweep` from `main`. **Never squash-merge** (merge commit or rebase — the
  memory spine relies on per-commit TDD history).
- **Codex file-based review** at all three checkpoints (CLAUDE.md): **spec**, **plan**, **completed
  implementation**. Write prompt to `codex/input/2026-07-16-phase4-a11y-<target>.md`; review to
  `codex/output/…-review.md`. Address all valid findings; disagreements stated explicitly.
- **Gate green throughout:** `npm run lint` + `node scripts/validateCase.mjs` (8 cases) + `npm run test:run` +
  `npm run build`.
- **Live in-browser verification** for WS3 (the part tests cannot cover): keyboard-tab through the app on the
  dark theme and in high-contrast mode; confirm the focus ring is visible on every interactive surface; confirm
  reduced-motion (OS pref + Settings toggle) suppresses the pulse/draw animations.
- **Task order (indicative; the plan sequences precisely):** WS2 (SettingsPanel refactor — the real fix) →
  WS1 (reduced-motion verify + tests) → WS3 (contrast / rings) → WS4 (preserve tests).

## 5. Risks & smallest-surprise notes

- **WS1/WS4 land as mostly tests.** Expected — the behaviour is already correct. Not missing scope.
- **SettingsPanel focus-in change.** The refactor shifts initial focus from an explicit close-button `.focus()`
  to "first focusable descendant." Mitigated: the close button *is* the first focusable; a test asserts the DOM
  order so a future markup change that regresses it is caught.
- **`focus` → `focus-visible` migration.** On very old browsers `focus-visible` degrades, but the repo targets
  modern evergreen (Vite/React 19); acceptable. Do not remove a bare `focus:` ring without replacing it — an
  element must never lose its focus indicator entirely.
- **Contrast pass is targeted, not exhaustive.** Residuals are documented, not necessarily all fixed; the
  findings table is the auditable record so a later comprehensive pass knows where to start.

## 6. Success criteria (phase-level)

1. SettingsPanel restores focus to its invoker on close; all four overlays pass a focus-restore test.
2. Every animation source has a reduced-motion mechanism and a regression test; no ungated `m.*` path.
3. Focus indicators standardized; amber ring verified ≥3:1 on dark surfaces; primary contrast pairs
   spot-checked with a documented findings table; live-verified visible on dark + high-contrast.
4. All four preserve behaviours have direct regression tests.
5. Gate green (lint + validator 8 cases + full suite + build); Codex spec/plan/impl passes folded; PR opened
   with a merge commit.
