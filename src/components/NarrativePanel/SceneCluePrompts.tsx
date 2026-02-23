/**
 * SceneCluePrompts — renders clickable atmospheric prompts for
 * exploration and check-method clues in the current scene.
 */
import React, { useState, useEffect } from 'react';
import { canDiscoverClue } from '../../engine/narrativeEngine';
import { getCluePromptText } from '../../engine/cluePrompts';
import { performCheck, calculateModifier } from '../../engine/diceEngine';
import type { ClueDiscovery, Clue, GameState, Investigator, Faculty } from '../../types';

type ProficiencyTier = 'strong' | 'moderate' | 'weak';

function getProficiencyTier(modifier: number): ProficiencyTier {
  if (modifier >= 2) return 'strong';
  if (modifier >= 0) return 'moderate';
  return 'weak';
}

const PROFICIENCY_STYLES: Record<ProficiencyTier, string> = {
  strong: 'bg-green-900/60 text-green-300 border-green-700',
  moderate: 'bg-amber-900/60 text-amber-300 border-amber-700',
  weak: 'bg-red-900/60 text-red-300 border-red-700',
};

const FACULTY_DISPLAY: Record<Faculty, string> = {
  reason: 'Reason', perception: 'Perception', nerve: 'Nerve',
  vigor: 'Vigor', influence: 'Influence', lore: 'Lore',
};

export interface SceneCluePromptsProps {
  sceneId: string;
  cluesAvailable: ClueDiscovery[];
  clues: Record<string, Clue>;
  gameState: GameState;
  investigator: Investigator;
  onClueDiscovered: (clue: Clue) => void;
  onCheckResult: (result: { roll: number; modifier: number; total: number; tier: string }) => void;
  discoverClue: (clueId: string) => void;
}

export function SceneCluePrompts({
  sceneId,
  cluesAvailable,
  clues,
  gameState,
  investigator,
  onClueDiscovered,
  onCheckResult,
  discoverClue,
}: SceneCluePromptsProps) {
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());

  // Reset local state on scene change
  useEffect(() => {
    setClicked(new Set());
    setFailed(new Set());
  }, [sceneId]);

  const prompts = cluesAvailable.filter((d) => {
    if (d.method !== 'exploration' && d.method !== 'check') return false;
    if (clues[d.clueId]?.isRevealed) return false;
    if (clicked.has(d.clueId)) return false;
    return canDiscoverClue(d, gameState);
  });

  const failedPrompts = cluesAvailable.filter(
    (d) => d.method === 'check' && failed.has(d.clueId),
  );

  function handleExplore(discovery: ClueDiscovery) {
    setClicked((s) => new Set(s).add(discovery.clueId));
    discoverClue(discovery.clueId);
    const clue = clues[discovery.clueId];
    if (clue) onClueDiscovered({ ...clue, isRevealed: true, status: 'new' });
  }

  function handleCheck(discovery: ClueDiscovery) {
    if (!discovery.requiresFaculty) return;
    const { faculty, minimum: dc } = discovery.requiresFaculty;
    const result = performCheck(faculty, investigator, dc, false, false);
    onCheckResult({ roll: result.roll, modifier: result.modifier, total: result.total, tier: result.tier });
    setClicked((s) => new Set(s).add(discovery.clueId));

    if (result.tier === 'failure' || result.tier === 'fumble') {
      setFailed((s) => new Set(s).add(discovery.clueId));
    } else {
      discoverClue(discovery.clueId);
      const clue = clues[discovery.clueId];
      if (clue) onClueDiscovered({ ...clue, isRevealed: true, status: 'new' });
    }
  }

  if (prompts.length === 0 && failedPrompts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Scene investigation prompts">
      {prompts.map((d) => {
        const clue = clues[d.clueId];
        if (!clue) return null;
        const promptText = getCluePromptText(clue.type, clue.title, d.method as 'exploration' | 'check');

        if (d.method === 'check' && d.requiresFaculty) {
          const { faculty, minimum } = d.requiresFaculty;
          const mod = calculateModifier(investigator.faculties[faculty]);
          const tier = getProficiencyTier(mod);
          const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
          return (
            <button
              key={d.clueId}
              type="button"
              onClick={() => handleCheck(d)}
              className="text-left pl-4 py-2 border-l-2 border-gaslight-amber/50 italic font-serif text-gaslight-fog/80 hover:text-gaslight-fog hover:border-gaslight-amber transition-colors cursor-pointer"
              aria-label={`Examine: ${FACULTY_DISPLAY[faculty]} check, DC ${minimum}`}
            >
              <span>{promptText}</span>
              <span className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded border text-xs font-medium not-italic ${PROFICIENCY_STYLES[tier]}`}>
                {FACULTY_DISPLAY[faculty]} {modStr}
              </span>
            </button>
          );
        }

        return (
          <button
            key={d.clueId}
            type="button"
            onClick={() => handleExplore(d)}
            className="text-left pl-4 py-2 border-l-2 border-gaslight-amber/30 italic font-serif text-gaslight-fog/70 hover:text-gaslight-fog hover:border-gaslight-amber/60 transition-colors cursor-pointer"
            aria-label={`Investigate: ${clue.title}`}
          >
            {promptText}
          </button>
        );
      })}

      {failedPrompts.map((d) => (
        <p
          key={d.clueId}
          className="pl-4 py-2 border-l-2 border-stone-600/40 italic font-serif text-stone-500 text-sm"
          role="status"
        >
          You sense something significant here, but it eludes your grasp.
        </p>
      ))}
    </div>
  );
}
