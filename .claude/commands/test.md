---
description: Run the Vitest suite once (single run, not watch mode)
allowed-tools: Bash(npm run test:run), Bash(npm run test:run -- :*)
---

Run the full test suite in single-run mode: `npm run test:run`

To scope to specific files or a name pattern, pass args through: `npm run test:run -- <pattern>`

$ARGUMENTS

Report pass/fail counts. If anything fails, show the failing test name and assertion, and diagnose the root cause before proposing a fix. Baseline as of 2026-07-07: 334 tests across 29 files pass.
