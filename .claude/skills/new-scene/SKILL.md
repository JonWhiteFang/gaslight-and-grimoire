---
name: new-scene
description: Scaffold a correct-by-construction SceneNode (and optionally a Choice / ClueDiscovery / variant) for a Gaslight & Grimoire case or vignette, then validate. Use when authoring new narrative content under public/content/.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Bash(node scripts/validateCase.mjs), Bash(node scripts/validateCase.mjs :*)
---

# New Scene — author content correct-by-construction

Scaffold a new `SceneNode` (and its `choices` / `cluesAvailable` / any `variant`) into an existing
case or vignette so it satisfies the schema and the authoring rules on the first pass, then prove it
with the validator. Content is JSON under `public/content/`; no code changes are needed to add a scene.

**Authoritative references — read before writing:**
- `docs/content-authoring.md` — the full schema, Condition/Effect catalogs, file shapes, and the
  authoring rules. This skill is a workflow around it, not a replacement.
- `.claude/skills/new-scene/scene-template.json` (bundled here) — an annotated SceneNode skeleton.
- `src/types/index.ts` — the single source of truth for content types if any doubt remains.

## Workflow

1. **Locate the target file.** Main case → `public/content/cases/<id>/act{1,2,3}.json`
   (each is `{ "scenes": [...] }`). Vignette → `public/content/side-cases/<id>/scenes.json`.
   A cross-case variant → `variants.json` (`{ "variants": [...] }`). Read the file first to match
   the surrounding style, id conventions, and `act` number.

2. **Draft the SceneNode** from `scene-template.json`. Hold these invariants (see the reference for
   the why):
   - `id` unique within the case; `narrative` is the body field (**not** `text`); set `act` to match.
   - Every `choice.outcomes.<tier>` target must be a real scene id. A **faculty-check choice**
     (`faculty` + `difficulty` **or** `dynamicDifficulty`) requires **all five** tiers
     (`critical`, `success`, `partial`, `failure`, `fumble`); a non-check choice typically defines
     just `success`.
   - **No single faculty may gate critical progress** — always give an alternate path
     (different faculty, clue-/deduction-gated option, or mundane fallback).
   - **Branching must be meaningful** — outcomes must differ in scene, clue, or state, not be cosmetic.
   - Gate choices with `requiresClue` / `requiresDeduction` / `requiresFlag` / `requiresFaculty`
     (a bare `conditions` array on a Choice is **not** evaluated at runtime).
   - `onEnter` effects use the Effect catalog; add an optional `description` for authored feedback.
   - Tone: measured, atmospheric, Victorian-gaslit — never campy.

3. **Wire the edges.** If other scenes should reach this one, add the new id to their choice
   `outcomes`. If this scene discovers a clue, either declare it in `cluesAvailable`
   (`automatic` | `dialogue` | `exploration` | `check`) or via an `onEnter` `discoverClue` effect —
   and make sure that clue exists in `clues.json` (add it if new: author `status: "new"`,
   `isRevealed: false`). A **variant** must set `variantOf` (an existing base/shared scene id) and
   `variantCondition`, and must NOT be a choice-outcome target (variants resolve in place).

4. **Validate — do not skip.** Run the validator and fix everything it reports before finishing:
   ```bash
   node scripts/validateCase.mjs public/content/cases/<id>          # one case
   node scripts/validateCase.mjs                                    # all cases + vignettes
   ```
   Resolve **errors** (broken edges, missing refs, incomplete tiers, bad variant structure) — the
   run must exit 0. Review **warnings** (unreachable scene, undiscoverable clue): usually they mean
   the new scene isn't wired into the graph yet — fix the wiring rather than ignore them.

5. **Design review.** For anything beyond a trivial one-line edit, dispatch the
   `content-integrity-reviewer` subagent (Task tool, `subagent_type: "content-integrity-reviewer"`)
   with the changed files — it catches the design/tone issues the validator can't (single-faculty
   dead-ends, cosmetic branches, red-herring/deduction mismatches, backwards effect deltas, tone
   drift). Apply its `blocker` findings and re-run the validator; surface `warning`/`nit` findings.
   (Or just run `/review-content` after this skill.)

Report the file(s) touched, the new/changed scene and clue ids, and the validator result.
