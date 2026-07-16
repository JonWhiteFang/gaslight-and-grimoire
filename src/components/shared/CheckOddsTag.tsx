/**
 * CheckOddsTag — decorative pre-roll odds display (DC + Prospects band, or an
 * "Assured" treatment for guaranteed auto-succeed checks).
 *
 * DECORATIVE ONLY (aria-hidden): the odds are conveyed to assistive tech by the
 * PARENT control appending `describeCheckOdds(odds)` to its own button aria-label,
 * because the button's explicit aria-label overrides descendant text (Phase 3 spec §2.3).
 * It deliberately renders NO advantage glyph — ChoiceCard/SceneCluePrompts own that.
 */
import type { CheckOdds, ProspectsBand } from '../../engine/checkOdds';

const BAND_LABEL: Record<ProspectsBand, string> = {
  favourable: 'Favourable', uncertain: 'Uncertain', forbidding: 'Forbidding',
};

const BAND_STYLE: Record<ProspectsBand, string> = {
  favourable: 'text-green-300 border-green-700',
  uncertain: 'text-amber-300 border-amber-700',
  forbidding: 'text-red-300 border-red-700',
};

const ASSURED_STYLE = 'text-yellow-300 border-yellow-400/60';

export interface CheckOddsTagProps {
  odds: CheckOdds;
}

export function CheckOddsTag({ odds }: CheckOddsTagProps) {
  if (odds.autoSucceeds) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ASSURED_STYLE}`}
      >
        Assured
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${BAND_STYLE[odds.band]}`}
    >
      <span>vs DC {odds.dc}</span>
      <span className="opacity-75">· Prospects: {BAND_LABEL[odds.band]}</span>
    </span>
  );
}
