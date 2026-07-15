# Phase 2 deduction-feedback spec re-review (round 3)

## A. Prior finding audit and corpus confirmation

| Prior issue | Status in v3 | Verification |
|---|---|---|
| Round 1 tag oracle | **Fixed** | Tags remain only a visual brightening heuristic (`src/components/EvidenceBoard/EvidenceBoard.tsx:171-178`). Classification now uses the authored `connectsTo` field (`src/types/index.ts:70-80`) and player edges (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:102-126`). |
| Round 1 red-herring recipe gate | **Fixed for recipes** | The false recipe is still stored under `cc-deduction-poisoner` (`public/content/cases/the-comet-club/deductions.json:25-29`) and still gates the wrong confrontation (`public/content/cases/the-comet-club/act3.json:22-30`). Step 1 returns `false`, and the board still calls `buildDeductionFromRecipe`, whose stable ID satisfies the gate (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:107-113`; `src/engine/buildDeduction.ts:54-63`). Generic red herrings remain inconsistent; see N4. |
| Round 1 button unmount | **Fixed for the banner** | The outcome moves to the board and therefore survives connection removal and button unmount (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:195-198`). The success lock also disappears with the trigger-only button. Board unmount still breaks timer ownership; see N2. |
| Round 2 N1 topology | **Fixed in the classifier** | It receives edge pairs, flood-fills one player-connected component, and matches recipes only inside that component (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:94-105`). This prevents disjoint edges from jointly satisfying a recipe. Component selection after an attempt is not sound; see N3. |
| Round 2 N3 vignettes | **Fixed** | `VignetteData` still has no recipes (`src/types/index.ts:303-316`), the vignette loader returns none (`src/engine/contentLoader.ts:101-119`), and the generic `connectsTo` layer can now form deductions without recipes. |
| Round 2 N4 partial farm | **Fixed as reported** | `partial` is now a mixed authored/non-authored edge result, not recipe membership (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:115-126`). A two-clue component has one edge and can only be `correct` or `incorrect`; meaningful `partial` first occurs with three clues and mixed edge truth. |
| Round 2 N2/N5 status lifecycle | **Not fixed** | Live `getState()` removes the stale-render-snapshot bug, but the proposed snapshot is taken after connection status has already destroyed the prior value, and the single token has the wrong scope and lifetime. See N1 and N2. |

The load-bearing corpus claims otherwise hold. A structured scan found 139 directed `connectsTo` entries,
25 one-way entries, and no dangling targets; treating the relation as undirected is necessary for authored
one-way links such as `rd-clue-circle-orders -> rd-clue-experiment-log`
(`public/content/side-cases/the-rationalists-dilemma/clues.json:3-6`). The Mayfair and Lamplighter recipe
sets are indeed not `connectsTo`-connected (`public/content/cases/the-mayfair-seance/deductions.json:4-8`;
`public/content/cases/the-mayfair-seance/clues.json:15-31`;
`public/content/cases/the-lamplighters-wake/deductions.json:4-8`;
`public/content/cases/the-lamplighters-wake/clues.json:3-12`). Step 1 precedes the edge test, so those
recipes correctly win regardless of their connecting edge authorship
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:107-121`). Searches of all
`hasDeduction`/`requiresDeduction` uses found only the seven authored recipe IDs; generic IDs gate nothing
(`src/engine/conditions.ts:58-60`; `src/engine/conditions.ts:163-175`).

## B. New ranked findings

### N1 - Blocker: the "prior" snapshot is taken after connection has already destroyed it

The existing connection path unconditionally changes both endpoints to `connected`
(`src/components/EvidenceBoard/EvidenceBoard.tsx:141-158`). V3 does not replace that behavior; it snapshots
the live statuses only when Attempt is pressed
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:157-165`). Therefore a `new`,
`examined`, `deduced`, or `spent` endpoint is already `connected` before `prior` is captured. On a failed
attempt, v3 removes the edges and later "restores" `connected`, leaving edge-less connected badges and
permanently losing the real prior state (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:180-188`).
On a correct recipe, extras have the same orphaned status. A `spent` winner is independently downgraded by
the unconditional `winners.forEach(... 'deduced')` at spec line 173.

This means the stated N5 integration test cannot pass through the real click path, and the prior
progression-corruption defect remains.

**Fix:** Do not persistently overwrite clue status when adding an edge. Derive the connected ring/badge
from membership in `connections` and leave the underlying clue status intact until resolution. Then use
the untouched live status as `prior`, preserve `spent` winners, and test real card clicks followed by
success/failure and edge removal. If `connected` must remain a stored status, persist a separate
pre-connection status per clue across board close/save; a board-local ref is insufficient.

