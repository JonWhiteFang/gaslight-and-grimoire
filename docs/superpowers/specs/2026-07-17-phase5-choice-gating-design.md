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

### The "has a gate" predicate (single definition)

Several rules below turn on whether a choice is *gated*. There is exactly **one** definition, shared by
the resolver and the validator:

> A choice **has a gate** iff `choiceGateConditions(choice).length > 0`.

And `choiceGateConditions` builds a condition **only for a truthy** `requires*` field — exactly as the
two current callers do (`if (choice.requiresClue) …`). This is deliberate and load-bearing for
backward-compatibility: a malformed-but-currently-accepted choice with `requiresFlag: ''` builds **zero**
conditions today (empty string is falsy) and is therefore treated as ungated and shown; the new
predicate reproduces that exactly. Do **not** switch to property-presence (`!== undefined`) — that would
build a `hasFlag: ''` condition and start hiding a choice that ships visible (a compat break; Codex spec
Major 3). A regression test asserts `requiresFlag: ''`/`null` stays ungated.

### Semantics

`visibility` **only** governs the unmet-gate case. Resolution table (rows use the predicate above):

| Has a gate? | Gate met? | `visibility`        | Resolved state |
|-------------|-----------|---------------------|----------------|
| no          | —         | any / absent        | `shown` (nothing to gate on) |
| yes         | met       | any / absent        | `shown` |
| yes         | unmet     | `hidden` or absent  | `hidden` (today's default — filtered out) |
| yes         | unmet     | `disabled`          | `disabled` (greyed + `gateReason`) |
| yes         | unmet     | `shown`             | `shown` (interactive despite gate — soft-gate escape hatch) |

Key invariants:
- **Backward-compatible:** absent `visibility` ≡ `hidden` ≡ current behaviour, so all 8 shipped cases'
  *unconverted* choices are unchanged with zero edits. (The one demo choice in §9 is the sole
  deliberate behaviour delta.)
- A choice with **no** gate is always `shown` regardless of `visibility`.
- `gateReason` is meaningful only in the resolved `disabled` state.
- **Escape-path choices are excluded from this vocabulary** — see §4.1. `isEscapePath: true` choices may
  not set `visibility` to `disabled`/`shown` or carry a `gateReason` (validator error); they remain
  hard-gated (shown only when their gate is met, never disabled). This keeps the resolver authoritative
  for every choice it actually governs.

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
3. Otherwise (gate unmet):
   - `visibility === 'disabled'` → `'disabled'`
   - `visibility === 'shown'` → `'shown'`
   - else (`'hidden'` or absent) → `'hidden'`

`choiceVisibility.ts` imports `evaluateConditions` **directly from `./conditions`** (not via the
`narrativeEngine` barrel — that would create a barrel cycle; Codex spec Minor 2), and is itself
re-exported from the `narrativeEngine` barrel as part of the public engine surface.

### 4.1 Escape-path choices are out of scope for the vocabulary

`isEscapePath: true` choices are **not** governed by the new vocabulary. The resolver still runs on them
(so `getEncounterChoices` can call it uniformly), but the schema forbids them from carrying
`visibility: 'disabled' | 'shown'` or a `gateReason` (validator error — §5 rule 5). They keep exactly
today's behaviour: included only when their gate is met, **never** disabled (a locked escape mid-combat
is a confusing tease). This resolves the contradiction Codex flagged (spec Major 1) where an escape
choice could declare `disabled` + a valid `gateReason`, pass validation, yet be hard-hidden so its
reason never renders — the resolver was not authoritative for escape choices. Forbidding the fields at
author time makes the caller override impossible to reach.

### Caller refactors

- **`ChoicePanel`** — remove the local `isChoiceVisible` (and its stale re-export in
  `src/components/ChoicePanel/index.ts:3` — deleting the helper without this fails `tsc`; Codex spec
  Minor 2). Map each choice through `resolveChoiceVisibility`. Render `shown` as the interactive
  `ChoiceCard`; render `disabled` as a greyed non-interactive element + reason (see §6); drop `hidden`.
  (Any test referencing `isChoiceVisible` is migrated to the resolver.)
