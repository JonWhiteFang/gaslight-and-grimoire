/**
 * ProgressSummary — shows clue and deduction counts.
 * Totals are always shown as "?" until case complete (Req 7.9).
 */
import React from 'react';

export interface ProgressSummaryProps {
  clueCount: number;
  deductionCount: number;
}

export function ProgressSummary({ clueCount, deductionCount }: ProgressSummaryProps) {
  return (
    <div
      className="flex items-center gap-4 text-stone-300 text-sm font-medium"
      aria-label="Investigation progress"
    >
      <span>
        Clues:{' '}
        <span className="text-amber-400 font-bold">{clueCount}</span>
        <span className="text-stone-500">/? </span>
      </span>
      <span className="text-stone-600">·</span>
      <span>
        Deductions:{' '}
        <span className="text-green-400 font-bold">{deductionCount}</span>
        <span className="text-stone-500">/?</span>
      </span>
    </div>
  );
}
