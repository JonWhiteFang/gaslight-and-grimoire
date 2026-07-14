# Codex re-review (round 3) — Phase 2 deduction-feedback SPEC (v3)

## Operating rules (read first)

- You have **no memory** of rounds 1–2. Everything is in this file or the repo files it names. Read-only sandbox.
- **Make no repository changes except writing exactly one file:** your review to
  `codex/output/2026-07-14-phase2-deduction-feedback-round3-review.md`. Nothing else.
- This is **round 3** of a SPEC review. Rounds 1 and 2 each returned "revise" after finding real Blockers,
  and the model was **redesigned twice**. v3 is a new model no prior round has seen. Your job: attack the
  **v3-specific** design for real defects, and confirm the prior Blockers stay fixed. Do not soften because
  it's round 3 — if there is a real defect, name it.

## The charge

**Assume v3 still contains at least one real defect and find it.** Ground every claim in actual repo code
(`file:line`). Rank findings (Blocker / Major / Minor / Nit). End with a one-line verdict:
**sound to plan** / **revise again**.

## The v3 model (what changed, and why)

Two prior oracles were rejected: **tag-overlap** (round 1 — tags aren't the authored relationship) and
**recipe-only** (round 2 — no topology on the flattened id-union [N1]; deduction impossible in the 4
vignettes that ship no recipes [N3]; `partial` became a recipe-membership farm [N4]; status revert was
stale/destructive [N2/N5]).

**v3 classifies over the PLAYER'S connection topology (their `connections` edge pairs as an undirected
graph), never the flattened union, with two layers:**

- **Per-attempt scope = one connected component.** The board resolves the connected component containing
  the just-added edge (a seed clue) and classifies only that; other components are untouched.
- **Recipe layer:** a recipe matches iff **all** its `requiredClues` lie in that one player-connected
  component. Winner ordering: non-red-herring first → largest requiredClues → lowest id. Non-herring →
  `correct`; red-herring recipe → `false` (still forms under its stable id, framed uneasy/amber).
- **Generic layer (no recipe match; covers all vignettes):** for the component's player-edges, an edge
  `(a,b)` is "authored" iff `b ∈ clues[a].connectsTo` OR `a ∈ clues[b].connectsTo` (undirected). All edges
  authored → `correct` (forms a generic deduction); some authored → `partial`; none → `incorrect`.
- **Fail-closed:** component built only from ids that are own-properties of `clues`; `< 2` distinct →
  `incorrect`.
- **Lifecycle (board, not button):** read **live** `useStore.getState()` at attempt time; snapshot each
  component clue's PRIOR status; on success mark only winners `deduced` and RESTORE extras to prior status
  (never downgrade `deduced`/`spent`); on partial/incorrect set `contested` (skip already deduced/spent)
  then revert to prior after 2s, guarded by a per-attempt token; remove only THIS component's edges via a
  new `removeConnections` action. Banner is board-owned + visual-only; one `announce()`.
- **Roll:** flavours a formed (`correct`/`false`) deduction only; partial/incorrect roll nothing. ADR-0012
  gets a dated amendment (partial is deterministic; roll flavours formation).

## Corpus facts v3 asserts (verify these — they are load-bearing)

1. `connectsTo` exists on `Clue` (`src/types/index.ts:76`); across the corpus it has **no dangling edges**
   and **~25 one-way edges** (hence undirected). Confirm, and confirm treating it undirected is safe.
2. **Vignettes ship no recipes** — `VignetteData` (`src/types/index.ts` ~293-316) has no `recipes`;
   `vignetteToCaseData` (`src/store/slices/narrativeSlice.ts:11-19`) adds none; no side-case
   `deductions.json`. So the generic `connectsTo` layer is the ONLY oracle for vignettes.
3. **2 of 4 main-case recipes' requiredClues are NOT a connected `connectsTo` component** (e.g.
   `ms-deduction-fraud-and-breach`, `lw-deduction-croke-court-murder`). This is why recipes match the
   PLAYER's edges, not the connectsTo graph. Verify these two really aren't connectsTo-connected.
4. All `hasDeduction`/`requiresDeduction` targets are the 7 authored recipe ids; `deductionist`/
   `wc-deductionist-pattern`/`lw-deductionist-timeline` are archetype/`setFlag` targets, not deductions.
   So generic deductions gate nothing (safe to form freely).