- **`encounters.getEncounterChoices`** — replace the inline condition-building with
  `choiceGateConditions`. For a **non-escape** choice, include it when it resolves to `shown` **or**
  `disabled` (so the panel can grey it). For an **escape** choice, keep today's exact rule: include only
  when its gate is met (per §4.1 it can never be `disabled`).
- **`EncounterPanel`** — render the same three-way as `ChoicePanel` for non-escape choices.

The resolver is pure and unit-testable in isolation; extracting it removes the pre-existing
duplication.

---

## 5. Validator rule

In `src/engine/contentValidation.ts`, `validateChoice` (already covers both scene and encounter-round
choices) gains the rules below. Two terms are pinned so implementers can't diverge:
- **gated** — `choiceGateConditions(choice).length > 0` (the §3 predicate — validator uses the *same*
  helper, not a property-presence check; Codex spec Major 3).
- **non-empty `gateReason`** — a `string` whose trimmed length > 0. A non-string, `null`, or
  whitespace-only value counts as **absent/invalid**, never as "present" (Codex spec Major 2 — guards
  against whitespace passing and non-string crashing).

**Errors (fail the gate):**
1. `visibility === 'disabled'` **without** a non-empty `gateReason` → *"choice X is disabled but has no
   gateReason"*. (The core Part V guarantee.)
2. **`gateReason` "iff disabled" — both directions** (Codex spec Major 2): a `gateReason` is *present*
   (any non-undefined value) while `visibility !== 'disabled'` → *"choice X has a gateReason but is not
   disabled — the reason will never render"*. Combined with rule 1, a non-empty `gateReason` is required
   when and permitted **only** when `visibility === 'disabled'`. This catches the typo where an author
   writes a reason but forgets `visibility: 'disabled'` (today that silently discards the prose).
3. `visibility` is `'disabled'` or `'shown'` on a choice that is **not gated** → *"choice X sets
   visibility '<v>' but has no requires\* gate to act on"*. (A disabled/soft-gate state is meaningless
   with nothing to gate on.) Explicit `visibility: 'hidden'` on an ungated choice is a documented **no-op
   and allowed** (it equals the default), so it is *not* an error — only the two states that change
   behaviour are rejected.
4. `visibility` set to a value other than `shown` | `hidden` | `disabled` → typo guard.
5. **Escape-path exclusion** (Codex spec Major 1): an `isEscapePath: true` choice that sets `visibility`
   to `'disabled'` or `'shown'`, **or** carries a `gateReason` → *"escape-path choice X may not set
   visibility/gateReason"*. (Per §4.1 the vocabulary does not govern escapes.)

**Warning (non-fatal):**
6. `visibility === 'shown'` on a **gated** choice → *"choice X is shown despite a gate — the gate will
   not hide or disable it"*. A legal soft-gate escape hatch, but almost always a mistake, so flagged
   without blocking.

**Validator plumbing (Codex spec Major 4):** `validateChoice` currently receives a `Ctx` that carries
only `errors`; the `warnings` array is local to `validateBundle` and today frames warnings as *opt-in
reachability observations*. To emit rule 6, add `warnings: string[]` to `Ctx`, thread the
`validateBundle`-owned `warnings` array into it, and emit rule 6 **unconditionally** (independent of the
`includeReachability` option — it is a content-shape warning, not a reachability one). The CLI
(`scripts/validateCase.ts`) already prints returned warnings without failing, so no CLI change is
needed; update the `validateBundle`/`ValidateOptions` doc comments so "warnings = reachability only" is
no longer stated. Tests assert: rule 6 returns a warning with **zero** errors and CLI exit success.

**Not validated:** the `gateReason` prose/tone — a content-review concern (content-integrity-reviewer),
not the static validator's.

---

## 6. Rendering & accessibility

