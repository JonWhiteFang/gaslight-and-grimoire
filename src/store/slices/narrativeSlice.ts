import type { StateCreator } from 'zustand';
import type { WritableDraft } from 'immer';
import type { GameStore } from '../types';
import type { CaseData, EncounterState, OutcomeTier, VignetteData } from '../../types';
import { CaseProgression, type CaseCompletionResult } from '../../engine/caseProgression';
import { clearRevertTimers } from './evidenceSlice';
import { loadCase, loadVignette, resolveScene, validateContent } from '../../engine/narrativeEngine';
import { CASE_LOAD_CLEARED_FLAGS } from '../../engine/flags';
import { generateEffectMessages } from '../../engine/effectMessages';
import { snapshotGameState } from '../../utils/gameState';

/**
 * Adapts a loaded {@link VignetteData} into the {@link CaseData} shape the store
 * and engine operate on. Vignettes are a 2-act subset with no faculty
 * distribution; their optional recipes/variants (deductions.json /
 * variants.json) pass straight through. Shared by `loadAndStartVignette` and
 * `metaSlice.loadGame` (F-066) — keep the single source of truth here.
 */
export function vignetteToCaseData(data: VignetteData): CaseData {
  return {
    ...data,
    meta: { ...data.meta, acts: 2, facultyDistribution: {} },
    variants: data.variants ?? [],
    recipes: data.recipes,
  };
}

/**
 * Performs the shared "fresh start" reset for a new case/vignette on an Immer
 * draft: restores meters, clears the pending faculty reward and halt/ability
 * flags, wipes stale case-scoped state, and re-populates clues/NPCs from the
 * loaded data. Extracted from `loadAndStartCase`/`loadAndStartVignette` (F-063)
 * so the reset semantics live in exactly one place.
 */
export function resetForNewCase(state: WritableDraft<GameStore>, data: CaseData): void {
  state.caseData = data;
  state.currentCase = data.meta.id;
  // Clear the previous case's currentScene too: otherwise the new case's first
  // goToScene pushes the stale foreign id into the fresh sceneHistory (phantom
  // id in the autosave + a live-but-no-op "Review previous scene" at case start,
  // F-104). The empty-string sentinel is already special-cased by goToScene.
  state.currentScene = '';
  state.sceneHistory = [];
  state.visitedScenes = [];
  state.lastEffectMessages = [];
  state.investigator.abilityUsed = false;
  // A case is a fresh start: restore composure/vitality to full and clear the
  // halt flags. Otherwise a knockout (0 composure/vitality → breakdown scene)
  // would carry over — every subsequent case would re-fire breakdown on load
  // and brick the investigator across all cases (and poison the autosave).
  state.investigator.composure = 10;
  state.investigator.vitality = 10;
  // Clear the pending critical-success faculty reward so a critical earned in a
  // previous case can't grant a bonus here (F-013 — was the last-critical-faculty flag).
  state.investigator.lastCriticalFaculty = undefined;
  // Clears breakdown/incapacitation halt flags and ability auto-succeed/veil-sight
  // flags so nothing earned in a previous case leaks into this one.
  for (const f of CASE_LOAD_CLEARED_FLAGS) delete state.flags[f];

  // Clear stale state from previous case
  state.clues = {};
  state.npcs = {};
  state.deductions = {};
  state.connections = [];
  // Contested-revert ownership is case-scoped: clear the serialisable fields here.
  // The module-level timer registry is cancelled by the load actions (below)
  // BEFORE this reset runs, so no pending revert survives a case load.
  state.contestedTokens = {};
  state.contestedPrior = {};
  state.attemptSeq = 0;
  state.lastCheckResult = null;
  state.encounterState = null;

  // Populate clues and NPCs from loaded case data
  for (const [id, clue] of Object.entries(data.clues)) {
    state.clues[id] = clue;
  }
  for (const [id, npc] of Object.entries(data.npcs)) {
    state.npcs[id] = npc;
  }
}

export interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  tier: OutcomeTier;
  dc?: number;
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
  /** In-progress encounter state, or null when not in an encounter (F-105). */
  encounterState: EncounterState | null;
  caseData: CaseData | null;
  goToScene: (sceneId: string) => void;
  setCheckResult: (result: CheckResult | null) => void;
  /** Persist the live encounter progress so a reload resumes it (F-105). */
  setEncounterState: (state: EncounterState | null) => void;
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
  encounterState: null,
  caseData: null,

  goToScene: (sceneId) => {
    set((state) => {
      const prevScene = state.currentScene;
      // Skip the empty-string sentinel present before the first scene loads,
      // so sceneHistory only ever contains real scene ids.
      if (prevScene) {
        state.sceneHistory.push(prevScene);
      }
      // A cross-scene navigation clears any lingering dice/outcome result, so
      // the overlay from the previous check can't float over the destination
      // scene (or persist across further navigations) until manually dismissed
      // (F-106). A re-navigation to the same scene leaves it in place.
      if (prevScene !== sceneId) {
        state.lastCheckResult = null;
        // Leaving a scene ends any encounter that was in progress there, so the
        // persisted encounter state must not linger into the next scene (F-105).
        state.encounterState = null;
      }
      state.currentScene = sceneId;
    });

    // Apply the scene's onEnter effects exactly once per playthrough. We gate on
    // the RESOLVED scene identity (base id OR the variant id resolveScene picks),
    // not the base id alone: a hub first entered before its variant condition is
    // true, then re-entered after it flips, must fire the variant's DISTINCT
    // onEnter once (F-118) — while still never re-firing the same resolved scene
    // (F-006). Owning this here (not in a NarrativePanel effect) also decouples
    // the transition's consequences from which component is mounted (F-008).
    const { caseData, visitedScenes } = get();

    if (caseData) {
      let resolvedId = sceneId;
      let onEnter = null;
      try {
        const resolved = resolveScene(sceneId, snapshotGameState(get()), caseData);
        resolvedId = resolved.id;
        onEnter = resolved.onEnter ?? null;
      } catch {
        // Scene not in caseData (e.g. a shared scene not yet indexed) — nothing to apply.
        onEnter = null;
      }

      const alreadyVisited = visitedScenes.includes(resolvedId);
      if (!alreadyVisited && onEnter && onEnter.length > 0) {
        get().applyEffects(onEnter);
        const messages = generateEffectMessages(onEnter, get().npcs);
        set((state) => {
          state.lastEffectMessages = messages;
          state.visitedScenes.push(resolvedId);
        });
      } else if (!alreadyVisited) {
        set((state) => {
          state.lastEffectMessages = [];
          state.visitedScenes.push(resolvedId);
        });
      } else {
        // Revisit of an already-resolved scene: no effects re-fire, no stale feedback.
        set((state) => {
          state.lastEffectMessages = [];
        });
      }
    } else {
      // No case loaded: nothing to apply, and no stale feedback lingers.
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

  setEncounterState: (encounterState) =>
    set((state) => {
      state.encounterState = encounterState;
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

    // Cancel any pending contested-revert timer before wiping state, so a stale
    // timer from the previous case can't fire against a freshly loaded same-id clue.
    clearRevertTimers();
    set((state) => {
      resetForNewCase(state, data);
    });

    // Navigate to first scene (triggers scene-transition SFX via goToScene)
    get().goToScene(firstSceneId);
  },

  /**
   * Loads vignette JSON, populates clues/NPCs, and navigates to the first scene.
   */
  loadAndStartVignette: async (vignetteId) => {
    const data = await loadVignette(vignetteId);
    const asCaseData = vignetteToCaseData(data);
    const validation = validateContent(asCaseData);
    if (!validation.valid) {
      throw new Error('[NarrativeEngine] Content validation failed:\n' + validation.errors.join('\n'));
    }
    const firstSceneId = data.meta.firstScene ?? (() => {
      console.warn('[NarrativeEngine] No firstScene in meta.json, using Object.keys fallback');
      return Object.keys(data.scenes)[0];
    })();

    clearRevertTimers();
    set((state) => {
      resetForNewCase(state, asCaseData);
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
