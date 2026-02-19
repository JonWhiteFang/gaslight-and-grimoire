import React from 'react';
import type { Archetype, Faculty } from '../../types';
import { ARCHETYPES, FACULTIES, FACULTY_LABELS, BASE_FACULTY_SCORE, BONUS_POINTS_TOTAL } from '../../data/archetypes';

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

interface Props {
  archetype: Archetype;
  allocated: Record<Faculty, number>;
  onChange: (faculty: Faculty, delta: number) => void;
}

export function FacultyAllocation({ archetype, allocated, onChange }: Props) {
  const archetypeDef = ARCHETYPES.find((a) => a.id === archetype)!;
  const totalAllocated = Object.values(allocated).reduce((sum, v) => sum + v, 0);
  const remaining = BONUS_POINTS_TOTAL - totalAllocated;

  return (
    <div>
      <h2 className="text-xl font-serif text-gaslight-amber mb-1">Allocate Faculty Points</h2>
      <p className="text-sm text-gaslight-fog/60 mb-4">
        Distribute{' '}
        <span
          className={remaining === 0 ? 'text-green-400 font-semibold' : 'text-gaslight-amber font-semibold'}
          aria-live="polite"
          aria-label={`${remaining} bonus points remaining`}
        >
          {remaining}
        </span>{' '}
        remaining bonus points across your Faculties.
      </p>

      <div className="space-y-3" role="group" aria-label="Faculty point allocation">
        {FACULTIES.map((faculty) => {
          const bonus = archetypeDef.bonuses[faculty] ?? 0;
          const extra = allocated[faculty];
          const total = BASE_FACULTY_SCORE + bonus + extra;
          const modifier = calculateModifier(total);
          const modLabel = modifier >= 0 ? `+${modifier}` : `${modifier}`;

          return (
            <div key={faculty} className="flex items-center gap-3">
              <span className="w-24 text-sm text-gaslight-fog font-medium">{FACULTY_LABELS[faculty]}</span>

              <button
                aria-label={`Decrease ${FACULTY_LABELS[faculty]}`}
                onClick={() => onChange(faculty, -1)}
                disabled={extra <= 0}
                className="w-7 h-7 rounded border border-gaslight-fog/30 text-gaslight-fog disabled:opacity-30 hover:border-gaslight-amber hover:text-gaslight-amber transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                −
              </button>

              <span
                className="w-6 text-center text-gaslight-amber font-semibold tabular-nums"
                aria-label={`${FACULTY_LABELS[faculty]} score ${total}`}
              >
                {total}
              </span>

              <button
                aria-label={`Increase ${FACULTY_LABELS[faculty]}`}
                onClick={() => onChange(faculty, 1)}
                disabled={remaining <= 0}
                className="w-7 h-7 rounded border border-gaslight-fog/30 text-gaslight-fog disabled:opacity-30 hover:border-gaslight-amber hover:text-gaslight-amber transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                +
              </button>

              <span
                className={[
                  'w-10 text-sm font-semibold tabular-nums',
                  modifier >= 2 ? 'text-green-400' : modifier >= 0 ? 'text-yellow-400' : 'text-red-400',
                ].join(' ')}
                aria-label={`${FACULTY_LABELS[faculty]} modifier ${modLabel}`}
              >
                {modLabel}
              </span>

              {bonus > 0 && (
                <span className="text-xs text-gaslight-fog/40">(+{bonus} archetype)</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
