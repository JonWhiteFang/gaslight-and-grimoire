# Codex review — Phase 4 A11y Hardening Sweep (PLAN)

You are an independent adversarial reviewer from a different model provider. You have **no**
conversation memory — everything you need is in this file and the repo. Your job is to find real
defects in an **implementation plan** before an engineer executes it task-by-task.

## Goal

Review the implementation plan for **Phase 4 — A11y Hardening Sweep** of *Gaslight & Grimoire*
(browser IF game; React 19, Zustand + Immer, Tailwind v4, Framer Motion via `LazyMotion`+`m`,
Vitest 4 + React Testing Library, jsdom). Phase 4 is the last scheduled UI/UX accessibility phase.
The plan is a **verify-and-close-gaps sweep** — most target behaviour already exists on `main`.

## What to review (in priority order)

1. **The plan:** `docs/superpowers/plans/2026-07-16-phase4-a11y-hardening.md`
2. **The spec it must be faithful to:** `docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md`
   (already Codex-reviewed; 4 Major + 3 Minor folded — verify the plan carries those fixes through).
3. **The spec review that shaped it:** `codex/output/2026-07-16-phase4-a11y-hardening-review.md`.

## Ground every claim against the actual code

The plan contains **exact code** (test bodies, edits) and asserts specific facts about `main`. Verify
the load-bearing ones — a plan whose test code won't compile, whose edit removes something still
referenced, or whose "already correct / already tested" claims are false, wastes an execution cycle.
Read at least:

