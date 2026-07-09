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

// F-118: the once-per-scene onEnter gate must key on the RESOLVED scene identity
// (base id or variant id), not the base id alone. Otherwise, if a hub is first
// entered before its variant condition is true (base marked visited) and later
// re-entered after the condition flips, the variant's DISTINCT onEnter never
// fires. This is the flip side of F-006 (which fixed re-firing).
describe('goToScene — variant onEnter fires once when newly eligible (F-118)', () => {
  function caseWithVariant(): CaseData {
    const base = scene('hub', [{ type: 'composure', delta: -1 }]);
    const variant: SceneNode = {
      id: 'hub-variant', act: 1, narrative: 'variant hub', cluesAvailable: [], choices: [],
      onEnter: [{ type: 'composure', delta: -3 }],
      variantOf: 'hub',
      variantCondition: { type: 'hasFlag', target: 'flip' },
    };
    return {
      meta: { id: 'test-case', title: 'Test Case', synopsis: '', acts: 3, facultyDistribution: {} },
      scenes: { hub: base }, clues: {}, npcs: {}, variants: [variant],
    };
  }

  beforeEach(() => resetStore(caseWithVariant()));

  it('fires the base onEnter with the flag off, then the variant onEnter once after the flag flips', () => {
    const s = useStore.getState();
    s.goToScene('hub');            // flag off → base resolves → composure 10 → 9
    expect(useStore.getState().investigator.composure).toBe(9);

    useStore.getState().setFlag('flip', true);
    s.goToScene('hub');            // flag on → variant resolves → composure 9 → 6 (fires once)
    expect(useStore.getState().investigator.composure).toBe(6);
  });

  it('does not re-fire the variant onEnter on a second re-entry', () => {
    const s = useStore.getState();
    s.goToScene('hub');                 // base fires: 10 → 9
    useStore.getState().setFlag('flip', true);
    s.goToScene('hub');                 // variant fires once: 9 → 6
    s.goToScene('hub');                 // must NOT re-fire
    expect(useStore.getState().investigator.composure).toBe(6);
  });
});

// F-106: the dice/outcome overlay is driven by lastCheckResult. goToScene never
// cleared it, so a check result floated over the DESTINATION scene (and further
// non-check navigations) until manually dismissed. Cross-scene navigation must
// clear it.
describe('goToScene — clears stale lastCheckResult on cross-scene navigation (F-106)', () => {
  beforeEach(() => {
    resetStore(makeCaseData([scene('a'), scene('b')]));
  });

  it('clears a lingering check result when navigating to a new scene', () => {
    const s = useStore.getState();
    s.goToScene('a');
    s.setCheckResult({ roll: 15, modifier: 2, total: 17, tier: 'success' });
    expect(useStore.getState().lastCheckResult).not.toBeNull();
    s.goToScene('b');
    expect(useStore.getState().lastCheckResult).toBeNull();
  });
});
