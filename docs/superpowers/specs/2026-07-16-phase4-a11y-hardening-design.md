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

**Expected, legitimate outcome:** Workstream 4 (preserve) may land as *mostly tests* — the behaviour is
already correct. That is the point of a hardening sweep; it is not a sign of missing scope. The behavioural
code changes are the **SettingsPanel focus refactor**, the **title-screen inertness fix** (both WS2), the
**focus-ring migrations** (WS3), and gating any **ungated JS-driven Motion path** found in the WS1 sweep.

> **Codex spec review folded (2026-07-16, `codex/output/2026-07-16-phase4-a11y-hardening-review.md`):** 4 Majors
> + 3 Minors, all verified against code and incorporated. Major 1 — background inertness is **not** done on the
> title→Settings route (real app bug, App.tsx:232-248); WS2 now fixes it. Major 2 — `#d4a853` is
> `--color-gaslight-amber` (`ring-gaslight-amber`), not `ring-amber-400`; WS3 now picks the ring token
> explicitly and computes from its resolved value. Major 3 — many local `m.*` reduced-motion gates beyond
> ConnectionThread; WS1's coverage table now enumerates every one and states the ghost-thread exemption. Major 4
> — SC 2.4.11 is *Focus Not Obscured*, mis-cited; WS3 now uses 2.4.7 + 1.4.11 and drops 2.4.11 as an indicator
> target. Minors 5–7 folded (autofocus exception, hook-level restore already tested, CSS test is structural-only).

### In scope

| # | Workstream | Backlog item | Nature |
|--:|-----------|:------------:|--------|
| 1 | Reduced-motion coverage | 3 | Verify every animation source respects the flag; regression-test each; gate any unguarded JS-driven Motion path |
| 2 | Focus-restore + background inertness across **all** overlays | 4 | Fix SettingsPanel (only real gap); test focus-restore for all four overlays |
| 3 | Contrast / focus-indicator pass (**targeted**) | 5 | Standardize focus rings; spot-check primary color pairs against SC 1.4.3 (text ≥4.5:1), 1.4.11 (non-text/UI ≥3:1), 2.4.7 (focus visible) |
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
| **Background inertness — game branch** (`App.tsx:320-334`) | `inert={anyOverlayOpen}` — React-19-correct boolean; background isolated while an overlay is open in the *game* screen. Tested (`App.test.tsx:168-190`, Evidence Board only). | Correct for the game branch; keep. |
| **Background inertness — title branch** (`App.tsx:232-248`) | **BUG (Codex Major 1):** the `title` branch renders `TitleScreen` **and** `SettingsPanel` side-by-side with **no `inert` wrapper** and returns before `anyOverlayOpen` is computed. Opening Settings from the title screen leaves the background interactive. | **Real gap — fix in WS2.** Make the title content inert while Settings is open (incl. during the lazy fallback); add a title→Settings inert assertion. |
| **`useFocusTrap`** (`hooks/useFocusTrap.ts`) | Captures `document.activeElement` on mount, traps Tab with wrap, **restores focus on unmount**. Used by EvidenceBoard, CaseJournal, NPCGallery. Restore **is** directly tested at the hook level (`useFocusTrap.test.tsx:48-60`, Codex Minor 6). | Focus-restore is untested at the **consumer** level (existing consumer tests cover only focus-in + Escape) — a component silently dropping the hook would not be caught. Add consumer-level restore tests. |
| **SettingsPanel focus** (`SettingsPanel.tsx:24–64`) | **Bespoke inline trap**: focuses close button on mount, traps Tab — but **never captures/restores the invoking control**. Closing Settings drops focus to `<body>`. | **The one real focus regression.** Refactor to `useFocusTrap` (user decision). |
| **Focus-ring indicators** (app-wide) | Inconsistent: `ring-amber-400` dominant (~19), plus `ring-white` (5), `ring-stone-600` (4), `ring-stone-400` (1), `ring-red-400` (2), `ring-gaslight-crimson` (1), two thin `ring-1`. **Note:** `ring-amber-400` is Tailwind's built-in bright amber (`oklch(82.8% 0.189 84.429)`), **not** the project's `#d4a853` (which is `--color-gaslight-amber` → `ring-gaslight-amber`) — Codex Major 2. | Low-contrast stone rings + thin `ring-1` are likely SC 2.4.7 (focus visible) / 1.4.11 (≥3:1) failures on the dark theme. Standardize on one explicitly-chosen token. |
| **Text/UI contrast** (dark gaslit theme) | Not measured against the palette (`gaslight-*` tokens + `stone-*`). | Spot-check primary pairs; document residuals. |
| **Save toast** (`App.tsx`) | Success `role="status"`/`aria-live="polite"`; failure `role="alert"`/`aria-live="assertive"` (F-052/F-103). | Correct; add a preserve regression test (WS4). |
| **Dice overlay** (`DiceRollOverlay.tsx`) | `role="status"`/`aria-live="polite"`, non-interactive, **not** a modal. | Correct; add a preserve test guarding against a future "make it modal" regression (WS4). |

