---
name: checkpoint
description: Use at the end of a working session, before finishing or committing, to persist project
  memory and keep the docs current — runs a fast doc-drift sweep (fixing stale status/version/link
  drift), adds an ADR if a non-trivial decision was made, updates docs/PROJECT_STATE.md, and prepends
  a docs/RUN_LOG.md entry.
---

# Checkpoint — persist project memory

Run this before wrapping up a session so the **committed memory spine** reflects reality. The spine
lives in the repo (version-controlled, team-shareable) — distinct from any tool's machine-local
auto-memory.

## Steps

1. **Review what changed this session.** Run `git status` and `git diff --stat`. Recall the session's
   goal, what actually changed, and what's still open.

   **Content-integrity gate.** If this session changed any file under `public/content/`
   (check the `git status` / `git diff --stat` output), run a design/tone review before proceeding:
   first `node scripts/validateCase.mjs` (structural — fix any errors), then dispatch the
   `content-integrity-reviewer` subagent (Task tool, `subagent_type: "content-integrity-reviewer"`)
   with the list of changed content files. Apply/​surface any `blocker` findings and re-validate.
   Skip this gate entirely when no `public/content/` files changed. (Equivalent to running
   `/review-content` for the session's changes.)

2. **Doc-drift sweep** (keep the docs honest — a *fast, mechanical* pass, not a full audit). Establish
   **ground truth from code/config/git, not from another doc** (a stale doc citing a stale doc proves
   nothing), then scan for drift against it:
   - **Status drift.** Anything naming a phase/stage, "complete/planned/pending", PR numbers, or dates
     as a *current* claim — does it still hold? (`git log`, the tracker.) Usual offenders: `README.md`,
     `CLAUDE.md`, `docs/status.md`, and any "Last updated" / "Status:" lines.
   - **Version / fact drift.** Test counts, tool versions, dependency versions, module/file names, IDs,
     paths, command targets — grep the value and confirm it matches the project's actual config files.
     In this repo the live test baseline comes from `npm run test:run` and content counts from
     `node scripts/validateCase.mjs` — cite those, don't guess.
   - **Broken internal links.** Verify the target of each changed/added relative `.md` link exists.
   - **Duplication that drifted.** If two docs state the same fact and now disagree, the one that isn't
     the authority is the bug — fix it to *point at* the authority rather than re-state it.

   **Scope it to the session.** Default to the docs this session plausibly affected (what `git diff`
   touched, plus `CLAUDE.md` / `docs/` / the spine, which drift most). A full repo-wide audit is a
   separate, on-demand task — don't run it here.

   **Fix policy:**
   - **Auto-fix** unambiguous drift (stale status line, wrong version string, dead link, a duplicated
     fact that should be a pointer). Make the minimal edit.
   - **Never rewrite history.** `RUN_LOG.md` entries and ADR decisions are point-in-time records — do
     not "correct" them. If an ADR's body states a fact later superseded, record the supersession in its
     front matter (`status`, `superseded-by`) and in the `DECISIONS/README.md` index (with a dated note);
     never edit the body itself.
   - **Surface, don't guess.** If a discrepancy needs a judgment call, list it in the report for the
     user instead of editing.

   Record what you fixed (and what you flagged) in the RUN_LOG entry (Step 5).

3. **Add an ADR** *only if* a non-trivial decision was made this session (a choice with alternatives and
   consequences). Copy `docs/DECISIONS/ADR-TEMPLATE.md` to `docs/DECISIONS/ADR-NNNN-<slug>.md` (next
   number in sequence), fill it in, and add its row to the `docs/DECISIONS/README.md` index. Steps 4
   and 5 link to it.

4. **Update `docs/PROJECT_STATE.md`** (keep it ~one page):
   - Bump `_Last updated:_` to today (with a one-line "what changed + what's next").
   - Move any item `[ ]`→`[~]`→`[x]` / `[!]` in the phase/milestone tracker.
   - Refresh **Current position** (especially the **Verification** line — cite the latest
     `npm run test:run` result), **Next actions**, and **Open questions** (linking any ADR from Step 3).

5. **Prepend an entry to `docs/RUN_LOG.md`** at the **top** (newest first), using the template in that
   file: Goal, Did, Verified (commands/tests + results, or "n/a — no code yet"), Open/blockers, and
   which memory artifacts you updated (linking any ADR from Step 3). Include the sweep's fixes/flags
   from Step 2.

6. **Report** a short summary of what you updated — including what the sweep fixed and anything it
   flagged. Do **not** commit unless the user asks — surface the changed files so they can review. The
   normal expectation is that spine updates ride along with the session's work in the same commit/PR
   (that's what makes the memory *committed*); a separate memory-only commit is fine when the user
   prefers it.

## Guardrails

- **Write surface.** The memory-spine steps (3–5) write **only** to `PROJECT_STATE.md`, `RUN_LOG.md`,
  and `DECISIONS/`. The doc-drift sweep (Step 2) may also edit other docs **but only to correct verified
  drift** per its fix policy — never to add features, restructure, or rewrite content. Never touch code.
- Do not duplicate architecture/scope rules into the spine — those live in `CLAUDE.md` and `docs/`. The
  spine tracks *progress and decisions*, then *points* at the authoritative docs.
- The sweep is a **fast scan, not a full audit.** If it starts ballooning, stop and tell the user a full
  doc audit is warranted as its own task.
- If nothing meaningful changed, it's fine to run a quick sweep, prepend a brief RUN_LOG entry, and skip
  the rest. Don't manufacture state changes.
- A conservative variant: run the sweep **report-only** outside the spine — list drift findings instead
  of fixing them. The default auto-fix policy is deliberate; downgrade only if the user asks for it.
- **Checkpoint on the branch you worked on.** If the spine moved on `main` while you worked, rebase/merge
  first so the checkpoint updates the latest STATE, not a stale one. `PROJECT_STATE.md` conflicts: take
  the newer session's version wholesale, then re-check the trackers reflect both branches' work.
  `RUN_LOG.md` conflicts: keep both entries, newest date first. ADR number races: the branch that merges
  second renumbers (numbers are cheap and never reused).
