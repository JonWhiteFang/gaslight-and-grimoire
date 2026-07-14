# Phase 2 deduction-feedback spec review

## Findings

### Blocker — Tag overlap is not a valid correctness oracle for the shipped clue corpus

The spec promotes the board's loose highlighting heuristic into the authoritative generic-correctness
rule (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:35`,
`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:75`). The current board uses tags
only to brighten one candidate relative to a source (`src/components/EvidenceBoard/EvidenceBoard.tsx:171`);
the data model has a separate authored relationship field, `connectsTo`
(`src/types/index.ts:76`).

The corpus demonstrates that these signals are not interchangeable. All three core clues in The
Rationalist's Dilemma explicitly connect to each other, but the experiment log and anomalous readings
share no tag (`public/content/side-cases/the-rationalists-dilemma/clues.json:3`,
`public/content/side-cases/the-rationalists-dilemma/clues.json:4`). The proposed classifier therefore
calls that authored three-clue web only `partial`. Case-sensitive tags also make the explicitly connected
Courier Description / Safe House pair fail (`"Lamplighters"` versus `"lamplighters"`)
(`public/content/side-cases/a-matter-of-shadows/clues.json:3`,
`public/content/side-cases/a-matter-of-shadows/clues.json:6`). In the other direction, the Cipher Note
and Cellar Ledger share only the broad tag `paper` but neither authors the other in `connectsTo`, so they
become `correct` (`public/content/cases/the-whitechapel-cipher/clues.json:9`,
`public/content/cases/the-whitechapel-cipher/clues.json:76`). A scan of the current corpus finds 31 of 82
unique authored `connectsTo` edges with no exact shared tag, plus 47 non-red-herring, non-authored pairs
that do share a tag.

**Fix:** Choose an authored correctness model before planning. Either define multi-clue correctness over
`connectsTo` (including whether it requires a connected graph, pairwise links, or a common conclusion),
or add explicit deduction/group identifiers and validate them. If tags are deliberately repurposed,
reauthor and validate the full corpus first, including normalization/casing and protection against broad
category tags producing false positives.

### Blocker — “Every recipe is correct” contradicts a live, gated red-herring recipe

Recipe matching returns `correct` before any red-herring check because the spec assumes every recipe is
“authored-correct by definition”
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:72`). That is false in the current
schema and content: `KeyDeduction` carries `isRedHerring` (`src/types/index.ts:98`), and The Comet Club's
`cc-deduction-poisoner` is explicitly `isRedHerring: true` with the description “Coherent, confident,
and wrong” (`public/content/cases/the-comet-club/deductions.json:25`). Its required set also contains an
actual `redHerring` clue (`public/content/cases/the-comet-club/clues.json:48`) and gates a deliberate
wrong confrontation (`public/content/cases/the-comet-club/act3.json:22`).

As written, that known-false conclusion receives green “The connection holds” feedback and bypasses
both red-herring branches. Simply changing it to `incorrect` would make its stable deduction never form
and make the authored gated branch unreachable, conflicting with the current content contract.

**Fix:** Explicitly model authored false-but-coherent deductions. Decide whether they form a distinct
outcome that still stores the stable red-herring deduction, or remove/rework that recipe and its gate.
Then reconcile that choice with ADR-0012's “non-qualifying set never forms one” rule and add a component
test for this exact shipped recipe.

### Blocker — Clearing connections makes the directional visual message disappear and breaks the result state machine

The pseudocode sets the visual message and then calls `onResult`
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:109`,
`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:118`). The parent synchronously
clears connections for both outcomes (`src/components/EvidenceBoard/EvidenceBoard.tsx:180`), which makes
`connectedIds` empty (`src/components/EvidenceBoard/EvidenceBoard.tsx:68`). `DeductionButton` then returns
`null` below two IDs (`src/components/EvidenceBoard/DeductionButton.tsx:39`). Consequently the local
`<p>` containing Phase 2's core sighted-user feedback is removed immediately; the proposed isolated
component tests can pass while the integrated board never displays the message.

The same lifecycle has two more failures. A successful phase has no transition back to `idle`, so after
the player connects another pair in the same board session the button reappears disabled as “Deduction
Locked” (`src/components/EvidenceBoard/DeductionButton.tsx:84`). On failure, the proposed timeout reads
`idsRef.current` (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:119`), but the
parent clear updates that ref to `[]`; if the player starts another connection first, it can instead
point at the new IDs. The attempted clues can therefore remain `contested`, or a later set can be reset
to `examined`.

**Fix:** Specify an attempt-scoped state machine. Snapshot `attemptedIds` in the click handler, render the
result independently of current connection props for a defined duration, reset success/failure to
`idle`, block or cancel overlapping attempts, and clean up timers on unmount. Add an integrated
`EvidenceBoard` test that observes the message after `clearConnections`, verifies the original IDs
revert, reconnects during the timeout, and performs a second successful deduction without closing the
board.

