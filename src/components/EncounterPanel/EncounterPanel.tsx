/**
 * EncounterPanel — renders multi-round encounters with reaction checks,
 * faculty choices, and damage feedback.
 * Req 9.1–9.7
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, buildGameState } from '../../store';
import {
  startEncounter,
  processEncounterChoice,
  getEncounterChoices,
} from '../../engine/narrativeEngine';
import { ChoiceCard } from '../ChoicePanel/ChoiceCard';
import type { Choice, EncounterRound, EncounterState, GameState } from '../../types';

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

  const [encounterState, setEncounterState] = useState<EncounterState | null>(null);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const initRef = useRef(false);

  // Initialize encounter on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const gameState = buildGameState(useStore.getState());
    const state = startEncounter(sceneId, rounds, isSupernatural, gameState);
    setEncounterState(state);

    if (isSupernatural && state.reactionCheckPassed !== null) {
      setReactionMessage(
        state.reactionCheckPassed
          ? 'You steel yourself against the supernatural presence.'
          : 'The presence overwhelms you momentarily. You feel your composure slip.'
      );
      setTimeout(() => setReactionMessage(null), 3000);
    }
  }, [sceneId, rounds, isSupernatural]);

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
      );

      if (result.roll !== undefined && result.tier) {
        setCheckResult({
          roll: result.roll,
          modifier: result.modifier ?? 0,
          total: result.total ?? result.roll,
          tier: result.tier,
        });
      }

      setEncounterState(newState);

      if (newState.isComplete) {
        onComplete();
      }
    },
    [encounterState, setCheckResult, onComplete],
  );

  if (!encounterState) return null;

  if (encounterState.isComplete) return null;

  const currentRound = encounterState.rounds[encounterState.currentRound];
  if (!currentRound) return null;

  const gameState = buildGameState(useStore.getState());
  const availableChoices = getEncounterChoices(currentRound, gameState);

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
      <div className="text-center text-xs text-stone-500 uppercase tracking-widest">
        Round {currentRound.roundNumber} of {encounterState.rounds.length}
      </div>

      {/* Choices */}
      <nav aria-label="Encounter choices" className="flex flex-col gap-2">
        {availableChoices.map((choice) => (
          <ChoiceCard
            key={choice.id}
            choice={choice}
            investigator={investigator}
            revealedClueIds={revealedClueIds}
            deductionIds={deductionIds}
            onSelect={handleChoiceSelect}
          />
        ))}
      </nav>
    </div>
  );
}
