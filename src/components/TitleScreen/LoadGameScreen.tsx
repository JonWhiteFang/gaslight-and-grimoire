import { useState } from 'react';
import { SaveManager } from '../../engine/saveManager';
import type { SaveSummary } from '../../engine/saveManager';
import { deslugifyCaseId } from '../../utils/caseTitle';

export interface LoadGameScreenProps {
  onLoad: (saveId: string) => void;
  onBack: () => void;
}

/**
 * Legacy saves stored `caseName` as the raw slug (`the-whitechapel-cipher`);
 * saves created after the title change store the readable title. De-slugify only
 * the slug-shaped ones (hyphenated, no spaces) so both display readably (F-010).
 */
function displayCaseName(caseName: string): string {
  if (!caseName) return 'Unknown Case';
  const looksLikeSlug = caseName.includes('-') && !caseName.includes(' ');
  return looksLikeSlug ? deslugifyCaseId(caseName) : caseName;
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
  // Two-tap delete confirmation (F-054): the first tap arms a save for deletion
  // (button becomes "Confirm?"), a second tap deletes it. Arming a different
  // save, or the auto-disarm timeout, cancels — so one accidental tap can't
  // destroy a playthrough.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function handleDeleteClick(saveId: string) {
    if (pendingDeleteId === saveId) {
      SaveManager.deleteSave(saveId);
      setSaves(SaveManager.listSaves());
      setPendingDeleteId(null);
    } else {
      setPendingDeleteId(saveId);
    }
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
                    {displayCaseName(save.caseName)}
                  </div>
                </button>
                {pendingDeleteId === save.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(save.id)}
                    onBlur={() => setPendingDeleteId(null)}
                    aria-label={`Confirm deletion of save: ${save.investigatorName}`}
                    autoFocus
                    className="min-w-[44px] h-11 px-2 flex items-center justify-center rounded bg-red-900 text-red-100 text-xs font-serif hover:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 self-center"
                  >
                    Confirm?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(save.id)}
                    aria-label={`Delete save: ${save.investigatorName}`}
                    className="w-11 h-11 flex items-center justify-center rounded text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 self-center"
                  >
                    ✕
                  </button>
                )}
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
