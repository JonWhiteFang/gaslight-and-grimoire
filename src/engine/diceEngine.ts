import type { Faculty, Investigator, OutcomeTier, Choice } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RollResult {
  roll1: number;
  roll2: number;
  result: number;
}

export interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  dc?: number;
  tier: OutcomeTier;
}

// ─── Core Roll Functions ──────────────────────────────────────────────────────

/** Returns a random integer in [1, 20] */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/** Rolls 2d20 and takes the higher result */
export function rollWithAdvantage(): RollResult {
  const roll1 = rollD20();
  const roll2 = rollD20();
  return { roll1, roll2, result: Math.max(roll1, roll2) };
}

/** Rolls 2d20 and takes the lower result */
export function rollWithDisadvantage(): RollResult {
  const roll1 = rollD20();
  const roll2 = rollD20();
  return { roll1, roll2, result: Math.min(roll1, roll2) };
}

// ─── Modifier Calculation ─────────────────────────────────────────────────────

/** Calculates the Faculty modifier: floor((score - 10) / 2) */
export function calculateModifier(facultyScore: number): number {
  return Math.floor((facultyScore - 10) / 2);
}

// ─── Outcome Resolution ───────────────────────────────────────────────────────

/**
 * Resolves a check against a DC and returns the OutcomeTier.
 * - natural 20 → critical
 * - natural 1  → fumble
 * - total >= dc → success
 * - total >= dc - 2 → partial
 * - total < dc - 2 → failure
 */
export function resolveCheck(roll: number, modifier: number, dc: number): OutcomeTier {
  if (roll === 20) return 'critical';
  if (roll === 1) return 'fumble';

  const total = roll + modifier;
  if (total >= dc) return 'success';
  if (total >= dc - 2) return 'partial';
  return 'failure';
}

// ─── Dynamic Difficulty ───────────────────────────────────────────────────────

/**
 * Resolves the effective DC for a choice, applying dynamic difficulty scaling
 * if the choice specifies it.
 */
export function resolveDC(choice: Choice, investigator: Investigator): number {
  if (choice.dynamicDifficulty) {
    const { baseDC, scaleFaculty, highThreshold, highDC } = choice.dynamicDifficulty;
    const score = investigator.faculties[scaleFaculty as Faculty] ?? 10;
    return score >= highThreshold ? highDC : baseDC;
  }
  return choice.difficulty ?? 12;
}

// ─── Full Check Pipeline ──────────────────────────────────────────────────────

/**
 * Performs a complete Faculty check.
 * Handles advantage/disadvantage, modifier calculation, and outcome resolution.
 */
export function performCheck(
  faculty: Faculty,
  investigator: Investigator,
  dc: number,
  hasAdvantage: boolean,
  hasDisadvantage: boolean,
): CheckResult {
  let natural: number;

  // Advantage and disadvantage cancel each other out
  if (hasAdvantage && !hasDisadvantage) {
    const { result } = rollWithAdvantage();
    natural = result;
  } else if (hasDisadvantage && !hasAdvantage) {
    const { result } = rollWithDisadvantage();
    natural = result;
  } else {
    natural = rollD20();
  }

  const modifier = calculateModifier(investigator.faculties[faculty]);
  const total = natural + modifier;
  const tier = resolveCheck(natural, modifier, dc);

  return { roll: natural, modifier, total, dc, tier };
}
