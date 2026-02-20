# Design Concepts

## Narrative Structure

### Scene Node as Atomic Unit
Every piece of narrative is a `SceneNode` — text, choices, clue discoveries, conditions, and onEnter effects bundled together. Scenes are the only addressable unit; there are no sub-scenes, paragraphs, or dialogue trees within a scene.
- **Status**: Fully implemented
- **Files**: `src/types/index.ts` → `SceneNode`, `content/cases/*/act*.json`

### Three-Act Case Structure
Main cases have 3 acts, each in a separate JSON file (`act1.json`, `act2.json`, `act3.json`). All acts are loaded upfront. Act boundaries are implicit — scenes reference each other across acts via IDs.
- **Status**: Fully implemented
- **Files**: `content/cases/the-whitechapel-cipher/act1.json` through `act3.json`, `src/engine/narrativeEngine.ts` → `loadCase`

### Two-Act Vignette Structure
Side cases use a single `scenes.json` (no act split). Triggered by faction reputation, NPC disposition, or flags. Lighter-weight than main cases.
- **Status**: Fully implemented (engine + 1 vignette)
- **Files**: `content/side-cases/a-matter-of-shadows/`, `src/engine/narrativeEngine.ts` → `loadVignette`

### Scene Variants
A variant scene can override a base scene when a `variantCondition` is met. Variants live in `variants.json` and reference their base via `variantOf`. Resolved at render time, not navigation time.
- **Status**: Fully implemented
- **Files**: `src/types/index.ts` → `SceneNode.variantOf`, `src/engine/narrativeEngine.ts` → `resolveScene`

### Condition/Effect as Content Contract
`Condition` and `Effect` are the only mechanisms for content JSON to gate access and mutate game state. No ad-hoc logic in scene handlers. This is an enforced architectural boundary.
- **Status**: Fully implemented
- **Files**: `src/types/index.ts` → `Condition`, `Effect`

## Character System

### Four Archetypes with Asymmetric Bonuses
Deductionist (+3 Reason, +1 Perception), Occultist (+3 Lore, +1 Perception), Operator (+3 Vigor, +1 Nerve), Mesmerist (+3 Influence, +1 Nerve). Each has a once-per-case ability that auto-succeeds a check.
- **Status**: Fully implemented
- **Files**: `src/data/archetypes.ts`, `src/components/CharacterCreation/`

### Faculty Point Allocation
Base score 8 for all 6 faculties. 12 bonus points to distribute freely. Combined with archetype bonuses at character creation. No per-faculty cap during allocation.
- **Status**: Fully implemented
- **Files**: `src/data/archetypes.ts` → `BASE_FACULTY_SCORE`, `BONUS_POINTS_TOTAL`, `src/components/CharacterCreation/FacultyAllocation.tsx`

### Once-Per-Case Ability
Each archetype has a special ability (e.g., "Elementary" for Deductionist). Activated via `AbilityButton` in the header. Sets a world flag (e.g., `ability-auto-succeed-reason`). Reset on new case start.
- **Status**: Fully implemented
- **Files**: `src/App.tsx` → `ABILITY_FLAGS`, `handleActivateAbility`, `src/components/HeaderBar/AbilityButton.tsx`

## Evidence & Deduction

### Clue Lifecycle
Clues progress through statuses: `new` → `examined` → `connected` → `deduced` (or `contested` → `examined` on failed deduction, or `spent`). Discovery sets `isRevealed = true` and status to `new`.
- **Status**: Fully implemented
- **Files**: `src/types/index.ts` → `ClueStatus`, `src/store/slices/evidenceSlice.ts`

### Clue-Gated Discovery
`ClueDiscovery` objects on scenes specify how clues are found: `automatic` (on scene entry), `exploration`, `check`, or `dialogue`. Gated by `requiresFaculty` and `requiresDeduction`.
- **Status**: Fully implemented (automatic method); other methods not wired to UI
- **Files**: `src/types/index.ts` → `ClueDiscovery`, `src/engine/narrativeEngine.ts` → `canDiscoverClue`, `src/components/NarrativePanel/NarrativePanel.tsx`

