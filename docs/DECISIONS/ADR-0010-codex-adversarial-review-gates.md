---
status: "Superseded by ADR-0013"
date: "2026-07-11"
deciders: "Jon White (directed the integration + approved the hardened variant), Claude (setup), Codex (adversarially reviewed its own gate text)"
phase: "Tooling / process"
superseded-by: "ADR-0013"
---

> **Superseded by [ADR-0013](ADR-0013-codex-file-based-review-handoff.md) (2026-07-14).** The MCP
> two-gate model below is no longer operative: Codex review is now a **file-based** handoff at three
> checkpoints (spec, plan, completed implementation), and the `codex` MCP tool is not used for reviews.
> This record is preserved for the decision trail; do not follow its procedure.

# ADR-0010: Codex as cross-provider adversarial reviewer — two mandatory gates

## Context

The project's quality gates (CI, validator, tests, the content-integrity reviewer subagent) are all
same-provider: Claude reviewing Claude. Past audits show what that misses — audit-1 missed a P0 the
second audit caught, and PR #51 shipped a React-19 `inert` regression green. The user directed
integrating OpenAI Codex CLI (already installed, ChatGPT-auth, registered as a user-scope MCP server)
as an independent, adversarial cross-provider reviewer, using a hardened setup prompt distilled from
a prior real-world run.

## Decision

Every non-trivial task in this repo passes two mandatory Codex review gates, codified in CLAUDE.md
(§"Adversarial review with Codex"): **Gate 1** — every non-trivial task gets a plan, reviewed
adversarially before any mutation (attached to the work, not to whether a plan was declared);
**Gate 2** — before completion, the complete task diff against the recorded starting base (untracked
files intent-to-add staged; incremental commits cannot shrink the diff), reviewed adversarially, with
Gate-1 divergence flagged; Gate 2 runs before `/checkpoint`, whose mechanical spine updates are
exempt. Codex always runs read-only (`sandbox_mode = "read-only"`, `approval_policy = "untrusted"`
in `~/.codex/config.toml`); at most two rounds per gate, completion blocked on accepted-but-unfixed
findings, disputes escalated to the user; an unavailable reviewer is announced prominently, never
silently skipped.

## Alternatives considered

- **A — No cross-provider reviewer (status quo):** CI + same-provider review; rejected — the known
  blind spots above are exactly what an independent model catches.
- **B — Code-gate only (the guide's older single-gate form):** cheaper, but plan-stage flaws (wrong
  faction key, ordering hazards) are cheapest to catch before code exists; rejected.
- **C — Verbatim two-gate text from the setup prompt:** adopted initially, then Codex's own Gate-2
  review of it found real loopholes (uncommitted-only diffs, undeclared-plan dodge, accepted-but-
  unfixed findings, checkpoint ordering, vague context). The user chose the **hardened variant**;
  the verbatim text was superseded in the same session.

## Consequences

- **Positive:** independent-model scrutiny at the two cheapest interception points; the gate text
  itself survived two adversarial rounds by its own reviewer; smoke tests showed real repo-specific
  catches (exact faction-key strings, validate-before-manifest ordering).
- **Negative / trade-offs:** per-task latency and token cost on the user's ChatGPT plan; the reviewer
  is machine-local (user-scope MCP + `~/.codex/config.toml`), so other machines need the replication
  step recorded in the RUN_LOG entry; review quality depends on honest context assembly by the
  submitting agent.
- **Follow-ups:** watch whether the two-round cap suffices in practice; consider a project-scope
  `.mcp.json` entry if the repo is ever worked from a machine without the user-scope registration.

## Confirmation

The gates' text lives in CLAUDE.md §"Adversarial review with Codex" — its presence and two-gate
shape is the standing check (the `/checkpoint` sweep treats its removal/weakening as drift).
Machine-side: `codex doctor` must report `approval UnlessTrusted` + `filesystem sandbox: restricted`,
and `claude mcp list` must show `codex ✔ Connected`.

## Links

- Related ADRs: ADR-0004 (the same-provider content-integrity review layer this complements),
  ADR-0009 (process rules whose authority is CLAUDE.md are the allowed kind of CLAUDE.md content)
- Planning docs: the user-supplied hardened setup prompt (session of 2026-07-11)
- Commits / PRs: the 2026-07-11 integration PR
