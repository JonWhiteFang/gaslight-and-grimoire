/**
 * ComposureMeter — animated mental stability bar (0–10).
 */
import React, { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';

export interface ComposureMeterProps {
  value: number;
  reducedMotion?: boolean;
  onBreakdown?: () => void;
}

type PulseState = 'decrease' | 'increase' | null;

const DESCRIPTOR_DURATION_MS = 3000;

export function ComposureMeter({
  value,
  reducedMotion = false,
  onBreakdown,
}: ComposureMeterProps) {
  const prevValueRef = useRef<number>(value);
  const [pulseState, setPulseState] = useState<PulseState>(null);
  const [descriptor, setDescriptor] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against firing the Breakdown callback more than once per zero-episode.
  // The parent (StatusBar) passes a fresh inline closure each render, so this
  // effect re-runs on every render; without this ref, onBreakdown would fire
  // repeatedly while value stays 0, polluting sceneHistory and autosaves.
  const breakdownFiredRef = useRef<boolean>(false);

  const isCritical = value <= 2 && value > 0;
  const pct = (value / 10) * 100;

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (value === 0) {
      if (!breakdownFiredRef.current) {
        breakdownFiredRef.current = true;
        onBreakdown?.();
      }
      return;
    }

    // Value recovered above 0 — re-arm the terminal callback.
    breakdownFiredRef.current = false;

    if (value === prev) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!reducedMotion) {
      if (value < prev) {
        setPulseState('decrease');
        setDescriptor('Shaken');
      } else {
        setPulseState('increase');
        setDescriptor('Steadied');
      }

      timerRef.current = setTimeout(() => {
        setPulseState(null);
        setDescriptor(null);
      }, DESCRIPTOR_DURATION_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, reducedMotion, onBreakdown]);

  // Bar colour classes
  const barClass =
    pulseState === 'decrease' || isCritical
      ? 'bg-red-500'
      : pulseState === 'increase'
        ? 'bg-yellow-400'
        : 'bg-blue-400';

  const criticalPulse = isCritical && !reducedMotion;

  return (
    <div
      className="flex flex-col gap-1"
      aria-label={`Composure: ${value} out of 10`}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={10}
    >
      <div className="flex items-center justify-between text-xs text-gaslight-fog/70">
        <span className="font-semibold tracking-wide uppercase">Composure</span>
        <span className="tabular-nums">{value}/10</span>
      </div>

      <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden">
        <m.div
          className={`h-full rounded-full ${barClass} ${criticalPulse ? 'animate-pulse' : ''}`}
          animate={{ width: `${pct}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
          data-testid="composure-bar"
        />
      </div>

      {descriptor && !reducedMotion && (
        <m.span
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
        </m.span>
      )}
    </div>
  );
}
