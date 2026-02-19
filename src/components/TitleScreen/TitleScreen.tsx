import React, { useEffect, useState } from 'react';
import { SaveManager } from '../../engine/saveManager';

export interface TitleScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onSettings: () => void;
}

export function TitleScreen({ onNewGame, onLoadGame, onSettings }: TitleScreenProps) {
  const [hasSaves, setHasSaves] = useState(false);

  useEffect(() => {
    const saves = SaveManager.listSaves();
    setHasSaves(saves.length > 0);
  }, []);

  return (
    <main
      role="main"
      className="relative min-h-screen bg-stone-950 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Atmospheric vignette overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 w-full max-w-xs">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-serif text-5xl font-bold text-amber-400 leading-tight tracking-wide">
            Gaslight &amp; Grimoire
          </h1>
          <p className="mt-2 font-serif italic text-stone-400 text-lg">
            A Victorian Mystery
          </p>
        </div>

        {/* Menu buttons */}
        <nav aria-label="Main menu" className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={onNewGame}
            aria-label="Start a new investigation"
            className="w-full min-h-[44px] px-6 py-3 bg-amber-700 hover:bg-amber-600 active:bg-amber-800 text-amber-50 font-serif text-lg rounded border border-amber-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            New Investigation
          </button>

          <button
            type="button"
            onClick={onLoadGame}
            disabled={!hasSaves}
            aria-label={
              hasSaves
                ? 'Continue a saved investigation'
                : 'No saved investigations available'
            }
            className="w-full min-h-[44px] px-6 py-3 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-stone-200 font-serif text-lg rounded border border-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-800"
          >
            Continue Investigation
          </button>

          <button
            type="button"
            onClick={onSettings}
            aria-label="Open settings"
            className="w-full min-h-[44px] px-6 py-3 bg-transparent hover:bg-stone-900 active:bg-stone-950 text-stone-500 hover:text-stone-300 font-serif text-base rounded border border-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-600"
          >
            Settings
          </button>
        </nav>
      </div>
    </main>
  );
}
