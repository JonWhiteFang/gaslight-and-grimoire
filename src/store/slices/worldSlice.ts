import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';

export interface WorldSlice {
  flags: Record<string, boolean>;
  factionReputation: Record<string, number>;
  setFlag: (flag: string, value: boolean) => void;
  adjustReputation: (faction: string, delta: number) => void;
}

export const createWorldSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  WorldSlice
> = (set) => ({
  flags: {},
  factionReputation: {},

  setFlag: (flag, value) =>
    set((state) => {
      state.flags[flag] = value;
    }),

  adjustReputation: (faction, delta) =>
    set((state) => {
      const current = state.factionReputation[faction] ?? 0;
      state.factionReputation[faction] = current + delta;
    }),
});
