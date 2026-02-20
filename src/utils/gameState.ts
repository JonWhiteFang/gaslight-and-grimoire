import type { GameState } from '../types';
import type { GameStore } from '../store/types';

/** Builds a serialisable GameState snapshot from the store. */
export function snapshotGameState(s: GameStore): GameState {
  return {
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
}
