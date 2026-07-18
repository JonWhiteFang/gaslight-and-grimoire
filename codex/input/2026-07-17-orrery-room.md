# Codex Review Request — The Orrery Room design spec

You are an independent adversarial reviewer for the Gaslight & Grimoire repo
(browser-based Victorian-occult choose-your-own-adventure; React 19 + Zustand + engine
modules in `src/engine/`, narrative content as JSON under `public/content/`). You have
NO conversation memory — everything you need is in this file and the repo.

## What to review

The design spec at:

- **`docs/superpowers/specs/2026-07-17-orrery-room-design.md`**

It designs a new flagship side vignette (**The Orrery Room** — the Grey Dawn faction
vignette, 2-act, ~18 scenes) plus one small engine delta: extending vignette loading to
support optional `deductions.json` (KeyDeduction recipes) and `variants.json` (variant
scenes), which today only main cases load. The vignette carries the Mythos meta-thread's
keystone deduction `mythos-pattern-named`, mintable only when the player arrives holding
the `mythos-period-computed` flag (set in The Comet Club).

## Ground your review in these repo files

Engine/store (the delta's blast radius):
- `src/engine/contentLoader.ts` — `loadCase` (the optional-recipes idiom the spec copies),
  `loadVignette` (the function being extended), `validateContent`
- `src/types/index.ts` — `VignetteData`, `CaseData`, `KeyDeduction`, `SceneNode`,
  `Choice` (incl. Phase 5 `visibility`/`gateReason`), `Effect`, `ClueDiscovery`,
  `Condition`
- `src/store/slices/narrativeSlice.ts` — `vignetteToCaseData` (hard-codes `variants: []`
  today), `resetForNewCase`, `loadAndStartVignette`
- `src/store/slices/metaSlice.ts` — `loadGame`'s vignette path (routes through
  `vignetteToCaseData`)
- `src/engine/contentValidation.ts` — `validateBundle`, the F-102 gated-deduction
  reachability guard, Phase 5 visibility/gateReason rules, soft-lock warnings
- `src/engine/deductionOracle.ts`, `src/engine/buildDeduction.ts` — recipe matching
- `src/engine/conditions.ts` — `hasDeduction`, `hasFlag`, `factionReputation`
- `src/engine/constants.ts` — faction key strings
- `src/store/slices/npcSlice.ts` — `adjustDisposition` faction-rep propagation (0.5×)

Content corpus (the patterns the vignette must match):
- `public/content/manifest.json` — vignette entries + `triggerCondition` shape
- `public/content/side-cases/the-rationalists-dilemma/` — a shipped vignette's file set
  (`meta.json`, `scenes.json`, `clues.json`, `npcs.json` — note: NO deductions/variants)
- `public/content/cases/the-comet-club/deductions.json` — recipe shape; `act3.json` +
  `variants.json` — where `mythos-period-computed` is set
- `docs/content-authoring.md` — authoring rules (gating, red herrings, key-deduction
  recipes, Phase 5 hide-vs-disable + gateReason rules, wrapped-object JSON shapes)
- `docs/content-ideas-2026-07-10.md` — §8 (the pitch) + Part 4 (Mythos thread rules:
  optional, never critical-path, never named in prose)

## Project constraints that bind this spec

- `Condition`/`Effect` are the ONLY gating/mutation mechanism from content JSON.
- Every Mythos clue must be optional, never critical-path, always shadowed by a
  sufficient mundane explanation; the pattern is never named in prose.
- Vignettes are 2-act; the existing 4 vignettes must keep loading byte-identically.
- All numeric state is clamped (faction rep ±10, disposition ±10); `adjustDisposition`
  on a faction-aligned NPC propagates `delta * 0.5` to faction rep.
- The validator must pass with zero errors AND zero warnings (including Phase 5
  soft-lock/soft-gate warnings).
- No save-schema migration is planned (the spec claims `CaseData.recipes` already
  round-trips through saves — verify that claim against `saveManager`/`metaSlice`).

## Your charge

Assume this spec contains **at least one real defect** — a correctness hole, an
unimplementable or self-contradictory claim, a determinism/collision hazard, or a
dangerous ambiguity — and find it. Hunt specifically for:

1. **The engine delta's hidden edges** — does `loadGame`'s vignette path REALLY pick up
   recipes/variants for free? Does an in-progress vignette save made BEFORE this change
   load correctly AFTER it? Is `validateContent` (runtime) fed the recipes for vignettes,
   or only the CLI validator?
2. **The keystone gating chain** — flag-gated choice → comparison scene → `discoverClue`
   onEnter → 3-clue recipe. Is `or-clue-orrery-period` truly unobtainable flagless (check
   `cluesAvailable` vs choice-gating vs onEnter paths)? Does the F-102 reachability guard
   PASS or FAIL a recipe whose required clue sits behind a flag-gated choice? (The spec
   flags this as "confirm during plan" — is that deferral safe, or does it invalidate
   the design?)
3. **Phase 5 vocabulary misuse** — the keystone choice is `visibility: "disabled"` with
   a gateReason; the brokered ending is default-hidden. Do these satisfy the validator's
   5 errors + 2 warnings (e.g. does the disabled choice risk a soft-lock warning on the
   hub scene? does an ungated ending choice exist on the verdict hub so the scene always
   has a guaranteed-selectable choice)?
4. **Recipe/oracle semantics** — with the evidence-board oracle (Phase 2b), does a
   3-clue recipe + a red herring that "connects plausibly" behave as the spec claims?
   Can `mythos-pattern-named` collide with the reserved `deduction-generic-` namespace
   or any existing recipe/flag id? Is gating downstream content on
   `hasDeduction: mythos-pattern-named` sound given deductions are wiped by
   `resetForNewCase` (state.deductions = {}) — i.e., does the cross-case contract
   actually work, or does it need a persistent FLAG set on minting?
5. **Rep/disposition arithmetic** — do the ending effect values + 0.5× propagation stay
   within the spec's claimed net ±2 swing and the ±10 clamps?
6. **Scale/consistency** — do the scene/clue/NPC counts, act split, and section
   cross-references inside the spec agree with each other and with the pitch?

Point 4's `resetForNewCase` question is load-bearing for the whole Mythos thread —
examine it with special care and cite the exact code.

## Output

Write your review to **`codex/output/2026-07-17-orrery-room-review.md`**. For each
finding: severity (Blocker / Major / Minor), the spec section, the repo evidence
(`file:line`), and a concrete fix. If you find no defect in an area you examined, say
so explicitly. Read-only — do not modify any repo file other than writing the review.
