import { describe, it, expect } from 'vitest';
import { isFacultyCheck } from '../diceEngine';
import type { Choice } from '../../types';

const mk = (o: Partial<Choice>): Choice => ({ id: 'c', text: 't', outcomes: {} as Choice['outcomes'], ...o } as Choice);

describe('isFacultyCheck', () => {
  it('true: faculty + static difficulty', () => {
    expect(isFacultyCheck(mk({ faculty: 'reason', difficulty: 14 }))).toBe(true);
  });
  it('true: faculty + dynamicDifficulty', () => {
    expect(isFacultyCheck(mk({ faculty: 'reason', dynamicDifficulty: { baseDC: 12, scaleFaculty: 'reason', highThreshold: 14, highDC: 16 } as Choice['dynamicDifficulty'] }))).toBe(true);
  });
  it('true: difficulty 0 counts (not undefined)', () => {
    expect(isFacultyCheck(mk({ faculty: 'reason', difficulty: 0 }))).toBe(true);
  });
  it('false: faculty but no difficulty of any kind', () => {
    expect(isFacultyCheck(mk({ faculty: 'reason' }))).toBe(false);
  });
  it('false: no faculty', () => {
    expect(isFacultyCheck(mk({ difficulty: 14 }))).toBe(false);
  });
});
