import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { GameSettings } from '../../types';
import { SaveManager } from '../../engine/saveManager';
import { loadCase } from '../../engine/narrativeEngine';
import { snapshotGameState } from '../../utils/gameState';

const MAX_MANUAL_SAVES = 10;

export interface MetaSlice {
  settings: GameSettings;
  updateSettings: (partial: Partial<GameSettings>) => void;
  saveGame: () => Promise<void>;
  autoSave: () => void;
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
    const gameState = snapshotGameState(get());
    const saveId = `save-${Date.now()}`;
    SaveManager.save(saveId, gameState);

    // Cap manual saves at MAX_MANUAL_SAVES (exclude autosave)
    const all = SaveManager.listSaves();
    const manual = all.filter((s) => s.id !== 'autosave');
    if (manual.length > MAX_MANUAL_SAVES) {
      // Delete oldest (list is sorted newest-first)
      for (const old of manual.slice(MAX_MANUAL_SAVES)) {
        SaveManager.deleteSave(old.id);
      }
    }
  },

  autoSave: () => {
    const s = get();
    if (!s.currentScene) return;
    try {
      SaveManager.save('autosave', snapshotGameState(s));
    } catch {
      // localStorage may be unavailable in tests or private browsing
    }
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

    // Restore caseData by re-loading the case JSON (Task 2: fix loadGame)
    if (gameState.currentCase) {
      const caseData = await loadCase(gameState.currentCase);
      set((state) => {
        state.caseData = caseData;
      });
    }
  },
});