A disabled choice renders as a **distinct non-interactive element**, not a disabled `<button>`. Today
both panels wrap choices in a single `<nav aria-label="Available choices">` (ChoicePanel.tsx:105-122;
EncounterPanel.tsx:145-159). A `<nav>` landmark is for navigable actions, so locked prose does not
belong inside it, and a bare `<li>` is invalid directly under a `<nav>` (Codex spec Minor 1). The
structure therefore becomes:

- A wrapping **`<section>`** (or `<div>`) holds two groups in DOM order:
  1. the existing interactive **`<nav aria-label="Available choices">`** with the `shown` `ChoiceCard`
     buttons (unchanged), then
  2. a **`<ul aria-label="Locked choices">`** (rendered only when ≥1 disabled choice exists) whose
     `<li>` children are the disabled choices — valid list markup, out of the navigation landmark.
- Each disabled `<li>` is **non-interactive** — not a `<button>`, not focusable, cannot be activated by
  click/Enter/Space — so it is absent from the keyboard tab order.
- **Redundant cues (per [G2](../../research/ui-ux-improvements.md) — never colour alone):**
  - a **lock icon** (inline SVG or 🔒, `aria-hidden`),
  - the choice **text** greyed (reduced opacity + muted foreground; contrast stays ≥ the AA body
    ratio the Phase-4 sweep established),
  - the **`gateReason`** rendered inline beneath the choice text as ordinary visible prose.
