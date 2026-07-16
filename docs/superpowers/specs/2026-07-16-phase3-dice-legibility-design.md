# Phase 3 — Dice / Probability Legibility (design spec)

**Date:** 2026-07-16
**Branch:** `feat/phase3-dice-legibility`
**Roadmap:** UI/UX track-C Phase 3 ([ui-ux-roadmap.md](../../research/ui-ux-roadmap.md)) — backlog item 7.
**Depends on / informed by:** [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md) (deduction rolls are
deterministic-set + flavour; faculty checks remain dice-driven — Phase 3 is about making *those* checks legible).

---

## 1. Goal

Make the odds of a faculty check legible to the player **before and after** the roll, without breaking the game's
measured Victorian tone. Today the odds are opaque: choices show a faculty + modifier but no difficulty, clue-check
prompts hide the DC (it lives only in an `aria-label`), and the at-roll overlay never shows what number the player was
trying to beat.

**Product decision (brainstorming):** expose **raw numbers + a diegetic qualitative band** — never a literal success
percentage. The band ("Prospects: Favourable / Uncertain / Forbidding") is derived from the internal success
probability but the percentage itself is *never rendered*.

### Non-goals (explicit YAGNI boundaries)

- **No success-percentage** is ever shown to the player.
- **No advantage-dice detail** in the at-roll overlay (we do not surface both d20s or which was kept/dropped).
- **No new content schema.** The DC comes entirely from the existing `Choice.difficulty` /
  `Choice.dynamicDifficulty` / `ClueDiscovery.requiresFaculty.minimum` fields.
- **No save-migration.** `lastCheckResult` is transient UI state, already cleared on navigation (F-106); the new
  field is optional.
- Reduced-motion coverage, focus-restore, and the broad contrast/inertness audit are **Phase 4's** job. Phase 3
  reuses existing palettes and patterns so that sweep covers the new UI automatically; it does **not** open that sweep.

---

## 2. Architecture

### 2.1 One shared pure helper — `src/engine/checkOdds.ts` (NEW)

Three surfaces run faculty checks and each currently recomputes modifier/proficiency independently:
`ChoiceCard`, `SceneCluePrompts`, `EncounterPanel`. Rather than scatter DC + band + advantage logic three ways, all
three consume one pure, deterministic, RNG-free helper:

```ts
export type ProspectsBand = 'favourable' | 'uncertain' | 'forbidding';

export interface CheckOdds {
  modifier: number;         // calculateModifier(score) + getTrainedBonus(faculty, archetype)
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  band: ProspectsBand;      // computed on EFFECTIVE odds (advantage/disadvantage folded in)
}

export function computeCheckOdds(
  faculty: Faculty,
  investigator: Investigator,
  dc: number,
  hasAdvantage: boolean,
  hasDisadvantage: boolean,
): CheckOdds;
```

The helper is pure (no `Math.random`, no `Date.now`), so it is unit- and property-testable in isolation. It reuses
`calculateModifier` + `getTrainedBonus` from `diceEngine.ts` for the modifier so the number always matches the roll.

### 2.2 One shared presentational component — `CheckOddsTag`

A small presentational React component that renders a `CheckOdds` as `vs DC N · Prospects: Band` plus the advantage
glyph, with a single composed `aria-label`. Each check surface composes it beside its existing faculty tag. Location:
co-located under `src/components/shared/` (new dir) to match the "each component in its own directory" convention;
exported via a barrel.

### 2.3 Store extension — `CheckResult.dc`

`narrativeSlice.ts`'s `CheckResult` gains one **optional** field so the at-roll overlay can show the DC:

```ts
export interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  tier: OutcomeTier;
  dc?: number;   // NEW — optional; deduction rolls & legacy callers omit it
}
```

Optional means existing callers and old in-memory results stay valid, and **no save migration is required**
(`lastCheckResult` is not persisted across the surfaces that clear it; it is transient UI state).

---

## 3. The Prospects band (thresholds & math)

The band buckets the **internal** chance-of-success into three diegetic words. The percentage is computed only to
pick the bucket and is never rendered.

### 3.1 Base success probability

For a single d20 where nat-20 is always a critical success and nat-1 is always a fumble:

- `needed = dc - modifier` (the natural roll needed to reach the DC).
- `p = (21 - needed) / 20`, then **clamped to [1/20, 19/20]** — nat-1 always fails, nat-20 always succeeds, so a
  check can never read 0% or 100%.

The *partial* tier (`total >= dc - 3`) is deliberately **excluded** from the band — the band reads pure
success odds. This keeps the mapping a single clean function of `needed`.

### 3.2 Advantage / disadvantage fold-in

- **Advantage** (2d20 take higher): `pEff = 1 - (1 - p)²`.
- **Disadvantage** (2d20 take lower): `pEff = p²`.
- **Both true → cancel** (mirrors `performCheck`), so `pEff = p`.

This is why an advantaged check can read a better band than the bare check — the brainstorming decision "band
reflects advantage."

### 3.3 Thresholds

| Band | Effective success chance | Colour palette (reused) |
|------|--------------------------|--------------------------|
| **Favourable** | `pEff ≥ 0.65` | green — the `strong` proficiency palette |
| **Uncertain**  | `0.35 ≤ pEff < 0.65` | amber — the `moderate` palette |
| **Forbidding** | `pEff < 0.35` | red — the `weak` palette |

Thresholds are constants in `checkOdds.ts` and are the primary unit-test target.

### 3.4 Relationship to the proficiency word

The existing proficiency word (Proficient / Adequate / Untrained) describes **the investigator's aptitude** at that
faculty (a function of modifier alone). The Prospects band describes **this specific check** (modifier *vs* DC, with
advantage). They are complementary, not redundant, and both remain visible.

