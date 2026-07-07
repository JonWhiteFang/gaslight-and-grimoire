/**
 * Tests for isHaltScene — detecting breakdown/incapacitation terminal scenes
 * so the UI shows an "Investigation halted" screen rather than "Case Complete"
 * (F-011, issue #9).
 *
 * These scenes are injected shared scenes with canonical ids `breakdown` and
 * `incapacitation`, but each main case overrides them with a *variant* whose id
 * differs (e.g. `wc-breakdown`) while carrying `variantOf: 'breakdown'`. The
 * predicate must recognise both the base scenes and their case-specific variants.
 */
import { describe, it, expect } from 'vitest';
import { isHaltScene, haltReason } from '../haltScenes';
import type { SceneNode } from '../../types';

function scene(overrides: Partial<SceneNode>): SceneNode {
  return {
    id: 'x', act: 1, narrative: 'n', cluesAvailable: [], choices: [],
    ...overrides,
  };
}

describe('isHaltScene', () => {
  it('recognises the base breakdown scene', () => {
    expect(isHaltScene(scene({ id: 'breakdown' }))).toBe(true);
  });

  it('recognises the base incapacitation scene', () => {
    expect(isHaltScene(scene({ id: 'incapacitation' }))).toBe(true);
  });

  it('recognises a case-specific breakdown variant by variantOf', () => {
    expect(isHaltScene(scene({ id: 'wc-breakdown', variantOf: 'breakdown' }))).toBe(true);
  });

  it('recognises a case-specific incapacitation variant by variantOf', () => {
    expect(isHaltScene(scene({ id: 'ms-incapacitation', variantOf: 'incapacitation' }))).toBe(true);
  });

  it('returns false for an ordinary scene', () => {
    expect(isHaltScene(scene({ id: 'act3-finale' }))).toBe(false);
  });

  it('returns false for an ordinary variant of an ordinary scene', () => {
    expect(isHaltScene(scene({ id: 'act1-intro-veil', variantOf: 'act1-intro' }))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isHaltScene(null)).toBe(false);
  });
});

describe('haltReason', () => {
  it('maps breakdown to composure', () => {
    expect(haltReason(scene({ id: 'breakdown' }))).toBe('composure');
  });

  it('maps a breakdown variant to composure', () => {
    expect(haltReason(scene({ id: 'wc-breakdown', variantOf: 'breakdown' }))).toBe('composure');
  });

  it('maps incapacitation to vitality', () => {
    expect(haltReason(scene({ id: 'incapacitation' }))).toBe('vitality');
  });

  it('maps an incapacitation variant to vitality', () => {
    expect(haltReason(scene({ id: 'lw-incapacitation', variantOf: 'incapacitation' }))).toBe('vitality');
  });

  it('returns null for a non-halt scene', () => {
    expect(haltReason(scene({ id: 'act2-alley' }))).toBeNull();
  });

  it('returns null for null', () => {
    expect(haltReason(null)).toBeNull();
  });
});
