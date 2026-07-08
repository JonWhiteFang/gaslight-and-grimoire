/**
 * CaseProgression — end-of-case logic and vignette unlock checks.
 */

import type { Faculty, GameState } from '../types';
import type { EngineActions } from './engineActions';
import { SaveManager } from './saveManager';
import { vignetteUnlockedFlag } from './flags';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseCompletionResult {
  facultyBonusGranted: Faculty | null;
  vignetteUnlocked: string | null;
}

// ─── Vignette registry ────────────────────────────────────────────────────────

/**
 * All known vignettes and their unlock conditions.
 * Extend this list as new vignettes are authored.
 */
interface VignetteUnlockCondition {
  id: string;
  /** Faction reputation threshold (inclusive) */
  factionReputation?: { faction: string; threshold: number };
  /** NPC disposition threshold (inclusive) */
  npcDisposition?: { npcId: string; threshold: number };
  /** Flag that must be truthy (unresolved prior-case thread) */
  requiredFlag?: string;
}

const VIGNETTE_CONDITIONS: VignetteUnlockCondition[] = [
  {
    id: 'a-matter-of-shadows',
    factionReputation: { faction: 'Lamplighters', threshold: 2 },
  },
  {
    id: 'the-rationalists-dilemma',
    factionReputation: { faction: 'Rationalists Circle', threshold: 2 },
  },
  {
    id: 'the-debt-of-smoke',
    // Gated on the persisted flag set by the Whitechapel Court-of-Smoke ending.
    // (Was npc-sable disposition ≥ 7, which is unattainable — max is +4 — and
    // NPC state resets between cases. Flags persist, like wc-case-complete.)
    requiredFlag: 'wc-court-deal-made',
  },
  {
    id: 'the-unfinished-case',
    requiredFlag: 'wc-case-complete',
  },
];

// ─── CaseProgression ─────────────────────────────────────────────────────────

export const CaseProgression = {
  /**
   * Called when a Case ends.
   * 1. Persists flags, faction reputation, and NPC state via auto-save.
   * 2. Grants +1 to the Faculty stored in the `investigator.lastCriticalFaculty` field.
   * 3. Checks vignette unlock conditions.
   */
  completeCase(caseId: string, state: GameState, actions: EngineActions): CaseCompletionResult {
    // 1. Grant faculty bonus from critical success moment
    const criticalFaculty = state.investigator.lastCriticalFaculty;
    let facultyBonusGranted: Faculty | null = null;

    if (criticalFaculty) {
      CaseProgression.grantFacultyBonus(criticalFaculty, actions);
      facultyBonusGranted = criticalFaculty;
    }

    // 2. Check vignette unlocks
    const vignetteUnlocked = CaseProgression.checkVignetteUnlocks(state);

    if (vignetteUnlocked) {
      actions.setFlag(vignetteUnlockedFlag(vignetteUnlocked), true);
    }

    return { facultyBonusGranted, vignetteUnlocked };
  },

  /**
   * Checks all vignette unlock conditions against the current state.
   * Returns the ID of the first unlocked vignette, or null.
   *
   * Conditions:
   *   - faction reputation reaches a threshold
   *   - NPC Disposition ≥ 7
   *   - unresolved prior-Case thread flag exists
   */
  checkVignetteUnlocks(state: GameState): string | null {
    for (const vignette of VIGNETTE_CONDITIONS) {
      // Skip already-unlocked vignettes
      if (state.flags[vignetteUnlockedFlag(vignette.id)]) continue;

      if (vignette.factionReputation) {
        const { faction, threshold } = vignette.factionReputation;
        const rep = state.factionReputation[faction] ?? 0;
        if (rep >= threshold) return vignette.id;
      }

      if (vignette.npcDisposition) {
        const { npcId, threshold } = vignette.npcDisposition;
        const npc = state.npcs[npcId];
        if (npc && npc.disposition >= threshold) return vignette.id;
      }

      if (vignette.requiredFlag) {
        if (state.flags[vignette.requiredFlag]) return vignette.id;
      }
    }

    return null;
  },

  /**
   * Grants +1 to the specified Faculty (capped at 20).
   */
  grantFacultyBonus(faculty: Faculty, actions: EngineActions): void {
    const current = actions.investigator.faculties[faculty] ?? 0;
    const newValue = Math.min(20, current + 1);
    actions.updateFaculty(faculty, newValue);
  },
};