---

## 4. Pre-roll display (three surfaces)

`CheckOddsTag` renders, beside the existing faculty tag:

```
Reason +2 · Proficient   vs DC 14 · Prospects: Uncertain   ◈
```

### 4.1 `ChoiceCard` (`src/components/ChoicePanel/`)

Today: `Reason +2 · Proficient`, **no DC**. Adds `CheckOddsTag`, fed by:
- modifier from the existing `calculateModifier` + `getTrainedBonus` call it already makes,
- DC from `resolveDC(choice, investigator)` (handles `dynamicDifficulty`),
- `hasAdvantage` from the already-plumbed prop (`computeAdvantage` in the parent, F-014),
- `hasDisadvantage` = `false` (no content grants disadvantage today; the field exists for completeness).

Renders **only** when `choice.faculty` is set (the existing guard). Non-check choices are unchanged.

### 4.2 `SceneCluePrompts` (`src/components/NarrativePanel/`)

Today: DC lives only in the `aria-label`. Surface it visibly on `method: 'check'` prompts:

```
Perception +1 · vs DC 12 · Prospects: Favourable
```

DC from `d.requiresFaculty.minimum`. `hasAdvantage`/`hasDisadvantage` = `false` here today (clue-check prompts don't
route through `computeAdvantage`); passing `false` is correct and keeps the door open if that changes. Exploration
(non-check) prompts are unchanged.

### 4.3 `EncounterPanel` (`src/components/EncounterPanel/`)

Same `CheckOddsTag` on its faculty/reaction check buttons, fed from the encounter's check DC and the investigator.

### 4.4 Accessibility

`CheckOddsTag` carries one composed `aria-label`, e.g.
`"Reason check, modifier +2, difficulty 14, prospects uncertain, advantage"` — one coherent phrase, not fragments.
The advantage glyph keeps ◈ with a text alternative. Colours reuse the existing proficiency palettes so Phase 4's
contrast pass covers them.

---

## 5. At-roll display — `DiceRollOverlay`

Per the brainstorming decision, the overlay gains **DC only** (no advantage-dice breakdown):

```
🎲 19  vs DC 14
   ✓ Success
```

- `DiceRollOverlay` gains an optional `dc?: number` prop. When present, it renders `vs DC {dc}` between the total and
  the outcome, and folds the DC into its `aria-label`.
- When `dc` is absent (deduction rolls per ADR-0012; any legacy caller), the overlay renders **exactly as today** —
  fully backward-compatible.
- All three faculty-check call-sites already hold the DC when they call `setCheckResult`
  (`SceneCluePrompts.handleCheck` has `dc`; `ChoicePanel`'s resolution has `resolveDC`; `EncounterPanel` has its
  check DC) — they pass it through into the extended `CheckResult`.

The tier line (`OutcomeBanner`) is unchanged.

---

## 6. Testing (TDD)

- **`src/engine/__tests__/checkOdds.test.ts`** (heaviest coverage — load-bearing logic):
  - band thresholds exactly at the 0.65 / 0.35 boundaries;
  - advantage lifts a Forbidding bare check into Uncertain (and disadvantage lowers);
  - advantage + disadvantage cancel;
  - probability clamps: nat-1 floor and nat-20 ceiling (a DC far above/below modifier never reads 0% or 100% band
    edge incorrectly);
  - dynamic-difficulty DC resolution flows through (via the caller, or a direct `resolveDC` cross-check);
  - a property test: band is monotonic in modifier (higher modifier never yields a worse band at fixed DC).
- **Component tests:**
  - `CheckOddsTag` renders DC + band + glyph and the composed `aria-label`;
  - `ChoiceCard` / `SceneCluePrompts` / `EncounterPanel` show the tag on faculty checks and omit it on non-check
    choices/prompts;
  - `DiceRollOverlay` renders `vs DC` when `dc` present and is byte-for-byte unchanged when `dc` is absent.

---

## 7. Edge cases

- **Advantage + disadvantage both true** → cancel; band computed as plain (mirrors `performCheck`).
- **No faculty on a choice** → no tag (existing guard).
- **Deduction rolls** (ADR-0012) → no DC passed → overlay unchanged; no Prospects tag (deductions are not DC checks).
- **Modifier far exceeds DC / DC far exceeds modifier** → clamp keeps the band at Favourable/Forbidding without
  claiming certainty.

---

## 8. Files touched (summary)

| File | Change |
|------|--------|
| `src/engine/checkOdds.ts` | **NEW** — `computeCheckOdds`, `ProspectsBand`, thresholds |
| `src/components/shared/CheckOddsTag.tsx` (+ barrel) | **NEW** — shared presentational tag |
| `src/store/slices/narrativeSlice.ts` | `CheckResult.dc?: number` |
| `src/components/ChoicePanel/ChoiceCard.tsx` | render `CheckOddsTag` |
| `src/components/NarrativePanel/SceneCluePrompts.tsx` | render `CheckOddsTag`; pass `dc` to `onCheckResult` |
| `src/components/NarrativePanel/NarrativePanel.tsx` | thread `dc` into `setCheckResult` |
| `src/components/NarrativePanel/DiceRollOverlay.tsx` | optional `dc` prop |
| `src/components/EncounterPanel/EncounterPanel.tsx` | render `CheckOddsTag`; pass `dc` to its check result |
| `src/engine/__tests__/checkOdds.test.ts` + component tests | **NEW** |

---

## 9. Review trail

Per [ADR-0013](../../DECISIONS/ADR-0013-codex-file-based-review-handoff.md), this spec goes through a file-based
Codex spec review before the plan, and the completed implementation through a file-based Codex impl review before PR.
