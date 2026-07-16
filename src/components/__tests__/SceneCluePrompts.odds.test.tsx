import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SceneCluePrompts } from '../NarrativePanel/SceneCluePrompts';
import type { Clue, ClueDiscovery, GameState, Investigator } from '../../types';

function inv(): Investigator {
  return {
    name: 'T', archetype: 'deductionist',
    faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

const clue: Clue = { id: 'k1', title: 'Torn ledger', type: 'physical', description: '', sceneSource: 's1', tags: [], isRevealed: false, status: 'new' };
const disc: ClueDiscovery = { clueId: 'k1', method: 'check', requiresFaculty: { faculty: 'perception', minimum: 10 } };
const explore: ClueDiscovery = { clueId: 'k2', method: 'exploration' };
const exploreClue: Clue = { id: 'k2', title: 'Open drawer', type: 'physical', description: '', sceneSource: 's1', tags: [], isRevealed: false, status: 'new' };
const gs = { clues: {}, flags: {}, deductions: {}, investigator: inv() } as unknown as GameState;

describe('SceneCluePrompts — pre-roll odds', () => {
  it('surfaces the DC visibly and the band on a check prompt', () => {
    render(
      <SceneCluePrompts sceneId="s1" cluesAvailable={[disc]} clues={{ k1: clue }} gameState={gs}
        investigator={inv()} onClueDiscovered={() => {}} onCheckResult={() => {}} discoverClue={() => {}} />,
    );
    expect(screen.getByText(/DC 10/)).toBeInTheDocument();
    // partialCountsAsSuccess=true: perception mod 0, dc 10 → clue-discovery 70% → Favourable
    expect(screen.getByText(/Prospects:\s*Favourable/i)).toBeInTheDocument();
  });

  it('folds the odds phrase into the check button accessible name', () => {
    render(
      <SceneCluePrompts sceneId="s1" cluesAvailable={[disc]} clues={{ k1: clue }} gameState={gs}
        investigator={inv()} onClueDiscovered={() => {}} onCheckResult={() => {}} discoverClue={() => {}} />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAccessibleName(/Perception check/i);
    expect(btn).toHaveAccessibleName(/difficulty 10/i);
    expect(btn).toHaveAccessibleName(/prospects favourable/i);
  });

  it('leaves an exploration (non-check) prompt unchanged — no DC / Prospects', () => {
    render(
      <SceneCluePrompts sceneId="s1" cluesAvailable={[explore]} clues={{ k2: exploreClue }} gameState={gs}
        investigator={inv()} onClueDiscovered={() => {}} onCheckResult={() => {}} discoverClue={() => {}} />,
    );
    expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prospects/i)).not.toBeInTheDocument();
  });
});
