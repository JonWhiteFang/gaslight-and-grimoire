# Gaslight & Grimoire
### A Sherlock Holmes × Dungeons & Dragons Choose Your Own Adventure

---

## 1. Concept Overview

**Gaslight & Grimoire** is a browser-based choose-your-own-adventure game set in a dark, fog-drenched Victorian London where magic simmers beneath the rational world. Players take on the role of an investigator navigating branching mysteries — gathering clues, interrogating suspects, making deductions, and surviving encounters with threats both mundane and supernatural. The game blends Holmesian deductive reasoning with D&D-style stat checks and dice mechanics, wrapped in rich atmospheric storytelling.

**Tone:** Gothic mystery. Think gaslit alleyways, occult conspiracies, unreliable witnesses, moral grey areas, and the creeping realization that the world is stranger than reason allows. The writing should feel like Arthur Conan Doyle filtered through a dark fantasy lens — precise, evocative, with moments of dread.

**Core Fantasy:** You are the only person in London clever enough — and perhaps reckless enough — to follow the trail of clues into the dark places where logic and the supernatural collide.

### 1.1 Supernatural Pacing Philosophy

The game's tone depends on carefully managing the introduction of supernatural elements. The design follows a **"slow burn" escalation model**:

- **Early scenes** in any case lean heavily on rational investigation — forensic details, witness interviews, logical puzzles. The world feels grounded.
- **Midpoint scenes** introduce ambiguity — clues that *could* be supernatural but might have rational explanations. The player's uncertainty mirrors the investigator's.
- **Late scenes** confront the player with undeniable occult elements — but by then, the rational framework has built enough investment that the supernatural feels earned rather than arbitrary.
- **Across cases**, the Veil thins gradually. Case 1 might feature a single supernatural element. By Case 3, the occult is woven throughout — but it should never fully replace the deductive core.

**Guideline for writers:** Every supernatural scene should have a "rational shadow" — a possible mundane explanation that the player must weigh. Even when the truth is clearly occult, the investigator's internal tension between reason and the impossible is what drives the atmosphere.

---

## 2. Core Gameplay Loop

The core gameplay loop is the engine that drives every session. Each phase should feel distinct, rewarding, and tightly paced to maintain engagement.

### 2.1 The Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │ DISCOVER │───▶│ CONNECT  │───▶│   ACT    │             │
│   │          │    │          │    │          │             │
│   │ Explore  │    │ Evidence │    │ Confront │             │
│   │ scenes,  │    │ Board:   │    │ choices  │             │
│   │ gather   │    │ link     │    │ informed │             │
│   │ clues,   │    │ clues,   │    │ by your  │             │
│   │ question │    │ form     │    │ evidence │             │
│   │ NPCs     │    │ deduc-   │    │ & dedu-  │             │
│   │          │    │ tions    │    │ ctions   │             │
│   └──────────┘    └──────────┘    └──────────┘             │
│        ▲                               │                    │
│        │         ┌──────────┐          │                    │
│        └─────────│ REFLECT  │◀─────────┘                    │
│                  │          │                                │
│                  │ Outcomes │                                │
│                  │ reshape  │                                │
│                  │ the case │                                │
│                  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**DISCOVER → CONNECT → ACT → REFLECT**

1. **DISCOVER** — Explore scenes, gather clues, question NPCs, and survive encounters. This is where Perception, Influence, and Lore shine. The player is building their arsenal of information.
2. **CONNECT** — Return to the Evidence Board. Link clues, form Deductions, and build a theory. This is the cerebral heart of the game — the "Sherlock moment." Reason checks determine whether connections hold.
3. **ACT** — Armed with Deductions (or lacking them), the player faces a pivotal choice: a confrontation, a critical decision, or a dangerous encounter. Clues and Deductions grant Advantage here, rewarding thorough investigation.
4. **REFLECT** — Outcomes ripple forward. New leads emerge, NPCs react, factions shift, and the case evolves. The player is pulled back into DISCOVER with new context.

### 2.2 Pacing Targets

Each phase has a target duration to prevent any single phase from overstaying its welcome:

| Phase | Target Duration | Scenes | Risk if Too Long |
|---|---|---|---|
| **DISCOVER** | 10–20 min | 3–5 scenes | Feels like a fetch quest |
| **CONNECT** | 3–5 min | Evidence Board session | Becomes a puzzle game, loses narrative momentum |
| **ACT** | 5–10 min | 1–2 scenes | Tension deflates if drawn out |
| **REFLECT** | 2–3 min | 1 scene (transition) | Becomes exposition dump |

The loop repeats **2–3 times per case**, with each iteration raising the stakes. Act I is a single DISCOVER→CONNECT. Act II runs the full loop 1–2 times. Act III is a compressed ACT→REFLECT that pays off everything accumulated.

### 2.3 The Incentive Engine

The core loop is powered by a single design principle: **knowledge is power.**

- Clues grant **Advantage** on related checks → discovery is directly rewarded with mechanical benefit
- Deductions unlock **new story branches** and **dialogue options** → connecting the dots opens doors that are literally closed otherwise
- Acting without sufficient evidence is always *possible* but **harder and riskier** → the game never blocks progress, but it rewards preparation
- Reflecting on outcomes reveals **what you missed** (subtly, through narrative implication) → the player is motivated to explore more thoroughly on the next cycle

---

## 3. Setting & World

### 3.1 The World: Shrouded London, 1893

London, but not quite as history remembers it. The surface world operates as expected — Scotland Yard, hansom cabs, the British Empire in full bloom. But beneath that veneer:

- **The Veil** — A metaphysical boundary separating the mundane world from the occult. It's thinning. Strange events are increasing. Most people rationalize them away.
- **The Fog** — London's infamous fog is partially supernatural in origin. It thickens around sites of magical activity and sometimes carries whispers.
- **Factions** — Several organizations vie for control of occult knowledge:
  - **The Rationalists' Circle** — Scientists and skeptics who believe all phenomena can be explained. Some are right. Some are dangerously wrong.
  - **The Hermetic Order of the Grey Dawn** — Occultists and alchemists who study the Veil. Morally ambiguous — they seek knowledge at any cost.
  - **The Lamplighters** — A secret society within Scotland Yard that quietly handles supernatural cases. Underfunded and overwhelmed.
  - **The Court of Smoke** — London's criminal underworld, which has begun trafficking in magical artifacts and substances.

### 3.2 Key Locations

