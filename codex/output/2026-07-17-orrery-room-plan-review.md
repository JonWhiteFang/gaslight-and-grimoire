# Adversarial review - The Orrery Room implementation plan

**Verdict:** Not implementation-ready. Two tasks cannot pass as written: T2's fetch
fixture never satisfies `loadVignette`'s mandatory shared-scene requests, and T7/T8
omit the validator-required `fumble` outcome from every faculty check. The plan also
has false-green CLI verification and drops several behavioral witnesses required by
the folded spec.

## Findings

### 1. Blocker - every planned faculty check is missing the fifth outcome tier

**Plan task/step:** T7 Step 1 and T8 Step 1
(`docs/superpowers/plans/2026-07-17-orrery-room.md:707-710`, `:733-750`,
`:776-780`, `:831-847`, `:869-885`).

**Repo evidence:** `OutcomeTier` has five values, including `fumble`
(`src/types/index.ts:31-36`), `OUTCOME_TIERS` includes all five
(`src/engine/constants.ts:10`), and the validator errors for every missing tier on a
faculty check (`src/engine/contentValidation.ts:442-450`). The authoring guide states
the same rule explicitly (`docs/content-authoring.md:266-269`).

The plan instead says checks have "four outcomes" and omits `fumble` from all five:
period match, Finch pressure, initial vigil, vigil return, and brokered verdict. The
claimed T8 zero-error validation therefore cannot occur.

**Concrete fix:** Require all five tiers in T7/T8. Route `fumble` with `failure` for
period match, Finch pressure, vigil return, and the brokered verdict; route the initial
vigil's `fumble` to `or-act2-vigil-broken`.

### 2. Blocker - T2's loader tests 404 on mandatory shared scenes

**Plan task/step:** T2 Steps 1-4
(`docs/superpowers/plans/2026-07-17-orrery-room.md:142-204`).

**Repo evidence:** `loadVignette` always starts `loadSharedScenes`
(`src/engine/contentLoader.ts:103-115`), which fetches
`shared/breakdown.json` and `shared/incapacitation.json`
(`src/engine/contentLoader.ts:45-56`). The proposed fixture provides only the
nonexistent `shared/scenes.json`. The test it claims to mirror provides both actual
URLs as individual `SceneNode` objects and resets the module cache
(`src/engine/__tests__/sharedSceneCache.test.ts:25-45`).

Both proposed tests reject before checking optional deductions or variants, even after
the production implementation is correct. The missing `_resetSharedScenesCache()` also
makes results order-dependent when this module is run with other loader tests.

**Concrete fix:** Map both real shared URLs to individual scene objects, import and call
`_resetSharedScenesCache()` in `beforeEach`, and unstub globals in `afterEach`. Keep the
`ok: false, status: 404` response for the two optional files.

### 3. Major - T3's verification is false-green and violates the stated TDD rule

**Plan task/step:** T3 Steps 1-2 and T8 Step 3
(`docs/superpowers/plans/2026-07-17-orrery-room.md:313-349`, `:946-951`).

**Repo evidence:** The current CLI omits vignette variants because the read is inside
the main-case branch (`scripts/validateCase.ts:30-57`). Variant structural checks and
variant-gated-recipe discovery only run when variants reach `validateBundle`
(`src/engine/contentValidation.ts:115-129`, `:265-287`).

T3 validates only today's eight units, none of whose vignettes has variants, so its
command passes before the change. T8 adds valid variants; zero errors also passes if
the CLI still silently skips them. Neither step proves T3 worked, despite the plan's
global RED-before-implementation rule (`docs/superpowers/plans/2026-07-17-orrery-room.md:13-15`).

**Concrete fix:** Add an importable `loadBundle`/`validateUnit` test or a CLI fixture
test containing a malformed vignette variant, a variant soft-lock warning, and a
`hasDeduction` variant that activates F-102. Watch that test fail before moving the
variants read.

### 4. Major - the content-task commits contradict the zero/zero non-negotiable

