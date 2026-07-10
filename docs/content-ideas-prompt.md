# Content Ideas Prompt

Use this prompt to generate new case and vignette ideas for Gaslight & Grimoire.

```text
You are helping generate new content ideas for the repo `gaslight-and-grimoire`.

First, read the project context:
- `README.md`
- `docs/Gaslight_&_Grimoire_design.md`
- `docs/content-authoring.md`
- `public/content/manifest.json`
- Existing case/vignette `meta.json` files under `public/content/`

Project summary:
Gaslight & Grimoire is a browser-based Victorian occult detective choose-your-own-adventure game. It blends Sherlock Holmes-style deduction with D&D-style faculty checks, d20 outcomes, clue discovery, an evidence board, key deductions, faction reputation, NPC suspicion/disposition, and slow-burn supernatural escalation.

Existing main cases:
- The Whitechapel Cipher
- The Mayfair Seance
- The Lamplighter's Wake

Existing side vignettes:
- A Matter of Shadows
- The Rationalist's Dilemma
- The Debt of Smoke
- The Unfinished Case

Generate fresh content ideas that complement the existing catalog without duplicating its premises, locations, factions, clue patterns, or supernatural reveals.

Core constraints:
- Preserve the tone: gothic mystery, precise Victorian prose, rational investigation slowly giving way to occult dread.
- Every supernatural element should have a rational shadow: a plausible mundane explanation the player can investigate.
- Do not make the supernatural obvious too early.
- Favor moral ambiguity, unreliable testimony, faction pressure, and deductions over simple monster hunts.
- Ideas should support the game's DISCOVER -> CONNECT -> ACT -> REFLECT loop.
- Each main case should naturally support 3 acts.
- Each vignette should be smaller, focused, and unlockable through a flag, clue, deduction, or faction reputation.
- Include opportunities for all six faculties: Reason, Perception, Nerve, Vigor, Influence, Lore.
- Include clue ideas across types: physical, testimony, occult, deduction, and red herring.
- Do not write JSON yet. This is ideation and design only.

Optional long-running Mythos thread:
- Add an optional cosmic horror thread inspired by early weird fiction and Cthulhu Mythos themes.
- Keep this thread subtle, fragmentary, and deniable.
- The main cases should remain standalone detective mysteries, but may contain faint recurring motifs.
- The side vignettes should carry most of the meta-plot, gradually revealing that several unrelated incidents may be surface effects of a larger, ancient intelligence.
- Do not reveal or name Cthulhu early. Treat the Mythos as a pattern the player deduces, not exposition they are told.
- Avoid simple cultist/monster plots. Favor documents, dreams, maritime relics, astronomical anomalies, impossible architecture, inherited madness, academic suppression, and moral choices about whether knowledge should be destroyed, hidden, or used.
- Use global flags, faction reputation, unlock conditions, recurring NPC memories, and key deductions to let attentive players assemble the thread across vignettes.
- Maintain restraint: imply cosmic horror through evidence, contradiction, missing context, and the limits of human reason.

Output:
1. Generate 10 new content concepts:
   - 6 main case ideas
   - 4 side vignette ideas

For each concept, include:
- Title
- Suggested id slug
- Type: case or vignette
- One-paragraph synopsis
- Central mystery question
- Rational shadow
- Occult truth, suspected occult truth, or Mythos connection
- Primary locations
- Main factions involved
- 3-5 important NPCs
- 5-8 clue ideas, labeled by clue type
- 2-3 key deductions the evidence board could support
- Major branching choice or confrontation
- Faculty emphasis
- Archetype-specific content opportunities
- Possible flags, faction reputation changes, or unlock condition
- Why this adds something new to the current repo

2. After listing all 10 ideas, rank the top 3 by:
- Fit with existing lore
- Mechanical richness
- Narrative freshness
- Ease of implementation in the current content schema

3. For the best-ranked idea, provide a more detailed case pitch:
- Act I, Act II, Act III beats
- Evidence progression
- Suspect web
- Red herring path
- Best ending, compromised ending, and failure ending
- Suggested `meta.json` synopsis and `facultyDistribution`

4. Finally, propose how the optional Mythos thread should be staged across the ideas:
- Which clues or motifs recur
- Which vignettes should carry the strongest signals
- Which main cases should only contain faint echoes
- What global flags or key deductions could track player discovery
- How to keep the thread optional so each case still works on its own
```
