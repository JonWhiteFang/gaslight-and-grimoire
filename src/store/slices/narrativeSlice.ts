import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { OutcomeTier } from '../../types';
import { AudioManager } from '../../engine/audioManager';
import { CaseProgression, type CaseCompletionResult } from '../../engine/caseProgression';

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
  goToScene: (sceneId: string) => void;
  setCheckResult: (result: CheckResult | null) => void;
  startNewCase: (caseId: string) => void;
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

  goToScene: (sceneId) =>
    set((state) => {
      state.sceneHistory.push(state.currentScene);
      state.currentScene = sceneId;
      AudioManager.playSfx('scene-transition', state.settings.audioVolume.sfx);
    }),

  setCheckResult: (result) =>
    set((state) => {
      state.lastCheckResult = result;
      if (result) {
        AudioManager.playSfx('dice-roll', state.settings.audioVolume.sfx);
      }
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
   * Completes a case: persists state, grants faculty bonus, unlocks vignettes.
   * Req 10.5, 10.6, 10.8
   */
  completeCase: (caseId) => {
    const store = get();
    const gameState = {
      investigator: store.investigator,
      currentScene: store.currentScene,
      currentCase: store.currentCase,
      clues: store.clues,
      deductions: store.deductions,
      npcs: store.npcs,
      flags: store.flags,
      factionReputation: store.factionReputation,
      sceneHistory: store.sceneHistory,
      settings: store.settings,
    };
    return CaseProgression.completeCase(caseId, gameState);
  },
});
