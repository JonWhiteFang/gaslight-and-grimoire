# Gaslight & Grimoire — Documentation

Gaslight & Grimoire is a browser-based choose-your-own-adventure game set in a
Victorian London where magic exists beneath the rational world. Players
investigate branching mysteries that blend Sherlock Holmes-style deduction with
D&D-style faculty checks and d20 dice mechanics. It is built with React 18, a
single Zustand store (Immer), Tailwind CSS, Framer Motion, and Howler.js, and
deployed as a Cloudflare static-assets Worker at
`holodeck.jonwhitefang.uk/gaslight-and-grimoire/`.

## Documentation map

| Document | Read this when… |
|---|---|
| [README.md](./README.md) | You want an orientation and a map of the docs (this file). |
| [architecture.md](./architecture.md) | You need the system structure: the engine↔store boundary, store slices, data flow, and bounded-state rules. |
| [engine-reference.md](./engine-reference.md) | You need the per-module API for `src/engine/` — signatures and behaviour. |
| [content-authoring.md](./content-authoring.md) | You are writing or editing case/vignette JSON — the schema, `Condition`/`Effect` mechanics, and the audio asset reference. |
| [status.md](./status.md) | You want the current-state snapshot: content inventory, implemented systems, asset status, and the test baseline. |
| [Gaslight_&_Grimoire_design.md](./Gaslight_&_Grimoire_design.md) | You want the design intent and vision — the canonical design bible. |
| [PROJECT_STATE.md](./PROJECT_STATE.md) | You are resuming work and need the one-page live snapshot: where the build is right now and what's next. **Read this first.** |
| [RUN_LOG.md](./RUN_LOG.md) | You want the append-only history of working sessions (what happened, when). |
| [DECISIONS/](./DECISIONS/) | You want the *why* behind non-trivial calls — Architecture Decision Records. |

For the working agreement (architecture rules, store conventions, content
authoring rules, and known gaps), see [../CLAUDE.md](../CLAUDE.md).

## Commands

```bash
npm run dev                    # Vite dev server
npm run build                  # tsc + vite build
npm run test:run               # vitest single run (use for CI / scripted checks)
node scripts/validateCase.mjs  # Validate case/vignette content JSON
```
