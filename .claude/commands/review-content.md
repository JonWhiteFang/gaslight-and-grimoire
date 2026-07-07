---
description: Design/tone review of changed narrative content via the content-integrity-reviewer subagent (the layer scripts/validateCase.mjs can't check)
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(node scripts/validateCase.mjs), Bash(node scripts/validateCase.mjs :*), Task
---

Review narrative content for the **design and tone** rules the static validator cannot enforce
(single-faculty dead-ends, cosmetic branching, red-herring/deduction mismatches, backwards effect
deltas, semantically-wrong-but-valid edges, tone drift).

## Steps

1. **Determine the scope.** If the user passed a case/vignette id or path in `$ARGUMENTS`, review that.
   Otherwise, find the content changed this session:
   `git status --short -- public/content/` and `git diff --name-only -- public/content/`.
   If nothing under `public/content/` changed and no target was given, say so and stop — there is
   nothing to review.

2. **Structural pre-check.** Run `node scripts/validateCase.mjs` first. If it reports **errors**, fix
   the structural breakage (or hand it back) before design review — a review on top of broken edges is
   noise. Warnings are fine to carry into the review.

3. **Dispatch the reviewer.** Launch the `content-integrity-reviewer` subagent (Task tool,
   `subagent_type: "content-integrity-reviewer"`) with the concrete list of changed/target files and
   the case id. It is read-only and returns findings ranked by severity.

4. **Report and act.** Relay the reviewer's verdict and findings. For each `blocker`, apply the
   proposed fix (or surface it if it needs a judgment call), then re-run `node scripts/validateCase.mjs`
   to confirm the fix didn't break structure. Leave `warning`/`nit` findings for the user to weigh.

$ARGUMENTS
