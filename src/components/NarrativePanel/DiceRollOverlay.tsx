/**
 * DiceRollOverlay — animated d20 result display.
 *
 * Shows the roll value, modifier, and total after a Faculty_Check.
 * When reducedMotion is true, skips animation and shows result directly.
 */
import { m, AnimatePresence } from 'framer-motion';

export interface DiceRollOverlayProps {
  roll?: number;
  modifier?: number;
  total?: number;
  dc?: number;
  visible?: boolean;
  reducedMotion?: boolean;
}

export function DiceRollOverlay({
  roll,
  modifier = 0,
  total,
  dc,
  visible = false,
  reducedMotion = false,
}: DiceRollOverlayProps) {
  if (!visible || roll == null || total == null) return null;

  const modifierLabel =
    modifier >= 0 ? `+${modifier}` : `${modifier}`;

  const rollLabel = `Dice roll: ${roll} ${modifierLabel} = ${total}`;
  const ariaLabel = dc == null ? rollLabel : `${rollLabel}, versus difficulty ${dc}`;

  return (
    <AnimatePresence>
      <m.div
        key="dice-overlay"
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gaslight-slate/80 border border-gaslight-amber/30"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reducedMotion ? {} : { opacity: 0, scale: 0.8 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* D20 face */}
        <m.div
          className="text-5xl select-none"
          aria-hidden="true"
          animate={reducedMotion ? {} : { rotate: [0, -15, 15, -10, 10, 0] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        >
          🎲
        </m.div>

        {/* Roll breakdown */}
        <div className="flex items-center gap-2 text-sm font-mono text-gaslight-fog">
          <span aria-label={`Roll: ${roll}`} className="text-2xl font-bold text-gaslight-amber">
            {roll}
          </span>
          <span className="text-gaslight-fog/60" aria-hidden="true">
            {modifierLabel}
          </span>
          <span className="text-gaslight-fog/60" aria-hidden="true">=</span>
          <span
            aria-label={`Total: ${total}`}
            className="text-2xl font-bold text-gaslight-fog"
          >
            {total}
          </span>
          {dc != null && (
            <>
              <span className="text-gaslight-fog/60" aria-hidden="true">vs</span>
              <span className="text-gaslight-fog/80" aria-hidden="true">DC {dc}</span>
            </>
          )}
        </div>

        {/* The container's aria-label is the authoritative announcement (incl. DC);
            this sr-only line is a static fallback and intentionally omits the DC to
            avoid a duplicated DOM reading. */}
        <p className="text-xs text-gaslight-fog/50 sr-only">
          Roll {roll}, modifier {modifierLabel}, total {total}
        </p>
      </m.div>
    </AnimatePresence>
  );
}
