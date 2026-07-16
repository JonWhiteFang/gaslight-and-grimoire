import type { Faculty, Investigator } from '../types';
import { calculateModifier, getTrainedBonus } from './diceEngine';

export type ProspectsBand = 'favourable' | 'uncertain' | 'forbidding';

export interface CheckOdds {
  faculty: Faculty;
  modifier: number;
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  autoSucceeds: boolean;
  band: ProspectsBand;
}

export interface ComputeCheckOddsArgs {
  faculty: Faculty;
  investigator: Investigator;
  dc: number;
  hasAdvantage: boolean;
  hasDisadvantage: boolean;
  autoSucceeds: boolean;
  /** true where a `partial` tier yields the advertised benefit (clue prompts) */
  partialCountsAsSuccess: boolean;
}

// Band thresholds on the EFFECTIVE success probability.
const FAVOURABLE_MIN = 0.65;
const UNCERTAIN_MIN = 0.35;

// Natural-roll clamp: nat-1 always fails, nat-20 always succeeds.
const P_MIN = 1 / 20;
const P_MAX = 19 / 20;

const FACULTY_DISPLAY: Record<Faculty, string> = {
  reason: 'Reason', perception: 'Perception', nerve: 'Nerve',
  vigor: 'Vigor', influence: 'Influence', lore: 'Lore',
};

function clamp(p: number): number {
  return Math.max(P_MIN, Math.min(P_MAX, p));
}

function bandFor(pEff: number): ProspectsBand {
  if (pEff >= FAVOURABLE_MIN) return 'favourable';
  if (pEff >= UNCERTAIN_MIN) return 'uncertain';
  return 'forbidding';
}

export function computeCheckOdds(args: ComputeCheckOddsArgs): CheckOdds {
  const { faculty, investigator, dc, hasAdvantage, hasDisadvantage, autoSucceeds, partialCountsAsSuccess } = args;
  const modifier =
    calculateModifier(investigator.faculties[faculty]) + getTrainedBonus(faculty, investigator.archetype);

  if (autoSucceeds) {
    return { faculty, modifier, dc, hasAdvantage, hasDisadvantage, autoSucceeds: true, band: 'favourable' };
  }

  // Lowest passing natural roll. resolveCheck: success at total >= dc; partial at total >= dc-3.
  const passThreshold = partialCountsAsSuccess ? dc - 3 : dc;
  const needed = passThreshold - modifier;
  // P(nat >= needed) over a d20 = (21 - needed)/20, then clamped.
  const p = clamp((21 - needed) / 20);

  // advantage/disadvantage cancel
  const adv = hasAdvantage && !hasDisadvantage;
  const dis = hasDisadvantage && !hasAdvantage;
  const pEff = adv ? 1 - (1 - p) * (1 - p) : dis ? p * p : p;

  return { faculty, modifier, dc, hasAdvantage, hasDisadvantage, autoSucceeds: false, band: bandFor(pEff) };
}

export function describeCheckOdds(odds: CheckOdds): string {
  const name = FACULTY_DISPLAY[odds.faculty];
  if (odds.autoSucceeds) return `${name} check, assured success`;
  const mod = odds.modifier >= 0 ? `+${odds.modifier}` : `${odds.modifier}`;
  let phrase = `${name} check, modifier ${mod}, difficulty ${odds.dc}, prospects ${odds.band}`;
  if (odds.hasAdvantage && !odds.hasDisadvantage) phrase += ', advantage';
  else if (odds.hasDisadvantage && !odds.hasAdvantage) phrase += ', disadvantage';
  return phrase;
}
