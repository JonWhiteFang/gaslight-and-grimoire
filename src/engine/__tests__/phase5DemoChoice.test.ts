/**
 * Phase 5 demo-choice regression witness.
 *
 * Loads the REAL shipped content JSON and proves the one intended behaviour
 * delta of the Phase 5 demo conversion: the Comet Club act-2 hub choice
 * `cc-choice-hub-halloway` (gated on the `cc-halloway-trusts` flag) is now
 * authored `visibility: 'disabled'` with a diegetic gateReason, so an
 * investigator who has not earned Lady Halloway's trust SEES the locked door
 * instead of never knowing it exists — while the identical choice without the
 * two new fields still resolves to 'hidden' (the old/default behaviour).
 */
import { describe, it, expect } from 'vitest';
import { resolveChoiceVisibility } from '../choiceVisibility';
import type { Choice, GameState } from '../../types';
import sceneData from '../../../public/content/cases/the-comet-club/act2.json';

/** A state in which the demo choice's gate (hasFlag cc-halloway-trusts) is unmet. */
function ungatedState(): GameState {
  return {
    investigator: {
      archetype: 'detective',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    },
    clues: {},
    deductions: {},
    flags: {},
    npcs: {},
    factionReputation: {},
  } as unknown as GameState;
}

describe('Phase 5 demo choice — the one intended behaviour delta', () => {
  const demo = (sceneData as { scenes: Array<{ choices?: Choice[] }> }).scenes
    .flatMap((s) => s.choices ?? [])
    .find((c) => c.id === 'cc-choice-hub-halloway') as Choice;

  it('exists and is the authored disabled form', () => {
    expect(demo).toBeDefined();
    expect(demo.requiresFlag).toBe('cc-halloway-trusts');
    expect(demo.visibility).toBe('disabled');
    expect(typeof demo.gateReason).toBe('string');
    expect((demo.gateReason as string).trim().length).toBeGreaterThan(0);
  });

  it('resolves to disabled when the gate is unmet', () => {
    expect(resolveChoiceVisibility(demo, ungatedState())).toBe('disabled');
  });

  it('an equivalent choice WITHOUT the two new fields would resolve to hidden (old/default behaviour)', () => {
    const { visibility: _visibility, gateReason: _gateReason, ...oldForm } = demo;
    expect(resolveChoiceVisibility(oldForm as Choice, ungatedState())).toBe('hidden');
  });
});
