# Phase 2 deduction-feedback spec re-review (round 2)

## A. Round-1 resolution audit

| # | Round-1 finding | Status | Verification |
|---|---|---|---|
| 1 | B1: tag oracle unsound | **Resolved** | The classifier contract and all three result rules use clue IDs, own-property membership, and `KeyDeduction.requiredClues`; tags do not enter the oracle (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:74-119`). The board still uses tags only for optional visual brightening (`src/components/EvidenceBoard/EvidenceBoard.tsx:171-178`), not correctness. The recipe oracle has different coverage defects, reported below, but the tag problem itself is gone. |
| 2 | B2: red-herring recipe must keep its stable gated ID | **Resolved** | `cc-deduction-poisoner` remains authored as red-herring under that exact ID (`public/content/cases/the-comet-club/deductions.json:25-29`), and the Act 3 choice still requires it (`public/content/cases/the-comet-club/act3.json:22-30`). The `false` branch is specified to call `buildDeductionFromRecipe` and add the result (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:159-172`); that builder stores `recipe.id` and recipe clues unchanged (`src/engine/buildDeduction.ts:54-63`). The branch remains reachable. |
| 3 | B3: button unmount loses feedback / revert race / success lock | **Partially resolved** | Moving the banner and outcome lifecycle to the always-mounted board fixes message loss (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:150-190`). Making the button trigger-only removes its current permanent `success` disable (`src/components/EvidenceBoard/DeductionButton.tsx:79-103`), and the second-attempt integration test is explicit (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:255-261`). The timer guard is not sound in this store architecture, however: it closes over the rendered `clues` object while status writes produce new Immer objects (`src/components/EvidenceBoard/EvidenceBoard.tsx:27-34`; `src/store/index.ts:17-25`; `src/store/slices/evidenceSlice.ts:40-44`). The proposed callback at spec lines 180-181 can therefore keep seeing the pre-attempt `connected` status and never revert. A status-only guard also cannot distinguish an older attempt's `contested` state from a newer attempt's. See N2. |
| 4 | Major: roll contract versus ADR-0012 | **Partially resolved** | An amendment is the right mechanism, and the governing rule "correctness gates formation" is preserved. But the proposed note says the change "does not contradict" the frozen Decision even though that Decision explicitly says the retained roll drives partial-tier feedback (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:32-39`) and defers generic correctness rather than eliminating generic formation (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:41-44`). The amendment must explicitly supersede those details. More importantly, a classifier test cannot satisfy the ADR's formation-across-roll-tiers Confirmation (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:76-84`): classification does not form anything. The board integration test must mock at least `failure` and `critical` rolls and prove identical formation behavior before promotion to `Enacted`; the current test list does not require that (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:239-262`). |
| 5 | Major: subset noise and multi-match ordering | **Resolved** | Full matches are ordered by non-herring first, then descending requirement count, then ascending ID, so content-array order cannot decide the result (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:96-108`). The real combined Comet Club set fully matches both recipes because they share `cc-clue-sloane-debts` (`public/content/cases/the-comet-club/deductions.json:4-8`, `:25-29`); non-herring-first deterministically selects `cc-deduction-one-true-murder`, even though it is the smaller recipe. |
| 6 | Major: red-herring false partial | **Resolved** | A full red-herring recipe now has its own `false` result and still forms; partial comes only from some-but-not-all overlap with an authored recipe (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:99-114`). The prior tag-derived false partial is gone. The replacement partial rule is itself too broad and internally inconsistent, reported as N4. |
| 7 | Major: unresolved IDs fail open | **Resolved** | Unknown, inherited/prototype, and duplicate-only IDs cannot contribute to the two-ID minimum because `valid` is a distinct own-property set and is checked before matching (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:91-95`). This is necessary because save validation is deliberately shallow (`src/engine/saveManager.ts:52-78`) and restored connections are assigned directly (`src/store/slices/metaSlice.ts:113-124`). Tests should include mixed valid/invalid inputs to pin the intended sanitise-and-match behavior. |
| 8 | Minor: synchronous "Rolling..." state and roll-specific label | **Resolved** | The rewrite removes local rolling/tier UI and uses a neutral accessible label (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:123-146`), eliminating the current batched `setPhase('rolling')`/synchronous check and unreachable rendered transition (`src/components/EvidenceBoard/DeductionButton.tsx:41-46`, `:97-103`). |

The announcer side is sound: every `announce()` flips slots even for identical text (`src/announcer.ts:41-48`, `:51-64`), and `<LiveAnnouncer>` renders both slots as persistent nodes (`src/components/LiveAnnouncer/LiveAnnouncer.tsx:36-41`). Repeating the same wrong attempt will be announced again. The recipe formation path is also deterministic: `buildDeductionFromRecipe` contains no random/time ID generation (`src/engine/buildDeduction.ts:54-63`); the random generic builder at lines 11-28 is no longer on the specified formation path.

## B. New ranked findings

### N1 - Blocker: disconnected edges can combine into a recipe the player never connected

