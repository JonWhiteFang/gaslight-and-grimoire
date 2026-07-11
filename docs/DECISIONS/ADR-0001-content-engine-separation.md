---
status: "Enacted"
date: "2026-07-07 (recorded retroactively; the decision predates the spine and is realised in the current codebase)"
deciders: "Project maintainer"
phase: "Foundation (Phases A–E)"
---

# ADR-0001: Content ↔ engine separation, single store, bounded state

## Context

Gaslight & Grimoire is a branching narrative game: a large body of authored content (cases, scenes,
clues, NPCs) driven by a game engine, with UI state that must persist across saves and stay
deterministic enough to test. Three forces pull on the design:

1. **Content must be editable without touching code.** Narrative authors add scenes, clues, and gating
   without recompiling or writing bespoke handlers.
2. **The engine must be testable.** Faculty checks, deduction formation, and scene resolution need to be
   exercised as pure functions, not entangled with React or the store.
3. **State must not drift into invalid ranges** and must be reconstructible from a save file.

This baseline needed to be stated as a decision so later work can reference or supersede specific parts.

## Decision

Two strict domains that never mix: **`public/content/` holds narrative as JSON** (fetched at runtime as
`/content/...`), and **`src/engine/` holds game logic as pure functions where possible**. All gating and
state mutation from content flows through exactly two declarative mechanisms — **`Condition`** (gates) and
**`Effect`** (mutations) — with no ad-hoc logic in scene handlers. State lives in a **single Zustand +
Immer store composed of six domain slices** (investigator, narrative, evidence, npc, world, meta), flat
and normalised (`Record<string, T>` keyed by id). The **engine takes an `EngineActions` interface**
rather than importing the store, keeping engine files free of store imports. All numeric state is
**bounded** (composure/vitality [0,10], disposition [-10,+10], suspicion [0,10], faction reputation
[-10,+10]). Deductions are **always derived from linked clue IDs**, never hardcoded.

## Alternatives considered

- **A — Content as code (TypeScript scene modules):** type-safe and refactor-friendly, but couples narrative editing to compilation and to engine internals, and defeats runtime-fetched content. Rejected.
- **B — Multiple independent stores / Context per domain:** simpler per-slice, but cross-slice couplings (disposition → faction reputation) and save/load atomicity become fragile. Rejected in favour of one composed store.
- **C — Engine imports the store directly:** fewer parameters, but creates a circular dependency and makes engine functions untestable in isolation. Rejected in favour of the `EngineActions` interface.
- **D — Unbounded state, clamp at the UI:** simpler writes, but lets invalid values into saves and tests. Rejected in favour of clamping at the slice action.

## Consequences

- **Positive:** narrative authors work purely in JSON, validated by `scripts/validateCase.mjs`; the engine is unit- and property-testable (334 tests, six `*.property.test.ts` suites); saves reconstruct cleanly; state can't drift out of range.
- **Negative / trade-offs:** the `Condition`/`Effect` catalogs must expand whenever content needs a new gate or mutation (a deliberate chokepoint, not a leak); engine functions carry an `EngineActions` parameter; `Date.now()`/`Math.random()` are used directly in a few engine spots and are not injectable (tests work around this).
- **Follow-ups:** none outstanding. Revisit `Condition`/`Effect` catalog growth if content needs mechanics the two mechanisms can't express.

## Links

- Related ADRs: none.
- Planning docs: [../../CLAUDE.md](../../CLAUDE.md) (Architecture, Store & State Management, Content Authoring Rules), [../architecture.md](../architecture.md), [../engine-reference.md](../engine-reference.md).
- Commits / PRs: predates the memory spine; realised across Phases A–E.
