import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { NPCState } from '../../types';

export interface NpcSlice {
  npcs: Record<string, NPCState>;
  adjustDisposition: (npcId: string, delta: number) => void;
  adjustSuspicion: (npcId: string, delta: number) => void;
  setNpcMemoryFlag: (npcId: string, flag: string, value: boolean) => void;
  removeNpc: (npcId: string) => void;
}

export const createNpcSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  NpcSlice
> = (set, get) => ({
  npcs: {},

  adjustDisposition: (npcId, delta) => {
    set((state) => {
      const npc = state.npcs[npcId];
      if (npc) {
        npc.disposition = Math.max(-10, Math.min(10, npc.disposition + delta));
      }
    });
    // Faction reputation propagation (Req 8.9, 19.2):
    // When a faction-aligned NPC's Disposition changes, apply a proportional
    // shift (delta * 0.5) to the associated faction's reputation.
    const npc = get().npcs[npcId];
    if (npc?.faction) {
      get().adjustReputation(npc.faction, delta * 0.5);
    }
  },

  adjustSuspicion: (npcId, delta) =>
    set((state) => {
      const npc = state.npcs[npcId];
      if (npc) {
        npc.suspicion = Math.max(0, Math.min(10, npc.suspicion + delta));
      }
    }),

  setNpcMemoryFlag: (npcId, flag, value) =>
    set((state) => {
      const npc = state.npcs[npcId];
      if (npc) {
        npc.memoryFlags[flag] = value;
      }
    }),

  removeNpc: (npcId) =>
    set((state) => {
      const npc = state.npcs[npcId];
      if (npc) {
        npc.isAlive = false;
        npc.isAccessible = false;
      }
    }),
});