| Location | Description | Mood |
|---|---|---|
| **Blackmoor Row** | The player's home base — a cramped office above an apothecary, cluttered with case files, specimen jars, and a well-worn chalkboard for mapping deductions. | Intimate, cerebral |
| **The Whispering Gallery** | A hidden market beneath Covent Garden where occult goods are traded. Entry requires a token or a favor. | Dangerous, wondrous |
| **Ravenscroft Asylum** | An institution on the Thames where those who've seen too much of the Veil are locked away. Some patients know vital secrets. | Oppressive, tragic |
| **The Gasworks** | An industrial district where alchemical experiments have tainted the air. Workers report hallucinations — or are they? | Toxic, eerie |
| **St. Sepulchre's Crypt** | An ancient church crypt that serves as neutral ground between factions. Information is exchanged here — for a price. | Solemn, tense |

---

## 4. Character System

### 4.1 Attributes (The Six Faculties)

Rather than D&D's classic six stats, the game uses six faculties tailored to investigation and survival. Each starts at a base value (8) and players distribute 12 bonus points during character creation.

| Faculty | Governs | Example Checks |
|---|---|---|
| **Reason** | Logic, deduction, pattern recognition | Connecting clues, seeing through lies, solving puzzles |
| **Perception** | Awareness, senses, noticing details | Spotting hidden clues, detecting ambushes, reading body language |
| **Nerve** | Courage, composure, willpower | Resisting fear/intimidation, staying calm under pressure, confronting the occult |
| **Vigor** | Physical fitness, endurance, reflexes | Chases, fights, resisting poison or injury |
| **Influence** | Charisma, persuasion, social maneuvering | Interrogation, bluffing, negotiating, gaining trust |
| **Lore** | Knowledge of the occult, history, science | Identifying artifacts, understanding rituals, recalling obscure facts |

### 4.2 Faculty Balance Design

To ensure all six Faculties remain viable and no single Faculty dominates, the game enforces balance at the content level:

**Per-scene check distribution:** Every case must use all six Faculties across its scenes. The authoring guidelines enforce a **minimum check quota** per case:

| Faculty | Min. Checks per Case | Design Rationale |
|---|---|---|
| Reason | 4–6 | Core to deduction, but shouldn't be the answer to everything |
| Perception | 3–5 | Primary clue discovery faculty |
| Nerve | 3–5 | Supernatural encounters and high-pressure moments |
| Vigor | 3–4 | Physical encounters, chases, environmental hazards |
| Influence | 3–5 | Social encounters, interrogation, negotiation |
| Lore | 3–4 | Occult clues, artifact identification, ritual knowledge |

**Dynamic difficulty scaling:** Check DCs adjust based on the player's Faculty distribution to keep challenges meaningful without punishing specialization:

- If a player's Faculty modifier is +3 or higher, related checks trend toward **Hard (DC 16)** — the game respects their expertise by presenting tougher but more rewarding challenges.
- If a player's Faculty modifier is +0 or lower, related checks offer **alternative approaches** — a Vigor-weak player might see a Perception option to avoid a physical confrontation entirely.
- **No hard locks:** No critical path should require a single specific Faculty. There must always be at least two Faculty-based approaches to any mandatory scene.

**Archetype-exclusive content:** Each archetype has 2–3 scenes per case that *only they* can access (via their unique ability or Faculty thresholds). This ensures that replaying as a different archetype reveals genuinely new content, not just different numbers on the same checks.

### 4.3 Investigator Archetypes

Players choose an archetype that provides starting bonuses, a unique ability, and flavor. These are not rigid classes — they're starting points.

**The Deductionist**
- Bonus: +3 Reason, +1 Perception
- Ability: *"Elementary"* — Once per case, automatically succeed on a Reason check to connect two clues.
- Style: The classic rational detective. Sees the world as a puzzle.

**The Occultist**
- Bonus: +3 Lore, +1 Nerve
- Ability: *"Veil Sight"* — Once per case, peer through the Veil to reveal hidden supernatural elements in a scene.
- Style: A scholar of forbidden knowledge. Knows things others wish they didn't.

**The Operator**
- Bonus: +3 Vigor, +1 Influence
- Ability: *"Street Survivor"* — Once per case, automatically succeed on a Vigor check to escape a dangerous situation.
- Style: An ex-soldier, former criminal, or dock worker. Handles the physical side of investigation.

**The Mesmerist**
- Bonus: +3 Influence, +1 Lore
- Ability: *"Silver Tongue"* — Once per case, automatically succeed on an Influence check during interrogation or negotiation.
- Style: A charming manipulator. Extracts confessions and secrets with uncanny ease.

### 4.4 Conditions & Status

Rather than HP, the game tracks two status bars:

- **Composure** (0–10): Mental/emotional stability. Lost through fear, occult exposure, moral compromise, and stress. At 0, the investigator suffers a **Breakdown** (forced narrative consequence — bad decision, hallucination, or panic).
- **Vitality** (0–10): Physical health. Lost through combat, poison, exhaustion, and environmental hazards. At 0, the investigator is **Incapacitated** (captured, hospitalized, or worse).

Both can be restored through narrative events: resting at Blackmoor Row, visiting an ally, finding a moment of clarity.

---

## 5. Core Mechanics

### 5.1 The Check System (d20-Based)

When a player makes a choice that involves risk or uncertainty, the game performs a **Faculty Check**:

```
Roll = d20 + Faculty Modifier
Faculty Modifier = (Faculty Score - 10) / 2, rounded down
```

| Difficulty | Target Number | When Used |
|---|---|---|
| Routine | 8 | Low-stakes, most players pass |
| Moderate | 12 | Standard challenge |
| Hard | 16 | Significant obstacle |
| Formidable | 20 | Near the edge of human ability |
| Supernatural | 24+ | Beyond normal limits — requires high stats or bonuses |

**Outcomes are narrative, not binary.** A failed check doesn't mean "nothing happens" — it means something happens *differently*:

- **Success:** You get what you wanted, possibly with a bonus detail.
- **Partial Success (within 2 of target):** You get part of what you wanted, but with a complication or cost.
- **Failure:** You don't get what you wanted, and the situation shifts — a new threat, a lost opportunity, or a wrong conclusion.
- **Critical Success (natural 20):** Exceptional outcome — extra clue, dramatic narrative moment, or avoided danger.
- **Critical Failure (natural 1):** Something goes very wrong — Composure or Vitality loss, false lead accepted, or enemy alerted.

### 5.2 Dice Visualization

The d20 roll should be a satisfying UI moment. When a check is triggered:

1. The narrative pauses with a brief description of the stakes ("You study the victim's handwriting, searching for inconsistencies...")
2. An animated d20 rolls across the screen
3. The result is displayed with the modifier and outcome tier
4. The narrative continues based on the result

### 5.3 Advantage & Disadvantage