- **No** dice/odds `CheckOddsTag` on a disabled choice (it can't be rolled).
- **Static — no announcer.** The disabled state is fixed at render time; nothing changes dynamically,
  so this does not touch the Phase-1 live-region infrastructure.
- **Ordering:** the locked group renders **after** the interactive `<nav>` in DOM/reading order (not
  "focus order" — the disabled items are unfocusable, so there is no focus-order claim; Codex spec
  Minor 1), so screen-reader browse order and visual order reach actionable options first, then the
  locked ones with their reasons.
- **Tests** assert non-interactivity **and** the landmark/list roles (interactive `nav` group; a `list`
  with `listitem` children for the locked group).

---

## 7. Testing (TDD)

- **`choiceVisibility.test.ts`** (new) — the pure resolver: no-gates→shown; gates-met→shown; each
  `visibility` value under an unmet gate → correct state; `choiceGateConditions` builds the right
  `Condition[]` for each `requires*` field and the empty case; **the compat guard**:
  `requiresFlag: ''` / `null` → zero conditions → `shown` (Codex spec Major 3).
- **`contentValidation`** — the 5 errors + 1 warning: (1) disabled-without-reason; (2) `gateReason`
  present while not disabled; (3) `disabled`/`shown` on an ungated choice **and** the allowed no-op of
  explicit `hidden` on an ungated choice (asserts no error); (4) bad enum value; (5) escape-path with
  `visibility`/`gateReason`; (6) `shown`-with-gate **warning** with zero errors + CLI exit success
  (Codex spec Major 4); plus whitespace-only / non-string `gateReason` treated as absent (Major 2).
- **`ChoicePanel.test.tsx`** — a `disabled` choice renders in a `list`/`listitem`, non-interactive (not
  a button, not focusable), reason visible; a default (`hidden`) gated choice still filtered; `shown`
  interactive; the interactive `nav` group precedes the locked `ul` in DOM order.
- **`EncounterPanel`** — a non-escape disabled choice renders greyed; the escape path stays
  hard-gated (never disabled).
- **Regression:** the 8 shipped cases still validate clean; every **unconverted** choice behaves
  identically (default `hidden`); the single demo choice (§9) is the *only* expected behaviour delta and
  has its own assertion (was-absent → now-visible-and-locked).

---

## 8. Docs

- **`docs/content-authoring.md`** — new authoring rules: *when to hide vs. disable-with-reason* (hide
  when the option's existence would spoil or confuse; disable when a visible-but-locked state builds
  tension or teaches a prerequisite); `gateReason` tone guidance (measured, diegetic — *"The lock holds
  fast; you'd want Ackroyd's key first"*, never *"Requires: Occult 12"*); the `shown` escape-hatch
  caveat.
- **`src/types/index.ts`** — doc comments on the two fields (above).
- **`docs/engine-reference.md`** + **`docs/architecture.md`** — add `choiceVisibility.ts` to the engine
  module list (exported via the `narrativeEngine` barrel) + a data-flow note; record that
  `ChoicePanel`/`encounters` now consume the shared resolver and that the stale
  `ChoicePanel/index.ts` `isChoiceVisible` re-export is removed.
- **`validateBundle` / `ValidateOptions` doc comments** — drop the "warnings = reachability only"
  framing now that a content-shape warning (rule 6) is emitted unconditionally.

---

## 9. Demo (the one content edit)

Convert a single existing gated choice in a shipped case from implicit-hidden to
`visibility: 'disabled'` + a `gateReason`, as a live end-to-end anchor and regression witness. The
specific choice is chosen during implementation (one whose locked state reads well narratively) and
run past the content-integrity reviewer for tone.

**This is a deliberate, single, observable behaviour change** in one shipped case — a previously-absent
choice becomes visible-and-locked while its gate is unmet. It is therefore the **sole** exception to the
"unchanged behaviour" claim (§3, §7): all *other* choices in all 8 cases behave identically, and this
one converted choice has its own explicit before/after assertion so a reviewer can tell the expected
delta from a regression (Codex spec Major 5). If a future reviewer wants literal eight-case identity
instead, the alternative is to demo against a dedicated non-shipped fixture — but converting a real
choice is the more honest end-to-end proof, so that is the chosen path.

---

## 10. Review path

File-based Codex review at all three checkpoints (spec, plan, completed implementation) per CLAUDE.md,
plus a content-integrity review of the demo choice. Merge via merge commit (never squash).

---

## 11. Open questions

None outstanding. The four brainstorm decisions are settled: (1) `visibility` governs the unmet-gate
case, default `hidden`; (2) author-written, validator-enforced `gateReason`; (3) ship vocabulary + one
demo, no retrofit; (4) greyed non-interactive with always-visible reason, no announcer.

## 12. Codex spec review (folded)

File-based Codex spec review ([review](../../../codex/output/2026-07-17-phase5-choice-gating-review.md))
returned 5 Majors + 2 Minors, **all verified against the real code and folded**:
- **Major 1** — escape-path visibility contradiction → §3 + §4.1 + §5 rule 5: `isEscapePath` choices are
  excluded from the vocabulary (validator error if they set the fields), so the resolver is authoritative
  for everything it governs.
- **Major 2** — `gateReason` "iff disabled" not enforced → §5 rules 1+2 (both directions) + a pinned
  "non-empty" definition (trimmed string; non-string/whitespace = absent).
- **Major 3** — "gate present" undefined / compat hazard → §3 single predicate
  `choiceGateConditions(choice).length > 0` (truthy-field only, matching today), + a `requiresFlag: ''`
  compat regression test.
- **Major 4** — `validateChoice` had no warning channel → §5 plumbing: add `warnings` to `Ctx`, thread it
  from `validateBundle`, emit rule 6 unconditionally, retire the "warnings = reachability only" docs.
- **Major 5** — demo vs. zero-edit regression claim contradiction → §7 + §9: the demo is the *sole*
  expected behaviour delta with its own assertion; all other choices unchanged.
- **Minor 1** — non-button markup / focus-order claim → §6: interactive `<nav>` + separate
  `<ul aria-label="Locked choices">`; DOM/reading order, not focus order; role assertions in tests.
- **Minor 2** — stale `isChoiceVisible` re-export + barrel path → §4: remove `ChoicePanel/index.ts:3`,
  import `evaluateConditions` from `./conditions`, export `choiceVisibility` from the barrel.

Codex confirmed the sound parts: the four generated `Condition` variants match the real union, the
table/resolver agree for well-formed non-escape choices, and default-absent stays hard-hidden.
