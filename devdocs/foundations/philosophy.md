# Philosophy (Doc-Inferred)

> Derived from: `docs/Gaslight_&_Grimoire_design.md`, `AGENTS.md`, `.kiro/specs/gaslight-and-grimoire/requirements.md`, `.kiro/specs/gaslight-and-grimoire/design.md`

## Stated Design Principles

### Knowledge is power
The design doc (§2.3) calls this the single principle powering the core loop. Clues grant Advantage on checks. Deductions unlock story branches. Acting without evidence is possible but harder. This is the most explicitly stated design principle in the documentation.

### Content is data, logic is code
AGENTS.md: "Two strict domains — never mix them: `content/` — narrative data as JSON, `src/engine/` — game logic." The design doc reinforces this with the JSON scene graph architecture and the content pipeline (§13). Condition and Effect are the only mechanism for content to interact with game state.

### Accessibility is a core requirement
Design doc §11: "Accessibility is a core design requirement, not a post-launch addition." The requirements doc dedicates Req 12 (11 acceptance criteria) to accessibility. The roadmap places accessibility foundation in Phase 1, not Phase 4.

### Supernatural slow burn
Design doc §1.1: Early scenes lean rational, midpoint introduces ambiguity, late scenes confront with undeniable occult. Every supernatural scene should have a "rational shadow." This is a content philosophy, not enforced by code.

### No single faculty gates progress
AGENTS.md: "No single Faculty should gate critical story progress — always provide alternate paths." Req 10.3: "at least two Faculty-based approaches so that no single Faculty is required." Design doc §4.2: "No hard locks."

### Choices have meaningful consequences
AGENTS.md: "Choices must have meaningful consequences; avoid cosmetic-only branching." Design doc §9.2 defines "meaningful divergence criteria" — a branch must meet at least 2 of 5 criteria (different clues, different NPCs, faction rep change, altered Act III options, persistent flag).

### Narrative tone: measured, atmospheric, never campy
AGENTS.md states this directly. Design doc §1: "precise, evocative, with moments of dread." Writing guidelines (§13.2): "100–200 words per scene node. Dense, atmospheric, present-tense. Second person."

### Outcomes are narrative, not binary
Design doc §5.1: "A failed check doesn't mean 'nothing happens' — it means something happens differently." Five outcome tiers (critical, success, partial, failure, fumble) each lead to different scenes, not just pass/fail.

## Stated Architectural Decisions

### Zustand over Redux
Design doc §12.2: "Lighter boilerplate, built-in Immer support, simpler selective subscriptions."

### Normalized flat state
Design doc §12.2: "Rather than deeply nested objects, the store uses flat, ID-keyed maps." Prevents performance degradation as content scales.

### Store slicing by domain
Design doc §12.2: "Components subscribe only to needed data, preventing cascade re-renders." Six slices: investigator, narrative, evidence, NPC, world, meta.

### JSON scene graph (not hardcoded)
Design doc: "Content authoring is decoupled from game code; cases can be added without code changes."

### Versioned save files
Design doc §12.2: "Forward-compatible migrations as the data model evolves."

### IndexedDB primary, localStorage fallback
Design doc §12.1, §12.2, Req 11.2. Rationale: "IndexedDB handles larger save files; localStorage provides a safety net."

### Custom dice engine module
Design doc: "Encapsulates d20 logic, Advantage/Disadvantage, dynamic difficulty — testable in isolation."

### Framer Motion for animation
Design doc §12.1 lists "Framer Motion or CSS animations." AGENTS.md confirms Framer Motion is the choice.

### Howler.js for audio
Design doc §12.1 lists "Howler.js or Web Audio API." AGENTS.md confirms Howler.js.

## Content Authoring Philosophy (from docs)

- Scene text: 100–200 words, dense, atmospheric, present-tense, second person
- Choice text: 10–25 words, clear about action and faculty
- Clue descriptions: 1–3 sentences, factual but evocative, written as investigator's notes
- Deduction text: investigator's inner monologue
- Each NPC should have a distinct speech pattern and vocabulary
- Faculty balance: minimum check quotas per case (Reason 4–6, Perception 3–5, Nerve 3–5, Vigor 3–4, Influence 3–5, Lore 3–4)
- Multi-angle investigation: every key mystery approachable from at least two distinct angles
- Red herrings have plausible-seeming connections that resolve to failure, not dead ends

## Development Philosophy (from CODE_REVIEW.md)

The CODE_REVIEW.md documents 28 issues found during a full codebase review, all marked as resolved. This implies a development process where:
- Code was written first (possibly AI-generated), then reviewed for correctness
- Issues were categorized by severity (Critical, High, Medium, Low)
- All issues were fixed before the review document was finalized
- The review was thorough — covering broken functionality, logic errors, architecture violations, and polish issues

---

## Docs vs Code Delta

| Principle | Docs say | Code does |
|---|---|---|
| IndexedDB primary | Explicitly stated as an architectural decision with rationale | localStorage only. The IndexedDB TODO was removed per CODE_REVIEW #28 |
| Engine functions are pure | Design doc labels DiceEngine as "pure module, no side effects" | `processChoice`, `applyOnEnterEffects`, `startEncounter`, `processEncounterChoice` all access the store imperatively |
| Content validation at load time | Req 17.3–17.5 require validation when JSON is loaded | `validateContent` exists but is never called at runtime |
| Meaningful divergence criteria | Design doc §9.2 defines 5 criteria for major branches | No code enforces these criteria — they're content authoring guidelines only |
| Supernatural slow burn | Design doc §1.1 describes escalation model | No code enforces pacing — it's a content authoring guideline |
| Faculty balance quotas | Design doc §4.2 specifies minimum checks per faculty per case | No code validates faculty distribution. `meta.json` has `facultyDistribution` but nothing reads it |
| `GameProvider` wrapper | Design doc component hierarchy shows it | Doesn't exist — Zustand is a module-level singleton |
| Colorblind mode | Design doc §11.1 and `GameSettings` include `colorblindMode` | Not in code's `GameSettings` type, no implementation |
