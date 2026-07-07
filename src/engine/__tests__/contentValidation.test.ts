/**
 * Unit tests for the shared content validator (src/engine/contentValidation.ts).
 *
 * This module is the single source of truth for "valid content", consumed by
 * both the runtime `validateContent` and the build-time `scripts/validateCase.ts`.
 * These tests pin the error/warning contract for every check class.
 */

import { describe, it, expect } from 'vitest';
import {
  validateBundle,
  computeReachableScenes,
  computeMaxDisposition,
  type ContentBundle,
} from '../contentValidation';
import type { Choice, Clue, NPCState, SceneNode } from '../../types';

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeScene(overrides: Partial<SceneNode> & { id: string }): SceneNode {
  return {
    act: 1,
    narrative: '',
    cluesAvailable: [],
    choices: [],
    ...overrides,
  };
}

function makeChoice(overrides: Partial<Choice> & { id: string }): Choice {
  return {
    text: '',
    outcomes: {} as Choice['outcomes'],
    ...overrides,
  };
}

function makeClue(overrides: Partial<Clue> & { id: string }): Clue {
  return {
    type: 'physical',
    title: '',
    description: '',
    sceneSource: '',
    tags: [],
    status: 'new',
    isRevealed: false,
    ...overrides,
  };
}

function makeNpc(overrides: Partial<NPCState> & { id: string }): NPCState {
  return {
    name: '',
    faction: null,
    disposition: 0,
    suspicion: 0,
    memoryFlags: {},
    isAlive: true,
    isAccessible: true,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  return {
    scenes: [],
    variants: [],
    clues: [],
    npcs: [],
    ...overrides,
  };
}

// ─── Clean bundle ────────────────────────────────────────────────────────────

describe('validateBundle — clean content', () => {
  it('returns no errors and no warnings for a minimal well-formed bundle', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [
        makeScene({
          id: 's1',
          cluesAvailable: [{ clueId: 'c1', method: 'automatic' }],
          choices: [makeChoice({ id: 'ch1', outcomes: { success: 's2' } as Choice['outcomes'] })],
        }),
        makeScene({ id: 's2' }),
      ],
      clues: [makeClue({ id: 'c1', sceneSource: 's1' })],
    });

    const result = validateBundle(bundle, { includeReachability: true });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

// ─── Edge / clue reference errors (parity with existing behavior) ─────────────

describe('validateBundle — scene-graph edge and clue reference errors', () => {
  it('flags a choice outcome pointing at an unknown scene', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [makeScene({ id: 's1', choices: [makeChoice({ id: 'ch1', outcomes: { success: 'ghost' } as Choice['outcomes'] })] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('flags requiresClue referencing an unknown clue', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', choices: [makeChoice({ id: 'ch1', requiresClue: 'nope', outcomes: { success: 's1' } as Choice['outcomes'] })] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('nope'))).toBe(true);
  });

  it('flags advantageIf referencing an unknown clue', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', choices: [makeChoice({ id: 'ch1', advantageIf: ['ghostclue'], outcomes: { success: 's1' } as Choice['outcomes'] })] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghostclue'))).toBe(true);
  });

  it('flags cluesAvailable referencing an unknown clue', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', cluesAvailable: [{ clueId: 'ghostclue', method: 'automatic' }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghostclue'))).toBe(true);
  });
});

// ─── Tier completeness incl. dynamicDifficulty (F-017 divergence fix) ─────────

describe('validateBundle — faculty-check tier completeness', () => {
  it('flags a fixed-difficulty faculty check missing a tier', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', choices: [makeChoice({ id: 'ch1', faculty: 'reason', difficulty: 10, outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1' } as Choice['outcomes'] })] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('fumble'))).toBe(true);
  });

  it('flags a dynamicDifficulty-only faculty check missing a tier (CLI parity gap)', () => {
    const bundle = makeBundle({
      scenes: [makeScene({
        id: 's1',
        choices: [makeChoice({
          id: 'ch1',
          faculty: 'reason',
          dynamicDifficulty: { baseDC: 8, scaleFaculty: 'reason', highThreshold: 14, highDC: 12 },
          outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1' } as Choice['outcomes'],
        })],
      })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('fumble'))).toBe(true);
  });
});

// ─── onEnter effect target errors ─────────────────────────────────────────────

describe('validateBundle — onEnter effect targets', () => {
  it('flags an onEnter discoverClue targeting an unknown clue', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', onEnter: [{ type: 'discoverClue', target: 'ghostclue' }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghostclue'))).toBe(true);
  });

  it('flags an onEnter disposition effect targeting an unknown npc', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', onEnter: [{ type: 'disposition', target: 'ghost-npc', delta: 1 }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-npc'))).toBe(true);
  });
});

