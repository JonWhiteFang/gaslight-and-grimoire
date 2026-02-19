/**
 * Property-based tests for the Narrative Engine — condition evaluation.
 *
 * Property 6: `evaluateConditions` with an empty conditions array always returns `true`
 * Validates: Requirements 2.5
 *
 * Property 7: `evaluateConditions` is pure — same state and conditions always
 *             produce the same result
 * Validates: Requirements 2.5, 3.2
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { evaluateConditions } from '../narrativeEngine';
import type { Condition, GameState } from '../../types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const facultyArb = fc.constantFrom(
  'reason',
  'perception',
  'nerve',
  'vigor',
  'influence',
  'lore',
) as fc.Arbitrary<'reason' | 'perception' | 'nerve' | 'vigor' | 'influence' | 'lore'>;

const archetypeArb = fc.constantFrom(
  'deductionist',
  'occultist',
  'operator',
  'mesmerist',
) as fc.Arbitrary<'deductionist' | 'occultist' | 'operator' | 'mesmerist'>;

/** Generates a minimal but valid GameState for condition evaluation. */
const gameStateArb: fc.Arbitrary<GameState> = fc.record({
  investigator: fc.record({
    name: fc.string(),
    archetype: archetypeArb,
    faculties: fc.record({
      reason: fc.integer({ min: 1, max: 20 }),
      perception: fc.integer({ min: 1, max: 20 }),
      nerve: fc.integer({ min: 1, max: 20 }),
      vigor: fc.integer({ min: 1, max: 20 }),
      influence: fc.integer({ min: 1, max: 20 }),
      lore: fc.integer({ min: 1, max: 20 }),
    }),
    composure: fc.integer({ min: 0, max: 10 }),
    vitality: fc.integer({ min: 0, max: 10 }),
    abilityUsed: fc.boolean(),
  }),
  currentScene: fc.string(),
  currentCase: fc.string(),
  clues: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.record({
      id: fc.string({ minLength: 1 }),
      type: fc.constantFrom('physical', 'testimony', 'occult', 'deduction', 'redHerring') as fc.Arbitrary<'physical' | 'testimony' | 'occult' | 'deduction' | 'redHerring'>,
      title: fc.string(),
      description: fc.string(),
      sceneSource: fc.string(),
      tags: fc.array(fc.string()),
      status: fc.constantFrom('new', 'examined', 'connected', 'deduced', 'contested', 'spent') as fc.Arbitrary<'new' | 'examined' | 'connected' | 'deduced' | 'contested' | 'spent'>,
      isRevealed: fc.boolean(),
    }),
  ),
  deductions: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.record({
      id: fc.string({ minLength: 1 }),
      clueIds: fc.array(fc.string()),
      description: fc.string(),
      isRedHerring: fc.boolean(),
    }),
  ),
  npcs: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.record({
      id: fc.string({ minLength: 1 }),
      name: fc.string(),
      faction: fc.option(fc.string(), { nil: null }),
      disposition: fc.integer({ min: -10, max: 10 }),
      suspicion: fc.integer({ min: 0, max: 10 }),
      memoryFlags: fc.dictionary(fc.string({ minLength: 1 }), fc.boolean()),
      isAlive: fc.boolean(),
      isAccessible: fc.boolean(),
    }),
  ),
  flags: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.boolean()),
  factionReputation: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: -20, max: 20 }),
  ),
  sceneHistory: fc.array(fc.string()),
  settings: fc.record({
    fontSize: fc.constantFrom('standard', 'large', 'extraLarge') as fc.Arbitrary<'standard' | 'large' | 'extraLarge'>,
    highContrast: fc.boolean(),
    reducedMotion: fc.boolean(),
    textSpeed: fc.constantFrom('typewriter', 'fast', 'instant') as fc.Arbitrary<'typewriter' | 'fast' | 'instant'>,
    hintsEnabled: fc.boolean(),
    autoSaveFrequency: fc.constantFrom('choice', 'scene', 'manual') as fc.Arbitrary<'choice' | 'scene' | 'manual'>,
    audioVolume: fc.record({
      ambient: fc.float({ min: 0, max: 1 }),
      sfx: fc.float({ min: 0, max: 1 }),
    }),
  }),
});

/** Generates a single Condition of any supported type. */
const conditionArb: fc.Arbitrary<Condition> = fc.oneof(
  fc.record({ type: fc.constant('hasClue' as const), target: fc.string({ minLength: 1 }) }),
  fc.record({ type: fc.constant('hasDeduction' as const), target: fc.string({ minLength: 1 }) }),
  fc.record({
    type: fc.constant('hasFlag' as const),
    target: fc.string({ minLength: 1 }),
    value: fc.boolean(),
  }),
  fc.record({
    type: fc.constant('facultyMin' as const),
    target: facultyArb,
    value: fc.integer({ min: 1, max: 20 }),
  }),
  fc.record({
    type: fc.constant('archetypeIs' as const),
    target: fc.string(),
    value: archetypeArb,
  }),
  fc.record({
    type: fc.constant('npcDisposition' as const),
    target: fc.string({ minLength: 1 }),
    value: fc.integer({ min: -10, max: 10 }),
  }),
  fc.record({
    type: fc.constant('factionReputation' as const),
    target: fc.string({ minLength: 1 }),
    value: fc.integer({ min: -20, max: 20 }),
  }),
);

// ─── Property 6 ───────────────────────────────────────────────────────────────

describe('Property 6 — evaluateConditions with empty array always returns true', () => {
  /**
   * Validates: Requirements 2.5
   * An empty conditions array means "no prerequisites" — always accessible.
   */
  it('returns true for any game state when conditions is []', () => {
    fc.assert(
      fc.property(gameStateArb, (state) => {
        return evaluateConditions([], state) === true;
      }),
      { numRuns: 500 },
    );
  });
});

// ─── Property 7 ───────────────────────────────────────────────────────────────

describe('Property 7 — evaluateConditions is pure (deterministic)', () => {
  /**
   * Validates: Requirements 2.5, 3.2
   * Calling evaluateConditions twice with identical inputs must yield the same result.
   * This confirms no hidden state, randomness, or side effects.
   */
  it('returns the same result on repeated calls with the same conditions and state', () => {
    fc.assert(
      fc.property(
        fc.array(conditionArb, { minLength: 0, maxLength: 5 }),
        gameStateArb,
        (conditions, state) => {
          const result1 = evaluateConditions(conditions, state);
          const result2 = evaluateConditions(conditions, state);
          return result1 === result2;
        },
      ),
      { numRuns: 500 },
    );
  });

  it('same conditions on structurally equal states always produce the same result', () => {
    fc.assert(
      fc.property(
        fc.array(conditionArb, { minLength: 1, maxLength: 4 }),
        gameStateArb,
        (conditions, state) => {
          // Deep-clone the state to ensure structural equality without reference equality
          const clonedState: GameState = JSON.parse(JSON.stringify(state));
          const result1 = evaluateConditions(conditions, state);
          const result2 = evaluateConditions(conditions, clonedState);
          return result1 === result2;
        },
      ),
      { numRuns: 500 },
    );
  });
});
