/**
 * NPCGallery — full-screen overlay listing all encountered NPCs.
 */
import { useEffect } from 'react';
import { useNpcs } from '../../store';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { NPCState } from '../../types';

// ── Disposition label ─────────────────────────────────────────────────────────

function dispositionLabel(disposition: number): string {
  if (disposition >= 7) return 'Devoted';
  if (disposition >= 4) return 'Warm';
  if (disposition >= 1) return 'Cordial';
  if (disposition === 0) return 'Neutral';
  if (disposition >= -3) return 'Cool';
  if (disposition >= -6) return 'Suspicious';
  return 'Hostile';
}

// ── Suspicion tier label ──────────────────────────────────────────────────────

interface SuspicionTierInfo {
  label: string | null;
  className: string;
}

function suspicionTier(suspicion: number): SuspicionTierInfo {
  if (suspicion <= 2) return { label: null, className: '' };
  if (suspicion <= 5) return { label: 'Evasive', className: 'text-amber-400' };
  if (suspicion <= 8) return { label: 'Wary', className: 'text-orange-400' };
  return { label: 'Hostile', className: 'text-red-500' };
}

// ── Portrait placeholder ──────────────────────────────────────────────────────

function Portrait({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="
        w-12 h-12 rounded-full flex-shrink-0
        bg-stone-700 text-amber-200
        flex items-center justify-center
        text-lg font-bold select-none
        border border-amber-900/50
      "
    >
      {initial}
    </div>
  );
}

// ── NPC row ───────────────────────────────────────────────────────────────────

function NPCRow({ npc }: { npc: NPCState }) {
  const dispLabel = dispositionLabel(npc.disposition);
  const { label: suspLabel, className: suspClass } = suspicionTier(npc.suspicion);

  return (
    <li className="flex items-center gap-4 py-3 border-b border-stone-700/50 last:border-0">
      <Portrait name={npc.name} />

      <div className="flex-1 min-w-0">
        <p className="font-bold text-amber-100 truncate">{npc.name}</p>
        <p className="text-sm italic text-stone-400 truncate">
          {npc.faction ?? 'Independent'}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-sm text-amber-300">{dispLabel}</span>
        {suspLabel && (
          <span className={`text-xs font-semibold ${suspClass}`}>{suspLabel}</span>
        )}
      </div>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface NPCGalleryProps {
  onClose: () => void;
}

export function NPCGallery({ onClose }: NPCGalleryProps) {
  const npcs = useNpcs();
  const accessibleNpcs = Object.values(npcs).filter((n) => n.isAccessible);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  // Escape key closes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="NPC Gallery"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
    >
      <div className="flex flex-col flex-1 overflow-hidden bg-stone-900/95 max-w-2xl w-full mx-auto my-8 rounded-xl border border-stone-700 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700">
          <h2 className="text-amber-200 text-xl font-bold tracking-wide">
            👥 Persons of Interest
          </h2>
          <button
            type="button"
            aria-label="Close NPC Gallery"
            onClick={onClose}
            className="
              text-stone-400 hover:text-white text-2xl font-bold leading-none
              w-11 h-11 flex items-center justify-center
              rounded-lg hover:bg-stone-700/60
              transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white
            "
          >
            ×
          </button>
        </div>

        {/* NPC list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {accessibleNpcs.length === 0 ? (
            <p className="text-stone-400 italic text-center mt-12">
              No suspects encountered yet.
            </p>
          ) : (
            <ul aria-label="Encountered NPCs">
              {accessibleNpcs.map((npc) => (
                <NPCRow key={npc.id} npc={npc} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
