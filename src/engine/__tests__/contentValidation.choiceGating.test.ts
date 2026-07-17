import { describe, it, expect } from 'vitest';
import { validateBundle, type ContentBundle } from '../contentValidation';
import type { Choice, SceneNode } from '../../types';
// NOTE: ContentBundle is exported by contentValidation.ts (NOT ../../types) —
// importing it from types would be a TS2305 build error.

// Build a minimal bundle with one scene holding the given choice.
function bundleWithChoice(choice: Choice): ContentBundle {
  const scene: SceneNode = {
    id: 'scene-a',
    text: 'x',
    choices: [choice],
  } as unknown as SceneNode;
  return {
    firstScene: 'scene-a',
    scenes: [scene],
    variants: [],
    clues: [{ id: 'clue-1' } as never],
    npcs: [],
    recipes: [],
    sharedSceneIds: [],
  } as unknown as ContentBundle;
}

function baseChoice(over: Partial<Choice> = {}): Choice {
  return { id: 'c1', text: 't', outcomes: { success: 'scene-a' } as Choice['outcomes'], ...over };
}

// Build a minimal bundle with one encounter scene holding a single round of choices.
function bundleWithEncounterRound(choices: Choice[], isSupernatural = false): ContentBundle {
  const scene: SceneNode = {
    id: 'scene-a',
    text: 'x',
    choices: [],
    encounter: {
      isSupernatural,
      rounds: [{ roundNumber: 1, isSupernatural, choices }],
    },
  } as unknown as SceneNode;
  return {
    firstScene: 'scene-a',
    scenes: [scene],
    variants: [],
    clues: [{ id: 'clue-1' } as never],
    npcs: [],
    recipes: [],
    sharedSceneIds: [],
  } as unknown as ContentBundle;
}

// Build a minimal bundle with one plain (non-encounter) scene holding the given choices.
function bundleWithSceneChoices(choices: Choice[]): ContentBundle {
  const scene: SceneNode = {
    id: 'scene-a',
    text: 'x',
    choices,
  } as unknown as SceneNode;
  return {
    firstScene: 'scene-a',
    scenes: [scene],
    variants: [],
    clues: [{ id: 'clue-1' } as never],
    npcs: [],
    recipes: [],
    sharedSceneIds: [],
  } as unknown as ContentBundle;
}

const errorsOf = (c: Choice) => validateBundle(bundleWithChoice(c)).errors.filter((e) => e.includes('"c1"'));
const warningsOf = (c: Choice) => validateBundle(bundleWithChoice(c)).warnings.filter((w) => w.includes('"c1"'));

describe('choice-gating validation', () => {
  it('error: disabled without a gateReason', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'disabled' }));
    expect(errs.some((e) => /disabled but has no gateReason/.test(e))).toBe(true);
  });

  it('error: gateReason present but not disabled', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', gateReason: 'r' }));
    expect(errs.some((e) => /gateReason but is not disabled/.test(e))).toBe(true);
  });

  it('treats a whitespace-only gateReason as absent (disabled -> still errors as no reason)', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: '   ' }));
    expect(errs.some((e) => /disabled but has no gateReason/.test(e))).toBe(true);
  });

  it('treats a non-string gateReason as absent (non-string coverage)', () => {
    const numeric = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: 42 as unknown as string }));
    expect(numeric.some((e) => /disabled but has no gateReason/.test(e))).toBe(true);
    const nul = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: null as unknown as string }));
    expect(nul.some((e) => /disabled but has no gateReason/.test(e))).toBe(true);
  });

  it('error: disabled/shown on an ungated choice', () => {
    expect(errorsOf(baseChoice({ visibility: 'disabled', gateReason: 'r' })).some((e) => /no requires\* gate/.test(e))).toBe(true);
    expect(errorsOf(baseChoice({ visibility: 'shown' })).some((e) => /no requires\* gate/.test(e))).toBe(true);
  });

  it('allows explicit hidden on an ungated choice (documented no-op)', () => {
    expect(errorsOf(baseChoice({ visibility: 'hidden' }))).toEqual([]);
  });

  it('error: unknown visibility value', () => {
    const errs = errorsOf(baseChoice({ requiresClue: 'clue-1', visibility: 'nope' as never }));
    expect(errs.some((e) => /invalid visibility/.test(e))).toBe(true);
  });

  it('error: escape-path choice sets visibility/gateReason', () => {
    const errs = errorsOf(baseChoice({ requiresFlag: 'f', isEscapePath: true, visibility: 'disabled', gateReason: 'r' }));
    expect(errs.some((e) => /escape-path choice may not set/.test(e))).toBe(true);
  });

  it('warning (not error): shown on a gated choice — and NO errors at all', () => {
    const c = baseChoice({ requiresClue: 'clue-1', visibility: 'shown' });
    expect(errorsOf(c)).toEqual([]);
    expect(warningsOf(c).some((w) => /shown despite a gate/.test(w))).toBe(true);
  });

  it('a shown soft-gate yields a warning with ZERO errors (CLI would exit 0)', () => {
    const result = validateBundle(bundleWithChoice(baseChoice({ requiresClue: 'clue-1', visibility: 'shown' })));
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => /shown despite a gate/.test(w))).toBe(true);
  });

  it('a valid escape path (gated, no visibility/gateReason) produces no gating error', () => {
    const errs = errorsOf(baseChoice({ requiresFlag: 'f', isEscapePath: true }));
    expect(errs.filter((e) => /visibility|gateReason|escape-path/.test(e))).toEqual([]);
  });

  it('a valid disabled choice with a real gateReason produces no gating error', () => {
    const c = baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'The lock holds fast.' });
    const gating = errorsOf(c).filter((e) => /visibility|gateReason|gate/.test(e));
    expect(gating).toEqual([]);
  });
});

