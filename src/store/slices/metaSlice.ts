import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { GameSettings, GameState } from '../../types';
import { SaveManager } from '../../engine/saveManager';

export interface MetaSlice {
  settings: GameSettings;
  updateSettings: (partial: Partial<GameSettings>) => void;
  saveGame: () => Promise<void>;
  loadGame: (saveId: string) => Promise<void>;
}

const defaultSettings: GameSettings = {
  fontSize: 'standard',
  highContrast: false,
  reducedMotion: false,
  textSpeed: 'typewriter',
  hintsEnabled: true,
  autoSaveFrequency: 'scene',
  audioVolume: { ambient: 0.6, sfx: 0.8 },
};

export const createMetaSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  MetaSlice
> = (set, get) => ({
  settings: defaultSettings,

  updateSettings: (partial) =>
    set((state) => {
      Object.assign(state.settings, partial);
    }),

  saveGame: async () => {
    const s = get();
    const gameState: GameState = {
      investigator: s.investigator,
      currentScene: s.currentScene,
      currentCase: s.currentCase,
      clues: s.clues,
      deductions: s.deductions,
      npcs: s.npcs,
      flags: s.flags,
      factionReputation: s.factionReputation,
      sceneHistory: s.sceneHistory,
      settings: s.settings,
    };
    SaveManager.save('autosave', gameState);
  },

  loadGame: async (saveId: string) => {
    const gameState = SaveManager.load(saveId);
    if (!gameState) return;
    set((state) => {
      state.investigator = gameState.investigator;
      state.currentScene = gameState.currentScene;
      state.currentCase = gameState.currentCase;
      state.clues = gameState.clues;
      state.deductions = gameState.deductions;
      state.npcs = gameState.npcs;
      state.flags = gameState.flags;
      state.factionReputation = gameState.factionReputation;
      state.sceneHistory = gameState.sceneHistory;
      state.settings = gameState.settings;
    });
  },
});
