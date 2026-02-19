/**
 * Property tests for Zustand store slice isolation.
 *
 * Property 1: Updating one slice does not mutate sibling slices.
 * Validates: Requirements 2, 6, 8
 */

import { describe, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useStore } from '../index';
import type { Clue, NPCState } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStore() {
  useStore.setState({
    investigator: {
      name: 'Test Investigator',
      archetype: 'deductionist',
      faculties: {
        reason: 10,
        perception: 10,
        nerve: 10,
        vigor: 10,
        influence: 10,
        lore: 10,
      },
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    },
    clues: {
      'clue-1': {
        id: 'clue-1',
        type: 'physical',
        title: 'Torn Letter',
        description: 'A fragment of correspondence.',
        sceneSource: 'scene-1',
        tags: ['paper', 'whitechapel'],
        status: 'new',
        isRevealed: true,
      } satisfies Clue,
    },
    npcs: {
      'npc-1': {
        id: 'npc-1',
        name: 'Inspector Graves',
        faction: 'Rationalists Circle',
        disposition: 2,
        suspicion: 0,
        memoryFlags: {},
        isAlive: true,
        isAccessible: true,
      } satisfies NPCState,
    },
    flags: { 'met-graves': true },
    factionReputation: { 'Rationalists Circle': 3 },
    currentScene: 'scene-1',
    currentCase: 'the-whitechapel-cipher',
    sceneHistory: [],
    deductions: {},
  });
}

