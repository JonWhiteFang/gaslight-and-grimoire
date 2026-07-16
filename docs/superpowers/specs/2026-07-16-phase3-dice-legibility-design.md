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
- **Encounter reaction checks are out of scope** — they are auto-rolled inside `startEncounter`, expose only a
  pass/fail boolean, and never reach `setCheckResult` (Codex finding 4). Only encounter *round choices* (which are
  `ChoiceCard`s) are covered, transitively.
- Reduced-motion coverage, focus-restore, and the broad contrast/inertness audit are **Phase 4's** job. Phase 3
  reuses existing palettes and patterns so that sweep covers the new UI automatically; it does **not** open that sweep.

---

## 2. Architecture

### 2.1 One shared pure helper — `src/engine/checkOdds.ts` (NEW)

Faculty checks surface through `ChoiceCard` (used by both the main `ChoicePanel` **and** `EncounterPanel` round
choices) and `SceneCluePrompts`, each currently recomputing modifier/proficiency independently. Rather than scatter
DC + band + advantage logic, they consume one pure, deterministic, RNG-free helper:

```ts
export type ProspectsBand = 'favourable' | 'uncertain' | 'forbidding';

export interface CheckOdds {
  faculty: Faculty;         // carried so callers can build the accessible name (Codex finding 3)
  modifier: number;         // calculateModifier(score) + getTrainedBonus(faculty, archetype)
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  autoSucceeds: boolean;    // an active auto-succeed ability guarantees a critical (Codex finding 1)
  band: ProspectsBand;      // computed on EFFECTIVE odds (advantage/disadvantage folded in)
}

export function computeCheckOdds(args: {
  faculty: Faculty;
  investigator: Investigator;
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  autoSucceeds: boolean;
  /** true on surfaces where a `partial` tier yields the advertised benefit (clue prompts) */
  partialCountsAsSuccess: boolean;
}): CheckOdds;
```

The helper is pure (no `Math.random`, no `Date.now`), so it is unit- and property-testable in isolation. It reuses
`calculateModifier` + `getTrainedBonus` from `diceEngine.ts` for the modifier so the number always matches the roll.

### 2.2 Shared auto-succeed predicate (Codex finding 1)

`resolveCheckOutcome` (`src/engine/choiceResolution.ts:48-55`) short-circuits to a **guaranteed `critical`** — before
any roll — when the faculty has an active auto-succeed ability flag (Elementary/Street Survivor/Silver Tongue →
`ability-auto-succeed-{reason,vigor,influence}`). The pre-roll display must not show dice odds for a check that is
guaranteed. To keep one source of truth, extract the resolver's predicate into a pure helper in `flags.ts`
(alongside `abilityAutoSucceedFlag`):

```ts
// flags.ts
export function checkAutoSucceeds(faculty: Faculty, flags: Record<string, boolean>): boolean {
  const f = abilityAutoSucceedFlag(faculty);
  return !!f && !!flags[f];
}
```

`resolveCheckOutcome` is refactored to call it (behaviour-preserving), and every pre-roll surface passes
`autoSucceeds: checkAutoSucceeds(faculty, state.flags)` into `computeCheckOdds`. When `autoSucceeds` is true the tag
renders a distinct **"Assured"** treatment (gold, no DC-vs-band probability language — e.g. `Reason · Assured`)
rather than an ordinary band, and `band` is still populated (defaults to `favourable`) for callers that ignore the
flag.

### 2.3 One shared presentational component — `CheckOddsTag`

A small presentational React component that renders a `CheckOdds` as `vs DC N · Prospects: Band` (or the **Assured**
treatment when `autoSucceeds`) plus the advantage glyph. Location: co-located under `src/components/shared/` (new
dir) to match the "each component in its own directory" convention; exported via a barrel.

**Accessibility (Codex finding 3):** the two check controls (`ChoiceCard`'s button, `SceneCluePrompts`'s check
button) already set an explicit `aria-label` on the **outer button**, which overrides descendant text as the
accessible name. So `CheckOddsTag` is rendered **`aria-hidden` / decorative**, and each surface **appends the odds
phrase to its own button `aria-label`** via a shared string builder `describeCheckOdds(odds): string` (also exported
from `checkOdds.ts`, pure). Example: the ChoiceCard button label becomes
`"{choice.text}. Reason check, modifier +2, difficulty 14, prospects uncertain, advantage"`. Tests assert the
**accessible name of the focusable button**, not a labelled descendant.

### 2.4 Store extension — `CheckResult.dc`

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

**Partial-tier policy is surface-dependent (Codex finding 2).** The event the band predicts differs by surface:

- **Choices / encounter round choices** — `partial` routes to a *distinct* outcome scene (not success), so the band
  predicts the strict `{success, critical}` event: `needed = dc - modifier`.
