# Phase 3 Dice / Probability Legibility — implementation review

## Findings

### Major — Choice prospects ignore authored success-equivalent partial outcomes

`ChoiceCard` hard-codes `partialCountsAsSuccess: false` for every ordinary and
encounter choice (`src/components/ChoicePanel/ChoiceCard.tsx:102`,
`src/components/ChoicePanel/ChoiceCard.tsx:113`). That makes `computeCheckOdds`
use the strict `dc` threshold rather than `dc - 3`
(`src/engine/checkOdds.ts:59`, `src/engine/checkOdds.ts:63`).

The premise that a choice's partial tier always leads to a distinct, worse
outcome is false in shipped content. For example, `cc-choice-dinner-observe` is
a Perception DC 10 check whose critical, success, and partial tiers all route to
`cc-act1-table-observed`, while failure/fumble route elsewhere
(`public/content/cases/the-comet-club/act1.json:25`,
`public/content/cases/the-comet-club/act1.json:30`,
`public/content/cases/the-comet-club/act1.json:34`). With modifier +0, the UI
therefore reports Uncertain from the strict 55% success-tier chance, although
70% of rolls reach the authored successful destination, which is Favourable by
the feature's thresholds. `resolveCheck` does produce `partial` from
`total >= dc - 3` (`src/engine/diceEngine.ts:65`,
`src/engine/diceEngine.ts:71`), and the resolver follows that tier's authored
destination (`src/engine/choiceResolution.ts:61`,
`src/engine/choiceResolution.ts:66`), so this is a displayed-odds mismatch, not
content that the engine ignores.

Change the choice policy to reflect authored outcome equivalence. At minimum,
pass `partialCountsAsSuccess: true` when `outcomes.partial` equals the success
or critical destination. For checks where failure/fumble also share the same
destination, either suppress the prospects band or generalize the helper to
classify all success-equivalent tiers. Add a regression test using an actual
same-destination choice; the current fixture deliberately gives partial a
different destination (`src/components/__tests__/ChoiceCard.odds.test.tsx:14`,
`src/components/__tests__/ChoiceCard.odds.test.tsx:16`), so this defect remains
green.

### Major — Loading a save retains the previous roll and DC

`snapshotGameState` correctly omits `lastCheckResult`
(`src/utils/gameState.ts:5`, `src/utils/gameState.ts:20`), but a successful
`loadGame` overwrites persisted fields without clearing the existing transient
value (`src/store/slices/metaSlice.ts:119`,
`src/store/slices/metaSlice.ts:140`). Because this path assigns
`currentScene` directly rather than calling `goToScene`, the narrative slice's
cross-scene clearing logic is not involved.

Consequently, loading any save while a roll overlay is present leaves that old
roll and its Phase 3 `dc` in `lastCheckResult`. `NarrativePanel` keeps the
overlay visible whenever that value is non-null
(`src/components/NarrativePanel/NarrativePanel.tsx:47`,
`src/components/NarrativePanel/NarrativePanel.tsx:55`) and forwards the stale
DC to the overlay (`src/components/NarrativePanel/NarrativePanel.tsx:126`,
`src/components/NarrativePanel/NarrativePanel.tsx:131`). The loaded scene can
therefore display “vs DC N” for a check performed in a different save.

Set `state.lastCheckResult = null` in the successful `loadGame` transaction.
Add a load test that saves a state, seeds the live store with a non-null result
including `dc`, loads the save, and asserts the result is null. The current
valid-load test checks only `caseData`
(`src/store/__tests__/metaSlice.loadGame.test.ts:90`,
`src/store/__tests__/metaSlice.loadGame.test.ts:101`).

## Verdict

Not merge-ready until both Major findings are fixed. The base probability,
natural-1/natural-20 clamps, advantage/disadvantage transforms, dynamic-DC
resolution, auto-succeed polarity, and accessible-name plumbing otherwise
agree with the roll paths reviewed.

## Verification

Focused Phase 3 plus save-load tests: 47 tests across 10 files passed.
`npm run build` passed.