// ─── NEW: condition target checks ─────────────────────────────────────────────

describe('validateBundle — condition targets', () => {
  it('flags a scene condition hasClue with an unknown clue target', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', conditions: [{ type: 'hasClue', target: 'ghostclue' }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghostclue'))).toBe(true);
  });

  it('flags a condition npcDisposition with an unknown npc target', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', conditions: [{ type: 'npcDisposition', target: 'ghost-npc', value: 3 }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-npc'))).toBe(true);
  });

  it('flags a condition archetypeIs with an invalid archetype value', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', conditions: [{ type: 'archetypeIs', target: '', value: 'wizard' }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('wizard'))).toBe(true);
  });

  it('flags a condition npcSuspicion with an invalid tier value', () => {
    const bundle = makeBundle({
      npcs: [makeNpc({ id: 'npc-a' })],
      scenes: [makeScene({ id: 's1', conditions: [{ type: 'npcSuspicion', target: 'npc-a', value: 'furious' }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('furious'))).toBe(true);
  });

  it('does NOT flag a hasFlag condition with value:false (legitimate "flag unset" gate)', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', conditions: [{ type: 'hasFlag', target: 'some-flag', value: false }] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors).toEqual([]);
  });
});

// ─── NEW: npcEffect target checks ─────────────────────────────────────────────

describe('validateBundle — npcEffect targets', () => {
  it('flags a choice npcEffect with an unknown npcId', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', choices: [makeChoice({ id: 'ch1', outcomes: { success: 's1' } as Choice['outcomes'], npcEffect: { npcId: 'ghost-npc', dispositionDelta: 1, suspicionDelta: 0 } })] })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-npc'))).toBe(true);
  });

  it('flags an npcEffect nested inside an encounter round choice', () => {
    const bundle = makeBundle({
      scenes: [makeScene({
        id: 's1',
        encounter: {
          isSupernatural: false,
          rounds: [{
            roundNumber: 1,
            isSupernatural: false,
            choices: [makeChoice({ id: 'ech1', outcomes: { success: 's1' } as Choice['outcomes'], npcEffect: { npcId: 'ghost-npc', dispositionDelta: 1, suspicionDelta: 0 } })],
          }],
        },
      })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-npc'))).toBe(true);
  });
});

// ─── NEW: encounter round edge + tier recursion ───────────────────────────────

describe('validateBundle — encounter rounds', () => {
  it('flags an encounter round choice outcome pointing at an unknown scene', () => {
    const bundle = makeBundle({
      scenes: [makeScene({
        id: 's1',
        encounter: {
          isSupernatural: true,
          rounds: [{
            roundNumber: 1,
            isSupernatural: true,
            choices: [makeChoice({ id: 'ech1', outcomes: { success: 'ghost-scene' } as Choice['outcomes'] })],
          }],
        },
      })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-scene'))).toBe(true);
  });

  it('flags an encounter round faculty choice missing a tier', () => {
    const bundle = makeBundle({
      scenes: [makeScene({
        id: 's1',
        encounter: {
          isSupernatural: true,
          rounds: [{
            roundNumber: 1,
            isSupernatural: true,
            choices: [makeChoice({ id: 'ech1', faculty: 'nerve', difficulty: 12, outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1' } as Choice['outcomes'] })],
          }],
        },
      })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('fumble'))).toBe(true);
  });
});

// ─── NEW: variant structural checks ───────────────────────────────────────────

describe('validateBundle — variants', () => {
  it('flags a variant whose variantOf references an unknown base scene', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1' })],
      variants: [makeScene({ id: 'v1', variantOf: 'ghost-base', variantCondition: { type: 'hasFlag', target: 'f' } })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-base'))).toBe(true);
  });

  it('flags a variant with no variantCondition (can never resolve)', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1' })],
      variants: [makeScene({ id: 'v1', variantOf: 's1' })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('v1'))).toBe(true);
  });

  it('treats shared scene ids as valid variantOf targets', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1' })],
      variants: [makeScene({ id: 'v-breakdown', variantOf: 'breakdown', variantCondition: { type: 'hasFlag', target: 'breakdown-occurred', value: false } })],
      sharedSceneIds: ['breakdown', 'incapacitation'],
    });
    const { errors } = validateBundle(bundle);
    expect(errors).toEqual([]);
  });
});

// ─── NEW: clue.sceneSource check (F-023) ──────────────────────────────────────

describe('validateBundle — clue sceneSource', () => {
  it('flags a clue whose sceneSource references a non-existent scene', () => {
    const bundle = makeBundle({
      scenes: [makeScene({ id: 's1', cluesAvailable: [{ clueId: 'c1', method: 'automatic' }] })],
      clues: [makeClue({ id: 'c1', sceneSource: 'ghost-scene' })],
    });
    const { errors } = validateBundle(bundle);
    expect(errors.some((e) => e.includes('ghost-scene'))).toBe(true);
  });
});

// ─── Reachability + undiscoverable (CLI-only warnings) ────────────────────────

describe('validateBundle — reachability warnings', () => {
  it('warns about a scene unreachable from firstScene when reachability is enabled', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [makeScene({ id: 's1' }), makeScene({ id: 'orphan' })],
    });
    const { warnings } = validateBundle(bundle, { includeReachability: true });
    expect(warnings.some((w) => w.includes('orphan'))).toBe(true);
  });

  it('does not emit reachability warnings when the option is off', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [makeScene({ id: 's1' }), makeScene({ id: 'orphan' })],
    });
    const { warnings } = validateBundle(bundle);
    expect(warnings.some((w) => w.includes('orphan'))).toBe(false);
  });

  it('warns about a clue no reachable scene can discover', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [makeScene({ id: 's1' })],
      clues: [makeClue({ id: 'lonely', sceneSource: 's1' })],
    });
    const { warnings } = validateBundle(bundle, { includeReachability: true });
    expect(warnings.some((w) => w.includes('lonely'))).toBe(true);
  });

  it('does not treat shared breakdown/incapacitation as unreachable', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [makeScene({ id: 's1' }), makeScene({ id: 'breakdown' }), makeScene({ id: 'incapacitation' })],
      sharedSceneIds: ['breakdown', 'incapacitation'],
    });
    const { warnings } = validateBundle(bundle, { includeReachability: true });
    expect(warnings.some((w) => w.includes('breakdown'))).toBe(false);
    expect(warnings.some((w) => w.includes('incapacitation'))).toBe(false);
  });
});

