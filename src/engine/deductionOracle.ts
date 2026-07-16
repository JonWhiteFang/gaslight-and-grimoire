/**
 * deductionOracle — pure classification of the evidence board's player-connected
 * components. Enacts ADR-0012: correctness (not the roll) decides formation.
 *
 * Operates on the PLAYER's connection topology, never on authored `connectsTo`
 * for recipe-matching (2 of 7 shipped recipes are not connectsTo-connected).
 */
import type { Clue, ClueConnection, KeyDeduction, ClassifiedComponent } from '../types';

const has = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/** Undirected authored relationship between two clues. */
function connectsToUndirected(a: Clue, b: Clue): boolean {
  return !!a.connectsTo?.includes(b.id) || !!b.connectsTo?.includes(a.id);
}

/** Deterministic PRESENTATION order: non-red-herring → most required clues → lowest id. */
function orderRecipes(recipes: KeyDeduction[]): KeyDeduction[] {
  return [...recipes].sort((x, y) => {
    if (x.isRedHerring !== y.isRedHerring) return x.isRedHerring ? 1 : -1;
    if (x.requiredClues.length !== y.requiredClues.length) {
      return y.requiredClues.length - x.requiredClues.length;
    }
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

export function classifyBoard(
  connections: ClueConnection[],
  clues: Record<string, Clue>,
  recipes: KeyDeduction[],
): ClassifiedComponent[] {
  // 1. Fail-closed: keep only edges whose BOTH endpoints are own-property, revealed clues.
  const validEdges = connections.filter(
    (e) =>
      e.fromId !== e.toId &&
      has(clues, e.fromId) && clues[e.fromId].isRevealed &&
      has(clues, e.toId) && clues[e.toId].isRevealed,
  );

  // 2. Union-find over the valid edges → connected components.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  for (const e of validEdges) union(e.fromId, e.toId);

  const groups = new Map<string, Set<string>>();
  for (const e of validEdges) {
    const root = find(e.fromId);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root)!.add(e.fromId);
    groups.get(root)!.add(e.toId);
  }

  const out: ClassifiedComponent[] = [];
  for (const set of groups.values()) {
    if (set.size < 2) continue; // fail-closed
    const clueIds = [...set].sort();
    const S = new Set(clueIds);

    // 3a. Recipe path — every recipe whose requiredClues ⊆ S.
    const matches = recipes.filter((r) => r.requiredClues.every((id) => S.has(id)));
    if (matches.length > 0) {
      const ordered = orderRecipes(matches);
      const correctness = ordered.some((r) => !r.isRedHerring) ? 'correct' : 'false';
      out.push({ clueIds, correctness, recipes: ordered });
      continue;
    }

    // 3b. Generic path — classify player-edges against undirected connectsTo.
    const internal = validEdges.filter((e) => S.has(e.fromId) && S.has(e.toId));
    const authored = internal.filter((e) => connectsToUndirected(clues[e.fromId], clues[e.toId]));
    let correctness: ClassifiedComponent['correctness'];
    if (authored.length === internal.length) {
      const hasRedHerring = clueIds.some((id) => clues[id].type === 'redHerring');
      correctness = hasRedHerring ? 'false' : 'correct';
    } else if (authored.length > 0) {
      correctness = 'partial';
    } else {
      correctness = 'incorrect';
    }
    out.push({ clueIds, correctness, recipes: [] });
  }
  return out;
}
