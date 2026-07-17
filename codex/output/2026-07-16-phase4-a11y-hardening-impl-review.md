# Phase 4 A11y Hardening Implementation Review

## Verdict

Changes required. The current production focus-restoration fix is sound, and the full gate is green,
but the test suite does not protect that fix from the exact inert-blur regression it was added for.
The reduced-motion suite also claims direct coverage for gates it does not assert, and the focus-ring
inventory can silently accept new low-contrast `focus-visible` rings.

## Findings

### Major 1 - The App focus-restore test passes without the open-time capture wiring

The App test focuses the title Settings button, clicks it, closes the panel, and expects focus to
return (`src/components/__tests__/App.test.tsx:229-243`). In jsdom, however, adding `inert` does not
blur that button. If the title handler stopped assigning `invokerRef.current` and the
`restoreFocusTo` prop were removed (`src/App.tsx:248-255`), `useFocusTrap` would simply fall back to
the still-focused `document.activeElement` (`src/hooks/useFocusTrap.ts:25-30`), and this App test
would continue to pass. That is the exact pre-fix implementation which restores `<body>` in a real
browser after inert has blurred the trigger.

The explicit hook test proves that a supplied `restoreTo` beats a pre-blurred active element
(`src/hooks/useFocusTrap.test.tsx:63-85`), but it does not prove that App captures or supplies the
target. The standalone component tests likewise mount overlays without the inert ancestor and rely
on the fallback path (`SettingsPanel.a11y.test.tsx:24-36`,
`overlayFocusTrap.test.tsx:46-78`, `EvidenceBoard.test.tsx:146-154`). There is also no App-level
close/restore test for the game-screen Evidence Board, Journal, Gallery, or Settings call sites
(`src/App.tsx:374-384`), so removing any one of those `restoreFocusTo` props would leave the suite
green.

Add an integration test that reproduces the browser ordering: hold the lazy overlay unresolved,
open it, move focus to `<body>` to model inert's blur, then resolve/mount and close it. Alternatively,
instrument the test DOM's inert-attribute application to blur an active descendant before passive
effects run. Exercise every App call site, preferably as a table, so both capture and prop threading
are required for the assertion to pass.

### Major 2 - Reduced-motion "every gate" coverage leaves independent regressions unguarded

The coverage table says both meter width gates and the Hint button plus popover are directly guarded
(`src/components/__tests__/reducedMotion.coverage.test.tsx:8-13`), but the suite imports and tests
only `ComposureMeter` (`:98`, `:251-258`). Deleting the independent reduced-motion transition from
`VitalityMeter` (`src/components/StatusBar/VitalityMeter.tsx:98-102`) cannot fail this file.

The same mismatch exists within several tested components:

- The Hint trigger has its own duration gate (`HintButton.tsx:56-62`), while the test inspects only
  the popover's separate transition (`reducedMotion.coverage.test.tsx:231-240`).
- ClueDiscoveryCard and EffectFeedback depend on zero-duration transitions as well as their initial
  values (`ClueDiscoveryCard.tsx:35-38`, `EffectFeedback.tsx:35-38`), but their tests inspect only
  `data-initial` (`reducedMotion.coverage.test.tsx:202-229`). Replacing either zero-duration branch
  with its normal transition would restore a visible fade and still pass.
- The mock deliberately discards `animate` and `exit` instead of serializing them
  (`reducedMotion.coverage.test.tsx:43-69`), despite the table claiming those props are covered.

This violates the phase-level criterion that every independently implemented reveal/idle mechanism
has a regression test. Capture all relevant Motion props, add the missing Vitality assertion, and
assert each independent zero-duration/plain-element branch. A mutation check against Vitality,
the Hint trigger, and one transition branch should then fail for the intended reason.

### Minor 3 - The ring inventory does not enforce its stated standard

The inventory scans a real, non-empty `src` tree; a bad root would throw during `readdirSync`, so
there is no empty-glob false-green here. The predicate itself is too permissive, though. It searches
only bare `focus:ring-*` and globally allows every red color and every `focus:ring-2`
(`src/components/__tests__/focusRing.test.tsx:45-55`). The low-contrast check also searches only
`focus:ring-stone-*` (`:67-71`). A future `focus-visible:ring-stone-600`, a bare width-only ring, or
an unrelated `focus:ring-red-*` anywhere in production would pass.

The stated "every control uses amber-400" rule is already not what the test measures: production has
`focus-visible:ring-white` and `focus-visible:ring-gaslight-amber` sites, for example
`CaseJournal.tsx:110` and `SceneText.tsx:124`. Those current colors may be valid on their surfaces,
but they should be explicit path/element exceptions rather than invisible to the inventory.

Scan both `focus:` and `focus-visible:` ring utilities, require the expected width/color pairing,
and allowlist exact files or controls for the red autofocus/delete and intentional white/custom
rings. Also assert `FILES.length > 0` as cheap diagnostic hardening.

## Probe Results

- Open-time capture occurs synchronously in each click handler before React commits the state update
  and applies `inert`; that ordering is correct.
- The shared `invokerRef` is safe for user-reachable flows: once an overlay state commits, all other
  opener controls are inside the inert background. No overlay contains another overlay opener, and
  CaseJournal's review action closes the journal in the same event.
- The hook's empty dependency list is acceptable for current call sites. The referenced container is
  unconditional, and each overlay mounts with a stable captured target; lazy retry does not create a
  null-first-render problem.
- The CSS structural guard reads the real `src/index.css` using a module-relative path and honestly
  claims deletion coverage only.
- The diff changes no `public/content/` or `src/engine/` files.

## Verification

- `npm run lint` - passed.
- `node scripts/validateCase.mjs` - passed, all 8 cases.
- Targeted accessibility tests - passed, 43 tests across 7 files.
- `npm run test:run` - passed, 759 tests across 78 files.
- `npm run build` - passed.