## Attack surface specific to v3 (non-exhaustive — find others)

- **Component resolution / seed:** the board picks a "seed" (last-connected clue) and flood-fills. Is the
  seed reliably available at attempt time? `EvidenceBoard` stores connections as pairs
  (`src/store/slices/evidenceSlice.ts:52-59`); `connectingFrom` is cleared after each connection
  (`EvidenceBoard.tsx:141-158`). Is there a robust last-added-edge signal, or can the seed be stale/wrong,
  classifying the wrong component? What if the board has ONE component spanning all connected clues — does
  "scope = one component" still limit blast radius?
- **Generic `correct` is very reachable:** any single authored `connectsTo` pair the player connects →
  `correct` → forms a generic deduction immediately. Is that desired (vignettes need it) or does it trivial­
  ise deduction in main cases (connect any two authored-related clues → instant deduction + `deduced`
  status)? Does it interact badly with recipe gating (a generic deduction has a random id — does anything,
  e.g. `requiresDeduction`, ever need a *generic* one)?
- **Recipe requiredClues not connectsTo-connected (fact 3) vs. the player forming them:** to satisfy a
  recipe the player must connect its requiredClues into ONE component. But if those clues have few/no
  authored `connectsTo` links between them, the player must draw edges that the generic layer would call
  non-authored. Does the recipe layer correctly take precedence REGARDLESS of whether those edges are
  authored? (Recipe check is step 1, before the generic edge test — confirm the spec ordering actually
  yields `correct`/`false` and never falls through to `partial` for a satisfied recipe.)
- **Partial reachability / farming (round-2 N4 regression check):** with the new per-edge authored rule,
  can a player still cheaply enumerate anything? Is `partial` now meaningful (a real authored link plus a
  wrong one) rather than membership? Consider a 2-clue component: it can only be `correct` or `incorrect`
  (one edge) — never `partial`. Is that intended? Where does `partial` first become reachable (3+ clues)?
- **Status snapshot/restore (round-2 N2/N5 regression check):** does reading `useStore.getState()` +
  per-attempt token + restore-to-prior actually close the stale-snapshot and overlapping-timer races?
  Any path where `prior` is captured AFTER a mutation, or where two components share a clue? Can a clue be
  in two simultaneous attempts?
- **`removeConnections` new action:** removing only the component's edges — does that leave the store
  consistent (no orphaned `connected`-status clues that are now edge-less)? Should an edge-less
  still-`connected` clue revert? The spec restores extras to prior status but what about a clue that was
  `connected` ONLY via a removed edge and isn't a winner?
- **ADR-0012 confirmation honesty:** the spec says the classifier is roll-free so the ADR's literal
  "non-qualifying + critical never forms" runs as a board integration test stubbing failure vs critical.
  Is that a faithful substitute or a dodge? (`docs/DECISIONS/ADR-0012-deduction-roll-semantics.md:76-84`.)
- **Determinism:** generic `buildDeduction` uses `Date.now()`/`Math.random()` for its id
  (`src/engine/buildDeduction.ts:11-28`) and v3 now uses it on the generic-correct path. Is that acceptable
  (ids aren't gated on) or a determinism/save concern?

## Files to ground against

`docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md` (v3 — read fully);
`src/engine/buildDeduction.ts`; `src/engine/conditions.ts` (ownValue, line 29);
`src/components/EvidenceBoard/{DeductionButton,EvidenceBoard,ClueCard,ProgressSummary}.tsx`;
`src/store/slices/evidenceSlice.ts`; `src/store/slices/narrativeSlice.ts`; `src/store/index.ts`;
`src/announcer.ts`; `src/types/index.ts`; `docs/DECISIONS/ADR-0012-deduction-roll-semantics.md`;
`public/content/cases/*/{deductions.json,clues.json}`; `public/content/side-cases/*/clues.json`;
`public/content/manifest.json`.

## Output

Write to `codex/output/2026-07-14-phase2-deduction-feedback-round3-review.md`: (A) a short confirmation
that the round-1/2 Blockers (tag oracle, red-herring recipe gating, button-unmount, N1 topology, N3
vignettes, N4 partial-farm, N2/N5 status) stay fixed in v3; (B) any **new** ranked findings with grounding
and a concrete fix; (C) one-line verdict.
