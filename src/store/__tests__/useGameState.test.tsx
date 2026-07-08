/**
 * Tests for the `useGameState` reactive snapshot hook (F-042).
 *
 * `snapshotGameState` returns a fresh object every call. Used as a bare Zustand
 * selector it would re-render on *every* store mutation — a de-facto full-store
 * subscription that re-rendered GameContent/NarrativePanel/HeaderBar/ChoicePanel
 * on any composure tick or flag set. `useGameState` wraps it with `useShallow`
 * so a component only re-renders when a field it actually reads changes.
 *
 * These tests pin that behaviour: the hook returns a shallow-stable object and
 * only produces a new render when a top-level snapshot field changes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore, useGameState } from '../index';

describe('useGameState (F-042 selector stability)', () => {
  beforeEach(() => {
    // Reset the fields these tests touch to a known baseline.
    useStore.setState({ flags: {}, clues: {}, factionReputation: {} });
  });

  it('does not re-render when no subscribed field changes', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useGameState();
    });

    const initialRenders = renders;
    const first = result.current;

    // Set a flag to the same value it already holds → the `flags` reference
    // does change (Immer produces a new object), so this is a genuine change
    // and IS expected to re-render. To prove *stability*, instead trigger a
    // store notification that does not alter any snapshot field: setState with
    // an identical flags object reference.
    act(() => {
      useStore.setState((s) => ({ flags: s.flags }));
    });

    // Same field references in, same references out → useShallow bails, no
    // re-render, and the returned object identity is preserved.
    expect(renders).toBe(initialRenders);
    expect(result.current).toBe(first);
  });

  it('re-renders when a subscribed field changes', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useGameState();
    });

    const before = renders;
    act(() => {
      useStore.getState().setFlag('test-flag', true);
    });

    expect(renders).toBeGreaterThan(before);
    expect(result.current.flags['test-flag']).toBe(true);
  });
});
