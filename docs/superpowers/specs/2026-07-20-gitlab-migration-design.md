# GitHub → GitLab Migration — Design

**Date:** 2026-07-20
**Status:** Approved
**Scope:** Move the repo's hosting from `github.com/JonWhiteFang/gaslight-and-grimoire` to
gitlab.com, keeping full commit history and issue/PR history, with CI, dependency automation,
and the Cloudflare deploy re-established on the GitLab side. Full cutover — GitHub is archived
(read-only), not mirrored.

## Decisions (made during brainstorming)

| Question | Decision |
|---|---|
| Destination / cutover model | Full cutover to gitlab.com; GitHub repo archived afterward (never deleted) |
| Issue/PR history | GitLab's GitHub importer brings everything: issues, PRs-as-MRs, comments, labels |
| CI/automation parity | Faithful port: merge gate + scheduled security job in `.gitlab-ci.yml`; Renovate replaces Dependabot |
| Visibility / namespace | Public project under the personal gitlab.com namespace |
| Merge method | Merge commit, **squash disabled** (preserves the repo's no-squash rule) |

## 1. Destination & end state

Public project at `gitlab.com/<username>/gaslight-and-grimoire` (personal namespace). Default
branch `main`. Project settings: merge method = merge commit; squash option disabled on MRs.

The GitHub repo is **archived** as the final step. Rationale: every "PR #N" / "issue #N"
reference in `docs/RUN_LOG.md`, the ADRs, and commit messages keeps resolving forever. Imported
GitLab numbering will NOT match GitHub numbering (GitHub shares one counter across issues+PRs;
GitLab uses separate counters) — this is accepted; the archive is the canonical reference for
historical numbers.

## 2. Import

Use GitLab's built-in **GitHub importer** (New project → Import project → GitHub, authorised via
a GitHub personal access token with `repo` scope). One operation imports: full git history, all
branches and tags, all ~32 issues, all PRs as MRs (state preserved), comments, and labels.

**Pre-import quiesce (on GitHub):**
- Merge or close the 2 open PRs.
- Delete stale remote branches (2 dependabot branches, `feat/phase3-dice-legibility`) so nothing
  is mid-flight at cutover.

**Post-import verification:**
- `git rev-list --count main` matches between old and new clones; HEAD SHAs identical.
- Spot-check a known PR (e.g. GitHub PR #87, The Orrery Room) exists as a merged MR with its
  comments.
- Open-issue count on GitLab matches GitHub (2 at time of writing — recount at execution).

## 3. CI port — `.gitlab-ci.yml`

Reproduces both existing workflows. The `.github/` directory is deleted in the same commit that
adds `.gitlab-ci.yml` (no window where both or neither CI exists on the GitLab side).

**Merge gate** (runs on MRs and pushes to `main`) — mirrors `deploy.yml`:
- `test` job: `npm run lint` → `node scripts/validateCase.mjs` → `npm run test:run`
- `build` job: `npm run build`, with `needs: [test]` — same gating as today (a failing
  lint/validator/test blocks the build job and therefore the MR).
- Node version from `.nvmrc`. npm cache keyed on `package-lock.json`.
- `interruptible: false` on both jobs (maps GitHub's `concurrency: cancel-in-progress: false`).

**Security** (mirrors `security.yml`) — runs on MRs + a weekly **pipeline schedule**
(Mon 08:00 UTC, created in GitLab UI; the schedule itself is not representable in-repo):
- `npm audit` step.
- OWASP Dependency-Check, fail on CVSS ≥ 7 (same threshold as today).

Note: `deploy.yml`'s name ("CI") and its build-compiles-only role carry over unchanged in
spirit — GitLab CI never publishes anything; deploy remains Cloudflare-side (§5).

## 4. Dependency updates — Renovate

GitLab has no native Dependabot. Renovate replaces `.github/dependabot.yml`:
- `renovate.json` in-repo replicating current behaviour: weekly schedule, npm minor+patch
  grouped, majors grouped, and GitLab CI component/image updates in place of the
  github-actions ecosystem.
- Runner: the **hosted Mend Renovate app for GitLab** (zero-maintenance). Fallback if the hosted
  app is undesirable: a scheduled GitLab CI job running the `renovate/renovate` image.

## 5. Cloudflare re-connect (owner-side, manual)

Cloudflare Workers Builds supports GitLab. Steps (owner-managed, same category as the original
Worker setup in ADR-0007):
1. Disconnect the GitHub integration from the Worker's build settings.
2. Connect the GitLab project; build command `npm run build`, output `./dist` — `wrangler.jsonc`
   and `scripts/nest-for-cloudflare.mjs` unchanged.
3. Verify: push a trivial commit to `main`, confirm
   `holodeck.jonwhitefang.uk/gaslight-and-grimoire/` serves the new build.

## 6. Docs sweep

Update forward-looking docs; leave historical records untouched (RUN_LOG entries, old ADRs, and
audit reports describe the past accurately and are not rewritten):
- `CLAUDE.md` — CI/CD section (workflow filenames → `.gitlab-ci.yml`, schedule note), merge
  strategy (`gh pr merge --merge` → `glab mr merge` with squash disabled), Dependabot → Renovate.
- `README.md` — badges/links if any point at GitHub.
- `docs/PROJECT_STATE.md` — hosting note.
- New ADR **ADR-0014: GitLab migration** — records this decision as a successor to ADR-0007's
  deploy context rather than editing ADR-0007.
- Sweep remaining live references found by `grep -ril github` (excluding `node_modules`,
  `package-lock.json`, and historical docs).

## 7. Tooling cutover

- Local clone: `git remote set-url origin git@gitlab.com:<username>/gaslight-and-grimoire.git`
  (or https), verify `git fetch` + `git push` round-trip.
- CLI: `glab` replaces `gh` (`brew install glab`, `glab auth login` once).
- The 2 open GitHub issues arrive via the importer — nothing recreated by hand.

## 8. Order of operations & rollback

1. Quiesce GitHub (merge/close open PRs, delete stale branches).
2. Run the GitLab importer; verify (§2).
3. Set GitLab project settings (visibility public, merge-commit, squash disabled).
4. Land the CI commit (`.gitlab-ci.yml` added, `.github/` removed, `renovate.json` added);
   confirm the pipeline is green on GitLab.
5. Create the weekly security pipeline schedule; enable Renovate.
6. Re-point Cloudflare (§5); verify deploy.
7. Docs sweep + new ADR committed; run `/checkpoint`.
8. Archive the GitHub repo (Settings → Archive). **Point of no return is only this step, and
   even it is reversible (unarchive).**

**Rollback:** at any point before step 8, GitHub remains fully intact and connected — abandon
the GitLab project and reconnect Cloudflare to GitHub if needed.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Issue/MR numbering diverges from GitHub numbers cited in docs spine | Accepted | Archived GitHub repo is the canonical reference for historical numbers |
| GitLab free tier CI minutes (400/mo on gitlab.com) | Low | Jobs are light; public projects get generous allowances. Weekly Dependency-Check is the heaviest job — first to trim if pinched |
| Hosted Renovate app permissions/availability | Low | Fallback: scheduled CI job running the renovate image |
| Cloudflare GitLab integration behaves differently from GitHub | Low | Verified by a real push-to-deploy before archiving GitHub |
| Open PRs lost in import | Avoided | Quiesce step merges/closes them pre-import |
