/**
 * OutcomeBanner — tier-specific result feedback after a Faculty_Check.
 *
 * Displays for 2 seconds then fades. When reducedMotion is true, appears
 * and disappears with instant transitions.
 *
 * Tiers:
 *   critical → gold   + ★ star
 *   success  → amber  + ✓ checkmark
 *   partial  → muted amber + ⚠ warning
 *   failure  → crimson + ✕ X
 *   fumble   → deep red + ☠ skull
 *
 * Req 4.8, 16.1, 16.2, 16.5
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OutcomeTier } from '../../types';

export interface OutcomeBannerProps {
  tier?: OutcomeTier;
  visible?: boolean;
  reducedMotion?: boolean;
  /** Called when the banner finishes its display cycle */
  onDismiss?: () => void;
}

interface TierConfig {
  label: string;
  icon: string;
  iconLabel: string;
  colorClass: string;
  borderClass: string;
}

const TIER_CONFIG: Record<OutcomeTier, TierConfig> = {
  critical: {
    label: 'Critical Success',
    icon: '★',
    iconLabel: 'star',
    colorClass: 'text-yellow-300',
    borderClass: 'border-yellow-400/60 bg-yellow-900/30',
  },
  success: {
    label: 'Success',
    icon: '✓',
    iconLabel: 'checkmark',
    colorClass: 'text-amber-400',
    borderClass: 'border-amber-500/60 bg-amber-900/30',
  },
  partial: {
    label: 'Partial Success',
    icon: '⚠',
    iconLabel: 'warning',
    colorClass: 'text-amber-600',
    borderClass: 'border-amber-700/60 bg-amber-950/30',
  },
  failure: {
    label: 'Failure',
    icon: '✕',
    iconLabel: 'X',
    colorClass: 'text-red-400',
    borderClass: 'border-red-700/60 bg-red-950/30',
  },
  fumble: {
    label: 'Critical Failure',
    icon: '☠',
    iconLabel: 'skull',
    colorClass: 'text-red-700',
    borderClass: 'border-red-900/60 bg-red-950/50',
  },
};

const DISPLAY_DURATION_MS = 2000;

export function OutcomeBanner({
  tier,
  visible = false,
  reducedMotion = false,
  onDismiss,
}: OutcomeBannerProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible || !tier) {
      setShown(false);
      return;
    }

    setShown(true);

    if (reducedMotion) {
      // Still show for the full duration so the user can read the result
      const id = setTimeout(() => {
        setShown(false);
        onDismiss?.();
      }, DISPLAY_DURATION_MS);
      return () => clearTimeout(id);
    }

    const id = setTimeout(() => {
      setShown(false);
      onDismiss?.();
    }, DISPLAY_DURATION_MS);

    return () => clearTimeout(id);
  }, [visible, tier, reducedMotion, onDismiss]);

  if (!tier) return null;

  const config = TIER_CONFIG[tier];

  // When reducedMotion is true, skip AnimatePresence entirely so the element
  // unmounts immediately (no exit animation delay).
  if (reducedMotion) {
    if (!shown) return null;
    return (
      <div
        role="status"
        aria-live="assertive"
        aria-label={`Outcome: ${config.label}`}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded border text-sm font-semibold ${config.colorClass} ${config.borderClass}`}
      >
        <span aria-label={config.iconLabel} role="img" className="text-lg">
          {config.icon}
        </span>
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={`outcome-${tier}`}
          role="status"
          aria-live="assertive"
          aria-label={`Outcome: ${config.label}`}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded border text-sm font-semibold ${config.colorClass} ${config.borderClass}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <span aria-label={config.iconLabel} role="img" className="text-lg">
            {config.icon}
          </span>
          <span>{config.label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
