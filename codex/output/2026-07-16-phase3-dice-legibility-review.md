# Phase 3 Dice / Probability Legibility Spec Review

**Verdict:** revise before planning.

## Findings

### Major - The odds model ignores guaranteed archetype checks

**Grounding:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:46-60`;
`src/engine/choiceResolution.ts:48-59`; `src/App.tsx:153-158`.

`computeCheckOdds` receives only the investigator, DC, and advantage flags. It cannot see the active
`ability-auto-succeed-{reason,vigor,influence}` flags. The real choice and encounter resolver checks
those flags before rolling and returns an automatic `critical`. A player who activates Elementary,
Street Survivor, or Silver Tongue can therefore be shown ordinary or even Forbidding prospects for a
check that is guaranteed to resolve critically.

**Required change:** Make the pre-roll model share the resolver's auto-success predicate. Pass either
the relevant game state or an explicit `autoSucceeds` value into the helper, and define a display
treatment for that state rather than presenting ordinary dice odds. Add regular-choice and encounter
tests with an active matching ability flag.

### Major - "Prospects" excludes an outcome that is success-equivalent on clue prompts

**Grounding:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:94-106,119-123`;
`src/engine/diceEngine.ts:65-72`; `src/components/NarrativePanel/SceneCluePrompts.tsx:78-91`.

The arithmetic is correct for the narrow event `{success, critical}`, but the rendered word
"Prospects" does not tell the player that it means only a full success. On a scene clue check,
`partial` discovers the clue exactly as `success` and `critical` do; only `failure` and `fumble` withhold
it. For example, DC 10 with modifier +0 has a 55% full-success chance, so the spec labels it Uncertain,
but rolls 7-20 discover the clue: 70%, which crosses the spec's Favourable threshold. The shared band
therefore understates the actual prospect the player cares about on this surface.

**Required change:** Define what the band predicts in player-facing terms. Either include `partial`
where it yields the advertised benefit, or label the band explicitly as full-success prospects and
explain that distinction in the UI contract. If bands are outcome-aware, the helper needs a stated
policy/input rather than one universal success-only calculation. Add a clue-prompt boundary test where
including `partial` changes the band.

### Major - The composed odds label will not be the check button's accessible name

**Grounding:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:46-52,68-71,169-174`;
`src/components/ChoicePanel/ChoiceCard.tsx:97-105`;
`src/components/NarrativePanel/SceneCluePrompts.tsx:109-119`;
`src/components/EncounterPanel/EncounterPanel.tsx:139-148`.

Both relevant controls already set an explicit `aria-label` on the outer button. That label overrides
the descendant text as the button's accessible name, so putting a composed label on a nested
`CheckOddsTag` does not make the odds available when the player focuses the choice. Encounters inherit
the same defect because they render `ChoiceCard`. The proposed `CheckOdds` value also contains no
faculty, so `CheckOddsTag` cannot construct the spec's `"Reason check, ..."` example from its stated
input.

**Required change:** Compose the odds into each outer button's accessible name and make the visual tag
decorative to accessibility, or remove the overriding button label and prove the resulting content
name is coherent. Add `faculty` to `CheckOdds` or make it an explicit component prop. Tests must assert
the accessible name of the focusable button, not merely find a labelled descendant.

### Major - Encounter coverage conflates choice cards with an automatic reaction roll

**Grounding:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:39-41,165-167,191-193`;
`src/components/EncounterPanel/EncounterPanel.tsx:42-67,139-148`;
`src/engine/encounters.ts:43-51`.

`EncounterPanel` does not independently calculate or render a faculty tag; encounter round choices are
already `ChoiceCard`s. Adding another `CheckOddsTag` directly in `EncounterPanel` risks duplicate
pre-roll UI. More importantly, there is no "reaction check button": a supernatural reaction check is
rolled automatically during `startEncounter`, and only its pass/fail boolean reaches the panel. It
never calls `setCheckResult`, so it receives neither pre-roll prospects nor the promised at-roll DC.
The claimed coverage of encounter "faculty/reaction" checks is therefore false.

**Required change:** Decide the scope explicitly. If only encounter round choices are covered, state
that their pre-roll UI comes transitively from `ChoiceCard`, exclude automatic reaction checks, and
limit the direct `EncounterPanel` change to result/DC propagation. If reaction checks are in scope,
redesign their initiation/result contract so the player can see pre-roll odds and the full roll result,
not just `reactionCheckPassed`.

### Minor - `choice.faculty` alone does not mean the engine will roll

**Grounding:** `docs/superpowers/specs/2026-07-16-phase3-dice-legibility-design.md:145-151`;
`src/engine/choiceResolution.ts:48-49`; `src/engine/contentValidation.ts:381-393`;
`src/engine/diceEngine.ts:81-87`.

The spec says to render odds whenever `choice.faculty` is set and would obtain a default DC 12 from
`resolveDC`. The engine and validator define a check more narrowly: faculty plus `difficulty` or
`dynamicDifficulty`. A faculty-only choice is valid as a non-check and resolves without rolling, so
the proposed guard can advertise a fictitious DC 12 check.

**Required change:** Guard `CheckOddsTag` with the same check predicate as resolution:
`choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty)`. Keep the existing
aptitude tag separately if faculty-only choices are meant to retain it, and test that such a choice has
no DC or Prospects.

## Verified Areas

- The base formula and `[0.05, 0.95]` clamp match `resolveCheck`: natural 1 always fails, natural 20
  always succeeds, and the successful natural rolls otherwise form one contiguous upper interval.
- `1 - (1 - p)^2` and `p^2` correctly model take-higher and take-lower for that interval; cancellation
  and monotonicity in modifier are sound.
- `lastCheckResult` is omitted from `snapshotGameState` (`src/utils/gameState.ts:5-20`), so adding an
  optional store-only `dc` field does not require a save migration.
- Passing `false` for scene-clue advantage matches the current roll at
  `src/components/NarrativePanel/SceneCluePrompts.tsx:81`; it does not create a band/roll mismatch,
  although that surface intentionally does not participate in `computeAdvantage`.

No build or test run was needed for this spec-only review.
