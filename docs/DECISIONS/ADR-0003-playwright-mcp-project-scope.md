---
status: "Enacted"
date: "2026-07-07"
deciders: "Project maintainer"
phase: "Tooling / process"
---

# ADR-0003: Commit the Playwright MCP server at project scope

## Context

Gaslight & Grimoire is a browser-based game (React + Vite). Its automated safety net is strong at the
unit/property level (334 tests) and content level (`validateCase.mjs`), but nothing drives the *actual
running app in a browser* — the layer where the one open milestone lives (media assets: audio,
illustrations, portraits, which only manifest at runtime). To verify runtime behaviour an agent needs a
browser-driving capability. Playwright MCP (`@playwright/mcp`) provides this over the Model Context
Protocol, and pairs with the repo's `/run` and `/verify` skills. The question was not *whether* to add it
but *at what scope* — which determines whether the config lives in the repo or only on one machine.

## Decision

Register Playwright MCP at **project scope** via a committed `.mcp.json`
(`npx @playwright/mcp@latest`). It travels with the repo, so any agent or contributor who clones can
drive the browser game for end-to-end verification. Project-scoped MCP servers require a one-time
per-machine approval on first `claude` launch — an accepted security gate, since a committed `.mcp.json`
otherwise lets a repo run arbitrary commands.

## Alternatives considered

- **A — Local scope (private to this project, this machine):** nothing committed, no approval gate, but the capability doesn't travel — a fresh clone or a teammate gets nothing, which contradicts this repo's committed-tooling convention (the memory spine, the `/checkpoint` skill, and `.claude/settings.json` are all committed). Rejected.
- **B — User scope (all the maintainer's projects):** convenient for one person, but leaks a game-specific verification tool into unrelated projects and still doesn't help anyone else who clones *this* repo. Rejected.
- **C — Project scope (chosen):** committed and team-shareable, consistent with how the rest of this repo's agent tooling is handled. The one-time approval prompt is a feature, not a cost.

## Consequences

- **Positive:** any clone can drive the running game to verify runtime-only behaviour (media assets, scene flow, overlays); consistent with the repo's "commit the agent tooling" convention; no per-project reinstall.
- **Negative / trade-offs:** each machine must approve the server once before use (expected for committed MCP); depends on `npx` fetching `@playwright/mcp@latest` (unpinned — a newer release could change tools) and on a Playwright Chromium binary being present locally.
- **Follow-ups:** if reproducibility becomes a concern, pin `@playwright/mcp` to an exact version instead of `@latest`. Use it to verify the media-assets milestone once that work starts.

## Links

- Related ADRs: pairs with [ADR-0002](ADR-0002-committed-memory-spine.md) (same "commit the agent tooling" principle).
- Planning docs: [../PROJECT_STATE.md](../PROJECT_STATE.md) (media-assets milestone + Open questions).
- Commits / PRs: `bfa1820` (add Playwright MCP, project scope).
