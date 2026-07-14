---
status: "Enacted"
date: "2026-07-14"
deciders: "Jon White (directed the switch + supplied the new procedure text), Claude (applied it)"
phase: "Tooling / process"
supersedes: "ADR-0010"
---

# ADR-0013: Codex cross-provider review moves to a file-based three-checkpoint handoff

## Context

[ADR-0010](ADR-0010-codex-adversarial-review-gates.md) established Codex (OpenAI, a different model
provider) as this repo's independent adversarial reviewer, run **through the `codex` MCP tool** as two
mandatory gates on every non-trivial task (Gate 1 = plan before any mutation; Gate 2 = complete diff
before completion). Two things drove a revision. First, the `codex` MCP tool's auth to its Bedrock
backend proved **unreliable in-session** — `codex exec` repeatedly exhausted its budget exploring or
failed to complete, so the MCP transport could not be depended on when a gate was actually due (the
Comet Club and Phase 1 work had already fallen back to a hand-run file handoff). Second, the two-gate
plan+diff shape left the *spec* unreviewed by the cross-provider and had no distinct **final
whole-implementation** pass — reviews were mid-flight diffs, not one authoritative look at the
merge-ready result. The user removed the `codex` MCP server (user scope) and supplied a replacement
procedure. This ADR records that decision and supersedes ADR-0010.

## Decision

Cross-provider Codex review is now a **file-based handoff** at **three checkpoints** — the latest
**spec**, the latest **plan** (both under `docs/superpowers/*`), and the **completed, self-contained
implementation** (a merge-ready branch, reviewed against its committed diff + built code as the last
gate before it ships). The MCP `codex` tool is **not** used for reviews. For each pass Claude writes a
fully self-contained prompt to `codex/input/<yyyy-mm-dd>-<name>.md` (Codex has no conversation memory —
the prompt carries goal, review target, files to ground against, constraints, an adversarial charge,
and the exact output path), the user runs Codex read-only in their own terminal, and Codex writes the
review to `codex/output/<yyyy-mm-dd>-<name>-review.md`. Claude then addresses all valid findings before
presenting the work as ready, disagreements stated explicitly. The implementation pass is the final
independent look *after* the internal (in-session subagent) reviews pass and the gate is green — it does
**not** replace them, and arbitrary mid-flight diffs stay with the normal in-session flow. Both prompt
and review are committed as a durable trail. The full procedure, including the `-impl` naming
convention, lives in CLAUDE.md §"Cross-provider review with Codex (file-based handoff)" and
[`codex/README.md`](../../codex/README.md).

## Alternatives considered

- **A — File-based, three checkpoints (chosen):** decouples review from the flaky MCP auth (the user
  drives Codex directly), adds the spec pass and a final whole-implementation pass, and leaves a
  committed review trail. Chosen.
- **B — Keep the MCP two-gate model (ADR-0010 status quo):** rejected — the in-session Bedrock auth is
  unreliable exactly when a gate is due, and it lacks the spec + final-implementation coverage.
- **C — Drop cross-provider review entirely:** rejected — the same-provider blind spots ADR-0010 was
  created to cover (a P0 missed by audit-1, the React-19 `inert` regression) still apply.

## Consequences

- **Positive:** review no longer depends on in-session MCP/Bedrock auth; three checkpoints (spec, plan,
  completed impl) widen coverage over the old plan+diff pair; prompt+review files are a committed,
  auditable trail; the user controls the sandbox directly (read-only).
- **Negative / trade-offs:** the loop is **not** automatic — it needs a human to run Codex and signal
  completion, so a pass can stall on availability; review quality still depends on honest, self-contained
  prompt assembly by Claude; three passes per sub-project is more prompt-writing overhead than two
  inline gates.
- **Follow-ups:** watch that the final-implementation pass doesn't become a rubber stamp after internal
  reviews; if the MCP auth is ever fixed it could return as an *optional* transport, but the file trail
  is the sanctioned default. The `codex` MCP server was removed at user scope on 2026-07-14.

## Confirmation

CLAUDE.md §"Cross-provider review with Codex (file-based handoff)" names the three targets, forbids the
MCP tool for reviews, and fixes the `codex/input` → `codex/output` naming; its presence and shape is the
standing check (the `/checkpoint` sweep treats its removal/weakening as drift). A committed
`codex/input/<date>-<name>.md` + matching `codex/output/<date>-<name>-review.md` pair for a shipped
sub-project is the evidence a pass actually ran.

## Links

- Related ADRs: supersedes [ADR-0010](ADR-0010-codex-adversarial-review-gates.md) (the MCP two-gate
  model); complements [ADR-0004](ADR-0004-content-authoring-automation-layer.md) (the same-provider
  content-integrity review layer) and [ADR-0009](ADR-0009-claude-md-pointer-doctrine.md) (process rules
  whose authority is CLAUDE.md are allowed CLAUDE.md content).
- Planning docs: CLAUDE.md §"Cross-provider review with Codex (file-based handoff)";
  [`codex/README.md`](../../codex/README.md).
- Commits / PRs: the 2026-07-14 switch (this branch `feat/phase2-deduction-feedback`).
