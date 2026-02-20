# Known Requirements

> Inferred from implementations, code comments (`Req X.Y` references), type constraints, and observable behavior. Not from external documentation.

## Functional Requirements (inferred from code)

### Narrative System
- Scene nodes display narrative text with a typewriter effect (Req 2.2). Reduced motion disables the effect (Req 2.3).
- Scenes may have illustrations (Req 2.4) and ambient audio tracks.
- Scene access is gated by `Condition[]` — all conditions must be met (AND logic) (Req 2.5).
- Variant scenes override base scenes when `variantCondition` is met (Req 2.6).
- `onEnter` effects apply state mutations when a scene is entered (Req 2.7).
- Content is loaded from JSON at runtime via parallel fetches (Req 17.1, 17.2).
- Content is validated for broken scene-graph edges and missing clue references (Req 17.3–17.5).

### Choice System
- All available choices for the current scene are displayed (Req 3.1).
- Choices are hidden if their required clue/deduction/flag/faculty threshold is not met (Req 3.2).
- Faculty-tagged choices show a colour-coded proficiency indicator: green (≥+2), amber (0–+1), red (≤-1) (Req 3.3, 3.4).
- Advantage indicator shown when the player holds a relevant clue (Req 3.5).
- Text labels accompany colour-coded indicators for accessibility (Req 3.6).
- Key icon shown on choices unlocked by a clue or deduction (Req 16.4).

### Dice Mechanics
- d20 roll with faculty modifier: `floor((score - 10) / 2)`.
- Outcome tiers: nat 20 → critical, nat 1 → fumble, total ≥ DC → success, total ≥ DC-2 → partial, else failure.
- Advantage: roll 2d20, take highest. Disadvantage: roll 2d20, take lowest. Both cancel out.
- Dynamic difficulty: DC scales based on a faculty score threshold.
- Dice roll overlay shows roll, modifier, and total with animation (Req 4.6, 4.7).
- Outcome banner shows tier-specific feedback (Req 4.8).

### Composure & Vitality
- Two health tracks, both 0–10, starting at 10 (Req 5.1–5.7).
- Visual meters with colour transitions at thresholds.
- Reaching 0 triggers a special scene (`breakdown` for composure, `incapacitation` for vitality).

### Evidence System
- Clues have types (physical, testimony, occult, deduction, redHerring) and statuses (new, examined, connected, deduced, contested, spent).
- Clue discovery is gated by faculty score and/or deduction possession (Req 6.2).
- Evidence Board is a full-screen overlay accessible at any time (Req 7.1).
- Clue cards show status visually (Req 7.3).
- Connection threads drawn between clues via keyboard (Space) or mouse (Req 7.4).
- Tag-based brightening highlights related clues during connection (Req 7.5).
- "Attempt Deduction" button appears when ≥2 clues are connected (Req 7.6).
- Deduction success locks clues and adds deduction to store (Req 7.7).
- Deduction failure animates thread slack (Req 7.8).
- Red herring clues propagate `isRedHerring` to deductions (Req 7.10).

### NPC System
- NPCs have disposition [-10,+10] and suspicion [0,10] (Req 8.1).
- Choice `npcEffect` adjusts disposition and suspicion (Req 8.2).
- Suspicion maps to tiers: normal (0-2), evasive (3-5), concealing (6-8), hostile (9-10) (Req 8.3–8.6).
- Faction-aligned NPC disposition changes propagate 50% to faction reputation (Req 8.9).

### Encounter System
- Supernatural encounters trigger a Nerve/Lore reaction check at DC 12 (Req 9.1, 9.3).
- Failure: composure damage + worse alternative replacement (Req 9.4).
- Supernatural encounters deal dual-axis damage (composure + vitality) on failure (Req 9.5).
- Occult clue fragments grant Advantage in encounters (Req 9.6).
- Escape paths always available when conditions met (Req 9.7).

### Case Progression
- Case completion persists flags, faction reputation, and NPC state (Req 10.5).
- +1 faculty bonus from `last-critical-faculty` flag (Req 10.6).
- Variant scenes triggered by cross-case flags (Req 10.7).
- Vignette unlocks checked at case completion (Req 10.8).

