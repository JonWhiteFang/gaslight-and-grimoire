/**
 * ClueCard — draggable clue card with six visual status states.
 *
 * Status states:
 *   new       — pulsing amber glow + "NEW" badge
 *   examined  — standard appearance
 *   connected — gold border indicator
 *   deduced   — brass pin icon (📌) + green glow
 *   contested — red border + question mark icon (❓)
 *   spent     — greyed out (opacity-50) + checkmark (✓)
 */
import React, { useRef } from 'react';
import type { Clue } from '../../types';

// ─── Type icon map ────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  physical: '🔍',
  testimony: '💬',
  occult: '🔮',
  deduction: '🧠',
  redHerring: '🐟',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClueCardProps {
  clue: Clue;
  /** Called when the user initiates a connection from this card (Spacebar). */
  onInitiateConnection?: (clueId: string) => void;
  /** Whether this card is currently selected as the connection source. */
  isConnecting?: boolean;
  /** Whether this card should be brightened (shares a tag with the source). */
  isBrightened?: boolean;
}

// ─── Status-specific styles ───────────────────────────────────────────────────

function getStatusClasses(status: Clue['status']): string {
  switch (status) {
    case 'new':
      return 'animate-pulse ring-2 ring-amber-400 shadow-amber-400/60 shadow-lg';
    case 'examined':
      return '';
    case 'connected':
      return 'ring-2 ring-yellow-500 border-yellow-500';
    case 'deduced':
      return 'ring-2 ring-green-500 shadow-green-400/60 shadow-lg';
    case 'contested':
      return 'ring-2 ring-red-500 border-red-500';
    case 'spent':
      return 'opacity-50 grayscale';
    default:
      return '';
  }
}

// ─── Status indicator (badge / icon) ─────────────────────────────────────────

function StatusIndicator({ status }: { status: Clue['status'] }) {
  switch (status) {
    case 'new':
      return (
        <span
          className="absolute -top-2 -right-2 bg-amber-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full"
          aria-label="New clue"
        >
          NEW
        </span>
      );
    case 'deduced':
      return (
        <span className="absolute -top-2 -right-2 text-lg" aria-label="Deduced">
          📌
        </span>
      );
    case 'contested':
      return (
        <span className="absolute -top-2 -right-2 text-lg" aria-label="Contested">
          ❓
        </span>
      );
    case 'spent':
      return (
        <span
          className="absolute -top-2 -right-2 text-green-400 text-lg font-bold"
          aria-label="Spent"
        >
          ✓
        </span>
      );
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClueCard({
  clue,
  onInitiateConnection,
  isConnecting = false,
  isBrightened = false,
}: ClueCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onInitiateConnection?.(clue.id);
    }
  }

  const statusClasses = getStatusClasses(clue.status);
  const brightenClass = isBrightened ? 'brightness-125' : '';
  const connectingClass = isConnecting ? 'ring-4 ring-blue-400' : '';

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`Clue: ${clue.title}, status: ${clue.status}`}
      data-status={clue.status}
      data-clue-id={clue.id}
      className={[
        'relative cursor-grab active:cursor-grabbing',
        'bg-stone-800 border border-stone-600 rounded-lg p-3',
        'min-w-[160px] max-w-[200px]',
        'select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
        'transition-all duration-200',
        statusClasses,
        brightenClass,
        connectingClass,
      ]
        .filter(Boolean)
        .join(' ')}
      onKeyDown={handleKeyDown}
      draggable
    >
      {/* Status badge / icon */}
      <StatusIndicator status={clue.status} />

      {/* Type icon + title */}
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden="true" className="text-xl">
          {TYPE_ICONS[clue.type] ?? '📄'}
        </span>
        <span className="text-stone-100 text-sm font-semibold leading-tight line-clamp-2">
          {clue.title}
        </span>
      </div>

      {/* One-line description */}
      <p className="text-stone-400 text-xs leading-snug line-clamp-2">
        {clue.description}
      </p>
    </div>
  );
}