### Advantage from Clues
Choices with `advantageIf` clue references grant Advantage (roll 2d20, take highest) when the player holds those clues. This is the core "knowledge has mechanical impact" rule.
- **Status**: Fully implemented
- **Files**: `src/engine/narrativeEngine.ts` → `processChoice` (advantage check), `src/components/ChoicePanel/ChoiceCard.tsx` (advantage indicator)

### Deduction from Connected Clues
Players connect ≥2 clues on the Evidence Board, then attempt a DC 14 Reason check. Success creates a `Deduction` and locks clues as `deduced`. If any connected clue is a red herring, `isRedHerring = true` on the deduction.
- **Status**: Fully implemented
- **Files**: `src/components/EvidenceBoard/DeductionButton.tsx`, `src/components/EvidenceBoard/buildDeduction.ts`

### Red Herring Propagation
If any clue in a deduction has `type: 'redHerring'`, the resulting deduction is flagged `isRedHerring: true`. Displayed as "(questionable)" in the Case Journal.
- **Status**: Fully implemented
- **Files**: `src/components/EvidenceBoard/buildDeduction.ts`, `src/components/CaseJournal/CaseJournal.tsx`

## NPC & Faction System

### NPC Disposition and Suspicion
NPCs have `disposition` [-10,+10] and `suspicion` [0,10]. Changed by choice `npcEffect` and scene `Effect`. Suspicion maps to tiers: normal (0-2), evasive (3-5), concealing (6-8), hostile (9-10).
- **Status**: Fully implemented
- **Files**: `src/types/index.ts` → `NPCState`, `src/store/slices/npcSlice.ts`

### Faction Reputation Propagation
When a faction-aligned NPC's disposition changes, 50% of the delta propagates to the faction's reputation. Automatic, not content-authored.
- **Status**: Fully implemented
- **Files**: `src/store/slices/npcSlice.ts` → `adjustDisposition` (cross-slice call to `adjustReputation`)

### NPC Memory Flags
NPCs have `memoryFlags: Record<string, boolean>` for tracking per-NPC state (e.g., "told-about-cipher"). Set via `setNpcMemoryFlag` action.
- **Status**: Fully implemented (store action exists); no content currently uses it
- **Files**: `src/store/slices/npcSlice.ts` → `setNpcMemoryFlag`

## Encounter Design

### Supernatural vs Mundane Encounters
Supernatural encounters trigger a Nerve/Lore reaction check at DC 12. Failure costs 1-2 composure and replaces the first choice with a `worseAlternative`. Mundane encounters skip the reaction check.
- **Status**: Fully implemented (engine only, no UI)
- **Files**: `src/engine/narrativeEngine.ts` → `startEncounter`

### Dual-Axis Damage
Supernatural encounter failures apply both composure and vitality damage. Mundane encounters apply only one axis. This makes supernatural threats mechanically scarier.
- **Status**: Fully implemented (engine only)
- **Files**: `src/engine/narrativeEngine.ts` → `processEncounterChoice`

### Escape Paths
Encounter choices marked `isEscapePath: true` are always shown (if conditions met), ensuring the player is never trapped in an unwinnable encounter.
- **Status**: Fully implemented (engine only)
- **Files**: `src/engine/narrativeEngine.ts` → `getEncounterChoices`

## Composure & Vitality

### Dual Health Tracks
Composure (mental, 0-10) and Vitality (physical, 0-10). Both start at 10. Reaching 0 triggers a special scene (`breakdown` or `incapacitation`).
- **Status**: Fully implemented
- **Files**: `src/components/StatusBar/StatusBar.tsx`, `src/store/slices/investigatorSlice.ts`

## Progression

### Faculty Bonus on Case Completion
At case end, the faculty stored in the `last-critical-faculty` flag gets +1 (capped at 20). This rewards the player's most dramatic moment.
- **Status**: Fully implemented (engine); no UI for the reward
- **Files**: `src/engine/caseProgression.ts` → `completeCase`, `grantFacultyBonus`

### Vignette Unlock Conditions
Side cases unlock when: faction reputation ≥ threshold, NPC disposition ≥ 7, or a required flag is set. Checked at case completion.
- **Status**: Fully implemented (engine); no UI for unlock notification
- **Files**: `src/engine/caseProgression.ts` → `checkVignetteUnlocks`, `VIGNETTE_CONDITIONS`
