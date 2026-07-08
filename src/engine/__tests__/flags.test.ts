import { describe, it, expect } from 'vitest';
import { FLAGS, abilityAutoSucceedFlag, vignetteUnlockedFlag, CASE_LOAD_CLEARED_FLAGS } from '../flags';

describe('FLAGS', () => {
  it('exposes the ability auto-succeed flags by faculty', () => {
    expect(abilityAutoSucceedFlag('reason')).toBe('ability-auto-succeed-reason');
    expect(abilityAutoSucceedFlag('vigor')).toBe('ability-auto-succeed-vigor');
    expect(abilityAutoSucceedFlag('influence')).toBe('ability-auto-succeed-influence');
  });
  it('exposes veil sight and last-critical-faculty', () => {
    expect(FLAGS.veilSight).toBe('ability-veil-sight-active');
    expect(FLAGS.lastCriticalFaculty).toBe('last-critical-faculty');
  });
  it('builds the vignette-unlocked flag for an id', () => {
    expect(vignetteUnlockedFlag('a-matter-of-shadows')).toBe('vignette-unlocked-a-matter-of-shadows');
  });
  it('lists exactly the flags cleared on case load', () => {
    expect(new Set(CASE_LOAD_CLEARED_FLAGS)).toEqual(new Set([
      'breakdown-occurred', 'incapacitated',
      'ability-auto-succeed-reason', 'ability-auto-succeed-vigor',
      'ability-auto-succeed-influence', 'ability-veil-sight-active',
      'last-critical-faculty',
    ]));
  });
});
