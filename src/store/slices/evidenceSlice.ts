import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { Clue, ClueConnection, ClueStatus, Deduction } from '../../types';

// Re-exported for existing importers; canonical definition lives in src/types.
export type { ClueConnection };

// Pending contested-revert timers, keyed by attempt generation. Module-scoped so
// they can be cancelled on case-load/save-load without living in serialisable state.
const revertTimers = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Cancels every pending revert timer WITHOUT touching store state. Callers that
 * are already inside a `set` producer (case-load reset) use this to keep the
 * timer registry encapsulated while clearing the serialisable fields themselves.
 */
export function clearRevertTimers(): void {
  for (const handle of revertTimers.values()) clearTimeout(handle);
  revertTimers.clear();
}

export interface EvidenceSlice {
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  connections: ClueConnection[];
  /** clue id → the attempt generation that last marked it contested (ownership). */
  contestedTokens: Record<string, number>;
  /** clue id → the baseline semantic status to restore when its revert fires. */
  contestedPrior: Record<string, ClueStatus>;
  /** Monotonic attempt counter; each attempt claims a fresh generation. */
  attemptSeq: number;
  discoverClue: (clueId: string) => void;
  updateClueStatus: (clueId: string, status: ClueStatus) => void;
  addDeduction: (deduction: Deduction) => void;
  addConnection: (fromId: string, toId: string) => void;
  clearConnections: () => void;
  /** Mark clues contested with fresh ownership; schedule a 2s revert to their baseline prior. */
  contestClues: (clueIds: string[]) => void;
  /** Atomic success: invalidate tokens + clear prior + set 'deduced' so a stale revert can't clobber. */
  markCluesDeduced: (clueIds: string[]) => void;
  /** Cancel every pending revert and clear ownership state (case-load / save-load). */
  cancelContestedReverts: () => void;
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
  contestedTokens: {},
  contestedPrior: {},
  attemptSeq: 0,

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

  contestClues: (clueIds) => {
    // Claim a fresh generation for this attempt, mark its clues contested, and
    // capture each clue's baseline prior ONLY if not already set — re-contesting
    // a clue that is already 'contested' must NOT snapshot 'contested' as its
    // prior (that would strand it in a fail→fail overlap). The generation is read
    // back out of the producer so the timer below can gate on ownership.
    let gen = 0;
    set((state) => {
      gen = ++state.attemptSeq;
      for (const id of clueIds) {
        if (!state.clues[id]) continue;
        if (state.contestedPrior[id] === undefined) {
          state.contestedPrior[id] = state.clues[id].status;
        }
        state.clues[id].status = 'contested';
        state.contestedTokens[id] = gen;
      }
    });
    const handle = setTimeout(() => {
      revertTimers.delete(gen);
      set((s) => {
        for (const id of clueIds) {
          // Restore ONLY if this attempt still owns the clue — a later attempt
          // (fail or success) overwrote the token, so a stale timer no-ops.
          if (s.contestedTokens[id] === gen && s.clues[id]) {
            s.clues[id].status = s.contestedPrior[id] ?? 'examined';
            delete s.contestedTokens[id];
            delete s.contestedPrior[id];
          }
        }
      });
    }, 2000);
    revertTimers.set(gen, handle);
  },

  markCluesDeduced: (clueIds) =>
    set((state) => {
      for (const id of clueIds) {
        if (!state.clues[id]) continue;
        // Invalidate any pending revert ownership so a stale timer no-ops on this clue.
        delete state.contestedTokens[id];
        delete state.contestedPrior[id];
        state.clues[id].status = 'deduced';
      }
    }),

  cancelContestedReverts: () => {
    clearRevertTimers();
    set((state) => {
      // Restore any still-contested clue to its baseline prior before clearing —
      // cancelling the pending revert must not strand a clue 'contested'. (On the
      // load paths the clues are replaced immediately after, so this is a no-op
      // there; it matters when reverts are cancelled without a state wipe.)
      for (const [id, prior] of Object.entries(state.contestedPrior)) {
        if (state.clues[id]?.status === 'contested') {
          state.clues[id].status = prior;
        }
      }
      state.contestedTokens = {};
      state.contestedPrior = {};
      state.attemptSeq = 0;
    });
  },
});
