# Codex task — Gate 1 adversarial review: Phase 1 Live Announcer design

## Operating rules (READ FIRST)
- You are an **adversarial design reviewer** (Gate 1). You have NO memory of prior sessions — all
  context is in this file and the repo.
- **Make NO changes to the repository** except writing your review to the single output file named
  below. Do not edit, create, or delete any other file. Do not run formatters or apply patches.
- **Output file (the ONLY thing you may write):**
  `codex/output/phase1-live-announcer-gate1-review.md`
- Keep the review focused; do not spend excessive time exploring. Key excerpts are inlined below so
  you should not need to read many files — read a file only to confirm a specific claim.

## What you are reviewing
A **design spec** (not code): `docs/superpowers/specs/2026-07-14-phase1-live-announcer-design.md`.
Read it. Then attack it — assume it contains at least one flawed assumption, missed requirement,
ordering hazard, or a simpler alternative, and find it.

## Goal of the feature
Phase 1 of a UI/UX roadmap for "Gaslight & Grimoire" (React 19 + Zustand/Immer + Tailwind v4 +
Framer Motion; static SPA, no backend; determinism-sensitive; Vitest + React Testing Library).
Build a GLOBAL LIVE ANNOUNCER: one always-mounted pair of `aria-live` regions + an `announce()` API
so screen-reader users hear dynamic state changes. It is the substrate later phases (deduction/dice
feedback) will call into.

## Constraints the design must respect
- **Determinism:** no `Date.now()` / `Math.random()` in a way that fights snapshot tests. The design
  uses a monotonic counter for a re-announcement nonce.
- **Additive scope:** must NOT modify the ~18 existing local `aria-live` regions (especially
  `SceneText`'s F-049 once-only scene-narrative logic and the save toast in `App.tsx`).
- **aria-live semantics:** a region must PRE-EXIST (empty) in the DOM before its content changes, or
  screen readers won't announce it. SPA re-renders that unmount/remount the region node break this.

## Inlined repo facts (so you needn't hunt)

### `src/main.tsx` (the always-mounted root)
```tsx
initAudioSubscription();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LazyMotion features={domAnimation}>
        <App />
      </LazyMotion>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

### `src/App.tsx` — IMPORTANT structural fact
`App` does NOT return one shared tree. It has ~7 early-return branches (title, character-creation,
case-selection, loading, case-complete, load-game, and the main game branch), and **each branch
returns its own `<AccessibilityProvider>…</AccessibilityProvider>` wrapper**. There is no shared
parent element inside `App` that sits above the screen switch. The main game branch's root return is:
```tsx
return (
  <AccessibilityProvider>
    <div className="min-h-screen …">
      <div inert={anyOverlayOpen}> … HeaderBar, AmbientAudio, GameContent … </div>
      <Suspense>… lazy overlays …</Suspense>
      {saveToast && ( <div role={…} aria-live={…}>{saveToast.message}</div> )}
    </div>
  </AccessibilityProvider>
);
```
`AccessibilityProvider` is a pass-through wrapper (`return <>{children}</>`) that applies settings
classes to `document.documentElement`; it is mounted separately in every branch, so it unmounts/
remounts on every screen change.

### `src/store/audioSubscription.ts` (the precedent the design mirrors)
```ts
export function initAudioSubscription(): void {
  useStore.subscribe((state, prevState) => {
    const vol = state.settings.audioVolume.sfx;
    if (state.investigator.composure < prevState.investigator.composure) { AudioManager.playSfx('composure-decrease', vol); }
    if (state.investigator.vitality < prevState.investigator.vitality) { AudioManager.playSfx('vitality-decrease', vol); }
    if (state.currentScene !== prevState.currentScene && state.currentScene !== '') { AudioManager.playSfx('scene-transition', vol); }
    if (state.lastCheckResult !== null && prevState.lastCheckResult === null) { AudioManager.playSfx('dice-roll', vol); }
    for (const [id, clue] of Object.entries(state.clues)) {
      const prev = prevState.clues[id];
      if (clue.isRevealed && prev && !prev.isRevealed) { AudioManager.playSfx(`clue-${clue.type}` as SfxEvent, vol); }
    }
  });
}
```

## Questions to address (prioritized findings, each with concrete failure + suggested fix)
1. **Mount point.** The spec says to mount `<LiveAnnouncer>` "at the top of App's returned tree,
   outside every screen branch." Given that `App` has no single shared tree (7 branches, each with
   its own `AccessibilityProvider`), is that instruction implementable as written? If not, where
   SHOULD the always-mounted announcer live (e.g. `main.tsx` beside `initAudioSubscription()`, inside
   `ErrorBoundary`/`LazyMotion`), and what does that imply for the spec? Note React.StrictMode
   double-invoke and `ErrorBoundary` unmount-on-error as edge cases.
2. **Store + useSyncExternalStore.** Does the announcer external store + `useSyncExternalStore`
   approach risk tearing, missed notifications, or double-announcement (esp. under StrictMode's
   double-render in dev)?
3. **Nonce mechanism.** Will appending zero-width spaces actually make a screen reader re-announce a
   repeated identical message? Could the appended characters be spoken aloud or leak into tests? Is a
   separate visually-hidden counter node safer? Is there a simpler correct approach?
4. **Ordering hazard.** `initAnnouncerSubscription()` runs in `main.tsx` before React mounts
   `<LiveAnnouncer>`. If a store mutation fires `announce()` before the region exists, is the message
   lost (contradicting the whole "region must pre-exist" premise)? How should the design guard this?
5. **Additive-scope collisions.** Could the new store-subscription announcements DOUBLE-announce
   things the existing local regions already announce (e.g. save toast, scene text, dice overlay,
   composure/vitality meters which already have `aria-live`)? Which specific existing regions overlap
   the proposed events, and how should the design avoid duplicate speech?
6. **Simpler alternative.** Is any part over-engineered for Phase 1's actual need?

## Output format
Write to `codex/output/phase1-live-announcer-gate1-review.md`:
- A prioritized findings list — each: **severity (High/Med/Low)**, the concrete failure it causes,
  and a suggested fix.
- Note any place the design is already sound (don't invent problems).
- End with an **overall verdict**: is the design sound to proceed to an implementation plan as-is, or
  must specific things change first? List the must-change items explicitly.
