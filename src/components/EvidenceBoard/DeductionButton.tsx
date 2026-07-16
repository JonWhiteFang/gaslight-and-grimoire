/**
 * DeductionButton — rolls a Reason Faculty_Check for an attempted deduction.
 *
 * Phase 2b: the button NO LONGER forms deductions or writes clue status. It only
 * rolls the d20 and reports the raw tier via `onResult(tier)`; the board runs the
 * correctness oracle and owns all formation, status changes, and the outcome
 * banner (enacts ADR-0012 — correctness gates formation, the roll only flavours
 * it). The button carries no terminal phase, so a second attempt on a fresh
 * connection set is never blocked (Major 5).
 */
import { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import { performCheck } from '../../engine/diceEngine';
import { useInvestigator, useSettings } from '../../store';
import type { OutcomeTier } from '../../types';

interface DeductionButtonProps {
  connectedClueIds: string[];
  /** Called after the roll with the raw performCheck tier; the board decides the
   *  outcome from the oracle, not from this tier. */
  onResult: (tier: OutcomeTier) => void;
}

const DEDUCTION_DC = 14;

export function DeductionButton({ connectedClueIds, onResult }: DeductionButtonProps) {
  const investigator = useInvestigator();
  const reducedMotion = useSettings().reducedMotion;

  // Only a synchronous guard against a double-click mid-roll — NOT a terminal
  // phase. The board-owned banner carries the outcome; the button re-enables as
  // soon as the roll returns so a new connection set can be attempted (Major 5).
  const [rolling, setRolling] = useState(false);

  // Reset the transient guard whenever the connection set changes, so a fresh
  // set always presents an enabled button.
  const idsSignature = connectedClueIds.join('|');
  useEffect(() => {
    setRolling(false);
  }, [idsSignature]);

  if (connectedClueIds.length < 2) return null;

  function handleAttempt() {
    if (rolling) return;
    setRolling(true);
    const result = performCheck('reason', investigator, DEDUCTION_DC, false, false);
    onResult(result.tier);
    setRolling(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <m.button
        type="button"
        onClick={handleAttempt}
        disabled={rolling}
        aria-label="Attempt Deduction — perform a Reason check to connect these clues"
        whileTap={reducedMotion ? undefined : { scale: 0.96 }}
        className={[
          'px-5 py-2.5 rounded-lg font-semibold text-sm tracking-wide',
          'border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
          'bg-amber-800 border-amber-600 text-amber-100 hover:bg-amber-700 cursor-pointer',
        ].join(' ')}
      >
        {rolling ? 'Rolling…' : '🧠 Attempt Deduction'}
      </m.button>
    </div>
  );
}
