/**
 * ChoicePanel — filters and renders available choices for the current scene.
 *
 * Req 3.1: Display all available choices for the current Scene_Node.
 * Req 3.2: Show a choice only if its required Clue/Deduction/flag/Faculty
 *          threshold is met.
 */
import React, { useCallback } from 'react';
import { useStore } from '../../store';
import { evaluateConditions } from '../../engine/narrativeEngine';
import { ChoiceCard } from './ChoiceCard';
import type { Choice, GameState } from '../../types';

export interface ChoicePanelProps {
  /** Choices from the current SceneNode */
  choices: Choice[];
  /** Called after processChoice resolves — parent handles navigation */
  onChoiceSelected?: (choiceId: string) => void;
}

// ─── Condition helpers ────────────────────────────────────────────────────────

/**
 * Builds the minimal GameState-compatible object needed by evaluateConditions
 * from the Zustand store snapshot.
 */
function buildGameState(store: ReturnType<typeof useStore.getState>): GameState {
  return {
    investigator: store.investigator,
    currentScene: store.currentScene,
    currentCase: store.currentCase,
    clues: store.clues,
    deductions: store.deductions,
    npcs: store.npcs,
    flags: store.flags,
    factionReputation: store.factionReputation,
    sceneHistory: store.sceneHistory,
    settings: store.settings,
  };
}

/**
 * Returns true when all explicit requirements on a Choice are satisfied.
 * Uses evaluateConditions for consistency with the narrative engine.
 */
export function isChoiceVisible(choice: Choice, state: GameState): boolean {
  const conditions = [];

  if (choice.requiresClue) {
    conditions.push({ type: 'hasClue' as const, target: choice.requiresClue });
  }
  if (choice.requiresDeduction) {
    conditions.push({ type: 'hasDeduction' as const, target: choice.requiresDeduction });
  }
  if (choice.requiresFlag) {
    conditions.push({ type: 'hasFlag' as const, target: choice.requiresFlag });
  }
  if (choice.requiresFaculty) {
    conditions.push({
      type: 'facultyMin' as const,
      target: choice.requiresFaculty.faculty,
      value: choice.requiresFaculty.minimum,
    });
  }

  return evaluateConditions(conditions, state);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChoicePanel({ choices, onChoiceSelected }: ChoicePanelProps) {
  const storeSnapshot = useStore();
  const goToScene = useStore((s) => s.goToScene);

  const gameState = buildGameState(storeSnapshot);
  const { investigator, clues, deductions } = storeSnapshot;

  const revealedClueIds = new Set(
    Object.values(clues)
      .filter((c) => c.isRevealed)
      .map((c) => c.id),
  );

  const deductionIds = new Set(Object.keys(deductions));

  const visibleChoices = choices.filter((c) => isChoiceVisible(c, gameState));

  const handleSelect = useCallback(
    (choiceId: string) => {
      const choice = choices.find((c) => c.id === choiceId);
      if (!choice) return;

      // For choices without a Faculty check, navigate directly to the success outcome.
      // Full dice-roll orchestration (Task 8) will replace this path.
      if (!choice.faculty) {
        const nextScene = choice.outcomes.success ?? choice.outcomes.partial ?? '';
        if (nextScene) goToScene(nextScene);
      }

      onChoiceSelected?.(choiceId);
    },
    [choices, goToScene, onChoiceSelected],
  );

  if (visibleChoices.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Available choices"
      className="flex flex-col gap-2 p-4 max-w-2xl mx-auto w-full"
    >
      {visibleChoices.map((choice) => (
        <ChoiceCard
          key={choice.id}
          choice={choice}
          investigator={investigator}
          revealedClueIds={revealedClueIds}
          deductionIds={deductionIds}
          onSelect={handleSelect}
        />
      ))}
    </nav>
  );
}
