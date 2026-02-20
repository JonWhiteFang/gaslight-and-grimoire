/**
 * DeductionButton — triggers a Reason Faculty_Check to form a Deduction.
 *
 * Req 7.6: When ≥2 clues are connected, "Attempt Deduction" triggers a Reason check.
 * Req 7.7: On success, lock clues as 'deduced', add Deduction to store.
 * Req 7.8: On failure, animate thread slack; reset clues to 'examined' after 2s.
 * Req 7.10: If any connected clue is a Red Herring, isRedHerring = true.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { performCheck } from '../../engine/diceEngine';
import { useStore, useInvestigator } from '../../store';
import { buildDeduction } from './buildDeduction';

interface DeductionButtonProps {
  connectedClueIds: string[];
  /** Called with 'success' | 'failure' so EvidenceBoard can animate threads */
  onResult: (result: 'success' | 'failure') => void;
}

type Phase = 'idle' | 'rolling' | 'success' | 'failure';

const DEDUCTION_DC = 14;

export function DeductionButton({ connectedClueIds, onResult }: DeductionButtonProps) {
  const investigator = useInvestigator();
  const clues = useStore((s) => s.clues);
  const addDeduction = useStore((s) => s.addDeduction);
  const updateClueStatus = useStore((s) => s.updateClueStatus);

  const [phase, setPhase] = useState<Phase>('idle');
  const [lastTier, setLastTier] = useState<string | null>(null);
  const idsRef = useRef(connectedClueIds);
  idsRef.current = connectedClueIds;

  if (connectedClueIds.length < 2) return null;

  function handleAttempt() {
    if (phase === 'rolling') return;
    setPhase('rolling');

    const result = performCheck('reason', investigator, DEDUCTION_DC, false, false);
    setLastTier(result.tier);

    if (result.tier === 'success' || result.tier === 'critical') {
      // Build and store the deduction
      const deduction = buildDeduction(connectedClueIds, clues);
      addDeduction(deduction);
      connectedClueIds.forEach((id) => updateClueStatus(id, 'deduced'));
      setPhase('success');
      onResult('success');
    } else {
      // Failure or partial — mark contested, reset to examined after 2s
      connectedClueIds.forEach((id) => updateClueStatus(id, 'contested'));
      setPhase('failure');
      onResult('failure');
      setTimeout(() => {
        idsRef.current.forEach((id) => updateClueStatus(id, 'examined'));
        setPhase('idle');
      }, 2000);
    }
  }

  const tierLabel: Record<string, string> = {
    critical: 'Critical Success!',
    success: 'Success!',
    partial: 'Partial — not enough...',
    failure: 'Failed.',
    fumble: 'Fumble!',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={handleAttempt}
        disabled={phase === 'rolling' || phase === 'success'}
        aria-label="Attempt Deduction — perform a Reason check to connect these clues"
        whileTap={{ scale: 0.96 }}
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
      </motion.button>

      <AnimatePresence>
        {lastTier && phase !== 'idle' && (
          <motion.p
            key={lastTier}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={[
              'text-xs font-medium',
              phase === 'success' ? 'text-green-400' : 'text-red-400',
            ].join(' ')}
            aria-live="polite"
          >
            {tierLabel[lastTier] ?? lastTier}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
