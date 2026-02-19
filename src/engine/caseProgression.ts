/**
 * CaseProgression — end-of-case logic and vignette unlock checks.
 *
 * Requirements: 10.5, 10.6, 10.8
 */

import type { Faculty, GameState } from '../types';
import { useStore } from '../store';
import { SaveManager } from './saveManager';

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
];

// ─── CaseProgression ─────────────────────────────────────────────────────────

export const CaseProgression = {
  /**
   * Called when a Case ends.
   * 1. Persists flags, faction reputation, and NPC state via auto-save.
   * 2. Grants +1 to the Faculty stored in the `last-critical-faculty` flag.
   * 3. Checks vignette unlock conditions.
   *
   * Req 10.5, 10.6, 10.8
   */
  completeCase(caseId: string, state: GameState): CaseCompletionResult {
    // 1. Grant faculty bonus from critical success moment (Req 10.6)
    const criticalFaculty = state.flags['last-critical-faculty'] as unknown as Faculty | undefined;
    let facultyBonusGranted: Faculty | null = null;

    if (criticalFaculty && isValidFaculty(criticalFaculty)) {
      CaseProgression.grantFacultyBonus(criticalFaculty);
      facultyBonusGranted = criticalFaculty;
    }

    // 2. Check vignette unlocks (Req 10.8)
    const vignetteUnlocked = CaseProgression.checkVignetteUnlocks(state);

    if (vignetteUnlocked) {
      const store = useStore.getState();
      store.setFlag(`vignette-unlocked-${vignetteUnlocked}`, true);
    }

    // 3. Persist state (flags, faction reputation, NPC state are already in the
    //    store — just auto-save so they survive across sessions). (Req 10.5)
    const freshState = useStore.getState();
    const gameState: GameState = {
      investigator: freshState.investigator,
      currentScene: freshState.currentScene,
      currentCase: freshState.currentCase,
      clues: freshState.clues,
      deductions: freshState.deductions,
      npcs: freshState.npcs,
      flags: freshState.flags,
      factionReputation: freshState.factionReputation,
      sceneHistory: freshState.sceneHistory,
      settings: freshState.settings,
    };
    SaveManager.save('autosave', gameState);

    return { facultyBonusGranted, vignetteUnlocked };
  },

  /**
   * Checks all vignette unlock conditions against the current state.
   * Returns the ID of the first unlocked vignette, or null.
   *
   * Conditions (Req 10.8):
   *   - faction reputation reaches a threshold
   *   - NPC Disposition ≥ 7
   *   - unresolved prior-Case thread flag exists
   */
  checkVignetteUnlocks(state: GameState): string | null {
    for (const vignette of VIGNETTE_CONDITIONS) {
      // Skip already-unlocked vignettes
      if (state.flags[`vignette-unlocked-${vignette.id}`]) continue;

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
   * Req 10.6
   */
  grantFacultyBonus(faculty: Faculty): void {
    const store = useStore.getState();
    const current = store.investigator.faculties[faculty] ?? 0;
    const newValue = Math.min(20, current + 1);
    store.updateFaculty(faculty, newValue);
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_FACULTIES: Faculty[] = [
  'reason', 'perception', 'nerve', 'vigor', 'influence', 'lore',
];

function isValidFaculty(value: unknown): value is Faculty {
  return VALID_FACULTIES.includes(value as Faculty);
}
