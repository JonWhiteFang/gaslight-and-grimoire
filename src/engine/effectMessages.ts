/**
 * effectMessages — pure functions that convert Effect objects into
 * player-facing feedback strings (atmospheric + mechanical annotation).
 */
import type { Effect, NPCState } from '../types';

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function npcName(target: string | undefined, npcs: Record<string, NPCState>): string {
  if (!target) return 'Someone';
  return npcs[target]?.name ?? target;
}

function mechanicalSuffix(label: string, delta: number): string {
  return ` (${label} ${formatDelta(delta)})`;
}

/**
 * Generate a single feedback message for an effect.
 * Returns null for effect types that have their own feedback (flag, discoverClue).
 */
export function generateEffectMessage(
  effect: Effect,
  npcs: Record<string, NPCState>,
): string | null {
  const { type, target, delta, description } = effect;

  if (type === 'flag' || type === 'discoverClue') return null;
  if (delta === undefined) return null;

  const suffix = mechanicalSuffix(
    type === 'disposition' || type === 'suspicion'
      ? type.charAt(0).toUpperCase() + type.slice(1)
      : type === 'reputation'
        ? 'Reputation'
        : type === 'composure'
          ? 'Composure'
          : 'Vitality',
    delta,
  );

  if (description) return description + suffix;

  const name = npcName(target, npcs);

  switch (type) {
    case 'composure':
      return (delta < 0 ? 'A chill settles over you' : 'You steady yourself') + suffix;
    case 'vitality':
      return (delta < 0 ? 'You feel a sharp sting' : 'Renewed vigour courses through you') + suffix;
    case 'disposition':
      return (delta > 0
        ? `${name} regards you with newfound respect`
        : `${name} grows cold toward you`) + suffix;
    case 'suspicion':
      return (delta > 0
        ? `${name} eyes you more carefully`
        : `${name} seems to relax`) + suffix;
    case 'reputation':
      return `Your standing with ${target ?? 'a faction'} shifts` + suffix;
    default:
      return null;
  }
}

/** Map an array of effects to feedback messages, filtering nulls. */
export function generateEffectMessages(
  effects: Effect[],
  npcs: Record<string, NPCState>,
): string[] {
  return effects.map((e) => generateEffectMessage(e, npcs)).filter((m): m is string => m !== null);
}
