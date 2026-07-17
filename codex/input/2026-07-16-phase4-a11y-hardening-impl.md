# Codex review — Phase 4 A11y Hardening Sweep (IMPLEMENTATION)

You are an independent adversarial reviewer from a different model provider. You have **no**
conversation memory — everything you need is in this file and the repo. This is the **final
cross-provider gate** before merging a completed, self-contained implementation.

## Goal

Review the completed implementation of **Phase 4 — A11y Hardening Sweep** of *Gaslight & Grimoire*
(browser IF game; React 19, Zustand, Tailwind v4, Framer Motion via `LazyMotion`+`m`, Vitest 4 + RTL,
jsdom). Phase 4 is the last scheduled UI/UX accessibility phase — a verify-and-close-gaps sweep,
components/CSS/tests only (no `public/content/` or `src/engine/` changes).

## What to review

- **Branch:** `feat/phase4-a11y-sweep` (PR #85), forked from `main` at `e72e90d`.
- **Diff:** `git diff main..feat/phase4-a11y-sweep` — the production changes are under `src/` (ignore
  `docs/` and `codex/`, which are process artifacts, EXCEPT read the spec + plan below for fidelity).
- **Spec (fidelity target):** `docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md`
- **Plan (fidelity target):** `docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md`
- Prior Codex passes (already folded): `codex/output/2026-07-16-phase4-a11y-hardening-review.md`
  (spec) and `...-plan-review.md` (plan).

## Production files changed (read these)

- `src/hooks/useFocusTrap.ts` — gained optional `options?: { restoreTo?: HTMLElement | null }`.
- `src/App.tsx` — `invokerRef` capture in every overlay open handler; `restoreFocusTo` threaded to 5 render sites; title-screen `inert={isSettingsOpen}` wrapper.
- `src/components/SettingsPanel/SettingsPanel.tsx` — refactored to `useFocusTrap` (Escape on `window`); `restoreFocusTo` prop.
- `src/components/{EvidenceBoard/EvidenceBoard,CaseJournal/CaseJournal,NPCGallery/NPCGallery}.tsx` — `restoreFocusTo` prop threaded to `useFocusTrap`.
- Ring-only class changes: `App.tsx`, `TitleScreen.tsx`, `LoadGameScreen.tsx`, `CaseSelection.tsx`, `CaseCompletion.tsx`, `ChoicePanel/ChoiceCard.tsx`, `ErrorBoundary/ErrorBoundary.tsx`, `HeaderBar/HintButton.tsx`, `NarrativePanel/ClueDiscoveryCard.tsx`, `InvestigationHalted/InvestigationHalted.tsx`.
- Tests: `src/components/__tests__/{SettingsPanel.a11y,focusRing,reducedMotion.coverage,DiceRollOverlay.status}.test.tsx` (new); `{App,EvidenceBoard,overlayFocusTrap}.test.tsx` + `src/hooks/useFocusTrap.test.tsx` (modified).

## Highest-value target (flagged honestly — verify it, don't just trust it)

The internal whole-branch review found — and this branch **fixed** — a WCAG 2.4.3 bug: `useFocusTrap`
captured `document.activeElement` on mount, but the `inert` ancestor blurs the invoker to `<body>`
*before* the effect runs, so all overlays restored focus to `<body>`. The fix captures the invoker at
**open** time (`invokerRef` in App, before `setState`/inert) and threads `restoreFocusTo` to the hook.
We confirmed the fix in a real browser (closing Settings returns focus to the trigger, not `<body>`).

**Probe this fix hard:**
1. Is capturing `document.activeElement` in the open handler actually BEFORE `inert` applies? React
   batches the `setState` that flips `inert`; the handler line runs synchronously before render, so
   the capture should precede the inert commit — confirm this reasoning holds, or find the hole.
2. The single shared `invokerRef` assumes only one overlay is ever open at once. Is that invariant
   truly guaranteed? Find any path that could open a second overlay while one is open (which would
   clobber the ref and restore focus to the wrong element).
3. `useFocusTrap` deps are `[]` with `restoreTo` captured in the closure. Could `restoreTo` be stale
   or null at the wrong moment (e.g. the ref is null on first render, or React reuses the effect)?
4. Are the tests honest? The standalone "restore" tests render overlays WITHOUT the inert ancestor —
   the plan claims they're valid *fallback-path* coverage and the new hook test + App integration test
   carry the real guard. Is that true, or is there still a false-green hiding the production behaviour?

## Also probe (the rest of the sweep)

5. **Ring inventory test** (`focusRing.test.tsx`): it globs `src/**/*.tsx` and fails on stray bare
   `focus:ring-`. Could the walk resolve to an EMPTY file list (silent false-green)? Is the allowlist
   (`focus:ring-red-`, `focus:ring-white`, `focus:ring-2`) too permissive — could it mask a real
   low-contrast ring? Are the two "exceptions" genuinely justified, or should they also be migrated?
6. **Reduced-motion coverage** (`reducedMotion.coverage.test.tsx`): the `framer-motion` mock captures
   props into `data-*`. Could any assertion pass even if the component's `reducedMotion` branch were
   deleted (false-green)? Is the CSS structural guard reading the real file (it uses `readFileSync`
   because `?raw` returns empty under Vitest — confirm that's sound)?
7. **Fidelity:** does the implementation match what the spec/plan said, or silently diverge? Any spec
   acceptance criterion with no corresponding code/test? (Note: the spec's WS2 framed focus-restore as
   already delivered by the shared hook; the reality needed the invoker-capture fix — is that the only
   place the shipped behaviour diverged from the spec's assumptions?)
8. Any **regression** in the ring migrations (an element that lost its only focus indicator, or a
   `focus:`→`focus-visible:` change that removes the ring from a programmatically-focused control)?

## Project constraints

- Two strict domains: no content/engine changes (confirm the diff honours this).
- React 19 real boolean `inert`. Never squash-merge.
- jsdom applies no styles / no `inert` blur — so contrast + the inert-blur failure mode are only
  observable in a real browser (the main agent did that; you reason from code).
- WCAG: ring = SC 2.4.7 + 1.4.11; text = 1.4.3; focus-restore = 2.4.3. SC 2.4.11 is NOT an indicator
  criterion (it was mis-cited in the first spec draft and corrected).

## Adversarial charge

**Assume the implementation contains at least one real defect the internal reviews missed — a
correctness bug, an integration/seam defect, a false-green or missing test, a determinism violation,
or a place the code silently diverges from its spec — and find it. Ground every finding in the actual
committed code.** Run the build/tests only if your sandbox allows (read-only is fine — reason from the
code). Cite `file:line`. Rank findings most-severe first; label Blocker / Major / Minor. If you believe
it is sound, say so explicitly and justify it against the probes above rather than rubber-stamping.

## Output

Write your review to `codex/output/2026-07-16-phase4-a11y-hardening-impl-review.md`.
