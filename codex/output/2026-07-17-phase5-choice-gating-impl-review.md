Verdict: **CHANGES REQUESTED** - the resolver/rendering contract is sound, but the new soft-lock warning does not cover all valid runtime choice configurations and also emits false positives.

## Major

### 1. The soft-lock check misses scene choices and reaction-replaced encounter rounds

**Location:** `src/engine/contentValidation.ts:335-364`, `src/engine/encounters.ts:58-65`, `src/components/ChoicePanel/ChoicePanel.tsx:40-47`

The warning analyzes only each encounter round's authored top-level `round.choices`. Two valid content shapes can therefore pass without the warning and render no actionable choice:

- A normal scene whose choices are all unmet `hidden`/`disabled` gates. `validateChoice` checks each item, but `validateScene` performs no collection-level check for `scene.choices`; `ChoicePanel` then drops hidden choices and renders disabled choices as non-interactive list items.
- A supernatural round whose first, ungated choice has a gated `worseAlternative`. The authored round suppresses the warning because it contains an ungated choice, but a failed reaction check replaces that choice before rendering. If the replacement and remaining choices are unmet hidden/disabled gates, `getEncounterChoices`/`EncounterPanel` expose no action and the encounter cannot advance.

**Suggested fix:** extract a collection-level "has guaranteed actionable choice" check and apply it to scene choices, authored encounter rounds, and the possible reaction-failure round obtained by replacing the first choice with its `worseAlternative`. Keep this a warning if arrival-state analysis remains intentionally conservative. Add tests for a scene with only disabled choices and an ungated primary choice whose hidden replacement leaves the failed-reaction round locked.

## Minor

### 2. The all-gated-round predicate warns on choices that are guaranteed interactive

**Location:** `src/engine/contentValidation.ts:354-362`, `src/engine/choiceVisibility.ts:46-54`, `src/engine/encounters.ts:194-206`

`nonEscape.every(choiceGateConditions(...).length > 0)` does not model the runtime semantics:

- A gated non-escape choice with `visibility: "shown"` is always selectable even when its gate is unmet, yet it receives the "renders nothing interactive" warning in addition to the intended soft-gate warning.
- An all-escape round makes `nonEscape` empty, so `.every()` is true. An ungated escape choice is nevertheless always returned because its empty condition list evaluates true.

These are false positives in an author-facing validator. Treat a non-escape choice as a guaranteed action when it is ungated or uses `visibility: "shown"`; treat an escape choice as guaranteed only when it is ungated. Preserve the warning for an empty round and for gated-only escape rounds. Add both counterexamples to `contentValidation.choiceGating.test.ts`.

### 3. The documented warning taxonomy omits the new round warning

**Location:** `src/engine/contentValidation.ts:79-82`, `docs/content-authoring.md:242-255`, `docs/engine-reference.md:142-146`

All three descriptions say warnings comprise the always-on soft-gate warning plus opt-in reachability observations. `validateBundle` now also emits the unconditional encounter-round soft-lock warning. Authors cannot discover this warning's contract from the validator/API documentation.

**Suggested fix:** document the round/scene warning after fixing its semantics above, including that it is always on and non-fatal.

## Verified Clean

- Unknown cast-JSON `visibility` values fail closed to `hidden`, while validation emits an error.
- The shared truthy-only gate builder preserves absent/empty/null compatibility; absent `visibility` remains hard-hidden.
- Both select handlers re-resolve against live store state; the render subscriptions cover every gate input.
- Escape choices remain hard-gated and never render disabled.
- `validateChoice` recurses into `worseAlternative`; shipped content currently contains no such choices.
- The content-backed demo test fails if the demo choice is removed and proves authored-disabled versus field-stripped-hidden behavior.
- Existing and current-version saves accept encounter choices both with and without the optional fields; resumed panels use the same resolver.
- The locked group is outside navigation, named "Locked choices", non-focusable, reason-bearing, and does not use subtree opacity.
- Verification passed: focused Phase 5 tests `106/106`; full suite `808/82`; lint clean; validator `8/8` with zero reported warnings/errors; production build clean.
