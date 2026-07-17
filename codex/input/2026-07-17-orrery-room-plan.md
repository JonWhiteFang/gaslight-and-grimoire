# Codex Review Request — The Orrery Room implementation plan

You are an independent adversarial reviewer for the Gaslight & Grimoire repo. You have NO
conversation memory — everything you need is in this file and the repo.

## What to review

The implementation plan at:

- **`docs/superpowers/plans/2026-07-17-orrery-room.md`**

against its already-reviewed spec:

- **`docs/superpowers/specs/2026-07-17-orrery-room-design.md`**

You (Codex) previously reviewed the spec (`codex/output/2026-07-17-orrery-room-review.md`,
10 findings) and all findings were folded into the spec. The plan implements the folded
spec: 5 engine TDD tasks (T1 unlock registry, T2 vignette loader/adapter, T3 CLI
validator variants, T4 discoverable-clues onEnter fix, T5 `KeyDeduction.onForm`), 3
content tasks (T6 skeleton, T7 act 1, T8 act 2 + variants), witness tests (T9), docs
(T10), and the review gate (T11).

## Ground your review in these repo files

- `src/engine/caseProgression.ts` — `VIGNETTE_CONDITIONS` + `checkVignetteUnlocks`
  (T1's target); `src/engine/__tests__/caseProgression.test.ts` (T1's test file — check
  what helpers actually exist there; the plan assumes a base-state helper)
- `src/engine/contentLoader.ts` — `loadVignette`, `fetchJson`, the `loadCase` optional-
  recipes idiom (T2); `src/engine/__tests__/sharedSceneCache.test.ts` (the fetch-mock
  pattern T2's new test claims to mirror — verify the claimed mock shape actually
  matches how `fetchJson` consumes responses, especially the 404/catch path)
- `src/store/slices/narrativeSlice.ts` — `vignetteToCaseData` (T2)
- `scripts/validateCase.ts` — `loadBundle` (T3)
- `src/engine/contentValidation.ts` — `computeDiscoverableClues` (~line 615),
  `validateBundle`'s recipe loop (~line 144), `validateEffect`, the F-102 block,
  Phase 5 choice rules (T4/T5); existing tests in
  `src/engine/__tests__/contentValidation*.test.ts` (do the helpers the plan's test
  snippets assume — e.g. `bundleWith` — exist?)
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — `handleDeductionAttempt`
  (~line 296) (T5's insertion point; check the plan's `useStore.getState().deductions`
  once-guard against how `addDeduction` and repeat formation actually behave, and
  whether `applyEffects` is reachable from the component the way the plan claims)
- `src/store/slices/worldSlice.ts` (`applyEffects`), `src/store/slices/npcSlice.ts`
  (`adjustDisposition` 0.5× propagation, clamps) — T8 ending effects + T9 clamp tests
- `src/engine/choiceVisibility.ts` + `src/engine/__tests__/choiceVisibility.test.ts` —
  T9 imports `choiceGateConditions` + `resolveChoiceVisibility`; verify the actual
  signatures/return values the witness tests assume ('shown'/'disabled' strings? a
  GameState param shape?)
- `src/engine/__tests__/phase5DemoChoice.test.ts` — the content-witness-test pattern T9
  claims to model on
- `public/content/side-cases/the-rationalists-dilemma/` + `public/content/cases/the-comet-club/`
  (clues.json `connectsTo` shape, deductions.json, variants.json idioms the content
  tasks copy)
- `docs/content-authoring.md` — Phase 5 rules (gateReason iff disabled, soft-lock
  warnings, escape paths), ClueDiscovery methods, faculty-check outcome requirements

## Your charge

Assume the plan contains **at least one real defect** — a task that cannot be executed
as written (wrong signature, missing helper, wrong file/line), a test that would be a
false-green, a TDD step whose RED expectation is wrong, a content structure that will
fail the validator (zero errors AND zero warnings is required), or a divergence from the
folded spec — and find it. Hunt specifically for:

1. **Executability of test snippets** — do the helpers, imports, signatures, and mock
   shapes the plan's test code assumes actually exist? (`baseGameState`, `bundleWith`,
   the fetch-mock shape vs `fetchJson`, `resolveChoiceVisibility`'s real signature and
   return type, EvidenceBoard test seeding pattern.)
2. **T5's once-guard** — is `!alreadyFormed[r.id]` read via `useStore.getState()` inside
   the loop correct under Immer batching? Can `addDeduction` for recipe A affect the
   read for recipe B in the same component? Is there a path where a deduction exists in
   the record but `onForm` never fired (save/load mid-vignette, then re-form)?
3. **Validator zero-warning claim** — walk the planned content: does every scene/choice
   structure in T7/T8 pass the Phase 5 rules (visibility values, gateReason iff
   disabled, soft-lock warning on any scene, unreachable scenes, never-discoverable
   clues — is `or-clue-night-observation` reachable given the vigil-broken path,
   is every clue sourced)? Does the keystone choice's failure-tier self-route
   (`or-act1-orrery-room` → itself) violate any validator rule?
4. **The F-102 interaction** — with T3+T4 landed, does the full validator run on this
   content actually produce zero errors zero warnings, given `mythos-pattern-named` is
   gated (its ending variants use `hasDeduction`) and `or-clue-orrery-period`'s only
   source is behind a flag-gated choice? Trace the exact code paths.
5. **Ending-variant onEnter duplication** — T8 copies each base ending's onEnter into
   its `-named` variant verbatim. Given `goToScene` applies onEnter keyed by RESOLVED
   scene id (F-118), can a player trigger BOTH the base and variant onEnter in one
   playthrough (e.g. enter base ending, then form the keystone on the board — does any
   re-navigation/re-resolution re-fire effects)? Are double rep/disposition applications
   possible?
6. **Spec fidelity** — every folded Codex spec finding (1–10) should have a
   corresponding plan artifact. Check each; name any that got lost.
7. **T9's clamp tests** — the plan sketches two store-level tests with prose bodies.
   Is the described expected arithmetic right (disposition −3 → −1.5 propagation;
   order-dependence at rep 9/10)?

## Output

Write your review to **`codex/output/2026-07-17-orrery-room-plan-review.md`**. For each
finding: severity (Blocker / Major / Minor), the plan task/step, repo evidence
(`file:line`), and a concrete fix. If an area you examined is sound, say so explicitly.
Read-only — do not modify any repo file other than writing the review.
