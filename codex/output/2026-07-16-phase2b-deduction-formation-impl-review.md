# Phase 2b Deduction Formation Implementation Review

**Verdict:** ship-with-fixes.

## Findings

### Major — current-version save hygiene can throw before validation

**Location:** `src/engine/saveManager.ts:194-196`, `src/store/slices/metaSlice.ts:93-95`

`normalizeContested` dereferences every value in the `clues` record without first checking that the value
is an object. `SaveManager.load` invokes migration without a catch, and `metaSlice.loadGame` invokes
`SaveManager.load` before its own `try`, so the exception escapes instead of producing the established
`null` / `false` corrupt-save result.

**Failing scenario:** load an otherwise structurally valid v5 save with
`clues: { bad: null }`. The envelope and record-level guards pass, then
`(clue as { status?: string }).status` throws `TypeError: Cannot read properties of null (reading
'status')`. The load UI receives a rejected action rather than a clean failure. A local probe reproduced
this exact exception.

**Suggested fix:** make `normalizeContested` skip non-plain clue values, strengthen
`isValidGameState` to reject non-object clue entries, and catch migration/validation failures inside
`SaveManager.load`. Apply the same nested-value guard to v4 deduction traversal.

### Minor — one failed component makes successful threads animate as failures

**Location:** `src/components/EvidenceBoard/EvidenceBoard.tsx:277-280`,
`src/components/EvidenceBoard/EvidenceBoard.tsx:334-335`

The board records only an `anyFailed` boolean. When it is true, `slackAndClear` copies **every** board
connection into the failure animation, rather than only edges from `partial`/`incorrect` components.

**Failing scenario:** attempt two components: authored `a-b` (`correct`) and unauthored `x-y`
(`incorrect`). The generic `a+b` deduction forms and `a`/`b` become `deduced`, but both `a-b` and `x-y`
turn into red slack threads. This contradicts the per-component result and the spec's requirement to
slack-animate failed components.

**Suggested fix:** collect failed component clue sets and pass only their internal connections to the
slack animation; still clear the full persisted connection set after the attempt. Add a mixed
`[correct, incorrect]` board test.

### Minor — mixed multi-component attempts omit the required aggregate count

**Location:** `src/components/EvidenceBoard/EvidenceBoard.tsx:82-84`

Aggregate copy appends a count only when `formedCount > 1`, although the spec requires count-bearing copy
when more than one component was evaluated. The function is not given the evaluated component count, so
it cannot satisfy that rule.

**Failing scenario:** the same `[correct a-b, incorrect x-y]` attempt evaluates two components but forms
one deduction. The banner and announcement are only `The connection holds.` rather than count-bearing
mixed-attempt copy. Two failed components similarly report no `0 deductions formed` context.

**Suggested fix:** pass `components.length` into banner selection and append `formedCount` whenever that
count exceeds one; cover one-formed/one-failed and all-failed multi-component attempts.

## Verified Closed

- Recipe matching uses player union-find topology, filters self/missing/unrevealed/inherited endpoints,
  and forms every matching recipe.
- Generic classification uses undirected authored `connectsTo`; generic IDs are sorted and the validator
  enforces both clue-id charset and the reserved namespace.
- `markCluesDeduced` claims successful clues atomically; fail-to-success and fail-to-fail stale reverts
  are token-gated, timers survive board unmount, and case/save loads cancel them.
- v4 `connected` recovery and all-version `contested` hygiene are implemented; malformed top-level
  `clues` records remain rejectable.
- The empty-classification guard, repeat attempts, and recipe-member-only `deduced` marking are present.

## Verification

- `npm run test:run`: 680/680 passed.
- Focused Phase 2b suites: 133/133 passed.
- `npm run build`: passed.
- `npm run lint`: passed.
- Content validator: 8/8 bundles passed.