// ─── computeReachableScenes ───────────────────────────────────────────────────

describe('computeReachableScenes', () => {
  it('follows every outcome tier edge from firstScene', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [
        makeScene({ id: 's1', choices: [makeChoice({ id: 'ch1', outcomes: { critical: 'sA', failure: 'sB' } as Choice['outcomes'] })] }),
        makeScene({ id: 'sA' }),
        makeScene({ id: 'sB' }),
        makeScene({ id: 'sC' }),
      ],
    });
    const reachable = computeReachableScenes(bundle);
    expect(reachable.has('s1')).toBe(true);
    expect(reachable.has('sA')).toBe(true);
    expect(reachable.has('sB')).toBe(true);
    expect(reachable.has('sC')).toBe(false);
  });

  it('follows encounter round outcome edges', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      scenes: [
        makeScene({
          id: 's1',
          encounter: {
            isSupernatural: false,
            rounds: [{ roundNumber: 1, isSupernatural: false, choices: [makeChoice({ id: 'e1', outcomes: { success: 'sEnd' } as Choice['outcomes'] })] }],
          },
        }),
        makeScene({ id: 'sEnd' }),
      ],
    });
    const reachable = computeReachableScenes(bundle);
    expect(reachable.has('sEnd')).toBe(true);
  });
});

// ─── computeMaxDisposition (vignette-unlock reachability primitive) ───────────

describe('computeMaxDisposition', () => {
  it('sums the start disposition and every positive reachable delta', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      npcs: [makeNpc({ id: 'npc-a', disposition: -2 })],
      scenes: [
        makeScene({
          id: 's1',
          onEnter: [{ type: 'disposition', target: 'npc-a', delta: 2 }],
          choices: [makeChoice({ id: 'ch1', outcomes: { success: 's2' } as Choice['outcomes'], npcEffect: { npcId: 'npc-a', dispositionDelta: 1, suspicionDelta: 0 } })],
        }),
        makeScene({ id: 's2', onEnter: [{ type: 'disposition', target: 'npc-a', delta: 3 }] }),
      ],
    });
    // start -2, +2 onEnter s1, +1 choice, +3 onEnter s2 = 4
    expect(computeMaxDisposition(bundle, 'npc-a')).toBe(4);
  });

  it('ignores negative deltas and unreachable scenes when computing the maximum', () => {
    const bundle = makeBundle({
      firstScene: 's1',
      npcs: [makeNpc({ id: 'npc-a', disposition: 0 })],
      scenes: [
        makeScene({ id: 's1', onEnter: [{ type: 'disposition', target: 'npc-a', delta: -5 }], choices: [makeChoice({ id: 'ch1', outcomes: { success: 's2' } as Choice['outcomes'] })] }),
        makeScene({ id: 's2' }),
        makeScene({ id: 'unreachable', onEnter: [{ type: 'disposition', target: 'npc-a', delta: 10 }] }),
      ],
    });
    expect(computeMaxDisposition(bundle, 'npc-a')).toBe(0);
  });
});
