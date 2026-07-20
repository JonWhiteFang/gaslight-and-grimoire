# GitLab Migration Plan Review

**Verdict: 1 Blocker / 3 Major / 3 Minor**

## Findings

### Blocker 1 - The plan creates pipelines but never makes them a merge requirement

**Plan section:** Task 3 Step 2 and Task 4 Steps 7-8
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:109`,
`:311`, `:319`).

The project update sets only `merge_method=merge` and `squash_option=never`. GitLab's project default
for `only_allow_merge_if_pipeline_succeeds` is false, and GitLab documents that GitHub's **Require
status checks to pass before merging** rule is not imported. Merely observing a green pipeline does not
make the pipeline a merge gate; an owner can merge a red MR. This violates the binding requirement that
a failed lint/validator/test/build check block merge and makes the claimed end-to-end test false-positive.

**Evidence:** The GitLab Projects API documents
`only_allow_merge_if_pipeline_succeeds` as the **Pipelines must succeed** setting:
<https://docs.gitlab.com/api/projects/#update-a-project>. The importer explicitly excludes GitHub's
required-status-check rule:
<https://docs.gitlab.com/user/project/import/github/#branch-protection-rules-and-project-settings>.
The required gate is stated in the design at
`docs/superpowers/specs/2026-07-20-gitlab-migration-design.md:53-58` and in
`CLAUDE.md:134-141`.

**Fix:** In Task 3, set and verify
`only_allow_merge_if_pipeline_succeeds=true` (and keep
`allow_merge_on_skipped_pipeline=false`), using `-F` for booleans. Verify those response fields before
opening the cutover MR. Also verify the MR is unmergeable while its pipeline is running or failed, not
only that a green pipeline can be merged.

### Major 1 - The Renovate grouping rules apply to every manager, not just npm

**Plan section:** Task 4 Step 3
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:259-281`).

Both package rules match only update type. Renovate therefore gives every minor/patch dependency from
every enabled manager the same `minor-and-patch` group, and likewise every major the same `major`
group. That includes both GitLab CI images (`node:20.19` and
`owasp/dependency-check:12.1.0`), not merely npm packages. A Node runtime or security-scanner image
upgrade can consequently be bundled with application dependency upgrades. This does not reproduce
`.github/dependabot.yml`, where grouping exists only inside the npm ecosystem
(`.github/dependabot.yml:6-24`) and action updates are separate (`:26-35`).

There is a second parity difference: `prConcurrentLimit: 5` is repository-wide, while the old
Dependabot file allows five npm PRs and five GitHub Actions PRs independently.

**Evidence:** Renovate documents that all updates sharing a `groupName` enter the same PR and that
`matchManagers` is how a package rule is restricted:
<https://docs.renovatebot.com/configuration-options/#groupname> and
<https://docs.renovatebot.com/configuration-options/#packagerulesmatchmanagers>. Its `gitlabci`
manager extracts all Docker images from `.gitlab-ci.yml`:
<https://docs.renovatebot.com/modules/manager/gitlabci/>. `prConcurrentLimit` applies per repository,
not per manager:
<https://docs.renovatebot.com/configuration-options/#prconcurrentlimit>.

**Fix:** Add `"matchManagers": ["npm"]` to both grouping rules. Add an explicit, separate
`gitlabci` rule for `owasp/dependency-check`, and explicitly decide whether Renovate should manage the
Node image and `.nvmrc` together or leave Node disabled. Describe the five-PR limit as global, or
redesign it deliberately rather than claiming exact parity. Validate the final config with
`renovate-config-validator`.

### Major 2 - Dependency-Check performs a cold NVD download on every MR, and the first required run precedes the API key

