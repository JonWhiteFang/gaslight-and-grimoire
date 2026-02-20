/**
 * ClueDiscoveryCard — slide-in notification when a clue is discovered.
 * Req 6.3
 */
import { motion, AnimatePresence } from 'framer-motion';
import type { Clue } from '../../types';

const CLUE_TYPE_ICONS: Record<string, string> = {
  physical: '🔍',
  testimony: '💬',
  occult: '🔮',
  deduction: '🧠',
  redHerring: '🐟',
};

export interface ClueDiscoveryCardProps {
  clue?: Clue;
  visible?: boolean;
  reducedMotion?: boolean;
  onDismiss?: () => void;
}

export function ClueDiscoveryCard({ clue, visible = false, reducedMotion = false, onDismiss }: ClueDiscoveryCardProps) {
  return (
    <AnimatePresence>
      {visible && clue && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label={`Clue discovered: ${clue.title}`}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 80 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
          className="fixed right-4 bottom-4 bg-gaslight-slate border border-gaslight-amber/40 rounded-lg p-4 max-w-xs shadow-xl z-40"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">
              {CLUE_TYPE_ICONS[clue.type] ?? '📄'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gaslight-amber font-semibold uppercase tracking-wide">
                Clue Discovered
              </p>
              <p className="text-sm text-gaslight-fog font-bold mt-0.5">{clue.title}</p>
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">{clue.description}</p>
            </div>
            {onDismiss && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={onDismiss}
                className="shrink-0 text-stone-500 hover:text-stone-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
              >
                ✕
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