**Plan task/step:** T6, T7 Step 2, and the global task rules
(`docs/superpowers/plans/2026-07-17-orrery-room.md:13-18`, `:585-597`,
`:807-819`).

T6 deliberately commits clues whose `sceneSource` scenes do not exist and no
`scenes.json`. T7 then commits an unresolved `or-act2-night-vigil` outcome/source and
explicitly expects validator errors. This directly contradicts "zero errors, zero
warnings after every content task" and leaves two intentionally broken commits.

**Concrete fix:** Combine T6-T8 into one content task/commit, or create a complete,
structurally valid scene skeleton in T6 and fill prose incrementally. Every content
commit should run the full CLI and remain zero/zero.

### 5. Major - T9's proposed file does not run in this ESM test setup

**Plan task/step:** T9 Step 1
(`docs/superpowers/plans/2026-07-17-orrery-room.md:978-1034`).

**Repo evidence:** The package is ESM (`package.json:5`), so `__dirname` used at plan
line 985 is unavailable. Existing source-reading tests resolve from
`fileURLToPath(import.meta.url)` and opt into Node types
(`src/components/__tests__/reducedMotion.coverage.test.tsx:32-48`). The plan also calls
`stateWith(...)`, but defines no such helper; the choice-visibility fixture is a
file-local `makeState`, not an export
(`src/engine/__tests__/choiceVisibility.test.ts:5-19`).

The actual imports and API order are otherwise correct:
`resolveChoiceVisibility(choice, state)` returns `'shown' | 'disabled' | 'hidden'`
(`src/engine/choiceVisibility.ts:21-54`).

**Concrete fix:** Prefer direct JSON imports, matching
`phase5DemoChoice.test.ts`, and define a local `makeState` fixture. Alternatively use
`fileURLToPath(import.meta.url)` plus a Node type reference.

### 6. Major - structural T9 assertions replace required behavioral witnesses

**Plan task/step:** T2 tests, T5 board test, and T9 Step 1
(`docs/superpowers/plans/2026-07-17-orrery-room.md:183-299`, `:499-568`,
`:995-1108`).

