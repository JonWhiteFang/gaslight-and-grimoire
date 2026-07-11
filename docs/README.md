# Gaslight & Grimoire — Documentation

Gaslight & Grimoire is a browser-based choose-your-own-adventure game set in a
Victorian London where magic exists beneath the rational world. Players
investigate branching mysteries that blend Sherlock Holmes-style deduction with
D&D-style faculty checks and d20 dice mechanics. It is built with React 19, a
single Zustand store (Immer), Tailwind CSS v4, Framer Motion, and Howler.js, and
deployed as a Cloudflare static-assets Worker at
`holodeck.jonwhitefang.uk/gaslight-and-grimoire/`.

## Documentation map

| Document | Read this when… |
|---|---|
| [README.md](./README.md) | You want an orientation and a map of the docs (this file). |
| [architecture.md](./architecture.md) | You need the system structure: the engine↔store boundary, store slices, data flow, and bounded-state rules. |
| [engine-reference.md](./engine-reference.md) | You need the per-module API for `src/engine/` — signatures and behaviour. |
| [content-authoring.md](./content-authoring.md) | You are writing or editing case/vignette JSON — the schema, `Condition`/`Effect` mechanics, and the audio asset reference. |
| [audio-asset-kit.md](./audio-asset-kit.md) | You are generating the game's audio assets — the ambient-loop / SFX prompt kit and filename conventions. |
| [status.md](./status.md) | You want the current-state snapshot: content inventory, implemented systems, asset status, and the test baseline. |
| [Gaslight_&_Grimoire_design.md](./Gaslight_&_Grimoire_design.md) | You want the design intent and vision — the canonical design bible. |
| [content-ideas-prompt.md](./content-ideas-prompt.md) | You want to generate new case/vignette ideas — the reusable ideation prompt. |
| [content-ideas-2026-07-10.md](./content-ideas-2026-07-10.md) | You want the 2026-07-10 ideation output: 10 new content concepts, top-3 ranking, The Comet Club pitch, and the Mythos-thread staging plan. |
| [PROJECT_STATE.md](./PROJECT_STATE.md) | You are resuming work and need the one-page live snapshot: where the build is right now and what's next. **Read this first.** |
| [RUN_LOG.md](./RUN_LOG.md) | You want the prepend-only history of working sessions (what happened, when; newest on top). |
| [DECISIONS/](./DECISIONS/) | You want the *why* behind non-trivial calls — Architecture Decision Records. |

For the working agreement (the two-domain rule, store conventions, commands,
CI/CD, architectural warnings, and the Codex adversarial-review gates), see
[../CLAUDE.md](../CLAUDE.md).

## Commands

```bash
npm run dev                    # Vite dev server
npm run build                  # tsc (src/) + typecheck:scripts + vite build + Cloudflare nest
npm run test:run               # vitest single run (use for CI / scripted checks)
node scripts/validateCase.mjs  # Validate case/vignette content JSON
```