---

## 3. Workstreams

### WS1 — Reduced-motion coverage (item 3)

**Goal:** every animation source demonstrably respects the reduced-motion flag, with a test per source, and
no JS-driven Motion path left ungated.

**Codex Major 3 correction:** the global CSS rule (`.reduced-motion *`) neutralizes CSS/Tailwind animation only.
JS-driven Motion (`m.*`) is *not* reached by it, and there are **many** independent local `reducedMotion`
branches, not just ConnectionThread. A "test per source class" that names only meters + ConnectionThread + SceneText
would leave most of them unguarded. The coverage table must enumerate **every** gate and give each a direct test
(or the sweep must find a genuinely centralized mechanism to test once).

1. **Coverage table — one row per animation source**, embedded in the plan, each with `source → mechanism →
   test`. The full enumerated set (verified 2026-07-16):

   | Source | Mechanism | Test |
   |--------|-----------|------|
   | Global CSS rule `.reduced-motion *` (`index.css:90-93`) | CSS `animation/transition-duration: 0ms` | **Structural** guard only (see note) — assert selector + both declarations present via `?raw` import |
   | `.reduced-motion` class applied to `<html>` (`AccessibilityProvider.tsx:60-68`) | store flag → class | exists (`accessibilitySettings.test.tsx`) — keep |
   | ComposureMeter / VitalityMeter `animate-pulse` (`ComposureMeter.tsx:100`, `VitalityMeter.tsx:99`) | prop-gate off `reducedMotion` | exists (`StatusBar.test.tsx:165-207`) — keep |
   | ComposureMeter / VitalityMeter **`m.div` width transition** (`ComposureMeter.tsx:98-115`, `VitalityMeter.tsx:97-114`) | local `reducedMotion` branch | **add** — currently untested (Major 3) |
   | ConnectionThread `m.path` draw/fade (`ConnectionThread.tsx:50-66`) | `reducedMotion` prop → final-state render | **add** |
   | DiceRollOverlay (`DiceRollOverlay.tsx:35-52`) | local `reducedMotion` branch | **add** |
   | ClueDiscoveryCard (`ClueDiscoveryCard.tsx:29-38`) | local `reducedMotion` branch | **add** |
   | EffectFeedback (`EffectFeedback.tsx:27-38`) | local `reducedMotion` branch | **add** |
   | HintButton (`HintButton.tsx:53-83`) | local `reducedMotion` branch | **add** |
   | DeductionButton (`DeductionButton.tsx:52-64`) | local `reducedMotion` branch | **add** |
   | OutcomeBanner (`OutcomeBanner.tsx:111-142`) | local `reducedMotion` branch | **add** |
   | SceneText typewriter (`SceneText.tsx:59-64`) | instant/reduced-motion path renders full text | strengthen (also WS4) |
   | App loading `animate-pulse` (`App.tsx:48,270`), HeaderBar dot (`HeaderBar.tsx:105`), ClueCard **`new`-status** `animate-pulse` (`ClueCard.tsx:52`) | global CSS rule | covered by the structural guard; no per-component test needed |
   | **Ghost thread** `m.path` (`ConnectionThread.tsx:104-113`), rAF-driven from pointer (`EvidenceBoard.tsx:200-225`) | **EXEMPT** — direct-manipulation feedback tied to live pointer position; not a reveal/idle animation | documented exemption (no test); the acceptance rule is scoped to reveal/idle Motion, not pointer-tracking |

   *(Correction folded: the earlier draft mis-named a "ClueCard connected glow" — `animate-pulse` is the
   **`new`** status; the connected cue is a **static** `ring-2 ring-yellow-500` (`ClueCard.tsx:127`), no animation.)*
2. **Sweep for any Motion path not in the table** (`grep` `m\.` / `initial=` / `animate=` / `whileHover` /
   `whileTap`); gate any *reveal/idle* one found on `reducedMotion` (ConnectionThread pattern: render final
   state, no transform/opacity animation). Pointer-tracking direct-manipulation feedback may be exempted, but
   the exemption must be **stated in the table**, not silent.
3. **Regression tests** per the table's "add" rows.

