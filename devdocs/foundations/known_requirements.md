# Known Requirements (Doc-Inferred)

> Derived from: `.kiro/specs/gaslight-and-grimoire/requirements.md` (19 requirements, 95 acceptance criteria), `docs/Gaslight_&_Grimoire_design.md`, `AGENTS.md`

## Formal Requirements (from .kiro/specs)

The requirements document defines 19 requirements with formal acceptance criteria using SHALL/WHEN/WHILE language. Each is traced via `Req X.Y` comments in code (178 references across 39 files).

### Req 1: Character Creation (7 criteria)
Four archetypes, base 8 faculties, 12 bonus points, real-time modifier display, name entry, composure/vitality initialized to 10.

### Req 2: Narrative Engine and Scene Rendering (9 criteria)
JSON scene loading, typewriter effect, reduced motion instant text, illustrations, condition evaluation, variant scenes, onEnter effects, scene history, archetype-exclusive scenes.

### Req 3: Choice System (6 criteria)
Display all choices, conditional visibility, faculty tags, proficiency colour-coding (green/amber/red), advantage indicator, text labels alongside colours.

### Req 4: Faculty Check System (9 criteria)
d20 + modifier, 5 outcome tiers, advantage/disadvantage, dynamic difficulty, animated dice roll, reduced motion fallback, outcome banner (2s), scene navigation per tier.

### Req 5: Composure and Vitality (7 criteria)
Animated meters 0–10, red pulse on decrease with descriptor, gold pulse on increase, critical threshold at ≤2, breakdown at 0 composure, incapacitation at 0 vitality, reduced motion fallback.

### Req 6: Clue Discovery (8 criteria)
Discovery methods (exploration, check, dialogue, automatic), faculty/deduction gating, slide-in clue card, type-specific chime, reduced motion fallback, "new" status, evidence board pulse, never reveal missed clues.

### Req 7: Evidence Board (10 criteria)
Full-screen overlay, draggable clue cards, 6 status states, connection threads, tag-based brightening, deduction button (Reason check), success locks clues, failure shows slack thread, progress summary with hidden totals, red herring consequences.

### Req 8: NPC System (9 criteria)
Disposition [-10,+10], suspicion [0,10], 4 suspicion tiers with behavioral changes, cross-case persistence, NPC removal with scene replacement, faction reputation propagation.

### Req 9: Encounter System (7 criteria)
2–4 rounds with 2–4 faculty choices, composure/vitality consequences, supernatural reaction check, failure penalties, dual-axis damage, occult clue advantage, non-combat escape paths.

### Req 10: Case Structure and Progression (8 criteria)
Three-act main cases, two-act vignettes, no single-faculty gates, two investigative angles, persistent flags/reputation/NPC state, +1 faculty bonus on completion, variant scenes from prior flags, vignette unlocks.

### Req 11: Save and Load (8 criteria)
Full state serialization, IndexedDB primary with localStorage fallback, versioned save files, auto-save per choice/scene/manual, complete state restoration on load, migration pipeline.

### Req 12: Accessibility (11 criteria)
Font size presets + slider, high contrast, colour-independent indicators, reduced motion, keyboard navigation, 44px touch targets, ARIA labels, reading pace control, volume sliders, case journal, NPC gallery.

### Req 13: Hint System (6 criteria)
Trigger on 3+ board visits or 5+ min dwell, 3 escalating levels, level 3 gated behind level 2, hints only via deliberate action, respects disabled setting.

### Req 14: Audio System (7 criteria)
Ambient loops per scene, dice roll SFX, composure decrease tone, vitality decrease impact, scene transition SFX, visual equivalents for all audio, independent volume controls.

### Req 15: Archetype Abilities (6 criteria)
Elementary (auto-succeed Reason), Veil Sight (reveal supernatural), Street Survivor (auto-succeed Vigor), Silver Tongue (auto-succeed Influence), reset per case, visual unavailable indicator.

### Req 16: Outcome Feedback (5 criteria)
Outcome banner with tier-specific colour/icon, 2s display, clue card with 4s auto-dismiss, key icon on preparation-unlocked choices, reduced motion fallback.