### Major — The no-roll failure path does not enact ADR-0012's accepted roll contract

The spec says the d20 is not rolled at all for `partial`/`incorrect`
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:39`). ADR-0012 instead says the
Reason roll is retained “at the deduction moment,” determines tier/framing, and drives the Phase 2
partial-tier directional feedback (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:32`). It
explicitly deferred the mapping from all five roll tiers to feedback
(`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:41`). The spec supplies only
`critical` versus “any other” for correct sets and derives partial feedback from deterministic
correctness, so it silently replaces rather than resolves that deferred decision. Its proposed tests
also cannot perform ADR-0012's literal non-qualifying-plus-`critical` confirmation because no roll exists
on that path (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:76`).

**Fix:** Either amend/supersede ADR-0012 before claiming `Enacted`, explicitly choosing “roll only correct
sets,” or retain a roll for every valid attempt and define a correctness × five-tier feedback matrix
while keeping formation controlled solely by correctness.

### Major — Recipe subset precedence validates arbitrary noise and is order-dependent with multiple matches

`matchDeduction` accepts any superset and returns the first matching recipe
(`src/engine/buildDeduction.ts:31`). The classifier immediately calls that whole connection `correct`,
then the UI marks every connected ID `deduced`
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:72`,
`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:105`), even though
`buildDeductionFromRecipe` deliberately records only `requiredClues` and discards extras as noise
(`src/engine/buildDeduction.ts:49`). Thus adding any unrelated clue, including a red herring, still gives
the whole selection green feedback and a deduced status.

The singular `recipe` result is also ambiguous now that The Comet Club has four recipes
(`public/content/cases/the-comet-club/deductions.json:2`). A connected web satisfying two recipes stores
only whichever appears first in the content array; reordering content changes which progression gate
opens. The property “superset of some recipe is correct” does not specify which deduction must result.

**Fix:** Preserve ADR-0005's subset behavior if required, but distinguish matched recipe clues from
extraneous clues and define their statuses/feedback. Also define multi-match behavior: return all
matches, require one recipe per attempt, or use a validated, explicit priority independent of array
order. Test recipe + unrelated clue, recipe + red herring, and a set matching two recipes.

### Major — A red herring can manufacture `partial` without any coherent legitimate subset

The second partial branch is `hasRedHerring && someShareATag`
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:80`). For two clues,
`someShareATag` and `allShareATag` are equivalent. A normal clue plus one red herring sharing `paper`
therefore produces “Some of these belong together,” although there are not two non-red-herring clues
that could constitute “some.” The shipped Occultist's Calling Card is a red herring carrying both
`paper` and `occult` (`public/content/cases/the-whitechapel-cipher/clues.json:60`), so many such false
partials are reachable.

**Fix:** Compute coherent subsets over distinct non-red-herring clues and require at least two of them
before using the “some belong” message. Specify separately what feedback a red herring sharing metadata
with one legitimate clue should receive, and add the two-clue and red-herring-only-overlap cases to the
test table.

### Major — Ignoring unresolved IDs can fail open, and the rule contradicts its own wording

The rule defines `allShareATag` over “every connected clue” but then says unresolved IDs are ignored
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:75`,
`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:88`). With two connected IDs and
only one resolved tagged clue, a straightforward intersection implementation makes
`allShareATag === true` vacuously and can return `correct`. Recipe matching is even earlier and checks
IDs without checking that those clues resolve (`src/engine/buildDeduction.ts:36`).

This is not fully excluded by the runtime boundary: save validation is deliberately shallow and does
not validate connection entries (`src/engine/saveManager.ts:62`), and load restores saved connections
directly (`src/store/slices/metaSlice.ts:117`).

**Fix:** Fail closed unless there are at least two distinct IDs and every ID is an own property of
`clues`; perform that validation before recipe matching. Define duplicate-ID behavior and test one
missing, all missing, duplicate IDs, and prototype-like keys.

### Minor — The retained roll UI contract is inaccurate and “Rolling…” cannot visibly render as specified

`performCheck` is synchronous (`src/engine/diceEngine.ts:96`). Setting `rolling` and then `success` in one
event is React-batched, so the claim that “Rolling…” briefly appears on the correct path
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:136`) is not implementable without
an explicit staged render/timer. The unchanged accessible label also promises “perform a Reason check”
(`src/components/EvidenceBoard/DeductionButton.tsx:85`) on paths where the spec says no check occurs.

**Fix:** Either remove the transient rolling claim/state and use a neutral accessible label, or specify
an asynchronous presentation step (respecting reduced motion) and test it.

## Overall verdict

**Revise first** — the proposed correctness oracle, red-herring recipe semantics, and integrated result
state machine are not sound enough to proceed to an implementation plan.
