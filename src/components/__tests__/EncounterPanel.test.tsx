/**
 * EncounterPanel component tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../../store';
import type { EncounterRound } from '../../types';

// Mock engine functions
const mockStartEncounter = vi.fn();
const mockGetEncounterChoices = vi.fn();
vi.mock('../../engine/narrativeEngine', () => ({
  startEncounter: (...args: unknown[]) => mockStartEncounter(...args),
  processEncounterChoice: vi.fn(),
  getEncounterChoices: (...args: unknown[]) => mockGetEncounterChoices(...args),
}));

vi.mock('../../engine/diceEngine', () => ({
  performCheck: vi.fn(() => ({ roll: 10, modifier: 0, total: 10, tier: 'success' })),
  rollD20: () => 10,
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
  resolveDC: () => 12,
}));

import { EncounterPanel } from '../EncounterPanel';

const baseRound: EncounterRound = {
  roundNumber: 1,
  isSupernatural: false,
  choices: [
    {
      id: 'enc-c1', text: 'Fight', faculty: 'vigor', difficulty: 10,
      outcomes: { critical: 's1', success: 's1', partial: 's1', failure: 's1', fumble: 's1' },
    },
  ],
};

function initStore() {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, connections: [],
    currentScene: 's1', currentCase: 'test', sceneHistory: [],
    npcs: {}, flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: null, lastCheckResult: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  initStore();
  mockStartEncounter.mockReturnValue({
    id: 'enc-1', rounds: [baseRound], currentRound: 0, isComplete: false, reactionCheckPassed: null,
  });
  mockGetEncounterChoices.mockReturnValue([
    { ...baseRound.choices[0], _hasAdvantage: false },
  ]);
});

describe('EncounterPanel', () => {
  it('renders encounter narrative', () => {
    render(<EncounterPanel sceneId="s1" rounds={[baseRound]} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText(/Round.*of.*1/i)).toBeTruthy();
  });

  it('renders encounter choices', () => {
    render(<EncounterPanel sceneId="s1" rounds={[baseRound]} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText('Fight')).toBeTruthy();
  });

  it('shows reaction check message for supernatural encounters', () => {
    mockStartEncounter.mockReturnValue({
      id: 'enc-1', rounds: [{ ...baseRound, isSupernatural: true }], currentRound: 0, isComplete: false, reactionCheckPassed: false,
    });
    render(<EncounterPanel sceneId="s1" rounds={[{ ...baseRound, isSupernatural: true }]} isSupernatural={true} onComplete={() => {}} />);
    expect(screen.getByText(/overwhelms you/i)).toBeTruthy();
  });
});
