/**
 * ChoicePanel — filters and renders available choices for the current scene.
 */
import { useCallback, useMemo } from 'react';
import { useStore, useGameState, buildGameState } from '../../store';
import { evaluateConditions, processChoice } from '../../engine/narrativeEngine';
import { computeAdvantage } from '../../engine/advantage';
import { checkAutoSucceeds } from '../../engine/flags';
import { resolveDC, isFacultyCheck } from '../../engine/diceEngine';
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
  const investigator = useStore((s) => s.investigator);
  const clues = useStore((s) => s.clues);
  const deductions = useStore((s) => s.deductions);
  const setCheckResult = useStore((s) => s.setCheckResult);
  const gameState = useGameState();

  // Memoise the derived Sets so `React.memo`-wrapped ChoiceCards get a stable
  // reference and only re-render when clues/deductions actually change (F-045).
  const revealedClueIds = useMemo(
    () => new Set(Object.values(clues).filter((c) => c.isRevealed).map((c) => c.id)),
    [clues],
  );

  const deductionIds = useMemo(() => new Set(Object.keys(deductions)), [deductions]);

  const visibleChoices = choices.filter((c) => isChoiceVisible(c, gameState));

  const handleSelect = useCallback(
    (choiceId: string) => {
      const choice = choices.find((c) => c.id === choiceId);
      if (!choice) return;

      const store = useStore.getState();
      const currentState = buildGameState(store);
      const result = processChoice(choice, currentState, store);

      // Show dice roll overlay for faculty checks
      if (result.roll !== undefined && result.tier) {
        setCheckResult({
          roll: result.roll,
          modifier: result.modifier ?? 0,
          total: result.total ?? result.roll,
          tier: result.tier,
          dc: isFacultyCheck(choice)
            ? resolveDC(choice, currentState.investigator)
            : undefined,
        });
      }

      // Auto-save on choice if configured
      if (store.settings.autoSaveFrequency === 'choice') {
        store.autoSave();
      }

      onChoiceSelected?.(choiceId);
    },
    [choices, setCheckResult, onChoiceSelected],
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
          hasAdvantage={computeAdvantage(choice, gameState)}
          autoSucceeds={choice.faculty ? checkAutoSucceeds(choice.faculty, gameState.flags) : false}
          onSelect={handleSelect}
        />
      ))}
    </nav>
  );
}
