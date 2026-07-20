# GitHub → GitLab Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the repo from `github.com/JonWhiteFang/gaslight-and-grimoire` to a public gitlab.com project with full commit + issue/PR history, ported CI (merge gate + security), Renovate replacing Dependabot, Cloudflare deploy re-pointed, and the GitHub repo archived.

**Architecture:** GitLab's GitHub importer does the history move in one operation (commits, branches, issues, PRs-as-MRs, comments, labels). CI is a faithful `.gitlab-ci.yml` port of `deploy.yml` + `security.yml`; `renovate.json` replaces `dependabot.yml`. Cloudflare and the importer are owner-manual steps; everything else is scripted. GitHub stays intact until the final archive step, so rollback is trivial throughout.

**Tech Stack:** git, `gh` CLI (GitHub side), `glab` CLI (GitLab side), GitLab CI, Renovate, OWASP Dependency-Check (docker image), Cloudflare Workers Builds.

**Spec:** `docs/superpowers/specs/2026-07-20-gitlab-migration-design.md`

**Steps marked 🧑 USER ACTION are owner-manual (web UI / credentials); the executor prepares them, tells the user exactly what to do, and waits for confirmation.**

---

### Task 1: Quiesce GitHub

Nothing may be mid-flight during import. The 2 open PRs are both Dependabot PRs — **close, don't merge** (Renovate re-raises the same bumps on GitLab). The 2 open issues (#52, #20) stay open; the importer carries them.

**Files:** none (remote-state only)

- [ ] **Step 1: Push local main so GitHub has the full history (including the spec + this plan)**

```bash
git push origin main
```
Expected: `main -> main` updated (or "Everything up-to-date").

- [ ] **Step 2: Close the two Dependabot PRs with an explanatory comment**

```bash
gh pr close 77 --comment "Closing unmerged: repo is migrating to GitLab; Renovate will re-raise this bump there."
gh pr close 78 --comment "Closing unmerged: repo is migrating to GitLab; Renovate will re-raise this bump there."
```
Expected: both report `Closed pull request`.

- [ ] **Step 3: Delete stale remote branches**

```bash
git push origin --delete dependabot/npm_and_yarn/major-05e7a1191d dependabot/npm_and_yarn/minor-and-patch-2b9b0a2afe feat/phase3-dice-legibility
```
Expected: three `- [deleted]` lines. (Local `temp/create-orrery` is local-only; leave it.)

- [ ] **Step 4: Record the pre-migration fingerprint (used to verify the import in Task 2)**

```bash
git rev-parse main && git rev-list --count main
gh issue list --state all --limit 500 --json number | jq length
gh pr list --state all --limit 500 --json number | jq length
```
Expected: a SHA, a commit count, an issue count (~32), a PR count. Save all four numbers into the task notes — Task 2 compares against them.

- [ ] **Step 5: Verify GitHub is quiet**

```bash
gh pr list --state open --json number | jq length
```
Expected: `0`.

---

### Task 2: Import into GitLab and verify

**Files:** none (GitLab-side)

- [ ] **Step 1: 🧑 USER ACTION — run the GitHub importer**

Tell the user:
1. Create a GitHub personal access token (classic) with `repo` scope at https://github.com/settings/tokens — it can be revoked right after import.
2. On gitlab.com: **New project → Import project → GitHub**, paste the token, select `JonWhiteFang/gaslight-and-grimoire`, import into your personal namespace, keep the name `gaslight-and-grimoire`.
3. Wait for the importer to report complete (issues + PRs take a few minutes), then confirm here and revoke the token.

Wait for user confirmation before continuing.

- [ ] **Step 2: Verify the git history matches the Task-1 fingerprint**

```bash
git ls-remote https://gitlab.com/<username>/gaslight-and-grimoire.git refs/heads/main
git remote add gitlab https://gitlab.com/<username>/gaslight-and-grimoire.git 2>/dev/null; git fetch gitlab main
git rev-list --count gitlab/main
git remote remove gitlab
```
Expected: the `main` SHA AND the commit count both exactly match the Task 1 Step 4 fingerprint
(Codex Minor 1: the count must actually be compared, not just recorded — SHA equality already
implies it, but the spec demands both checks explicitly). The temporary `gitlab` remote is
removed because Task 3 re-points `origin` properly. (Substitute the real username — ask the
user for it at Task 2 Step 1 if not yet known — and reuse it everywhere `<username>` appears
below.)

