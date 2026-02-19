import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GameStore } from './types';
import { createInvestigatorSlice } from './slices/investigatorSlice';
import { createNarrativeSlice } from './slices/narrativeSlice';
import { createEvidenceSlice } from './slices/evidenceSlice';
import { createNpcSlice } from './slices/npcSlice';
import { createWorldSlice } from './slices/worldSlice';
import { createMetaSlice } from './slices/metaSlice';

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
  useStore((s) => ({ goToScene: s.goToScene }));

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
    loadGame: s.loadGame,
  }));
