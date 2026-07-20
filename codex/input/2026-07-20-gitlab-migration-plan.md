# Codex Review Request — GitLab Migration Implementation Plan

You are Codex, acting as an independent adversarial reviewer for the Gaslight & Grimoire
project. You have **no conversation memory** — everything you need is in this prompt and the
files it names. Work read-only. When done, **write your review to
`codex/output/2026-07-20-gitlab-migration-plan-review.md`**.

## Goal

The repo is migrating its hosting from `github.com/JonWhiteFang/gaslight-and-grimoire` to a
public gitlab.com project — full cutover: git history + issues/PRs via GitLab's GitHub importer,
CI ported to `.gitlab-ci.yml`, Dependabot replaced by Renovate, the Cloudflare Workers-Builds
deploy re-pointed from GitHub to GitLab, docs updated, and the GitHub repo archived (kept
read-only as the canonical reference for historical "PR #N"/"issue #N" numbers).

## What to review

**Primary target:** `docs/superpowers/plans/2026-07-20-gitlab-migration.md` (the implementation
plan — 8 tasks with exact commands, full `.gitlab-ci.yml` and `renovate.json` contents inline).

**Review it against its spec:** `docs/superpowers/specs/2026-07-20-gitlab-migration-design.md`
(the approved design). Check fidelity (does every spec requirement have a plan task?) and check
the plan's own correctness independently.

## Ground your claims against these repo files

- `.github/workflows/deploy.yml` — the GitHub merge gate being ported (name "CI"; test job:
  lint → validateCase.mjs → test:run; build job needs test; `npm ci --ignore-scripts`;
  node from `.nvmrc` = `20.19`; concurrency cancel-in-progress: false)
- `.github/workflows/security.yml` — npm audit (--audit-level=high) + OWASP Dependency-Check
  (failOnCVSS 7, --enableRetired, node_modules cache exclude, SARIF) on PRs + weekly Mon 08:00 UTC
- `.github/dependabot.yml` — weekly Monday, minor+patch group, major group, 5-PR limit,
  npm + github-actions ecosystems
- `wrangler.jsonc`, `scripts/nest-for-cloudflare.mjs` — the Cloudflare deploy the plan claims
  needs no changes
- `CLAUDE.md` — project constraints, especially: **never squash-merge** (memory-spine
  traceability), the CI/CD section describing what the gate must keep doing, the Codex
  file-based handoff protocol you are currently executing
- `docs/PROJECT_STATE.md` (top block), `README.md` (lines ~40-45), `.mcp.json` (the `github`
  MCP entry) — targets of the plan's Task 7 docs sweep
- `docs/DECISIONS/ADR-TEMPLATE.md` and `docs/DECISIONS/ADR-0007-cloudflare-worker-deploy.md` —
  the ADR the plan's ADR-0014 succeeds
- `package.json` — the npm scripts the CI jobs invoke

## Project constraints that bind the plan

- Merge commits only, never squash (the run-log/memory spine depends on per-commit history).
- The merge gate must remain: lint + content validator + full Vitest run gating the build check;
  a failing check must block merge.
- Deploy is Cloudflare-side (assets-only Worker, builds `main` on push); repo CI never publishes.
- Dependency lifecycle scripts must not run under CI tokens (`--ignore-scripts`, F-038).
- Historical docs (RUN_LOG, old ADRs, audits) must not be rewritten.
- Security scanning: npm audit high+ and Dependency-Check CVSS ≥ 7 must both survive the port.

## Your charge (adversarial)

Assume the plan contains **at least one real defect** — a correctness hole, an unimplementable
or wrong command/flag/API call, a self-contradictory step, an ordering hazard (something
verified before it exists, or destroyed before its replacement is proven), a silent behavioural
divergence from the GitHub setup it claims to faithfully port, or a dangerous ambiguity an
executor could reasonably get wrong — and find it.

Areas worth particular suspicion:

1. **The `.gitlab-ci.yml` embedded in Task 4** — YAML anchor correctness (`<<: *security-rules`
   merging vs the `rules` key, `*install` inside `script`), the `workflow:rules` ×  per-job
   `rules` interaction (do MR pipelines + branch pipelines double-run? do scheduled pipelines
   correctly run ONLY the security jobs?), cache config, whether `interruptible: false` really
   is the right mapping for `cancel-in-progress: false`, and whether the
   `${NVD_API_KEY:+...}` shell expansion survives GitLab's script processing.
2. **glab/GitLab API commands** — do the flags exist as written (`glab api`, `glab ci lint`,
   `glab mr create`, `glab mr merge`, `gh repo archive --yes`)? Is `squash_option=never` a real
   API value? Does `--paginate=false` exist? Is the URL-encoded project path form correct?
3. **Importer assumptions** — does GitLab's GitHub importer actually bring PR review comments,
   labels, and preserve merged-MR state as claimed? Anything that plainly won't survive that
   the plan/spec promises?
4. **Ordering hazards** — e.g. the plan closes Dependabot PRs and deletes their branches before
   import (so those PRs import as closed-with-deleted-source — fine?); Cloudflare re-point
   happens before the docs-sweep merge that is supposed to trigger/verify the deploy; the
   MR-based CI test happens after `.github/` is already deleted on the branch.
5. **Renovate config** — does `config:recommended` + the two packageRules actually reproduce
   dependabot.yml's behaviour (weekly cadence, grouping, 5-PR limit)? Is the `gitlabci` manager
   claim (keeping the pinned `owasp/dependency-check:12.1.0` image current) accurate?
6. **Spec-fidelity gaps** — any spec requirement with no plan task, or a plan step that
   contradicts the spec (e.g. spec says security runs "on MRs + weekly schedule"; does the CI
   file deliver exactly that?).

## Output format

Write `codex/output/2026-07-20-gitlab-migration-plan-review.md` with:

1. **Verdict line** — Blocker / Major / Minor counts.
2. **Findings**, each with: severity, the plan section/step, the defect, the evidence
   (file:line or documented GitLab/Renovate behaviour), and a concrete fix.
3. **Fidelity table** — spec section → plan task mapping, flagging gaps.
4. Anything you verified and found sound (briefly — so silence isn't ambiguous).

Run nothing that mutates state; reading and static analysis only. You may run `glab --help`
style introspection if available in your sandbox, but do not rely on network access.