The board stores independent ID pairs (`src/store/slices/evidenceSlice.ts:52-59`) but flattens every pair into one global `connectedIds` union (`src/components/EvidenceBoard/EvidenceBoard.tsx:54-70`). The proposed classifier receives only that union, not the edges (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:74-88`), and declares a full match whenever all recipe IDs occur anywhere in it (`:96-104`).

For example, two disjoint edges `sash-weights <-> founder-death` and `sloane-debts <-> seating-chart` contain both requirements of `cc-deduction-one-true-murder` (`public/content/cases/the-comet-club/deductions.json:4-8`). The classifier returns `correct` even though the two recipe clues were never connected to one another and do not even share a graph component. The board then forms the deduction, clears both edges, and downgrades the other endpoints as extras (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:163-172`).

The classifier must receive connection topology, or the board must submit exactly one connected component and leave other components intact. Tests need disjoint-edge negative cases for two-, three-, and four-clue recipes.

### N2 - Major: the contested revert guard reads stale state and has no attempt identity

At attempt time, the board's `clues` variable is a render snapshot (`src/components/EvidenceBoard/EvidenceBoard.tsx:27-34`). `updateClueStatus` writes through Zustand's Immer middleware, producing replacement objects (`src/store/index.ts:17-25`; `src/store/slices/evidenceSlice.ts:40-44`). The timeout specified as `clues[id]?.status === 'contested'` (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:174-181`) therefore reads the old snapshot, commonly still `connected`, and leaves the newly stored `contested` state permanent.

Reading `useStore.getState()` at timeout time fixes staleness but not the full race. If attempt A fails, then the clue participates in failing attempt B before A's timer fires, A sees `contested` and reverts B early. Reverts need an attempt/version token per clue (or cancellation/replacement of older timers), plus unmount cleanup. The integration test must cover two overlapping failed attempts, not only reconnect-without-attempt.

### N3 - Major: the recipe-only oracle makes deduction impossible in all four vignettes

Recipes are optional for main cases (`src/engine/contentLoader.ts:87-97`), absent from `VignetteData`, and not added by `vignetteToCaseData` (`src/types/index.ts:293-316`; `src/store/slices/narrativeSlice.ts:11-19`). The manifest ships four vignettes (`public/content/manifest.json:28-67`), none with a deduction recipe. With an empty recipe list, every attempt reaches `incorrect` and generic formation is forbidden (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:55-63`, `:109-114`).

That is not merely an empty optional feature. Vignette clues author real relationships: for example, the experiment log and anomalous readings point to each other via `connectsTo` (`public/content/side-cases/the-rationalists-dilemma/clues.json:3-4`). The revised UI will tell the player "These clues don't connect" and can never add a deduction. Consequently the board's deduction count remains zero (`src/components/EvidenceBoard/EvidenceBoard.tsx:50-52`; `src/components/EvidenceBoard/ProgressSummary.tsx:12-28`) and the journal's deduction section remains empty (`src/components/CaseJournal/CaseJournal.tsx:80-82`, `:164-175`) throughout every vignette.

Either author vignette recipes, hide/disable the deduction action when no oracle exists, or define non-recipe relationship feedback. Verifying only that generic IDs do not gate content is insufficient.

### N4 - Major: one recipe clue plus arbitrary noise makes `partial` a recipe-membership oracle

The rule needs only one matching requirement (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:109-113`). Thus `cc-clue-sloane-debts` plus unrelated `cc-clue-founder-death` returns `partial`: the former belongs to two recipes while the latter belongs to none (`public/content/cases/the-comet-club/deductions.json:4-8`, `:25-29`; `public/content/cases/the-comet-club/clues.json:59-77`). With two attempted clues, no pair in the attempt necessarily "belong[s] together," contrary to the message at spec line 200.

Exhaustive two-clue enumeration of shipped content shows the scale:

| Case | `partial` pairs | All pairs |
|---|---:|---:|
| The Comet Club | 97 | 120 |
| The Lamplighter's Wake | 42 | 78 |
| The Mayfair Seance | 33 | 78 |
| The Whitechapel Cipher | 36 | 91 |

Because failed attempts have no cost (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:64`, `:277-283`), a player can pair each clue with arbitrary noise and identify recipe members one at a time. That is confirmation-farming, not evidence that the proposed link is close; the research explicitly left anti-spam and non-revealing directional feedback as design requirements (`docs/research/ui-ux-improvements.md:344-359`).

The rule is also internally contradictory: it first requires no unrelated `redHerring` clue, then calls the simpler existential rule the "`partial` iff" definition, omitting that requirement (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:109-113`). Define one executable predicate and test arbitrary-noise pairs. A meaningful partial threshold/relationship rule is needed before implementation.

### N5 - Major: outcome handling destroys pre-existing clue progression

Every clue card remains connectable regardless of status (`src/components/EvidenceBoard/ClueCard.tsx:118-139`), and connecting unconditionally changes both endpoints to `connected` (`src/components/EvidenceBoard/EvidenceBoard.tsx:141-158`). The revised success path then sets every non-winning extra to `examined`, while partial/incorrect eventually set every attempted clue to `examined` (`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md:163-181`).

A clue already marked `deduced` (or `spent`) can therefore lose that progression merely by being extra noise in a later correct attempt or by participating in a wrong attempt. The deduction record survives, but the clue's persisted status and visible badge do not. This conflicts with the store's existing intent to preserve clue progression across rediscovery (`src/store/slices/evidenceSlice.ts:29-37`). Snapshot and restore each clue's pre-connection status, changing only winning recipe clues to `deduced`; add tests with previously `deduced` and `spent` clues.

## C. Verdict

**revise again**
