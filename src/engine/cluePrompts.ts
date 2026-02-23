import type { ClueType } from '../types';

const EXPLORATION_PROMPTS: Record<ClueType, (title: string) => string> = {
  physical: (title) => `Something here warrants closer inspection — ${title}...`,
  testimony: (title) => `There may be more to learn from what was said — ${title}...`,
  occult: () => 'A faint resonance lingers here... something arcane.',
  deduction: () => 'The pieces are here, if only you could see the pattern...',
  redHerring: (title) => `An odd detail catches your eye — ${title}...`,
};

const CHECK_PROMPTS: Record<ClueType, (title: string) => string> = {
  physical: (title) => `A careful examination might reveal more — ${title}...`,
  testimony: () => 'A sharper mind might discern what was left unsaid...',
  occult: () => 'Something arcane hums at the edge of perception... a trained eye might see it.',
  deduction: () => 'There is a pattern here, but it requires concentration to discern.',
  redHerring: (title) => `Something seems off — ${title}...`,
};

export function getCluePromptText(
  type: ClueType,
  title: string,
  method: 'exploration' | 'check',
): string {
  const prompts = method === 'exploration' ? EXPLORATION_PROMPTS : CHECK_PROMPTS;
  return (prompts[type] ?? EXPLORATION_PROMPTS.physical)(title);
}
