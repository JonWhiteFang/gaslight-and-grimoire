# Phase 5 — Choice-Gating Content Model (design spec)

> **Type:** Feature design spec (schema + engine + validator + docs). Terminal roadmap item of the
> UI/UX track ([`ui-ux-roadmap.md`](../../research/ui-ux-roadmap.md) Phase 5; backlog item 8;
> acceptance-criteria origin [`ui-ux-improvements.md` Part V](../../research/ui-ux-improvements.md#part-v--choice--deduction-from-abstract-to-acceptance-criteria)).
> **Date:** 2026-07-17
> **Status:** Approved (brainstorm complete) — next step: Codex spec review → implementation plan.

---

## 1. Goal

Give content authors a declarative vocabulary to distinguish **hidden** choices (the option's very
existence is withheld until its prerequisites are met — today's only behaviour) from
**disabled-with-reason** choices (the option is *shown but locked*, greyed out with a diegetic
explanation of why). This is the StoryNexus / quality-based-narrative "hidden-when-unqualified vs.
shown-but-disabled" distinction, mapped onto G&G's existing `Condition`-driven choice gates.

It is a **content-pipeline capability**, not a content pass: the schema, engine support, validator
rule, authoring rules and tests ship now; existing cases are untouched except one demo conversion.
The Orrery Room (next content build) then authors with this vocabulary from day one.

### Non-goals

- Retrofitting the other shipped cases' gated choices (a separate narrative-design pass).
- Auto-generating gate reasons from the unmet condition (rejected — reads gamey, clashes with the
  measured Victorian tone).
- Any change to the Phase-1 live announcer or other live regions (the disabled state is static).
- The parked items (save-resume UX, React-Flow migration).

---

## 2. Current behaviour (what exists today)

A `Choice` (`src/types/index.ts`) already carries four optional gates:
`requiresClue`, `requiresDeduction`, `requiresFlag`, `requiresFaculty`.

These gates are **implicit and hard-hiding**. Two call sites independently rebuild the same
`Condition[]` from those fields and filter the choice out when unmet:

- `ChoicePanel.isChoiceVisible(choice, state)` — filters scene choices before render.
- `encounters.getEncounterChoices(round, state)` — filters encounter-round choices (with an
  `isEscapePath` special-case).

There is **no** "shown-but-disabled" state, no `gateReason`, and the validator has no concept of
choice visibility (it only checks that the gate *targets* — clue/recipe/faculty ids — exist).

The two hand-rolled condition-builders are duplicated logic; Phase 5 extracts a single shared unit.

---

## 3. Schema & data model

Two new **optional** fields on `Choice` (`src/types/index.ts`):

```ts
export interface Choice {
  // ...existing fields...
  /**
   * Governs what happens when this choice's requires* gates are UNMET.
   * - 'hidden'  (default when absent): filtered out — the option is not shown at all.
   * - 'disabled': rendered greyed & non-interactive, with gateReason explaining why.
   * - 'shown':   rendered normal & interactive despite unmet gates (soft-gate escape hatch).
   * Has no effect when the gates are MET or when the choice has no requires* gate.
   */
  visibility?: 'shown' | 'hidden' | 'disabled';
  /** Diegetic explanation shown when the choice is in the disabled state. Required iff visibility==='disabled'. */
  gateReason?: string;
}
```

### Semantics

`visibility` **only** governs the unmet-gate case. Resolution table:

| Gates present? | Gates met? | `visibility`        | Resolved state |
|----------------|------------|---------------------|----------------|
| none           | —          | any / absent        | `shown` (nothing to gate on) |
| yes            | met        | any / absent        | `shown` |
| yes            | unmet      | `hidden` or absent  | `hidden` (today's default — filtered out) |
| yes            | unmet      | `disabled`          | `disabled` (greyed + `gateReason`) |
| yes            | unmet      | `shown`             | `shown` (interactive despite gate — soft-gate escape hatch) |

Key invariants:
- **Backward-compatible:** absent `visibility` ≡ `hidden` ≡ current behaviour, so all 8 shipped cases
  are unchanged with zero edits.
- A choice with **no** `requires*` gate is always `shown` regardless of `visibility`.
- `gateReason` is meaningful only in the resolved `disabled` state.

---

## 4. Engine resolver (shared pure unit)

New pure, RNG-free module `src/engine/choiceVisibility.ts`, sitting alongside `checkOdds.ts` /
`deductionOracle.ts`:

```ts
export type ChoiceVisibilityState = 'shown' | 'disabled' | 'hidden';

/** Builds the requires* → Condition[] list. Single source of truth; replaces the two hand-rolled copies. */
export function choiceGateConditions(choice: Choice): Condition[];

/** The resolved visibility state for a choice given current game state. */
export function resolveChoiceVisibility(choice: Choice, state: GameState): ChoiceVisibilityState;
```

`resolveChoiceVisibility` logic:
1. `conditions = choiceGateConditions(choice)`.
2. If `conditions.length === 0` **or** `evaluateConditions(conditions, state)` → `'shown'`.
3. Otherwise (gates unmet):
   - `visibility === 'disabled'` → `'disabled'`
   - `visibility === 'shown'` → `'shown'`
   - else (`'hidden'` or absent) → `'hidden'`

### Caller refactors

- **`ChoicePanel`** — remove the local `isChoiceVisible`; map each choice through
  `resolveChoiceVisibility`. Render `shown` as the interactive `ChoiceCard`; render `disabled` as a
  greyed non-interactive card + reason (see §6); drop `hidden`. (Any test referencing
  `isChoiceVisible` is migrated to the resolver.)
- **`encounters.getEncounterChoices`** — replace the inline condition-building with
  `choiceGateConditions`. Return choices resolving to `shown` **or** `disabled` (so the panel can grey
  them). The `isEscapePath` special-case is **preserved unchanged**: escape paths are only included
  when their gate is met and are **never** disabled (a locked escape mid-combat is a confusing tease).
- **`EncounterPanel`** — render the same three-way as `ChoicePanel` for non-escape choices.

The resolver is pure and unit-testable in isolation; extracting it removes the pre-existing
duplication.

---

## 5. Validator rule

In `src/engine/contentValidation.ts`, `validateChoice` (already covers both scene and encounter-round
choices) gains:

**Errors (fail the gate):**
1. `visibility === 'disabled'` with no non-empty `gateReason` → *"choice X is disabled but has no
   gateReason"*. (The core Part V guarantee.)
2. `visibility` is `'disabled'` or `'shown'`, **or** a `gateReason` is present, on a choice with **no**
   `requires*` gate → *"choice X sets visibility/gateReason but has no requires\* gate to act on"*.
   (A disabled/reason state is meaningless with nothing to gate on.)
3. `visibility` set to a value other than `shown` | `hidden` | `disabled` → typo guard.

**Warning (non-fatal):**
4. `visibility === 'shown'` **with** a `requires*` gate present → *"choice X is shown despite a gate —
   the gate will not hide or disable it"*. A legal soft-gate escape hatch, but almost always a
   mistake, so flagged without blocking.

**Not validated:** the `gateReason` prose/tone — a content-review concern (content-integrity-reviewer),
not the static validator's.

---

## 6. Rendering & accessibility

A disabled choice renders as a **distinct non-interactive element**, not a disabled `<button>`:

- Not a `<button>` — a plain container (e.g. `<div role="note">` / a non-interactive `<li>`), so it is
  **removed from tab order** and cannot be activated by click, Enter, or Space.
- **Redundant cues (per [G2](../../research/ui-ux-improvements.md) — never colour alone):**
  - a **lock icon** (inline SVG or 🔒, `aria-hidden`),
  - the choice **text** greyed (reduced opacity + muted foreground; contrast stays ≥ the AA body
    ratio the Phase-4 sweep established),
  - the **`gateReason`** rendered inline beneath the choice text as ordinary visible prose.
- **No** dice/odds `CheckOddsTag` on a disabled choice (it can't be rolled).
- **Static — no announcer.** The disabled state is fixed at render time; nothing changes dynamically,
  so this does not touch the Phase-1 live-region infrastructure.
- **Ordering:** disabled choices render **after** the interactive ones, so keyboard/reader users reach
  all actionable options first, then the locked ones with their reasons.

---

## 7. Testing (TDD)

- **`choiceVisibility.test.ts`** (new) — the pure resolver: no-gates→shown; gates-met→shown; each
  `visibility` value under unmet gates → correct state; `choiceGateConditions` builds the right
  `Condition[]` for each `requires*` field (and the empty case).
- **`contentValidation`** — the 3 new errors + 1 warning (disabled-without-reason;
  disabled/`shown`/`gateReason` with no gate; bad enum value; `shown`-with-gate warning).
- **`ChoicePanel.test.tsx`** — a `disabled` choice renders greyed, non-interactive (not a button, not
  in tab order), reason visible; a default (`hidden`) gated choice still filtered; `shown` interactive.
- **`EncounterPanel`** — a non-escape disabled choice renders greyed; the escape path stays
  hard-gated (never disabled).
- **Regression:** the 8 shipped cases still validate clean and behave identically (default `hidden`).

---

## 8. Docs

- **`docs/content-authoring.md`** — new authoring rules: *when to hide vs. disable-with-reason* (hide
  when the option's existence would spoil or confuse; disable when a visible-but-locked state builds
  tension or teaches a prerequisite); `gateReason` tone guidance (measured, diegetic — *"The lock holds
  fast; you'd want Ackroyd's key first"*, never *"Requires: Occult 12"*); the `shown` escape-hatch
  caveat.
- **`src/types/index.ts`** — doc comments on the two fields (above).
- **`docs/engine-reference.md`** + **`docs/architecture.md`** — add `choiceVisibility.ts` to the engine
  module list + a data-flow note; record that `ChoicePanel`/`encounters` now consume the shared
  resolver.

---

## 9. Demo (the one content edit)

Convert a single existing gated choice in a shipped case from implicit-hidden to
`visibility: 'disabled'` + a `gateReason`, as a live end-to-end anchor and regression witness. The
specific choice is chosen during implementation (one whose locked state reads well narratively) and
run past the content-integrity reviewer for tone.

---

## 10. Review path

File-based Codex review at all three checkpoints (spec, plan, completed implementation) per CLAUDE.md,
plus a content-integrity review of the demo choice. Merge via merge commit (never squash).

---

## 11. Open questions

None outstanding. The four brainstorm decisions are settled: (1) `visibility` governs the unmet-gate
case, default `hidden`; (2) author-written, validator-enforced `gateReason`; (3) ship vocabulary + one
demo, no retrofit; (4) greyed non-interactive with always-visible reason, no announcer.