**Note (Codex Minor 7):** Vitest runs in jsdom, which applies **no** stylesheets and computes no layout, so no
unit test can prove animation *visibly* stops. The `.reduced-motion` rule's test is therefore a **structural
deletion guard** (parse `index.css` via a `?raw` import; assert the selector and both `0ms` declarations exist),
explicitly *not* a behavioral one. Behavioral suppression is verified by the **live in-browser check** (§4).

**Acceptance:** coverage table complete; every *reveal/idle* Motion gate has a direct test; the ghost-thread
exemption is stated; the CSS-rule test is described as structural-only; no un-enumerated `m.*` reveal path remains.

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
2. **Fix title-screen background inertness (Codex Major 1 — real app bug).** The `title` branch
   (`App.tsx:232-248`) renders `TitleScreen` + `SettingsPanel` with no `inert` wrapper and returns before
   `anyOverlayOpen` is computed, so opening Settings from the title leaves the background interactive. Wrap the
   title content (`<TitleScreen>`) in an element with `inert={isSettingsOpen}` so it becomes inert as soon as
   Settings is requested — **including while the lazy `OverlayFallback` is showing** (gate on the same
   `isSettingsOpen` state, not on the resolved chunk). Confirm the game-branch `inert={anyOverlayOpen}`
   (`App.tsx:320-334`) is unaffected.
3. **Tests:**
   - **Title→Settings inertness (new, Major 1):** open Settings from the title screen → assert the title
     content has `inert` set; close → assert it is removed. (The existing inert test only reaches the game
     branch with the Evidence Board.)
   - **Focus-restore-on-close for all four overlays (consumer-level, Minor 6):** render with a known invoking
     `<button>` focused → mount overlay → unmount (close) → assert `document.activeElement` is the invoker.
     `useFocusTrap`'s restore is already unit-tested at the hook level (`useFocusTrap.test.tsx:48-60`); these
     tests guard against a *consumer* silently dropping the hook (exactly the SettingsPanel regression), which
     the hook test cannot catch.
   - SettingsPanel: focus moves into the dialog on open (lands on the close button = first focusable); Escape
     closes; Tab wraps first↔last.

**Acceptance:** title-screen content is inert while Settings is open (incl. during the fallback) with a test
proving add+remove; all four overlays pass the consumer-level focus-restore test; SettingsPanel uses
`useFocusTrap`; no bespoke trap implementation remains; game-branch inertness test intact.

### WS3 — Contrast / focus-indicator pass (item 5, targeted)

**Goal:** a consistent, WCAG-conformant focus indicator across the app, and primary color pairs spot-checked
against contrast thresholds with residuals documented.

**Codex Major 2 correction — pick the ring token explicitly.** The two "amber" tokens are distinct: `#d4a853`
is `--color-gaslight-amber` (→ `ring-gaslight-amber`); Tailwind's built-in `ring-amber-400` is a *different*,
brighter colour (`oklch(82.8% 0.189 84.429)`). The plan must **name the chosen token** and compute the ratio
from *that* resolved value — not compute `#d4a853` while standardizing on `ring-amber-400`. **Decision:**
standardize on the **Tailwind built-in `ring-amber-400`** — it is already the dominant existing ring (~19 sites,
so fewest migrations) and, being brighter than `#d4a853`, has *more* headroom over the ≥3:1 bar. Compute its
actual ratio from the resolved oklch value during the pass; if it somehow fails, fall back to a brighter ring or
add a focus offset.

