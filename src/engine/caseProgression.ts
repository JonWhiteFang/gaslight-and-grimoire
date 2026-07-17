/**
 * CaseProgression — end-of-case logic and vignette unlock checks.
 */

import type { Faculty, GameState } from '../types';
import type { EngineActions } from './engineActions';
import { vignetteUnlockedFlag } from './flags';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseCompletionResult {
  facultyBonusGranted: Faculty | null;
  /** Every vignette newly unlocked by this completion (F-057 — was a single id). */
  vignettesUnlocked: string[];
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
  {
    id: 'the-orrery-room',
    factionReputation: { faction: 'Hermetic Order of the Grey Dawn', threshold: 2 },
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

    // 2. Check vignette unlocks — set a flag for EVERY newly-satisfied vignette,
    // not just the first (F-057).
    const vignettesUnlocked = CaseProgression.checkVignetteUnlocks(state);

    for (const id of vignettesUnlocked) {
      actions.setFlag(vignetteUnlockedFlag(id), true);
    }

    return { facultyBonusGranted, vignettesUnlocked };
  },

  /**
   * Checks all vignette unlock conditions against the current state.
   * Returns the IDs of every not-yet-unlocked vignette whose condition is met
   * (F-057 — previously returned only the first, starving simultaneously-earned
   * unlocks).
   *
   * Conditions:
   *   - faction reputation reaches a threshold
   *   - NPC Disposition ≥ 7
   *   - unresolved prior-Case thread flag exists
   */
  checkVignetteUnlocks(state: GameState): string[] {
    const unlocked: string[] = [];

    for (const vignette of VIGNETTE_CONDITIONS) {
      // Skip already-unlocked vignettes
      if (state.flags[vignetteUnlockedFlag(vignette.id)]) continue;

      if (vignette.factionReputation) {
        const { faction, threshold } = vignette.factionReputation;
        const rep = state.factionReputation[faction] ?? 0;
        if (rep >= threshold) {
          unlocked.push(vignette.id);
          continue;
        }
      }

      if (vignette.npcDisposition) {
        const { npcId, threshold } = vignette.npcDisposition;
        const npc = state.npcs[npcId];
        if (npc && npc.disposition >= threshold) {
          unlocked.push(vignette.id);
          continue;
        }
      }

      if (vignette.requiredFlag) {
        if (state.flags[vignette.requiredFlag]) {
          unlocked.push(vignette.id);
          continue;
        }
      }
    }

    return unlocked;
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
