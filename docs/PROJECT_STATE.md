# Project State — Gaslight & Grimoire

> **One-page living snapshot.** This is the committed, version-controlled "current truth" of
> where the build is. Keep it to roughly one screen — push detail into [RUN_LOG.md](RUN_LOG.md)
> and [DECISIONS/](DECISIONS/). Update it at the end of every working session.
>
> This file does **not** restate architecture, invariants, or scope rules — those live in
> [../CLAUDE.md](../CLAUDE.md) and the [docs/](README.md) set. This file tracks *progress and live
> decisions only*.

_Last updated: 2026-07-07 (Added Playwright MCP at project scope (ADR-0003) — a clone can now drive the
running browser game for runtime verification. Game code is feature-complete through Phase E with 334
tests green; the only substantive remaining work is shipping audio/visual media assets.)_

---

## Current position

- **Stage:** Phases A–E complete; the game is feature-complete and playable end-to-end (7 cases, 198
  scenes). Docs were rebuilt into the lean `docs/` set. What does **not** yet exist: any audio or image
  media files — the media systems are coded but the game runs silent and text-only.
- **Active gate:** none formal. Quality bar in force: `npm run test:run` green + `node scripts/validateCase.mjs` clean before any merge to `main`.
- **Branch focus:** `main` (clean). Next work starts from a fresh branch off `main`.
- **Verification:** 2026-07-07 — `npm run test:run` → **334 passed (334)** across **29** files; content validation clean for all 7 cases; `npm run build` last known good.

---

## Phase / milestone tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done & verified · `[!]` blocked.
Source of truth for each phase's scope: the Implementation Roadmap in [../CLAUDE.md](../CLAUDE.md); current-state detail in [status.md](status.md).

| # | Title | Status | Notes |
|--:|-------|:------:|-------|
| A | Foundation (loadGame fix, snapshot dedupe, hint wiring, ability fix, validation, firstScene) | `[x]` | Complete |
| B | Core refactoring (pure `computeChoiceResult`, engine↔store decoupled, audio subscription, runtime content validation) | `[x]` | Complete; engine has zero store imports |
| C | Gap filling (ClueDiscoveryCard, save button, faction display, error display, completion screen) | `[x]` | Complete |
| D | Integration (encounter UI, stale-state cleanup, dead-code removal) | `[x]` | Complete |
| E | Game design (active clue discovery, consequence feedback, Veil Sight, recovery, persistent evidence board, faction clamping, CI validation, NPC dialogue, scene history, testing + content depth) | `[x]` | Complete — 334 tests |
| — | Docs rebuild (lean `docs/` set: architecture, engine-reference, content-authoring, status, README) | `[x]` | Complete (recent commits) |
| — | Committed memory spine (this system) | `[x]` | STATE + RUN_LOG + DECISIONS + hook + `/checkpoint` |
| M | Media assets — audio (.mp3) + illustrations + NPC portraits | `[ ]` | Systems coded; **no media files ship**. Only substantive open work. |

---

## Next actions (explicit order)

1. **Decide the media-assets approach** (the one open question below) before producing any files — sourcing, format, and licensing drive everything downstream.
2. Once decided: produce the nine SFX `.mp3` files named in [content-authoring.md](content-authoring.md#audio-asset-reference), drop them under `public/`, and confirm Howler loads them in the dev server (drive the running app via the Playwright MCP server — see ADR-0003).
3. Add scene illustrations / NPC portraits per the same asset reference; verify `SceneIllustration` and `NPCGallery` render them (Playwright MCP can confirm in-browser).

---

## Open questions / decisions pending

These are flagged-but-unresolved. Resolve each via an ADR when decided, then mark it RESOLVED with a link.

- **How do we source and license media assets?** — Audio (9 SFX + ambient loops) and images (scene illustrations, NPC portraits) are unbuilt. Options: commission, license a pack, or generate. Format/naming is already pinned by `content-authoring.md`; the open part is sourcing + licensing + repo-size impact. → ADR when decided.

---

## References

- Decisions: [`DECISIONS/`](DECISIONS/) — [ADR-0001](DECISIONS/ADR-0001-content-engine-separation.md) (content↔engine separation & bounded state, Enacted), [ADR-0002](DECISIONS/ADR-0002-committed-memory-spine.md) (this memory spine, Enacted), [ADR-0003](DECISIONS/ADR-0003-playwright-mcp-project-scope.md) (Playwright MCP at project scope, Enacted).
- Run history: [`RUN_LOG.md`](RUN_LOG.md).
- Architecture, invariants, store conventions, content rules, known gaps: [../CLAUDE.md](../CLAUDE.md).
- Current-state snapshot (content inventory, systems, asset status, test baseline): [status.md](status.md).
- Doc map: [README.md](README.md).
