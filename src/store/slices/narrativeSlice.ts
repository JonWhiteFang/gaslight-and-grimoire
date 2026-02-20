import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { CaseData, OutcomeTier } from '../../types';
import { CaseProgression, type CaseCompletionResult } from '../../engine/caseProgression';
import { loadCase, validateContent } from '../../engine/narrativeEngine';
import { snapshotGameState } from '../../utils/gameState';

export interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  tier: OutcomeTier;
}

export interface NarrativeSlice {
  currentScene: string;
  currentCase: string;
  sceneHistory: string[];
  lastCheckResult: CheckResult | null;
  caseData: CaseData | null;
  goToScene: (sceneId: string) => void;
  setCheckResult: (result: CheckResult | null) => void;
  startNewCase: (caseId: string) => void;
  loadAndStartCase: (caseId: string) => Promise<void>;
  completeCase: (caseId: string) => CaseCompletionResult;
}

export const createNarrativeSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  NarrativeSlice
> = (set, get) => ({
  currentScene: '',
  currentCase: '',
  sceneHistory: [],
  lastCheckResult: null,
  caseData: null,

  goToScene: (sceneId) => {
    set((state) => {
      state.sceneHistory.push(state.currentScene);
      state.currentScene = sceneId;
    });
    // Auto-save on scene transition if configured
    if (get().settings.autoSaveFrequency === 'scene') {
      get().autoSave();
    }
  },

  setCheckResult: (result) =>
    set((state) => {
      state.lastCheckResult = result;
    }),

  startNewCase: (caseId) =>
    set((state) => {
      state.currentCase = caseId;
      state.sceneHistory = [];
      // Reset ability for the new case
      state.investigator.abilityUsed = false;
      // Clear ability flags from world slice
      delete state.flags['ability-auto-succeed-reason'];
      delete state.flags['ability-auto-succeed-vigor'];
      delete state.flags['ability-auto-succeed-influence'];
      delete state.flags['ability-veil-sight-active'];
    }),

  /**
   * Loads case JSON, populates clues/NPCs, and navigates to the first scene.
   */
  loadAndStartCase: async (caseId) => {
    const data = await loadCase(caseId);
    const validation = validateContent(data);
    if (!validation.valid) {
      throw new Error('[NarrativeEngine] Content validation failed:\n' + validation.errors.join('\n'));
    }
    const firstSceneId = data.meta.firstScene ?? (() => {
      console.warn('[NarrativeEngine] No firstScene in meta.json, using Object.keys fallback');
      return Object.keys(data.scenes)[0];
    })();

    set((state) => {
      state.caseData = data;
      state.currentCase = data.meta.id;
      state.sceneHistory = [];
      state.investigator.abilityUsed = false;
      delete state.flags['ability-auto-succeed-reason'];
      delete state.flags['ability-auto-succeed-vigor'];
      delete state.flags['ability-auto-succeed-influence'];
      delete state.flags['ability-veil-sight-active'];

      // Populate clues and NPCs from loaded case data
      for (const [id, clue] of Object.entries(data.clues)) {
        state.clues[id] = clue;
      }
      for (const [id, npc] of Object.entries(data.npcs)) {
        state.npcs[id] = npc;
      }
    });

    // Navigate to first scene (triggers scene-transition SFX via goToScene)
    get().goToScene(firstSceneId);
  },

  /**
   * Completes a case: persists state, grants faculty bonus, unlocks vignettes.
   * Req 10.5, 10.6, 10.8
   */
  completeCase: (caseId) => {
    return CaseProgression.completeCase(caseId, snapshotGameState(get()));
  },
});
