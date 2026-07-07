/**
 * InvestigationHalted — failure screen shown when the investigator's composure
 * or vitality reaches 0 (F-011, issue #9). Distinct from the "Case Complete"
 * success terminal so a knockout is not mislabelled as a triumph.
 */

export type HaltReason = 'composure' | 'vitality';

export interface InvestigationHaltedProps {
  reason: HaltReason;
  onReturn: () => void;
}

const HALT_COPY: Record<HaltReason, { lead: string; body: string }> = {
  composure: {
    lead: 'Your composure has broken.',
    body: 'The horrors you have witnessed overwhelm the rational mind. You can no longer think clearly enough to press on, and the case slips through your trembling fingers.',
  },
  vitality: {
    lead: 'Your strength has failed you.',
    body: 'Your body can carry the investigation no further. Bloodied and spent, you are pulled from the brink — but the trail has gone cold, and the case is lost.',
  },
};

export function InvestigationHalted({ reason, onReturn }: InvestigationHaltedProps) {
  const { lead, body } = HALT_COPY[reason];
  return (
    <main className="min-h-screen bg-gaslight-ink text-gaslight-fog font-serif flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <h1 className="text-3xl font-bold text-gaslight-crimson tracking-wide">
          Investigation Halted
        </h1>

        <div className="space-y-3">
          <p className="text-lg text-gaslight-fog">{lead}</p>
          <p className="text-left text-gaslight-fog/80 leading-relaxed italic border-l-2 border-gaslight-crimson/40 pl-4">
            {body}
          </p>
        </div>

        <button
          type="button"
          onClick={onReturn}
          className="px-8 py-3 bg-stone-800 hover:bg-stone-700 text-gaslight-fog font-serif text-lg rounded border border-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gaslight-crimson"
        >
          Return to Case List
        </button>
      </div>
    </main>
  );
}
