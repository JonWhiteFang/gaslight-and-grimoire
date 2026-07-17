# UI/UX Research & Repo Audit — Gaslight & Grimoire

> **Type:** Durable reference. Two clearly-separated layers — **researched patterns (cited)** and
> **repo audit status (verified against current code)**. This is *not* an implementation plan; it
> is the evidence base a future implementation task should build a plan from.
> **Date compiled:** 2026-07-13 · **Restructured:** 2026-07-13 after an adversarial review
> (`ui-ux-improvements-review.md`) that correctly showed the first draft's premises were untested
> against the codebase.
> **Research method:** Multi-agent deep-research harness — 5 search angles → 22 sources fetched →
> 100 candidate claims → 25 adversarially verified (3-vote, ≥2/3 to kill) → 24 confirmed, 1 refuted
> → 11 findings.
> **Audit method:** Direct reading of the named components on `main` at compile date.

---

## What changed after review, and why this doc is split

The first draft treated the research prompt's framing as ground truth. Two premises were **wrong**:

1. It called the evidence board **"spatial/drag-heavy."** The board is **not** drag-to-connect — it
   already uses click/tap/Space/Enter **select-then-select** (`EvidenceBoard.tsx:142`,
   `ClueCard.tsx:107`), which is the very accessibility fix the draft "recommended."
2. It said the **dice overlay and save/load/case-select should behave as modal dialogs.** In code
   they are, respectively, a passive status card, a toast, and full-screen route screens — none are
   modals, and forcing modal behavior on them would *degrade* UX.

Because a research doc that misdescribes the thing it's advising is worse than useless, this version
**separates the two concerns**:

