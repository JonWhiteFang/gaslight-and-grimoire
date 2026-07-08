# Gaslight & Grimoire

A browser-based choose-your-own-adventure game set in a Victorian London where magic exists beneath
the rational world. Players investigate branching mysteries that blend Sherlock Holmes-style
deduction with D&D-style faculty checks and d20 dice mechanics.

**▶ Play it: https://jonwhitefang.github.io/gaslight-and-grimoire/**

Seven cases (198 scenes) span three multi-act mysteries and four side vignettes, with four playable
archetypes, four factions, an evidence-connection deduction system, and stateful hints.

## Tech stack

React 18 · [Zustand](https://github.com/pmndrs/zustand) (single Immer-powered store) ·
Tailwind CSS · Framer Motion · [Howler.js](https://howlerjs.com/) · TypeScript · Vite · Vitest.
Narrative content is authored as JSON under `public/content/` and loaded by the engine at runtime,
kept strictly separate from game logic in `src/engine/`.

## Getting started

Requires **Node ≥ 20.19** (see `.nvmrc`; Vite 7 needs `^20.19 || >=22.12`).

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check (`tsc`) then build for production (`vite build`). |
| `npm run preview` | Preview the production build locally. |
| `npm test` | Run Vitest in watch mode. |
| `npm run test:run` | Run the full Vitest suite once (used in CI). |
| `npm run lint` | Run ESLint over the project. |
| `node scripts/validateCase.mjs` | Validate case/vignette content JSON for broken scene edges and missing clue references. |

## Continuous integration

- **`.github/workflows/deploy.yml`** — on push/PR to `main`: lint + content validation + full test
  suite gate a production build, which deploys to GitHub Pages (deploy skipped on PR events).
- **`.github/workflows/security.yml`** — `npm audit` + OWASP Dependency-Check on every PR and weekly.

## Documentation

Project documentation lives under [`docs/`](./docs/). Start with [`docs/README.md`](./docs/README.md)
for an orientation and a map of the docs; if you're resuming work, read
[`docs/PROJECT_STATE.md`](./docs/PROJECT_STATE.md) first. Contributor-facing conventions and
architecture invariants are in [`CLAUDE.md`](./CLAUDE.md).
