import type { Archetype, Faculty } from '../types';

/** Single source of truth for engine/progression flag string keys. */
export const FLAGS = {
  breakdownOccurred: 'breakdown-occurred',
  incapacitated: 'incapacitated',
  veilSight: 'ability-veil-sight-active',
} as const;

const ABILITY_AUTO_SUCCEED: Partial<Record<Faculty, string>> = {
  reason: 'ability-auto-succeed-reason',
  vigor: 'ability-auto-succeed-vigor',
  influence: 'ability-auto-succeed-influence',
};

export function abilityAutoSucceedFlag(faculty: Faculty): string | undefined {
  return ABILITY_AUTO_SUCCEED[faculty];
}

export function vignetteUnlockedFlag(vignetteId: string): string {
  return `vignette-unlocked-${vignetteId}`;
}

/**
 * Flags wiped when a new case/vignette starts (see narrativeSlice load actions).
 * NOTE: the former `last-critical-faculty` flag is gone — the critical-success
 * faculty reward is now the typed `investigator.lastCriticalFaculty` field,
 * reset directly in the load actions (F-013).
 */
export const CASE_LOAD_CLEARED_FLAGS: readonly string[] = [
  FLAGS.breakdownOccurred,
  FLAGS.incapacitated,
  ABILITY_AUTO_SUCCEED.reason!,
  ABILITY_AUTO_SUCCEED.vigor!,
  ABILITY_AUTO_SUCCEED.influence!,
  FLAGS.veilSight,
];

/** Archetype → its ability flag (superset of auto-succeed; includes veil sight). */
export const ARCHETYPE_ABILITY_FLAG: Record<Archetype, string> = {
  deductionist: ABILITY_AUTO_SUCCEED.reason!,
  occultist: FLAGS.veilSight,
  operator: ABILITY_AUTO_SUCCEED.vigor!,
  mesmerist: ABILITY_AUTO_SUCCEED.influence!,
};