- **[Part I — Repo audit status](#part-i--repo-audit-status)** — what each surface *actually* does
  today (verified). Read this first; it recontextualizes every recommendation.
- **[Part II — Verified research findings (A–H)](#part-ii--verified-research-findings-ah)** — the
  durable, cited patterns, each cross-linked to its audit status.
- **[Part III — Surface taxonomy](#part-iii--surface-taxonomy-replaces-the-blanket-modal-recommendation)** —
  replaces the blanket "modal" advice with a dialog / route-screen / toast / inline-overlay split.
- **[Part IV — Accessibility acceptance criteria](#part-iv--accessibility-acceptance-criteria-per-surface)** —
  explicit per-surface checklists.
- **[Part V — Choice & deduction: abstract → acceptance criteria](#part-v--choice--deduction-from-abstract-to-acceptance-criteria)**.
- **[Part VI — Prioritized backlog](#part-vi--prioritized-backlog-reframed)** — reframed so product
  comprehension is first-class, not only well-sourced plumbing.

---

## Table of Contents

- [Part I — Repo audit status](#part-i--repo-audit-status)
- [Part II — Verified research findings (A–H)](#part-ii--verified-research-findings-ah)
  - [A. Narrative-text presentation & readability](#a-narrative-text-presentation--readability)
  - [B. Choice / agency UX](#b-choice--agency-ux)
  - [C. Skill-check & dice UX](#c-skill-check--dice-ux)
  - [D. Investigation / deduction UI](#d-investigation--deduction-ui)
  - [E. State / HUD legibility](#e-state--hud-legibility)
  - [F. Atmosphere & feedback (motion + audio)](#f-atmosphere--feedback-motion--audio)
  - [G. Accessibility & responsive design](#g-accessibility--responsive-design)
  - [H. Onboarding, pacing & retention](#h-onboarding-pacing--retention)
- [Part III — Surface taxonomy](#part-iii--surface-taxonomy-replaces-the-blanket-modal-recommendation)
- [Part IV — Accessibility acceptance criteria (per surface)](#part-iv--accessibility-acceptance-criteria-per-surface)
- [Part V — Choice & deduction: abstract → acceptance criteria](#part-v--choice--deduction-from-abstract-to-acceptance-criteria)
- [Part VI — Prioritized backlog (reframed)](#part-vi--prioritized-backlog-reframed)
- [Anti-patterns to avoid](#anti-patterns-to-avoid)
- [Refuted claim](#refuted-claim)
- [Open questions (under-researched — commission follow-up)](#open-questions-under-researched--commission-follow-up)
- [Caveats, provenance & confidence](#caveats-provenance--confidence)
- [Sources](#sources)

---

## Part I — Repo audit status

Verified by reading the components on `main`. **Status legend:** ✅ already satisfied · 🟡 partial ·
⭕ genuinely open · ⚠️ prior draft was wrong here.

| Surface | Current implementation (verified) | Status vs. research |
|---------|-----------------------------------|---------------------|
| **Evidence board** (`EvidenceBoard.tsx`) | Full-screen overlay that **already is a correct modal**: `role="dialog"`, `aria-modal="true"`, `aria-label`, `useFocusTrap`, Escape-to-close (Escape first cancels an in-progress connection). Connections are made by **click/tap/Space/Enter select-then-select** (`handleInitiateConnection`), not drag. A mouse-following "ghost thread" is a *visual* only. Clue cards are `role="button"`, `tabIndex=0`, with status in the `aria-label`. | ⚠️ Not drag-heavy. The keyboard/single-pointer connect path the draft recommended **already exists**. React Flow migration is largely **moot for accessibility**. |
| **Dice overlay** (`DiceRollOverlay.tsx`) | Passive **`role="status"` / `aria-live="polite"`** card with a full-result `aria-label`; reduced-motion-aware; `sr-only` text. **Non-interactive, non-blocking — not a modal.** | ⚠️ "Treat as modal dialog" was a category error. It is already a correct live-status surface. |
| **Save** (`App.tsx:380`) | Toast: `role="status"`+`aria-live="polite"` on success, `role="alert"`+`aria-live="assertive"` on failure (F-052/F-103). | ✅ Already follows the polite/assertive split the research prescribes. Not a modal. |
| **Load / Case selection** (`LoadGameScreen.tsx`, `CaseSelection.tsx`) | Full-screen **route screens** (`<main>`), not overlays. Load has two-tap delete confirmation (F-054). | ⚠️ Route screens, not modals. Different a11y contract (see [Part III](#part-iii--surface-taxonomy-replaces-the-blanket-modal-recommendation)). |
| **Narrative prose** (`SceneText.tsx`) | Typewriter with **click-to-skip + a real keyboard skip `<button>`**; `instant`/`reduced-motion` paths render full text immediately; `sr-only aria-live="polite"` exposes the full scene once (F-049, never mid-typewriter). | ✅ Self-paced prose is **already implemented**. Reframe as "preserve," not "add." |
| **Reduced motion** | `AccessibilityProvider` detects the OS `prefers-reduced-motion` on mount and sets a store `reducedMotion` flag; adds a `.reduced-motion` class to `<html>`; the flag is **threaded via props** into `SceneText`, `DiceRollOverlay`, `DeductionButton`, `ConnectionThread`. App uses **`LazyMotion` + `domAnimation` + the `m` component** (`main.tsx`), **not** `MotionConfig`. | 🟡 A store-driven mechanism already exists (arguably better than `MotionConfig` because the `.reduced-motion` CSS class *can* also gate Tailwind/CSS animations). **Open:** verify the class actually disables CSS animations like `animate-pulse` (`ClueCard.tsx:42`, `CaseSelection.tsx:51`). |
| **Global live announcer** (`src/announcer.ts`, `src/components/LiveAnnouncer/`) | ✅ **Shipped (Phase 1, PR #80).** An always-mounted `<LiveAnnouncer>` (four `sr-only` `aria-live` slots, per-mount empty-commit gate) is mounted at the app root in `main.tsx` (outside `ErrorBoundary`); components call `announce()` from the framework-agnostic store. `AccessibilityProvider` still only applies settings/classes — it deliberately does not host the announcer (it remounts per screen). | ✅ Done. Phases 2/3 announce via `announce()` at points not already covered by a local region. |
| **Deduction** (`DeductionButton.tsx`, `buildDeduction.ts`) | With ≥2 clues connected, an "Attempt Deduction" button rolls a **Reason check (d20 vs DC 14)**. Success/critical → build a deduction (recipe **subset-match** or generic) and mark clues `deduced`; partial/failure/fumble → mark `contested`, revert to `examined` after 2s. Tier label announced via `aria-live="polite"`. | 🟡 Verification is a **dice roll on a connected set**, *not* slot-fill or per-connection right/wrong. Golden-Idol/Obra-Dinn patterns need a G&G-specific bridge — see [Part V](#part-v--choice--deduction-from-abstract-to-acceptance-criteria). |
| **Clue status cues** (`ClueCard.tsx`) | Six states. Most pair color with a redundant icon/badge (NEW badge, 📌 deduced, ❓ contested, ✓ spent). | 🟡 **`connected`** is signalled by a **yellow ring alone** (no icon/text) — a real, code-level color-only gap (see [G2](#g2--color-independence--contrast)). |

**Bottom line:** the codebase is already markedly more accessible than the draft assumed. The
highest-value work is **narrower and more product-facing** than "add modals / add keyboard support /
add self-pacing" — most of that exists. See [Part VI](#part-vi--prioritized-backlog-reframed).

---

## Part II — Verified research findings (A–H)

These are the durable, cited patterns. **Confidence tiers:** *High* = primary/stable sources
(W3C, MDN, official docs, peer-reviewed); *Medium* = credible secondary/journalistic. Each finding
now carries its **audit status** from Part I.

### A. Narrative-text presentation & readability

#### A1 — Prose must be self-paced *(High · 3-0 · ✅ already done)*
Self-paced advancement through text is a **Basic / Level-A** requirement (Game Accessibility
Guidelines: *"Allow players to progress through text prompts at their own pace"*; WCAG 2.2.1 Timing
Adjustable). **Audit:** `SceneText.tsx` already provides click-skip, a keyboard skip button, and
instant/reduced-motion paths. **Action: preserve** this behavior; add a regression test asserting the
skip control stays keyboard-operable — don't treat it as new work.
Sources: [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/),
[WCAG 2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/).

> **⭕ Under-researched:** concrete *typographic* measures for long prose (measure/line-length,
> leading, period-feel font, reveal timings). Pentiment/Roadwarden specifics did **not** survive
> verification — see [Open questions](#open-questions-under-researched--commission-follow-up).

### B. Choice / agency UX

#### B1 — Choice presentation is a taxonomizable design space *(High for the taxonomy; the JSON mapping is design inference · 3-0 · 🟡 open)*
A peer-reviewed ICIDS 2018 model (from 31 works) classifies choice presentation on **four axes**:
**composing elements**, **functions**, **aesthetic considerations**, **mechanics**.
**What is High-confidence:** the taxonomy and its four axes exist and are primary-sourced.
**What is *not* proven:** that G&G should encode these as JSON variables — that is a reasonable
**design inference**, not something the paper prescribes. Treat the JSON/schema idea as a
[Part V](#part-v--choice--deduction-from-abstract-to-acceptance-criteria) design task, not a
research conclusion. *(The paper body was behind an auth wall; only the four-axis structure is
verified.)*
Source: [Springer LNCS — Estupiñán et al., ICIDS 2018](https://link.springer.com/chapter/10.1007/978-3-030-04028-4_12).

#### B2 — "Choices that matter": pace, coerce, foreshadow *(Medium · 3-0 · 🟡 open)*
inkle's craft centers on consequential choices and on **pacing/coercion** rather than tutorial
walls. **Implication:** foreshadow and gate choices so agency reads as consequential; teach mechanics
through pacing. (Secondary source: a Game Developer summary of Jon Ingold's GDC 2015 talk.)
Source: [Game Developer — 80 Days / Jon Ingold](https://www.gamedeveloper.com/design/video-innovating-interactive-fiction-with-i-80-days-i-jon-ingold).

> **Corroborating (fetched, not vote-verified):** StoryNexus/quality-based systems distinguish
> *hidden-when-unqualified* vs. *shown-but-disabled* choices — a concrete locked-vs-hidden signalling
> pattern. Emily Short's storylet (content + prerequisites + effects) maps 1:1 onto the project's
> Condition/Effect model.
>
> **⭕ Under-researched:** how to signal state-gating *diegetically* in a measured Victorian tone
> (e.g. Disco Elysium's greyed/attributed checks did not survive verification).

### C. Skill-check & dice UX

#### C1 — *True* modal overlays follow the ARIA dialog pattern *(High · 3-0 · see caveat)*
The W3C dialog pattern (focus trap with wrap, Escape-to-close, focus move-in on open, focus-restore
on close) applies to **genuinely modal** surfaces. **Audit caveat:** in G&G the **only** modal in this
family is the **Evidence Board** — which already implements this via `useFocusTrap` + Escape. The
**dice overlay is a status card, not a modal** (see [C2](#c2--announce-dynamic-changes-via-a-pre-existing-live-region), [Part III](#part-iii--surface-taxonomy-replaces-the-blanket-modal-recommendation)).
Source: [W3C ARIA APG — Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

#### C2 — Announce dynamic changes via a *pre-existing* live region *(High · 3-0 · 🟡 partial)*
Use **`aria-live="polite"`** by default; reserve **`assertive`** for time-critical events (halt/
breakdown scenes, save failures). **The region must already exist (empty) in the DOM before content
changes** — AT only announces changes to a pre-existing region; SPA re-renders that recreate the node
break this. **Audit:** the dice overlay, save toast, and `SceneText` already do this correctly and
locally; the **gap** is the absence of a single always-mounted announcer (see
[Part IV](#part-iv--accessibility-acceptance-criteria-per-surface)).
Source: [MDN — ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions).

> **⭕ Under-researched:** presenting **odds/modifiers/advantage** transparently and
> **success-with-cost / failure-forward** design. Only the announcement plumbing is verified — the
> dice-*drama* and probability-*legibility* patterns are open. (Note the current model uses a fixed
> DC 14 Reason check; surfacing that DC and the modifier is a candidate legibility win.)

### D. Investigation / deduction UI

#### D1 — Drag-to-connect needs a single-pointer/keyboard alternative *(High · 3-0 · ✅ already done)*
**WCAG 2.2 SC 2.5.7 Dragging Movements (AA)** requires a non-drag path for any drag operation, and
explicitly names connect-style widgets. **Audit:** G&G's board **is not drag-based** — it already uses
click-select-then-click, which is the conforming alternative and is keyboard-operable. **This
requirement is satisfied.** Keep it satisfied if a future redesign introduces dragging.
Sources: [WCAG 2.2 SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html),
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/).

#### D2 — *If* a node-link redesign is ever needed, use React Flow — not `@xyflow/system` *(High · 3-0 · ⭕ conditional / likely YAGNI)*
This is now a **conditional, low-priority** note, not a recommendation. The current custom board
works and is accessible, so **a library migration is not justified by accessibility**. Only revisit if
a future redesign needs true node-link capabilities (auto-layout, pan/zoom canvas, edge routing) the
custom board lacks. If so: adopt **React Flow (`@xyflow/react`)** — its keyboard/ARIA defaults are a
*starting point*, not proof of an accessible workflow — and **avoid `@xyflow/system`** (pre-1.0,
maintainer-discouraged for standalone use). dnd-kit is the alternative for drag semantics.
Sources: [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility),
[dnd-kit](https://github.com/clauderic/dnd-kit),
[@xyflow/system (npm)](https://www.npmjs.com/package/@xyflow/system).

#### D3 — Deduction verification: avoid binary whole-puzzle right/wrong *(Medium · 3-0 · 🟡 needs bridge)*
Two exemplar patterns: **Case of the Golden Idol** — a **partial-correctness count** (*"two or fewer
slots are incorrect"* — reports *how many*, not *which*) plus **pre-seeded scaffolding**; **Return of
the Obra Dinn** — **batched confirmation** (fates lock in sets of three; final six in twos) with a
distinct audio-visual cue, deterring guesswork. **Audit:** G&G doesn't have slots or batches — it has a
**Reason check on a connected set**. The bridge (how these map) is in
[Part V](#part-v--choice--deduction-from-abstract-to-acceptance-criteria). *(Secondary/journalistic
sources; "directly transferable" is design opinion.)*
Sources: [Game Developer — Golden Idol](https://www.gamedeveloper.com/design/case-of-the-golden-idol),
[playxix.com — Obra Dinn](https://playxix.com/blog/obra-dinn-memento-mori-ui-deduction-evolution-2018-1773136912544),
[Wikipedia — Obra Dinn](https://en.wikipedia.org/wiki/Return_of_the_Obra_Dinn).

### E. State / HUD legibility

#### E1 — Classify HUD surfacing with the diegetic/meta/spatial/non-diegetic taxonomy *(Medium · 3-0 · 🟡 open)*
Four categories on two axes (fits fiction? fits geometry?), from Fagerholt & Lorentzon's 2009
Chalmers thesis "Beyond the HUD." For a measured Victorian tone this favors **meta/diegetic** framings
(period-styled dossier meters) over gamified bars. **Use as a classifier, not a mandate** — the claim
that *diegetic = more immersive* was **refuted** (see [Refuted claim](#refuted-claim)). *(Secondary
write-up of an FPS-focused thesis; applicability to text-IF is inference.)*
Source: [Game Developer — UI design in video games](https://www.gamedeveloper.com/design/user-interface-design-in-video-games).

#### E2 — Change-feedback *(High, cross-ref C2)*
When composure/vitality/reputation/suspicion move, announce via the polite live region ([C2](#c2--announce-dynamic-changes-via-a-pre-existing-live-region)); the visual change-feedback must honor
reduced motion ([F1](#f1--reduced-motion-must-cover-every-animation-source-not-just-motion-components)) and not rely on color alone ([G2](#g2--color-independence--contrast)).

#### E3 — See [G2](#g2--color-independence--contrast) for color-independence (shared with B and G).

### F. Atmosphere & feedback (motion + audio)

#### F1 — Reduced motion must cover *every* animation source, not just Motion components *(High · 3-0 · 🟡 partial)*
`MotionConfig reducedMotion="user"` disables transform/layout animations while preserving
opacity/background — but **only for Motion components**. It does **not** cover CSS/Tailwind
animations, timers, scroll/canvas motion, or audio cues. **Audit:** G&G already has a *broader*
mechanism — a store `reducedMotion` flag (seeded from the OS pref) threaded via props **plus** a
`.reduced-motion` class on `<html>`. The app uses `LazyMotion` + `m`, not full `motion`, so any Motion
recommendation must compose with that. **Action:** verify the `.reduced-motion` class (or a media
query) actually disables CSS animations like `animate-pulse`; add acceptance criteria per animation
source ([Part IV](#part-iv--accessibility-acceptance-criteria-per-surface)).
Source: [Motion — React accessibility](https://motion.dev/docs/react-accessibility).

> **Supporting (fetched, not vote-verified):** UI motion can cause real physical harm (vestibular
> disorders), so reduced-motion support is a requirement, not a nicety
> ([joshwcomeau.com](https://www.joshwcomeau.com/react/prefers-reduced-motion/)).

> **⭕ Under-researched — audio:** **no findings survived** on Howler.js ambient-loop mood design
> (layering, crossfade, ducking under narration). Entirely open.

### G. Accessibility & responsive design

#### G1 — Modal / live-region / drag contracts
Consolidated: dialog contract → [C1](#c1--true-modal-overlays-follow-the-aria-dialog-pattern) (only the
Evidence Board qualifies, already done); live regions → [C2](#c2--announce-dynamic-changes-via-a-pre-existing-live-region) (local ones done, global announcer open); drag alternative →
[D1](#d1--drag-to-connect-needs-a-single-pointerkeyboard-alternative) (already satisfied — board isn't
drag-based).

#### G2 — Color-independence & contrast *(High for color-independence · 3-0 · 🟡 real gap found)*
Never convey essential information by color alone (WCAG **SC 1.4.1 Use of Color**, Level A). **Audit
finding:** the clue-card **`connected`** state is signalled by a **yellow ring with no icon/text** — a
concrete color-only gap; add a redundant cue (e.g. a link/🔗 badge). *Contrast* is a **separate**
requirement the draft mis-cited under 1.4.1 — use **SC 1.4.3** (text contrast ≥ 4.5:1),
**SC 1.4.11** (non-text UI/graphics ≥ 3:1), and **SC 2.4.7 / 2.4.11** (visible, adequately-contrasting
focus indicators) for the dark gaslit theme.
Sources: [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/),
[WCAG SC 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html).

#### G3 — Touch fallback (secondary priority, but non-trivial)
Desktop-first, but note: click-select works on touch, yet a *real* touch fallback needs target size
(≥44px), spacing, pointer-cancellation, non-hover affordances (the ghost thread is mouse-only), and
zoom/reflow behavior. Treat as a scoped follow-up, not "free."

### H. Onboarding, pacing & retention

Strongest verified guidance is **pacing-as-teaching** ([B2](#b2--choices-that-matter-pace-coerce-foreshadow)) combined with self-paced prose ([A1](#a1--prose-must-be-self-paced)): teach faculty/dice/deduction mechanics *through* the narrative, not modal tutorials.

> **⭕ Under-researched:** onboarding-without-walls, session length, and **save-resume / drop-off**
> UX for text-heavy IF were only glancingly addressed. This is the weakest-covered topic and a prime
> follow-up.

---

## Part III — Surface taxonomy (replaces the blanket "modal" recommendation)

The draft's error was lumping four different surface types under "modal dialog." Each type has a
*different* accessibility contract. Classify before prescribing:

| Surface type | G&G examples | Correct contract |
|--------------|--------------|------------------|
| **Modal dialog** (blocks the app; must be dismissed) | Evidence Board, Case Journal, NPC Gallery, Settings panel (the lazy overlays in `App.tsx:362`) | `role="dialog"` + `aria-modal="true"` + accessible name; focus trap with wrap; Escape closes; focus moves in on open and restores on close; background inert; visible close control. *(Evidence Board already conforms.)* |
| **Route screen** (full-screen, replaces prior view) | Load Game, Case Selection, Title | Landmark structure (`<main>`, headings); focus moves to the heading/first control on navigation; a clear Back control; **no** focus trap (it's a page, not an overlay). |
| **Toast / status** (transient, non-blocking) | Save toast, dice result card, board connect-hints | `role="status"`/`aria-live="polite"` (or `alert`/`assertive` for errors/halts); **must not** steal focus or trap; auto-dismiss or be dismissible; never gate progress. *(Save toast and dice overlay already conform.)* |
| **Inline overlay** (in-flow visual, not a dialog) | Connection ghost-thread, thread SVG | Decorative/`aria-hidden` where it conveys nothing new; the underlying data must be reachable without it. |

**Rule of thumb:** if the user *must act on it before continuing*, it's a dialog. If it *informs
without blocking*, it's a status. If it *replaces the screen*, it's a route. Don't give a status the
focus-trapping behavior of a dialog.

---

## Part IV — Accessibility acceptance criteria (per surface)

Concrete, testable criteria a future implementation task can turn into tests. Items marked ✅ are
already met per Part I; ⭕ are open.

**Modal dialogs** (Evidence Board & the other lazy overlays)
- ✅ `role="dialog"` + `aria-modal="true"` + accessible name *(Evidence Board)*.
- ✅ Focus trap with wrap; Escape closes *(Evidence Board via `useFocusTrap`)*.
- ⭕ Verify **focus restores** to the invoking control on close, for **all** overlays (Journal,
  Gallery, Settings), not just the board.
- ⭕ Verify **background inertness** (`inert`/`aria-hidden` on the app root while an overlay is open).
- ✅ Visible close control *(the `×` button)*.

**Global live announcer** — ✅ **shipped (Phase 1, PR #80)**
- ✅ One always-mounted `aria-live="polite"` region (plus an `assertive` one for halts/errors) and an
  `announce(message, {assertive?})` API — mounted at the app root in `main.tsx` (not
  `AccessibilityProvider`, which remounts per screen), with a per-mount empty-commit gate.
- ⭕ *(Phase 2/3)* Route deduction outcomes and dice/probability feedback through it (short *status*
  strings — **not** full narrative text; see [Anti-patterns](#anti-patterns-to-avoid) #live-region-flooding). Stat/scene events are intentionally **not** routed — they already have local `aria-live` coverage.
- ✅ Test: the region nodes persist across a screen switch and never unmount (covered by the Phase 1 suite).

**Reduced motion** (🟡 mechanism exists; coverage unproven)
- ⭕ Acceptance criterion **per animation source**: Motion (`m`) components ✅; **CSS/Tailwind**
  (`animate-pulse` on new clue cards, loading pulse) ⭕; any timers/auto-advance ✅ (none block);
  ghost-thread motion ⭕.
- ⭕ Test: with the store `reducedMotion` flag on (and/or OS pref set), transform/scale animations are
  suppressed while opacity cross-fades may remain.

**Contrast & focus** (dark gaslit theme)
- ⭕ Text ≥ **4.5:1** (SC 1.4.3); non-text UI/graphical objects ≥ **3:1** (SC 1.4.11).
- ⭕ Visible, ≥3:1 focus indicators (SC 2.4.7 / 2.4.11) — audit the amber-on-dark `focus-visible` rings.

**Keyboard operation** (evidence board)
- ✅ Cards are focusable (`tabIndex=0`) and connect via Space/Enter.
- ⭕ Acceptance criteria the library defaults *don't* prove: cancel a connection (Escape ✅), a
  keyboard path to **delete/undo** a connection, a clear **selected** state announced to AT, and a
  keyboard route to the deduction action.

**Touch fallback** (secondary)
- ⭕ Target size ≥44px, spacing, pointer-cancellation, non-hover affordance for the connect flow,
  recovery from an accidental source-selection.

---

## Part V — Choice & deduction: from abstract to acceptance criteria

The reviewer's fair challenge: [B1](#b1--choice-presentation-is-a-taxonomizable-design-space) and
[D3](#d3--deduction-verification-avoid-binary-whole-puzzle-rightwrong) are too abstract to implement
safely. Concrete bridges:

**Choice presentation (B1) → content-model tasks (not research conclusions).** *If* the four-axis
model is adopted, it implies work in the existing declarative pipeline:
- A `choice` schema field set for presentation state (e.g. `visibility: hidden | disabled | shown`,
  and a `gateReason` for why it's locked) — driven by the existing Condition system, not per-scene
  logic.
- Authoring rules in `docs/content-authoring.md` for when to hide vs. disable-with-reason.
- Validator (`scripts/validateCase.ts`) checks that disabled choices carry a `gateReason`.
- UX criteria: locked/available/consequential states use redundant cues (icon + text + color;
  see [G2](#g2--color-independence--contrast)).
These are **design/implementation decisions**, flagged here so they aren't mistaken for verified
findings.

**Deduction verification (D3) → the actual G&G model.** The board does **not** have slots or batches;
it rolls a **Reason check (DC 14) on a connected set** and matches a recipe by subset
(`DeductionButton.tsx`, `buildDeduction.ts`). Mapping the exemplars onto *this* model:
- *Golden Idol's partial-correctness* → today a failed check marks **all** connected clues
  `contested` uniformly. A closer analogue: on `partial` tier (which currently reads as failure),
  surface *"some of these belong together, but the link isn't complete"* rather than a flat fail —
  giving directional feedback without revealing the answer. **This is a design proposal, not a
  verified pattern.**
- *Obra Dinn's anti-guessing* → the DC-14 dice gate already deters brute-forcing (a wrong set can
  still pass on a lucky roll, and a right set can fail on an unlucky one — worth examining whether
  that randomness *helps or hurts* deduction legibility). Consider whether recipe matches should be
  **deterministic** (set-correct = success) with the dice reserved for *flavor*, or whether the roll
  should stay load-bearing. **Open design question — needs a decision, not more research.**
- Concrete rules to decide before building: *when* to validate (on button press ✅), *what feedback*
  each tier shows, and how to prevent trial-and-error connect-spam (e.g. a composure cost on repeated
  failed deductions).

---

## Part VI — Prioritized backlog (reframed)

Reframed so **product comprehension** (can players understand clues, choose intentionally, solve
deductions, and resume cleanly?) ranks alongside well-sourced plumbing — and so already-done items
aren't presented as work. Ordered by *value*, annotated with *evidence strength* and *audit status*.

**Do now — small, verified, real gaps:**
1. ✅ **Global live announcer** — **done (Phase 1, PR #80):** `src/announcer.ts` + `<LiveAnnouncer>` at the app root. Phases 2/3 route deduction/dice feedback through `announce()`. [Part IV](#part-iv--accessibility-acceptance-criteria-per-surface)
2. ✅ **`connected` clue-state color-only fix** — **done (Phase 2a, PR #82):** derived 🔗 cue + ring. [G2](#g2--color-independence--contrast)
3. ✅ **Reduced-motion coverage audit** — **done (Phase 4, PR #85):** direct per-gate guards (framer-motion mock) + structural CSS guard; live-verified the `.reduced-motion` class zeroes CSS animation. [F1](#f1--reduced-motion-must-cover-every-animation-source-not-just-motion-components)
4. ✅ **Focus-restore + inertness across *all* overlays** — **done (Phase 4, PR #85):** SettingsPanel → `useFocusTrap`; title-screen inert; **fixed the inert-blurs-invoker WCAG 2.4.3 bug** (open-time `restoreFocusTo` capture) so focus restores to the trigger, not `<body>`. [Part IV](#part-iv--accessibility-acceptance-criteria-per-surface)
5. ✅ **Contrast/focus-indicator pass** — **done (Phase 4, PR #85):** all keyboard rings standardized to `focus-visible:ring-2 ring-amber-400` (glob-guarded), computed contrast table (amber ring 9.90:1 on ink), live-verified visible on dark + high-contrast; targets SC 1.4.3/1.4.11/2.4.7 (2.4.11 was a mis-cite, corrected).

**Preserve (don't re-solve):**
- Self-paced prose ([A1](#a1--prose-must-be-self-paced)); polite/assertive save toast; the board's
  keyboard connect path ([D1](#d1--drag-to-connect-needs-a-single-pointerkeyboard-alternative)); dice
  overlay as a status card. Add regression tests so refactors don't lose them.

**Larger bets — product-facing, need a design decision first:**
6. **Deduction feedback legibility** ([D3](#d3--deduction-verification-avoid-binary-whole-puzzle-rightwrong) → [Part V](#part-v--choice--deduction-from-abstract-to-acceptance-criteria)) — decide the role of the DC-14 roll vs. deterministic set-correctness; add partial-tier directional feedback. *Highest product value; Medium-conf evidence.*
7. **Dice/probability legibility** ([C-open](#c-skill-check--dice-ux)) — surface the DC, modifier, and advantage state before/at the roll. *No verified pattern yet — research + design.*
8. **Choice-gating signalling** ([B1](#b1--choice-presentation-is-a-taxonomizable-design-space)/[B2](#b2--choices-that-matter-pace-coerce-foreshadow) → [Part V](#part-v--choice--deduction-from-abstract-to-acceptance-criteria)) — schema + validator + authoring rules for hidden vs. disabled-with-reason.
9. **Save-resume / drop-off UX** ([H](#h-onboarding-pacing--retention)) — *unresearched*; needs its own study.

**Deprioritized / likely-YAGNI:**
- **React Flow migration** ([D2](#d2--if-a-node-link-redesign-is-ever-needed-use-react-flow--not-xyflowsystem)) — the custom board is accessible and works; migrate only if a future redesign needs true node-link canvas features.

---

## Anti-patterns to avoid

| Anti-pattern | Failure mode | Ref |
|--------------|--------------|-----|
| **Treating a status card as a modal** | Focus-trapping a passive dice/toast surface would strand keyboard users on non-interactive content | [Part III](#part-iii--surface-taxonomy-replaces-the-blanket-modal-recommendation) |
| **Focus-trapping a route screen** | Route screens are pages, not overlays; a trap breaks normal navigation | [Part III](#part-iii--surface-taxonomy-replaces-the-blanket-modal-recommendation) |
| <a id="live-region-flooding"></a>**Announcing full narrative text via a live region** | Fights self-paced prose ([A1](#a1--prose-must-be-self-paced)) and floods the SR — announce short *status* strings + move focus to the scene heading instead | [C2](#c2--announce-dynamic-changes-via-a-pre-existing-live-region) |
| **Injecting content into a live region created at the same instant** | AT stays silent — the region must pre-exist; SPA re-renders that recreate the node break it | [C2](#c2--announce-dynamic-changes-via-a-pre-existing-live-region) |
| **Overusing `aria-live="assertive"`** | Constant interruptions dilute the halt-scene/error signal that truly needs it | [C2](#c2--announce-dynamic-changes-via-a-pre-existing-live-region) |
| **Signalling a state by color alone** (e.g. `connected` = yellow ring only) | Invisible to colorblind users; worse on a low-contrast dark theme | [G2](#g2--color-independence--contrast) |
| **Assuming a library's a11y defaults = an accessible workflow** | Focusable nodes ≠ operable connect/cancel/delete/announce flow; still need app-level criteria | [D2](#d2--if-a-node-link-redesign-is-ever-needed-use-react-flow--not-xyflowsystem), [Part IV](#part-iv--accessibility-acceptance-criteria-per-surface) |
| **`MotionConfig` as the *only* reduced-motion mechanism** | Misses CSS/Tailwind/timer/canvas/audio motion | [F1](#f1--reduced-motion-must-cover-every-animation-source-not-just-motion-components) |
| **Citing SC 1.4.1 for contrast thresholds** | 1.4.1 is color-independence only; contrast needs 1.4.3 / 1.4.11 | [G2](#g2--color-independence--contrast) |
| **Binary whole-puzzle right/wrong deduction** | Players can't tell which link was wrong; invites confirmation-farming | [D3](#d3--deduction-verification-avoid-binary-whole-puzzle-rightwrong) |
| **Forcing everything diegetic "for immersion"** | Rests on a **refuted** premise; can obscure state without the claimed payoff | [Refuted claim](#refuted-claim) |
| **Advising a codebase you haven't read** | The original failure here — recommendations that are already-done or actively harmful | this whole restructure |

---

## Refuted claim

One candidate claim was **refuted** in verification (vote **1-2**) and **must not be relied on**:

> ❌ *"Diegetic UI elements — those the avatar can also perceive within the world — increase player
> immersion and enhance the narrative experience."*

**Takeaway:** treat "diegetic = more immersive" as **unproven**. Use the HUD taxonomy ([E1](#e1--classify-hud-surfacing-with-the-diegeticmetaspatialnon-diegetic-taxonomy)) as a *classifier*, not a mandate.
Source of the refuted claim: [Game Developer — UI design in video games](https://www.gamedeveloper.com/design/user-interface-design-in-video-games).

---

## Open questions (under-researched — commission follow-up)

Not answered by verified findings; the highest-value targets for a second research pass:

1. **A — Typography-as-atmosphere:** measure/line-length, leading, period font, reveal timings
   (Pentiment/Roadwarden specifics didn't survive verification).
2. **B — Diegetic state-gating signalling** without breaking the Victorian tone.
3. **C — Dice drama & probability legibility:** odds/modifiers/advantage transparency;
   success-with-cost / failure-forward — including whether the DC-14 roll should stay load-bearing.
4. **F — Audio / Howler.js:** ambient-loop layering, crossfade, ducking. Nothing survived.
5. **H — Onboarding & retention:** onboarding-without-walls, session length, save-resume / drop-off.

---

## Caveats, provenance & confidence

- **Not the harness output.** The research ran in an ephemeral multi-agent harness; its raw
  transcript is **not committed** to the repo, so the "24 confirmed / 1 refuted" vote record is
  **not independently auditable from here**. Treat the vote record as *provenance metadata*, not as a
  committed source ledger. If it needs to justify implementation priority, commit the ledger or rely
  on the primary citations directly (they stand on their own).
- **Source count.** The doc references **24 unique URLs** though the harness "fetched 22" — the extra
  two (e.g. the Obra Dinn Wikipedia page) were added at **synthesis** as corroboration, not fetched as
  primary angles.
- **Confidence stratifies by source.** Accessibility/library facts rest on primary, stable W3C/MDN/
  official sources (highest confidence). Exemplar patterns (Golden Idol, Obra Dinn, inkle, the HUD
  taxonomy) are credible but **secondary/journalistic**; "directly transferable to G&G" is design
  opinion.
- **Precision caveats.** (1) Golden Idol's indicator reports *how many* slots are wrong, not *which*;
  (2) Obra Dinn's "batches of three" — final six validate in twos; (3) the ICIDS paper's exact
  sub-dimensions weren't read (auth wall) — only the four-axis structure is verified;
  (4) `@xyflow/system` is pre-1.0 and maintainer-discouraged standalone; (5) dnd-kit's built-in SR
  strings are English-only.
- **Framer Motion / Motion rebrand.** The repo pins **`framer-motion@^12.42.2`** and imports from
  `framer-motion` (via `LazyMotion` + the `m` component). "Motion" is a package **rename** (`motion`,
  `motion/react`), *not* merely cosmetic re-labeling; `framer-motion` v12 remains published and API-
  compatible, so existing imports are fine — but don't call the change "cosmetic," and don't assume
  `motion/react` examples map 1:1 without checking the installed package.
- **Fandom.** An earlier draft credited "Wikipedia/Fandom" corroboration for the Obra Dinn claim but
  didn't list Fandom. Only **Wikipedia** is used and listed below; the Fandom reference is dropped.
- **This is not a finished audit.** Part I reflects a focused reading of the named components, not an
  exhaustive sweep. Verify each ⭕/🟡 item against current code before building.

---

## Sources

**Primary (highest confidence):**
- [W3C ARIA APG — Dialog (Modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [W3C WCAG 2.2 — SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- [W3C WCAG 2.2 — Understanding (Timing Adjustable 2.2.1; contrast 1.4.3/1.4.11; focus 2.4.7/2.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/)
- [W3C WCAG — Use of Color (SC 1.4.1)](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- [MDN — ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [Game Accessibility Guidelines — full list](https://gameaccessibilityguidelines.com/full-list/)
- [React Flow (xyflow) — Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)
- [dnd-kit (GitHub)](https://github.com/clauderic/dnd-kit)
- [@xyflow/system (npm)](https://www.npmjs.com/package/@xyflow/system)
- [Motion (Framer Motion) — React accessibility](https://motion.dev/docs/react-accessibility)
- [Springer LNCS — "A Multidimensional Classification of Choice Presentation in Interactive Narrative" (ICIDS 2018)](https://link.springer.com/chapter/10.1007/978-3-030-04028-4_12)

**Secondary / journalistic (medium confidence):**
- [Game Developer — Innovating interactive fiction with 80 Days (Jon Ingold, GDC 2015)](https://www.gamedeveloper.com/design/video-innovating-interactive-fiction-with-i-80-days-i-jon-ingold)
- [Game Developer — Case of the Golden Idol](https://www.gamedeveloper.com/design/case-of-the-golden-idol)
- [Game Developer — User interface design in video games (HUD taxonomy; also the refuted claim)](https://www.gamedeveloper.com/design/user-interface-design-in-video-games)
- [Wikipedia — Return of the Obra Dinn](https://en.wikipedia.org/wiki/Return_of_the_Obra_Dinn)

**Blogs / forums (corroborating leads, lower confidence):**
- [playxix.com — Obra Dinn UI deduction evolution](https://playxix.com/blog/obra-dinn-memento-mori-ui-deduction-evolution-2018-1773136912544)
- [kokutech.com — Obra Dinn design patterns](https://www.kokutech.com/blog/gamedev/design-patterns/unique-mechanics/return-of-the-obra-dinn)
- [intermittentmechanism.blog — Confirmation in Obra Dinn](https://intermittentmechanism.blog/2024/05/21/confirmation-in-the-return-of-obra-dinn/)
- [gabrielchauri.com — Disco Elysium RPG system analysis](https://www.gabrielchauri.com/disco-elysium-rpg-system-analysis/)
- [emshort.blog — Interactive Narrative GDC Talks (Part 1)](https://emshort.blog/2015/04/02/interactive-narrative-gdc-talks-part-1/)
- [emshort.blog — Quality-Based Narrative](https://emshort.blog/category/quality-based-narrative/)
- [intfiction.org — Prototyping a Fallen London-like browser game](https://intfiction.org/t/design-for-prototyping-a-fallen-london-like-browser-game/74493)
- [synergycodes.com — Accessible diagrams with React Flow](https://www.synergycodes.com/webbook/building-usable-and-accessible-diagrams-with-react-flow)
- [joshwcomeau.com — prefers-reduced-motion in React](https://www.joshwcomeau.com/react/prefers-reduced-motion/)

---

*Layered reference: verified research patterns + a code-checked repo audit. The audit corrects the
first draft's untested premises; the research findings stand on their cited sources. Confirm every
open (⭕) / partial (🟡) item against current code before implementing.*
