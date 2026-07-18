# Adversarial review — The Orrery Room design spec

**Verdict:** Not implementation-ready. The spec has two blockers: the vignette would
never unlock through the proposed manifest-only catalog change, and the CLI validator
does not load variants for vignettes. Several additional issues make the keystone
persistence and zero-warning claims unreliable.

## Findings

### 1. Blocker — the new vignette can never become selectable

**Spec section:** §1 “Goal & catalog placement” and §2 “the only code change”
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:13-17`,
`:35-56`).

**Repo evidence:** The manifest's `triggerCondition` is not evaluated by Case Selection.
The UI only checks `vignette-unlocked-<id>` (`src/components/CaseSelection/CaseSelection.tsx:59-62`).
Those flags are minted by a separate hard-coded registry
(`src/engine/caseProgression.ts:19-53`, `:96-129`), whose own comment says it must be
extended when a vignette is authored (`:19-22`). `the-orrery-room` is absent.

Adding only the manifest entry therefore renders a permanently disabled vignette,
regardless of Grey Dawn reputation.

**Concrete fix:** Add `the-orrery-room` with the exact faction key and threshold to
`VIGNETTE_CONDITIONS`, plus threshold/below-threshold/already-unlocked tests. Better,
make manifest conditions the single source of truth, but that is a broader change.
Either way, §2 must include this code delta.

### 2. Blocker — the CLI silently omits vignette variants

**Spec section:** §2 “Deliberately unchanged” and §8 validation pipeline
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:58-61`,
`:218-231`).

**Repo evidence:** `scripts/validateCase.ts` reads `variants.json` only inside the
`isMainCase` branch (`scripts/validateCase.ts:31-46`). The vignette branch reads only
`scenes.json`. Although `validateBundle` can validate variants
(`src/engine/contentValidation.ts:115-129`), it cannot validate data it was never given.
It also discovers deduction-gating references by scanning variants
(`src/engine/contentValidation.ts:271-287`).

Consequences:

- The three ending variants receive no CLI structural, reference, Phase 5, or warning
  validation.
- `mythos-pattern-named` is gated only by those ending variants, so the CLI does not
  classify that recipe as gated and never applies F-102 to it.
- Runtime validation is not an equivalent fallback: `validateContent` discards warnings
  and does not enable reachability (`src/engine/contentLoader.ts:130-148`).

**Concrete fix:** Make `loadBundle` read optional `variants.json` for both cases and
vignettes. Add a vignette fixture proving malformed variants, variant soft-lock warnings,
and a variant-gated recipe all reach `validateBundle`.

### 3. Major — the flagship Veil Sight paragraph has no authored mechanism

**Spec section:** §3.7 and §6, conflicting with the “3 variants, one per ending” count
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:74`,
`:93-97`, `:202-203`).

**Repo evidence:** A clue has one static `description`
(`src/types/index.ts:73-84`), and `ClueDiscovery` has no conditional prose field
(`src/types/index.ts:180-185`). Conditional scene prose is implemented with a variant
(`src/types/index.ts:187-200`; `src/engine/conditions.ts:128-146`). Veil Sight's active
state is the flag `ability-veil-sight-active` (`src/engine/flags.ts:4-8`), and shipped
content already uses a flag-gated scene variant for this purpose
(`public/content/cases/the-mayfair-seance/variants.json:67-72`).

The proposed active-only paragraph cannot live in the static clue discovery prose, and
the spec allocates every variant to an ending.

**Concrete fix:** Specify a fourth variant of the night scene, gated on
`hasFlag: ability-veil-sight-active`, with identical clue availability and exits but the
extra paragraph. Update the variant count and tests. This enriches prose without gating
the clue.

### 4. Major — the onEnter-only period clue necessarily emits a CLI warning

**Spec section:** §5 keystone chain and §8 zero-warning requirement
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:177-181`,
`:218-224`).

