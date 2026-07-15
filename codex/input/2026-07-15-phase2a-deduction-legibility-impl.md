# Codex review — Phase 2a IMPLEMENTATION (final pass before merge)

## Operating rules (read first)

- You have **no memory** of prior reviews. Everything is in this file or the repo files it names. Read-only sandbox.
- **Make no repository changes except writing exactly one file:** your review to
  `codex/output/2026-07-15-phase2a-deduction-legibility-impl-review.md`. Nothing else.
- This is the **completed-implementation** checkpoint (c) of the file-based Codex handoff (see
  `codex/README.md`, `CLAUDE.md` §"Cross-provider review with Codex"). The internal reviews (per-task
  spec + quality, plus a live run of the app) already passed and the gate is green. You are the final
  independent look before merge.

## The charge

**Assume the implementation contains at least one real defect the internal reviews missed** — a
correctness bug, an integration/seam defect, a determinism violation, a false-green or missing test, or a
place the code silently diverges from its spec — and find it. Also check **fidelity**: does the code do
what the spec + plan said, and nothing out of scope? Ground every finding in the actual committed code
(cite `file:line`). Rank findings (Blocker/Major/Minor/Nit). End with a one-line verdict: **sound to
merge** / **fix first**.

## Goal + scope (what this is)

Branch `feat/phase2-deduction-feedback`. Phase 2a is the **legibility-only** slice of a UI/UX roadmap
phase, deliberately split from the deferred formation-model rework (2b). Three changes:
1. A redundant `🔗` badge for the `connected` clue-card state (WCAG 1.4.1 — colour-only gap).
2. Move the deduction outcome message off `DeductionButton` (which renders `null` below 2 connected
   clues, so its subtree vanishes when connections clear) onto the always-mounted `EvidenceBoard`, and
   announce it once via the Phase-1 global announcer `announce()`.
3. Directional message copy varying by roll tier.

**Hard scope constraint (verify it holds):** 2a must **NOT** change what forms a deduction or how clue
status is written — formation (the DC-14 Reason roll, recipe match, `addDeduction`, the `deduced`/
`contested` writes) stays byte-for-byte as before. It must **NOT** enact ADR-0012 (still `Accepted`).

## Diff range + files

Full range: `git diff 430d003..HEAD` (code lives in commits `17d63f0`, `9fbd9c8`, `47fc512`; docs in
`42bfe2a`). The **src** diff is inlined below in full. Production files:
`src/components/EvidenceBoard/{ClueCard,DeductionButton,EvidenceBoard}.tsx`. Spec + plan for fidelity:
`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md` (**Part A**) and
`docs/superpowers/plans/2026-07-15-phase2a-deduction-legibility.md`.

## Gate status (already green — you may re-run only if your sandbox allows; reasoning from code is fine)

`npm run lint` clean; `node scripts/validateCase.mjs` 8/8; `npm run test:run` → 647 passed (was 635);
`npm run build` OK. A live Playwright run confirmed: the 🔗 badge renders on connected cards; a real
deduction formed and the app-root live region announced "The connection holds." then (on a crit)
"…a sharp, decisive insight." — i.e. `announce()` + tier flavouring work end-to-end. **Not** live-verified:
the visual `data-tone` banner span (auto-dismisses in 2.5s, faster than the test-harness round-trip) and
the failure/partial tones (unrollable with the test investigator) — both are covered by unit tests only.
Probe whether that test-only coverage is actually sound.

## Things worth attacking (non-exhaustive — find others)

- **Formation unchanged?** Compare the `DeductionButton.tsx` success/failure branches to the pre-change
  version (`git show 9fbd9c8~1:src/components/EvidenceBoard/DeductionButton.tsx`). Is the roll / recipe
  match / `addDeduction` / `updateClueStatus` logic truly identical, or did the refactor alter behaviour?
