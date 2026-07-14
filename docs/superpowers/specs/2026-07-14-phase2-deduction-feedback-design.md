# Phase 2 — Deduction Feedback Legibility (design spec)

> **Type:** Implementation design spec. Feeds a Codex-gated implementation plan (writing-plans next).
> **Date:** 2026-07-14 · **Revised:** 2026-07-14 after a Codex spec review
> ([`codex/output/2026-07-14-phase2-deduction-feedback-review.md`](../../../codex/output/2026-07-14-phase2-deduction-feedback-review.md))
> found the original tag-overlap correctness model unsound against shipped content (3 Blockers). This
> version uses a **recipe-based** correctness oracle instead.
> **Track:** UI/UX roadmap Phase 2 ([`docs/research/ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md)),
> backlog items **6** (deduction feedback) + **2** (`connected` colour-only fix, rides along).
> **Enacts (with an amendment):** [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md).
> **Consumes:** the Phase 1 global announcer (`src/announcer.ts`, `announce()`), PR #80.

---

## Problem

On the Evidence Board, connecting ≥2 clues and pressing **Attempt Deduction** rolls a Reason check
(d20 vs DC 14). On `success`/`critical` it forms a deduction (recipe subset-match → a *key* deduction
under its stable id, else a *generic* one) and marks the clues `deduced`; on
`partial`/`failure`/`fumble` it marks them `contested`, reverting to `examined` after 2 s.

Two problems (UI/UX research finding D3):

1. **The roll gatekeeps whether reasoning pays off.** A correct set can fail on an unlucky roll; a wrong
   set can pass on a lucky one. Players can't tell a reasoning error from bad luck.
2. **Failure is binary and undirected.** Every non-success is a flat "contested" — no hint the player was
   *close* (Golden-Idol-style directional feedback is absent).

ADR-0012 decided the principle — **correctness gates formation; the roll only flavours** — but deferred
to this spec (1) what "correct" means for a non-recipe connection and (2) the tier→feedback mapping.

## What the Codex spec review changed (why this is a recipe-based model)

The first draft made **tag-overlap** the generic-correctness oracle. The Codex review proved that unsound
against shipped content, and verification confirmed every point:

- **`connectsTo` (not tags) is the authored clue-relationship field** (`src/types/index.ts:76`). Tags do
  not track it. The Rationalist's Dilemma clues `rd-clue-experiment-log` ↔ `rd-clue-anomalous-readings`
  are authored `connectsTo` partners with **zero shared tags**; The Whitechapel Cipher's
  `wc-clue-cipher-note` + `wc-clue-cellar-ledger` share only the broad tag `paper` but are **not**
  authored partners. Tag-overlap both misses real relationships and invents false ones. **(Blocker B1.)**
- **A shipped recipe is authored *false*.** `cc-deduction-poisoner` is `isRedHerring: true` ("Coherent,
  confident, and wrong") **and** gates a real branch (`the-comet-club/act3.json:24`,
  `requiresDeduction`). "Every recipe is correct" was wrong; but making it `incorrect` would orphan that
  branch. **(Blocker B2.)**
- **`clearConnections()` runs on every outcome**, emptying `connectedIds` so `DeductionButton` unmounts —
  the original design put the outcome message *in the button*, so it would vanish instantly and isolated
  tests would false-green. **(Blocker B3.)**

**Resolution:** correctness is now defined entirely by the **authored recipes**, and the transient
outcome UI moves **out of the button into the board** (which owns connection lifecycle).

## Decisions

1. **Recipe-based correctness oracle** (replaces tag-overlap). A connected set is classified by its
   relationship to the case's authored `KeyDeduction` recipes only. **Generic (non-recipe) connections no
   longer form a deduction** — they are directional feedback only.
2. **Three correctness states:** `correct` / `partial` / `incorrect`.
3. **Red-herring recipes still form**, but are **framed as a false/uneasy insight** (amber, not the green
   "connection holds") — keeping their gated branches reachable while signalling the trap.
4. **The d20 roll flavours a `correct`/`false` formation only** (crit → a sharper line). `partial` and
   `incorrect` are deterministic and roll nothing. **This requires a one-line amendment to ADR-0012**
   (see below), because the recipe model makes partial feedback deterministic rather than roll-driven.
5. **No anti-spam cost** in Phase 2 (deferred — own decision).

## Approach (A — engine-owned classification, thin UI)

A pure engine function owns correctness; the **board** renders + announces the transient outcome and owns
connection lifecycle; the **button** only triggers. Rejected alternatives unchanged from the prior draft
(fold-into-buildDeduction muddies its purpose; roll-as-co-driver re-muddies reasoning-vs-luck).

---

## Component 1 — `src/engine/classifyConnection.ts` (new, pure)

```ts
export type Correctness = 'correct' | 'false' | 'partial' | 'incorrect';

export interface ConnectionClassification {
  correctness: Correctness;
  recipe: KeyDeduction | null; // the matched recipe (correct|false), else null
}

export function classifyConnection(
  connectedIds: string[],
  clues: Record<string, Clue>,
  recipes: KeyDeduction[],
): ConnectionClassification;
```

**Fail-closed guard first (Codex Major — unresolved/duplicate ids):** let `valid` be the set of
`connectedIds` that (a) are distinct and (b) are an **own property** of `clues`
(`Object.prototype.hasOwnProperty.call`, matching the repo's existing `ownValue` guard for prototype
keys). If `valid.size < 2` → `{ correctness: 'incorrect', recipe: null }` before anything else.

**Recipe classification** (over `valid`, using `matchDeduction`'s subset semantics but resolved
deterministically — Codex Major on ordering/multi-match):

1. **Full matches** = every recipe whose `requiredClues` are **all** in `valid`.
   - If any full match exists, pick the winner deterministically: **non-red-herring recipes first**, then
     **largest `requiredClues` count** (most specific), then **lowest `id` lexicographically** (stable
     tiebreak independent of content-array order).
   - Winner `isRedHerring === false` → `{ correctness: 'correct', recipe: winner }`.
   - Winner `isRedHerring === true` → `{ correctness: 'false', recipe: winner }`.
     *(A `false` classification still **forms** the deduction — it's a qualifying set — but is framed as a
     trap. The non-red-herring-first ordering means a true recipe always wins over a red-herring superset
     that shares clues, e.g. `cc-deduction-one-true-murder` beats `cc-deduction-poisoner` on a set
     containing both, since they share `cc-clue-sloane-debts`.)*
2. **Partial matches** = no full match, but some recipe has **≥1 but not all** of its `requiredClues` in
   `valid`, **and** `valid` contains **no clue whose `type === 'redHerring'`** that isn't part of that
   recipe. Simplest sound rule: `partial` iff (∃ recipe with `1 ≤ |req ∩ valid| < |req|`). → `{ partial,
   null }`. *(Directional "you're on a thread but it's incomplete" — grounded in authored truth, not
   tags.)*
3. **`incorrect`** = otherwise (no recipe shares any clue with `valid`). → `{ incorrect, null }`.

**Purity:** no store, no `performCheck`, no `Date.now()`/`Math.random()`. This is the function ADR-0012's
*Confirmation* clause targets. **Note:** because formation is now purely a function of the connected set
vs. recipes, the "forms regardless of roll" property holds by construction (the classifier never sees a
roll) — the test asserts it explicitly anyway.

---

## Component 2 — `src/components/EvidenceBoard/DeductionButton.tsx` (rewrite)

The button becomes a **trigger only**. It no longer owns the outcome message, the `success/failure`
phase colouring, or the `contested`→`examined` revert timer (all move to the board — fixes B3).

```
handleAttempt():
  if busy: return
  classification = classifyConnection(connectedClueIds, clues, recipes)
  onAttempt(classification)   // hand the whole classification to the board
```

- **`onResult(result: 'success' | 'failure')`** is replaced by
  **`onAttempt(classification: ConnectionClassification)`**.
- The button keeps only a minimal disabled/label state driven by props from the board (e.g. a board-owned
  `attemptPhase`), **not** its own outcome state. No local `<p>` message, no `AnimatePresence` tier label.
- **Accessible label** becomes neutral — "Attempt Deduction — connect these clues" — dropping "perform a
  Reason check" (Codex Minor: the roll no longer happens on most paths). The transient **"Rolling…"**
  label is **removed** (Codex Minor: `performCheck` is synchronous, so it never renders — a batched no-op).
- `connectedClueIds.length < 2` → render null (unchanged).

**Where the roll happens:** on a `correct`/`false` classification the **board** (Component 3) calls
`performCheck('reason', investigator, 14, false, false)` **once**, purely to pick a flavour word from
`tier === 'critical'`. `partial`/`incorrect` roll nothing.

---

## Component 3 — `src/components/EvidenceBoard/EvidenceBoard.tsx` (owns outcome lifecycle)

Replace `handleDeductionResult(result)` with `handleDeductionAttempt(classification)` that owns
everything the button used to, so the message survives `clearConnections()` (B3):

```
handleDeductionAttempt(classification):
  attemptedIds = [...connectedIds]                 // snapshot BEFORE clearing (B3 race fix)
  switch classification.correctness:
    case 'correct':
    case 'false':
      roll = performCheck('reason', investigator, 14, false, false)   // FLAVOUR ONLY
      recipe = classification.recipe                                  // non-null here
      deduction = buildDeductionFromRecipe(recipe, attemptedIds)      // stores under stable id
      addDeduction(deduction)
      recipe.requiredClues.forEach(id => updateClueStatus(id, 'deduced'))   // only the recipe clues…
      extras = attemptedIds.filter(id => !recipe.requiredClues.includes(id))
      extras.forEach(id => updateClueStatus(id, 'examined'))          // …extras revert (Codex Major: no noise-inflation)
      flavour = roll.tier === 'critical' ? 'sharp' : 'plain'
      key = classification.correctness === 'false' ? 'false' : `correct-${flavour}`
      showOutcomeBanner(MESSAGE[key], tone[classification.correctness])  // board-owned transient, NOT the button
      announce(MESSAGE[key])
      clearConnections()                                             // safe now — banner is board state
      // success threads handled as today
    case 'partial':
    case 'incorrect':
      attemptedIds.forEach(id => updateClueStatus(id, 'contested'))
      showOutcomeBanner(MESSAGE[classification.correctness], tone[classification.correctness])
      announce(MESSAGE[classification.correctness])
      setSlackConnections(...); clearConnections(); setTimeout(clear slack, 1400)   // existing failure anim
      setTimeout(() => attemptedIds.forEach(id =>
        (clues[id]?.status === 'contested') && updateClueStatus(id, 'examined')), 2000)  // revert, guarded
```

**Outcome banner:** a small board-owned transient region near the Attempt button (a `<p>`/`<div>` that
lives in `EvidenceBoard`, which does **not** unmount when connections clear). It is **visual-only** (no
`aria-live`) — the single screen-reader announcement is `announce()` (Codex/roadmap: exactly one SR
announcement; no double-speak). Three-way `tone` colour: green (`correct`) / amber (`false` **and**
`partial`) / red (`incorrect`). Auto-clears after a short delay (align with the existing 2 s revert).

**Revert race fix (B3):** the timeout reverts `attemptedIds` (a captured snapshot), and only clues **still
`contested`** (guard), so a clue re-connected during the window isn't yanked back to `examined`.

**Message copy** (measured, atmospheric, short *status* strings — never narrative, never campy):

| key | correctness | roll | message |
|---|---|---|---|
| `correct-sharp` | `correct` | `critical` | `The connection holds — a sharp, decisive insight.` |
| `correct-plain` | `correct` | other | `The connection holds.` |
| `false` | `false` | any | `A connection forms — coherent, but something about it feels wrong.` |
| `partial` | `partial` | — | `Some of these belong together, but the link isn't complete.` |
| `incorrect` | `incorrect` | — | `These clues don't connect.` |

**Clue status:** `partial` and `incorrect` both reuse the existing `contested` state (❓ + red ring + 2 s
revert). **No new `ClueStatus`, no save migration.**

---

## Component 4 — `src/components/EvidenceBoard/ClueCard.tsx` (backlog item 2, colour-only fix)

The `connected` state is signalled by a yellow ring **alone** (WCAG SC 1.4.1 gap). Add a redundant cue:

- `StatusIndicator` gains a `connected` case → a `🔗` badge in the same top-right slot as
  NEW / 📌 / ❓ / ✓, with `aria-label="Connected"`.
- Update the doc-comment header's six-state list to note the 🔗 badge.

No logic change; the card-root `aria-label` already includes `status: connected`.

---

## ADR-0012 amendment (required before promoting to Enacted)

ADR-0012's Decision says the roll "drives the Phase 2 partial-tier *directional* feedback." Under the
recipe-based model, **partial feedback is deterministic** (some-but-not-all of a recipe), not roll-driven.
Amend ADR-0012 with a dated **Amendment** note (its Decision body is frozen per MADR immutability, so add
a note, don't rewrite): *"Phase 2 (2026-07-14) implements this with a recipe-based correctness oracle;
generic tag-based correctness was rejected as unsound against shipped content. Consequently the roll
flavours a **successful/false formation** only — partial/incorrect are deterministic and roll nothing.
This narrows, and does not contradict, the principle: correctness still gates, the roll still only
flavours."* Then promote status `Accepted → Enacted` and fill Commits/PRs. Codex's point that the literal
"non-qualifying set + critical roll" confirmation can't run is **correct and accepted**: the classifier is
roll-free, so the Confirmation test asserts formation is a pure function of set-vs-recipes (recipe set →
`correct`/`false` and forms; non-recipe set → `partial`/`incorrect` and never forms), which is the
substance of the clause.

---

## Testing (TDD — RED first, watch fail, then GREEN)

**`src/engine/__tests__/classifyConnection.test.ts`** (ADR-0012 Confirmation lives here):
- full non-herring recipe subset (incl. with extra clues) → `correct`, `recipe` = that recipe.
- full **red-herring** recipe (`cc-deduction-poisoner`) → `false`, `recipe` set (still forms).
- a set matching **both** a true and a red-herring recipe (shared `cc-clue-sloane-debts`) → `correct` with
  the **true** recipe (non-herring-first ordering).
- some-but-not-all of a recipe → `partial`; no recipe overlap → `incorrect`.
- **fail-closed:** `<2` distinct valid ids, an id absent from `clues`, duplicate ids, a prototype key
  (`toString`) → never `correct`/`false`.
- formation is roll-independent by construction (pure fn — assert explicitly).

**`src/engine/__tests__/classifyConnection.property.test.ts`** (fast-check): any superset of some
non-red-herring recipe's `requiredClues` (with no higher-priority match) classifies `correct`.

**`DeductionButton` test:** calls `onAttempt` with the classification; renders null below 2 clues; neutral
label; no local outcome message.

**`EvidenceBoard` integration test (Codex B3 — the critical one):**
- after a `correct` attempt, the **board banner** shows the success message **even though
  `clearConnections()` ran** (the button has unmounted); `addDeduction` called; only the recipe's clues are
  `deduced`, extras reverted to `examined`.
- a **second** deduction in the same board session works (no stuck "Deduction Locked").
- a `partial`/`incorrect` attempt shows the directional banner, marks `contested`, reverts after 2 s; a
  clue re-connected during the window is **not** reverted.
- `false` (red-herring recipe) forms the stable deduction and shows the amber uneasy message.

**`ClueCard` test:** `connected` renders the 🔗 badge.

Baseline **635/60**; expect ~12–16 new tests.

## Docs & ADR (in the Phase 2 PR)

- ADR-0012: add the Amendment note; promote `Accepted → Enacted`; fill Commits/PRs.
- `docs/engine-reference.md`: add `classifyConnection` (signature + recipe-based rules).
- `CLAUDE.md`: update the `DeductionButton` architectural note — correctness (recipe-based) gates; the
  board owns the outcome lifecycle; the roll flavours a formed deduction only.
- `docs/status.md`: bump the test baseline. Post-merge: tick roadmap Phase 2; update `ui-ux-improvements.md`
  rows for items 6 and 2.

## Scope boundaries (YAGNI)

- **No** tag-based correctness (rejected as unsound); **no** `connectsTo`-graph oracle (recipe model
  suffices for Phase 2).
- **No** generic (non-recipe) deduction formation any more (behaviour change; nothing gates on generic
  deductions — verified: only recipe ids appear in `hasDeduction`/`requiresDeduction`).
- **No** anti-spam / composure cost; **no** new `ClueStatus`; **no** save migration.
- **No** dice-legibility DC/modifier surfacing (Phase 3); **no** contrast/reduced-motion sweeps (Phase 4).

## Cross-provider Codex review (file-based)

Per CLAUDE.md's file-based handoff: this **spec** (revised here after round 1), the **plan** (next), and
the **completed implementation** each get an independent Codex pass. Reviews land in `codex/output/`.
