/**
 * validateContent — the load-time gate wrapper around validateBundle (F-031).
 *
 * loadAndStartCase/Vignette call this and throw when it returns invalid, so a
 * broken scene graph never reaches the player. These tests exercise the wrapper
 * directly (the shared validateBundle has its own suite).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateContent } from '../narrativeEngine';
import type { CaseData, SceneNode } from '../../types';

function scene(id: string, choices: SceneNode['choices'] = []): SceneNode {
  return { id, act: 1, narrative: `n-${id}`, cluesAvailable: [], choices };
}

function makeCaseData(scenes: SceneNode[], variants: SceneNode[] = []): CaseData {
  const byId: Record<string, SceneNode> = {};
  for (const s of scenes) byId[s.id] = s;
  return {
    meta: { id: 'test', title: 'Test', synopsis: '', acts: 3, facultyDistribution: {} },
    scenes: byId, clues: {}, npcs: {}, variants,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('validateContent', () => {
  it('returns valid for a self-consistent case', () => {
    const data = makeCaseData([
      scene('start', [{ id: 'c', text: 'go', outcomes: { success: 'end', critical: 'end', partial: 'end', failure: 'end', fumble: 'end' } }]),
      scene('end'),
    ]);
    const result = validateContent(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags a choice that points to a non-existent scene', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = makeCaseData([
      scene('start', [{ id: 'c', text: 'go', outcomes: { success: 'nowhere', critical: 'nowhere', partial: 'nowhere', failure: 'nowhere', fumble: 'nowhere' } }]),
    ]);
    const result = validateContent(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('nowhere'))).toBe(true);
  });

  it('logs each error to console.error on failure', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = makeCaseData([
      scene('start', [{ id: 'c', text: 'go', outcomes: { success: 'ghost', critical: 'ghost', partial: 'ghost', failure: 'ghost', fumble: 'ghost' } }]),
    ]);
    validateContent(data);
    expect(spy).toHaveBeenCalled();
  });

  it('accepts variantOf targets pointing at the injected shared scenes', () => {
    // A breakdown variant references the shared `breakdown` id, which is not in
    // this bundle's scenes — validateContent whitelists the shared ids so this
    // is not reported as a dangling edge.
    const data = makeCaseData(
      [scene('start')],
      [{ ...scene('wc-breakdown'), variantOf: 'breakdown', variantCondition: { type: 'hasFlag', target: 'x', value: false } }],
    );
    const result = validateContent(data);
    expect(result.valid).toBe(true);
  });
});
