import type { OutcomeTier } from '../types';

export const FACTIONS: ReadonlySet<string> = new Set<string>([
  'Rationalists Circle',
  'Hermetic Order of the Grey Dawn',
  'Lamplighters',
  'Court of Smoke',
]);

export const OUTCOME_TIERS = ['critical', 'success', 'partial', 'failure', 'fumble'] as const satisfies readonly OutcomeTier[];

/** Compile-time exhaustiveness guard for switch statements. */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
