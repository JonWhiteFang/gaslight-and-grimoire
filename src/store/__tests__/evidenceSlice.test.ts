/**
 * Unit tests for evidenceSlice.discoverClue.
 *
 * Re-discovering a clue in a later scene must NOT reset an already-progressed
 * clue's status (connected/deduced) back to 'new'. A clue only initialises to
 * 'new' on its first discovery.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../index';
import type { Clue } from '../../types';

function makeClue(overrides: Partial<Clue> = {}): Clue {
  return {
    id: 'clue-x',
    type: 'physical',
    title: 'Token',
    description: 'A brass token.',
    sceneSource: 'scene-1',
    tags: [],
    status: 'new',
    isRevealed: false,
    ...overrides,
  };
}

describe('evidenceSlice.discoverClue', () => {
  beforeEach(() => {
    useStore.setState({ clues: {} });
  });

  it('reveals a clue and sets status to "new" on first discovery', () => {
    useStore.setState({ clues: { 'clue-x': makeClue({ isRevealed: false, status: 'new' }) } });
    useStore.getState().discoverClue('clue-x');
    const clue = useStore.getState().clues['clue-x'];
    expect(clue.isRevealed).toBe(true);
    expect(clue.status).toBe('new');
  });

  it('does not reset a connected clue back to "new" on re-discovery', () => {
    useStore.setState({ clues: { 'clue-x': makeClue({ isRevealed: true, status: 'connected' }) } });
    useStore.getState().discoverClue('clue-x');
    expect(useStore.getState().clues['clue-x'].status).toBe('connected');
  });

  it('does not reset a deduced clue back to "new" on re-discovery', () => {
    useStore.setState({ clues: { 'clue-x': makeClue({ isRevealed: true, status: 'deduced' }) } });
    useStore.getState().discoverClue('clue-x');
    expect(useStore.getState().clues['clue-x'].status).toBe('deduced');
  });
});
