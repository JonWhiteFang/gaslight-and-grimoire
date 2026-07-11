---
status: "Enacted"
date: "2026-07-09"
deciders: "Site owner (JonWhiteFang), Claude"
phase: "Deployment (issue #47)"
---

# ADR-0007: Deploy via a Cloudflare static-assets Worker (retire GitHub Pages)

## Context

The game shipped on GitHub Pages. The site owner is bringing it under the `jonwhitefang.uk`
brand as the first entry in a new **Holodeck** section, served at
`https://holodeck.jonwhitefang.uk/gaslight-and-grimoire/`. GitHub Pages has two limits that
matter here: it serves only static files with **no control over real response headers** (so the
CSP had to live in an `index.html` `<meta>` tag, which *cannot* express `frame-ancestors` — a
clickjacking-defence residual accepted at the time, F-037), and it can't sit behind the
`jonwhitefang.uk` Cloudflare zone where HSTS `includeSubDomains` is already live. The repo stays
the source of truth and keeps its toolchain (Vite 7 / React 18) — nothing migrates out; only the
publish target changes.

## Decision

Deploy as a **Cloudflare assets-only Worker** (no Worker script — just static asset serving),
git-connected to this repo, building from `main` on push via the existing `npm run build`.
Configuration is three in-repo files: `wrangler.jsonc` (assets-only, `assets.directory` → `./dist`),
`public/_headers` (ports the CSP to a real response header **and adds `frame-ancestors 'none'`**),
and `scripts/nest-for-cloudflare.mjs` (a postbuild step). The Vite `base: '/gaslight-and-grimoire/'`
is kept unchanged because the Worker is routed at `holodeck.jonwhitefang.uk/gaslight-and-grimoire/*`,
so the existing prefix is exactly right. `deploy.yml` keeps the lint + validator + Vitest gate and a
build-compiles check but no longer publishes; GitHub Pages is unpublished. Cloudflare-side setup
(Worker, route, DNS, root redirect) is owner-managed, out of repo scope.

## Alternatives considered

- **A — Keep GitHub Pages (status quo):** rejected. Can't live under the `jonwhitefang.uk` brand/zone,
  and structurally can't set `frame-ancestors` or any real security header.
- **B — Change Vite `outDir` to nest the build (instead of a postbuild script):** rejected. Vite's
  `publicDir` copy semantics would also move `_headers` into the nested folder, but Cloudflare only
  reads `_headers`/`_redirects` from the **assets-directory root**. A postbuild move is surgical: it
  nests everything *except* the root-only files.
- **C — A full Worker script (fetch handler) instead of assets-only:** rejected as overkill. The game
  is fully static; an assets-only Worker serves it with `_headers`-driven response headers and needs
  no runtime code to maintain.

## Consequences

- **Positive:** Real security headers, including `frame-ancestors 'none'` (closes the F-037 residual).
  Lives under the branded HTTPS subdomain on the existing Cloudflare zone (HSTS-clean from day one).
  Deploy path is Cloudflare-side, so a repo CI failure still blocks the merge gate but never a stale
  deploy. `<meta>` CSP retained in `index.html` for local `vite dev`/`preview` (no Worker there) +
  defence-in-depth — the two CSP strings must be kept in sync.
- **Negative / trade-offs:** There is now a **single deploy path** (Cloudflare only) — no Pages
  fallback. The physical-nesting requirement (`nest-for-cloudflare.mjs`) is a non-obvious build step
  that must survive future `build`-script edits; it exists solely because the Worker maps request
  paths 1:1 onto files while Vite's `base` only rewrites URLs. Cloudflare Bot Fight Mode injects an
  edge script that this repo's `script-src 'self'` CSP blocks → two cosmetic console errors per load,
  **accepted as-is** (same precedent as the main domain's zone).
- **Follow-ups:** Keep the `public/_headers` CSP and the `index.html` `<meta>` CSP in sync on any CSP
  change. If a future change needs runtime logic, revisit alternative C (add a Worker script +
  `run_worker_first`).

## Links

- Related ADRs: none (first deployment-platform decision).
- Planning docs: issue #47; CLAUDE.md → CI/CD section.
- Commits / PRs: PR #48 (config — `wrangler.jsonc`, `_headers`, workflow edit, `2e539fa`), PR #49
  (output nesting — `scripts/nest-for-cloudflare.mjs`, `7144d34`). GitHub Pages unpublished via
  `DELETE /repos/.../pages`.
