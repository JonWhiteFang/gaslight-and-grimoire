/**
 * Property-based + boundary tests for NPC disposition and suspicion bounds.
 *
 * These drive the REAL `npcSlice` actions (`adjustDisposition`/`adjustSuspicion`)
 * and assert the STORE's value stays clamped — not a local re-implementation of
 * the clamp. A mutation that removes `Math.max(-10, Math.min(10, …))` from
 * `npcSlice.ts` must fail here (F-112: the previous version asserted against copy
 * helpers, so a clamp-removing mutation survived the whole suite).
 *
 * Property 9: `adjustDisposition` never produces a value outside [-10, +10]
 * Property 10: `adjustSuspicion` never produces a value outside [0, 10]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useStore } from '../../store/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Seed the store with a single faction-less NPC at the given starting values.
 * `faction: null` isolates disposition/suspicion from the reputation-propagation
 * coupling (`adjustDisposition` → `adjustReputation`), which is tested elsewhere.
 */
function seedNpc(disposition: number, suspicion: number) {
  useStore.setState({
    npcs: {
      'npc-1': {
        id: 'npc-1',
        name: 'Test',
        faction: null,
        disposition,
        suspicion,
        memoryFlags: {},
        isAlive: true,
        isAccessible: true,
      },
    },
  });
}

const disposition = () => useStore.getState().npcs['npc-1'].disposition;
const suspicion = () => useStore.getState().npcs['npc-1'].suspicion;

// ─── Property 9 ───────────────────────────────────────────────────────────────

describe('Property 9 — adjustDisposition clamps the store value to [-10, +10]', () => {
  beforeEach(() => seedNpc(0, 0));

  it('store disposition is always in [-10, +10] for any starting value and delta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // valid starting disposition
        fc.integer({ min: -20, max: 20 }), // any delta
        (start, delta) => {
          seedNpc(start, 0);
          useStore.getState().adjustDisposition('npc-1', delta);
          const d = disposition();
          return d >= -10 && d <= 10;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('clamps to exactly +10 on a large positive delta (kills the Math.min mutation)', () => {
    seedNpc(5, 0);
    useStore.getState().adjustDisposition('npc-1', 100);
    expect(disposition()).toBe(10);
  });

  it('clamps to exactly -10 on a large negative delta (kills the Math.max mutation)', () => {
    seedNpc(-5, 0);
    useStore.getState().adjustDisposition('npc-1', -100);
    expect(disposition()).toBe(-10);
  });

  it('applies a within-range delta unclamped', () => {
    seedNpc(0, 0);
    useStore.getState().adjustDisposition('npc-1', 3);
    expect(disposition()).toBe(3);
  });
});

// ─── Property 10 ──────────────────────────────────────────────────────────────

describe('Property 10 — adjustSuspicion clamps the store value to [0, 10]', () => {
  beforeEach(() => seedNpc(0, 0));

  it('store suspicion is always in [0, 10] for any starting value and delta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),   // valid starting suspicion
        fc.integer({ min: -20, max: 20 }), // any delta
        (start, delta) => {
          seedNpc(0, start);
          useStore.getState().adjustSuspicion('npc-1', delta);
          const s = suspicion();
          return s >= 0 && s <= 10;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('clamps to exactly 10 on a large positive delta (kills the Math.min mutation)', () => {
    seedNpc(0, 5);
    useStore.getState().adjustSuspicion('npc-1', 100);
    expect(suspicion()).toBe(10);
  });

  it('clamps to exactly 0 on a large negative delta — no negative suspicion (kills the Math.max mutation)', () => {
    seedNpc(0, 5);
    useStore.getState().adjustSuspicion('npc-1', -100);
    expect(suspicion()).toBe(0);
  });

  it('applies a within-range delta unclamped', () => {
    seedNpc(0, 2);
    useStore.getState().adjustSuspicion('npc-1', 3);
    expect(suspicion()).toBe(5);
  });
});
