import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { CaseData, OutcomeTier } from '../../types';
import { CaseProgression, type CaseCompletionResult } from '../../engine/caseProgression';
import { loadCase, loadVignette, resolveScene, validateContent } from '../../engine/narrativeEngine';
import { generateEffectMessages } from '../../engine/effectMessages';
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
  /** Scene ids whose onEnter effects have already fired this playthrough (F-006). */
  visitedScenes: string[];
  /** Feedback messages from the most recent scene's onEnter effects (transient). */
  lastEffectMessages: string[];
  lastCheckResult: CheckResult | null;
  caseData: CaseData | null;
  goToScene: (sceneId: string) => void;
  setCheckResult: (result: CheckResult | null) => void;
  loadAndStartCase: (caseId: string) => Promise<void>;
  loadAndStartVignette: (vignetteId: string) => Promise<void>;
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
  visitedScenes: [],
  lastEffectMessages: [],
  lastCheckResult: null,
  caseData: null,

  goToScene: (sceneId) => {
    set((state) => {
      // Skip the empty-string sentinel present before the first scene loads,
      // so sceneHistory only ever contains real scene ids.
      if (state.currentScene) {
        state.sceneHistory.push(state.currentScene);
      }
      state.currentScene = sceneId;
    });

    // Apply the scene's onEnter effects exactly once per playthrough. Gating on
    // visitedScenes means revisiting (back button) or reloading a save cannot
    // re-apply — or "farm" — a scene's composure/vitality/flag effects (F-006).
    // Owning this here (rather than in a NarrativePanel effect) also decouples
    // the state transition's consequences from which component happens to be
    // mounted (F-008).
    const { caseData, visitedScenes } = get();
    const alreadyVisited = visitedScenes.includes(sceneId);

    if (caseData && !alreadyVisited) {
      let onEnter = null;
      try {
        onEnter = resolveScene(sceneId, snapshotGameState(get()), caseData).onEnter ?? null;
      } catch {
        // Scene not in caseData (e.g. a shared scene not yet indexed) — nothing to apply.
        onEnter = null;
      }
      if (onEnter && onEnter.length > 0) {
        get().applyEffects(onEnter);
        const messages = generateEffectMessages(onEnter, get().npcs);
        set((state) => {
          state.lastEffectMessages = messages;
          state.visitedScenes.push(sceneId);
        });
      } else {
        set((state) => {
          state.lastEffectMessages = [];
          state.visitedScenes.push(sceneId);
        });
      }
    } else {
      // Revisit (or no case loaded): no effects re-fire, and no stale feedback lingers.
      set((state) => {
        state.lastEffectMessages = [];
      });
    }

    // Auto-save on scene transition if configured
    if (get().settings.autoSaveFrequency === 'scene') {
      get().autoSave();
    }
  },

  setCheckResult: (result) =>
    set((state) => {
      state.lastCheckResult = result;
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
      state.visitedScenes = [];
      state.lastEffectMessages = [];
      state.investigator.abilityUsed = false;
      delete state.flags['ability-auto-succeed-reason'];
      delete state.flags['ability-auto-succeed-vigor'];
      delete state.flags['ability-auto-succeed-influence'];
      delete state.flags['ability-veil-sight-active'];
      // Clear the pending critical-success faculty reward so a bonus earned in a
      // previous case cannot leak into this one (granted at completeCase time).
      delete state.flags['last-critical-faculty'];

      // Clear stale state from previous case
      state.clues = {};
      state.npcs = {};
      state.deductions = {};
      state.connections = [];
      state.lastCheckResult = null;

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
   * Loads vignette JSON, populates clues/NPCs, and navigates to the first scene.
   */
  loadAndStartVignette: async (vignetteId) => {
    const data = await loadVignette(vignetteId);
    const asCaseData = { ...data, meta: { ...data.meta, acts: 2, facultyDistribution: {} }, variants: [] };
    const validation = validateContent(asCaseData);
    if (!validation.valid) {
      throw new Error('[NarrativeEngine] Content validation failed:\n' + validation.errors.join('\n'));
    }
    const firstSceneId = data.meta.firstScene ?? (() => {
      console.warn('[NarrativeEngine] No firstScene in meta.json, using Object.keys fallback');
      return Object.keys(data.scenes)[0];
    })();

    set((state) => {
      state.caseData = asCaseData;
      state.currentCase = data.meta.id;
      state.sceneHistory = [];
      state.visitedScenes = [];
      state.lastEffectMessages = [];
      state.investigator.abilityUsed = false;
      delete state.flags['ability-auto-succeed-reason'];
      delete state.flags['ability-auto-succeed-vigor'];
      delete state.flags['ability-auto-succeed-influence'];
      delete state.flags['ability-veil-sight-active'];
      delete state.flags['last-critical-faculty'];
      state.clues = {};
      state.npcs = {};
      state.deductions = {};
      state.connections = [];
      state.lastCheckResult = null;
      for (const [id, clue] of Object.entries(data.clues)) {
        state.clues[id] = clue;
      }
      for (const [id, npc] of Object.entries(data.npcs)) {
        state.npcs[id] = npc;
      }
    });

    get().goToScene(firstSceneId);
  },

  /**
   * Completes a case: persists state, grants faculty bonus, unlocks vignettes.
   */
  completeCase: (caseId) => {
    const result = CaseProgression.completeCase(caseId, snapshotGameState(get()), get());
    get().autoSave();
    return result;
  },
});