- [ ] **Step 3: Verify issues and MRs arrived**

```bash
glab api "projects/<username>%2Fgaslight-and-grimoire/issues?state=all&per_page=1" -X GET --paginate=false -i 2>/dev/null | grep -i x-total
glab api "projects/<username>%2Fgaslight-and-grimoire/merge_requests?state=all&per_page=1" -i 2>/dev/null | grep -i x-total
```
(If `glab` is not yet installed, defer this to Task 3 Step 2 and run it right after auth.) Expected: `x-total` matching the Task-1 issue and PR counts. Also spot-check in the UI that the MR titled "The Orrery Room" (GitHub PR #87) exists as **merged** with its review comments.

- [ ] **Step 4: Verify the two open issues survived**

Expected: GitLab issue list shows 2 open issues with titles matching GitHub #52 (agent interview) and #20 (media assets milestone).

---

### Task 3: GitLab project settings + local tooling cutover

**Files:** none (GitLab settings + local git config)

- [ ] **Step 1: Install and authenticate glab**

```bash
brew install glab
glab auth login
```
🧑 USER ACTION: complete the browser/token auth flow. Verify with `glab auth status` → expected: logged in to gitlab.com.

- [ ] **Step 2: Set merge method, disable squash, and make a green pipeline a merge REQUIREMENT**

GitLab's default is `only_allow_merge_if_pipeline_succeeds=false`, and the importer does NOT
carry GitHub's required-status-check branch protection — without this, a red MR is mergeable
and the gate is decorative (Codex Blocker 1). `-F` sends booleans as booleans.

```bash
glab api "projects/<username>%2Fgaslight-and-grimoire" -X PUT -f merge_method=merge -f squash_option=never -F only_allow_merge_if_pipeline_succeeds=true -F allow_merge_on_skipped_pipeline=false
```
Expected: JSON response containing `"merge_method":"merge"`, `"squash_option":"never"`,
`"only_allow_merge_if_pipeline_succeeds":true`, and `"allow_merge_on_skipped_pipeline":false`.
Verify visibility while at it: response contains `"visibility":"public"` — if the importer
created it private, add `-f visibility=public` and re-run.

- [ ] **Step 3: Point the local clone at GitLab**

```bash
git remote set-url origin https://gitlab.com/<username>/gaslight-and-grimoire.git
git fetch origin && git status
```
Expected: fetch succeeds; `main...origin/main` shows up to date (same SHA as Task 1).

- [ ] **Step 4: Round-trip push check**

```bash
git push origin main
```
Expected: "Everything up-to-date". Local cutover done — `gh` is now only used for the final archive step (it still targets the GitHub repo by name).

- [ ] **Step 5: 🧑 USER ACTION — NVD API key (needed BEFORE the Task-4 cutover MR)**

The Task-4 pipeline's `dependency-check` job downloads the NVD database on its first (cold)
run; without a key, requests are throttled 8s-per-request and the job may time out — and since
Task 3 Step 2 just made pipeline success a merge requirement, a flaky first security run would
block the cutover MR (Codex Major 2). Tell the user: request a free key at
https://nvd.nist.gov/developers/request-an-api-key, then add it as a **masked** CI/CD variable
named `NVD_API_KEY` (GitLab: Settings → CI/CD → Variables). Wait for confirmation.

---

### Task 4: CI port — `.gitlab-ci.yml`, delete `.github/`, add `renovate.json`

One branch, one MR — this MR is itself the end-to-end test of the new merge gate.

**Files:**
- Create: `.gitlab-ci.yml`
- Create: `renovate.json`
- Delete: `.github/workflows/deploy.yml`, `.github/workflows/security.yml`, `.github/dependabot.yml`

- [ ] **Step 1: Create the cutover branch**

```bash
git checkout -b chore/gitlab-cutover
```

- [ ] **Step 2: Write `.gitlab-ci.yml`**

```yaml
# GitLab CI — ports .github/workflows/deploy.yml (merge gate) and
# security.yml (npm audit + OWASP Dependency-Check). Deployment stays a
# Cloudflare assets-only Worker building from `main` push (see wrangler.jsonc);
# nothing here publishes anywhere.

stages:
  - test
  - build
  - security

# Keep the image tag in sync with .nvmrc (GitLab cannot read .nvmrc for
# image selection the way actions/setup-node can).
#
# interruptible:false preserves deploy.yml's `cancel-in-progress: false`
# guarantee (a running pipeline is never cancelled by a newer push). Known,
# accepted divergence: GitHub's concurrency.group also SERIALIZED same-ref
# runs; GitLab has no workflow-level equivalent (resource_group is per-job
# and would only serialize jobs, adding latency for no gate benefit here).
# Rapid pushes may run pipelines concurrently — harmless: jobs are read-only
# checks and nothing here publishes.
default:
  image: node:20.19
  interruptible: false

# `web` = manually dispatched from the GitLab UI (Pipelines → Run pipeline) —
# preserves both workflows' workflow_dispatch. A web run on main executes all
# four jobs (gate + security).
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main" && $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"

.npm-cache: &npm-cache
  key:
    files:
      - package-lock.json
  paths:
    - .npm/

# --ignore-scripts: don't run dependency lifecycle scripts under the CI
# token (F-038). Only esbuild ships an install script and it's a no-op.
.install: &install
  - npm ci --cache .npm --prefer-offline --ignore-scripts

# Correctness gate: lint + content validation + full test suite. `build`
# depends on this, so a failing check blocks the merge gate.
test:
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
      when: never
    - when: on_success
  cache: *npm-cache
  script:
    - *install
    - npm run lint
    - node scripts/validateCase.mjs
    - npm run test:run

# Build-compiles check (tsc src/ + tsc -p tsconfig.scripts.json + vite build).
# The real deploy build runs Cloudflare-side; this proves `main` builds green.
build:
  stage: build
  needs: [test]
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
      when: never
    - when: on_success
  cache: *npm-cache
  script:
    - *install
    - npm run build

# Security jobs run on MRs, on the weekly schedule (Mon 08:00 UTC — created
# as a GitLab pipeline schedule, Task 5), and on manual (web) dispatch — not
# on plain main pushes.
.security-rules: &security-rules
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"

npm-audit:
  stage: security
  needs: []
  <<: *security-rules
  cache: *npm-cache
  script:
    - *install
    - npm audit --audit-level=high

# OWASP Dependency-Check, fail on CVSS >= 7 (same threshold as security.yml).
# Pinned image version — Renovate keeps it current (replaces the pinned-SHA
# github-action). NVD_API_KEY is a required CI/CD variable (set in Task 3 —
# without it every NVD request is throttled to 8s vs 3.5s). The NVD database
# is cached under the project dir via --data + a GitLab cache so only the
# first run pays the cold download; MRs and weekly runs after that are warm.
dependency-check:
  stage: security
  needs: []
  <<: *security-rules
  image:
    name: owasp/dependency-check:12.1.0
    entrypoint: [""]
  cache:
    key: dependency-check-data-v1
    paths:
      - .dependency-check-data/
  script:
    - >
      /usr/share/dependency-check/bin/dependency-check.sh
      --project gaslight-and-grimoire
      --scan .
      --data "$CI_PROJECT_DIR/.dependency-check-data"
      --format SARIF --format HTML
      --out reports
      --failOnCVSS 7
      --enableRetired
      --exclude "**/node_modules/.cache/**"
      --exclude "**/.dependency-check-data/**"
      ${NVD_API_KEY:+--nvdApiKey "$NVD_API_KEY"}
  artifacts:
    when: always
    paths:
      - reports/
    expire_in: 30 days
```

- [ ] **Step 3: Write `renovate.json`**

Replicates `dependabot.yml`: weekly Monday cadence, npm minor+patch grouped, npm majors grouped. The grouping rules are **scoped to the npm manager** (Codex Major 1: unscoped rules would fold GitLab CI image bumps — the Node runtime and the security scanner — into app-dependency PRs); the `gitlabci` manager (on by default) gets its own group, the equivalent of the old `github-actions` ecosystem entry. Two acknowledged parity deltas from Dependabot: `prConcurrentLimit` is repo-wide (Dependabot allowed 5 npm + 5 actions PRs independently) — 5 total is ample at this repo's PR volume; and the `node:20.19` CI image joins the gitlab-ci group, so a Node bump PR is the reminder to bump `.nvmrc` in the same MR (they must move together).

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "timezone": "Etc/UTC",
  "schedule": ["before 9am on monday"],
  "prConcurrentLimit": 5,
  "labels": ["dependencies"],
  "packageRules": [
    {
      "matchManagers": ["npm"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "minor-and-patch"
    },
    {
      "matchManagers": ["npm"],
      "matchUpdateTypes": ["major"],
      "groupName": "major"
    },
    {
      "matchManagers": ["gitlabci"],
      "groupName": "gitlab-ci"
    }
  ]
}
```

Validate before committing:

```bash
npx --yes --package renovate renovate-config-validator renovate.json
```
Expected: `Config validated successfully`.

- [ ] **Step 4: Delete the GitHub automation directory**

```bash
git rm -r .github
```
Expected: removes `workflows/deploy.yml`, `workflows/security.yml`, `dependabot.yml` (confirm `git status` shows exactly those three deletions plus the two new files).

- [ ] **Step 5: Validate the CI syntax before pushing**

```bash
glab ci lint
```
Expected: `✓ CI/CD YAML is valid!` (Fix any yaml error before proceeding.)

- [ ] **Step 6: Commit and push**

```bash
git add .gitlab-ci.yml renovate.json
git commit -m "ci: port merge gate + security scan to GitLab CI, Dependabot -> Renovate

.gitlab-ci.yml reproduces deploy.yml (test -> build gate, interruptible:false)
and security.yml (npm audit + OWASP Dependency-Check, failOnCVSS 7, weekly
schedule + MRs). renovate.json replicates dependabot.yml grouping. .github/
removed in the same commit so exactly one CI system exists at all times."
git push -u origin chore/gitlab-cutover
```

- [ ] **Step 7: Open the MR and watch the pipeline — this is the gate's end-to-end test**

```bash
glab mr create --title "ci: GitLab CI cutover (merge gate + security + Renovate)" --description "Ports deploy.yml + security.yml to .gitlab-ci.yml, replaces Dependabot with Renovate. Part of the GitLab migration (spec: docs/superpowers/specs/2026-07-20-gitlab-migration-design.md)." --source-branch chore/gitlab-cutover --target-branch main
glab ci status --live
```
Expected: pipeline runs `test` → `build` + both security jobs; **all green**. A genuine CVSS ≥ 7 finding must be triaged, not waved through. **Also verify the gate actually gates** (Codex Blocker 1): while the pipeline is still running (or if any job is red), `glab mr merge` must be REFUSED — confirm the refusal before the pipeline finishes, or check the MR widget shows "Merge blocked: pipeline must succeed". Only a demonstrated refusal + subsequent green merge counts as the end-to-end test.

- [ ] **Step 8: Merge with a merge commit (never squash)**

```bash
glab mr merge --remove-source-branch
```
Expected: merged; the resulting push to `main` triggers a `main` pipeline — confirm it goes green too (`glab ci status`).

---

### Task 5: Schedules, CI variables, Renovate

**Files:** none (GitLab-side configuration)

- [ ] **Step 1: Create the weekly security pipeline schedule (Mon 08:00 UTC)**

```bash
glab api "projects/<username>%2Fgaslight-and-grimoire/pipeline_schedules" -X POST -f description="Weekly security scan (npm audit + OWASP Dependency-Check)" -f ref="main" -f cron="0 8 * * 1" -f cron_timezone="UTC" -f active=true
```
Expected: JSON response with `"active":true` and the cron string.

- [ ] **Step 2: Verify the Dependency-Check cache is warm**

The Task-4 MR pipeline paid the cold NVD download. Trigger one scheduled-style run to prove the
warm path (this also validates the schedule created in Step 1 — run it manually):

```bash
glab api "projects/<username>%2Fgaslight-and-grimoire/pipeline_schedules" | jq '.[0].id'
glab api "projects/<username>%2Fgaslight-and-grimoire/pipeline_schedules/<schedule-id>/play" -X POST
```
Expected: the played pipeline runs ONLY `npm-audit` + `dependency-check`; the dependency-check
log shows the cached `.dependency-check-data` being used (update, not full download) and the
job completes in minutes, not tens of minutes. (Codex Major 2: exercise both a warm scheduled
run and an MR run before calling the security port complete — the MR run was Task 4 Step 7.)

- [ ] **Step 3: 🧑 USER ACTION — enable hosted Renovate**

Tell the user: install the Mend Renovate app for GitLab from https://gitlab.com/explore → or directly at https://developer.mend.io (sign in with GitLab, grant it access to the `gaslight-and-grimoire` project only). Renovate finds `renovate.json` automatically and opens an onboarding MR. Fallback if the hosted app is undesirable: a scheduled CI job running the `renovate/renovate` image — say so and Magikarp will add it.

- [ ] **Step 4: Verify Renovate onboarding**

Expected within ~1 hour: an MR from `renovate/configure` (or immediate bump MRs if onboarding is skipped due to the existing config file). Merge the onboarding MR if one appears (merge commit, as always). The two closed Dependabot bumps should reappear as grouped Renovate MRs on the next Monday run — no action needed now.

---

### Task 6: Cloudflare re-point + deploy verification

**Files:** none (Cloudflare-side; `wrangler.jsonc` unchanged by design)

- [ ] **Step 1: 🧑 USER ACTION — reconnect Workers Builds to GitLab**

Tell the user, in the Cloudflare dashboard (Workers & Pages → the gaslight-and-grimoire Worker → Settings → Builds):
1. Disconnect the GitHub repository connection.
2. Connect Git repository → GitLab → authorise → select `<username>/gaslight-and-grimoire`, branch `main`.
3. Build command `npm run build`, deploy config comes from `wrangler.jsonc` (unchanged — `assets.directory: ./dist`, the nest script keeps handling the path prefix).
Confirm here when saved.

- [ ] **Step 2: Trigger a real deploy**

The Task-7 docs-sweep MR merge will push to `main` and serve as the deploy trigger — no throwaway commit needed. If the user wants to verify Cloudflare *before* the docs sweep, use Cloudflare's "Retry build"/manual build button on the dashboard instead.

- [ ] **Step 3: Verify the live site after the Task-7 merge**

```bash
curl -s -o /dev/null -w "%{http_code}" https://holodeck.jonwhitefang.uk/gaslight-and-grimoire/
```
Expected: `200`, and the Cloudflare build log shows the build sourced from GitLab at the new merge commit's SHA.

---

### Task 7: Docs sweep + ADR-0014

Historical records (`docs/RUN_LOG.md`, existing ADRs, `docs/audits/`, past PROJECT_STATE "prior update" paragraphs) are **left untouched** — they describe the past accurately. Only forward-looking text changes.

**Files:**
- Create: `docs/DECISIONS/ADR-0014-gitlab-migration.md`
- Modify: `CLAUDE.md` (CI/CD section + merge-strategy bullet + Known workflow filenames)
- Modify: `README.md:42-44` (workflow references)
- Modify: `docs/PROJECT_STATE.md` (top "last updated" block only)
- Modify: `docs/DECISIONS/README.md` (ADR index, if it lists ADRs)
- Modify: `.mcp.json` (remove the now-pointless GitHub MCP server entry)

- [ ] **Step 1: Create the sweep branch**

```bash
git checkout main && git pull && git checkout -b docs/gitlab-migration-sweep
```

- [ ] **Step 2: Write ADR-0014**

Follow `docs/DECISIONS/ADR-TEMPLATE.md`'s structure. Content requirements (draft from these, matching the template's headings):
- **Status:** Accepted. **Context:** hosting moved off GitHub; ADR-0007's Cloudflare Worker deploy is unchanged but its git-connection source changed.
- **Decision:** full cutover to public gitlab.com project (personal namespace); GitLab GitHub-importer for history/issues/PRs; faithful CI port (`.gitlab-ci.yml`: test→build gate, npm audit + Dependency-Check on MRs + weekly schedule); Renovate replaces Dependabot; merge-commit-only enforced by `squash_option=never`; GitHub repo **archived, never deleted** — it is the canonical reference for historical "PR #N"/"issue #N" numbers, which do NOT match GitLab's imported numbering.
- **Consequences:** `gh` → `glab`; old doc links keep resolving via the archive; Cloudflare builds from GitLab; security SARIF is an artifact (no free-tier security tab); NVD key + pipeline schedule live GitLab-side (not in-repo).

- [ ] **Step 3: Update CLAUDE.md**

In the CI/CD section: replace the `deploy.yml`/`security.yml`/`dependabot.yml` descriptions with their `.gitlab-ci.yml`/schedule/`renovate.json` equivalents (keep the F-032/F-038/F-039/F-123 rationale notes — they still explain *why*). In the merge-strategy bullet: `gh pr merge --merge` → `glab mr merge`, and note squash is disabled project-side (`squash_option=never`). Update the "Deployed as..." sentence only if it names GitHub. Point the repo URL anywhere it appears.

- [ ] **Step 4: Update README.md, PROJECT_STATE.md, DECISIONS/README.md, .mcp.json**

- `README.md` lines 42–44: the two workflow bullets → one `.gitlab-ci.yml` bullet (merge gate) + one security bullet (MRs + weekly schedule). The Zustand upstream link at line 14 stays — it points at Zustand's repo, not ours.
- `docs/PROJECT_STATE.md`: prepend a new "last updated 2026-07-20" block: migrated to GitLab (URL), CI/Renovate/Cloudflare re-established, **GitHub archive pending final checks** — do NOT claim the archive has happened; it is Task 8, after this MR merges (Codex Major 3).
- `docs/DECISIONS/README.md`: add ADR-0014 to the index.
- `.mcp.json`: remove the `github` server entry (`api.githubcopilot.com` — useless once archived).

- [ ] **Step 5: Sweep for stragglers**

```bash
grep -rn -il "github" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=package-lock.json
```
Expected remaining hits are historical-only (RUN_LOG, old ADRs, audits, old specs/plans, codex trail) — each remaining file must be justifiable as "describes the past". Fix any live doc that slipped through.

- [ ] **Step 6: Commit, MR, merge**

```bash
git add -A
git commit -m "docs: GitLab migration sweep — ADR-0014, CLAUDE.md CI/merge sections, README, PROJECT_STATE, drop GitHub MCP entry"
git push -u origin docs/gitlab-migration-sweep
glab mr create --fill --source-branch docs/gitlab-migration-sweep --target-branch main
glab ci status --live
glab mr merge --remove-source-branch
```
Expected: pipeline green, merged. **This merge is the Cloudflare deploy trigger — now run Task 6 Step 3.**

---

### Task 8: Archive GitHub + checkpoint

**Files:** none

- [ ] **Step 1: Final pre-archive check**

Confirm all of: GitLab pipeline green on `main`; live site serving the post-migration build (Task 6 Step 3 returned 200 with a GitLab-sourced build); Renovate active; both open issues visible on GitLab. Do not archive until all four hold.

- [ ] **Step 2: 🧑 USER ACTION confirmation, then archive**

Archiving is the one outward-facing state change on the GitHub side — confirm with the user, then:

```bash
gh repo archive JonWhiteFang/gaslight-and-grimoire --yes
```
Expected: `Archived repository JonWhiteFang/gaslight-and-grimoire`. (Reversible via unarchive if ever needed.)

- [ ] **Step 3: Record the archive — checkpoint, ADR to Enacted, commit, push**

The archive is now fact, so the memory spine can say so (Codex Major 3: Task 7 deliberately
left it "pending"). Invoke `/checkpoint` to update `docs/PROJECT_STATE.md` (archive done) and
prepend the `docs/RUN_LOG.md` entry recording the migration (spec, plan, MRs, archive). In the
same pass, flip `docs/DECISIONS/ADR-0014-gitlab-migration.md` status `Accepted` → `Enacted`
(the decision is now realised in the repo, per `docs/DECISIONS/README.md`). Then persist —
these edits must not be left uncommitted:

```bash
git add docs/PROJECT_STATE.md docs/RUN_LOG.md docs/DECISIONS/ADR-0014-gitlab-migration.md
git commit -m "docs: checkpoint — GitHub archived, GitLab migration complete (ADR-0014 Enacted)"
git push origin main
```
Expected: pushed to GitLab `main`; pipeline green. (A docs-only direct push to main is this
repo's normal checkpoint pattern — no MR needed.)

---

## Verification summary (the migration is done when)

| Check | Command / evidence |
|---|---|
| History identical | `git ls-remote` main SHA on GitLab == pre-migration GitHub SHA |
| Issues/PRs imported | x-total counts match; PR #87's MR merged-with-comments spot-check |
| Merge gate live | Task 4 MR: merge REFUSED while pipeline pending/red (only_allow_merge_if_pipeline_succeeds), then merged via merge commit once green |
| Security port live | npm-audit + dependency-check green on an MR (cold) AND a played schedule run (warm cache); schedule exists |
| Renovate live | onboarding/bump MR appeared |
| Deploy live | site 200s from a GitLab-sourced Cloudflare build |
| Docs true | grep sweep leaves only historical GitHub references |
| GitHub archived | repo shows read-only banner; old PR/issue links still resolve |
