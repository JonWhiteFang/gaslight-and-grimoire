# Adversarial implementation review - The Orrery Room

**Verdict:** Not ready to ship. The shipped Orrery content is internally sound, and all
verification gates pass, but two engine seams can silently lose the new vignette
behavior: optional variant loading collapses every failure into "file absent", and a
throwing `onForm` effect leaves its deduction recorded while permanently suppressing the
effect on retry.

## Findings

### 1. Major - vignette variants are silently discarded on server, network, or JSON errors

**Evidence:** `loadVignette` converts every rejection from the `variants.json` request
to an empty variant list (`src/engine/contentLoader.ts:121-123`). The rejected promise
does not distinguish an intentional 404 from a 500 response, a network failure, or
invalid JSON: all of those flow through the same `fetchJson` rejection path
(`src/engine/contentLoader.ts:163-170`). The loader test covers only a 404 fallback and
a successful response (`src/engine/__tests__/contentLoader.vignette.test.ts:36-41`,
`:57-76`).

This matters for Orrery even when every other file loads correctly. Its three earned
ending paragraphs exist only in `variants.json`
(`public/content/side-cases/the-orrery-room/variants.json:28-70`). If that one request
returns 500 or its deployed JSON is malformed, the vignette still passes runtime
validation and plays, but all three `-named` endings and the Veil Sight scene silently
vanish. The completion fix cannot recover prose the loader discarded.

**Concrete fix:** Make optional loading status-aware: return the fallback only for an
actual 404, and rethrow network, non-404 HTTP, and parse failures so case loading fails
visibly. Add tests for 404 fallback, 500 rejection, and malformed-JSON rejection for
both optional files.

### 2. Major - a throwing `onForm` permanently records a half-formed deduction

**Evidence:** The board snapshots the once-guard, writes the deduction, and only then
runs `onForm` (`src/components/EvidenceBoard/EvidenceBoard.tsx:322-328`). If
`applyEffects` throws, the handler exits with the deduction already in the store; on
the next attempt that id is present, so `isNew` is false and `onForm` is never retried.
Earlier effects in a multi-effect list can also remain applied.

The content validator does not make this impossible. `validateEffect` checks only a
few known target references and has no effect-type allowlist or required-field checks
(`src/engine/contentValidation.ts:501-512`), while runtime application deliberately
throws for an unknown JSON effect type (`src/store/slices/worldSlice.ts:64-68`).
Consequently malformed future content can pass load validation, throw during formation,
and violate the documented "exactly once at first formation" contract
(`docs/engine-reference.md:158`; `docs/content-authoring.md:386-393`).

**Concrete fix:** Reject unknown effect types and invalid per-type shapes at content
load. Make recipe formation transactional (deduction, effects, and clue statuses in one
store action), or at minimum do not publish the deduction until all effects succeed.
Add a regression that forces `applyEffects` to throw and asserts no deduction/partial
effect is committed and a corrected retry can still apply `onForm`.

### 3. Minor - the completion regression test is false-green at the integration seam

**Evidence:** The new test calls only `resolveEndingNarrative` directly
(`src/components/__tests__/caseCompletionVariant.test.tsx:66-84`). It never renders
`App`, clicks the terminal button, or observes `CaseCompletion`. Restoring the old base
scene lookup in `handleCompleteCase` while leaving the helper unused would keep all four
tests green; the production wiring being protected is at `src/App.tsx:243-252`.

The implementation itself is correctly ordered: Zustand updates are synchronous, the
snapshot is taken before `completeCase`, and `completeCase` does not clear deductions
(`src/store/slices/narrativeSlice.ts:262-265`). This is a test defect, not a current
runtime race.

**Concrete fix:** Add an App-level test seeded on a terminal base id with the keystone
deduction, click **Case Complete**, and assert that the rendered completion quote
contains the variant-only paragraph.

### 4. Minor - updated documentation is already stale

**Evidence:** The engine reference still says the generic deduction path is "the only
path for vignettes" (`docs/engine-reference.md:171`), but vignettes now carry recipes
(`src/types/index.ts:349-357`) and Orrery ships two
(`public/content/side-cases/the-orrery-room/deductions.json:2-20`). The source comment
for `CaseData.recipes` also still says "main cases only" (`src/types/index.ts:337-338`).

`docs/status.md:112-113` records 849 tests / 88 files. The branch's current full run is
853 tests / 89 files; the four completion-helper tests were added after that baseline.

**Concrete fix:** Describe the generic path as the path for any component matching no
recipe, remove the main-case-only source comment, and update the verified test baseline
to 853 / 89.

## Areas examined and sound

- The unlock registry uses the exact Grey Dawn key and inclusive threshold
  (`src/engine/caseProgression.ts:54-56`); threshold, below-threshold, and
  already-unlocked witnesses are present.
- CLI vignette variants reach the shared validator (`scripts/validateCase.ts:45-50`).
  Its fixture genuinely goes RED if the variants read is removed because the broken
  `vf-nowhere` edge exists only in the variant
  (`src/engine/__tests__/fixtures/vignette-broken-variant/variants.json:8-16`).
- `computeDiscoverableClues` now counts reachable `onEnter: discoverClue`
  (`src/engine/contentValidation.ts:631-643`), with a non-vacuous warning regression.
- For valid effects, `onForm` works after terminal entry and its existing-deduction
  guard survives save/load. A generic deduction cannot have `onForm`: the oracle enters
  the generic path only when no recipe matched (`src/engine/deductionOracle.ts:67-88`).
  Distinct recipes are classified before any effects run, so one recipe's flag effect
  cannot change whether another recipe in the same component matches. Their execution
  order is deterministic.
- Completion narrative capture has no deduction-state race: the current store snapshot
  is resolved before completion side effects (`src/App.tsx:243-252`). Unknown scenes and
  absent case data return null; halt scenes never expose the completion button.
- The content graph has no dead end. Act 1 cannot close until the hub's gear clue is
  revealed (`public/content/side-cases/the-orrery-room/scenes.json:112-121`); the dosage
  scene is reached from both held and broken vigil paths (`:364-371`, `:383-405`) and
  states the complete mundane solution on the critical path (`:413-416`). Broker
  partial/failure/fumble returns to the verdict hub, where both partisan choices remain
  ungated (`:517-557`).
- All ending JSON puts disposition effects before direct reputation
  (`public/content/side-cases/the-orrery-room/scenes.json:567-598`), and the witness
  exercises both mid-range and +10-clamp behavior.

## Verification

- `npm run test:run` - 853 passed / 89 files
- `npm run lint` - clean
- `node scripts/validateCase.mjs` - 9 units, zero errors, zero warnings
- `npm run build` - green