**Plan section:** Task 4 dependency-check job and Step 7; Task 5 Step 2
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:230-256`, `:311-317`,
`:339-341`).

The container's data directory is ephemeral and the job defines no Dependency-Check data cache or
`--data` path under the project. Every MR and weekly run therefore rebuilds the NVD database from
scratch. The first cutover MR is required to be green before Task 5 obtains `NVD_API_KEY`; the plan's
suggestion to jump ahead and retry is an acknowledged ordering dependency, not a reliable gate. Even
with a key, repeated full downloads make the migration's GitLab-minutes estimate materially wrong.

**Evidence:** Dependency-Check documents `--data` as the persistent data directory and an 8,000 ms
NVD request delay without a key (3,500 ms with one):
<https://jeremylong.github.io/DependencyCheck/dependency-check-cli/arguments.html>.
No corresponding cache exists in the proposed job
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:234-256`).

**Fix:** Move NVD-key setup before the cutover MR. Set, for example,
`--data "$CI_PROJECT_DIR/.dependency-check-data"` and add a versioned GitLab cache for that directory.
Exercise both a warm-cache scheduled run and an MR run before calling the security port complete.

### Major 3 - Final documentation is false before archive, then checkpoint changes are left uncommitted

**Plan section:** Task 7 Step 4 and Task 8 Step 3
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:407-412`, `:435-454`).

Task 7 tells `PROJECT_STATE.md` to say GitHub is archived, but archival does not happen until Task 8.
After archival, `/checkpoint` necessarily edits `PROJECT_STATE.md` and `RUN_LOG.md`, yet Task 8 declares
no files and has no commit, push, or MR step. The migration therefore ends with either a committed false
state or uncommitted memory-spine updates. ADR-0014 is also prescribed as `Accepted` and is never
advanced to `Enacted`, despite the index defining Enacted as a decision realised in the repository.

This also contradicts the approved order, which puts the docs sweep and checkpoint before archive
(`docs/superpowers/specs/2026-07-20-gitlab-migration-design.md:116-118`).

**Evidence:** The checkpoint workflow explicitly updates `PROJECT_STATE.md` and prepends
`RUN_LOG.md` (`.claude/skills/checkpoint/SKILL.md:63-77`). ADR status meanings are in
`docs/DECISIONS/README.md:13-18`.

**Fix:** Do not claim archival in Task 7; say it is pending the final checks. After Task 8 archives
GitHub, run checkpoint, set ADR-0014 to Enacted, and explicitly commit and merge those final GitLab-side
memory changes. Update the design's order to acknowledge this final record-only MR, or accept that the
archive itself will not be recorded until a later session.

### Minor 1 - The recorded commit count is never compared

**Plan section:** Task 1 Step 4 and Task 2 Step 2
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:45-52`, `:76-81`).

Task 1 says the commit count is recorded "used to verify the import," but Task 2 checks only the remote
HEAD SHA. The design explicitly requires both HEAD equality and `git rev-list --count main` equality
(`docs/superpowers/specs/2026-07-20-gitlab-migration-design.md:42-45`).

**Fix:** After fetching from GitLab, compare `git rev-list --count origin/main` with the saved count and
record the result. Also verify the expected branch/tag inventory if any refs exist at execution time.

### Minor 2 - Both workflows lose their manual-dispatch path

