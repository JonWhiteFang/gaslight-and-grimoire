# UI/UX Improvement Roadmap — Gaslight & Grimoire

> **Type:** Sequencing roadmap (track ordering + phase plan). Derived from
> [`ui-ux-improvements.md`](ui-ux-improvements.md) — read that reference for the evidence, audit
> status, and per-finding detail behind every item here.
> **Date:** 2026-07-14
> **Track decision:** **UI/UX is the primary track now** ("track C"). New content (The Orrery Room)
> is paused in favour of front-loading the product-facing UI/UX work that improves the *existing*
> 8 cases. This is a live decision, not a scope rule — revisit when the track completes.
> **Not a spec.** Each phase becomes its own spec → Codex-gated plan → implementation cycle when
> picked up. This doc only fixes *order and batching*.

---

## Why this order (not naive product-value order)

A pure product-value list would be "deduction feedback → dice legibility → then the plumbing." Two
dependencies reorder it:

1. **The global live announcer is infrastructure the product work consumes.** Phases 2 and 3 both
   emit *new dynamic feedback* (a partial-tier deduction message; a surfaced DC/modifier). Without a
   shared announcer, each would grow an ad-hoc local live-region that gets ripped out later — or ship
   inaccessible. So the announcer leads, as substrate, not as hygiene.
2. **A pivotal, ADR-worthy decision gates the headline feature.** Does the DC-14 Reason roll stay
   **load-bearing** for deduction (a correct clue-set can still fail on a bad roll), or does deduction
   become **deterministic** (set-correct = success) with dice reserved for flavour? That call changes
   game feel across all 8 cases and dictates how much of Phase 3 applies to deduction. It costs
   nothing to decide and unblocks everything downstream — so it is Phase 0.

**Batching rationale.** Every non-trivial item pays the cross-provider Codex review passes (spec, plan,
completed implementation — CLAUDE.md), so items are bundled by files-touched / coherence rather than
shipped one-per-PR. This turns 9 backlog items into ~5 reviewed PRs plus one decision.

---

## Roadmap

Item numbers reference [`ui-ux-improvements.md` Part VI](ui-ux-improvements.md#part-vi--prioritized-backlog-reframed).

| Phase | Work | Backlog items | Rationale | Codex gates |
|-------|------|---------------|-----------|-------------|
| **0** ✅ | **Decision: deduction roll semantics** → ADR | gates 6 | Zero code, highest leverage; sets feel + informs Phase 3 | Gate 1 on the ADR reasoning — **done: [ADR-0012](../DECISIONS/ADR-0012-deduction-roll-semantics.md), PR #79** |
| **1** ✅ | **Global live announcer** — always-mounted `polite` + `assertive` regions and an `announce()` API. *(Mounted at the app root in `main.tsx`, outside `ErrorBoundary` — NOT in `AccessibilityProvider`, which remounts per screen; Gate-1 correction.)* | 1 | Substrate for Phases 2 & 3; small; hardens all 8 cases immediately | plan + diff — **done: `src/announcer.ts` + `LiveAnnouncer`, PR #80** |
| **2** | **Deduction feedback legibility** (+ fold in the `connected` color-only fix) | 6, 2 | Top product value; work sits in `ClueCard`/`EvidenceBoard`/`DeductionButton`, so the redundant-cue fix rides along | plan + diff |
| **3** | **Dice / probability legibility** — surface DC, modifier, advantage/disadvantage at the roll | 7 | Informed by Phase 0; broad — applies to **all** faculty checks, not only deduction | plan + diff |
| **4** | **A11y hardening sweep** (batched) — reduced-motion coverage audit, focus-restore + background inertness across *all* overlays, contrast/focus-indicator pass | 3, 4, 5 | All "sweep the UI against a checklist," no design decisions, one coherent PR | plan + diff (once) |
| **5** | **Choice-gating content model** — `visibility`/`gateReason` schema + validator rule + authoring-doc update | 8 | Content-pipeline change; the bridge back toward content (see caveat) | plan + diff |

### Rides along with Phase 4
The **"preserve" regression tests** (self-paced prose, polite/assertive save toast, board
keyboard-connect path, dice-as-status) land here — Phase 4 is the natural home, so a future refactor
can't silently lose behaviour that is already correct.

---

## Parked (deliberately not scheduled)

- **Item 9 — save-resume / drop-off UX.** *Unresearched* — nothing survived verification. Needs the
  follow-up research pass before it is even a design task. Do **not** schedule as build work yet.
- **React Flow / node-link migration (item D2).** YAGNI — the custom evidence board already works and
  is accessible. Revisit only if a future redesign needs true node-link canvas features.

---

## Live caveat — Phase 5 ordering vs. content

Phase 5 (choice-gating) is ranked **last** by track-C logic (existing cases already function without
it). But it is the item that most changes *future authoring*. **If The Orrery Room resumes as the
next content build after this track**, authoring it with the new `hidden` / `disabled-with-reason`
vocabulary from day one is far cheaper than retrofitting. Consider pulling Phase 5 forward (to right
after Phase 1) at that point. Left last here per the approved plan; flagged so the decision is
conscious when content resumes.

---

## Phase 0 decision — framing for the ADR

The Phase 0 call is recorded here so it isn't lost before the ADR is written:

- **Question:** should a deduction attempt's DC-14 Reason roll be load-bearing, or should a correct
  clue-set succeed deterministically with dice used only for flavour/tier-of-success?
- **Why it matters:** today (`DeductionButton.tsx`, `buildDeduction.ts`) a correct recipe subset can
  fail on an unlucky roll and a wrong set can pass on a lucky one. That randomness may *help* tension
  or *hurt* deduction legibility — the exemplar research (Obra Dinn's anti-guessing) argues
  deduction should reward reasoning, not luck.
- **Downstream effects:** the answer sets whether Phase 2's "partial-tier directional feedback" is a
  dice outcome or a set-correctness outcome, and how much of Phase 3's dice-drama work applies to the
  deduction path vs. only to in-scene faculty checks.
- **Deliverable:** an ADR in `docs/DECISIONS/` capturing the choice and its rationale, reviewed at
  Codex Gate 1 before any Phase 2 code.

---

*Sequencing only. Pick up a phase by opening its spec → Codex-gated plan → implementation cycle.
Confirm the derived item's audit status in [`ui-ux-improvements.md`](ui-ux-improvements.md) before
building.*