### Req 17: JSON Content Loading (5 criteria)
Case file structure (7 files), vignette file structure (4 files), scene transition validation, clue reference validation, descriptive error logging.

### Req 18: Title Screen (5 criteria)
New game, load game, settings options, atmospheric visual style, ambient audio.

### Req 19: Faction Reputation (5 criteria)
Track 4 factions, adjust on player choices, decrease on rival help, persist across cases, unlock vignettes at thresholds.

## Constraints from Docs

### Platform
- Browser-based (React 18+, Vite, GitHub Pages)
- No native platform, no mobile wrapper
- Static hosting — no server components

### Persistence
- Docs specify IndexedDB primary, localStorage fallback
- Versioned save files with migration pipeline
- Full state serialization including settings

### Accessibility
- Treated as Phase 1 foundation, not post-launch
- WCAG-aligned: 44px touch targets, colour-independent indicators, keyboard navigation, screen reader support
- Reduced motion respects OS preference

### Content
- JSON-authored, validated offline
- Strict Condition/Effect contract — no ad-hoc logic
- Faculty balance quotas per case
- Supernatural slow-burn pacing model

### Security
- OWASP Dependency-Check + npm audit (weekly + on PR)
- Fail on CVSS ≥ 7
- npm audit before every deploy

### Privacy
- No user data collection mentioned in any doc
- All data local (IndexedDB/localStorage)
- No accounts, no authentication

## Content Authoring Constraints (from design doc + AGENTS.md)

- Condition and Effect are the ONLY state mutation mechanism from content
- Deductions derived from linked clue IDs — never hardcoded
- Red herring propagation: if any connected clue is redHerring, deduction.isRedHerring must be true
- No single faculty gates critical progress
- Meaningful consequences required — no cosmetic-only branching
- Run `validateCase.mjs` after editing
- Narrative tone: measured, atmospheric, never campy
- Scene text: 100–200 words, present-tense, second person
- Each case: minimum faculty check quotas, 2+ investigative angles, 2–3 archetype-exclusive scenes

---

## Docs vs Code Delta

| Requirement | Docs say | Code status |
|---|---|---|
| Req 6.3 | Clue card slides in with type icon, title, summary, auto-dismiss 4s | Stub component — never wired with props |
| Req 6.4 | Type-specific chime on clue discovery | SFX code exists, no audio files in repo |
| Req 9 (all) | Encounter system with multi-round UI | Engine complete, no UI component |
| Req 11.2 | IndexedDB primary, localStorage fallback | localStorage only |
| Req 11.7 | Restore complete game state on load | `loadGame` doesn't restore `caseData` — blank screen |
| Req 13.1 | Hint triggers on board visits / scene dwell | `trackActivity` never called from components |
| Req 17.3–17.5 | Validate when JSON is loaded | `validateContent` exists but never called at runtime |
| Req 19.3 | Decrease rival faction rep | Not implemented |
| Req 12.3 | Colorblind support with patterns/icons | `colorblindMode` not in code's `GameSettings` |
| Req 7.9 | Progress summary with hidden totals ("?") | `ProgressSummary` exists but always shows actual counts, not "?" |
| Req 5.2–5.3 | Status bar descriptors ("Shaken", "Bruised", etc.) | Meters exist but descriptors not visible in StatusBar code |
| Req 10.6 | +1 faculty from critical moment | Engine implements it; `last-critical-faculty` flag must be set by content, not by `processChoice` |
| Req 15.1–15.4 | Archetype abilities auto-succeed specific checks | Abilities set world flags but no engine code reads those flags to auto-succeed checks |
| Req 18.5 | Title screen ambient audio | No audio files, no ambient track on title screen |
| Design doc §4.3 | Occultist: +1 Nerve, Operator: +1 Influence, Mesmerist: +1 Lore | Code: Occultist: +1 Perception, Operator: +1 Nerve, Mesmerist: +1 Nerve |
| Design doc §9.4 | Starter case: "The Lamplighter's Wake" | Code: "The Whitechapel Cipher" |
| Design doc §10.2 | Sans-serif for UI elements | Code uses serif (Georgia) for everything via Tailwind config |
