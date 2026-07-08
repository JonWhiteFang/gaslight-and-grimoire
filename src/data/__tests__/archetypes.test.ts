import { describe, it, expect } from 'vitest';
import { ARCHETYPES, primaryFacultyOf } from '../archetypes';

describe('archetype table is the single source', () => {
  it('exposes primary faculty per archetype', () => {
    expect(primaryFacultyOf('deductionist')).toBe('reason');
    expect(primaryFacultyOf('occultist')).toBe('lore');
    expect(primaryFacultyOf('operator')).toBe('vigor');
    expect(primaryFacultyOf('mesmerist')).toBe('influence');
  });
  it('covers every archetype in the ARCHETYPES array', () => {
    for (const a of ARCHETYPES) expect(primaryFacultyOf(a.id)).toBeDefined();
  });
});
