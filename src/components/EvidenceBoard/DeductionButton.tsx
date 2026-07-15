/**
 * DeductionButton — triggers a Reason Faculty_Check to form a Deduction.
 */
import { useState, useRef } from 'react';
import { m } from 'framer-motion';
import { performCheck } from '../../engine/diceEngine';
import { useStore, useInvestigator, useSettings } from '../../store';
import { buildDeduction, buildDeductionFromRecipe, matchDeduction } from '../../engine/buildDeduction';
import type { OutcomeTier } from '../../types';

interface DeductionButtonProps {
  connectedClueIds: string[];
  /** Called after an attempt with the outcome and the roll tier so the board can
   *  render + announce the message. `tier` is the raw performCheck tier. */
  onResult: (result: 'success' | 'failure', tier: OutcomeTier) => void;
}

type Phase = 'idle' | 'rolling' | 'success' | 'failure';

const DEDUCTION_DC = 14;

// Stable empty-array reference for the recipes selector. Returning a fresh `[]`
// from a Zustand selector re-triggers a render every time (v5 uses strict
// Object.is snapshot caching), which loops under React 19 — so the fallback
// must be a single shared reference, not a new literal per render.
const NO_RECIPES: never[] = [];

export function DeductionButton({ connectedClueIds, onResult }: DeductionButtonProps) {
  const investigator = useInvestigator();
  const reducedMotion = useSettings().reducedMotion;
  const clues = useStore((s) => s.clues);
  const addDeduction = useStore((s) => s.addDeduction);
  const recipes = useStore((s) => s.caseData?.recipes ?? NO_RECIPES);
  const updateClueStatus = useStore((s) => s.updateClueStatus);

  const [phase, setPhase] = useState<Phase>('idle');
  const idsRef = useRef(connectedClueIds);
  idsRef.current = connectedClueIds;

  if (connectedClueIds.length < 2) return null;

  function handleAttempt() {
    if (phase === 'rolling') return;
    setPhase('rolling');

    const result = performCheck('reason', investigator, DEDUCTION_DC, false, false);

    if (result.tier === 'success' || result.tier === 'critical') {
      // Prefer a named key-deduction recipe (stored under its stable authored id
      // so hasDeduction gates resolve); otherwise fall back to a generic deduction.
      const recipe = matchDeduction(connectedClueIds, recipes);
      const deduction = recipe
        ? buildDeductionFromRecipe(recipe, connectedClueIds)
        : buildDeduction(connectedClueIds, clues);
      addDeduction(deduction);
      connectedClueIds.forEach((id) => updateClueStatus(id, 'deduced'));
      setPhase('success');
      onResult('success', result.tier);
    } else {
      // Failure or partial — mark contested, reset to examined after 2s
      connectedClueIds.forEach((id) => updateClueStatus(id, 'contested'));
      setPhase('failure');
      onResult('failure', result.tier);
      setTimeout(() => {
        idsRef.current.forEach((id) => updateClueStatus(id, 'examined'));
        setPhase('idle');
      }, 2000);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <m.button
        type="button"
        onClick={handleAttempt}
        disabled={phase === 'rolling' || phase === 'success'}
        aria-label="Attempt Deduction — perform a Reason check to connect these clues"
        whileTap={reducedMotion ? undefined : { scale: 0.96 }}
        className={[
          'px-5 py-2.5 rounded-lg font-semibold text-sm tracking-wide',
          'border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
          phase === 'success'
            ? 'bg-green-800 border-green-600 text-green-200 cursor-default'
            : phase === 'failure'
              ? 'bg-red-900 border-red-700 text-red-200 cursor-default'
              : 'bg-amber-800 border-amber-600 text-amber-100 hover:bg-amber-700 cursor-pointer',
        ].join(' ')}
      >
        {phase === 'rolling'
          ? 'Rolling…'
          : phase === 'success'
            ? '🔒 Deduction Locked'
            : phase === 'failure'
              ? '🔴 Attempt Failed'
              : '🧠 Attempt Deduction'}
      </m.button>
    </div>
  );
}
