import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { Clue, ClueConnection, ClueStatus, Deduction } from '../../types';

// Re-exported for existing importers; canonical definition lives in src/types.
export type { ClueConnection };

export interface EvidenceSlice {
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  connections: ClueConnection[];
  discoverClue: (clueId: string) => void;
  updateClueStatus: (clueId: string, status: ClueStatus) => void;
  addDeduction: (deduction: Deduction) => void;
  addConnection: (fromId: string, toId: string) => void;
  clearConnections: () => void;
}

export const createEvidenceSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  EvidenceSlice
> = (set) => ({
  clues: {},
  deductions: {},
  connections: [],

  discoverClue: (clueId) =>
    set((state) => {
      const clue = state.clues[clueId];
      // Only initialise status on first discovery. Re-discovering the same clue
      // in a later scene must preserve any progression (connected/deduced/etc.).
      if (clue && !clue.isRevealed) {
        clue.isRevealed = true;
        clue.status = 'new';
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

  addConnection: (fromId, toId) =>
    set((state) => {
      const exists = state.connections.some(
        (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId),
      );
      if (!exists) {
        state.connections.push({ fromId, toId });
      }
    }),

  clearConnections: () =>
    set((state) => {
      state.connections = [];
    }),
});
