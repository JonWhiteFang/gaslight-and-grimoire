# Design: Rebuild Documentation as a Lean, Accurate Baseline under `docs/`

**Date:** 2026-07-07
**Status:** Approved (pending spec review)
**Topic:** Delete the current `devdocs/` documentation tree and rebuild it from scratch as a small, high-signal, code-accurate doc set living under `docs/`.

---

## 1. Motivation

The current `devdocs/` tree is **34 files / ~376K** across six sub-taxonomies
(`archaeology/`, `archaeology/traces/`, `archaeology/concepts/`,
`archaeology/foundations/`, `foundations/`, `evolution/`, `specs/`). It is both
**bloated** (hard to read and maintain) and **drifting** (fixed bugs still listed
as open, stale test counts, references that no longer match the code).

The goal is a **fresh, accurate baseline**: a lean core of ~5 files that faithfully
describe the code *as it is today* and are easy to keep current. Every factual
claim must be verified against the live code, not copied from the old docs.

All documentation consolidates under **`docs/`** — there will be no separate
`devdocs/` folder. This sits alongside the existing design bible
(`docs/Gaslight_&_Grimoire_design.md`). GitHub Pages deploys from the Vite `dist`
build artifact via Actions (`.github/workflows/deploy.yml`), **not** from `/docs`,
so placing docs there does not affect the published site.

---

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Motivation | Fresh + accurate baseline (bloated *and* drifting → start clean) |
| Footprint | Lean core, 5 files |
| Structure | Approach A — organized by task/audience |
| `Req X.Y` numbering in docs | **Dropped** — not carried forward |
| `Req X.Y` references in code | **Stripped** from source (comments + test labels) |
| CLAUDE.md | Rewrite the "Deep Documentation (devdocs/)" section + fix stale references |
| `GAME_DESIGN_ANALYSIS.md` | Folded into the new docs, then removed |
| `AUDIO_ASSET_LIST.md` | Folded into the new docs, then removed |
| `docs/Gaslight_&_Grimoire_design.md` | **Kept as-is**; new docs reference it as the design-intent bible |
| Status doc scope | **Current state only** — no forward-looking gaps/roadmap section |

---

## 3. The New Doc Set (5 files, all under `docs/`)

The design bible `docs/Gaslight_&_Grimoire_design.md` remains in place. The 5 new
files are added alongside it under `docs/`:

| File | Purpose | Answers |
|---|---|---|
| `docs/README.md` | Orientation + map to the other 4 docs and to `docs/Gaslight_&_Grimoire_design.md` (the vision bible) | "Where do I start?" |
| `docs/architecture.md` | Component hierarchy, six store slices + actions, 10 engine modules, runtime data flow, cross-slice couplings, determinism / `Date.now()` notes | "How does the system fit together?" |
| `docs/engine-reference.md` | Per-module function signatures + behavior for every file in `src/engine/` | "How do I call/change the engine?" |
| `docs/content-authoring.md` | Case/vignette JSON schemas, full `Condition` & `Effect` catalog, validation workflow, authoring rules, **audio asset reference (folds in `AUDIO_ASSET_LIST.md`)** | "How do I write a case?" |
| `docs/status.md` | Current state only: what's built, content inventory, live test baseline. **Absorbs the still-true substance of `GAME_DESIGN_ANALYSIS.md`.** No forward-looking gaps section. | "What exists right now?" |

### Deliberately dropped from the old set
- The `Req X.Y` numbering scheme (old `specs/requirements.md`).
- All 10 execution traces (`archaeology/traces/`).
- Concept inventories (`archaeology/concepts/`).
- Foundations files (`foundations/`, `archaeology/foundations/`).
- Evolution docs (`evolution/gap_analysis.md`, `implementation_roadmap.md`, `refactoring_opportunities.md`).
- Cleanup inventories, `5_things_or_not.md`, `concept_mappings.md`, etc.

Their still-true substance is absorbed into the 5 files above where relevant; the
rest is discarded.

---

## 4. Accuracy Discipline

This is the core of a "fresh, accurate baseline." Nothing is copied from the old
docs without re-verification. Sources of truth:

- **File/function inventories** — read from `src/` directly (engine modules, store
  slices, components).
- **Test baseline** — actually run `npm run test:run` and record the real numbers,
  replacing the stale "334 tests / 29 files" claim.