- **`tier` type widening/narrowing:** `onResult` now carries `OutcomeTier`. Does every call site + the
  board handler agree? Any tier value unhandled by `outcomeToBanner` (it switches on `critical`/`partial`
  and else-branches the rest — is `fumble`/`success`/`failure` mapping correct)?
- **Single announcement / no double-speak:** the button's local `aria-live` `<m.p>` was removed and the
  board banner is `aria-hidden`, with one `announce()`. Is there truly exactly one SR announcement per
  attempt now? Any other live region in the board (e.g. the "Select two clues…" hint `role="status"`)
  that could collide?
- **Banner timer lifecycle:** `bannerTimerRef` cleared before reset + on unmount. Any state-update-after-
  unmount path? Note there's a *separate* pre-existing 1400ms slack `setTimeout` with no cleanup — is that
  in scope (it predates this change) and does the new code make it worse?
- **`reducedMotion`:** the removed `<m.p>` used `reducedMotion`; is that variable now unused in
  `DeductionButton` (lint would catch, but confirm) — and does the new board banner ignore reduced-motion
  appropriately (it's a plain `<span>`, no animation — fine, but confirm no regression vs. the old
  animated label)?
- **Test soundness:** do the `EvidenceBoard` banner tests actually prove what they claim? E.g. the
  `data-tone` assertions, the "announce once" (`toHaveBeenCalledTimes(1)` with `vi.clearAllMocks()` in
  `beforeEach`), the "success forms exactly one deduction / failure forms none" scope-boundary guards.
  Could any pass vacuously? Is the `attempt(tier)` helper mocking `performCheck` in a way that bypasses
  real formation (note: formation is NOT under test here — it's asserted to be *unchanged*)?
- **Known deferred bug (should NOT be fixed here):** the plan documents that after a failed attempt the
  2s `contested`→`examined` revert never fires (`clearConnections()` empties `DeductionButton`'s `idsRef`
  before the timer runs) — deferred to 2b. Confirm 2a neither fixes nor worsens it, and that leaving it is
  consistent with the "legibility-only" scope. (Flag if you think shipping a known-stuck-`contested` state
  is a merge blocker rather than a documented deferral.)
- **ADR-0012:** confirm no code path changed the formation gate and the ADR wasn't promoted to `Enacted`.

## The complete src diff (7f9efa7..HEAD)

```diff
diff --git a/src/components/EvidenceBoard/ClueCard.tsx b/src/components/EvidenceBoard/ClueCard.tsx
@@ status-state doc comment @@
- *   connected — gold border indicator
+ *   connected — gold border indicator + link icon (🔗)
@@ StatusIndicator switch — new case added before 'deduced' @@
+    case 'connected':
+      return (
+        <span className="absolute -top-2 -right-2 text-lg" aria-label="Connected">
+          🔗
+        </span>
+      );

diff --git a/src/components/EvidenceBoard/DeductionButton.tsx b/src/components/EvidenceBoard/DeductionButton.tsx
- import { m, AnimatePresence } from 'framer-motion';
+ import { m } from 'framer-motion';
+ import type { OutcomeTier } from '../../types';
  interface DeductionButtonProps {
    connectedClueIds: string[];
-   /** Called with 'success' | 'failure' so EvidenceBoard can animate threads */
-   onResult: (result: 'success' | 'failure') => void;
+   /** Called after an attempt with the outcome and the roll tier ... */
+   onResult: (result: 'success' | 'failure', tier: OutcomeTier) => void;
  }
  // ... in the component:
-   const [lastTier, setLastTier] = useState<string | null>(null);
    const idsRef = useRef(connectedClueIds);
  // ... in handleAttempt:
    const result = performCheck('reason', investigator, DEDUCTION_DC, false, false);
-   setLastTier(result.tier);
    if (result.tier === 'success' || result.tier === 'critical') {
      const recipe = matchDeduction(connectedClueIds, recipes);
      const deduction = recipe ? buildDeductionFromRecipe(recipe, connectedClueIds) : buildDeduction(connectedClueIds, clues);
      addDeduction(deduction);
      connectedClueIds.forEach((id) => updateClueStatus(id, 'deduced'));
      setPhase('success');
-     onResult('success');
+     onResult('success', result.tier);
    } else {
      connectedClueIds.forEach((id) => updateClueStatus(id, 'contested'));
      setPhase('failure');
-     onResult('failure');
+     onResult('failure', result.tier);
      setTimeout(() => { idsRef.current.forEach((id) => updateClueStatus(id, 'examined')); setPhase('idle'); }, 2000);
    }
  // tierLabel map removed; the trailing <AnimatePresence>{lastTier ... <m.p aria-live="polite"> ...} block removed entirely.

diff --git a/src/components/EvidenceBoard/EvidenceBoard.tsx b/src/components/EvidenceBoard/EvidenceBoard.tsx
+ import { announce } from '../../announcer';
+ import type { OutcomeTier } from '../../types';
+ const DEDUCTION_MESSAGES = {
+   criticalSuccess: 'The connection holds — a sharp, decisive insight.',
+   success: 'The connection holds.',
+   partial: "Some of these belong together, but the reasoning won't quite hold.",
+   failure: "These clues don't connect — not like this.",
+ } as const;
+ interface OutcomeBanner { message: string; tone: 'green' | 'amber' | 'red'; }
+ function outcomeToBanner(result: 'success' | 'failure', tier: OutcomeTier): OutcomeBanner {
+   if (result === 'success') {
+     return { message: tier === 'critical' ? DEDUCTION_MESSAGES.criticalSuccess : DEDUCTION_MESSAGES.success, tone: 'green' };
+   }
+   if (tier === 'partial') { return { message: DEDUCTION_MESSAGES.partial, tone: 'amber' }; }
+   return { message: DEDUCTION_MESSAGES.failure, tone: 'red' };
+ }
  // in component:
+ const [outcomeBanner, setOutcomeBanner] = useState<OutcomeBanner | null>(null);
+ const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
+ useEffect(() => { return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); }; }, []);
  // handler (was `function handleDeductionResult(result: 'success' | 'failure')`):
+ function handleDeductionResult(result: 'success' | 'failure', tier: OutcomeTier) {
+   const banner = outcomeToBanner(result, tier);
+   setOutcomeBanner(banner);
+   announce(banner.message);
+   if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
+   bannerTimerRef.current = setTimeout(() => setOutcomeBanner(null), 2500);
    if (result === 'failure') {
      setSlackConnections(connections.map((c) => ({ ...c, state: 'slack' as const })));
      clearConnections();
      setTimeout(() => setSlackConnections([]), 1400);
    } else {
      clearConnections();
    }
  }
  // header JSX, inside <div className="flex items-center gap-4">, before <DeductionButton>:
+ {outcomeBanner && (
+   <span aria-hidden="true" data-tone={outcomeBanner.tone}
+     className={['text-xs font-medium max-w-[16rem] leading-snug',
+       outcomeBanner.tone === 'green' ? 'text-green-400' : outcomeBanner.tone === 'amber' ? 'text-amber-300' : 'text-red-400'].join(' ')}>
+     {outcomeBanner.message}
+   </span>
+ )}
```

(The test files `ClueCard.test.tsx`, `DeductionButton.test.tsx` [new], `EvidenceBoard.test.tsx` add the
🔗 badge test + rewrite the old "renders no badge" test; the `(result,tier)`/no-aria-live tests; and the
7-test banner suite incl. green/critical/amber/red/fumble tones + the two scope-boundary formation guards.
Read them in the repo to judge test soundness.)

## Output

Write to `codex/output/2026-07-15-phase2a-deduction-legibility-impl-review.md`: a ranked findings list
(Blocker/Major/Minor/Nit) each grounded in `file:line` with a concrete fix; a short fidelity note (does it
match spec Part A + the plan; anything out of scope); one-line verdict (sound to merge / fix first).
