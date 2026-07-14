# Phase 2 — Deduction Feedback Legibility (design spec)

> **Type:** Implementation design spec. Feeds a Codex-gated implementation plan (writing-plans next).
> **Date:** 2026-07-14
> **Track:** UI/UX roadmap Phase 2 ([`docs/research/ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md)),
> backlog items **6** (deduction feedback) + **2** (`connected` colour-only fix, rides along).
> **Enacts:** [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md) — resolves the two design
> questions that ADR explicitly deferred to "the Phase 2 spec".
> **Consumes:** the Phase 1 global announcer (`src/announcer.ts`, `announce()`), PR #80.

---

## Problem

On the Evidence Board, connecting ≥2 clues and pressing **Attempt Deduction** rolls a Reason check
(d20 vs DC 14). On `success`/`critical` it forms a deduction (recipe subset-match → a *key* deduction
under its stable id, else a *generic* one) and marks the clues `deduced`; on
`partial`/`failure`/`fumble` it marks them `contested`, reverting to `examined` after 2 s.

Two problems (from the UI/UX research, finding D3):

1. **The roll gatekeeps whether reasoning pays off at all.** A correct clue-set can fail on an unlucky
   roll; a wrong set can pass on a lucky one. Players can't tell a reasoning error from bad luck.
2. **Failure is binary and undirected.** Every non-success is a flat "contested" with no hint that the
   player was *close* (Golden-Idol-style directional feedback is absent).

ADR-0012 already decided the governing principle — **correctness gates deduction formation; the roll
only flavours the outcome** — but deferred two mechanics to this spec:

- what counts as "correct" for a **generic** (non-recipe) connection (today: no modelled correctness), and
- the exact roll-tier → on-board-feedback mapping.

## Decisions (resolving ADR-0012's deferrals)

1. **Generic-connection correctness = tag-overlap.** A non-recipe set is correct when all its clues
   share at least one tag and none is a red herring. (Reuses the tag signal the board already computes
   for `shouldBrighten`.)
2. **Three correctness states**, not the raw 5-tier roll: `correct` / `partial` / `incorrect`.
3. **The d20 roll only flavours a `correct` outcome** (crit → a sharper insight line). It is not even
   rolled on `partial`/`incorrect`, so it can never gate — the ADR's core requirement.
4. **No anti-spam cost in Phase 2.** A composure cost on repeated failed attempts is deferred to its
   own decision (bigger blast radius; directional feedback already reduces blind guessing).

## Approach (chosen: A — engine-owned classification, thin UI)

A new pure engine function owns the correctness decision; `DeductionButton` renders and announces its
result. Rejected alternatives: folding classification into `buildDeduction.ts` (muddies that module's
single "construct a Deduction" purpose); keeping the roll as a co-driver (re-muddies reasoning-vs-luck,
against ADR-0012).

---

## Component 1 — `src/engine/classifyConnection.ts` (new, pure)

```ts
export type Correctness = 'correct' | 'partial' | 'incorrect';

export interface ConnectionClassification {
  correctness: Correctness;
  recipe: KeyDeduction | null; // non-null only when a recipe subset-matched
}

export function classifyConnection(
  connectedIds: string[],
  clues: Record<string, Clue>,
  recipes: KeyDeduction[],
): ConnectionClassification;
```

**Rules, in order:**

1. **Recipe subset-match** (reuse `matchDeduction(connectedIds, recipes)`): if a recipe matches →
   `{ correctness: 'correct', recipe }`. A recipe is authored-correct by definition (ADR-0012's
   "at minimum, matches a recipe").
2. Otherwise compute over the connected clues (ignore ids that don't resolve in `clues`):
   - `hasRedHerring` = any resolved clue's `type === 'redHerring'`
   - `allShareATag` = ∃ a tag present on **every** connected clue
   - `someShareATag` = ∃ a tag shared by **≥2** connected clues
3. **`correct`** — `allShareATag && !hasRedHerring`
4. **`partial`** — (`!hasRedHerring && someShareATag && !allShareATag`) — a coherent subset, ≥1 clue
   doesn't belong — **or** (`hasRedHerring && someShareATag`) — a red herring smuggled into an
   otherwise-coherent set ("some belong").
5. **`incorrect`** — everything else (no shared tag at all; or a red herring with no coherence).

**Purity:** no store access, no `performCheck`, no `Date.now()`/`Math.random()`. Deterministic in its
inputs. This is the function ADR-0012's *Confirmation* clause targets.

**Edge notes:** `connectedIds` always has ≥2 entries at the call site (`DeductionButton` returns null
below 2). Ids absent from `clues` are skipped when computing tag/red-herring signals (defensive; the
board only ever connects real clues).

---

## Component 2 — `src/components/EvidenceBoard/DeductionButton.tsx` (rewrite of `handleAttempt`)

```
classification = classifyConnection(connectedClueIds, clues, recipes)

if classification.correctness === 'correct':
    roll = performCheck('reason', investigator, DEDUCTION_DC, false, false)   // FLAVOUR ONLY
    deduction = classification.recipe
        ? buildDeductionFromRecipe(classification.recipe, connectedClueIds)
        : buildDeduction(connectedClueIds, clues)
    addDeduction(deduction)
    connectedClueIds.forEach(id => updateClueStatus(id, 'deduced'))
    setPhase('success')
    flavour = roll.tier === 'critical' ? 'sharp' : 'plain'
    message = SUCCESS_MESSAGE[flavour]
    announce(message)                        // polite; single SR announcement
    setVisualMessage(message)                // local <p>, visual-only (no aria-live)
    onResult('success')
else:                                        // 'partial' | 'incorrect' — NO roll
    connectedClueIds.forEach(id => updateClueStatus(id, 'contested'))
    setPhase('failure')
    message = FEEDBACK_MESSAGE[classification.correctness]
    announce(message)
    setVisualMessage(message)
    onResult('failure')
    setTimeout(() => { idsRef.current.forEach(id => updateClueStatus(id, 'examined')); setPhase('idle'); }, 2000)
```

**Messages** (measured, atmospheric, short *status* strings — never narrative, never campy):

| correctness | roll flavour | message (local `<p>` **and** `announce()`) |
|---|---|---|
| `correct` | `critical` | `The connection holds — a sharp, decisive insight.` |
| `correct` | any other | `The connection holds.` |
| `partial` | — | `Some of these belong together, but the link isn't complete.` |
| `incorrect` | — | `These clues don't connect.` |

**Announcement path (resolves live-region flooding):** the authoritative message goes through the
**global** `announce()` (polite — a deduction is not a halt/error). The local `<m.p>` keeps showing the
same text for sighted users but **loses its `aria-live`** (becomes visual-only), so screen readers hear
the outcome exactly once, from the always-mounted Phase-1 region.

**Visual colour split:** the local `<p>` becomes three-way — green (`correct`) / amber (`partial`) /
red (`incorrect`) — replacing today's binary green/red. Button text unchanged
(`🧠 Attempt Deduction` → `Rolling…` → `🔒 Deduction Locked` / `🔴 Attempt Failed`; `Rolling…` shows
briefly only on the correct path now).

**Clue status:** `partial` and `incorrect` both reuse the existing `contested` state (❓ + red ring +
2 s revert). **No new `ClueStatus` value** → zero save-migration surface.

---

## Component 3 — `src/components/EvidenceBoard/EvidenceBoard.tsx`

`handleDeductionResult` keeps its `'success' | 'failure'` signature (minimal). `partial` and
`incorrect` both surface as the existing failure ("slack threads" + `clearConnections`) — the
directional signal lives in the message, not a distinct thread animation. A per-correctness thread
animation is deferred polish, not load-bearing for Phase 2.

---

## Component 4 — `src/components/EvidenceBoard/ClueCard.tsx` (backlog item 2, colour-only fix)

The `connected` state is signalled by a yellow ring **alone** (WCAG SC 1.4.1 gap). Add a redundant
non-colour cue matching the existing badge pattern:

- `StatusIndicator` gains a `connected` case → a `🔗` badge in the same top-right slot as
  NEW / 📌 / ❓ / ✓, with `aria-label="Connected"`.
- Update the doc-comment header's six-state list to note the 🔗 badge.

No logic change. The card-root `aria-label` already includes `status: connected`, so SR coverage is
already correct; this fixes the *visual* colour-only gap.

---

## Testing (TDD — write RED first, watch it fail, then GREEN)

**`src/engine/__tests__/classifyConnection.test.ts`** — includes the ADR-0012 Confirmation assertions:
- recipe-matching set (superset of `requiredClues`) → `correct`, `recipe` non-null. *(Pure fn: no roll
  is involved, which is the point — assert the correctness is roll-independent.)*
- non-qualifying set → never `correct` (assert `partial` / `incorrect` on representative sets).
- `allShareATag && !redHerring` → `correct`; coherent-subset (`some && !all`) → `partial`;
  red-herring + coherent → `partial`; red-herring-alone / no-overlap → `incorrect`.

**`src/engine/__tests__/classifyConnection.property.test.ts`** (fast-check): any set that is a superset
of some recipe's `requiredClues` classifies `correct`.

**`DeductionButton` component test** (spy on the `announce` module):
- a `correct` set forms a deduction (`addDeduction` called) and marks clues `deduced` **even when the
  d20 is stubbed to a low/failing roll** (enacts ADR-0012: roll can't gate).
- `partial` and `incorrect` sets never call `addDeduction`; mark clues `contested`; revert after 2 s.
- `announce` is called exactly once per attempt, with the message matching the correctness/flavour.

**`ClueCard` test:** a `connected` clue renders the 🔗 badge (colour-independence regression guard).

Baseline **635/60**; expect ~8–12 new tests.

---

## Docs & ADR promotion (in the Phase 2 PR)

- **Promote ADR-0012 `Accepted` → `Enacted`**; fill its *Commits / PRs* link. Its Confirmation clause
  is satisfied by the `classifyConnection` roll-independence test + the removal of the
  `tier === 'success' || 'critical'` gate in `DeductionButton`.
- `docs/engine-reference.md`: add `classifyConnection` (signature + rules).
- `CLAUDE.md`: update the `DeductionButton` note — it no longer rolls-to-gate (correctness gates; the
  roll flavours).
- `docs/status.md`: bump the test baseline.
- Post-merge: tick roadmap Phase 2; update the `ui-ux-improvements.md` audit rows for items 6 and 2.

## Scope boundaries (YAGNI)

- **No** anti-spam / composure cost (deferred — own decision).
- **No** new `ClueStatus`, **no** save-migration.
- **No** widened `onResult` signature / per-correctness thread animation.
- **No** dice-legibility (DC/modifier surfacing) — that is Phase 3.
- **No** touch/contrast/reduced-motion sweeps — that is Phase 4.

## Codex gates

Non-trivial → both gates apply. **Gate 1** on the implementation plan before any mutation; **Gate 2**
on the complete diff vs. the start commit before completion. Reviewer context must include this spec,
ADR-0012, and the four touched files.
