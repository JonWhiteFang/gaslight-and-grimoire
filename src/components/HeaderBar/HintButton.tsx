/**
 * HintButton — contextual hint trigger in the HeaderBar.
 *
 * Fades in when shouldShowHint() returns true. On click, shows the next
 * hint level in a small popover below the button.
 *
 * Requirements: 13.1–13.6
 */
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../store';
import {
  shouldShowHint,
  getHint,
  type HintLevel,
  type HintContent,
} from '../../engine/hintEngine';
import type { GameState } from '../../types';

export interface HintButtonProps {
  /** Full game state passed to getHint for context-aware suggestions */
  gameState: GameState;
}

export function HintButton({ gameState }: HintButtonProps) {
  const settings = useSettings();
  const { hintsEnabled, reducedMotion } = settings;

  const [currentLevel, setCurrentLevel] = useState<HintLevel>(1);
  const [activeHint, setActiveHint] = useState<HintContent | null>(null);

  const visible = shouldShowHint(hintsEnabled);

  // Reset hint level when scene changes
  useEffect(() => {
    setCurrentLevel(1);
    setActiveHint(null);
  }, [gameState.currentScene]);

  const handleClick = useCallback(() => {
    const hint = getHint(currentLevel, gameState);
    setActiveHint(hint);
    // Advance to next level (cap at 3)
    if (currentLevel < 3) {
      setCurrentLevel((prev) => (prev < 3 ? ((prev + 1) as HintLevel) : 3));
    }
  }, [currentLevel, gameState]);

  const handleDismiss = useCallback(() => {
    setActiveHint(null);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative">
      {/* Hint trigger button */}
      <motion.button
        type="button"
        aria-label="Show hint"
        onClick={handleClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeIn' }}
        className="
          w-11 h-11 flex items-center justify-center
          rounded-lg text-lg
          text-amber-300 hover:text-white hover:bg-stone-800
          transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
        "
      >
        💡
      </motion.button>

      {/* Hint popover */}
      <AnimatePresence>
        {activeHint && (
          <motion.div
            role="status"
            aria-live="polite"
            aria-label={`Hint level ${activeHint.level}`}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="
              absolute right-0 top-full mt-2 z-50
              w-64 p-3
              bg-stone-900 border border-amber-700/50 rounded-lg shadow-xl
              text-sm text-stone-200 leading-relaxed
            "
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-amber-400 text-xs font-semibold uppercase tracking-wide block mb-1">
                  Hint {activeHint.level}
                </span>
                <p>{activeHint.text}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss hint"
                onClick={handleDismiss}
                className="
                  shrink-0 w-5 h-5 flex items-center justify-center
                  text-stone-500 hover:text-stone-300
                  focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded
                "
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
