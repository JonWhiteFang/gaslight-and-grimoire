/**
 * VitalityMeter — animated physical health bar (0–10).
 *
 * Req 5.1: Display Vitality as an animated meter bar.
 * Req 5.2: On decrease, pulse red and show "Bruised" for 3 s.
 * Req 5.3: On increase, pulse warm gold and show "Mended" for 3 s.
 * Req 5.4: At ≤ 2, shift to persistent pulsing red (critical threshold).
 * Req 5.6: When Vitality reaches 0, trigger Incapacitation narrative event.
 * Req 5.7: When reducedMotion is true, suppress all pulse animations.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export interface VitalityMeterProps {
  value: number;
  reducedMotion?: boolean;
  onIncapacitation?: () => void;
}

type PulseState = 'decrease' | 'increase' | null;

const DESCRIPTOR_DURATION_MS = 3000;

export function VitalityMeter({
  value,
  reducedMotion = false,
  onIncapacitation,
}: VitalityMeterProps) {
  const prevValueRef = useRef<number>(value);
  const [pulseState, setPulseState] = useState<PulseState>(null);
  const [descriptor, setDescriptor] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCritical = value <= 2 && value > 0;
  const pct = (value / 10) * 100;

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (value === 0) {
      onIncapacitation?.();
      return;
    }

    if (value === prev) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!reducedMotion) {
      if (value < prev) {
        setPulseState('decrease');
        setDescriptor('Bruised');
      } else {
        setPulseState('increase');
        setDescriptor('Mended');
      }

      timerRef.current = setTimeout(() => {
        setPulseState(null);
        setDescriptor(null);
      }, DESCRIPTOR_DURATION_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, reducedMotion, onIncapacitation]);

  const barClass =
    pulseState === 'decrease' || isCritical
      ? 'bg-red-500'
      : pulseState === 'increase'
        ? 'bg-yellow-400'
        : 'bg-green-500';

  const criticalPulse = isCritical && !reducedMotion;

  return (
    <div
      className="flex flex-col gap-1"
      aria-label={`Vitality: ${value} out of 10`}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={10}
    >
      <div className="flex items-center justify-between text-xs text-gaslight-fog/70">
        <span className="font-semibold tracking-wide uppercase">Vitality</span>
        <span className="tabular-nums">{value}/10</span>
      </div>

      <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barClass} ${criticalPulse ? 'animate-pulse' : ''}`}
          animate={{ width: `${pct}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
          data-testid="vitality-bar"
        />
      </div>

      {descriptor && !reducedMotion && (
        <motion.span
          key={descriptor + value}
          className="text-xs text-center"
          style={{ color: pulseState === 'decrease' ? '#f87171' : '#fbbf24' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-live="polite"
        >
          {descriptor}
        </motion.span>
      )}
    </div>
  );
}
