/**
 * ClueDiscoveryCard — stub placeholder
 * Full implementation in Task 10.
 */
import React from 'react';
import type { Clue } from '../../types';

export interface ClueDiscoveryCardProps {
  clue?: Clue;
  visible?: boolean;
}

export function ClueDiscoveryCard({ clue, visible = false }: ClueDiscoveryCardProps) {
  if (!visible || !clue) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Clue discovered: ${clue.title}`}
      className="fixed right-4 bottom-4 bg-gaslight-slate border border-gaslight-amber/40 rounded p-3 max-w-xs"
    >
      {/* Slide-in animation and type icon — implemented in Task 10 */}
      <p className="text-xs text-gaslight-amber font-semibold uppercase tracking-wide">
        Clue Discovered
      </p>
      <p className="text-sm text-gaslight-fog mt-1">{clue.title}</p>
    </div>
  );
}
