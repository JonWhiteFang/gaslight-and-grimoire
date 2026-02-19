import React from 'react';
import type { Archetype } from '../../types';
import { ARCHETYPES, FACULTY_LABELS } from '../../data/archetypes';

interface Props {
  selected: Archetype | null;
  onSelect: (archetype: Archetype) => void;
}

export function ArchetypeSelect({ selected, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-xl font-serif text-gaslight-amber mb-4">Choose Your Archetype</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Archetype selection">
        {ARCHETYPES.map((arch) => {
          const isSelected = selected === arch.id;
          return (
            <button
              key={arch.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(arch.id)}
              className={[
                'text-left p-4 rounded border-2 transition-colors min-h-[44px]',
                isSelected
                  ? 'border-gaslight-amber bg-gaslight-amber/10'
                  : 'border-gaslight-fog/30 hover:border-gaslight-amber/60',
              ].join(' ')}
            >
              <div className="font-serif text-lg text-gaslight-amber mb-1">{arch.name}</div>
              <p className="text-sm text-gaslight-fog/80 mb-3">{arch.description}</p>

              <div className="mb-2">
                <span className="text-xs uppercase tracking-wide text-gaslight-fog/50 mr-1">Bonuses:</span>
                {Object.entries(arch.bonuses).map(([fac, val]) => (
                  <span key={fac} className="text-xs text-gaslight-amber mr-2">
                    {FACULTY_LABELS[fac]} +{val}
                  </span>
                ))}
              </div>

              <div className="border-t border-gaslight-fog/20 pt-2 mt-2">
                <span className="text-xs font-semibold text-gaslight-amber">{arch.ability.name}: </span>
                <span className="text-xs text-gaslight-fog/70">{arch.ability.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
