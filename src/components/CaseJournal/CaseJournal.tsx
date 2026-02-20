/**
 * CaseJournal — full-screen overlay with narrative-friendly case summary.
 *
 * Req 12.10: Auto-updates with a summary of the current Case's key events.
 */
import { useEffect } from 'react';
import { useStore } from '../../store';

const INTERNAL_FLAG_PREFIXES = ['ability-', 'vignette-unlocked-', 'last-critical-faculty'];

const CLUE_TYPE_ICONS: Record<string, string> = {
  physical: '🔍',
  testimony: '💬',
  occult: '🔮',
  deduction: '🧠',
  redHerring: '🐟',
};

function reputationLabel(value: number): string {
  if (value >= 5) return 'Allied';
  if (value >= 2) return 'Favorable';
  if (value >= -1) return 'Neutral';
  if (value >= -4) return 'Strained';
  return 'Hostile';
}

function formatFlag(flag: string): string {
  return flag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isStoryFlag(flag: string): boolean {
  return !INTERNAL_FLAG_PREFIXES.some((p) => flag.startsWith(p));
}

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

export interface CaseJournalProps {
  onClose: () => void;
}

export function CaseJournal({ onClose }: CaseJournalProps) {
  const clues = useStore((s) => s.clues);
  const flags = useStore((s) => s.flags);
  const deductions = useStore((s) => s.deductions);
  const factionReputation = useStore((s) => s.factionReputation);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const revealedClues = Object.values(clues).filter((c) => c.isRevealed);
  const deductionList = Object.values(deductions);
  const factionEntries = Object.entries(factionReputation).filter(([, v]) => v !== 0);

  const storyFlags = Object.entries(flags)
    .filter(([key, value]) => value && isStoryFlag(key))
    .map(([key]) => key);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Case Journal"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
    >
      <div className="flex flex-col flex-1 overflow-hidden bg-stone-900/95 max-w-2xl w-full mx-auto my-8 rounded-xl border border-stone-700 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700">
          <h2 className="text-amber-200 text-xl font-bold tracking-wide">
            📖 Case Journal
          </h2>
          <button
            type="button"
            aria-label="Close Case Journal"
            onClick={onClose}
            className="text-stone-400 hover:text-white text-2xl font-bold leading-none w-11 h-11 flex items-center justify-center rounded-lg hover:bg-stone-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 font-serif text-stone-200">
          <JournalSection title="Clues Gathered" empty={revealedClues.length === 0}>
            <ul className="space-y-2">
              {revealedClues.map((clue) => (
                <li key={clue.id} className="flex items-start gap-2 text-sm text-stone-300">
                  <span aria-hidden="true">{CLUE_TYPE_ICONS[clue.type] ?? '📄'}</span>
                  <div>
                    <span className="text-amber-300 font-semibold">{clue.title}</span>
                    <p className="text-stone-400 text-xs mt-0.5">{clue.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </JournalSection>

          <JournalSection title="Deductions Made" empty={deductionList.length === 0}>
            <ul className="space-y-1">
              {deductionList.map((d) => (
                <li key={d.id} className="text-sm text-stone-300">
                  • {d.description}
                  {d.isRedHerring && (
                    <span className="text-red-400 text-xs ml-2">(questionable)</span>
                  )}
                </li>
              ))}
            </ul>
          </JournalSection>

          <JournalSection title="Key Events" empty={storyFlags.length === 0}>
            <ul className="space-y-1">
              {storyFlags.map((flag) => (
                <li key={flag} className="text-sm text-stone-300">
                  • {formatFlag(flag)}
                </li>
              ))}
            </ul>
          </JournalSection>

          <JournalSection title="Faction Standing" empty={factionEntries.length === 0}>
            <ul className="space-y-1">
              {factionEntries.map(([faction, rep]) => (
                <li key={faction} className="text-sm text-stone-300 flex items-center justify-between">
                  <span className="text-amber-300">{faction}</span>
                  <span className="text-xs text-stone-400">{reputationLabel(rep)}</span>
                </li>
              ))}
            </ul>
          </JournalSection>
        </div>
      </div>
    </div>
  );
}
