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
    expect(errs.some((e) => /escape-path choice .* may not set/.test(e))).toBe(true);
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

  it('a valid disabled choice with a real gateReason produces no gating error', () => {
    const c = baseChoice({ requiresClue: 'clue-1', visibility: 'disabled', gateReason: 'The lock holds fast.' });
    const gating = errorsOf(c).filter((e) => /visibility|gateReason|gate/.test(e));
    expect(gating).toEqual([]);
  });
});