**Repo/spec evidence:** The folded spec requires a present-files path through
loader -> adapter -> store and save/load (`docs/superpowers/specs/2026-07-17-orrery-room-design.md:91-98`).
It also requires witnesses that the keystone is actually mintable, ending variants
actually resolve, all endings are reachable without the cross-case flag, and `onForm`
sets the flag when formation happens after entering an ending
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:276-288`).

The plan only:

- tests loader and adapter separately, never `loadGame` with present recipes/variants;
- inspects `requiredClues` and `onForm` JSON, never calls `classifyBoard`;
- inspects `variantCondition`, never calls `resolveScene`;
- checks two ungated partisan edges, not flagless formation of
  `or-genuine-instrument` and access to the sealed ending;
- tests generic `onForm` formation, not the after-terminal-entry scenario.

These tests can stay green while the integrated behaviors named by the spec are broken.
This also loses the regression fixture requested by original Codex finding 2 and the
terminal-formation witness requested by finding 5. Original finding 10's 404
compatibility path is indirectly covered by the existing vignette `loadGame` test
(`src/store/__tests__/metaSlice.loadGame.test.ts:160-178`), but the new present-files
round trip is not.

**Concrete fix:** Add integration witnesses that:

1. load and save/reload a vignette with recipes and variants into `caseData`;
2. form both real recipes through `classifyBoard`/EvidenceBoard;
3. enter a base ending, form the keystone, and assert both deduction and persistent flag;
4. call `resolveScene` for each ending with the keystone deduction;
5. form `or-genuine-instrument` without `mythos-period-computed` and resolve the broker
   choice as selectable.

### 7. Minor - several earlier RED snippets name helpers that do not exist

**Plan task/step:** T1 Step 1, T4 Step 1, T5 Step 2.

**Repo evidence:**

- T1 calls `baseGameState()` and refers to `makeGameState`, but the file's helper is
  `makeState` (`src/engine/__tests__/caseProgression.test.ts:28-67`). Its RED claim is
  also wrong: only the threshold test fails before implementation; the below-threshold
  test already passes.
- T4's raw clue uses `discovered: false` and omits required `Clue` fields; the file
  already provides `makeBundle`, `makeScene`, and `makeClue`
  (`src/engine/__tests__/contentValidation.test.ts:18-72`).
- T5 calls nonexistent `bundleWith`; the deduction test's helper is `bundle`
  (`src/engine/__tests__/contentValidation.deduction.test.ts:5-17`).

**Concrete fix:** Rewrite each snippet against the real local helper names. For T5 use
the existing `c-a` clue so the RED result is solely the missing `onForm` target error.

### 8. Minor - the clue authoring instruction names a nonexistent state field

**Plan task/step:** T6 Step 4
(`docs/superpowers/plans/2026-07-17-orrery-room.md:642-663`).

**Repo evidence:** The plan says to author `discovered: false`, but `Clue` requires
`tags`, `status`, and `isRevealed`; there is no `discovered` field
(`src/types/index.ts:73-84`). Shipped clue JSON uses `"status": "new"` and
`"isRevealed": false` (`public/content/side-cases/the-rationalists-dilemma/clues.json:3-7`).
The validator casts JSON and does not schema-check these fields, so this mistake can
survive the zero/zero gate and fail later in board code.

**Concrete fix:** Specify the complete clue objects with `tags`, `"status": "new"`,
and `"isRevealed": false`; remove `discovered`.

### 9. Minor - the binding scene list is 21 base scenes, not 18

**Plan task/step:** Architecture/file map, T7, and T8
(`docs/superpowers/plans/2026-07-17-orrery-room.md:7`, `:43`, `:702-805`,
`:823-928`).

T7 is titled "10 scenes" but binds 11 IDs. T8 is titled "8 scenes" but binds 10 base
IDs, for 21 base scenes plus four variants. That disagrees with the plan's repeated
18-base claim and exceeds the spec's approximate 16-20 range
(`docs/superpowers/specs/2026-07-17-orrery-room-design.md:13-16`).

**Concrete fix:** Decide the intended graph before implementation: merge/remove three
beats to retain 18, or update the plan/spec/count expectations consistently to 21.

## Areas checked and sound

- **T5 once-guard:** For valid unique recipe IDs, snapshotting `deductions` before the
  loop is correct. Zustand `set` calls are synchronous, different recipe IDs cannot
  interfere, and a later board attempt re-reads the record. Save/load restores
  deductions and flags together (`src/store/slices/metaSlice.ts:119-143`).
- **F-102 after the fixes above:** With vignette variants loaded, both recipes are
  classified as gated. Gear/Finch and all three keystone clues have non-critical
  sources. The period scene is reachable through success/partial, and the night clue
  through vigil success. T4's onEnter collection removes the onEnter-only false warnings.
- **Phase 5 rules:** The disabled keystone choice has a reason and multiple ungated hub
  exits. The hidden broker choice has two ungated alternatives. Self-routing failed
  checks are valid and produce no validator warning.
- **Ending variant effects:** A deduction formed on a terminal base ending causes
  reactive prose re-resolution but does not call `goToScene`; the authored graph has no
  route back into that terminal. Thus base and variant effects cannot both fire through
  normal play. If a future edit makes endings revisitable, F-118's resolved-ID behavior
  would make the copied effects fire again and this must be revisited.
- **Clamp arithmetic:** Disposition `-3` propagates `-1.5`; from rep 0 the authored
  partisan order ends at `+0.5`. From rep 10, disposition-first reaches 8.5 then the
  `+2` clamps to 10; reversed order ends at 8.5. T9's intended expected values are
  correct.
- **Folded spec coverage:** Original findings 1, 3, 4, 6, 7, 8, and 9 have concrete
  plan artifacts. Findings 2 and 5 have implementation artifacts but inadequate
  regression witnesses as noted above; finding 10 retains an existing compatibility
  witness.