Borrowed directly from D&D 5e:

- **Advantage** (roll 2d20, take the higher): Granted by relevant clues, preparation, or allies.
- **Disadvantage** (roll 2d20, take the lower): Applied when injured, stressed, unprepared, or in hostile conditions.

Key design principle: **Clues grant Advantage.** If a player has collected a relevant clue before attempting a check, they roll with Advantage. This creates a powerful incentive loop — explore thoroughly, gather evidence, then act from a position of strength.

---

## 6. Clue & Evidence System

This is the heart of the game — the system that marries the Sherlock Holmes fantasy with the branching adventure structure.

### 6.1 Clue Types

| Type | Icon | Description | Mechanical Effect |
|---|---|---|---|
| **Physical Evidence** | 🔍 | Objects, documents, substances found at scenes | Grants Advantage on related Reason/Perception checks |
| **Testimony** | 💬 | Statements from witnesses, suspects, allies | Grants Advantage on related Influence/Reason checks |
| **Occult Fragment** | 🌑 | Supernatural clues — auras, residues, symbols | Grants Advantage on Lore checks; may cost Composure to acquire |
| **Deduction** | 🧠 | Player-created connections between 2+ clues | Unlocks new story branches or dialogue options |
| **Red Herring** | ❓ | Misleading evidence (player doesn't know which clues are false until deduction phase) | May grant Disadvantage if acted upon |

### 6.2 The Evidence Board

A persistent UI element accessible at any time — a virtual corkboard at the player's Blackmoor Row office. It displays:

- All collected clues (as pinned cards with short descriptions)
- **Connection threads** — players can drag lines between clues they believe are related
- When two or more clues are correctly connected, a **Deduction** is formed (with a Reason check)
- Deductions unlock new narrative branches, dialogue options, or confrontation scenes
- Incorrect connections are possible and can lead the player down wrong paths (with consequences)

#### 6.2.1 Clue Status Tracking

The Evidence Board provides clear visual feedback on each clue's state to help players track their progress without breaking immersion:

| Status | Visual Treatment | Meaning |
|---|---|---|
| **New** | Pulsing amber glow, "NEW" badge | Just discovered, not yet examined |
| **Examined** | Standard card appearance | Player has read the clue details |
| **Connected** | Gold thread linking to partner clue(s) | Part of an attempted connection |
| **Deduced** | Locked in place with a brass pin, green glow | Successfully formed a Deduction — permanent |
| **Contested** | Red thread (slack), faint question mark | Failed Deduction attempt — connection didn't hold |
| **Spent** | Subtle grey-out, checkmark | Clue has been used in a successful Deduction and has no further connections |

**Progress indicators:** The Evidence Board header shows a summary bar: `Clues: 7/12 discovered · Deductions: 2/5 formed`. The denominator is hidden until the case is complete (to avoid spoiling how many clues exist), replaced with `?` during active play: `Clues: 7/? · Deductions: 2/?`. This gives a sense of progress without revealing the full scope.

**Connection guidance:** When a player drags a thread from one clue, clues that share at least one tag (location, person, substance, etc.) subtly brighten, providing a gentle nudge without revealing the answer. Clues with no valid connections to the selected clue remain unchanged — no negative feedback, just the absence of positive feedback.

### 6.3 Clue Discovery

Clues are found through:

- **Exploration choices** ("Search the desk" / "Examine the body" / "Check the alleyway")
- **Successful checks** (Perception to notice a hidden detail, Lore to recognize a symbol)
- **Dialogue** (asking the right questions during interrogation — Influence checks may be needed for reluctant witnesses)
- **Automatic discovery** (some clues are given freely to establish the narrative baseline)

**Hidden clue rule:** Some scenes contain clues that are only discoverable with specific Faculty scores or prior Deductions. The player is never told they missed something — they simply don't encounter it. This encourages replayability and rewards different character builds.

---

## 7. Combat & Encounters

Combat in Gaslight & Grimoire is **narrative and compact** — not tactical grid combat. It's designed to feel dangerous and consequential, not routine.

### 7.1 Encounter Structure

An encounter plays out over **2–4 rounds**, each offering choices:

```
ROUND STRUCTURE:
1. Situation Description (narrative text setting the scene)
2. Player Choice (2-4 options, each tied to a Faculty)
3. Check Resolution (roll + outcome)
4. Consequence (narrative continues, status may change)
→ Repeat or resolve
```

**Example encounter:**

> *A figure in a long coat blocks the alleyway, a blade glinting in the gaslight. Behind you, footsteps echo — a second assailant.*

- **[Vigor]** Charge the figure ahead before the one behind closes in.
- **[Perception]** Scan for an escape route — a door, a low wall, a drainpipe.
- **[Influence]** Call out: "I know who sent you. I can make this worth your while."
- **[Nerve]** Stand your ground and wait — force them to make the first move.

Each option leads to a different roll, a different narrative outcome, and potentially different clue discoveries (the attackers might drop something, or a bystander might witness the event).

### 7.2 Injury & Defeat

- Taking hits reduces **Vitality**
- At Vitality 0, the player is **Incapacitated** — not killed (death is rare and reserved for truly catastrophic decisions)
- Incapacitation triggers a **rescue scene** (an ally intervenes, or the player wakes up elsewhere having lost time and possibly clues)
- Some encounters can be **avoided entirely** through prior clue gathering or smart choices

### 7.3 Supernatural Encounters

Encounters with occult threats operate under heightened rules that introduce **reactive timing pressure** and dual-axis risk (Composure *and* Vitality simultaneously):

#### Supernatural Threat Mechanics

When facing occult creatures, manifestations, or Veil phenomena, the encounter gains additional mechanics:

**Reaction Phase:** Before the standard choice panel appears, the player faces a **snap reaction** — a single rapid-fire Faculty check that sets the conditions for the rest of the encounter:

```
SUPERNATURAL ENCOUNTER STRUCTURE:
1. Manifestation Description (disturbing, atmospheric)
2. ⚡ REACTION CHECK — Nerve (to resist panic) or Lore (to recognize the threat)
   → Success: Composure holds, player acts with full options
   → Failure: Lose 1-2 Composure, one choice is removed or replaced with a worse option
3. Standard choice round(s) — but with Composure-draining consequences
4. Resolution — with lasting narrative effects
```

**Dual-axis damage:** Supernatural encounters threaten *both* Composure and Vitality simultaneously. A spectral attacker might deal Vitality damage while the sheer wrongness of its existence drains Composure. This makes supernatural threats distinctly more dangerous than mundane ones.

**Occult resistance options:** Players can mitigate supernatural damage through knowledge:
- **Lore checks** can identify a creature's weakness or nature, reducing Composure loss ("You recognize the sigil — it's a binding ward, not a threat")
- **Nerve checks** resist panic and maintain combat effectiveness
- **Specific clues** (Occult Fragments collected earlier) can grant Advantage or even provide unique resolution options unavailable to uninformed players

**Example supernatural encounter:**

> *The gaslight dies. In the darkness, something breathes — wet, labored, wrong. When the light returns, the corpse on the slab is sitting upright, its mouth working soundlessly.*

- ⚡ **[Nerve DC 14]** Reaction: Hold your ground and observe. *Failure: Lose 2 Composure, the "Examine the markings" option is replaced with "Flee."*
- **[Lore]** Examine the reanimation markings on its wrists — this is a binding, not a resurrection.
- **[Vigor]** Restrain it before it can act — pin the arms, check for concealed threats.
- **[Influence]** Speak to it — if the binding is incomplete, the original consciousness may still be present.
- **[Flee]** *(only appears on failed Reaction)* Back away and seal the room. You'll lose access to whatever it knows.

### 7.4 Encounter Variety by Type

| Type | Primary Risk | Faculty Focus | Frequency per Case |
|---|---|---|---|
| **Street Violence** | Vitality | Vigor, Perception | 1–2 |
| **Social Confrontation** | Influence/information | Influence, Reason | 2–3 |
| **Supernatural Manifestation** | Composure + Vitality | Nerve, Lore | 1–2 |
| **Environmental Hazard** | Vitality | Perception, Vigor | 1 |
| **Psychological Pressure** | Composure | Nerve, Reason | 1–2 |

---

## 8. NPC System

### 8.1 NPC Relationship Model

NPCs are not static quest-givers — they are dynamic agents with their own agendas, suspicions, and loyalties. Each named NPC tracks a **Disposition** value that shifts based on the player's actions.

```typescript
interface NPC {
  id: string;
  name: string;
  faction: Faction | null;
  portrait: string;
  disposition: number;           // -10 (hostile) to +10 (devoted)
  suspicion: number;             // 0 (oblivious) to 10 (fully aware of player's activities)
  knownClues: string[];          // clue IDs this NPC can provide
  dispositionThresholds: {
    hostile: number;             // below this, NPC actively works against player
    wary: number;                // below this, NPC withholds information
    neutral: number;             // default starting point
    friendly: number;            // above this, NPC volunteers information
    devoted: number;             // above this, NPC takes risks for the player
  };
  memoryFlags: Record<string, boolean>;  // tracks what the NPC knows the player has done
}
```

### 8.2 Disposition Shifts

NPC Disposition changes based on:

- **Dialogue choices** — Respectful vs. aggressive interrogation, truthful vs. deceptive responses
- **Faction alignment** — Helping a faction's rival lowers Disposition of that faction's NPCs
- **Witnessed actions** — If an NPC is present (or hears about) the player's actions, their Disposition shifts accordingly
- **Case outcomes** — Resolving a case in a way that benefits or harms an NPC's interests
- **Cross-case persistence** — An NPC betrayed in Case 1 remembers in Case 3

### 8.3 Suspicion Mechanic

NPCs have a **Suspicion** value that tracks how aware they are of the player's investigation. High Suspicion triggers behavioral changes:

| Suspicion Level | NPC Behavior |
|---|---|
| 0–2 (Oblivious) | Normal behavior, open to conversation |
| 3–5 (Cautious) | Evasive answers, may require Influence checks to share information |
| 6–8 (Alarmed) | Actively conceals information, may warn other NPCs or factions |
| 9–10 (Hostile) | May set traps, flee, destroy evidence, or confront the player directly |

Suspicion rises when the player asks probing questions, is seen at incriminating locations, or fails Influence checks during interrogation. It can be lowered by misdirection, building trust over time, or leveraging other NPCs to vouch for you.

### 8.4 NPC Memory & Cross-Case Continuity

Named NPCs persist across cases. Their Disposition, Suspicion, and memory flags carry forward:

- An informant you treated fairly in Case 1 may volunteer critical information in Case 3 without a check.
- A suspect you wrongly accused may refuse to cooperate — or may seek revenge.
- Faction-aligned NPCs share information; alienating one Lamplighter may cool your relationship with all of them.

**NPC death & removal:** Some NPCs can be permanently removed from the game through player choices or case outcomes. Their absence is felt in future cases — a missing contact means a missing source of clues, forcing the player to find alternative approaches.

---

## 9. Narrative Structure

### 9.1 Case Format

The game is structured as a series of **Cases** (self-contained mysteries that connect to an overarching conspiracy). Each case follows this arc:

```
ACT I — THE SCENE
├── Crime/incident is presented
├── Initial clue gathering (2-3 automatic clues)
├── First major choice: where to investigate first
│
ACT II — THE WEB
├── 3-5 investigation scenes (branching, non-linear)
├── Clue collection and Evidence Board work
├── Encounters (social, physical, supernatural)
├── Midpoint revelation (a Deduction that reframes the case)
│
ACT III — THE RECKONING
├── Confrontation scene (informed by collected evidence)
├── Deduction challenge (present your theory — Reason check)
├── Final choice (moral/ethical dilemma)
└── Resolution & consequences that carry forward
```

### 9.2 Branching Philosophy

The branching structure follows a **"wide river"** model rather than a strict tree:

- Multiple paths through each act, but they converge at key narrative beats
- Player choices determine *how* they reach each beat, *what they know* when they get there, and *what options are available*
- A player who missed key clues might face a confrontation without Advantage — making it harder but not impossible
- Major choices create **persistent flags** that affect future cases (faction reputation, NPC relationships, unresolved threads)

**Multi-angle investigation:** Every key mystery in a case can be approached from at least **two distinct investigative angles** — for example, a forensic/rational path and a social/underworld path. Both can reach the truth, but they uncover different clues and encounter different NPCs. This ensures that player choices and archetype builds lead to genuinely different experiences, not just cosmetic variations.

**Meaningful divergence criteria:** A choice qualifies as a "major branch" only if it meets at least two of:
- Reveals different clues than the alternative path
- Introduces or deepens a relationship with a different NPC
- Changes the player's faction reputation
- Alters the available options in the Act III confrontation
- Creates a persistent flag that affects future cases

### 9.3 Case Variety & Side Cases

#### Main Cases
Standard 45–90 minute investigations following the full three-act structure. These advance the overarching conspiracy and introduce new factions, NPCs, and locations.

#### Side Cases (Vignettes)
Shorter 15–30 minute optional mysteries that expand the world and deepen specific storylines. Side cases are unlocked by:
- **Faction reputation** — reaching a threshold with a faction opens a case specific to their concerns
- **NPC relationships** — an NPC with high Disposition may bring a personal problem to the player
- **Unresolved threads** — loose ends from main cases can spawn side investigations
- **Exploration** — visiting certain locations between cases may trigger Vignettes

| Type | Length | Trigger | Reward |
|---|---|---|---|
| **Faction Vignette** | 15–20 min | Faction reputation threshold | Faction-exclusive clues, NPC contacts, unique items |
| **NPC Personal Case** | 20–30 min | NPC Disposition ≥ 7 | Deepened relationship, NPC becomes a reliable ally |
| **Cold Case** | 15–20 min | Unresolved thread from prior case | Retroactive clue that recontextualizes earlier events |
| **Location Mystery** | 10–15 min | Visiting a location between cases | World-building lore, Composure/Vitality restoration |

Side cases use a simplified two-act structure (DISCOVER → ACT) and typically feature 10–20 scene nodes, 4–6 clues, and 1–2 encounters.

#### Dynamic Case Variation
To ensure replayability across playthroughs, main cases include **variant scenes** — scenes that swap in or out based on persistent flags from prior cases. For example:

- If the player allied with the Grey Dawn in Case 1, Case 2 might include a scene where a Grey Dawn contact provides early access to occult information — but at the cost of raising Lamplighter Suspicion.
- If an NPC was killed or alienated in a prior case, their scenes are replaced with alternatives featuring different NPCs or approaches.

This ensures that even the same case feels different on a second playthrough with different prior choices.

### 9.4 Starter Case: "The Lamplighter's Wake"

**Hook:** A Lamplighter agent is found dead in a locked room in Whitechapel. Scotland Yard calls it suicide. The Lamplighters suspect otherwise and hire the player discreetly.

**Core mystery:** The agent was investigating a series of disappearances near the Gasworks. He discovered something — but what? His case notes are missing. His body shows signs of both poisoning and occult ritual.

**Themes:** Introduction to the world, the Veil, faction politics. Establishes the player's relationship with the Lamplighters and introduces the Court of Smoke as antagonists.

**Key branches:**
- Investigate the Gasworks (Vigor/Perception heavy — physical danger, environmental clues)
- Question the agent's contacts (Influence/Reason heavy — social encounters, testimony gathering)
- Research the ritual markings (Lore/Nerve heavy — occult investigation, Composure risk)

**Final confrontation** changes dramatically based on which branches were explored and what Deductions were formed.

---

## 10. UI/UX Design

### 10.1 Layout

```
┌──────────────────────────────────────────────────┐
│  HEADER BAR                                      │
│  [Case Title]              [Evidence Board] [Menu]│
├──────────────────────────────────────────────────┤
│                                                  │
│              NARRATIVE PANEL                      │
│                                                  │
│  Atmospheric text with scene description,        │
│  dialogue, and events. Text appears with a       │
│  typewriter effect for key reveals.              │
│                                                  │
│  Inline illustrations: scene art, character      │
│  portraits, clue images.                         │
│                                                  │
├──────────────────────────────────────────────────┤
│  STATUS BAR                                      │
│  Composure: ██████████░░  Vitality: ████████████ │
│  [Investigator Name] — [Archetype]               │
├──────────────────────────────────────────────────┤
│  CHOICE PANEL                                    │
│                                                  │
│  ┌─────────────────────┐ ┌─────────────────────┐ │
│  │ [Vigor] Force the   │ │ [Perception] Search │ │
│  │ door open            │ │ for another way in  │ │
│  └─────────────────────┘ └─────────────────────┘ │
│  ┌─────────────────────┐ ┌─────────────────────┐ │
│  │ [Influence] Bluff   │ │ [Lore] Examine the  │ │
│  │ the guard            │ │ ward on the lock    │ │
│  └─────────────────────┘ └─────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 10.2 Visual Style

- **Color palette:** Deep burgundy, aged parchment, brass gold, fog grey, midnight blue
- **Typography:** Serif fonts for narrative text (evoking Victorian print), clean sans-serif for UI elements
- **Atmosphere effects:** Subtle fog/particle overlay on the narrative panel, candlelight flicker on the Evidence Board
- **Dice UI:** A satisfying 3D d20 roll animation with sound, showing the die landing and the number resolving

### 10.3 Outcome Feedback System

Every player action that produces a mechanical result communicates its impact through a consistent, layered feedback system. The goal is clarity without breaking immersion.

#### Choice Outcome Indicators

After a Faculty Check resolves, the narrative panel briefly displays a **result banner** before the story continues:

| Outcome | Banner Color | Icon | Animation |
|---|---|---|---|
| **Critical Success** | Gold | ★ | Expanding burst, brief screen shimmer |
| **Success** | Warm amber | ✓ | Smooth fade-in |
| **Partial Success** | Muted amber | ⚠ | Slight flicker |
| **Failure** | Dull crimson | ✗ | Brief screen darken |
| **Critical Failure** | Deep red | ☠ | Screen shake, candle flicker |

The banner appears for **2 seconds** and fades, never interrupting reading flow. It sits *above* the narrative text, not overlaid on it.

#### Status Change Feedback

When Composure or Vitality changes, the status bar provides immediate visual feedback:

- **Loss:** The affected bar pulses red and decreases with a smooth animation. A brief descriptor appears next to the bar ("Shaken", "Bruised", "Rattled") for 3 seconds.
- **Gain:** The bar pulses warm gold and increases. Descriptor: "Steadied", "Mended", "Restored."
- **Critical threshold (≤ 2):** The bar shifts to a pulsing red, and the investigator's portrait (if shown) subtly changes to reflect their state.
- **Zero:** Full-screen vignette darkens briefly. "BREAKDOWN" or "INCAPACITATED" appears in the narrative panel as a story beat.

#### Clue Discovery Feedback

When a clue is found, a **clue card** slides in from the right side of the narrative panel:
- Card shows the clue type icon, title, and a one-line summary
- A subtle chime plays (different tone per clue type)
- The Evidence Board icon in the header pulses to indicate new content
- Card auto-dismisses after 4 seconds or on click

#### Choice Telegraphing

Before a player selects a choice, the UI communicates difficulty and preparation:

- **Faculty tag** on each choice card is color-coded to the player's proficiency: green (modifier ≥ +2), amber (0 to +1), red (≤ -1)
- If the player holds a relevant clue, a small 🔍 icon appears on the choice card with a tooltip: "You have relevant evidence — Advantage"
- Choices that are **unlocked by a Deduction or clue** have a subtle key icon, signaling that preparation opened this option

### 10.4 Evidence Board (Overlay/Panel)

- Opens as a full-screen overlay or slide-out panel
- Cork board texture background
- Clue cards are pinnable, draggable, with type icons and status indicators (see §6.2.1)
- Red string connections between clues (drag from one card to another)
- "Attempt Deduction" button when 2+ clues are connected — triggers a Reason check
- Successful Deductions glow and are pinned permanently
- Failed Deductions show the string going slack (visual feedback) but the clues remain
- Progress summary bar at the top (see §6.2.1)
- Subtle tag-based highlighting when dragging connections (see §6.2.1)

### 10.5 Sound Design Notes

- Ambient: rain, distant church bells, creaking wood, muffled street noise
- Dice: satisfying clatter and landing thud
- Clue discovered: a subtle "revelation" chime (distinct per clue type)
- Composure loss: a low, dissonant tone
- Vitality loss: a dull, percussive impact
- Scene transitions: the scratch of a pen on paper
- Supernatural encounters: layered unsettling tones — reversed whispers, low drones

### 10.6 Hint System

For players who feel stuck, a subtle, opt-in hint system is available:

- **Trigger:** If a player revisits the Evidence Board 3+ times without attempting a connection, or spends more than 5 minutes on a single scene without choosing, a small "?" icon fades in on the header bar.
- **Level 1 hint (nudge):** "Perhaps you should revisit [location/NPC name]." — narrative, not mechanical. Feels like the investigator's instinct.
- **Level 2 hint (suggestion):** "The evidence from [clue A] and [clue B] may be related." — points toward a specific connection without confirming it.
- **Level 3 hint (reveal):** Shows the connection directly. Available only after Level 2 has been seen.
- **Opt-out:** Hints can be disabled entirely in Settings ("I prefer to work alone").

Hints never appear unbidden in the narrative — they are always accessed through a deliberate UI action to preserve immersion.

---

## 11. Accessibility

Accessibility is a core design requirement, not a post-launch addition. The following features are planned for Phase 1–3 of development:

### 11.1 Visual Accessibility

- **Font size controls:** Three presets (Standard, Large, Extra Large) plus a custom slider. Affects all narrative text, choice cards, and UI labels.
- **High contrast mode:** Swaps the atmospheric color palette for a high-contrast scheme (light background, dark text, bold borders) while preserving layout.
- **Colorblind support:** All color-coded feedback (outcome banners, status bars, Faculty proficiency indicators) uses secondary indicators (icons, patterns, text labels) so that no information is conveyed by color alone. Choice card Faculty proficiency uses both color AND text ("+2", "0", "-1") rather than color alone.
- **Reduced motion mode:** Disables fog overlays, particle effects, typewriter text animation, dice roll animation (shows result directly), and screen shake effects. Transitions become instant fades.

### 11.2 Audio Accessibility

- **Full subtitles/captions:** All audio cues (chimes, ambient sounds, dice rolls) have visual equivalents. Sound is never the sole carrier of information.
- **Text-to-speech support:** Narrative text and choice cards are structured for screen reader compatibility with proper ARIA labels, roles, and focus management.
- **Volume controls:** Separate sliders for ambient audio, SFX, and music (if added later).

### 11.3 Interaction Accessibility

- **Keyboard navigation:** Full keyboard support for all interactions — choice selection (arrow keys + enter), Evidence Board navigation (tab between clues, spacebar to connect), and menu access.
- **Touch-friendly targets:** All interactive elements meet minimum 44×44px touch target sizes for mobile/tablet play.
- **Reading pace control:** Typewriter effect speed is adjustable, or can be set to "instant" (all text appears immediately).
- **Auto-save frequency:** Configurable from "every choice" to "every scene" to "manual only."

### 11.4 Cognitive Accessibility

- **Case journal:** A persistent, automatically updated summary of the current case's key events, accessible from the menu. Written in simple prose to help players re-orient after breaks.
- **NPC reference:** A character gallery showing all NPCs encountered, their faction, and last known Disposition (described in narrative terms: "Wary of you," "Considers you a friend").
- **Hint system:** See §10.6.

---

## 12. Technical Architecture (React)

### 12.1 High-Level Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | React 18+ | UI rendering, component architecture |
| **State Management** | Zustand (with Immer middleware) | Game state, inventory, flags, character sheet |
| **Styling** | Tailwind CSS + CSS custom properties | Atmospheric theming, responsive layout |
| **Dice Engine** | Custom JS module | d20 rolls, advantage/disadvantage, modifiers |
| **Narrative Engine** | JSON scene graph | Branching story data, conditions, outcomes |
| **Animation** | Framer Motion or CSS animations | Dice rolls, transitions, typewriter effect |
| **Persistence** | localStorage + IndexedDB (fallback) + optional cloud save | Save/load game state |
| **Audio** | Howler.js or Web Audio API | Ambient sound, SFX |
| **Testing** | Vitest + React Testing Library | Unit and integration tests |

### 12.2 State Architecture & Scalability

The game state is designed for scalability as cases, NPCs, and flags accumulate across a growing campaign. The architecture follows these principles:

**Normalized state shape:** Rather than deeply nested objects, the store uses flat, ID-keyed maps for entities that grow over time (clues, NPCs, scenes). This prevents performance degradation as content scales.

```typescript
// ❌ Avoid: deeply nested, hard to update, scales poorly
state.cases.currentCase.acts[1].scenes[3].clues[0].isRevealed = true;

// ✅ Prefer: normalized, flat, efficient lookups
state.clues['clue_042'].isRevealed = true;
```

**Store slicing:** The Zustand store is divided into domain-specific slices that can be independently subscribed to, preventing unnecessary re-renders:

```typescript
// Store slices
interface GameStore {
  // Character slice
  investigator: Investigator;
  updateFaculty: (faculty: string, value: number) => void;
  adjustComposure: (delta: number) => void;
  adjustVitality: (delta: number) => void;

  // Narrative slice
  currentScene: string;
  currentCase: string;
  sceneHistory: string[];
  goToScene: (sceneId: string) => void;

  // Evidence slice
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  discoverClue: (clueId: string) => void;
  attemptDeduction: (clueIds: string[]) => DeductionResult;

  // NPC slice
  npcs: Record<string, NPCState>;
  adjustDisposition: (npcId: string, delta: number) => void;
  adjustSuspicion: (npcId: string, delta: number) => void;

  // World slice
  flags: Record<string, boolean>;
  factionReputation: Record<string, number>;
  setFlag: (flag: string, value: boolean) => void;
  adjustReputation: (faction: string, delta: number) => void;

  // Meta slice
  settings: GameSettings;
  saveGame: () => void;
  loadGame: (saveId: string) => void;
}
```

**Immer middleware:** All state mutations use Immer for immutable updates, ensuring React's change detection works correctly without manual spread operations.

**Selective subscriptions:** Components subscribe only to the slice they need, preventing cascade re-renders:

```typescript
// Only re-renders when composure changes
const composure = useGameStore(state => state.investigator.composure);

// Only re-renders when current scene changes
const sceneId = useGameStore(state => state.currentScene);
```

**Save system design:** Game state is serialized to JSON and stored in IndexedDB (with localStorage as fallback). Save files include a version number for forward-compatible migrations as the data model evolves:

```typescript
interface SaveFile {
  version: number;           // schema version for migrations
  timestamp: string;
  investigator: Investigator;
  currentCase: string;
  currentScene: string;
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  npcs: Record<string, NPCState>;
  flags: Record<string, boolean>;
  factionReputation: Record<string, number>;
  sceneHistory: string[];
  settings: GameSettings;
}
```

### 12.3 Core Data Models

```typescript
// Character
interface Investigator {
  name: string;
  archetype: Archetype;
  faculties: {
    reason: number;
    perception: number;
    nerve: number;
    vigor: number;
    influence: number;
    lore: number;
  };
  composure: number;      // 0-10
  vitality: number;       // 0-10
  abilityUsed: boolean;   // per-case flag for archetype ability
}

// Clue
interface Clue {
  id: string;
  type: 'physical' | 'testimony' | 'occult' | 'deduction' | 'redHerring';
  title: string;
  description: string;
  sceneSource: string;       // which scene it came from
  connectsTo?: string[];     // valid connection targets
  grantsFaculty?: string;    // which faculty gets Advantage
  tags: string[];            // for Evidence Board connection hints (location, person, substance, etc.)
  status: 'new' | 'examined' | 'connected' | 'deduced' | 'contested' | 'spent';
  isRevealed: boolean;
}

// NPC
interface NPCState {
  id: string;
  name: string;
  faction: string | null;
  disposition: number;       // -10 to +10
  suspicion: number;         // 0 to 10
  memoryFlags: Record<string, boolean>;
  isAlive: boolean;
  isAccessible: boolean;     // may be imprisoned, fled, etc.
}

// Scene Node
interface SceneNode {
  id: string;
  act: number;
  narrative: string;         // main text (supports markdown/rich text)
  illustration?: string;     // scene art reference
  ambientAudio?: string;     // ambient audio track reference
  cluesAvailable: ClueDiscovery[];
  choices: Choice[];
  conditions?: Condition[];  // prerequisites to reach this scene
  onEnter?: Effect[];        // status changes on entering the scene
  archetypeExclusive?: Archetype;  // if set, only this archetype can access
  variantOf?: string;        // base scene ID this is a variant of
  variantCondition?: Condition;    // flag/condition that triggers this variant
}

// Choice
interface Choice {
  text: string;
  faculty?: string;          // which faculty is checked (undefined = no check)
  difficulty?: number;       // DC if faculty check required
  dynamicDifficulty?: {      // optional dynamic DC adjustment
    baseDC: number;
    scaleFaculty: string;    // faculty to check modifier against
    highThreshold: number;   // modifier at or above this → increase DC
    highDC: number;
  };
  advantageIf?: string[];    // clue IDs that grant advantage
  outcomes: {
    success: string;         // next scene ID
    partial?: string;        // next scene ID on partial success
    failure: string;         // next scene ID on failure
    critical?: string;       // next scene ID on nat 20
    fumble?: string;         // next scene ID on nat 1
  };
  requiresClue?: string;     // only shown if player has this clue
  requiresDeduction?: string; // only shown if player has this deduction
  requiresFlag?: string;     // only shown if this flag is set
  requiresFaculty?: {        // only shown if faculty meets threshold
    faculty: string;
    minimum: number;
  };
  npcDispositionEffect?: {   // NPC relationship change on choosing this
    npcId: string;
    dispositionDelta: number;
    suspicionDelta: number;
  };
}

// Game State
interface GameState {
  investigator: Investigator;
  currentScene: string;
  currentCase: string;
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  npcs: Record<string, NPCState>;
  flags: Record<string, boolean>;
  factionReputation: Record<string, number>;
  sceneHistory: string[];
  settings: GameSettings;
}

// Settings
interface GameSettings {
  fontSize: 'standard' | 'large' | 'extraLarge' | number;
  highContrast: boolean;
  reducedMotion: boolean;
  colorblindMode: boolean;
  textSpeed: 'typewriter' | 'fast' | 'instant';
  hintsEnabled: boolean;
  autoSaveFrequency: 'choice' | 'scene' | 'manual';
  audioVolume: { ambient: number; sfx: number; };
}
```

### 12.4 Component Architecture

```
<App>
├── <GameProvider>              // Zustand store context
│   ├── <AccessibilityProvider> // manages a11y settings, reduced motion, font size
│   ├── <TitleScreen />         // New game, load game, settings
│   ├── <CharacterCreation />
│   │   ├── <ArchetypeSelect />
│   │   └── <FacultyAllocation />
│   ├── <GameScreen>
│   │   ├── <HeaderBar />
│   │   │   ├── <CaseTitle />
│   │   │   ├── <EvidenceBoardToggle />  // pulses when new clues available
│   │   │   ├── <HintButton />           // appears contextually
│   │   │   └── <MenuButton />
│   │   ├── <NarrativePanel />
│   │   │   ├── <SceneText />            // typewriter effect (respects a11y)
│   │   │   ├── <SceneIllustration />
│   │   │   ├── <DiceRollOverlay />      // animated d20 (respects reduced motion)
│   │   │   ├── <OutcomeBanner />        // success/failure feedback
│   │   │   └── <ClueDiscoveryCard />    // slide-in notification
│   │   ├── <StatusBar />
│   │   │   ├── <ComposureMeter />       // animated with descriptors
│   │   │   └── <VitalityMeter />        // animated with descriptors
│   │   └── <ChoicePanel />
│   │       └── <ChoiceCard />           // faculty tag + proficiency color + advantage icon
│   ├── <EvidenceBoard />                // overlay
│   │   ├── <ProgressSummary />          // clues found / deductions formed
│   │   ├── <ClueCard />                 // with status indicators
│   │   ├── <ConnectionThread />         // draggable red string
│   │   └── <DeductionButton />
│   ├── <CaseJournal />                  // auto-updated case summary
│   ├── <NPCGallery />                   // character reference with dispositions
│   ├── <SettingsPanel />                // a11y, audio, save/load
│   └── <AmbientAudio />
```

---

## 13. Content Pipeline

### 13.1 Scene Authoring

Scenes are authored as structured JSON files organized by case and act:

```
/content
  /cases
    /the-lamplighters-wake
      meta.json             // case metadata, synopsis, faculty check distribution
      act1.json             // scene nodes for Act I
      act2.json             // scene nodes for Act II
      act3.json             // scene nodes for Act III
      clues.json            // all clues available in this case
      npcs.json             // NPC data (name, portrait, faction, starting disposition)
      variants.json         // variant scenes triggered by cross-case flags
  /side-cases
    /the-apothecary's-debt
      meta.json
      scenes.json           // simplified two-act structure
      clues.json
      npcs.json
```

### 13.2 Writing Guidelines

- **Scene text:** 100–200 words per scene node. Dense, atmospheric, present-tense. Second person ("You push open the door...").
- **Choice text:** 10–25 words. Clear about the action and the faculty involved.
- **Clue descriptions:** 1–3 sentences. Factual but evocative. Written as the investigator's notes.
- **Deduction text:** Written as the investigator's inner monologue connecting the dots.
- **Supernatural pacing:** Follow the slow-burn model (§1.1). Early scenes in each case emphasize rational investigation. Supernatural elements increase through the midpoint and peak in Act III.
- **Faculty balance:** Each case must meet the minimum check quotas (§4.2). Content review should verify distribution before finalizing.
- **NPC voice:** Each named NPC should have a distinct speech pattern and vocabulary. Include a brief "voice guide" in the NPC data file.

### 13.3 Scope Estimate (Starter Case)

| Element | Count |
|---|---|
| Scene nodes (main path) | 40–60 |
| Variant scenes | 5–10 |
| Unique clues | 12–18 |
| Deductions | 4–6 |
| Encounters (mundane) | 2–3 |
| Encounters (supernatural) | 1–2 |
| Named NPCs | 6–8 |
| Major branch points | 3 |
| Distinct endings | 3–4 |
| Archetype-exclusive scenes | 2–3 per archetype |
| Estimated play time | 45–90 minutes |

### 13.4 Content Validation Checklist

Before a case is considered complete, it must pass:

- [ ] All six Faculties meet minimum check quotas
- [ ] No mandatory scene requires a single Faculty with no alternative
- [ ] At least two investigative angles exist for the core mystery
- [ ] Each archetype has 2–3 exclusive scenes
- [ ] NPC Disposition shifts are logged and balanced (no NPC becomes permanently inaccessible without player agency)
- [ ] Supernatural elements follow the slow-burn escalation model
- [ ] Evidence Board connections are validated (no orphaned clues with zero valid connections)
- [ ] Red Herrings have plausible-seeming connections that resolve to failure, not dead ends
- [ ] All scene transitions are reachable (no broken graph edges)
- [ ] Accessibility: all text is screen-reader compatible, no information conveyed by color alone

---

## 14. Progression & Replayability

### 14.1 Between Cases

After completing a case:
- **Faculty advancement:** Gain +1 to a faculty used in a successful critical moment
- **New contacts:** NPCs met may become allies (providing future Advantage)
- **Faction reputation shifts:** Choices affect standing with factions, changing available branches in future cases
- **Persistent consequences:** Key decisions carry forward as flags
- **Side case unlocks:** Faction thresholds, NPC relationships, and unresolved threads may open Vignettes

### 14.2 Replayability Drivers

- Different archetypes experience fundamentally different paths (an Occultist discovers clues a Deductionist cannot, and vice versa), with 2–3 archetype-exclusive scenes per case
- Hidden clues reward thorough exploration
- Red Herrings create doubt — replaying reveals which clues were false
- Multiple valid solutions to each case (the "truth" is fixed, but the player's theory may be incomplete yet still functional)
- Faction alignment opens exclusive storylines and side cases
- Dynamic NPC relationships create different social landscapes across playthroughs
- Variant scenes swap based on prior-case flags, ensuring repeat cases feel fresh
- Side cases provide additional content accessible only through specific choices

---

## 15. Development Roadmap

### Phase 1 — Foundation (Weeks 1–3)
- [ ] React project scaffolding with Tailwind
- [ ] Zustand store with normalized, sliced architecture
- [ ] Character creation flow (archetype + faculty allocation)
- [ ] Narrative engine (scene graph traversal, conditional branching, variant scenes)
- [ ] Basic check system (d20 + modifier resolution + dynamic difficulty)
- [ ] Accessibility foundation (font sizing, reduced motion flag, keyboard nav, ARIA structure)

### Phase 2 — Core Loop (Weeks 4–6)
- [ ] Scene rendering with typewriter effect (respecting a11y settings)
- [ ] Choice panel with faculty tags, proficiency indicators, and advantage icons
- [ ] Dice roll animation and outcome display (with reduced motion fallback)
- [ ] Outcome feedback system (banners, status bar animations, descriptors)
- [ ] Status bars (Composure / Vitality) with threshold warnings
- [ ] Clue discovery notifications and inventory system
- [ ] Hint system (contextual trigger + 3-tier escalation)

### Phase 3 — Evidence Board & NPCs (Weeks 7–9)
- [ ] Corkboard UI with draggable clue cards and status indicators
- [ ] Connection threading (drag-to-connect with tag-based highlighting)
- [ ] Deduction system (validation + Reason check)
- [ ] Progress summary bar
- [ ] Visual feedback for all clue states (new, examined, connected, deduced, contested, spent)
- [ ] NPC system (Disposition, Suspicion, memory flags, cross-case persistence)
- [ ] NPC Gallery and Case Journal

### Phase 4 — Content & Polish (Weeks 10–14)
- [ ] Write "The Lamplighter's Wake" (full case content with variants)
- [ ] Write 1–2 side cases (Vignettes)
- [ ] Faculty balance validation across all content
- [ ] Scene illustrations (AI-generated or commissioned art)
- [ ] Sound design integration (ambient + SFX + supernatural audio)
- [ ] Visual polish (fog effects, typography, color palette)
- [ ] Save/load system with IndexedDB + version migrations
- [ ] High contrast and colorblind mode implementation
- [ ] Text-to-speech / screen reader testing
- [ ] Playtesting and balance tuning
- [ ] Content validation checklist pass for all cases

### Phase 5 — Expansion
- [ ] Additional main cases with cross-case variant scenes
- [ ] Overarching conspiracy storyline
- [ ] Faction-specific side case arcs
- [ ] Case select / case journal (cross-campaign view)
- [ ] Achievement system
- [ ] Optional cloud save integration
- [ ] Localization support
- [ ] Performance profiling and optimization for large save files

---

*"The game is afoot — and the fog is watching."*