- **Scene clue-check prompts** — `SceneCluePrompts.handleCheck` discovers the clue on **any tier except
  failure/fumble**, so `partial` is success-equivalent *there*. The band must predict `{partial, success, critical}`:
  the lowest passing natural roll is `needed = dc - 3 - modifier` (mirroring `resolveCheck`'s `total >= dc - 3`).

`computeCheckOdds` takes `partialCountsAsSuccess: boolean` and computes `needed` accordingly; clue prompts pass
`true`, choices/encounters pass `false`. This removes the "band understates the real prospect" gap Codex flagged
(e.g. DC 10, mod +0 on a clue prompt: strict success 55% → Uncertain, but clue-discovery is 70% → correctly
Favourable under the clue-prompt policy).

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

Today: `Reason +2 · Proficient`, **no DC**. Adds a decorative `CheckOddsTag` + appends the odds phrase to the button
`aria-label`, fed by:
- modifier from the existing `calculateModifier` + `getTrainedBonus` call it already makes,
- DC from `resolveDC(choice, investigator)` (handles `dynamicDifficulty`),
- `hasAdvantage` from the already-plumbed prop (`computeAdvantage`, F-014),
- `hasDisadvantage` = `false` (no content grants disadvantage today; the field exists for completeness),
- `autoSucceeds` = `checkAutoSucceeds(choice.faculty, gameState.flags)` (§2.2),
- `partialCountsAsSuccess: false` (partial routes to a distinct outcome here).

**Renders the Prospects tag only when the choice is a real check (Codex finding 5):**
`choice.faculty && (choice.difficulty !== undefined || choice.dynamicDifficulty)` — the same predicate the resolver
and validator use. A faculty-only choice resolves without rolling, so it keeps its aptitude tag but shows **no DC /
Prospects** (which would otherwise advertise a fictitious DC 12). This requires the parent to plumb `gameState.flags`
(or the `autoSucceeds`/predicate result) into `ChoiceCard`; `EncounterPanel` and `ChoicePanel` already build a
`GameState`.

### 4.2 `SceneCluePrompts` (`src/components/NarrativePanel/`)

Today: DC lives only in the `aria-label`. Surface it visibly on `method: 'check'` prompts:

```
Perception +1 · vs DC 12 · Prospects: Favourable
```

DC from `d.requiresFaculty.minimum`. `hasAdvantage`/`hasDisadvantage` = `false` (clue-check prompts don't route
through `computeAdvantage` — matches the actual roll at `SceneCluePrompts:81`), and
**`partialCountsAsSuccess: true`** (partial discovers the clue — §3.1, finding 2). The odds phrase is appended to the
check button's `aria-label`; the visible tag is decorative. Exploration (non-check) prompts are unchanged.

**`autoSucceeds` is `false` on this surface (Codex plan-review Major 1).** Unlike `resolveCheckOutcome`, the clue-
check path (`SceneCluePrompts.handleCheck`) calls `performCheck` directly and does **not** honor or consume the
auto-succeed ability flag. Showing an "Assured" tag here would therefore lie — the check would still roll and could
fail. Because the shipped clue prompts use Reason/Vigor/Influence (exactly the three auto-succeed faculties), this
mismatch is reachable, so we hard-code `autoSucceeds: false` for clue prompts rather than reading the flag. (Making
clue checks honor+consume the ability is a larger, separate change, explicitly out of scope for Phase 3.)

### 4.3 `EncounterPanel` (`src/components/EncounterPanel/`) — scope correction (Codex finding 4)

`EncounterPanel` **does not render its own faculty tag** — its round choices are already `ChoiceCard`s
(`EncounterPanel:140`), so they inherit the pre-roll Prospects tag from §4.1 transitively, with **no direct
`EncounterPanel` change for the pre-roll display** (adding a second tag would duplicate it). The supernatural
**reaction check is auto-rolled inside `startEncounter`** and only a pass/fail boolean (`reactionCheckPassed`)
reaches the panel — it never calls `setCheckResult`. **Reaction checks are therefore explicitly out of scope** for
both pre-roll odds and the at-roll DC; only the round-choice checks are covered. The one `EncounterPanel` change is
in §5: pass the DC through `setCheckResult` for round-choice results (the `processEncounterChoice` result already
carries roll/tier).

### 4.4 Accessibility

Per §2.3, `CheckOddsTag` is decorative (`aria-hidden`); the odds are conveyed by **appending `describeCheckOdds(odds)`
to each surface's existing outer-button `aria-label`** (which would otherwise override descendant text). Example
phrase: `"Reason check, modifier +2, difficulty 14, prospects uncertain, advantage"` (or `"…, assured"` when
`autoSucceeds`). Tests assert the **button's accessible name**. Colours reuse the existing proficiency palettes so
Phase 4's contrast pass covers them.

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
- The faculty-check call-sites hold the DC when they call `setCheckResult`: `SceneCluePrompts.handleCheck` has `dc`
  directly; the choice path resolves it via `resolveDC(choice, investigator)`; `EncounterPanel`'s round-choice result
  comes from `processEncounterChoice` — the DC is `resolveDC(choice, investigator)` on the chosen choice (auto-succeed
  choices resolve to `critical` and can pass their `resolveDC` too, or omit `dc` — either is backward-compatible).
  Reaction checks (§4.3) never reach `setCheckResult` and are unaffected.

The tier line (`OutcomeBanner`) is unchanged.

---

## 6. Testing (TDD)

- **`src/engine/__tests__/checkOdds.test.ts`** (heaviest coverage — load-bearing logic):
  - band thresholds exactly at the 0.65 / 0.35 boundaries;
  - advantage lifts a Forbidding bare check into Uncertain (and disadvantage lowers);
  - advantage + disadvantage cancel;
  - probability clamps: nat-1 floor and nat-20 ceiling;
  - **`partialCountsAsSuccess` boundary** — a DC/modifier pair where including partial changes the band (e.g. DC 10,
    mod +0: false → Uncertain, true → Favourable);
  - **`autoSucceeds: true`** yields the Assured treatment regardless of DC;
  - `describeCheckOdds` phrasing (incl. assured / advantage);
  - a property test: band is monotonic in modifier at fixed DC and policy.
- **`flags.test.ts`** — `checkAutoSucceeds` true only when the faculty has an active flag; `resolveCheckOutcome`
  still auto-crits after the refactor (behaviour-preserving).
- **Component tests:**
  - `CheckOddsTag` renders DC + band + glyph (or Assured) and is `aria-hidden`;
  - `ChoiceCard` / `SceneCluePrompts` **accessible-name** assertions — the odds phrase is in the *button's* name;
    tag shown on real checks, omitted on faculty-only (no `difficulty`/`dynamicDifficulty`) choices and on
    exploration prompts;
  - an active auto-succeed flag makes a ChoiceCard show Assured (regular-choice + encounter-round-choice cases);
  - `DiceRollOverlay` renders `vs DC` when `dc` present and is unchanged when `dc` is absent.

---

## 7. Edge cases

- **Advantage + disadvantage both true** → cancel; band computed as plain (mirrors `performCheck`).
- **Faculty-only choice** (no `difficulty`/`dynamicDifficulty`) → aptitude tag only, no DC/Prospects (finding 5).
- **Auto-succeed ability active** → Assured treatment, no probability language (finding 1).
- **Clue-check prompt** → band predicts clue-discovery (`partial` counts), not strict success (finding 2).
- **Encounter reaction check** → out of scope; auto-rolled, no button, never hits `setCheckResult` (finding 4).
- **Deduction rolls** (ADR-0012) → no DC passed → overlay unchanged; no Prospects tag (deductions are not DC checks).
- **Modifier far exceeds DC / DC far exceeds modifier** → clamp keeps the band at Favourable/Forbidding without
  claiming certainty.

---

## 8. Files touched (summary)

| File | Change |
|------|--------|
| `src/engine/checkOdds.ts` | **NEW** — `computeCheckOdds`, `describeCheckOdds`, `ProspectsBand`, thresholds |
| `src/engine/flags.ts` | **NEW** `checkAutoSucceeds(faculty, flags)` pure predicate |
| `src/engine/choiceResolution.ts` | refactor the inline auto-succeed check to call `checkAutoSucceeds` (behaviour-preserving) |
| `src/components/shared/CheckOddsTag.tsx` (+ barrel) | **NEW** — decorative (`aria-hidden`) tag |
| `src/store/slices/narrativeSlice.ts` | `CheckResult.dc?: number` (optional, no migration) |
| `src/components/ChoicePanel/ChoiceCard.tsx` | render decorative tag; append odds to button `aria-label`; real-check guard |
| `src/components/ChoicePanel/ChoicePanel.tsx` | plumb `gameState.flags` / `autoSucceeds` into `ChoiceCard` |
| `src/components/NarrativePanel/SceneCluePrompts.tsx` | render tag (`partialCountsAsSuccess: true`); append odds to button label; pass `dc` to `onCheckResult` |
| `src/components/NarrativePanel/NarrativePanel.tsx` | thread `dc` into `setCheckResult` |
| `src/components/NarrativePanel/DiceRollOverlay.tsx` | optional `dc` prop |
| `src/components/EncounterPanel/EncounterPanel.tsx` | pass `dc` through `setCheckResult` for round choices (**no** direct tag — inherited via `ChoiceCard`); reaction checks out of scope |
| `src/engine/__tests__/checkOdds.test.ts`, `flags` + component tests | **NEW** / extended |

---

## 9. Review trail

Per [ADR-0013](../../DECISIONS/ADR-0013-codex-file-based-review-handoff.md), this spec goes through a file-based
Codex spec review before the plan, and the completed implementation through a file-based Codex impl review before PR.
