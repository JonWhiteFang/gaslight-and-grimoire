import { describe, it, expect } from 'vitest';
import { checkAutoSucceeds } from '../flags';
import { resolveCheckOutcome } from '../choiceResolution';
import type { Choice, GameState } from '../../types';

describe('checkAutoSucceeds', () => {
  it('is true when the faculty has an active auto-succeed flag', () => {
    expect(checkAutoSucceeds('reason', { 'ability-auto-succeed-reason': true })).toBe(true);
    expect(checkAutoSucceeds('vigor', { 'ability-auto-succeed-vigor': true })).toBe(true);
    expect(checkAutoSucceeds('influence', { 'ability-auto-succeed-influence': true })).toBe(true);
  });

  it('is false when the flag is absent or false', () => {
    expect(checkAutoSucceeds('reason', {})).toBe(false);
    expect(checkAutoSucceeds('reason', { 'ability-auto-succeed-reason': false })).toBe(false);
  });

  it('is false for faculties that have no auto-succeed ability', () => {
    expect(checkAutoSucceeds('perception', { 'ability-auto-succeed-reason': true })).toBe(false);
    expect(checkAutoSucceeds('nerve', {})).toBe(false);
    expect(checkAutoSucceeds('lore', {})).toBe(false);
  });
});

describe('resolveCheckOutcome — auto-succeed still short-circuits after the refactor', () => {
  it('returns a guaranteed critical and consumes the ability flag', () => {
    const choice = {
      id: 'x', text: 't', faculty: 'reason', difficulty: 14,
      outcomes: { critical: 'crit', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
    } as Choice;
    const state = { flags: { 'ability-auto-succeed-reason': true }, investigator: {
      name: 'T', archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10, abilityUsed: false,
    } } as unknown as GameState;
    const out = resolveCheckOutcome(choice, state);
    expect(out.result.tier).toBe('critical');
    expect(out.result.nextSceneId).toBe('crit');
    expect(out.consumedAbilityFlag).toBe('ability-auto-succeed-reason');
  });
});
