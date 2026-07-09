/**
 * Boundary tests for worldSlice.adjustReputation clamping (F-113).
 *
 * Faction reputation is bounded to [-10, +10] (`worldSlice.ts` `Math.max(-10,
 * Math.min(10, …))`). Engine-level tests only ever `vi.fn()`-mock this action, so
 * a clamp-removing mutation survived the whole suite. These drive the REAL slice
 * and assert the stored value is clamped.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../index';

const rep = (faction: string) => useStore.getState().factionReputation[faction] ?? 0;

beforeEach(() => {
  useStore.setState({ factionReputation: {} });
});

describe('worldSlice.adjustReputation — ±10 clamp (F-113)', () => {
  it('clamps to exactly +10 on a large positive delta (kills the Math.min mutation)', () => {
    useStore.getState().adjustReputation('Court of Smoke', 50);
    expect(rep('Court of Smoke')).toBe(10);
  });

  it('clamps to exactly -10 on a large negative delta (kills the Math.max mutation)', () => {
    useStore.getState().adjustReputation('Court of Smoke', -50);
    expect(rep('Court of Smoke')).toBe(-10);
  });

  it('accumulates within-range deltas from an unset (0) baseline', () => {
    useStore.getState().adjustReputation('Lamplighters', 3);
    useStore.getState().adjustReputation('Lamplighters', 2);
    expect(rep('Lamplighters')).toBe(5);
  });

  it('clamps a running total that crosses the upper bound', () => {
    useStore.getState().adjustReputation('Lamplighters', 8);
    useStore.getState().adjustReputation('Lamplighters', 8); // 16 → clamped
    expect(rep('Lamplighters')).toBe(10);
  });

  it('treats an unset faction as 0 before applying the delta', () => {
    useStore.getState().adjustReputation('Hermetic Order of the Grey Dawn', -4);
    expect(rep('Hermetic Order of the Grey Dawn')).toBe(-4);
  });
});
