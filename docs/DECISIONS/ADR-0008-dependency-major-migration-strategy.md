---
status: "Enacted"
date: "2026-07-09"
deciders: "Jon White (owner), Claude"
phase: "Maintenance / dependency upkeep"
---

# ADR-0008: Clustered major-dependency migration; defer TypeScript 7; opt out of new lint rules

## Context

Dependabot opened PR #43 — a single "major group" bumping 20 packages at once (React 18→19,
Vite 7→8, Vitest 3→4, Tailwind 3→4, ESLint 9→10, TypeScript 5→7, zustand/immer/jsdom/etc.). The
combined PR could not even `npm ci`: TypeScript 7 conflicts with `typescript-eslint`'s hard peer cap
(`typescript >=4.8.4 <6.1.0`), so the install aborts before any test runs. Several members carry real
breaking migrations (Tailwind 4's config-format rewrite, Vite 8's Rolldown bundler, React 19's runtime,
ESLint 10's expanded recommended presets). We needed the upgrades but could not accept the group as one
atomic merge, and the repo's merge gate (lint + validator + `test:run` + build) must stay green
throughout.

## Decision

Migrate the majors on a dedicated branch in **dependency-ordered clusters** — runtime (React 19 &
friends), then build/test toolchain (Vite 8 / Vitest 4 / jsdom 29), then Tailwind 4 + ESLint 10 — with
the full gate run and a commit made per cluster. **Hold TypeScript at 5.x** and exclude TS 7 entirely
until `typescript-eslint` supports it (verified `@latest` and `@canary` both still cap at `<6.1.0`).
Where ESLint 10 / `eslint-plugin-react-hooks` 7 add new opinionated rules to their *recommended* presets
(`set-state-in-effect`, `refs`, `no-useless-assignment`) that flag working, intentional code, **opt out
of those rules with an in-file rationale** rather than fold a behavioural refactor into a dependency
bump. Ship as PR #51 (superseding #43, which is closed); Dependabot will reopen a narrower TS-only PR.

## Alternatives considered

- **A — Merge Dependabot #43 as-is:** rejected. It cannot `npm ci` (TS 7 peer conflict) and would land
  ~6 independent breaking migrations in one un-bisectable commit — impossible to review or revert
  cleanly.
- **B — `--legacy-peer-deps` / `--force` to swallow the TS 7 conflict:** rejected. It masks a real
  incompatibility (`typescript-eslint` genuinely doesn't run on TS 7), producing a lint toolchain that
  is broken-but-quiet. The block is upstream and time-based, not something to override.
- **C — Refactor the code flagged by the new lint rules (12 sites) as part of this PR:** rejected as
  scope creep. The rules are performance/style heuristics, not correctness; the flagged code is
  deliberate. Absorbing a multi-site refactor into a deps bump muddies both. Left as a separate,
  optional future change.
- **D (chosen) — Clustered migration, TS 7 deferred, new rules opted out.**

## Consequences

- **Positive:** 19 of 20 majors current, each cluster independently verified and revertible; the merge
  gate stayed green at every step. React 19 / Vite 8 / Vitest 4 / Tailwind 4 / ESLint 10 all in place.
  The lint contract is unchanged from before the bump, so no behavioural drift slipped in sideways.
- **Negative / trade-offs:** TypeScript stays a major behind until an external dependency catches up —
  a standing "pending" item Dependabot will keep surfacing. Three newly-available lint rules are off, so
  the codebase isn't benefiting from them (documented, revisit-able). Vite 8 (Rolldown) reallocates
  vendor chunk boundaries vs. Vite 7 — bundle shape changed though total size is comparable.
- **Follow-ups:**
  - **Revisit TS 7** when `typescript-eslint` ships support for `typescript >=6.1.0`, then take the
    TS-only Dependabot PR.
  - **Lockfile discipline:** Vite 8 (Rolldown) + Tailwind 4 (oxide) native packages pull `@emnapi/*` via
    wasm32-wasi variants; an incremental `npm install` on macOS omits them and Linux `npm ci` then fails.
    On future Vite/Tailwind bumps, regenerate the lockfile fully (`rm -rf node_modules package-lock.json
    && npm install`) and verify with `npm ci --ignore-scripts` before pushing — never hand-edit the
    native-dep tree.
  - Optionally adopt the opted-out lint rules as their own change (possibly alongside the React
    Compiler for `set-state-in-effect`).

## Links

- Related ADRs: none (independent of ADR-0007, the same-day deploy migration).
- Planning docs: RUN_LOG entry 2026-07-09 (dependency migration); auto-memory `dependabot-major-group-migration`.
- Commits / PRs: PR #51 (`95f6f9c`, squash) — clusters `47a657c` (runtime), `0c8ae85` (toolchain),
  `b9a6633` (Tailwind 4 + ESLint 10), `8c35b25` (lockfile regen). Supersedes/closes Dependabot #43. Safe
  side-PRs merged the same session: #42, #38, #40.
