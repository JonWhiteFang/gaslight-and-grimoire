# Project Description (Doc-Inferred)

> Derived from: `docs/Gaslight_&_Grimoire_design.md`, `AGENTS.md`, `.kiro/specs/gaslight-and-grimoire/requirements.md`, `.kiro/specs/gaslight-and-grimoire/design.md`, `CODE_REVIEW.md`

## What the Docs Say the System Does

Gaslight & Grimoire is a browser-based choose-your-own-adventure game set in Victorian London (1893) where magic simmers beneath the rational world. Players are investigators navigating branching mysteries that blend Sherlock Holmes-style deduction with D&D-style faculty checks and dice mechanics. The tone is gothic mystery — gaslit alleyways, occult conspiracies, moral grey areas.

The core gameplay loop is DISCOVER → CONNECT → ACT → REFLECT, repeating 2–3 times per case with escalating stakes. Knowledge is power: clues grant mechanical Advantage on dice rolls, deductions unlock story branches, and acting without evidence is harder and riskier.

The game features four archetypes (Deductionist, Occultist, Operator, Mesmerist), six faculties, a d20 check system with five outcome tiers, an evidence board for forming deductions, dynamic NPCs with disposition and suspicion, supernatural encounters with dual-axis damage, and a persistent world where faction reputation and NPC relationships carry across cases.

## User Types per Docs

- **Player**: The sole user. Creates a character, plays cases, manages evidence, saves/loads progress.
- **Content author** (implicit): Writes case JSON following authoring guidelines. Uses `validateCase.mjs` for validation. Not a user of the running app.
- **Developer** (Req 17): The requirements doc includes a developer-facing requirement for JSON content loading and validation.

## Problems Being Solved per Docs

1. Branching narrative with mechanical depth (design doc §2.3: "knowledge is power")
2. Replayability through archetype diversity, hidden clues, red herrings, variant scenes, and faction-gated content (design doc §14)
3. Accessibility as a core requirement, not a post-launch addition (design doc §11, Req 12)
4. Content-driven extensibility — cases authored as JSON, decoupled from game code (design doc §13, Req 17)
5. Atmospheric immersion through audio, visual effects, and typewriter text (design doc §10)

## Starter Case per Docs

The design doc (§9.4) describes "The Lamplighter's Wake" as the starter case — a locked-room murder of a Lamplighter agent in Whitechapel. AGENTS.md lists "The Whitechapel Cipher" as the actual implemented case.

## Development Roadmap per Docs

The design doc (§15) outlines 5 phases:
- Phase 1 (Weeks 1–3): Foundation — scaffolding, store, character creation, narrative engine, check system, accessibility
- Phase 2 (Weeks 4–6): Core loop — scene rendering, choice panel, dice, feedback, status bars, clue discovery, hints
- Phase 3 (Weeks 7–9): Evidence board & NPCs — corkboard UI, connections, deductions, NPC system, journal, gallery
- Phase 4 (Weeks 10–14): Content & polish — case writing, illustrations, sound, save/load, high contrast, playtesting
- Phase 5: Expansion — additional cases, conspiracy arc, achievements, cloud save, localization

---

## Docs vs Code Delta

| Topic | Docs say | Code does |
|---|---|---|
| Starter case | "The Lamplighter's Wake" (design doc §9.4) | "The Whitechapel Cipher" (different case entirely) |
| Persistence | IndexedDB primary, localStorage fallback (Req 11.2, design doc §12.1) | localStorage only. CODE_REVIEW #28 confirms IndexedDB TODO was removed |
| Archetype bonuses | Occultist: +3 Lore, +1 Nerve. Operator: +3 Vigor, +1 Influence. Mesmerist: +3 Influence, +1 Lore (design doc §4.3) | Occultist: +3 Lore, +1 Perception. Operator: +3 Vigor, +1 Nerve. Mesmerist: +3 Influence, +1 Nerve (code + AGENTS.md) |
| `GameProvider` component | Design doc shows `<GameProvider>` wrapping the app | No provider — Zustand store is a module-level singleton |
| `colorblindMode` setting | Design doc includes it in `GameSettings` | Not in code's `GameSettings` type |
| SaveManager API | Design doc shows async `Promise<void>` returns | Code is synchronous (localStorage) |
| Load game completeness | Req 11.7: "restore the complete game state and resume at the saved Scene_Node" | `loadGame` doesn't restore `caseData` — game screen is blank after load |
| Clue discovery card | Req 6.3: slide-in card with type icon, title, summary, auto-dismiss after 4s | Stub component, never wired with props |
| Runtime validation | Req 17.3–17.5: validate "WHEN a JSON content file is loaded" | `validateContent` exists but is never called at runtime |
| Rival faction decrease | Req 19.3: helping a rival decreases opposing faction rep | Not implemented — only direct reputation adjustments and NPC propagation |
| `Choice.outcomes` shape | Design doc shows optional fields (`partial?`, `critical?`, `fumble?`) | Code uses `Record<OutcomeTier, string>` — all tiers required |
| `Choice.npcEffect` name | Design doc: `npcDispositionEffect` | Code: `npcEffect` |
| Encounter Choice extensions | Not in design doc | Code adds `worseAlternative`, `isEscapePath`, `encounterDamage` on `Choice` |
| `EncounterState`/`EncounterRound` | Not in design doc | Code defines these types for the encounter engine |
| `npcSuspicion` condition type | Not in design doc's `Condition.type` union | Code includes it |