### N2 - Major: one component-local counter cannot safely own all revert timers

`attemptTokenRef` is one global counter for the board instance, incremented for every attempt
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:154-163`). If component A fails and
then disjoint component B is attempted within two seconds, B increments the counter. A's timer sees a
token mismatch and returns, leaving A contested forever, even though B never "owns" A
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:184-188`).

The counter also dies with the board. `App` conditionally unmounts `EvidenceBoard` on close
(`src/App.tsx:361-365`), while the spec gives the timeouts no cleanup. After close/reopen, a new board has
a new ref; an old timer can still revert a clue participating in a newer attempt because its old ref can
never observe that attempt.

**Fix:** Track attempt ownership per clue in state with a generation/token that survives board remounts.
Each timer should restore only IDs whose current owner is its token, allowing disjoint timers to complete
independently. Track and cancel timeout handles on unmount (restoring or invalidating their ownership).
Add tests for two disjoint failed attempts and for close/reopen/retry before the first timer fires.

### N3 - Major: the seed can point at a component that was already removed

The only seed rule is
`lastConnectedIdRef.current ?? connections.at(-1)?.toId`
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:157-160`), but the spec never defines
where that ref is set, validated, or cleared. Even if the obvious update is added to the current connection
handler (`src/components/EvidenceBoard/EvidenceBoard.tsx:141-158`), the successful/failed path removes that
component while leaving the ref unchanged
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:179-188`).

With components C-D and A-B present, attempting the most recently connected A-B removes only A-B. The
button remains for C-D, but the next press seeds from stale B; flood-fill returns fewer than two IDs and
reports `incorrect` instead of processing C-D. The non-null stale ref prevents the fallback from running.

**Fix:** Record an explicit last-added edge, require the chosen seed to occur in a current edge, and clear
or reseed it after component removal. Add an integration test that forms/fails one component and then
attempts an already-existing independent component without adding another edge.

### N4 - Major: authored generic red-herring edges receive contradictory green feedback

Step 2 labels every all-authored generic component `correct`
(`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:115-121`), but the generic builder
marks any component containing a `redHerring` clue as questionable (`src/engine/buildDeduction.ts:15-27`).
This is reachable in shipped content. `cc-clue-quack-tonic` is a red herring with authored links to both
Sloane's debts and the death dates (`public/content/cases/the-comet-club/clues.json:48-54`), while all three
together are the explicitly false poisoner recipe
(`public/content/cases/the-comet-club/deductions.json:25-29`). Connecting tonic to either one first produces
a green "The connection holds" generic deduction that the Journal labels questionable; adding the third
clue later changes the same theory to amber `false`. Whitechapel also authors a relationship between its
two red-herring clues (`public/content/cases/the-whitechapel-cipher/clues.json:60-65`;
`public/content/cases/the-whitechapel-cipher/clues.json:138-146`).

**Fix:** Define generic false formation too: when every edge is authored but the component contains a
red-herring clue, return/form `false` with `recipe: null` (or derive the false tone from the built
deduction). Test both shipped examples so board feedback and Journal metadata agree.

### N5 - Major: random generic IDs permit unlimited duplicate deductions

Every authored two-clue edge now succeeds deterministically and is removed after formation. All clue
statuses remain connectable by scope (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:284-290`),
so the player can reconnect the same pair immediately. `buildDeduction` gives each repetition a new
time/random ID (`src/engine/buildDeduction.ts:23-28`), and `addDeduction` stores every unique ID
(`src/store/slices/evidenceSlice.ts:47-50`). The Journal renders every stored value
(`src/components/CaseJournal/CaseJournal.tsx:80-81`; `src/components/CaseJournal/CaseJournal.tsx:164-174`),
so one authored pair can inflate the journal and board count without bound.

This is not merely the deferred lack of an attempt cost; it is missing identity/idempotency for the same
formed deduction.

**Fix:** Give generic deductions a canonical stable ID derived from a sorted edge signature (or explicitly
detect an existing equivalent deduction) so repeating the same topology is an idempotent upsert. Add a
same-pair-twice integration test that keeps the deduction count at one.

### N6 - Minor: corpus fact 3 miscounts recipes

The spec says "2 of 4 main-case recipes" (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:42-44`),
but there are seven recipes across four main cases: four in The Comet Club alone
(`public/content/cases/the-comet-club/deductions.json:2-30`) and one in each other main case. The actual
verified statement is "2 of 7 recipes, across 2 of 4 main cases." The topology rationale remains valid,
but the load-bearing corpus fact should be corrected.

## C. Verdict

**revise again**