**Repo evidence:** The reachability warning's “discoverable clues” pass collects
`cluesAvailable`, `requiresClue`, and `advantageIf`, but not `onEnter: discoverClue`
(`src/engine/contentValidation.ts:616-636`). It consequently warns at
`src/engine/contentValidation.ts:165-169`. A different helper used by F-102 *does* count
`onEnter: discoverClue` (`src/engine/contentValidation.ts:639-665`).

As specified, `or-clue-orrery-period` has only an onEnter source and no other reference
that `computeDiscoverableClues` recognizes. The validator will report it as never
discoverable, contradicting the required zero warnings.

**Concrete fix:** Correct `computeDiscoverableClues` to include onEnter `discoverClue`
effects, with a regression test. A content-only workaround is to list the clue as
`automatic` in the comparison scene's `cluesAvailable` as well, but duplicating the
source is less clean.

### 5. Major — minting the keystone on an ending screen loses the persistent flag

**Spec section:** §3 “Cross-content persistence”
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:118-129`).

**Repo evidence:** Variant onEnter effects run only inside `goToScene`
(`src/store/slices/narrativeSlice.ts:142-175`). `useCurrentScene` resolves variants
reactively from current game state (`src/store/index.ts:136-146`), but does not apply
effects. The Evidence Board remains available on the game screen, including terminal
scenes (`src/App.tsx:93-119`, `:331-375`).

A player can therefore:

1. enter a base ending without having formed the recipe;
2. open the Evidence Board on that terminal scene and form `mythos-pattern-named`;
3. see the ending reactively switch to its variant;
4. complete the vignette without the variant's onEnter ever setting the flag.

The next load wipes deductions (`src/store/slices/narrativeSlice.ts:54-58`), so the
keystone was genuinely minted but its cross-content record is lost. The claim that the
variant “faithfully records the mint” is false.

**Concrete fix:** Persist at deduction-formation time, not scene-entry time. For example,
extend recipes with an optional `onForm: Effect[]` and apply it when matched, then author
the flag effect there. Add a witness test that forms the recipe after entering an ending.
If no engine extension is acceptable, the spec must explicitly prevent deduction
formation on terminal scenes; current UI does not.

### 6. Major — F-102 is flag-blind and cannot prove the keystone gate

**Spec section:** §4's deferred “confirm the validator” question
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:155-163`).

**Repo evidence:** In F-102, “gated recipe” means a recipe whose ID gates some content
(`src/engine/contentValidation.ts:265-287`); it does not mean a recipe whose clue source
is itself gated. Both reachability traversals add choice outcome edges without consulting
`requiresFlag` or visibility (`src/engine/contentValidation.ts:208-263`,
`:586-609`).

After finding the flag-gated choice, the validator treats the comparison scene as
reachable both with and without `mythos-period-computed`. It will pass the onEnter clue as
a non-critical source, but that says nothing about flagless obtainability.

**Concrete fix:** Resolve this in the spec now: F-102 only proves “not critical-only.”
Keep the proposed positive and negative content-backed witness tests, require that the
comparison scene be the clue's sole source, and test choice visibility with and without
the flag. If static validation must prove the stronger property, add gate-aware
reachability with explicit initial-state assumptions.

### 7. Major — effect ordering can turn a faction reward into a penalty

**Spec section:** §3 ending table and rep-math note
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:103-107`,
`:131-135`, `:199-200`).

**Repo evidence:** Effects execute sequentially in authored order
(`src/store/slices/worldSlice.ts:34-58`). Direct reputation is clamped immediately
(`src/store/slices/worldSlice.ts:28-32`), and a `-3` disposition effect subsequently
applies `-1.5` reputation (`src/store/slices/npcSlice.ts:21-34`).

If the listed “rep +2, opposing disposition -3” order is authored at Grey Dawn rep 9,
the first effect clamps to 10 and the second lowers it to 8.5: an actual **-0.5** reward.
At rep 10 the ending costs 1.5. Both states are reachable because the vignette unlocks
at rep 2.

Nominal, unclamped totals are otherwise correct: the two partisan endings are +0.5 and
the brokered ending is +2.

**Concrete fix:** Specify disposition effects before the direct positive reputation
effect for partisan endings, and test starting reputation near both clamps. Describe
the values as nominal totals; at +10 a positive net movement cannot be guaranteed.

### 8. Minor — the red herring does not always degrade a recipe component

**Spec section:** §4 red-herring rule
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:165-167`).

