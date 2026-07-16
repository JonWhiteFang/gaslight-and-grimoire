/**
 * NarrativePanel — the DC on lastCheckResult must reach the DiceRollOverlay.
 * Stays RED if the <DiceRollOverlay dc={...}> render-call wiring is skipped.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NarrativePanel } from '../NarrativePanel/NarrativePanel';
import { useStore } from '../../store';
import type { SceneNode } from '../../types';

const scene: SceneNode = {
  id: 'scene-1',
  act: 1,
  narrative: 'A gaslit street.',
  cluesAvailable: [],
  choices: [],
};

beforeEach(() => {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 0, vitality: 10,
    },
    clues: {}, deductions: {}, connections: [],
    currentScene: 'scene-1', currentCase: 'the-whitechapel-cipher', sceneHistory: [], visitedScenes: [],
    npcs: {}, flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: true, textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: { meta: { id: 'the-whitechapel-cipher', title: 'The Whitechapel Cipher', synopsis: '', acts: 3, facultyDistribution: {} }, scenes: { 'scene-1': scene }, clues: {}, npcs: {}, variants: [] },
    lastCheckResult: { roll: 17, modifier: 2, total: 19, tier: 'success', dc: 14 },
  });
});

describe('NarrativePanel — DC reaches the dice overlay', () => {
  it('renders "vs DC 14" from lastCheckResult.dc', () => {
    render(<NarrativePanel />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
  });
});
