/**
 * goToScene onEnter-effect application (F-020 / guards F-006).
 *
 * Effects fire exactly once per playthrough: revisiting a scene (back-and-forth)
 * must NOT re-apply its composure/vitality/flag deltas, and the scene id is
 * recorded in visitedScenes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../index';
import type { CaseData, SceneNode } from '../../types';

function scene(id: string, onEnter?: SceneNode['onEnter'], choices: SceneNode['choices'] = []): SceneNode {
  return { id, act: 1, narrative: `narrative ${id}`, cluesAvailable: [], choices, onEnter };
}

function makeCaseData(scenes: SceneNode[]): CaseData {
  const byId: Record<string, SceneNode> = {};
  for (const s of scenes) byId[s.id] = s;
  return {
    meta: { id: 'test-case', title: 'Test Case', synopsis: '', acts: 3, facultyDistribution: {} },
    scenes: byId, clues: {}, npcs: {}, variants: [],
  };
}

function resetStore(caseData: CaseData) {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, npcs: {}, connections: [],
    flags: {}, factionReputation: {},
    currentScene: '', currentCase: 'test-case', sceneHistory: [], visitedScenes: [],
    lastEffectMessages: [], lastCheckResult: null,
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: true, textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'manual', audioVolume: { ambient: 0, sfx: 0 } },
    caseData,
  });
}

describe('goToScene — onEnter effects fire once per playthrough (F-006)', () => {
  beforeEach(() => {
    resetStore(makeCaseData([
      scene('a', [{ type: 'composure', delta: -1 }]),
      scene('b'),
    ]));
  });

  it('applies a composure onEnter effect once on first entry', () => {
    useStore.getState().goToScene('a');
    expect(useStore.getState().investigator.composure).toBe(9);
    expect(useStore.getState().visitedScenes).toContain('a');
  });

  it('does NOT re-apply the effect when the scene is re-entered', () => {
    const s = useStore.getState();
    s.goToScene('a'); // composure 10 → 9, visited
    s.goToScene('b'); // move away
    s.goToScene('a'); // revisit — must not drop composure again
    expect(useStore.getState().investigator.composure).toBe(9);
  });

  it('records visitedScenes only once per scene', () => {
    const s = useStore.getState();
    s.goToScene('a');
    s.goToScene('b');
    s.goToScene('a');
    const visits = useStore.getState().visitedScenes.filter((id) => id === 'a');
    expect(visits).toHaveLength(1);
  });

  it('clears lastEffectMessages on a scene with no onEnter', () => {
    const s = useStore.getState();
    s.goToScene('a'); // sets messages
    expect(useStore.getState().lastEffectMessages.length).toBeGreaterThan(0);
    s.goToScene('b'); // no onEnter → cleared
    expect(useStore.getState().lastEffectMessages).toEqual([]);
  });
});