**Repo evidence:** The oracle checks recipe subset matches first
(`src/engine/deductionOracle.ts:61-73`). If a component contains all clues for
`or-genuine-instrument` or `mythos-pattern-named` plus the forged-provenance clue, the
real recipe still makes the whole component `correct`; extra red-herring noise is
ignored. Red-herring degradation occurs only on the generic path
(`src/engine/deductionOracle.ts:76-88`).

**Concrete fix:** Narrow the claim: connecting provenance and gear train alone can form a
false generic deduction if that edge is authored, but adding provenance to a complete
recipe does not poison the recipe. Changing the latter would require an oracle change.

### 9. Minor — the cross-content contract contradicts itself

**Spec section:** §3 correctly says downstream content must use `hasFlag`, but §4 says it
uses `hasDeduction` (`docs/superpowers/specs/2026-07-17-orrery-room-design.md:126-129`,
`:155-158`).

**Repo evidence:** `resetForNewCase` clears `state.deductions` while leaving persistent
flags intact (`src/store/slices/narrativeSlice.ts:50-58`). Conditions read those separate
maps (`src/engine/conditions.ts:58-69`).

**Concrete fix:** Change §4's downstream contract to
`hasFlag: mythos-pattern-named` everywhere. Reserve `hasDeduction` for in-vignette
variants.

### 10. Minor — recipes do not “round-trip” in the save schema

**Spec section:** §7 (`docs/superpowers/specs/2026-07-17-orrery-room-design.md:207-211`).

**Repo evidence:** `GameState` has deductions but no `caseData` or recipes
(`src/types/index.ts:273-299`), and `snapshotGameState` serializes no content bundle
(`src/utils/gameState.ts:4-20`). On load, the store re-fetches the current content and
separately restores the saved deduction record (`src/store/slices/metaSlice.ts:97-110`,
`:119-144`).

No schema migration is needed, and old saves for the four existing vignettes should
remain compatible if missing optional files are caught. The stated reason is simply
wrong: recipes are rehydrated from content, not round-tripped through the save.

**Concrete fix:** Reword the claim and make the compatibility test start from a
pre-change vignette save payload while both optional fetches return 404.

## Areas checked with no additional defect

- **Phase 5 vocabulary:** `requiresFlag` + `visibility: "disabled"` + a non-empty
  `gateReason` is valid (`src/engine/contentValidation.ts:461-490`). The verdict has two
  ungated partisan choices, so the hidden broker choice does not create a soft lock.
  The orrery hub must likewise retain at least one ungated choice; make that explicit in
  its acceptance test.
- **Recipe/flag namespaces:** `mythos-pattern-named` does not use the reserved
  `deduction-generic-` prefix, and no existing recipe/flag uses that ID. Sharing the
  string between the deduction and flag maps is deterministic because condition type
  selects the map. The validator rejects the reserved prefix
  (`src/engine/contentValidation.ts:143-149`).
- **Save-load routing:** Once `VignetteData` and `vignetteToCaseData` pass the new fields,
  `metaSlice.loadGame` will reload them through the vignette path
  (`src/store/slices/metaSlice.ts:103-108`). The adapter claim is sound.
- **Scale and counts:** 18 base scenes plus 3 currently specified ending variants,
  Act 1's 9-10 plus Act 2's 8-9, seven clues including one red herring, two recipes,
  and three NPCs are internally consistent. The shipped vignette range is indeed 8-13
  base scenes.
