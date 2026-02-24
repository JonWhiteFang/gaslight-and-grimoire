/**
 * buildDeduction — pure helper that constructs a Deduction from a set of clue IDs.
 *
 * Req 7.10: If any connected clue is a Red Herring, isRedHerring must be true.
 */
import type { Clue, Deduction } from '../types';

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
    id: `deduction-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    clueIds,
    description,
    isRedHerring,
  };
}
