/**
 * CaseCompletion — results screen shown after completing a case.
 * Displays ending narrative, faculty bonus granted, and vignette unlocked.
 */
import type { Faculty } from '../../types';

export interface CaseCompletionProps {
  facultyBonusGranted: Faculty | null;
  vignetteUnlocked: string | null;
  endingNarrative?: string | null;
  onContinue: () => void;
}

const FACULTY_LABELS: Record<Faculty, string> = {
  reason: 'Reason',
  perception: 'Perception',
  nerve: 'Nerve',
  vigor: 'Vigor',
  influence: 'Influence',
  lore: 'Lore',
};

export function CaseCompletion({ facultyBonusGranted, vignetteUnlocked, endingNarrative, onContinue }: CaseCompletionProps) {
  return (
    <main className="min-h-screen bg-gaslight-ink text-gaslight-fog font-serif flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <h1 className="text-3xl font-bold text-gaslight-amber tracking-wide">
          Case Complete
        </h1>

        {endingNarrative && (
          <blockquote className="text-left text-gaslight-fog/80 leading-relaxed italic border-l-2 border-gaslight-amber/30 pl-4">
            {endingNarrative}
          </blockquote>
        )}

        <div className="space-y-4">
          {facultyBonusGranted && (
            <div className="bg-stone-900/80 border border-gaslight-amber/30 rounded-lg p-4">
              <p className="text-xs text-gaslight-amber uppercase tracking-widest mb-1">Faculty Advancement</p>
              <p className="text-lg text-gaslight-fog">
                {FACULTY_LABELS[facultyBonusGranted]} +1
              </p>
            </div>
          )}

          {vignetteUnlocked && (
            <div className="bg-stone-900/80 border border-gaslight-gold/30 rounded-lg p-4">
              <p className="text-xs text-gaslight-gold uppercase tracking-widest mb-1">New Lead Discovered</p>
              <p className="text-lg text-gaslight-fog">
                A new investigation has become available.
              </p>
            </div>
          )}

          {!facultyBonusGranted && !vignetteUnlocked && (
            <p className="text-stone-400 italic">
              The case is closed, but London's mysteries are far from over.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-serif text-lg rounded border border-amber-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          Return to London
        </button>
      </div>
    </main>
  );
}
