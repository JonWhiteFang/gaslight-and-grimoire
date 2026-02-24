import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { Effect } from '../../types';

export interface WorldSlice {
  flags: Record<string, boolean>;
  factionReputation: Record<string, number>;
  setFlag: (flag: string, value: boolean | string) => void;
  adjustReputation: (faction: string, delta: number) => void;
  applyEffects: (effects: Effect[]) => void;
}

export const createWorldSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  WorldSlice
> = (set, get) => ({
  flags: {},
  factionReputation: {},

  setFlag: (flag, value) =>
    set((state) => {
      state.flags[flag] = value as boolean;
    }),

  adjustReputation: (faction, delta) =>
    set((state) => {
      const current = state.factionReputation[faction] ?? 0;
      state.factionReputation[faction] = Math.max(-10, Math.min(10, current + delta));
    }),

  applyEffects: (effects) => {
    if (!effects || effects.length === 0) return;
    const store = get();
    for (const effect of effects) {
      switch (effect.type) {
        case 'composure':
          if (effect.delta !== undefined) store.adjustComposure(effect.delta);
          break;
        case 'vitality':
          if (effect.delta !== undefined) store.adjustVitality(effect.delta);
          break;
        case 'flag':
          if (effect.target !== undefined) store.setFlag(effect.target, effect.value as boolean ?? true);
          break;
        case 'disposition':
          if (effect.target !== undefined && effect.delta !== undefined) store.adjustDisposition(effect.target, effect.delta);
          break;
        case 'suspicion':
          if (effect.target !== undefined && effect.delta !== undefined) store.adjustSuspicion(effect.target, effect.delta);
          break;
        case 'reputation':
          if (effect.target !== undefined && effect.delta !== undefined) store.adjustReputation(effect.target, effect.delta);
          break;
        case 'discoverClue':
          if (effect.target !== undefined) store.discoverClue(effect.target);
          break;
      }
    }
  },
});