describe('soft-lock warning: encounter rounds', () => {
  const ROUND_WARNING = /encounter round 1 has no guaranteed-selectable choice/;

  it('warns (zero errors) when a round\'s only non-escape choice is gated', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({ id: 'gated-only', requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'Not yet.' }),
    ]));
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => ROUND_WARNING.test(w))).toBe(true);
  });

  it('does not warn when the round has at least one ungated non-escape choice', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({ id: 'open', text: 'Stand your ground' }),
      baseChoice({ id: 'gated', requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'Not yet.' }),
    ]));
    expect(result.warnings.some((w) => ROUND_WARNING.test(w))).toBe(false);
  });

  it('does NOT warn when the only choice is a gated soft-gate (visibility: shown) — it is always selectable; the soft-gate warning still fires', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({ id: 'soft', requiresClue: 'clue-1', visibility: 'shown' }),
    ]));
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => ROUND_WARNING.test(w))).toBe(false);
    expect(result.warnings.some((w) => /shown despite a gate/.test(w))).toBe(true);
  });

  it('does NOT warn when the round\'s only choice is an UNGATED escape path — always offered', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({ id: 'flee-open', isEscapePath: true }),
    ]));
    expect(result.warnings.some((w) => ROUND_WARNING.test(w))).toBe(false);
  });

  it('warns when the round\'s only choice is a GATED escape path — hard-hidden when its gate is unmet', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({ id: 'flee', requiresFlag: 'f', isEscapePath: true }),
    ]));
    expect(result.warnings.some((w) => ROUND_WARNING.test(w))).toBe(true);
  });

  it('warns on an EMPTY round (zero choices) — a real authoring hole', () => {
    const result = validateBundle(bundleWithEncounterRound([]));
    expect(result.warnings.some((w) => ROUND_WARNING.test(w))).toBe(true);
  });
});

describe('soft-lock warning: scene choices', () => {
  const SCENE_WARNING = /has no guaranteed-selectable choice/;

  it('warns (zero errors) when a scene\'s only choice is gated + disabled', () => {
    const result = validateBundle(bundleWithSceneChoices([
      baseChoice({ id: 'c1', requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'Not yet.' }),
    ]));
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => SCENE_WARNING.test(w))).toBe(true);
  });

  it('does not warn when the scene has one ungated choice alongside a gated one', () => {
    const result = validateBundle(bundleWithSceneChoices([
      baseChoice({ id: 'open' }),
      baseChoice({ id: 'gated', requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'Not yet.' }),
    ]));
    expect(result.warnings.some((w) => SCENE_WARNING.test(w))).toBe(false);
  });

  it('does not warn on an EMPTY scene choices array (terminal/ending scene)', () => {
    const result = validateBundle(bundleWithSceneChoices([]));
    expect(result.warnings.some((w) => SCENE_WARNING.test(w))).toBe(false);
  });
});

describe('soft-lock warning: reaction-replaced first round (worseAlternative)', () => {
  const REACTION_WARNING = /may render nothing interactive after a failed reaction check/;

  it('warns when a supernatural round 1\'s ungated first choice carries a GATED worseAlternative and the rest are gated', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({
        id: 'primary',
        worseAlternative: baseChoice({ id: 'worse', requiresClue: 'clue-1' }),
      }),
      baseChoice({ id: 'gated', requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'Not yet.' }),
    ], true));
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => REACTION_WARNING.test(w))).toBe(true);
  });

  it('does not warn when the worseAlternative is itself UNGATED', () => {
    const result = validateBundle(bundleWithEncounterRound([
      baseChoice({
        id: 'primary',
        worseAlternative: baseChoice({ id: 'worse' }),
      }),
      baseChoice({ id: 'gated', requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'Not yet.' }),
    ], true));
    expect(result.warnings.some((w) => REACTION_WARNING.test(w))).toBe(false);
  });
});