### Accessibility
- Font size presets (standard/large/extraLarge) + custom slider (Req 12.1).
- High contrast mode (Req 12.2).
- Reduced motion mode, respects OS `prefers-reduced-motion` (Req 12.4).
- Tab navigation between clue cards; Spacebar to connect; Escape closes overlays (Req 12.5).
- Case Journal auto-updates with key events (Req 12.10).
- NPC Gallery shows disposition in narrative terms (Req 12.11).

### Hint System
- Triggers after 3+ board visits with no connections OR 5+ minutes on a scene (Req 13.1).
- Level 1: narrative nudge (Req 13.2). Level 2: specific clue suggestion (Req 13.3). Level 3: direct reveal, gated behind level 2 (Req 13.4).
- Respects `hintsEnabled` setting (Req 13.6).

### Audio
- SFX events: dice-roll, clue-{type}, composure-decrease, vitality-decrease, scene-transition.
- Ambient audio per scene with cross-fade on transition.
- Volume controls for ambient and SFX independently.

## Platform Constraints (inferred from code)

### Browser-only
The app targets modern browsers with ES2020 support (`tsconfig.json` → `target: ES2020`). No native platform, no Electron, no mobile wrapper. Web Audio API required for SFX (`html5: false` in Howler config).

### Static hosting
Vite builds to `dist/` with a hardcoded `base: '/gaslight-and-grimoire/'`. Deployed to GitHub Pages. No server-side rendering, no API endpoints, no dynamic routes.

### localStorage persistence
All save data uses `localStorage` with `gg_save_` prefix. Synchronous, ~5-10MB limit per origin. No IndexedDB, no server-side storage, no cloud sync.

### Offline-capable after initial load
Once the page and content JSON are cached by the browser, the game functions without network. No runtime API calls. Content is fetched once per case load.

## Privacy Constraints (inferred from absence)

### No data collection
No analytics scripts, no tracking pixels, no cookies, no `fetch()` to external services. The only network requests are to the same origin for static assets.

### No PII
The investigator name is stored in localStorage but never transmitted. No email, no account, no authentication.

### No third-party data sharing
Dependencies (React, Zustand, Framer Motion, Howler) are bundled locally. No CDN loads, no external script tags, no iframe embeds.

## Security Measures (inferred from code + CI)

### Dependency scanning
`security.yml` runs weekly OWASP Dependency-Check + `npm audit`. Fails on CVSS ≥ 7. SARIF results uploaded to GitHub Security tab.

### Build-time audit
`deploy.yml` runs `npm audit --audit-level=high` before every deploy. High/critical vulnerabilities block deployment.

### No secrets in code
No API keys, no tokens, no credentials anywhere in the codebase. `import.meta.env.BASE_URL` is the only environment variable, derived from Vite config.

### No user input sanitisation
The game renders narrative text via React's JSX (auto-escaped). No `dangerouslySetInnerHTML`. No user-generated content is rendered. The investigator name is displayed via `{save.investigatorName}` in JSX, which is safe.

### Save file integrity
Save files are not validated, checksummed, or encrypted. They are trivially editable via browser dev tools. This is acceptable for a single-player game with no competitive element.

## Determinism Constraints (inferred from code)

### Not enforced
The codebase does not enforce determinism. `Math.random()` is used directly in `diceEngine.rollD20()`. `Date.now()` is used in `hintEngine`, `saveManager`, `metaSlice`, and `buildDeduction`. No seeding, no DI for randomness or time. Tests work around this by testing pure sub-functions or using `_setState` injection.

### Implied desire
The property-based tests (fast-check) and the pure-function aspiration in the engine layer suggest determinism was a goal that was deprioritised. The `_setState` / `_getState` test helpers in `hintEngine` are a workaround for the lack of DI.

## Testing Constraints (inferred from code)

### jsdom environment
All tests run in jsdom (`vite.config.ts` → `test.environment: 'jsdom'`). No browser-based tests, no Playwright, no Cypress.

### No integration tests
Tests are either unit tests (engine functions) or component tests (React Testing Library). No end-to-end flow tests (e.g., "create character → play scene → make choice → verify scene change").

### Property-based tests for invariants
fast-check is used for: dice roll bounds [1,20], NPC disposition clamping [-10,+10], suspicion clamping [0,10], deduction red-herring propagation, save migration idempotency, slice isolation. These test invariants that must hold for all inputs, not specific scenarios.
