# Codex implementation review — Phase 5: Choice-Gating Content Model (final pass before PR)

You are an independent adversarial reviewer from a different model provider, with **no** conversation
memory. This prompt is self-contained. You are the LAST gate before this branch becomes a PR: the
internal per-task reviews, a whole-branch integration review, and a live browser verification have all
passed. Your job is to find what they all missed.

## The work

Gaslight & Grimoire (React 19 + Zustand/Immer; JSON content in `public/content/`, pure engine in
`src/engine/`). Phase 5 adds a choice-gating vocabulary: a gated choice (`requiresClue`/
`requiresDeduction`/`requiresFlag`/`requiresFaculty`) can now be shown **disabled-with-a-diegetic-reason**
instead of hard-hidden. Backward-compatible: absent `visibility` = old hard-hide behaviour.

## What to review

- **Branch:** `feat/phase5-choice-gating`, HEAD `ea5ece2`. Base: `main` (`8e1c2b0`).
- **Diff:** `git diff 8e1c2b0..ea5ece2` (also `git log 8e1c2b0..ea5ece2 --oneline` for the commit story).
- **Spec:** `docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md` — check FIDELITY: does the
  code do what the spec says? Its §12 lists the 7 findings from your earlier spec pass — verify each is
  genuinely honoured in code, not just in prose.
- **Plan:** `docs/superpowers/plans/2026-07-17-phase5-choice-gating.md` (its final section lists your
  plan-pass findings — same check).

## Production files to read (ground every claim here)

- `src/engine/choiceVisibility.ts` — the resolver (single source of truth).
- `src/engine/contentValidation.ts` — the 5 errors + soft-gate warning + the new all-gated-round
  warning; `Ctx.warnings` threading (~lines 63-73 allowlists, ~100 ctx build, ~344-360 encounter rounds,
  ~407-435 choice rules).
- `src/engine/encounters.ts` — `getEncounterChoices` (escape hard-gate preserved).
- `src/components/ChoicePanel/ChoicePanel.tsx` + `src/components/EncounterPanel/EncounterPanel.tsx` —
  partition + nav-then-locked-ul render + the defense-in-depth select-handler guards.
- `src/components/shared/LockedChoice.tsx` — the non-interactive `<li>`.
- `src/types/index.ts` — the two new `Choice` fields (~line 220).
- `public/content/cases/the-comet-club/act2.json` — the demo conversion (scene `cc-act2-hub`, choice
  `cc-choice-hub-halloway`).
- Tests: `src/engine/__tests__/choiceVisibility.test.ts`, `contentValidation.choiceGating.test.ts`,
  `encounterSystem.test.ts` (Phase 5 describe), `phase5DemoChoice.test.ts`,
  `src/components/__tests__/LockedChoice.test.tsx`, `ChoicePanel.test.tsx`, `EncounterPanel.test.tsx`.
- Docs updated: `docs/content-authoring.md`, `docs/engine-reference.md`, `docs/architecture.md`.

## Project constraints (must hold)

- **Backward-compat:** absent `visibility` behaves EXACTLY like pre-branch (hard-hide). `requiresFlag: ''`
  stays ungated (truthy-only gate building). Old (v≤5) saves must load cleanly.
- Pure RNG-free engine; no store/React imports in `src/engine/`.
- Validator is a CI gate: errors fail, warnings don't. Shipped 8 cases: zero errors, zero warnings.
- Escape-path encounter choices are NEVER disabled (hard-gate preserved byte-for-byte).
- WCAG: locked choices need redundant cues (not colour alone) and AA contrast (no opacity compositing).
- Gate status at HEAD: 808/82 tests, lint clean, validator 8/8 clean, build clean, live browser verify
  passed (locked render, non-focusable, DOM order, flag-met unlock, 0 console errors).

## Your adversarial charge

**Assume the implementation contains at least one real defect the internal reviews missed** — a
correctness bug, an integration/seam defect, an unmapped exception or error-taxonomy hole, a determinism
violation, a false-green or missing test, or a place the code silently diverges from its spec. **Find
it.** Ground every finding in the actual committed code; cite `file:line`. Run the build/tests only if
your sandbox allows (read-only reasoning from the code is fine).

Angles the internal reviews may have under-covered:

1. **The resolver's `visibility` narrowing** — `choice.visibility` is typed as the union but arrives from
   cast JSON. `resolveChoiceVisibility` checks `=== 'disabled'` / `=== 'shown'` else `hidden` — is the
   "unknown value → hidden" fallback consistent with the validator's invalid-value ERROR (fail-closed
   agreement)?
2. **The two select-handler guards** — do they rebuild state consistently with what the render used
   (ChoicePanel: `buildGameState(store)` in the callback vs `useGameState()` in render)? Any TOCTOU gap
   that matters?
3. **The all-gated-round warning** (`ea5ece2`) — does `.every()` on an empty non-escape array warn
   correctly? Does the warning fire for scene-level choices too, or only encounter rounds (spec'd only
   for rounds — is the scene-level analogue a hole worth flagging)?
4. **The demo witness test** — `phase5DemoChoice.test.ts` imports shipped JSON. Does it truly pin the
   before/after (field-stripped form → hidden)? Could it silently pass if the demo choice were deleted?
5. **`worseAlternative` recursion** — validator rules now run on nested replacement choices. Is there any
   shipped `worseAlternative` that would trip the new rules? (Validator says 8/8 clean — confirm why.)
6. **Save/encounter seam** — `encounterState.rounds` persists full `Choice` objects (v5 saves). A v5 save
   written by THIS branch may now contain `visibility`/`gateReason` in round choices. Does `loadGame` /
   `isValidGameState` / the panel resume path handle both presence and absence?
7. **A11y claims vs code** — `LockedChoice` has no `aria-disabled` or textual "locked" marker beyond the
   aria-hidden 🔒 and the reason prose. Is the locked state programmatically determinable for a
   screen-reader user (SC 4.1.2 / 1.3.1), or does it rely on the reason prose alone being sufficient?
8. **Docs-vs-code** — the three updated docs claim exact rule shapes. Spot-check each claim.

Rank findings Blocker / Major / Minor. Don't manufacture defects — state what you verified clean.

## Output

Write your review to `codex/output/2026-07-17-phase5-choice-gating-impl-review.md`: one-line verdict,
findings ranked by severity (location, concrete failure scenario, suggested fix), then a short list of
what you verified clean.
