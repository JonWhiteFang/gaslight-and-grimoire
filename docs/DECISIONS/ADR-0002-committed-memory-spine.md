# ADR-0002: Adopt a committed, version-controlled project-memory spine

- **Status:** Enacted (was Accepted 2026-07-07; the loop was exercised through its first real end-of-session `/checkpoint` on 2026-07-07)
- **Date:** 2026-07-07
- **Deciders:** Project maintainer
- **Phase / stage:** Tooling / process

## Context

AI coding agents are stateless between sessions, and tool-provided memory is machine-local and
tool-specific: it does not travel with the repo, is not shared across machines or teammates, and is
invisible to a different agent or to a human reading the project. G&G already carries authoritative docs
(`CLAUDE.md`, the `docs/` set) that describe *what the system is*, but nothing captures *where the build
is right now*, *what happened when*, or *why non-trivial calls were made* in a form that survives a
cleared context. This is a process decision with lasting consequences for how every future session
starts and ends, so it warrants an ADR.

## Decision

Adopt the committed memory spine: `docs/PROJECT_STATE.md` (one-page live snapshot, overwritten each
session), `docs/RUN_LOG.md` (append-only session history, newest on top), and `docs/DECISIONS/` (ADRs —
write-once, superseded not edited). Automate the loop with a Claude Code `SessionStart` hook
(`.claude/hooks/session-preflight.sh`) that injects git state + the top of `PROJECT_STATE.md`, and a
`/checkpoint` skill (`.claude/skills/checkpoint/SKILL.md`) that runs a doc-drift sweep then writes
STATE / RUN_LOG / maybe-ADR at session end. The cardinal discipline: **the spine tracks progress and
decisions only and points at the authoritative docs — it never restates architecture or scope rules.**
The scope-gate tracker and scope ledger from the source guide are **dropped** for this project, because
G&G is feature-complete rather than a large staged build at risk of scope creep.

## Alternatives considered

- **A — Rely on the tool's built-in / machine-local memory:** zero setup, but not committed, not shared, not portable across agents, and invisible in review. Rejected — it fails the core goal.
- **B — Full spine including scope-gate tracker + scope ledger (as in the source guide):** maximal, but those two components exist to defend a large staged design against scope creep; G&G is feature-complete, so they would be empty ceremony. Dropped per the guide's own §4.2 "strip if not applicable".
- **C — Minimum viable version (STATE + RUN_LOG + protocol pointer only):** lighter, but the project already has real architectural decisions worth recording and benefits from the auto-inject hook. Chosen to go beyond MVP to the full three-file spine + automation, minus the scope components.

## Consequences

- **Positive:** any agent or human resumes from `PROJECT_STATE.md` cold; the session-start hook surfaces state automatically; decisions and history are versioned and reviewed in PRs; the `/checkpoint` doc-drift sweep keeps `CLAUDE.md` / `docs/` honest over time.
- **Negative / trade-offs:** a per-session discipline cost (run `/checkpoint` at end of session); a `SessionStart` hook now runs on every session (depends on `jq` + `git`, both present); three more docs to keep coherent — mitigated by the "one authority per fact, spine points not restates" rule.
- **Follow-ups:** ~~flip this ADR to **Enacted** once the loop has been exercised through at least one real end-of-session `/checkpoint`.~~ Done 2026-07-07 — first real `/checkpoint` ran; status is now Enacted. Revisit adding a scope ledger only if the project re-opens into a large staged build.

## Links

- Related ADRs: none (pairs with the process pointer added to `CLAUDE.md`).
- Planning docs: the "Committed Project-Memory Spine" implementation guide; [../PROJECT_STATE.md](../PROJECT_STATE.md), [../RUN_LOG.md](../RUN_LOG.md).
- Commits / PRs: this session (see [../RUN_LOG.md](../RUN_LOG.md) 2026-07-07 entry).