// Deep-clone the parts of state we want to snapshot
function snapshotSiblings(exclude: 'investigator' | 'clues' | 'npcs' | 'flags') {
  const s = useStore.getState();
  return {
    investigator: exclude !== 'investigator' ? JSON.stringify(s.investigator) : null,
    clues: exclude !== 'clues' ? JSON.stringify(s.clues) : null,
    npcs: exclude !== 'npcs' ? JSON.stringify(s.npcs) : null,
    flags: exclude !== 'flags' ? JSON.stringify(s.flags) : null,
    factionReputation: JSON.stringify(s.factionReputation),
    currentScene: s.currentScene,
    currentCase: s.currentCase,
    sceneHistory: JSON.stringify(s.sceneHistory),
    settings: JSON.stringify(s.settings),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Store slice isolation — Property 1', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adjustComposure does not mutate clues, npcs, flags, or narrative slices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 5 }),
        (delta) => {
          resetStore();
          const before = snapshotSiblings('investigator');

          useStore.getState().adjustComposure(delta);

          const after = snapshotSiblings('investigator');

          return (
            before.clues === after.clues &&
            before.npcs === after.npcs &&
            before.flags === after.flags &&
            before.factionReputation === after.factionReputation &&
            before.currentScene === after.currentScene &&
            before.currentCase === after.currentCase &&
            before.sceneHistory === after.sceneHistory &&
            before.settings === after.settings
          );
        },
      ),
    );
  });

  it('adjustVitality does not mutate clues, npcs, flags, or narrative slices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 5 }),
        (delta) => {
          resetStore();
          const before = snapshotSiblings('investigator');

          useStore.getState().adjustVitality(delta);

          const after = snapshotSiblings('investigator');

          return (
            before.clues === after.clues &&
            before.npcs === after.npcs &&
            before.flags === after.flags &&
            before.factionReputation === after.factionReputation &&
            before.currentScene === after.currentScene &&
            before.settings === after.settings
          );
        },
      ),
    );
  });

  it('updateClueStatus does not mutate investigator, npcs, flags, or narrative slices', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('new' as const, 'examined' as const, 'connected' as const, 'deduced' as const, 'contested' as const, 'spent' as const),
        (status) => {
          resetStore();
          const before = snapshotSiblings('clues');

          useStore.getState().updateClueStatus('clue-1', status);

          const after = snapshotSiblings('clues');

          return (
            before.investigator === after.investigator &&
            before.npcs === after.npcs &&
            before.flags === after.flags &&
            before.factionReputation === after.factionReputation &&
            before.currentScene === after.currentScene &&
            before.settings === after.settings
          );
        },
      ),
    );
  });

  it('adjustDisposition does not mutate investigator, clues, flags, or narrative slices', () => {
    // Note: factionReputation IS allowed to change here — Req 8.9 requires that
    // adjusting a faction-aligned NPC's disposition propagates a proportional
    // shift to factionReputation. The isolation guarantee is that unrelated
    // slices (investigator, clues, flags, scene) are untouched.
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 5 }),
        (delta) => {
          resetStore();
          const before = snapshotSiblings('npcs');

          useStore.getState().adjustDisposition('npc-1', delta);

          const after = snapshotSiblings('npcs');

          return (
            before.investigator === after.investigator &&
            before.clues === after.clues &&
            before.flags === after.flags &&
            before.currentScene === after.currentScene &&
            before.settings === after.settings
          );
        },
      ),
    );
  });

  it('adjustDisposition propagates to factionReputation for faction-aligned NPCs', () => {
    // Req 8.9, 19.2: disposition delta * 0.5 applied to faction reputation
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 5 }),
        (delta) => {
          resetStore();
          const repBefore = useStore.getState().factionReputation['Rationalists Circle'] ?? 0;

          useStore.getState().adjustDisposition('npc-1', delta);

          const repAfter = useStore.getState().factionReputation['Rationalists Circle'] ?? 0;
          const expected = repBefore + delta * 0.5;
          return repAfter === expected;
        },
      ),
    );
  });

  it('adjustDisposition does not affect factionReputation for NPCs with no faction', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 5 }),
        (delta) => {
          resetStore();
          // Add a faction-less NPC alongside the existing state
          const current = useStore.getState();
          useStore.setState({
            npcs: {
              ...current.npcs,
              'npc-no-faction': {
                id: 'npc-no-faction',
                name: 'Unknown Stranger',
                faction: null,
                disposition: 0,
                suspicion: 0,
                memoryFlags: {},
                isAlive: true,
                isAccessible: true,
              },
            },
          });
          const repBefore = JSON.stringify(useStore.getState().factionReputation);

          useStore.getState().adjustDisposition('npc-no-faction', delta);

          const repAfter = JSON.stringify(useStore.getState().factionReputation);
          return repBefore === repAfter;
        },
      ),
    );
  });

  it('setFlag does not mutate investigator, clues, npcs, or narrative slices', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.boolean(),
        (flagName, value) => {
          resetStore();
          const before = snapshotSiblings('flags');

          useStore.getState().setFlag(flagName, value);

          const after = snapshotSiblings('flags');

          return (
            before.investigator === after.investigator &&
            before.clues === after.clues &&
            before.npcs === after.npcs &&
            before.currentScene === after.currentScene &&
            before.currentCase === after.currentCase &&
            before.settings === after.settings
          );
        },
      ),
    );
  });

  it('goToScene does not mutate investigator, clues, npcs, or flags slices', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (sceneId) => {
          resetStore();
          const s = useStore.getState();
          const invBefore = JSON.stringify(s.investigator);
          const cluesBefore = JSON.stringify(s.clues);
          const npcsBefore = JSON.stringify(s.npcs);
          const flagsBefore = JSON.stringify(s.flags);
          const repBefore = JSON.stringify(s.factionReputation);

          useStore.getState().goToScene(sceneId);

          const s2 = useStore.getState();
          return (
            invBefore === JSON.stringify(s2.investigator) &&
            cluesBefore === JSON.stringify(s2.clues) &&
            npcsBefore === JSON.stringify(s2.npcs) &&
            flagsBefore === JSON.stringify(s2.flags) &&
            repBefore === JSON.stringify(s2.factionReputation)
          );
        },
      ),
    );
  });
});
