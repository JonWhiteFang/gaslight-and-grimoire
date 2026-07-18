# Codex Review Request — The Orrery Room COMPLETED IMPLEMENTATION

You are an independent adversarial reviewer for the Gaslight & Grimoire repo. You have NO
conversation memory — everything you need is in this file and the repo. This is the
final cross-provider gate before the branch ships (ADR-0013 checkpoint 3).

## What to review

Branch **`feat/orrery-room`**, the complete diff:

```
git diff d7d1cce..HEAD
```

(13+ commits: 5 engine tasks, the content build + content-integrity fold, witness +
integration tests, docs, and a whole-branch review fold.) Review it against:

- Spec: `docs/superpowers/specs/2026-07-17-orrery-room-design.md`
- Plan: `docs/superpowers/plans/2026-07-17-orrery-room.md`
- Your own two prior reviews (all findings were folded):
  `codex/output/2026-07-17-orrery-room-review.md` (spec pass, 10 findings),
  `codex/output/2026-07-17-orrery-room-plan-review.md` (plan pass, 9 findings).

## Production files to read (ground every claim in the committed code)

Engine:
- `src/engine/caseProgression.ts` (VIGNETTE_CONDITIONS entry)
- `src/engine/contentLoader.ts` (loadVignette optional recipes/variants)
- `src/types/index.ts` (VignetteData.recipes/variants; KeyDeduction.onForm)
- `src/store/slices/narrativeSlice.ts` (vignetteToCaseData passthrough)
- `scripts/validateCase.ts` (loadBundle variants for vignettes; VITEST guard on main())
- `src/engine/contentValidation.ts` (computeDiscoverableClues onEnter; onForm validation)
- `src/components/EvidenceBoard/EvidenceBoard.tsx` (onForm application, once-guard)
- `src/App.tsx` (resolveEndingNarrative — the whole-branch-review Major fix: the
  completion screen must resolve variants, since Orrery ships the repo's first
  terminal-scene variants)

Content:
- `public/content/side-cases/the-orrery-room/` (all 6 files) + `public/content/manifest.json`

Tests (check for false-greens as much as gaps):
- `src/engine/__tests__/caseProgression.test.ts` (unlock block)
- `src/engine/__tests__/contentLoader.vignette.test.ts`
- `src/engine/__tests__/validateCase.vignetteVariants.test.ts` + its fixture dir
- `src/engine/__tests__/contentValidation.test.ts` / `contentValidation.deduction.test.ts` (new blocks)
- `src/components/__tests__/EvidenceBoard.onForm.test.tsx`
- `src/engine/__tests__/orreryRoom.content.test.ts` / `orreryRoom.integration.test.ts` /
  `orreryRoom.onFormAfterTerminal.test.tsx`
- `src/components/__tests__/caseCompletionVariant.test.tsx`

Docs: `docs/status.md`, `docs/engine-reference.md`, `docs/content-authoring.md`,
`docs/architecture.md` (commit eec8726 + 00dd8e7).

## Current verified state (re-verify, don't trust)

`npm run test:run` → 853 passed / 89 files. `npm run lint` clean.
`node scripts/validateCase.mjs` → 9 units, zero errors, zero warnings.
`npm run build` green. Live Playwright verify passed (locked keystone flagless,
selectable with flag, formation sets flag+deduction, -named ending renders, completion
screen quotes the variant paragraph, no app console errors).

## Your charge

Assume the implementation contains **at least one real defect the internal reviews
missed** — a correctness bug, an integration/seam defect, an unmapped exception /
error-taxonomy hole, a determinism violation, a false-green or missing test, or a place
the code silently diverges from its spec — and find it. Ground every finding in the
actual committed code with `file:line` citations. Hunt specifically:

1. **Fidelity to your own folded findings.** All 19 prior findings (10 spec + 9 plan)
   were claimed folded. Spot-check the riskiest five in the CODE (not the docs): the
   unlock registry (spec B1), CLI vignette variants + its RED fixture (spec B2 / plan
   M3), computeDiscoverableClues onEnter (spec M4), onForm-at-formation with the
   once-guard (spec M5), and the clamp-ordering rule in the shipped ending JSON +
   witness tests (spec M7 / plan §7).
2. **The App.tsx completion fix** (`resolveEndingNarrative`): is the
   `snapshotGameState(useStore.getState())` call at completion time guaranteed to see
   the deduction state that resolved the variant in the panel? Any race between
   `completeCase` side effects and the narrative capture? Is the null-handling sound
   (unknown scene, halted states, shared halt scenes)?
3. **onForm seams not yet probed:** What happens if `applyEffects` inside the formation
   loop THROWS (e.g. a malformed effect in future content)? Does the deduction still
   form? Is that acceptable? What about onForm on a recipe formed via the GENERIC path
   (no recipe match) — impossible by construction, or a hole? Two recipes in one
   component where recipe A's onForm sets a flag recipe B's evaluation reads —
   ordering-dependent?
4. **Content correctness at play depth:** walk or-act1 → act2 paths for dead ends,
   unreachable act-2 scenes on unusual orderings (e.g. entering act 2 having skipped
   the hub clue — is or-choice-hub-onward's requiresClue gate satisfiable in all paths
   that reach or-act1-close?), the vigil-broken → dosage flow, and the verdict-hub
   partial/failure bounce (can a player get stuck if they NEVER formed
   or-genuine-instrument and keep failing? — two ungated partisan choices should always
   exist; verify in JSON).
5. **Test false-greens:** any of the new tests that would pass with the production
   change reverted? (The repo mutation-tested some — verify at least one yourself if
   your sandbox allows running vitest; otherwise reason from the code.)
6. **Docs drift:** do the four updated docs claim anything the code doesn't do?

Run the build/tests only if your sandbox allows (read-only is fine — reason from the
code). Cite `file:line` for every finding.

## Output

Write your review to **`codex/output/2026-07-18-orrery-room-impl-review.md`**. For each
finding: severity (Blocker / Major / Minor), the file:line evidence, and a concrete fix.
If an area you examined is sound, say so explicitly. Read-only — do not modify any repo
file other than writing the review.