- `src/components/SettingsPanel/SettingsPanel.tsx` (Task 1 refactor: is the close button really the FIRST focusable descendant of the panel `<div>` the hook ref attaches to? does removing the two effects + two refs leave anything dangling? does the Escape handler need to stay?)
- `src/hooks/useFocusTrap.ts` + `src/hooks/useFocusTrap.test.tsx` (the hook's restore-on-unmount contract Task 1/3 rely on)
- `src/App.tsx` (Task 2: the `title` branch lines 232-248; is `isSettingsOpen` in scope there? does React 19 `inert={bool}` behave as claimed? Task 6 success-toast: real Save button name + success message text + which element carries role/aria-live)
- `src/components/EvidenceBoard/ConnectionThread.tsx` (Task 4 test: `Connection` shape — `state?: 'active'|'slack'`, `ThreadPoint`; does the reducedMotion non-slack branch render a plain `<path>` with no `style` attr?)
- `src/components/NarrativePanel/OutcomeBanner.tsx` (Task 4: the reducedMotion branch + its internal `shown` state timing — is `waitFor` correct/necessary? are `tier="success"` and `visible` valid props?)
- `src/components/NarrativePanel/DiceRollOverlay.tsx` (Task 6: required props — it returns null unless `visible && roll!=null && total!=null`; does the plan pass them? is it really non-interactive with no focusable children?)
- `src/components/EvidenceBoard/ClueCard.tsx` + `EvidenceBoard.tsx` (Task 6 keyboard-connect: does `onKeyDown` handle Enter/Space to call `onInitiateConnection`? will two `keyDown` Enter events on two cards form a connection?)
- `src/components/TitleScreen/TitleScreen.tsx`, `LoadGameScreen.tsx`, `CaseSelection.tsx`, `NarrativePanel/ClueDiscoveryCard.tsx`, `HeaderBar/HintButton.tsx` (Task 5: the exact focus-ring classes at the cited lines; the TitleScreen Load button's accessible name + whether it's disabled with no saves)
- `src/index.css` (Task 4 structural guard: does `import ... '?raw'` + the regex `/\.reduced-motion \*\s*\{[^}]*\}/` actually match the rule at lines 90-93? Task 8 HC ring fix feasibility)
- `src/components/__tests__/App.test.tsx` (Task 2 + Task 6 rely on existing helpers — `stubCaseFetch`, `makeLocalStorageMock`, `reachGameScreen`, `waitFor`; do they exist and are they exported/in-scope?)
- `vite.config.ts` (does the Vitest config support `?raw` imports? is jsdom the environment?)

## Project constraints (must hold)

- **Two strict domains:** no `public/content/` or `src/engine/` changes — Phase 4 is components/CSS/tests only.
- **React 19** treats `inert` as a real boolean attribute (`inert={bool}`), not the React-18 `inert=''` idiom.
- **jsdom applies no stylesheets and computes no layout** — no unit test can prove animation visibly stops or measure a contrast ratio. The plan must not claim otherwise; contrast/behavioral-motion verification is the live in-browser check (Task 8).
- **Never squash-merge.** Frequent commits; each task ends with a commit.
- **The two "amber" tokens are distinct:** `#d4a853` = `--color-gaslight-amber` (`ring-gaslight-amber`); Tailwind built-in `ring-amber-400` is a different, brighter colour. The plan standardizes on `ring-amber-400`.
- **WCAG:** ring targets SC 2.4.7 (focus visible) + 1.4.11 (≥3:1 non-text); text SC 1.4.3. SC 2.4.11 is *Focus Not Obscured* — NOT an indicator-contrast target.

## Adversarial charge

**Assume this plan contains at least one real defect an execution engineer would hit — test code that
won't compile or that asserts the wrong thing (false green), an edit that breaks a consumer, an
"already correct/tested" claim that is actually false, a task that silently diverges from the spec, a
missing spec requirement with no task, or a determinism/timing hazard — and find it. Ground every
finding in the actual committed code.**

Specifically probe:

1. **Task 1 initial-focus claim.** Is the close button truly the first focusable descendant? If a
   focusable element precedes it in the panel DOM, `useFocusTrap` lands focus elsewhere and the plan's
   "moves initial focus to the close button" test fails — and behaviour silently changed from the
   inline version. Confirm from the JSX order.
2. **Task 2 inert during Suspense fallback.** The plan gates `inert` on `isSettingsOpen` state (not the
   lazy chunk). Does the title branch actually have `isSettingsOpen` in scope? Does wrapping only
   `<TitleScreen>` (not the `<SettingsPanel>` Suspense sibling) correctly leave the overlay itself
   interactive while the background is inert?
3. **Task 4 false-green risk.** For the transition-only gates (Dice/ClueDiscovery/EffectFeedback/
   HintButton/DeductionButton/meter width) the plan deliberately writes NO jsdom test and documents
   them instead (they render identical DOM). Is that honest classification correct, or is there a
   DOM-observable difference the plan misses that *could* be tested? Conversely, do the ConnectionThread
   / OutcomeBanner tests actually assert a real DOM divergence, or could they pass even if the
   reduced-motion branch were broken?
4. **Task 5 mechanical-migration hazards.** Does changing bare `focus:ring-*` → `focus-visible:ring-*`
   on any migrated control remove a needed indicator (e.g. a control that receives programmatic focus)?
   The plan preserves the LoadGameScreen `autoFocus` red ring and the skip-link white ring — are those
   the ONLY such cases, or is there another programmatic-focus control being mechanically migrated?
5. **Existing-coverage claims.** The plan asserts SceneText's skip control is already fully tested and
   the save-FAILURE toast is already tested (so it only adds the success-path). Verify both against the
   test files; if either is wrong, a spec requirement is left uncovered.
6. **Spec fidelity.** Does every §6 success criterion in the spec map to a task that actually achieves
   it? Is anything in scope that the spec excluded (Phase 5, dice/deduction logic, touch fallback)?

## Output

Write your review to `codex/output/2026-07-16-phase4-a11y-hardening-plan-review.md`.

Run the build/tests only if your sandbox allows (read-only is fine — reason from the code). Cite
`file:line` for every claim about the codebase. Rank findings most-severe first; label each
Blocker / Major / Minor. If you believe the plan is sound, say so explicitly and justify it against
the probes above rather than rubber-stamping.
