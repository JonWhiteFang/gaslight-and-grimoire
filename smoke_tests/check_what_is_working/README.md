# Smoke Test Strategy

## Platform

This is a React/TypeScript browser app (not Kotlin/Android). The testing stack is Vitest 3 + React Testing Library + fast-check, running in a jsdom environment. There is no JUnit, no Gradle, no instrumentation tests.

## Commands

```bash
# Type check (strict mode, no emit)
npx tsc --noEmit

# Build (tsc + vite build → dist/)
npm run build

# Run all tests (single run, CI-friendly)
npm run test:run

# Run tests in watch mode (development)
npm test

# Validate content JSON (broken scene refs, missing clue IDs)
node scripts/validateCase.mjs

# Dependency audit
npm audit
```

## What Exists

- 18 test files, 269 tests total
- 9 component tests in `src/components/__tests__/`
- 8 engine tests in `src/engine/__tests__/` (4 property-based with fast-check)
- 1 store test in `src/store/__tests__/`
- Content validator script (`scripts/validateCase.mjs`)

## Smoke Test Approach

The smoke tests below don't introduce a new framework. They use the existing Vitest setup and the existing test patterns. The test plan defines 25 focused cases across 5 areas that validate the current working state of the codebase — what passes, what's known-broken, and what blocks progress.

The goal is a baseline: if these pass, the codebase is in a known-good state for starting gap closure work.
