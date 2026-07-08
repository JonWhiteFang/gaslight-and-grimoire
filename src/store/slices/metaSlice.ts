import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { GameSettings } from '../../types';
import { SaveManager } from '../../engine/saveManager';
import { fetchManifest, loadCase, loadVignette } from '../../engine/narrativeEngine';
import { snapshotGameState } from '../../utils/gameState';
import { vignetteToCaseData } from './narrativeSlice';

const MAX_MANUAL_SAVES = 10;

export interface MetaSlice {
  settings: GameSettings;
  updateSettings: (partial: Partial<GameSettings>) => void;
  saveGame: () => Promise<void>;
  autoSave: () => void;
  loadGame: (saveId: string) => Promise<boolean>;
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
    const gameState = snapshotGameState(s);
    const saveId = `save-${Date.now()}`;
    SaveManager.save(saveId, gameState, s.caseData?.meta.title);

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
      SaveManager.save('autosave', snapshotGameState(s), s.caseData?.meta.title);
    } catch {
      // localStorage may be unavailable in tests or private browsing
    }
  },

  loadGame: async (saveId: string): Promise<boolean> => {
    const gameState = SaveManager.load(saveId);
    if (!gameState) return false;

    try {
      // Re-load content BEFORE mutating store state, so a content failure
      // (e.g. a 404) does not leave the store half-restored. Vignette saves
      // must use the side-cases loader — loadCase would 404 on /content/cases.
      let caseData = null;
      if (gameState.currentCase) {
        const manifest = await fetchManifest();
        const entry = manifest.cases.find((c) => c.id === gameState.currentCase);
        if (entry?.type === 'vignette') {
          const data = await loadVignette(gameState.currentCase);
          caseData = vignetteToCaseData(data);
        } else {
          caseData = await loadCase(gameState.currentCase);
        }
      }

      set((state) => {
        state.investigator = gameState.investigator;
        state.currentScene = gameState.currentScene;
        state.currentCase = gameState.currentCase;
        state.clues = gameState.clues;
        state.deductions = gameState.deductions;
        state.npcs = gameState.npcs;
        state.flags = gameState.flags;
        state.factionReputation = gameState.factionReputation;
        state.sceneHistory = gameState.sceneHistory ?? [];
        state.connections = gameState.connections ?? [];
        // Restore which scenes have already applied their onEnter effects so a
        // reload does not re-fire them (F-006). Fall back to the visited history
        // for pre-v3 saves that predate this field.
        state.visitedScenes = gameState.visitedScenes ?? [...(gameState.sceneHistory ?? []), gameState.currentScene].filter(Boolean);
        state.lastEffectMessages = [];
        state.settings = gameState.settings;
        state.caseData = caseData;
      });

      return true;
    } catch {
      // Content could not be loaded — leave the store untouched and signal failure.
      return false;
    }
  },
});
