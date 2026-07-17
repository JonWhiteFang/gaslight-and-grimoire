Verdict: **Not implementation-ready** - the core resolver is sound for well-formed, non-escape choices, but five Major contract gaps can produce validator/runtime disagreement or mutually impossible acceptance tests.

## Findings

### Major 1 - Escape choices have two contradictory visibility contracts

**Location:** Spec section 3 table and invariants (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:74-88`), resolver logic (`:107-113`), encounter exception (`:121-125`), and validator rules (`:137-148`). Current escape filtering is an explicit condition check in `src/engine/encounters.ts:211-216`.

**Failure:** For an escape choice with an unmet gate and `visibility: 'shown'`, the shared resolver returns `shown` and the validator warns that the gate "will not hide or disable it", but section 4 says the encounter caller includes escape paths only when the gate is met. The same mismatch lets an escape choice declare `visibility: 'disabled'` plus a valid `gateReason`; it passes all proposed validation yet is hard-hidden, so its authored reason can never render. Thus `resolveChoiceVisibility` is not actually authoritative for all choices, and valid content can behave contrary to both its field value and validator message.

**Suggested fix:** Make the exception part of the schema contract. If locked escapes must remain hidden, reject `visibility: 'shown' | 'disabled'` and `gateReason` on `isEscapePath` choices (or permit only absent/`hidden`) and test those errors. Alternatively, remove the exception and let escape choices obey the resolver. Do not leave this as an unvalidated caller override.

### Major 2 - The validator does not enforce the declared `gateReason` "iff"

**Location:** The field contract says `gateReason` is required iff `visibility === 'disabled'` (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:67-68`) and meaningful only in the resolved disabled state (`:87-88`), but proposed errors 1-2 only cover missing reasons for disabled choices and reasons on choices with no gate (`:137-142`).

**Failure:** A gated choice such as `{ requiresClue: 'c', gateReason: '...', visibility: 'hidden' }` (or with absent/`shown` visibility) passes the proposed rules. The resolver then hides or enables it and no caller displays the reason. A typo that omits `visibility: 'disabled'` therefore validates cleanly while silently discarding authored content. Rule 2 also excludes explicit `visibility: 'hidden'` on a no-gate choice even though the semantics table makes that value a no-op; its rationale and error text imply that any meaningless explicit visibility should be caught.

**Suggested fix:** Specify the complete truth table: a non-blank, trimmed `gateReason` is required when and allowed only when `visibility === 'disabled'`; otherwise its presence is an error. Decide explicitly whether every `visibility` value on a no-gate choice is an error, or document why no-op `hidden` is allowed. Define "present" and "non-empty" so whitespace-only and non-string JSON cannot pass or crash validation.

### Major 3 - "Gate present" is undefined in a way that can break backward compatibility

**Location:** Spec section 3 uses "gates present" (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:76-82`) and section 5 says "no `requires*` gate" (`:140-142`) without defining the predicate. Existing callers add string gates only on truthiness (`src/components/ChoicePanel/ChoicePanel.tsx:27-44`; `src/engine/encounters.ts:193-209`), and `evaluateConditions([])` returns true (`src/engine/conditions.ts:40-46`). Existing validation likewise ignores empty string targets (`src/engine/contentValidation.ts:362-379`).

**Failure:** An existing malformed-but-accepted choice with `requiresFlag: ''` is currently treated as ungated and shown. An implementer using "field is present" (`!== undefined`) will build a `hasFlag` condition for `''` and hide it, violating the promised exact default compatibility. An implementer preserving truthiness in `choiceGateConditions` but using property presence in validation can instead accept `visibility: 'disabled'` as gated while the resolver sees zero conditions and always shows it. JSON is cast to TypeScript types rather than structurally parsed (`src/engine/contentLoader.ts:153-160`), so blank/null runtime values are not hypothetical type-system impossibilities.

**Suggested fix:** Define one shared effective-gate predicate, preferably `choiceGateConditions(choice).length > 0`, and require the validator to use it. Also reject blank string gate targets and malformed `requiresFaculty` values. Add compatibility tests for empty strings/nulls or explicitly declare them newly invalid rather than claiming exact behavior for every prior input.

### Major 4 - `validateChoice` has no warning channel

**Location:** The spec says `validateChoice` gains a non-fatal warning (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:132-148`). In the actual validator, `warnings` is local to `validateBundle` (`src/engine/contentValidation.ts:80-85`), `Ctx` contains only `errors` (`:315-321`), and `validateChoice` receives only that context (`:353`). The CLI already prints returned warnings without failing (`scripts/validateCase.ts:64-73`, `:96-115`).

