import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../../index';
import type { Clue, ClueStatus } from '../../../types';

function seed(clues: Record<string, Clue>) {
  useStore.setState({
    clues, connections: [], deductions: {},
    contestedTokens: {}, contestedPrior: {}, attemptSeq: 0,
  } as never);
}
const clue = (id: string, s: ClueStatus): Clue => ({
  id, type: 'physical', title: id, description: '', sceneSource: 's',
  connectsTo: [], tags: [], status: s, isRevealed: true,
});

beforeEach(() => { vi.useRealTimers(); });

describe('evidenceSlice — store-owned contested revert (Blocker 2 / Major overlap)', () => {
  it('reverts contested clues to their PRIOR status after 2s', () => {
    vi.useFakeTimers();
    seed({ a: clue('a', 'examined'), b: clue('b', 'new') });
    useStore.getState().contestClues(['a', 'b']); // prior captured from CURRENT status
    expect(useStore.getState().clues.a.status).toBe('contested');
    vi.advanceTimersByTime(2000);
    expect(useStore.getState().clues.a.status).toBe('examined');
    expect(useStore.getState().clues.b.status).toBe('new'); // prior, not hardcoded examined
  });

  it('fail→success overlap: markCluesDeduced wins; the stale revert must NOT clobber it', () => {
    vi.useFakeTimers();
    seed({ c1: clue('c1', 'examined'), c2: clue('c2', 'examined'), c3: clue('c3', 'examined') });
    const st = useStore.getState();
    st.contestClues(['c1', 'c2']);        // attempt A fails → c1,c2 contested (gen 1)
    st.markCluesDeduced(['c1', 'c3']);    // attempt B succeeds → c1 deduced, its token invalidated
    vi.advanceTimersByTime(2000);         // A's timer fires
    expect(useStore.getState().clues.c1.status).toBe('deduced');  // B won; A did not clobber
    expect(useStore.getState().clues.c2.status).toBe('examined'); // A still owned c2 → reverted
  });

  it('fail→fail overlap on a shared clue: the clue ultimately returns to its ORIGINAL status', () => {
    vi.useFakeTimers();
    seed({ c1: clue('c1', 'examined'), c2: clue('c2', 'examined'), c4: clue('c4', 'examined') });
    const st = useStore.getState();
    st.contestClues(['c1', 'c2']);        // A: gen1, c1 prior 'examined'
    st.contestClues(['c1', 'c4']);        // B: gen2, RE-contests c1 → carries forward prior 'examined' (NOT 'contested')
    vi.advanceTimersByTime(2000);         // both timers fire
    expect(useStore.getState().clues.c1.status).toBe('examined'); // NOT stranded contested
    expect(useStore.getState().clues.c2.status).toBe('examined');
    expect(useStore.getState().clues.c4.status).toBe('examined');
  });

  it('cancelContestedReverts stops a pending timer and clears ownership', () => {
    vi.useFakeTimers();
    seed({ a: clue('a', 'examined') });
    const st = useStore.getState();
    st.contestClues(['a']);               // gen1 pending
    st.cancelContestedReverts();          // e.g. a case load
    expect(useStore.getState().contestedTokens).toEqual({});
    st.contestClues(['a']);               // a NEW attempt reuses gen numbering from reset
    vi.advanceTimersByTime(2000);
    // the cancelled gen1 timer must not have fired against the new attempt:
    expect(useStore.getState().clues.a.status).toBe('examined'); // only the new (owned) revert ran
  });
});
