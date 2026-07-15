# Phase 2 — Deduction Feedback Legibility (design spec)

> **Type:** Implementation design spec. Feeds a Codex-gated implementation plan (writing-plans next).
> **Date:** 2026-07-14 · **v4 — split into 2a (ship now) / 2b (deferred).**
>
> **Why the split.** Three Codex spec-review rounds each found a real **Blocker**, and round 3
> ([review](../../../codex/output/2026-07-14-phase2-deduction-feedback-round3-review.md)) traced the latest
> one (N1) to **pre-existing board plumbing**, not the oracle: connecting two clues overwrites their status
> to `connected` *before* any attempt (`EvidenceBoard.tsx:153-154`), so any "snapshot the prior status"
> scheme is built on already-destroyed state; generic deductions have no stable id, so re-forming mints
> duplicates (N5); red-herring handling is split across two code paths (N4). Every attempt to bolt a
> correctness/feedback model onto the board tripped over the *next* piece of existing plumbing. **Decision:
> ship the safe, high-value legibility slice now (2a) with today's formation semantics unchanged, and
> defer the correctness-oracle + status-lifecycle rework to its own spec (2b).**
>
> - **[Part A — Phase 2a](#part-a--phase-2a-ship-now)** — legibility only; **no** correctness-model change,
>   **no** clue-status-lifecycle change. This is what this spec asks to build.
> - **[Part B — Phase 2b](#part-b--phase-2b-deferred--its-own-spec-later)** — the deferred formation model +
>   the round-1/2/3 findings it must satisfy, recorded so the analysis isn't lost.
>
> **Track:** UI/UX roadmap Phase 2 ([roadmap](../../research/ui-ux-roadmap.md)); backlog **6** + **2**.
> **Relates to** [ADR-0012](../../DECISIONS/ADR-0012-deduction-roll-semantics.md) — **2a does NOT enact it**
> (formation still rolls-to-gate); 2b enacts it. **Consumes** the Phase 1 announcer (`announce()`, PR #80).

---

## Part A — Phase 2a (ship now)

### Scope

Improve the **legibility** of the existing deduction beat without touching how deductions form or how
clue status is mutated. Three changes, all low-risk:

1. **`connected` colour-only fix (backlog item 2).** Add a redundant non-colour cue to the clue card.
2. **Board-owned outcome banner + global announce (fixes B3).** Move the transient success/failure message
   out of `DeductionButton` (which unmounts when connections clear) into the always-mounted board, and
   route it through the Phase-1 `announce()` so it is announced exactly once to screen readers.
3. **Directional message copy.** Replace the terse "Success!/Failed." with measured, atmospheric copy that
   distinguishes a formed deduction from a failure — using **today's** outcome signal (`success`/`failure`),
   not a new correctness model.

**Explicitly NOT in 2a** (all deferred to 2b): any change to *what forms a deduction* (still the DC-14
Reason roll, subset recipe match or generic), the tag/recipe/`connectsTo` correctness oracle, connection
topology/component analysis, clue-status snapshot/restore, `removeConnections`, and the ADR-0012 amendment.
2a leaves formation semantics byte-for-byte as they are on `main`.

### Today's behaviour 2a preserves (verified on `main`)

`DeductionButton.handleAttempt` rolls `performCheck('reason', investigator, 14, false, false)`; on
`success`/`critical` it forms a deduction (recipe subset → key deduction under a stable id, else generic)
and marks every connected clue `deduced`; on `partial`/`failure`/`fumble` it marks them `contested`,
reverting to `examined` after 2 s. `EvidenceBoard.handleDeductionResult('success'|'failure')` clears
connections (slack-thread animation on failure). **All of this stays.** 2a only changes *where the message
lives* and *what it says*.

### Component 1 — `ClueCard.tsx` (`connected` colour-only fix, item 2)

`connected` is signalled by a yellow ring alone (WCAG SC 1.4.1 gap). `StatusIndicator` gains a `connected`
case → a `🔗` badge in the same top-right slot as NEW/📌/❓/✓, `aria-label="Connected"`. Update the
six-state doc-comment header. No logic change; the card-root `aria-label` already includes the status.

### Component 2 — `DeductionButton.tsx` (surface the message, keep formation)

- **Keep** `handleAttempt`'s roll + formation + status writes exactly as today.
- **Remove** the local `<m.p>` tier label + its `aria-live` (it's the piece that unmounts with the button —
  B3). Keep the button's own text states (`🧠 Attempt Deduction` → `🔒 Deduction Locked` / `🔴 Attempt
  Failed`); those live on the button, which is fine while it's mounted.
- Widen the callback: `onResult(result, tier)` → pass the existing `result: 'success'|'failure'` **and**
  the roll `tier` so the board can pick the message. (Minimal signature change; no new semantics.)
- Accessible label unchanged (a Reason check *does* still happen in 2a).

### Component 3 — `EvidenceBoard.tsx` (board-owned banner + announce)

`handleDeductionResult(result, tier)` keeps its current connection-clearing/slack behaviour and **adds**:

```
message = result === 'success'
  ? (tier === 'critical' ? MSG.criticalSuccess : MSG.success)
  : (tier === 'partial'  ? MSG.partial : MSG.failure)   // 'partial' tier reads as directional, not flat fail
showBanner(message, result === 'success' ? 'green' : (tier === 'partial' ? 'amber' : 'red'))
announce(message)   // Phase-1 global announcer — the single SR announcement
```

- **Banner:** a board-owned transient element (the board is always mounted while open, so it survives
  `clearConnections()` — fixes B3). **Visual-only** (no `aria-live`); `announce()` is the sole SR path
  (no double-speak; the Phase-1 two-slot store re-announces identical text — verified round 2). Auto-clears
  after ~2 s (aligns with the existing revert).
- Tone: green (success) / amber (partial-tier "close") / red (hard failure). This is the **only** place
  `partial` tier is surfaced distinctly; it does **not** change formation (a `partial` roll still fails to
  form today, exactly as now) — it only *reads* as directional.

**Message copy** (measured, atmospheric — short status strings, never narrative):

| when | message |
|---|---|
| `success`, `critical` roll | `The connection holds — a sharp, decisive insight.` |
| `success`, other | `The connection holds.` |
| `failure`, `partial` roll | `Some of these belong together, but the reasoning won't quite hold.` |
| `failure`, other | `These clues don't connect — not like this.` |

### Testing (2a) — TDD, RED first

- **`ClueCard` test:** `connected` renders the 🔗 badge (colour-independence regression guard).
- **`DeductionButton` test:** `onResult` is called with `(result, tier)`; no local outcome `<p>` remains.
- **`EvidenceBoard` integration (B3):** after a success the **board banner** shows the message though
  `clearConnections()` ran and the button's own label changed; `announce` called once with the matching
  message; a `partial`-tier failure shows the amber directional message; a hard failure shows red. Formation
  behaviour is unchanged (a success still forms + marks `deduced`; a failure still `contested`→`examined`).
- **Announcer spy:** exactly one `announce()` per attempt.

Baseline **635/60**; expect ~6–9 new tests.

### Docs (2a)

`engine-reference.md`/`CLAUDE.md`: note that the deduction **outcome banner + announce** live on the board
(not the button), and the button callback now carries the tier. **No** ADR-0012 status change (2a doesn't
enact it — call this out in the PR so the roadmap Phase-2 tick isn't mistaken for ADR-0012 enactment).
Post-merge: update roadmap (Phase 2 → "2a shipped; 2b deferred") and `ui-ux-improvements.md` row 2 (done),
row 6 (partial — legibility shipped, formation model pending 2b).

### Scope boundaries (2a, YAGNI)

No correctness oracle (tag/recipe/`connectsTo`); no topology/component logic; no clue-status
snapshot/restore; no `removeConnections`; no new `ClueStatus`; no save migration; no ADR-0012 amendment; no
dice-legibility DC surfacing (Phase 3); no contrast/reduced-motion sweep (Phase 4).

---

## Part B — Phase 2b (deferred — its own spec later)

Recorded so three rounds of analysis aren't lost. **2b is the real enactment of ADR-0012** and needs its
own spec → Codex-gated plan. It must resolve the following, all verified against shipped content:

### The pre-existing plumbing 2b must fix first (root causes, round 3)

- **N1 — status overwrite on connect.** `handleInitiateConnection` sets both clues `connected` *before* any
  attempt (`EvidenceBoard.tsx:153-154`), destroying the pre-connection status. 2b must **derive** the
  connected ring from `connections` membership (not a stored status), or persist a separate
  pre-connection status per clue that survives board close/save — so a `deduced`/`spent` clue is never
  downgraded (round-2 N5, round-3 N1).
- **N5 — generic-deduction identity.** `buildDeduction` mints a `Date.now()+Math.random()` id
  (`buildDeduction.ts:23`), so re-forming the same set inflates the Journal/count without bound. 2b must give
  generic deductions a **canonical stable id** (e.g. a sorted clue-set signature) → idempotent upsert.
- **N4 — red-herring split-brain.** A generic component whose edges are all authored `connectsTo` but which
  contains a `redHerring` clue (shipped: `cc-clue-quack-tonic` links to both other poisoner clues;
  Whitechapel links its two red-herring clues) would read green on the board yet "Questionable" in the
  Journal. 2b must define a generic **`false`** formation (all-authored edges + a red-herring clue → forms,
  framed uneasy) so board and Journal agree.
- **N2 — revert timer ownership.** A single board-scoped token can't own disjoint attempts' timers and dies
  on board remount. 2b needs **per-clue attempt ownership** (generation token in state) that survives
  remounts, with timeout cleanup.
- **Pre-existing latent revert bug (found in the 2a plan review).** Today `DeductionButton`'s failure path
  sets a 2 s timer to revert `contested`→`examined`, but the callback closes over `idsRef.current`, which
  the board empties via `clearConnections()` before the timer fires — so **failed-attempt clues never
  revert; they stay `contested`**. 2a deliberately does not touch this (legibility-only). 2b's status
  lifecycle rework must fix it (snapshot attempt-scoped ids, restore to *prior* status per N1/N5).
- **N3 — seed correctness.** A last-connected-id seed can go stale after its component is removed, misfiring
  a later attempt on a different component as `incorrect`. 2b needs an explicit last-added-edge that is
  validated against current edges and cleared after removal.

### The correctness model 2b should adopt (from rounds 1–3)

- **Two-graph oracle over the player's connection topology** (never the flattened id union):
  - **Recipes** match a single **player-connected component** (all `requiredClues` in one component);
    deterministic winner = non-red-herring → largest `requiredClues` → lowest id; red-herring recipe → forms
    as `false`. (Recipes match player edges, **not** `connectsTo` — verified **2 of 7 recipes, across 2 of 4
    main cases** (Mayfair, Lamplighter's) are *not* `connectsTo`-connected.)
  - **Generic** (no recipe; the **only** oracle for the 4 vignettes, which ship no recipes): classify the
    component's player-edges by authored `connectsTo` (undirected — corpus has 25 one-way edges, 0
    dangling): all authored → `correct` (or `false` if it contains a red-herring clue, per N4); some → 
    `partial`; none → `incorrect`.
- **Fail-closed:** component built from own-property ids only; `<2` distinct → `incorrect`.
- **Roll flavours a formed deduction only**; `partial`/`incorrect` roll nothing → **ADR-0012 amendment**
  (partial is deterministic, not roll-driven) + promote `Accepted→Enacted` with a board integration test
  (stub `failure` vs `critical`, identical formation).
- All `hasDeduction`/`requiresDeduction` targets are the 7 recipe ids (verified); generic deductions gate
  nothing, so they may form freely once idempotent.

### Confirmation for 2b

The ADR-0012 Confirmation test lands in 2b (recipe component forms regardless of roll tier; non-qualifying
never forms). Until 2b ships, ADR-0012 stays `Accepted`.

---

## Cross-provider Codex review (file-based)

The **spec** had three review rounds; the split into 2a/2b is the resolution. Phase 2a's **plan** and
**completed implementation** each get their own Codex pass (`codex/output/`). 2b gets its own spec + reviews
when scheduled.
