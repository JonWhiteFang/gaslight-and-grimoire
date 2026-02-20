import React, { useState } from 'react';
import { SaveManager } from '../../engine/saveManager';
import type { SaveSummary } from '../../engine/saveManager';

export interface LoadGameScreenProps {
  onLoad: (saveId: string) => void;
  onBack: () => void;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

export function LoadGameScreen({ onLoad, onBack }: LoadGameScreenProps) {
  const [saves, setSaves] = useState<SaveSummary[]>(() => SaveManager.listSaves());

  function handleDelete(saveId: string) {
    SaveManager.deleteSave(saveId);
    setSaves(SaveManager.listSaves());
  }

  return (
    <main
      role="main"
      className="relative min-h-screen bg-stone-950 flex flex-col items-center justify-center overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-4 w-full max-w-sm">
        <h2 className="font-serif text-3xl font-bold text-amber-400 tracking-wide">
          Saved Investigations
        </h2>

        {saves.length === 0 ? (
          <p className="text-stone-400 font-serif italic text-center">
            No saved investigations found.
          </p>
        ) : (
          <ul
            role="list"
            aria-label="Saved investigations"
            className="w-full flex flex-col gap-2"
          >
            {saves.map((save) => (
              <li key={save.id} role="listitem" className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onLoad(save.id)}
                  aria-label={`Load investigation: ${save.investigatorName}, ${save.caseName}, saved ${formatTimestamp(save.timestamp)}`}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-left rounded border border-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-serif text-amber-300 font-semibold truncate">
                      {save.investigatorName || 'Unknown Investigator'}
                      {save.id === 'autosave' && (
                        <span className="text-stone-500 text-xs ml-2">(auto)</span>
                      )}
                    </span>
                    <span className="font-serif text-stone-400 text-sm shrink-0">
                      {formatTimestamp(save.timestamp)}
                    </span>
                  </div>
                  <div className="font-serif text-stone-400 text-sm mt-0.5 truncate">
                    {save.caseName || 'Unknown Case'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(save.id)}
                  aria-label={`Delete save: ${save.investigatorName}`}
                  className="w-11 h-11 flex items-center justify-center rounded text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 self-center"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onBack}
          aria-label="Back to title screen"
          className="w-full min-h-[44px] px-6 py-3 bg-transparent hover:bg-stone-900 text-stone-500 hover:text-stone-300 font-serif text-base rounded border border-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-600"
        >
          ← Back
        </button>
      </div>
    </main>
  );
}