1. **Standardize the focus indicator** on `focus-visible:ring-2 focus-visible:ring-amber-400` (Tailwind built-in),
   applied on `focus-visible` (not bare `focus`, so it doesn't fire on mouse click):
   - Migrate the low-contrast / thin outliers: `ring-stone-600`, `ring-stone-400`, and the two `ring-1` sites
     → the standard `ring-2 ring-amber-400`.
   - Migrate bare `focus:ring-*` → `focus-visible:ring-*` where the element is keyboard-focusable and the mouse
     ring is unwanted — **except** the `autoFocus`'d LoadGameScreen delete-confirm button (see Minor-5 exception).
   - **Leave semantically-intentional rings** that already meet ≥3:1 on their surface (e.g. `ring-red-400` on a
     destructive control; `ring-white` where the surface makes it high-contrast) — but **verify each against
     its actual surface** rather than assume; migrate any that fail.
2. **Compute the ring ratio** as a non-text indicator (**SC 1.4.11, ≥3:1**) from the chosen token's *resolved*
   value on `--color-gaslight-ink #1a1a2e` and `bg-stone-950`. Confirm ≥3:1 (or escalate).
3. **Spot-check primary text pairs** (**SC 1.4.3**, ≥4.5:1 body / ≥3:1 large): body prose (`text-stone-200` /
   `gaslight-fog` on dark surfaces), amber headings/accents (`text-amber-300/400`, `gaslight-amber/gold`),
   muted/disabled text (`text-stone-400`). Compute ratios; fix clear failures; **document residuals in the
   plan's findings table** (pair → ratio → pass/fail → action) rather than silently leaving them.
4. **High-contrast-mode composition:** confirm the ring standardization composes with the existing
   `.high-contrast` remaps. **Note (Codex Major 2):** the current HC remaps target *text* utilities
   (`index.css:68-75`), **not** ring utilities — so the focus ring is **not** currently recoloured to `#ffea00`
   in HC mode. Verify the standardized ring stays visible in HC mode; if it does not, add an explicit HC
   ring remap (do not assume the text remap covers it).

**Minor-5 exception (autofocus).** LoadGameScreen's delete-confirm button uses `autoFocus` +
`focus:ring-2 focus:ring-red-400` (`LoadGameScreen.tsx:106-123`). Programmatic focus after a pointer click is not
guaranteed to match `:focus-visible`, so a mechanical `focus:`→`focus-visible:` migration could leave the
freshly-focused confirm button with **no** ring. **Preserve the bare `focus:` ring here** unless the live
browser check proves `:focus-visible` fires on that autofocus; if migrated, add a regression test for the
auto-focused confirmation state.

**WCAG citation (Codex Major 4).** This pass targets **SC 2.4.7** (Focus Visible) and **SC 1.4.11** (non-text
contrast ≥3:1) for the ring, and **SC 1.4.3** for text. **SC 2.4.11 is *Focus Not Obscured (Minimum)* — a
different criterion (is a focused control hidden by sticky/overlay content?), not indicator contrast/thickness —
and is *not* a target of this pass.** Focus-indicator *appearance/size* (the AAA "Focus Appearance") is SC
2.4.13, also out of scope. Do not attribute contrast to 2.4.11.

**Verification note (Minor 7).** Contrast ratios are not meaningfully unit-testable in jsdom (no layout /
computed color). This workstream's verification is the **computed-ratio findings table** (in the plan) plus a
**live in-browser check**. The focus-ring standardization *is* testable as a class-presence assertion on
representative controls.

**Acceptance:** ring token chosen explicitly and its ratio computed from the resolved value; focus rings
standardized (autofocus exception honoured); findings table complete with every checked pair and its action;
2.4.11 dropped as a target; live in-browser confirmation that keyboard focus is visible on the dark theme and in
high-contrast mode.

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

- **WS4 lands as mostly tests.** Expected — the behaviour is already correct. Not missing scope. (WS1 now
  has real code work: gating the untested local Motion branches enumerated in the coverage table.)
- **Title-inertness during the lazy fallback.** `SettingsPanel` is lazy; gate the title's `inert` on the
  `isSettingsOpen` *state*, not on the resolved chunk, so the background is inert the instant Settings is
  requested (while `OverlayFallback` shows), not only once the chunk loads.
- **SettingsPanel focus-in change.** The refactor shifts initial focus from an explicit close-button `.focus()`
  to "first focusable descendant." Mitigated: the close button *is* the first focusable; a test asserts the DOM
  order so a future markup change that regresses it is caught.
- **`focus` → `focus-visible` migration.** On very old browsers `focus-visible` degrades, but the repo targets
  modern evergreen (Vite/React 19); acceptable. Do not remove a bare `focus:` ring without replacing it — an
  element must never lose its focus indicator entirely.
- **Contrast pass is targeted, not exhaustive.** Residuals are documented, not necessarily all fixed; the
  findings table is the auditable record so a later comprehensive pass knows where to start.

## 6. Success criteria (phase-level)

1. **Title-screen background is inert while Settings is open** (incl. during the lazy fallback), with a test
   proving the attribute is added and removed (Codex Major 1).
2. SettingsPanel restores focus to its invoker on close; all four overlays pass a **consumer-level**
   focus-restore test; no bespoke trap implementation remains.
3. Every *reveal/idle* animation source has a reduced-motion mechanism and a regression test; the
   ghost-thread exemption is stated; the CSS-rule test is structural-only; no un-enumerated `m.*` reveal path.
4. Focus indicators standardized on an **explicitly-named** ring token whose ≥3:1 ratio is computed from its
   *resolved* value; primary contrast pairs spot-checked with a documented findings table; live-verified
   visible on dark + high-contrast (autofocus exception honoured); SC 2.4.11 not treated as an indicator target.
5. All four preserve behaviours have direct regression tests.
6. Gate green (lint + validator 8 cases + full suite + build); Codex spec/plan/impl passes folded; PR opened
   with a merge commit.
