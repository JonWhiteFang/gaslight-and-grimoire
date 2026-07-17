/**
 * EncounterPanel — renders multi-round encounters with reaction checks,
 * faculty choices, and damage feedback.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, buildGameState } from '../../store';
import {
  startEncounter,
  processEncounterChoice,
  getEncounterChoices,
} from '../../engine/narrativeEngine';
import { computeAdvantage } from '../../engine/advantage';
import { checkAutoSucceeds } from '../../engine/flags';
import { resolveDC, isFacultyCheck } from '../../engine/diceEngine';
import { resolveChoiceVisibility } from '../../engine/choiceVisibility';
import { ChoiceCard } from '../ChoicePanel/ChoiceCard';
import { LockedChoice } from '../shared';
import type { Choice, EncounterRound, EncounterState } from '../../types';

export interface EncounterPanelProps {
  sceneId: string;
  rounds: EncounterRound[];
  isSupernatural: boolean;
  onComplete: () => void;
}

export function EncounterPanel({ sceneId, rounds, isSupernatural, onComplete }: EncounterPanelProps) {
  const investigator = useStore((s) => s.investigator);
  const clues = useStore((s) => s.clues);
  const deductions = useStore((s) => s.deductions);
  const setCheckResult = useStore((s) => s.setCheckResult);
  const setStoreEncounterState = useStore((s) => s.setEncounterState);
  // Reactive flags source for the pre-roll odds tag (auto-succeed → "Assured").
  // Must be reactive, not the non-reactive buildGameState() render snapshot.
  const flags = useStore((s) => s.flags);

  const [encounterState, setEncounterStateLocal] = useState<EncounterState | null>(null);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const initRef = useRef(false);

  // Mirror an EncounterState into both local render state and the store, so the
  // reaction roll and round progress survive a save/reload (F-105).
  const commitEncounterState = useCallback((state: EncounterState) => {
    setEncounterStateLocal(state);
    setStoreEncounterState(state);
  }, [setStoreEncounterState]);

  // Initialize (or RESUME) the encounter on mount.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // If a persisted encounterState for THIS scene already exists (e.g. after a
    // reload mid-encounter), resume from it rather than re-running startEncounter
    // — which would re-roll the reaction check, re-apply its composure damage
    // (save-scum), and reset currentRound (F-105).
    const persisted = useStore.getState().encounterState;
    if (persisted && persisted.id === sceneId && !persisted.isComplete) {
      setEncounterStateLocal(persisted);
      return;
    }

    const gameState = buildGameState(useStore.getState());
    const state = startEncounter(sceneId, rounds, isSupernatural, gameState, useStore.getState());
    commitEncounterState(state);

    if (isSupernatural && state.reactionCheckPassed !== null) {
      setReactionMessage(
        state.reactionCheckPassed
          ? 'You steel yourself against the supernatural presence.'
          : 'The presence overwhelms you momentarily. You feel your composure slip.'
      );
      setTimeout(() => setReactionMessage(null), 3000);
    }
  }, [sceneId, rounds, isSupernatural, commitEncounterState]);

  const handleChoiceSelect = useCallback(
    (choiceId: string) => {
      if (!encounterState || encounterState.isComplete) return;

      const round = encounterState.rounds[encounterState.currentRound];
      const choice = round.choices.find((c: Choice) => c.id === choiceId);
      if (!choice) return;

      const gameState = buildGameState(useStore.getState());
      const { encounterState: newState, result } = processEncounterChoice(
        choice,
        encounterState,
        gameState,
        useStore.getState(),
      );

      if (result.roll !== undefined && result.tier) {
        setCheckResult({
          roll: result.roll,
          modifier: result.modifier ?? 0,
          total: result.total ?? result.roll,
          tier: result.tier,
          dc: isFacultyCheck(choice)
            ? resolveDC(choice, gameState.investigator)
            : undefined,
        });
      }

      commitEncounterState(newState);

      if (newState.isComplete) {
        onComplete();
      }
    },
    [encounterState, setCheckResult, onComplete, commitEncounterState],
  );

  if (!encounterState) return null;

  if (encounterState.isComplete) return null;

  const currentRound = encounterState.rounds[encounterState.currentRound];
  if (!currentRound) return null;

  const gameState = buildGameState(useStore.getState());
  const availableChoices = getEncounterChoices(currentRound, gameState);

  const shownChoices: Choice[] = [];
  const lockedChoices: Choice[] = [];
  for (const c of availableChoices) {
    const visibility = resolveChoiceVisibility(c, gameState);
    if (visibility === 'shown') shownChoices.push(c);
    else if (visibility === 'disabled') lockedChoices.push(c);
  }

  const revealedClueIds = new Set(
    Object.values(clues).filter((c) => c.isRevealed).map((c) => c.id),
  );
  const deductionIds = new Set(Object.keys(deductions));

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      {/* Reaction check feedback */}
      {reactionMessage && (
        <div
          role="status"
          aria-live="polite"
          className="bg-gaslight-crimson/20 border border-gaslight-crimson/40 rounded-lg p-3 text-sm text-gaslight-fog text-center"
        >
          {reactionMessage}
        </div>
      )}

      {/* Round indicator */}
      <div className="text-center text-xs text-stone-400 uppercase tracking-widest">
        Round {currentRound.roundNumber} of {encounterState.rounds.length}
      </div>

      {/* Choices */}
      {shownChoices.length > 0 && (
        <nav aria-label="Encounter choices" className="flex flex-col gap-2">
          {shownChoices.map((choice) => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              investigator={investigator}
              revealedClueIds={revealedClueIds}
              deductionIds={deductionIds}
              hasAdvantage={computeAdvantage(choice, gameState)}
              autoSucceeds={choice.faculty ? checkAutoSucceeds(choice.faculty, flags) : false}
              onSelect={handleChoiceSelect}
            />
          ))}
        </nav>
      )}
      {lockedChoices.length > 0 && (
        // role="list" required: list-none strips list semantics in Safari/VoiceOver.
        <ul role="list" aria-label="Locked choices" className="flex flex-col gap-2 list-none">
          {lockedChoices.map((choice) => (
            <LockedChoice key={choice.id} text={choice.text} gateReason={choice.gateReason ?? ''} />
          ))}
        </ul>
      )}
    </div>
  );
}
