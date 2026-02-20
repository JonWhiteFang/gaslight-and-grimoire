# Business-Level Concepts

## Product Identity

### Victorian Mystery Adventure Game
Browser-based choose-your-own-adventure set in Victorian London where magic exists beneath the rational world. Blends Sherlock Holmes deduction with D&D dice mechanics. Gothic tone: gaslit alleyways, occult conspiracies, moral grey areas.
- **Status**: Fully implemented (engine + UI + 1 case)
- **Files**: entire codebase; tone enforced by content JSON, not code

### Free-to-Play Static Web Game
No monetisation, no accounts, no analytics, no telemetry. Deployed to GitHub Pages as a static site. Zero operational cost.
- **Status**: Fully implemented
- **Files**: `.github/workflows/deploy.yml`, `vite.config.ts` → `base: '/gaslight-and-grimoire/'`

## Content Pipeline

### Case Authoring as JSON
Cases are authored as structured JSON files (scenes, clues, NPCs, variants) under `content/`. No CMS, no editor UI. Validated offline via `scripts/validateCase.mjs`.
- **Status**: Fully implemented
- **Files**: `content/`, `scripts/validateCase.mjs`

### Content Volume
One main case ("The Whitechapel Cipher", 3 acts) and one side case ("A Matter of Shadows"). The engine supports arbitrary cases but the content library is minimal.
- **Status**: Partially implemented (engine ready, content sparse)
- **Files**: `content/cases/the-whitechapel-cipher/`, `content/side-cases/a-matter-of-shadows/`

## Player Experience

### Persistent World Across Cases
NPC relationships, faction reputation, and world flags carry across cases. Completing a case persists state and can unlock vignettes. The world evolves based on cumulative player choices.
- **Status**: Partially implemented (engine supports it; only 1 case exists so cross-case persistence is untestable)
- **Files**: `src/engine/caseProgression.ts`, `src/store/slices/worldSlice.ts`

### Save/Load with Multiple Slots
Up to 10 manual saves + 1 autosave. Autosave on scene transition or choice (configurable). Save list with timestamps, investigator name, case name. Delete individual saves.
- **Status**: Partially implemented (save works, load is broken — doesn't restore case data)
- **Files**: `src/engine/saveManager.ts`, `src/store/slices/metaSlice.ts`, `src/components/TitleScreen/LoadGameScreen.tsx`

### Accessibility as First-Class Feature
Font size presets + custom slider, high contrast mode, reduced motion (respects OS preference), text speed control (typewriter/fast/instant), hints toggle. All interactive elements have 44px minimum touch targets. ARIA labels throughout.
- **Status**: Fully implemented
- **Files**: `src/components/AccessibilityProvider/`, `src/components/SettingsPanel/`, `src/index.css`

### Replayability via Archetype Diversity
Four archetypes with different faculty distributions and abilities create meaningfully different playthroughs. Choices gated by different faculties mean different paths are available to different builds.
- **Status**: Fully implemented (system); depends on content having diverse faculty gates
- **Files**: `src/data/archetypes.ts`, content JSON `choice.faculty` fields

## Quality & Security

### Dependency Security Scanning
Weekly OWASP Dependency-Check + npm audit on PRs. Fails on CVSS ≥ 7. SARIF results uploaded to GitHub Security tab.
- **Status**: Fully implemented
- **Files**: `.github/workflows/security.yml`

### CI/CD Pipeline
Push to `main` triggers: `npm ci` → `npm audit` → `tsc` → `vite build` → deploy to GitHub Pages. Concurrency-controlled (one deploy at a time).
- **Status**: Fully implemented
- **Files**: `.github/workflows/deploy.yml`

### No User Data Collection
No accounts, no cookies, no analytics, no server-side logging. All data stays in the player's browser localStorage. No PII is collected or transmitted.
- **Status**: Fully implemented (by absence of any collection mechanism)
- **Files**: N/A — verified by absence
