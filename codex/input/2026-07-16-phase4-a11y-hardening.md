# Codex review — Phase 4 A11y Hardening Sweep (SPEC)

You are an independent adversarial reviewer from a different model provider. You have **no**
conversation memory — everything you need is in this file and the repo. Your job is to find real
defects in a **design spec** before it becomes an implementation plan.

## Goal

Review the design spec for **Phase 4 — A11y Hardening Sweep** of *Gaslight & Grimoire*, a
browser-based interactive-fiction game (React 19, Zustand, Tailwind v4, Framer Motion, Vitest).
Phase 4 is the last scheduled UI/UX accessibility phase. The spec frames the work as a
**verify-and-close-gaps sweep** (most of the target behaviour already exists on `main`), covering
four workstreams: reduced-motion coverage, focus-restore + background inertness across overlays, a
targeted contrast / focus-indicator pass, and four "preserve" regression tests.

## What to review

**The spec:** `docs/superpowers/specs/2026-07-16-phase4-a11y-hardening-design.md`

## Ground every claim against the actual code

The spec makes specific claims about the current state of `main`. **Verify them** — the highest-value
finding here is a spec claim that is *wrong about the code*, because the whole "verify-and-close-gaps"
framing collapses if the audit is inaccurate. Read at least:

- `src/index.css` (the `.reduced-motion` global rule, ~line 90; the `.high-contrast` remaps)
- `src/components/AccessibilityProvider/AccessibilityProvider.tsx` (how `reduced-motion` / `high-contrast` classes are applied)
- `src/hooks/useFocusTrap.ts` (does it *actually* capture + restore focus on unmount?)
- `src/components/SettingsPanel/SettingsPanel.tsx` (the claim: bespoke inline trap that does NOT restore focus; close button is the first focusable descendant)
- `src/components/EvidenceBoard/ConnectionThread.tsx` (JS-driven `m.*` gated on a `reducedMotion` prop)
- `src/components/EvidenceBoard/EvidenceBoard.tsx`, `src/components/CaseJournal/CaseJournal.tsx`, `src/components/NPCGallery/NPCGallery.tsx` (which overlays use `useFocusTrap`)
- `src/App.tsx` (the `inert={anyOverlayOpen}` background isolation; the save toast roles)
- `src/components/NarrativePanel/SceneText.tsx` (self-paced prose: keyboard skip button, instant/reduced-motion path)
- `src/components/NarrativePanel/DiceRollOverlay.tsx` (role="status" live-status card, not a modal)
- `src/components/StatusBar/ComposureMeter.tsx` / `VitalityMeter.tsx` (animate-pulse prop-gated on reducedMotion)
- The focus-ring usages — grep for `focus-visible:ring` and `focus:ring` across `src/`

## Project constraints (must hold)

- **Two strict domains:** `public/content/` (narrative JSON) vs `src/engine/` (logic). Phase 4 touches neither content nor engine — it is components/CSS/tests only. Flag any spec item that would leak logic into content or vice-versa.
- **Reduced-motion** has three layers already: a global CSS rule (kills CSS/Tailwind animation), prop-gating in some components, and JS-driven Motion (`m.*`) which the CSS rule **cannot** reach (so those need prop gates). Verify the spec's mechanism claims per source.
- **React 19** treats `inert` as a real boolean attribute (`inert={bool}`), NOT the React-18 `inert=''` idiom — the spec relies on this. Confirm.
- **Never squash-merge** (per-commit TDD history is load-bearing for the repo's memory spine).
- **WCAG targets** named in the spec: SC 1.4.1 (color independence), 1.4.3 (text contrast ≥4.5:1), 1.4.11 (non-text/UI ≥3:1), 2.4.7 / 2.4.11 (visible focus indicator). Check they're cited correctly (e.g. contrast thresholds must NOT be attributed to 1.4.1).

## Adversarial charge

**Assume this spec contains at least one real defect — a correctness hole, an inaccurate audit claim
about the current code, a self-contradiction, a determinism/testability hazard, a WCAG mis-citation,
or a dangerous ambiguity that would let an implementer build the wrong thing — and find it.**

Specifically probe:

1. **Audit accuracy.** Is every "current state" claim in §2 actually true of the code? Especially:
   does `useFocusTrap` really restore focus on unmount? Does SettingsPanel really *not*? Is the close
   button really the first focusable descendant (if not, the WS2 "behaviour preserved" claim is false
   and the refactor silently changes initial focus)?
2. **The `focus` → `focus-visible` migration (WS3).** Could migrating a bare `focus:ring-*` to
   `focus-visible:` remove a focus indicator from an element that is *not* keyboard-focus-visible in a
   way that leaves it with NO indicator? Are there controls where the current bare `focus:` ring is
   load-bearing?
3. **Reduced-motion completeness.** Does the spec's source list miss any animation source? Grep for
   `m.` / `initial=` / `animate=` / `whileHover` / `transition` and CSS `@keyframes` — is there an
   ungated JS-driven Motion path the spec doesn't mention?
4. **Testability claims.** The spec says the `.reduced-motion` CSS rule can be guarded by "a static
   import assertion / built stylesheet check." Is that actually feasible in this Vitest/jsdom setup
   (jsdom does not apply stylesheets or compute layout)? If the proposed test can't actually assert
   what it claims, that's a false-green hazard — call it out and suggest what a *real* guard would be.
5. **Scope creep / omissions.** Is anything in scope that shouldn't be (Phase 5, dice/deduction
   logic)? Is any named WCAG criterion left with no concrete acceptance check?

## Output

Write your review to `codex/output/2026-07-16-phase4-a11y-hardening-review.md`.

Run the build/tests only if your sandbox allows (read-only is fine — reason from the code). Cite
`file:line` for every claim about the codebase. Rank findings most-severe first; label each
Blocker / Major / Minor. If you believe the spec is sound, say so explicitly and justify it against
the probes above rather than rubber-stamping.