- **`Condition` / `Effect` catalogs** — read from `src/types/index.ts` and the
  slices/engine functions that consume them.
- **Content totals** (scenes / clues / NPCs / cases) — validated against
  `public/content/` (and cross-checked with `node scripts/validateCase.mjs`).
- **Store slice/action tables** — read from `src/store/slices/*`.
- **Cross-slice couplings** (e.g. `adjustDisposition` → `adjustReputation`) — read
  from the actual slice code, not the old CLAUDE.md summary.

---

## 5. Scope Beyond Docs: Strip `Req X.Y` References

~37 source files reference `Req X.Y` in comments and test `describe`/`it` labels.
These are **documentation strings, not logic** — they appear in JSDoc comments,
inline comments, and test display names, never in assertions or control flow.

**Action:** Remove/rewrite every `Req X.Y` mention across `src/`.

**Guarantees:**
- No change to any assertion, control flow, or runtime behavior.
- Test *display names* change (e.g. `describe('AbilityButton — available state (Req 15.6)')`
  → `describe('AbilityButton — available state')`) but the tests themselves are untouched.
- Verified by running `npm run test:run` before and after and confirming the count
  of passing tests is unchanged.

**Approach for edits:** mechanical, per-file. Two shapes to handle:
1. Trailing parenthetical in a test label: `(Req 15.6)` → removed, including the
   leading space.
2. Comment lines/tags: `// Encounter extensions (Req 9)` → `// Encounter extensions`;
   whole JSDoc lines that are *only* a `Req` reference (e.g. `* Req 5.1–5.7`) → line removed.

Every file will be read and edited deliberately (not a blind global regex) to avoid
mangling surrounding text or leaving dangling punctuation.

---

## 6. CLAUDE.md Update

- Rewrite the "Deep Documentation (devdocs/)" section (currently ~lines 7–51,
  listing all 34 deleted files) to a "Documentation (docs/)" section pointing at
  the 5 new files (and the design bible) with one-line hooks.
- Fix the two other spots that reference `devdocs/...` paths and the stale
  "334 tests across 29 files" count (update to the real, freshly-run number).
- Remove references to the now-deleted `GAME_DESIGN_ANALYSIS.md` and
  `AUDIO_ASSET_LIST.md`; point at the new homes.
- Leave the rest of CLAUDE.md (architecture, store, engine, content rules,
  archetypes) intact — it is largely accurate and out of scope.

---

## 7. Kept Untouched

- `docs/Gaslight_&_Grimoire_design.md` — the canonical 1087-line design-intent
  bible (concept, world, mechanics, character system, narrative structure,
  original roadmap). New docs reference it for vision/rationale rather than
  duplicating its world-building.
- All `src/` logic and test assertions.
- All `public/content/` JSON.

---

## 8. Execution Order

1. Run `npm run test:run` to capture the **before** baseline (test count).
2. Read the live code to gather accurate inventories (engine, store, components,
   types, content).
3. Write the 5 new files under `docs/`.
4. Delete the old `devdocs/` tree (34 files).
5. Strip `Req X.Y` references from the ~37 source files.
6. Run `npm run test:run` again — confirm the passing-test count is unchanged.
7. Remove `GAME_DESIGN_ANALYSIS.md` and `AUDIO_ASSET_LIST.md` (content now folded in).
8. Update `CLAUDE.md`.
9. Final verification pass (no dangling `devdocs/` or `Req X.Y` references remain;
   docs match code).

---

## 9. Success Criteria

- The `devdocs/` folder no longer exists; the 5 new files live under `docs/`
  alongside the design bible.
- `docs/` contains exactly the 5 new files plus `Gaslight_&_Grimoire_design.md`
  (and the `docs/superpowers/specs/` design doc), each high-signal and code-accurate.
- No doc claim contradicts the live code (spot-verified against `src/` and
  `public/content/`).
- `grep -rE "Req [0-9]" src/` returns nothing.
- `npm run test:run` passing-test count is identical before and after.
- No file (docs or code) references a deleted path (`devdocs/...`,
  `GAME_DESIGN_ANALYSIS.md`, `AUDIO_ASSET_LIST.md`).
- CLAUDE.md's documentation section maps cleanly to the 5 new files.
