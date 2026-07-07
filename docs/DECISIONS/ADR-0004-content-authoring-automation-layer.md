# ADR-0004: Commit a content-authoring automation layer (hook + reviewer subagent + skills)

- **Status:** Enacted
- **Date:** 2026-07-07
- **Deciders:** Project maintainer
- **Phase / stage:** Tooling / process

## Context

The project's correctness net is strong on *structure*: `scripts/validateCase.mjs`
(shared `src/engine/contentValidation.ts`) catches broken scene edges, missing clue/NPC refs,
incomplete outcome tiers, and bad variant structure, and CI gates on it (ADR-0001, PR #24/#25). But the
authoring rules that make content *good* — "no single Faculty gates critical progress," red-herring ↔
deduction consistency, meaningful (non-cosmetic) branching, semantically-distinct outcome tiers, and the
"measured, atmospheric, never campy" tone — are **not machine-checkable by a schema validator**, and
nothing enforced them between authoring and merge. Separately, two mechanical gaps recurred: the
validator only ran when someone remembered to (a CLAUDE.md rule, not an automated action), and `tsc` only
ran at `npm run build`. This session added a set of Claude Code automations to close those gaps; the
non-trivial call was *which mechanism enforces the design/tone layer*, given that Claude Code hooks run
shell commands and cannot dispatch a subagent.

## Decision

Commit a four-part authoring automation layer, all under `.claude/` (team-shareable, consistent with
ADR-0002/0003's "commit the agent tooling" convention):

1. **`PostToolUse` hook** (`.claude/hooks/post-edit-checks.sh`) — after any `Edit`/`Write`/`MultiEdit`,
   run the content validator on `public/content/**.json` edits and `tsc --noEmit` on `.ts`/`.tsx` edits;
   surface failures back to the agent (exit 2) without reverting the file. Whole-project type-check has a
   `TYPECHECK=0` escape hatch for multi-file refactors; content validation is always-on.
2. **`content-integrity-reviewer` subagent** (`.claude/agents/`) — a read-only reviewer for the
   design/tone layer the validator can't see.
3. **Dispatch wiring** — because a shell hook cannot launch a subagent, the reviewer is invoked from the
   two *skills* that already bracket content work: a new `/review-content` command (explicit entry
   point), the `/new-scene` authoring skill (final step), and the `/checkpoint` skill (a content gate
   that runs only when `public/content/` changed this session).
4. **`/new-scene` skill** (`.claude/skills/new-scene/` + bundled annotated `scene-template.json`) —
   scaffolds correct-by-construction SceneNodes, then validates.

Also committed two additional MCP servers to `.mcp.json` (`context7` for version-pinned library docs,
`github` for the issue/PR backlog), extending ADR-0003's project-scope MCP convention.

## Alternatives considered

- **A — Enforce design/tone via the hook too:** impossible as designed — Claude Code hooks execute shell commands, not Claude agents, so a hook cannot run the LLM-judgement a design review needs. A hook can only shell out to deterministic tools (validator, tsc). Rejected on capability grounds.
- **B — Leave the reviewer as a manually-invoked subagent only:** simplest, but "available" is not "wired in" — the review wouldn't reliably happen at authoring or before merge. Rejected; the user explicitly asked to wire it into the workflow.
- **C — Wire the reviewer into the skills that bracket content work (chosen):** `/new-scene` (authoring) and `/checkpoint` (pre-commit ritual) are the natural gates; `/review-content` is the manual escape hatch. Automatic where it matters, zero overhead on code-only sessions (the `/checkpoint` gate self-skips when no content changed).
- **D — Revert the file on hook failure:** rejected — surfacing the failure to the agent (exit 2) so it fixes forward is less destructive and matches how the SessionStart hook already behaves.

## Consequences

- **Positive:** design/tone violations (single-faculty dead-ends, red-herring mismatches, cosmetic branches, backwards effect deltas) are caught before merge, not in playtesting; content-JSON and TS errors surface at edit time, not build time; all of it travels with the repo. Proven on first use — the reviewer's initial run flagged 4 real findings in *The Debt of Smoke* (2 warnings fixed this session, 2 nits left as optional).
- **Negative / trade-offs:** the whole-project `tsc --noEmit` on every `.ts` edit adds a few seconds per edit and can transiently fail mid-refactor (mitigated by the `TYPECHECK=0` toggle); the reviewer is an LLM judgement (advisory, not deterministic — it can miss or over-flag); `context7`/`github` MCP add per-machine setup (`gh auth`, npx fetch). The hook depends on `jq` being present.
- **Follow-ups:** if the type-check proves noisy, move it to a pre-commit-only gate rather than PostToolUse. Consider extending the reviewer's checklist as new authoring rules emerge. The reviewer only fires from skills — an author editing content *without* running `/new-scene` or `/checkpoint` won't get it automatically (the `PostToolUse` structural hook still fires regardless).

## Links

- Related ADRs: extends [ADR-0002](ADR-0002-committed-memory-spine.md) and [ADR-0003](ADR-0003-playwright-mcp-project-scope.md) (same "commit the agent tooling at project scope" principle); the design-rule set it enforces is the content-authoring half of [ADR-0001](ADR-0001-content-engine-separation.md).
- Planning docs: [../../CLAUDE.md](../../CLAUDE.md) (Content Authoring Rules), [../content-authoring.md](../content-authoring.md) (schema + rules the reviewer cites).
- Commits / PRs: this session (see RUN_LOG 2026-07-07 — content-authoring automation layer).
