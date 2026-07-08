// Postbuild step for the Cloudflare assets-only Worker (issue #47).
//
// Vite's `base: '/gaslight-and-grimoire/'` rewrites the URLs inside the built
// HTML/JS (the browser requests `/gaslight-and-grimoire/index.html`,
// `/gaslight-and-grimoire/assets/*`, …) but does NOT nest the physical output —
// `vite build` still writes `dist/index.html`, `dist/assets/*` at the root.
// Cloudflare's static-assets Worker maps the request path 1:1 onto the assets
// directory, so `/gaslight-and-grimoire/index.html` resolves to
// `dist/gaslight-and-grimoire/index.html` and 404s without this nesting.
//
// So we move everything in dist/ into dist/gaslight-and-grimoire/ to physically
// match the routed path — EXCEPT `_headers` (and `_redirects`), which Cloudflare
// only reads from the assets-directory ROOT, so they must stay at dist/.
//
// GitHub Pages served from the repo root and rewrote paths differently, so it
// never needed this; the Worker's literal path mapping does.

import { rename, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const NESTED = join(DIST, 'gaslight-and-grimoire');

// Files Cloudflare parses from the assets-directory root — never nest these.
const ROOT_ONLY = new Set(['_headers', '_redirects']);

const entries = await readdir(DIST, { withFileTypes: true });

await mkdir(NESTED, { recursive: true });

const moved = [];
for (const entry of entries) {
  // Skip the nesting target itself (defends against a re-run) and root-only files.
  if (entry.name === 'gaslight-and-grimoire' || ROOT_ONLY.has(entry.name)) continue;
  await rename(join(DIST, entry.name), join(NESTED, entry.name));
  moved.push(entry.name);
}

console.log(
  `nest-for-cloudflare: moved ${moved.length} entry/entries into ${NESTED}/ ` +
    `[${moved.join(', ')}]; kept _headers/_redirects at ${DIST}/ root`,
);
