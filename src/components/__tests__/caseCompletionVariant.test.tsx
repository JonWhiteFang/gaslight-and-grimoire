/**
 * Case Complete must quote the RESOLVED ending scene, not the base (whole-branch
 * review Major, Orrery Room). `currentScene` always holds the BASE id and
 * `caseData.scenes` is the base map — variants only resolve through
 * `resolveScene`. The Orrery Room ships the repo's first terminal-scene
 * variants (`-named` endings gated on `hasDeduction: mythos-pattern-named`),
 * so a completion handler that reads the base map silently drops the earned
 * keystone closing paragraph from the completion screen.
 *
 * This test drives the seam at the unit the fix owns: the ending narrative
 * shown on completion must come from `resolveScene(currentScene, state, caseData)`.
 */
import { describe, it, expect } from 'vitest';
import { resolveScene } from '../../engine/conditions';
import { resolveEndingNarrative } from '../../App';
import type { CaseData, GameState, SceneNode } from '../../types';

function scene(id: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, act: 2, narrative: `base ${id}`, cluesAvailable: [], choices: [], ...extra };
}

const baseEnding = scene('ending', { narrative: 'the base ending' });
const namedVariant = scene('ending-named', {
  narrative: 'the base ending — and the closing paragraph the keystone earned',
  variantOf: 'ending',
  variantCondition: { type: 'hasDeduction', target: 'mythos-pattern-named' },
});

const caseData: CaseData = {
  meta: { id: 'v', title: 'V', synopsis: '', acts: 2, facultyDistribution: {} },
  scenes: { ending: baseEnding },
  clues: {},
  npcs: {},
  variants: [namedVariant],
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: 'Test', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    },
    currentScene: 'ending',
    currentCase: 'v',
    clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard', highContrast: false, reducedMotion: false,
      textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'manual',
      audioVolume: { ambient: 0, sfx: 0 },
    },
    ...overrides,
  } as GameState;
}

const withKeystone = makeState({
  deductions: {
    'mythos-pattern-named': {
      id: 'mythos-pattern-named', clueIds: [], title: '', description: '',
      isCorrect: true, formedAt: 0,
    },
  } as unknown as GameState['deductions'],
});

describe('completion ending narrative resolves variants (whole-branch Major)', () => {
  it('sanity: resolveScene picks the -named variant with the deduction held', () => {
    expect(resolveScene('ending', withKeystone, caseData).id).toBe('ending-named');
  });

  it('resolveEndingNarrative returns the VARIANT narrative when the deduction is held', () => {
    expect(resolveEndingNarrative('ending', withKeystone, caseData)).toBe(
      'the base ending — and the closing paragraph the keystone earned',
    );
  });

  it('resolveEndingNarrative returns the base narrative without the deduction', () => {
    expect(resolveEndingNarrative('ending', makeState(), caseData)).toBe('the base ending');
  });

  it('resolveEndingNarrative is null-safe on unknown scene / missing caseData', () => {
    expect(resolveEndingNarrative('nope', makeState(), caseData)).toBeNull();
    expect(resolveEndingNarrative('ending', makeState(), null)).toBeNull();
  });
});
