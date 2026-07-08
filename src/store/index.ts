import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
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
export const useConnections = () => useStore((s) => s.connections);
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
    loadAndStartVignette: s.loadAndStartVignette,
  }));

export const useEvidenceActions = () =>
  useStore((s) => ({
    discoverClue: s.discoverClue,
    updateClueStatus: s.updateClueStatus,
    addDeduction: s.addDeduction,
    addConnection: s.addConnection,
    clearConnections: s.clearConnections,
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
    applyEffects: s.applyEffects,
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

/**
 * Subscribes to a GameState snapshot with shallow equality (F-042).
 *
 * `snapshotGameState` returns a fresh object every call, so using it as a bare
 * Zustand selector (`useStore(buildGameState)`) would re-render on *every* store
 * mutation — effectively a full-store subscription. The snapshot's fields are
 * stable store references, so `useShallow` compares them field-by-field and only
 * re-renders when one actually changes. Use this instead of `useStore(buildGameState)`
 * anywhere a component needs the reactive snapshot.
 */
export const useGameState = (): ReturnType<typeof snapshotGameState> =>
  useStore(useShallow(buildGameState));

/** Resolves the current SceneNode from loaded caseData, or null if unavailable. */
export function useCurrentScene(): SceneNode | null {
  const currentScene = useStore((s) => s.currentScene);
  const caseData = useStore((s) => s.caseData);
  const gameState = useGameState();

  if (!currentScene || !caseData) return null;
  try {
    return resolveScene(currentScene, gameState, caseData);
  } catch {
    return null;
  }
}
