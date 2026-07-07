/**
 * ChoiceCard — displays a single player choice with Faculty tag,
 * proficiency colour + text label, Advantage indicator, and key icon.
 */
import React from 'react';
import { calculateModifier, getTrainedBonus } from '../../engine/diceEngine';
import type { Choice, Faculty, Investigator } from '../../types';

// ─── Proficiency helpers ──────────────────────────────────────────────────────

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

const PROFICIENCY_LABELS: Record<ProficiencyTier, string> = {
  strong: 'Proficient',
  moderate: 'Adequate',
  weak: 'Untrained',
};

// ─── Faculty display name ─────────────────────────────────────────────────────

const FACULTY_DISPLAY: Record<Faculty, string> = {
  reason: 'Reason',
  perception: 'Perception',
  nerve: 'Nerve',
  vigor: 'Vigor',
  influence: 'Influence',
  lore: 'Lore',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChoiceCardProps {
  choice: Choice;
  investigator: Investigator;
  /** Clue IDs currently in the investigator's inventory (revealed) */
  revealedClueIds: Set<string>;
  /** Deduction IDs the investigator has formed */
  deductionIds: Set<string>;
  onSelect: (choiceId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChoiceCard({
  choice,
  investigator,
  revealedClueIds,
  deductionIds,
  onSelect,
}: ChoiceCardProps) {
  const hasAdvantage =
    choice.advantageIf !== undefined &&
    choice.advantageIf.some((clueId) => revealedClueIds.has(clueId));

  const isUnlockedByPreparation =
    (choice.requiresClue !== undefined && revealedClueIds.has(choice.requiresClue)) ||
    (choice.requiresDeduction !== undefined && deductionIds.has(choice.requiresDeduction));

  // Faculty tag data
  let facultyTag: React.ReactNode = null;
  if (choice.faculty) {
    const score = investigator.faculties[choice.faculty] ?? 8;
    const modifier = calculateModifier(score) + getTrainedBonus(choice.faculty, investigator.archetype);
    const tier = getProficiencyTier(modifier);
    const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const label = PROFICIENCY_LABELS[tier];
    const styles = PROFICIENCY_STYLES[tier];

    facultyTag = (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${styles}`}
        aria-label={`${FACULTY_DISPLAY[choice.faculty]} check, modifier ${modifierStr}, ${label}`}
      >
        {/* Colour swatch — decorative, info also in text label */}
        <span aria-hidden="true">{FACULTY_DISPLAY[choice.faculty]}</span>
        <span aria-hidden="true">{modifierStr}</span>
        <span className="opacity-75">· {label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(choice.id)}
      className="w-full text-left px-4 py-3 rounded-lg border border-gaslight-amber/30
                 bg-gaslight-ink/60 hover:bg-gaslight-ink/90 hover:border-gaslight-amber/60
                 focus:outline-none focus:ring-2 focus:ring-gaslight-amber/60
                 transition-colors duration-150 group"
      aria-label={choice.text}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Choice text */}
        <span className="text-gaslight-fog font-serif leading-snug flex-1">
          {choice.text}
        </span>

        {/* Right-side icons */}
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {/* Key icon — choice unlocked by a Clue or Deduction */}
          {isUnlockedByPreparation && (
            <span
              aria-label="Unlocked by your preparation"
              title="Unlocked by your preparation"
              className="text-gaslight-amber text-sm"
            >
              🗝
            </span>
          )}

          {/* Advantage indicator */}
          {hasAdvantage && (
            <span
              aria-label="Advantage: you hold a relevant clue"
              title="Advantage: you hold a relevant clue"
              className="text-green-400 text-sm"
            >
              ◈
            </span>
          )}
        </div>
      </div>

      {/* Faculty tag row */}
      {facultyTag && (
        <div className="mt-2">
          {facultyTag}
        </div>
      )}
    </button>
  );
}
