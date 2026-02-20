# Intro to Deployment & Infrastructure

> Derived from code on 2026-02-20. Code is the source of truth.

## Platform

This is a browser-based SPA. There is no Android/iOS build, no APK/AAB, no Gradle, no Kotlin. The prompt's Android-specific questions do not apply. What follows covers the actual build, deploy, and local dev setup.

## Tech Stack (build/deploy relevant)

| Tool | Version | Role |
|---|---|---|
| Vite | ^7.3.1 | Dev server, bundler, static asset serving |
| TypeScript | ^5.4.5 | Type checking (`tsc` runs before `vite build`) |
| Tailwind CSS | ^3.4.3 | Utility-first CSS (PostCSS plugin) |
| Node.js | 20 | CI runtime (per `deploy.yml`) |
| GitHub Pages | — | Hosting target |
| GitHub Actions | — | CI/CD |

## Local Development

```bash
npm install          # install all deps
npm run dev          # starts Vite dev server (HMR, serves content/ as static)
npm run build        # tsc type-check + vite build → dist/
npm run preview      # serve the built dist/ locally
npm test             # vitest in watch mode
npm run test:run     # vitest single run (CI-friendly)
```

Vite config (`vite.config.ts`):
- `base: '/gaslight-and-grimoire/'` — all asset paths are prefixed for GitHub Pages subdirectory hosting.
- `plugins: [react()]` — `@vitejs/plugin-react` for JSX transform.
- Test config embedded: `jsdom` environment, `src/test-setup.ts` setup file, globals enabled.

TypeScript config (`tsconfig.json`):
- Target: ES2020, strict mode, `react-jsx` transform.
- `isolatedModules: true` — required by Vite's esbuild transform.
- Separate `tsconfig.node.json` for `vite.config.ts` itself.

PostCSS config (`postcss.config.js`):
- Tailwind CSS + Autoprefixer. No other PostCSS plugins.

## Build Output

`npm run build` produces:
1. `tsc` — type-checks all files in `src/`. Emits nothing (`noEmit: true`).
2. `vite build` — bundles to `dist/`. Output includes:
   - `index.html` with hashed JS/CSS references
   - JS chunks (React, Zustand, Framer Motion, Howler, app code)
   - CSS (Tailwind purged output)
   - `content/` directory copied as static assets (case JSON files)

The `content/` directory is served as static files — the app fetches them at runtime via `fetch()`. They are not compiled into the JS bundle.

## Content Assets

### JSON content (committed)
All case/vignette JSON lives under `content/` and is fetched at runtime. The `narrativeEngine.fetchJson()` helper prepends `import.meta.env.BASE_URL` to construct the full URL.

### Audio assets (not committed)
The codebase references audio files at two paths:
- SFX: `/audio/sfx/*.mp3` (9 events: dice-roll, clue-*, composure-decrease, vitality-decrease, scene-transition)
- Ambient: `/audio/ambient/{trackName}.mp3` (per-scene, referenced by `SceneNode.ambientAudio`)

These files are not in the repository. Howler.js silently handles missing files — the app runs without them, just silently. To add audio, place `.mp3` files in `public/audio/sfx/` and `public/audio/ambient/`.

### Illustrations (not committed)
`SceneNode.illustration` is an optional string field. The `SceneIllustration` component renders it. No illustration files are in the repo.

## CI/CD Pipelines

### `deploy.yml` — Build & Deploy

Trigger: push to `main`, or manual dispatch.

```
checkout → setup Node 20 → npm ci → npm audit --audit-level=high → npm run build → upload dist/ → deploy to GitHub Pages
```

- Concurrency group `pages` with `cancel-in-progress: true` — only one deploy runs at a time.
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- Uses `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`.
- The deployed URL is the GitHub Pages URL for the repo (e.g., `https://<user>.github.io/gaslight-and-grimoire/`).

### `security.yml` — OWASP Security Scan

Trigger: PR to `main`, weekly Monday 08:00 UTC, or manual dispatch.

Two jobs:
1. **npm audit** — `npm audit --audit-level=high`. Fails on high/critical vulnerabilities.
2. **OWASP Dependency-Check** — `dependency-check/Dependency-Check_Action@main`. Scans all project files. Fails on CVSS ≥ 7. Uploads SARIF results to GitHub Security tab.

## Content Validation (offline)

```bash
node scripts/validateCase.mjs                          # validate all cases
node scripts/validateCase.mjs content/cases/my-case    # validate one case
```

`validateCase.mjs` is a standalone Node script (not part of the build). It:
- Reads all scene JSON files for a case (act1–3 or scenes.json for vignettes)
- Reads clues.json and variants.json
- Checks every `choice.outcomes[tier]` points to a valid scene ID
- Checks every `choice.requiresClue` and `choice.advantageIf` reference valid clue IDs
- Checks every `cluesAvailable[].clueId` references a valid clue ID
- Exits with code 1 if any errors found

This is not wired into CI. It's a manual authoring aid.

## Backend Services

None. The app is entirely client-side. Persistence is localStorage. There are no API calls, no server components, no databases, no ONNX models, no data packs to ship or update.

## Build Variants / Flavors

None. There is one build configuration. The `base` path is hardcoded to `/gaslight-and-grimoire/` for GitHub Pages. To deploy elsewhere, change `base` in `vite.config.ts`.

## Environment Variables

Only Vite's built-in `import.meta.env.BASE_URL` is used (derived from the `base` config). No `.env` files, no secrets, no API keys.

## Versioning

`package.json` has `"version": "0.1.0"`. Save files have a `version` field (currently `1`) with a migration pipeline in `saveManager.ts`. These are independent version tracks — the package version is cosmetic, the save version gates data migrations.
