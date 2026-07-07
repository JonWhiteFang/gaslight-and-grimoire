---
description: Validate case/vignette content JSON for broken scene edges and missing clue references
allowed-tools: Bash(node scripts/validateCase.mjs), Bash(node scripts/validateCase.mjs :*)
---

Run the content validator and report the result.

- Validate all cases: `node scripts/validateCase.mjs`
- Validate one case/vignette: `node scripts/validateCase.mjs <path>` (e.g. `node scripts/validateCase.mjs public/content/cases/the-whitechapel-cipher`)

$ARGUMENTS

Run this after editing any file under `public/content/`. If validation fails, summarise each broken reference (scene ID or clue ID) and the file it appears in, then stop — do not proceed with other work until content validates.
