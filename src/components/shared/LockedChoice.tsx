/**
 * LockedChoice — a disabled, non-interactive choice (Phase 5). Renders a gated
 * choice the author chose to SHOW rather than hide, greyed out with a diegetic
 * gateReason. Redundant cues (icon + text + colour, per G2). Static — no live region.
 *
 * Rendered as an <li> so it lives inside a proper locked-choices <ul>, OUTSIDE the
 * interactive "Available choices" <nav> (Phase 5 spec §6). Not focusable, not a button.
 *
 * CONTRAST (Codex plan review): do NOT apply opacity-* to the subtree — compositing
 * at 60% drops stone-400/stone-500 on the #1a1a2e ink below the AA 4.5:1 body
 * threshold the Phase-4 sweep established. The disabled state is conveyed by the
 * lock icon + line-through + muted border/background, and both text runs use
 * text-stone-400 (established ink ratio 6.60:1) at text-sm — both pass AA.
 */
export interface LockedChoiceProps {
  text: string;
  gateReason: string;
}

export function LockedChoice({ text, gateReason }: LockedChoiceProps) {
  return (
    <li className="w-full px-4 py-3 rounded-lg border border-stone-700/60 bg-gaslight-ink/50">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-stone-400 text-sm mt-0.5">🔒</span>
        <div className="flex-1">
          <span className="text-stone-400 font-serif leading-snug line-through decoration-stone-600">
            {text}
          </span>
          <p className="mt-1 text-sm text-stone-400 font-serif">{gateReason}</p>
        </div>
      </div>
    </li>
  );
}
