/**
 * buildDeduction — pure helper that constructs a Deduction from a set of clue IDs.
 */
import type { Clue, Deduction, KeyDeduction } from '../types';

function formatClueList(titles: string[]): string {
  if (titles.length <= 2) return titles.join(' ↔ ');
  return titles.slice(0, -1).join(', ') + ', and ' + titles[titles.length - 1];
}

export function buildDeduction(
  clueIds: string[],
  clues: Record<string, Clue>,
): Deduction {
  const isRedHerring = clueIds.some(
    (id) => clues[id]?.type === 'redHerring',
  );

  const titles = clueIds.map((id) => clues[id]?.title ?? id);
  const prefix = isRedHerring ? 'Questionable connection' : 'Connection';
  const description = `${prefix}: ${formatClueList(titles)}`;

  return {
    id: `deduction-generic-${[...clueIds].sort().join('+')}`,
    clueIds,
    description,
    isRedHerring,
  };
}

/**
 * Returns the first recipe whose requiredClues are all present in `connectedIds`
 * (subset match — extra connected clues are allowed), or null if none match.
 * Pure; no store access.
 */
export function matchDeduction(
  connectedIds: string[],
  recipes: KeyDeduction[],
): KeyDeduction | null {
  const connected = new Set(connectedIds);
  for (const recipe of recipes) {
    if (recipe.requiredClues.every((id) => connected.has(id))) {
      return recipe;
    }
  }
  return null;
}

/**
 * Builds a Deduction stored under the recipe's stable authored id, so
 * `hasDeduction` gates can reference it. `clueIds` records the recipe's required
 * clues (the meaningful set), not any extra connected noise.
 */
export function buildDeductionFromRecipe(
  recipe: KeyDeduction,
  _connectedIds: string[],
): Deduction {
  return {
    id: recipe.id,
    clueIds: [...recipe.requiredClues],
    description: recipe.description,
    isRedHerring: recipe.isRedHerring,
  };
}
