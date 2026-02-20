# Trace 08 — Encounter System

## 1. Entry Point

`narrativeEngine.startEncounter(encounterId, rounds, isSupernatural, state)` — called from game logic when a scene triggers an encounter. No component currently calls this directly; the encounter system is engine-complete but not wired to UI.

## 2. Execution Path

### Start encounter

1. `startEncounter` receives encounter ID, round definitions, supernatural flag, and game state.
2. Deep-copies rounds: `rounds.map(r => ({ ...r, choices: [...r.choices] }))`.
3. If supernatural and rounds exist:
   - Picks reaction faculty: higher of Nerve vs Lore (Nerve wins ties).
   - `performCheck(reactionFaculty, investigator, 12, false, false)` — DC 12, no advantage.
   - If success/critical: `reactionCheckPassed = true`.
   - If failure: `reactionCheckPassed = false`.
     - Composure damage: `(rollD20() % 2) + 1` → 1 or 2 damage. Calls `store.adjustComposure(-damage)`.
     - If first choice in round 1 has `worseAlternative`, replaces it.
4. Returns `EncounterState { id, rounds, currentRound: 0, isComplete: false, reactionCheckPassed }`.

### Process encounter choice

1. `processEncounterChoice(choice, encounterState, state)` called per round.
2. Determines advantage from occult clues (`choice.advantageIf` where clue type is `'occult'`) or any revealed clue.
3. If faculty check: `performCheck(faculty, investigator, difficulty, hasAdvantage, false)`.
4. On failure + `encounterDamage`:
   - Supernatural: applies both `composureDelta` and `vitalityDelta` (dual-axis).
   - Mundane: applies composure OR vitality (single-axis, composure preferred).
5. Applies NPC effects if present.
6. Advances `currentRound`. If complete, calls `store.goToScene(nextSceneId)`.
7. Returns updated `EncounterState` + `ChoiceResult`.

### Get encounter choices

1. `getEncounterChoices(round, state)` filters choices by conditions.
2. Escape paths always included if conditions met.
3. Annotates `_hasAdvantage` on choices with occult clue advantage.

## 3. Resource Management

- Synchronous. No I/O.
- `startEncounter` calls `useStore.getState()` for composure damage — imperative store access from engine.
- Round data is shallow-copied to avoid mutating the original content.
- `rollD20()` called for composure damage calculation (using modulo for 1-2 range — wasteful use of a d20 for a coin flip).

## 4. Error Path

- If `encounterState.rounds[currentRound]` is undefined (index out of bounds), `currentRound` defaults to `undefined`, `isSupernatural` defaults to `false`. No crash but incorrect behavior.
- If `choice.outcomes[tier]` is undefined, `nextSceneId` is undefined → `goToScene(undefined)` on encounter completion → crash at `resolveScene`.
- No validation that encounter rounds have valid choices.

## 5. Performance Characteristics

- Trivial. A few dice rolls and object lookups per round.
- `getEncounterChoices` builds a `Condition[]` array per choice and calls `evaluateConditions` — linear in number of choices × conditions.

## 6. Observable Effects

- Store: composure/vitality changes, NPC disposition/suspicion changes, scene navigation on completion.
- SFX: composure-decrease and vitality-decrease from store slice actions.
- `reactionCheckPassed` is returned but not stored anywhere persistent — the caller must track it.

## 7. Why This Design

- Supernatural encounters have a "reaction check" gate that penalizes unprepared investigators — this creates tension before the encounter even begins.
- Dual-axis damage for supernatural encounters makes them more dangerous than mundane ones, reinforcing the horror theme.
- Occult clue advantage rewards players who've investigated the supernatural elements.
- Escape paths are always available (if conditions met) — the player is never trapped in an unwinnable encounter.

## 8. Feels Incomplete

- No UI component renders encounters. The engine functions exist but there's no `EncounterPanel` or similar component. Encounters would need to flow through the existing `ChoicePanel`/`NarrativePanel`, but those components don't understand `EncounterState` or round progression.
- `EncounterState` is not stored in the Zustand store. There's no `encounterSlice`. The caller must manage encounter state externally.
- No encounter-specific SFX or visual treatment.
- `worseAlternative` replacement only affects the first choice in round 1. If content authors want multiple choices replaced, they can't.

## 9. Feels Vulnerable

- `(rollD20() % 2) + 1` for composure damage is a misuse of the d20. `rollD20()` returns [1,20], so `% 2` gives 0 or 1, and `+1` gives 1 or 2. But the distribution is biased: odd rolls (1,3,5,...,19) give 2, even rolls (2,4,6,...,20) give 1. This is 10/10 split so actually fair, but the intent is unclear and the d20 is overkill for a binary choice.
- `startEncounter` mutates the store (composure damage) as a side effect. The function signature suggests it returns an `EncounterState`, but it also has hidden side effects.
- If `processEncounterChoice` is called after `isComplete` is already true, it would try to access `rounds[currentRound]` which is out of bounds.

## 10. Feels Like Bad Design

- The encounter system is a fully implemented engine with no UI consumer. This is dead code from a user perspective.
- `startEncounter` and `processEncounterChoice` both access the store imperatively, making them impure. They should return effect descriptions that the caller applies, consistent with how `processChoice` returns a `ChoiceResult`.
- The `_hasAdvantage` annotation on choices returned by `getEncounterChoices` uses a private-convention property name on a public type (`Choice & { _hasAdvantage?: boolean }`). This is a code smell — it should be a separate return type or a wrapper.
