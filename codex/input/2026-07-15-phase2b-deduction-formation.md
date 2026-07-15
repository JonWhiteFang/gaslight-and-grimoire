# Codex review — Phase 2b spec: deduction formation model (enacts ADR-0012)

**You are an adversarial cross-provider reviewer.** You have **no** memory of prior conversation; this
prompt is fully self-contained. Read the grounding files, then review the target spec.

**Write your review to:** `codex/output/2026-07-15-phase2b-deduction-formation-review.md`
(read-only sandbox is fine — reason from the code; do not modify anything).

---

## The project (context)

Gaslight & Grimoire is a browser choose-your-own-adventure game (React 19, Zustand+Immer, TypeScript,
Vitest). On its **Evidence Board**, the player connects clues (click/tap to select two → a connection is
stored as an `{fromId, toId}` pair) and presses **Attempt Deduction**, which today rolls a Reason d20 vs
DC 14; on `success`/`critical` it forms a deduction, else the clues go `contested`.

Phase 2a (already shipped, PR #82) improved *legibility* only — it did **not** change formation. **Phase
2b (this spec) is the real rework:** it enacts **ADR-0012** — *correctness gates formation; the roll only
flavours it* — and fixes the pre-existing board-plumbing defects that three earlier Codex spec-review
rounds surfaced.

## The goal (what "correct" means here)

- A connected clue-set whose **correctness** qualifies it **always** forms its deduction, **regardless of
  roll tier** (even a `failure` roll).
- A non-qualifying set **never** forms one, **regardless of roll tier** (even a `critical`).
- The d20 roll is retained but narrowed to **flavour** (a `critical` reads as a sharper insight).

## Target of review

- **Spec:** `docs/superpowers/specs/2026-07-15-phase2b-deduction-formation-design.md` (the document under
  review — read it in full).

## Ground every claim against these files (read them — the spec makes verifiable claims about them)

- `docs/DECISIONS/ADR-0012-deduction-roll-semantics.md` — the decision being enacted (esp. its
  **Confirmation** section; check the spec's test actually satisfies it, and that the spec follows chosen
  **Alternative A** — keep the d20 for flavour — not the rejected B).
- `docs/superpowers/specs/2026-07-14-phase2-deduction-feedback-design.md` — **Part B** is the prior
  analysis this spec builds on (defects N1–N5 + a latent revert bug). Check the spec resolves them.
- `src/components/EvidenceBoard/EvidenceBoard.tsx` — the board; `handleInitiateConnection` (writes
  `'connected'` status at ~line 194-195), `handleDeductionResult`, connection/banner state.
- `src/components/EvidenceBoard/DeductionButton.tsx` — current roll + formation + status writes.
- `src/components/EvidenceBoard/ClueCard.tsx` — renders clue status (status classes + 🔗 badge).
- `src/engine/buildDeduction.ts` — `buildDeduction` (generic, currently `Date.now()+Math.random()` id),
  `matchDeduction` (recipe subset-match), `buildDeductionFromRecipe`.
- `src/store/slices/evidenceSlice.ts` — `clues`, `connections`, `deductions`, `updateClueStatus`,
  `addConnection`, `clearConnections`, `addDeduction`.
- `src/types/index.ts` — `Clue` (`connectsTo?`, `tags`, `status`, `type`), `ClueStatus` (incl.
  `'connected'`), `ClueType` (incl. `'redHerring'`), `Deduction`, `KeyDeduction` (`requiredClues`,
  `isRedHerring`), `OutcomeTier`.
- `src/engine/saveManager.ts` — `CURRENT_SAVE_VERSION` (currently **4**) + the `migrate()` chain (the spec
  adds a v4→v5 step).
- The shipped content the oracle must satisfy:
  - `public/content/cases/*/deductions.json` (7 recipes total across the 4 main cases).
  - `public/content/side-cases/*/` — the **4 vignettes ship NO `deductions.json`** (generic path is their
    only oracle). Verify this.
  - `public/content/*/*/clues.json` — `connectsTo` edges, `redHerring` clue types, clue-id charset.

## Corpus claims the spec depends on — verify each independently

1. **7 recipes across 4 main cases; 4 vignettes ship none.** (If false, the generic-path-is-only-oracle
   claim collapses.)
2. **2 of the 7 recipes are NOT `connectsTo`-connected among their `requiredClues`**
   (`lw-deduction-croke-court-murder`, `ms-deduction-fraud-and-breach`). The spec uses this to justify
   matching recipes against **player topology**, never `connectsTo`. **Verify it** — build the undirected
   `connectsTo` adjacency over each recipe's `requiredClues` and check connectivity. If the spec is wrong
   here, its central architectural choice is unjustified — that's a Blocker.
3. **Clue ids match `^[a-z0-9-]+$`** (no `+`), so the generic id `deduction-generic-<ids.sort().join('+')>`
   cannot collide. Check for any counterexample.
4. **`'connected'` clue status is written in exactly one place** and no engine/gate logic reads
   `clue.status === 'connected'` (so making it derived is safe). Grep and confirm.

## Adversarial charge

**Assume the spec contains at least one real defect and find it.** Prioritise:

- **Oracle correctness holes.** Does per-component classification actually enact ADR-0012 for every shipped
  recipe? Can a `correct` set fail to form, or a non-qualifying set form? Does the deterministic winner rule
  (non-red-herring → largest `requiredClues` → lowest id) ever pick wrong or tie ambiguously? What about a
  component matching **two** recipes, or a recipe's `requiredClues` split across two player components?
- **Topology soundness.** Is "recipe matches a single player-connected component" right for all 7 recipes?
  Does the generic all/some/none `connectsTo` classification behave correctly with the corpus's one-way
  edges (undirected handling)? Any component where the player-edge vs authored-edge counting misclassifies?
- **Determinism / collision hazards.** The generic id signature; the winner selection; any reliance on
  object key order or `Date.now()`/`Math.random()`.
- **Status-lifecycle / migration gaps.** Does deriving `'connected'` break any reader? Is the v4→v5
  migration complete and idempotent? Does the "revert to prior status via attempt-scoped snapshot" actually
  fix the latent bug (Part B: `clearConnections()` empties `idsRef` before the timer fires), or reintroduce
  it? Multi-component attempts: does clearing one component's connections corrupt another's snapshot?
- **ADR-0012 fidelity.** Does the Confirmation test as specified (recipe component forms on `failure`;
  non-qualifying forms nothing on `critical`) truly prove enactment? Is anything in the spec still
  roll-gating formation?
- **Divergence from the four resolved design decisions** (spec's "Design decisions resolved" section):
  derive-not-snapshot, partial-forms-nothing, per-component, red-herring-forms-uneasy. Any place the design
  text contradicts these?

## Output format

For each finding: **severity** (Blocker / Major / Minor / Nit), a one-line summary, the **file:line** or
spec section it grounds in, the concrete failure scenario (inputs → wrong outcome), and a suggested fix.
If you find no Blocker, say so explicitly and give your next-most-serious finding. End with a one-line
verdict: is the spec sound to proceed to an implementation plan?
