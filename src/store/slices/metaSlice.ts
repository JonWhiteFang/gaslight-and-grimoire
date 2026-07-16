import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { GameSettings } from '../../types';
import { SaveManager } from '../../engine/saveManager';
import { fetchManifest, loadCase, loadVignette } from '../../engine/narrativeEngine';
import { snapshotGameState } from '../../utils/gameState';
import { vignetteToCaseData } from './narrativeSlice';

const MAX_MANUAL_SAVES = 10;

/**
 * Result of a manual save. `ok` is false when persistence threw (e.g.
 * localStorage quota/disabled) so the caller can surface an error instead of a
 * false "Game saved" (F-103); `evicted` is how many old saves the 10-cap
 * removed (F-052).
 */
export interface SaveResult {
  ok: boolean;
  evicted: number;
}

export interface MetaSlice {
  settings: GameSettings;
  updateSettings: (partial: Partial<GameSettings>) => void;
  saveGame: () => Promise<SaveResult>;
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

  saveGame: async (): Promise<SaveResult> => {
    const s = get();
    const gameState = snapshotGameState(s);
    const saveId = `save-${Date.now()}`;

    // localStorage.setItem can throw (QuotaExceededError, private browsing,
    // storage disabled, enterprise lockdown). Without this guard the throw
    // becomes an unhandled rejection while the caller shows "Game saved" — the
    // player believes the game saved when it didn't (F-103). Mirror autoSave's
    // resilience, but REPORT the failure so the UI can surface an error toast.
    try {
      SaveManager.save(saveId, gameState, s.caseData?.meta.title);
    } catch {
      return { ok: false, evicted: 0 };
    }

    // Cap manual saves at MAX_MANUAL_SAVES (exclude autosave)
    const all = SaveManager.listSaves();
    const manual = all.filter((s) => s.id !== 'autosave');
    let evicted = 0;
    if (manual.length > MAX_MANUAL_SAVES) {
      // Delete oldest (list is sorted newest-first)
      for (const old of manual.slice(MAX_MANUAL_SAVES)) {
        SaveManager.deleteSave(old.id);
        evicted += 1;
      }
    }
    return { ok: true, evicted };
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

      // Cancel any pending contested-revert timer before committing loaded state,
      // so an in-flight timer can't fire against a freshly loaded same-id clue.
      // (Also clears contestedTokens/contestedPrior/attemptSeq — the loaded state
      // has none of its own; contested statuses are normalized by SaveManager.)
      get().cancelContestedReverts();

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
        // Resume mid-encounter progress so a reload doesn't restart the fight or
        // re-roll/re-apply the reaction damage (F-105). Absent in pre-v4 saves → null.
        state.encounterState = gameState.encounterState ?? null;
        state.lastEffectMessages = [];
        // Clear any stale roll result so a prior scene's dice/DC overlay can't leak
        // onto the loaded scene. This path assigns currentScene directly (not via
        // goToScene, where F-106's cross-scene clear lives), so it must clear here.
        state.lastCheckResult = null;
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
