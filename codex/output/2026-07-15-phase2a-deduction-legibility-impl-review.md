# Phase 2a deduction-legibility implementation review

## Ranked findings

### 1. Major: the outcome banner pushes the close control out of the mobile viewport

The board's inner shell clips overflow (`src/components/EvidenceBoard/EvidenceBoard.tsx:252`), while
the header and both of its groups are non-wrapping flex rows
(`src/components/EvidenceBoard/EvidenceBoard.tsx:254-261`). The new banner is inserted into the same
right-hand row as the fixed-format close control (`src/components/EvidenceBoard/EvidenceBoard.tsx:262-286`)
without a responsive breakpoint, a full-width banner row, or `shrink-0` on the button.

This is reproducible against the built CSS at a 375 px viewport. Before the banner, the close button
occupies x=307..351 and is visible. With any of the four outcome messages, its left edge moves beyond
the viewport (success 391.7 px, critical 403.7 px, partial 396.3 px, hard failure 386.2 px), and the
clipped shell makes it disappear for the banner's 2.5-second lifetime. The longer messages are also
compressed into roughly 75-93 px columns. This breaks the outcome beat and temporarily removes the
only touch close affordance on a supported mobile-sized viewport.

**Fix:** Keep the title/progress and close toolbar in a stable first row, make the close button
`shrink-0`, and render the outcome as a separate full-width wrapping row at narrow breakpoints (or
otherwise reserve responsive space for it). Add a browser regression at 375 px asserting that the
banner and the complete 44 px close button remain inside the viewport for the longest message.

### 2. Minor: the tests do not fully pin the single-announcement and transient-banner contracts

Only the plain-success case asserts `announce` was called exactly once
(`src/components/__tests__/EvidenceBoard.test.tsx:139-147`). The partial case checks only that the
expected call exists (`src/components/__tests__/EvidenceBoard.test.tsx:154-159`), while critical,
failure, and fumble do not check announcement count at all
(`src/components/__tests__/EvidenceBoard.test.tsx:149-169`). The suite also never asserts that the
visual banner remains `aria-hidden` (`src/components/EvidenceBoard/EvidenceBoard.tsx:262-276`) or that
the 2.5-second timer dismisses it (`src/components/EvidenceBoard/EvidenceBoard.tsx:230-231`).
Consequently, branch-specific double announcements, a second live-region path, or removal of
auto-dismiss could pass the advertised coverage.

**Fix:** Parameterize all five tiers and assert one exact `announce()` call plus `aria-hidden="true"`
for each result. Use fake timers to prove dismissal at 2.5 seconds and that a second attempt replaces
the first timer rather than letting the old timer clear the new banner.

## Fidelity

Part A is otherwise implemented faithfully. Comparing `DeductionButton.handleAttempt` with its
pre-change version shows the DC-14 roll, success/critical gate, recipe/generic construction,
`addDeduction`, and `deduced`/`contested` writes unchanged; only the callback gains the existing tier
and the local live label is removed. Tier-to-copy/tone mapping covers all `OutcomeTier` values, the
board banner is visual-only, and the connected badge matches the specified redundant cue.
ADR-0012 remains `Accepted`. The known failed-attempt `contested` revert bug is unchanged and
explicitly deferred to 2b, so it is not scope leakage from this implementation.

**Verdict: fix first**
