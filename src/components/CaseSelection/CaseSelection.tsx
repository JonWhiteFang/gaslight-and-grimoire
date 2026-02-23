import React, { useEffect, useState } from 'react';
import type { CaseManifest, CaseManifestEntry } from '../../types';
import { fetchManifest } from '../../engine/narrativeEngine';
import { useStore } from '../../store';

export interface CaseSelectionProps {
  onSelectCase: (id: string, type: 'case' | 'vignette') => void;
  onBack: () => void;
}

export function CaseSelection({ onSelectCase, onBack }: CaseSelectionProps) {
  const [manifest, setManifest] = useState<CaseManifest | null>(null);
  const flags = useStore((s) => s.flags);

  useEffect(() => {
    fetchManifest().then(setManifest);
  }, []);

  if (!manifest) {
    return (
      <main className="min-h-screen bg-stone-950 text-gaslight-fog font-serif flex items-center justify-center">
        <p className="text-gaslight-amber animate-pulse">Loading cases…</p>
      </main>
    );
  }

  const mainCases = manifest.cases.filter((c) => c.type === 'case');
  const vignettes = manifest.cases.filter((c) => c.type === 'vignette');

  function isUnlocked(entry: CaseManifestEntry): boolean {
    if (entry.type === 'case') return true;
    return !!flags[`vignette-unlocked-${entry.id}`];
  }

  return (
    <main className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-gaslight-amber tracking-wide">
            Select Investigation
          </h1>
          <p className="mt-1 font-serif italic text-stone-400 text-sm">
            Choose your next case, investigator.
          </p>
        </div>

        {/* Main cases */}
        <section aria-label="Main cases" className="space-y-3">
          {mainCases.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectCase(entry.id, entry.type)}
              className="w-full text-left min-h-[44px] p-4 bg-stone-900/80 hover:bg-stone-800 border border-stone-700 hover:border-gaslight-amber/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <h2 className="font-serif text-lg text-gaslight-amber">{entry.title}</h2>
              <p className="mt-1 text-sm text-stone-400 leading-snug">{entry.synopsis}</p>
            </button>
          ))}
        </section>

        {/* Vignettes */}
        {vignettes.length > 0 && (
          <section aria-label="Side investigations" className="space-y-3">
            <h2 className="font-serif text-sm uppercase tracking-widest text-stone-500">
              Side Investigations
            </h2>
            {vignettes.map((entry) => {
              const unlocked = isUnlocked(entry);
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && onSelectCase(entry.id, entry.type)}
                  className={`w-full text-left min-h-[44px] p-4 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    unlocked
                      ? 'bg-stone-900/80 hover:bg-stone-800 border-stone-700 hover:border-gaslight-amber/50'
                      : 'bg-stone-900/40 border-stone-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!unlocked && <span aria-hidden="true">🔒</span>}
                    <h3 className={`font-serif text-lg ${unlocked ? 'text-gaslight-gold' : 'text-stone-500'}`}>
                      {entry.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-stone-400 leading-snug">{entry.synopsis}</p>
                  {!unlocked && (
                    <p className="mt-1 text-xs text-stone-600 italic">Requires further reputation in London's factions.</p>
                  )}
                </button>
              );
            })}
          </section>
        )}

        <button
          type="button"
          onClick={onBack}
          className="w-full min-h-[44px] px-6 py-3 bg-transparent hover:bg-stone-900 text-stone-500 hover:text-stone-300 font-serif text-base rounded border border-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-600"
        >
          Back
        </button>
      </div>
    </main>
  );
}
