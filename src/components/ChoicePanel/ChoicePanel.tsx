/**
 * ChoicePanel — filters and renders available choices for the current scene.
 */
import { useCallback, useMemo } from 'react';
import { useStore, useGameState, buildGameState } from '../../store';
import { processChoice } from '../../engine/narrativeEngine';
import { resolveChoiceVisibility } from '../../engine/choiceVisibility';
import { computeAdvantage } from '../../engine/advantage';
import { checkAutoSucceeds } from '../../engine/flags';
import { resolveDC, isFacultyCheck } from '../../engine/diceEngine';
import { ChoiceCard } from './ChoiceCard';
import { LockedChoice } from '../shared';
import type { Choice } from '../../types';

export interface ChoicePanelProps {
  /** Choices from the current SceneNode */
  choices: Choice[];
  /** Called after processChoice resolves — parent handles navigation */
  onChoiceSelected?: (choiceId: string) => void;
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

  const shownChoices: Choice[] = [];
  const lockedChoices: Choice[] = [];
  for (const c of choices) {
    const visibility = resolveChoiceVisibility(c, gameState);
    if (visibility === 'shown') shownChoices.push(c);
    else if (visibility === 'disabled') lockedChoices.push(c);
    // 'hidden' -> dropped
  }

  const handleSelect = useCallback(
    (choiceId: string) => {
      const choice = choices.find((c) => c.id === choiceId);
      if (!choice) return;

      const store = useStore.getState();
      const currentState = buildGameState(store);

      // Defense-in-depth: a non-shown choice must never process, whatever the caller.
      if (resolveChoiceVisibility(choice, currentState) !== 'shown') return;

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

  if (shownChoices.length === 0 && lockedChoices.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 p-4 max-w-2xl mx-auto w-full">
      {shownChoices.length > 0 && (
        <nav aria-label="Available choices" className="flex flex-col gap-2">
          {shownChoices.map((choice) => (
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
      )}
      {/* role="list" is explicit: list-none strips list semantics in Safari/VoiceOver */}
      {lockedChoices.length > 0 && (
        <ul role="list" aria-label="Locked choices" className="flex flex-col gap-2 list-none">
          {lockedChoices.map((choice) => (
            <LockedChoice key={choice.id} text={choice.text} gateReason={choice.gateReason ?? ''} />
          ))}
        </ul>
      )}
    </section>
  );
}
