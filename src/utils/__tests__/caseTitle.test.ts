/**
 * Tests for caseTitle — resolving a human-readable case title (F-010, issue #10).
 */
import { describe, it, expect } from 'vitest';
import { deslugifyCaseId, resolveCaseTitle } from '../caseTitle';

describe('deslugifyCaseId', () => {
  it('title-cases a hyphenated case id', () => {
    expect(deslugifyCaseId('the-whitechapel-cipher')).toBe('The Whitechapel Cipher');
  });

  it('handles a single-word id', () => {
    expect(deslugifyCaseId('breakdown')).toBe('Breakdown');
  });

  it('returns an empty string unchanged', () => {
    expect(deslugifyCaseId('')).toBe('');
  });
});

describe('resolveCaseTitle', () => {
  it('prefers the explicit title when present', () => {
    expect(resolveCaseTitle('The Mayfair Séance', 'the-mayfair-seance')).toBe(
      'The Mayfair Séance',
    );
  });

  it('falls back to a de-slugified id when title is missing', () => {
    expect(resolveCaseTitle(undefined, 'the-lamplighters-wake')).toBe(
      'The Lamplighters Wake',
    );
  });

  it('falls back to a de-slugified id when title is empty', () => {
    expect(resolveCaseTitle('', 'the-lamplighters-wake')).toBe('The Lamplighters Wake');
  });

  it('returns the game name when neither title nor id is available', () => {
    expect(resolveCaseTitle(undefined, '')).toBe('Gaslight & Grimoire');
    expect(resolveCaseTitle(undefined, undefined)).toBe('Gaslight & Grimoire');
  });
});