**Plan section:** Task 4 `workflow:rules`
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:167-171`).

Both GitHub workflows support `workflow_dispatch` (`.github/workflows/deploy.yml:8-13`;
`.github/workflows/security.yml:3-9`). The proposed workflow admits only MR, main-push, and schedule
sources, so GitLab UI/API manual (`web`) pipelines are rejected. That is a silent divergence from the
claimed faithful port and removes an operational way to rerun security independently of the weekly
schedule.

**Fix:** Add an intentional manual-pipeline rule and job rules for the desired manual behavior. If a
manual run should execute all four jobs, include `web` in both workflow and security rules; otherwise
define a documented pipeline variable selecting gate versus security.

### Minor 3 - `interruptible: false` does not reproduce the existing concurrency group

**Plan section:** Task 4 default configuration
(`docs/superpowers/plans/2026-07-20-gitlab-migration.md:163-165`).

`interruptible: false` controls whether a redundant running job can be canceled. It does not serialize
same-ref pipelines. GitHub's current `concurrency.group: ci-${{ github.ref }}` permits only one running
workflow in the group, with `cancel-in-progress: false` preserving that run
(`.github/workflows/deploy.yml:18-20`). The plan can run multiple pipelines for rapid pushes
concurrently while claiming exact mapping.

**Evidence:** GitLab describes `interruptible` as cancellation control and `resource_group` as the
concurrency-limiting keyword: <https://docs.gitlab.com/ci/yaml/#interruptible> and
<https://docs.gitlab.com/ci/yaml/#resource_group>.

**Fix:** Either document the deliberate concurrency divergence or add a tested same-ref serialization
strategy. Keep `interruptible: false` if the non-cancellation guarantee is still required.

## Fidelity Table

| Design section | Plan mapping | Fidelity |
|---|---|---|
| Section 1 Destination and end state | Tasks 2, 3, 8 | **Partial:** public visibility, merge commits, squash-disabled, and archive are covered; successful pipelines are not made mandatory. |
| Section 2 Import | Tasks 1-2 | **Partial:** importer, counts, known-MR comments, and open issues are checked; the saved commit count is never compared. |
| Section 3 CI port | Tasks 4-5 | **Partial:** commands, job dependencies, security thresholds, schedule-only security behavior, and no-publish design are present; merge enforcement and manual dispatch are missing, and concurrency semantics differ. |
| Section 4 Renovate | Tasks 4-5 | **Gap:** hosted app and weekly schedule are covered, but the global package rules do not reproduce npm-only grouping and the five-PR limit changes scope. |
| Section 5 Cloudflare reconnect | Tasks 6-7 | **Covered:** source, branch, build command, unchanged Wrangler assets config, real push, live HTTP result, and source SHA are all checked. |
| Section 6 Docs sweep | Tasks 7-8 | **Partial:** named live docs, ADR, MCP removal, and historical exclusions are covered; archive state is asserted early and final checkpoint edits are not persisted. |
| Section 7 Tooling cutover | Task 3, Task 7 | **Covered:** remote round trip, `glab`, and imported open issues are addressed. |
| Section 8 Order and rollback | Tasks 1-8 | **Partial:** primary cutover order and pre-archive rollback are present; Task 6 deliberately depends on Task 7, and checkpoint/archive order is internally inconsistent. |

## Verified Sound

- Current GitLab importer documentation explicitly includes pull-request reviews, review comments,
  replies, suggestions, labels, and merged-by data. The plan's PR #87 spot-check is appropriate.
- `merge_method=merge`, `squash_option=never`, URL-encoded project paths, `glab ci lint`,
  `glab mr create`, `glab mr merge --remove-source-branch`, and
  `gh repo archive --yes` are valid with the installed CLIs. `--paginate=false` is accepted by the
  installed `glab` boolean parser.
- The YAML merge anchor for security rules and the script sequence anchor are valid GitLab CI forms.
  The workflow rules avoid duplicate branch/MR pipelines and scheduled pipelines select only the two
  security jobs.
- The NVD conditional expansion produces either two correctly quoted arguments or no arguments under
  POSIX `sh`. Repeated `--format` flags, `--failOnCVSS 7`, `--enableRetired`, and `--exclude` are valid
  Dependency-Check CLI options.
- `npm ci --ignore-scripts` is retained for test, build, and npm-audit; lint, content validation,
  Vitest, and build ordering match the current workflows and `package.json`.
- `wrangler.jsonc` and `scripts/nest-for-cloudflare.mjs` are provider-neutral. Workers Builds defaults
  its deploy command to `npx wrangler deploy`, which consumes the unchanged `assets.directory:
  ./dist`; no repository deployment job is needed.
