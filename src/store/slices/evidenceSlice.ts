import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { Clue, ClueStatus, Deduction } from '../../types';
import { AudioManager } from '../../engine/audioManager';
import type { SfxEvent } from '../../engine/audioManager';

export interface EvidenceSlice {
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  discoverClue: (clueId: string) => void;
  updateClueStatus: (clueId: string, status: ClueStatus) => void;
  addDeduction: (deduction: Deduction) => void;
}

export const createEvidenceSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  EvidenceSlice
> = (set) => ({
  clues: {},
  deductions: {},

  discoverClue: (clueId) =>
    set((state) => {
      if (state.clues[clueId]) {
        state.clues[clueId].isRevealed = true;
        state.clues[clueId].status = 'new';
        // Play clue-type-specific chime
        const clueType = state.clues[clueId].type;
        const sfxEvent: SfxEvent = `clue-${clueType}` as SfxEvent;
        AudioManager.playSfx(sfxEvent, state.settings.audioVolume.sfx);
      }
    }),

  updateClueStatus: (clueId, status) =>
    set((state) => {
      if (state.clues[clueId]) {
        state.clues[clueId].status = status;
      }
    }),

  addDeduction: (deduction) =>
    set((state) => {
      state.deductions[deduction.id] = deduction;
    }),
});
