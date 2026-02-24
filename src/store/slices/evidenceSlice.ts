import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { Clue, ClueStatus, Deduction } from '../../types';

export interface ClueConnection {
  fromId: string;
  toId: string;
}

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
      if (state.clues[clueId]) {
        state.clues[clueId].isRevealed = true;
        state.clues[clueId].status = 'new';
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
