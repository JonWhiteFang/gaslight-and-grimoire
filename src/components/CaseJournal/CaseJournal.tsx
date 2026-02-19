/**
 * CaseJournal — full-screen overlay with auto-generated case summary.
 *
 * Req 12.10: Auto-updates with a summary of the current Case's key events
 *            in simple prose.
 */
import { useEffect } from 'react';
import { useStore } from '../../store';

// ── Section component ─────────────────────────────────────────────────────────

function JournalSection({
  title,
  children,
  empty,
}: {
  title: string;
  children?: React.ReactNode;
  empty: boolean;
}) {
  return (
    <section className="mb-6">
      <h3 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2">
        {title}
      </h3>
      {empty ? (
        <p className="text-stone-500 italic text-sm">Nothing recorded yet.</p>
      ) : (
        children
      )}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface CaseJournalProps {
  onClose: () => void;
}

export function CaseJournal({ onClose }: CaseJournalProps) {
  const sceneHistory = useStore((s) => s.sceneHistory);
  const flags = useStore((s) => s.flags);
  const deductions = useStore((s) => s.deductions);

  // Escape key closes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Derive content
  const visitedScenes = sceneHistory.filter(Boolean);
  const activeFlags = Object.entries(flags)
    .filter(([, value]) => value)
    .map(([key]) => key);
  const deductionList = Object.values(deductions);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Case Journal"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
    >
      <div className="flex flex-col flex-1 overflow-hidden bg-stone-900/95 max-w-2xl w-full mx-auto my-8 rounded-xl border border-stone-700 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700">
          <h2 className="text-amber-200 text-xl font-bold tracking-wide">
            📖 Case Journal
          </h2>
          <button
            type="button"
            aria-label="Close Case Journal"
            onClick={onClose}
            className="
              text-stone-400 hover:text-white text-2xl font-bold leading-none
              w-11 h-11 flex items-center justify-center
              rounded-lg hover:bg-stone-700/60
              transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white
            "
          >
            ×
          </button>
        </div>

        {/* Journal content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 font-serif text-stone-200">

          {/* Scenes Visited */}
          <JournalSection
            title="Scenes Visited"
            empty={visitedScenes.length === 0}
          >
            <p className="text-sm leading-relaxed text-stone-300">
              Visited:{' '}
              {visitedScenes.join(', ')}
            </p>
          </JournalSection>

          {/* Key Discoveries */}
          <JournalSection
            title="Key Discoveries"
            empty={activeFlags.length === 0}
          >
            <ul className="space-y-1">
              {activeFlags.map((flag) => (
                <li key={flag} className="text-sm text-stone-300">
                  • Discovered: {flag}
                </li>
              ))}
            </ul>
          </JournalSection>

          {/* Deductions Made */}
          <JournalSection
            title="Deductions Made"
            empty={deductionList.length === 0}
          >
            <ul className="space-y-1">
              {deductionList.map((d) => (
                <li key={d.id} className="text-sm text-stone-300">
                  • Deduced: {d.description}
                </li>
              ))}
            </ul>
          </JournalSection>
        </div>
      </div>
    </div>
  );
}
