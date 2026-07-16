import { describe, it, expect } from 'vitest';
import { classifyBoard } from '../deductionOracle';
import type { Clue, ClueConnection, KeyDeduction } from '../../types';

function clue(id: string, over: Partial<Clue> = {}): Clue {
  return {
    id, type: 'physical', title: id, description: '', sceneSource: 's',
    connectsTo: [], tags: [], status: 'examined', isRevealed: true, ...over,
  };
}
const edge = (fromId: string, toId: string): ClueConnection => ({ fromId, toId });
const recipe = (id: string, requiredClues: string[], isRedHerring = false): KeyDeduction =>
  ({ id, requiredClues, title: id, description: id, isRedHerring });

function clues(...cs: Clue[]): Record<string, Clue> {
  return Object.fromEntries(cs.map((c) => [c.id, c]));
}

describe('classifyBoard — recipe path', () => {
  it('forms a correct component when a non-red-herring recipe subset is connected', () => {
    const cs = clues(clue('a'), clue('b'), clue('c'));
    const comps = classifyBoard([edge('a', 'b'), edge('b', 'c')], cs, [recipe('r1', ['a', 'b'])]);
    expect(comps).toHaveLength(1);
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('matches a recipe whose required clues are NOT connectsTo-connected (player topology, not connectsTo)', () => {
    // a,b,c,d have NO connectsTo edges between them, but the player connected them.
    const cs = clues(clue('a'), clue('b'), clue('c'), clue('d'));
    const comps = classifyBoard(
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')], cs, [recipe('r', ['a', 'b', 'c', 'd'])],
    );
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['r']);
  });

  it('forms BOTH recipes when one component satisfies two complete recipes (Blocker 1)', () => {
    const cs = clues(clue('w'), clue('s'), clue('q'), clue('d'));
    const recipes = [
      recipe('one-true-murder', ['w', 's']),        // non-red-herring
      recipe('poisoner', ['q', 's', 'd'], true),     // red-herring
    ];
    const comps = classifyBoard([edge('w', 's'), edge('s', 'q'), edge('q', 'd')], cs, recipes);
    expect(comps).toHaveLength(1);
    expect(comps[0].correctness).toBe('correct'); // a non-red-herring recipe matched
    expect(comps[0].recipes.map((r) => r.id).sort()).toEqual(['one-true-murder', 'poisoner']);
  });

  it('is `false` when ONLY a red-herring recipe matches', () => {
    const cs = clues(clue('q'), clue('s'), clue('d'));
    const comps = classifyBoard(
      [edge('q', 's'), edge('s', 'd')], cs, [recipe('poisoner', ['q', 's', 'd'], true)],
    );
    expect(comps[0].correctness).toBe('false');
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['poisoner']);
  });

  it('orders matched recipes deterministically for presentation (non-RH → largest → lowest id)', () => {
    const cs = clues(clue('a'), clue('b'), clue('c'));
    const recipes = [
      recipe('zzz', ['a', 'b'], true),          // red-herring → last
      recipe('big', ['a', 'b', 'c']),           // non-RH, 3 required → first
      recipe('small', ['a', 'b']),              // non-RH, 2 required → second
    ];
    const comps = classifyBoard([edge('a', 'b'), edge('b', 'c')], cs, recipes);
    expect(comps[0].recipes.map((r) => r.id)).toEqual(['big', 'small', 'zzz']);
  });
});

describe('classifyBoard — generic path (no recipe)', () => {
  it('correct: all player-edges are authored connectsTo (undirected)', () => {
    const cs = clues(clue('a', { connectsTo: ['b'] }), clue('b')); // one-way authored edge
    const comps = classifyBoard([edge('a', 'b')], cs, []);
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes).toEqual([]);
  });

  it('false: all-authored but the component contains a redHerring clue (N4)', () => {
    const cs = clues(clue('a', { connectsTo: ['b'] }), clue('b', { type: 'redHerring' }));
    const comps = classifyBoard([edge('a', 'b')], cs, []);
    expect(comps[0].correctness).toBe('false');
  });

  it('partial: some player-edges authored, some not', () => {
    const cs = clues(clue('a', { connectsTo: ['b'] }), clue('b'), clue('c'));
    const comps = classifyBoard([edge('a', 'b'), edge('b', 'c')], cs, []); // b-c not authored
    expect(comps[0].correctness).toBe('partial');
  });

  it('incorrect: no player-edge is authored', () => {
    const cs = clues(clue('a'), clue('b'));
    const comps = classifyBoard([edge('a', 'b')], cs, []);
    expect(comps[0].correctness).toBe('incorrect');
  });
});

describe('classifyBoard — fail-closed + topology', () => {
  it('classifies a <2-clue component as incorrect', () => {
    const cs = clues(clue('a'));
    // a self-referential or lone edge endpoint: no valid 2-clue component
    const comps = classifyBoard([], cs, []);
    expect(comps).toEqual([]);
  });

  it('drops an edge with a missing or unrevealed endpoint', () => {
    const cs = clues(clue('a'), clue('b', { isRevealed: false }));
    const comps = classifyBoard([edge('a', 'b'), edge('a', 'missing')], cs, []);
    expect(comps).toEqual([]); // both edges dropped → no ≥2 component
  });

  it('does not read an inherited Object.prototype member as a clue', () => {
    const cs = clues(clue('a'));
    const comps = classifyBoard([edge('a', 'toString')], cs, []);
    expect(comps).toEqual([]);
  });

  it('classifies two disjoint clusters independently', () => {
    const cs = clues(
      clue('a', { connectsTo: ['b'] }), clue('b'),
      clue('x'), clue('y'),
    );
    const comps = classifyBoard([edge('a', 'b'), edge('x', 'y')], cs, []);
    const byKey = comps.map((c) => `${c.clueIds.join('+')}:${c.correctness}`).sort();
    expect(byKey).toEqual(['a+b:correct', 'x+y:incorrect']);
  });
});