**Failure:** The named function cannot implement rule 4 as specified. One implementer may push it into `errors` and make the legal soft-gate fail CI; another may gate it behind `includeReachability`, making a content-shape warning depend on an unrelated graph-analysis option; another may omit it. The current validator documentation also describes warnings as opt-in reachability observations, which would become false.

**Suggested fix:** Explicitly add `warnings` to `Ctx`, pass it from `validateBundle`, and emit the soft-gate warning unconditionally (the runtime wrapper already discards warnings). Update the `ValidateOptions`/API comments and test both default `validateBundle` and CLI behavior: warning returned/printed, zero errors, exit success.

### Major 5 - The demo makes the stated regression criterion impossible

**Location:** The spec says existing cases are untouched except one demo (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:19-21`), then claims all eight cases are unchanged with zero edits (`:84-86`) and "behave identically" (`:185`), while section 9 requires converting a choice in a shipped case from hidden to disabled (`:203-208`).

**Failure:** The demo deliberately changes observable behavior in one of the eight shipped cases: an unmet choice that was absent becomes visible and locked. An implementation cannot satisfy both the demo requirement and the zero-edit/identical-behavior regression assertion, so reviewers cannot tell whether that expected difference is a failure.

**Suggested fix:** State that all *unconverted* choices retain exact behavior and identify the demo as the sole expected behavior delta. If literal eight-case identity is required, put the demo in a dedicated fixture or new non-shipped content unit instead of converting shipped content.

### Minor 1 - The proposed non-button markup does not support the stated navigation/focus claim

**Location:** Spec section 6 (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:157-170`). Both current panels place choices inside navigation landmarks (`src/components/ChoicePanel/ChoicePanel.tsx:105-122`; `src/components/EncounterPanel/EncounterPanel.tsx:145-159`).

**Failure:** A non-focusable note is intentionally absent from keyboard tab order, so keyboard users do not "reach" it after the actionable choices as claimed; only visual reading or screen-reader browse order does. A bare `<li>` directly under the existing `<nav>` would also be invalid list markup, while a `role="note"` under a landmark labelled "Available choices" mixes unavailable prose into a navigation-only contract. The proposed tests check non-interactivity but not coherent landmark/list semantics.

**Suggested fix:** Specify a containing section with an interactive choices `<nav>` followed by a properly labelled locked-choices `<ul>` (with real `<li>` children), or rename/restructure the landmark to cover both groups. Change the claim to DOM/reading order, not keyboard focus order, and add an accessibility-role assertion.

### Minor 2 - Removing the helper leaves an existing broken re-export, and the new engine API has no specified barrel path

**Location:** The spec removes `isChoiceVisible` (`docs/superpowers/specs/2026-07-17-phase5-choice-gating-design.md:115-120`), but `src/components/ChoicePanel/index.ts:3` re-exports it. The engine barrel currently exports only four modules (`src/engine/narrativeEngine.ts:14-17`), and the spec never says whether to add `choiceVisibility`.

**Failure:** Deleting the helper without updating the component index fails TypeScript compilation. Separately, callers can diverge between direct imports and the established engine barrel; importing `evaluateConditions` back through the barrel from the new module would also create an avoidable barrel cycle.

**Suggested fix:** Include removal of the stale component re-export. Have `choiceVisibility.ts` import `evaluateConditions` directly from `./conditions`, and explicitly export `choiceVisibility` from `narrativeEngine.ts` if it is part of the public engine surface.

## Worth Preserving

- The four generated condition variants exactly match the real `Condition` union: `hasClue`, `hasDeduction`, `hasFlag`, and `facultyMin` with the correct targets/values (`src/types/index.ts:152-161`).
- For well-formed non-escape choices, the table and resolver agree, including no conditions resolving to shown and multiple gates retaining existing AND semantics.
- Default absent visibility remains hard-hidden for unmet real gates, and the pure resolver can remain store-free and RNG-free.
- Author-written reasons, no odds tag on locked choices, redundant visual/text cues, and warnings remaining non-fatal are all appropriate constraints.
