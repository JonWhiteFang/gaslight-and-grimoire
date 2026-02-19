import React, { useState } from 'react';
import type { Archetype, Faculty, Investigator } from '../../types';
import { FACULTIES, BONUS_POINTS_TOTAL, BASE_FACULTY_SCORE, ARCHETYPES } from '../../data/archetypes';
import { ArchetypeSelect } from './ArchetypeSelect';
import { FacultyAllocation } from './FacultyAllocation';
import { useStore } from '../../store';

const emptyAllocated = (): Record<Faculty, number> =>
  Object.fromEntries(FACULTIES.map((f) => [f, 0])) as Record<Faculty, number>;

interface Props {
  onComplete: () => void;
}

export function CharacterCreation({ onComplete }: Props) {
  const initInvestigator = useStore((s) => s.initInvestigator);

  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [allocated, setAllocated] = useState<Record<Faculty, number>>(emptyAllocated());

  const totalAllocated = Object.values(allocated).reduce((sum, v) => sum + v, 0);
  const remaining = BONUS_POINTS_TOTAL - totalAllocated;
  const canConfirm = name.trim().length > 0 && archetype !== null && remaining === 0;

  function handleArchetypeSelect(a: Archetype) {
    setArchetype(a);
    setAllocated(emptyAllocated());
  }

  function handleFacultyChange(faculty: Faculty, delta: number) {
    setAllocated((prev) => {
      const next = { ...prev };
      const newVal = next[faculty] + delta;
      if (newVal < 0) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      next[faculty] = newVal;
      return next;
    });
  }

  function handleConfirm() {
    if (!canConfirm || !archetype) return;

    const archetypeDef = ARCHETYPES.find((a) => a.id === archetype)!;
    const faculties = Object.fromEntries(
      FACULTIES.map((f) => [
        f,
        BASE_FACULTY_SCORE + (archetypeDef.bonuses[f] ?? 0) + allocated[f],
      ]),
    ) as Record<Faculty, number>;

    const investigator: Investigator = {
      name: name.trim(),
      archetype,
      faculties,
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    };

    initInvestigator(investigator);
    onComplete();
  }

  return (
    <div className="min-h-screen bg-gaslight-ink text-gaslight-fog font-serif flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <header className="text-center">
          <h1 className="text-3xl text-gaslight-amber mb-1">Create Your Investigator</h1>
          <p className="text-sm text-gaslight-fog/50">Victorian London awaits. Who are you?</p>
        </header>

        {/* Name input */}
        <div>
          <label htmlFor="investigator-name" className="block text-sm text-gaslight-fog/70 mb-1">
            Investigator Name
          </label>
          <input
            id="investigator-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Elara Voss"
            maxLength={60}
            className="w-full bg-transparent border border-gaslight-fog/30 rounded px-3 py-2 text-gaslight-fog placeholder-gaslight-fog/30 focus:outline-none focus:border-gaslight-amber min-h-[44px]"
          />
        </div>

        {/* Archetype selection */}
        <ArchetypeSelect selected={archetype} onSelect={handleArchetypeSelect} />

        {/* Faculty allocation — only shown once archetype is chosen */}
        {archetype && (
          <FacultyAllocation
            archetype={archetype}
            allocated={allocated}
            onChange={handleFacultyChange}
          />
        )}

        {/* Confirm */}
        <div className="flex flex-col items-end gap-2">
          {archetype && remaining > 0 && (
            <p className="text-xs text-gaslight-fog/50" role="alert">
              Allocate all {BONUS_POINTS_TOTAL} bonus points before confirming.
            </p>
          )}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
            className="px-6 py-3 rounded border-2 border-gaslight-amber text-gaslight-amber font-semibold transition-colors hover:bg-gaslight-amber hover:text-gaslight-ink disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
          >
            Begin Investigation
          </button>
        </div>
      </div>
    </div>
  );
}
