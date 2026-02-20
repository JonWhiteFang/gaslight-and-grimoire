import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GameStore } from './types';
import type { SceneNode } from '../types';
import { snapshotGameState } from '../utils/gameState';
import { createInvestigatorSlice } from './slices/investigatorSlice';
import { createNarrativeSlice } from './slices/narrativeSlice';
import { createEvidenceSlice } from './slices/evidenceSlice';
import { createNpcSlice } from './slices/npcSlice';
import { createWorldSlice } from './slices/worldSlice';
import { createMetaSlice } from './slices/metaSlice';
import { resolveScene } from '../engine/narrativeEngine';

// ─── Root Store ───────────────────────────────────────────────────────────────

export const useStore = create<GameStore>()(
  immer((...args) => ({
    ...createInvestigatorSlice(...args),
    ...createNarrativeSlice(...args),
    ...createEvidenceSlice(...args),
    ...createNpcSlice(...args),
    ...createWorldSlice(...args),
    ...createMetaSlice(...args),
  })),
);

// ─── Per-slice selector hooks ─────────────────────────────────────────────────

export const useInvestigator = () => useStore((s) => s.investigator);
export const useNarrative = () =>
  useStore((s) => ({
    currentScene: s.currentScene,
    currentCase: s.currentCase,
    sceneHistory: s.sceneHistory,
  }));
export const useClues = () => useStore((s) => s.clues);
export const useDeductions = () => useStore((s) => s.deductions);
export const useNpcs = () => useStore((s) => s.npcs);
export const useFlags = () => useStore((s) => s.flags);
export const useFactionReputation = () => useStore((s) => s.factionReputation);
export const useSettings = () => useStore((s) => s.settings);
export const useCaseData = () => useStore((s) => s.caseData);

// ─── Action selectors ─────────────────────────────────────────────────────────

export const useInvestigatorActions = () =>
  useStore((s) => ({
    initInvestigator: s.initInvestigator,
    updateFaculty: s.updateFaculty,
    adjustComposure: s.adjustComposure,
    adjustVitality: s.adjustVitality,
    useAbility: s.useAbility,
    resetAbility: s.resetAbility,
  }));

export const useNarrativeActions = () =>
  useStore((s) => ({
    goToScene: s.goToScene,
    loadAndStartCase: s.loadAndStartCase,
  }));

export const useEvidenceActions = () =>
  useStore((s) => ({
    discoverClue: s.discoverClue,
    updateClueStatus: s.updateClueStatus,
    addDeduction: s.addDeduction,
  }));

export const useNpcActions = () =>
  useStore((s) => ({
    adjustDisposition: s.adjustDisposition,
    adjustSuspicion: s.adjustSuspicion,
    setNpcMemoryFlag: s.setNpcMemoryFlag,
    removeNpc: s.removeNpc,
  }));

export const useWorldActions = () =>
  useStore((s) => ({
    setFlag: s.setFlag,
    adjustReputation: s.adjustReputation,
  }));

export const useMetaActions = () =>
  useStore((s) => ({
    updateSettings: s.updateSettings,
    saveGame: s.saveGame,
    autoSave: s.autoSave,
    loadGame: s.loadGame,
  }));

// ─── Derived selectors ────────────────────────────────────────────────────────

/** Builds a GameState snapshot from the store (for engine functions). */
export const buildGameState = snapshotGameState;

/** Resolves the current SceneNode from loaded caseData, or null if unavailable. */
export function useCurrentScene(): SceneNode | null {
  const currentScene = useStore((s) => s.currentScene);
  const caseData = useStore((s) => s.caseData);
  const gameState = useStore(buildGameState);

  if (!currentScene || !caseData) return null;
  try {
    return resolveScene(currentScene, gameState, caseData);
  } catch {
    return null;
  }
}
