/**
 * StatusBar — parent component composing ComposureMeter and VitalityMeter.
 *
 * Wires store actions: adjustComposure / adjustVitality trigger Breakdown /
 * Incapacitation narrative events via goToScene when either reaches 0.
 *
 * Req 5.1–5.7
 */
import React from 'react';
import { useStore } from '../../store';
import { ComposureMeter } from './ComposureMeter';
import { VitalityMeter } from './VitalityMeter';

export function StatusBar() {
  const composure = useStore((s) => s.investigator.composure);
  const vitality = useStore((s) => s.investigator.vitality);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const goToScene = useStore((s) => s.goToScene);

  return (
    <div
      className="flex flex-col gap-3 px-4 py-3 bg-black/30 border-t border-white/10"
      aria-label="Investigator status"
    >
      <ComposureMeter
        value={composure}
        reducedMotion={reducedMotion}
        onBreakdown={() => goToScene('breakdown')}
      />
      <VitalityMeter
        value={vitality}
        reducedMotion={reducedMotion}
        onIncapacitation={() => goToScene('incapacitation')}
      />
    </div>
  );
}
