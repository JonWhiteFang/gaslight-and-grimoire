/**
 * GameContent — the breakdown/incapacitation scenes must render the
 * "Investigation halted" failure screen, NOT the "Case Complete" terminal
 * (F-011, issue #9).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';
import { GameContent } from '../../App';
import type { SceneNode } from '../../types';

// NarrativePanel / StatusBar pull from many slices and the hint engine; the
// halt path renders neither, but the ordinary path does — stub the heavy leaves.
vi.mock('../../components/NarrativePanel', () => ({
  NarrativePanel: () => <div data-testid="narrative-panel" />,
  SceneText: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('../../components/StatusBar', () => ({ StatusBar: () => <div data-testid="status-bar" /> }));
vi.mock('../../components/ChoicePanel', () => ({ ChoicePanel: () => <div data-testid="choice-panel" /> }));

const breakdown: SceneNode = { id: 'breakdown', act: 0, narrative: 'It crashes down.', cluesAvailable: [], choices: [] };
const incapacitation: SceneNode = { id: 'incapacitation', act: 0, narrative: 'Body fails.', cluesAvailable: [], choices: [] };
const finale: SceneNode = { id: 'finale', act: 3, narrative: 'The end.', cluesAvailable: [], choices: [] };

function initStore(currentScene: string, scenes: Record<string, SceneNode>) {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 0, vitality: 10,
    },
    clues: {}, deductions: {}, connections: [],
    currentScene, currentCase: 'the-whitechapel-cipher', sceneHistory: [], visitedScenes: [],
    npcs: {}, flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: true, textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: { meta: { id: 'the-whitechapel-cipher', title: 'The Whitechapel Cipher', synopsis: '', acts: 3, facultyDistribution: {} }, scenes, clues: {}, npcs: {}, variants: [] },
    lastCheckResult: null,
  });
}

const props = { onCompleteCase: vi.fn(), onHalt: vi.fn(), reviewSceneId: null, onDismissReview: vi.fn() };

beforeEach(() => vi.clearAllMocks());

describe('GameContent — halt scenes (F-011)', () => {
  it('renders "Investigation halted" and not "Case Complete" on the breakdown scene', () => {
    initStore('breakdown', { breakdown });
    render(<GameContent {...props} />);
    expect(screen.getByText(/investigation halted/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /case complete/i })).toBeNull();
  });

  it('shows composure copy on breakdown', () => {
    initStore('breakdown', { breakdown });
    render(<GameContent {...props} />);
    expect(screen.getByText(/composure/i)).toBeTruthy();
  });

  it('shows vitality copy on incapacitation', () => {
    initStore('incapacitation', { incapacitation });
    render(<GameContent {...props} />);
    expect(screen.getByText(/your strength has failed you/i)).toBeTruthy();
  });

  it('calls onHalt (not onCompleteCase) from the return button', () => {
    initStore('breakdown', { breakdown });
    render(<GameContent {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /case list|return/i }));
    expect(props.onHalt).toHaveBeenCalledTimes(1);
    expect(props.onCompleteCase).not.toHaveBeenCalled();
  });

  it('still shows "Case Complete" on an ordinary choiceless terminal scene', () => {
    initStore('finale', { finale });
    render(<GameContent {...props} />);
    expect(screen.getByRole('button', { name: /case complete/i })).toBeTruthy();
    expect(screen.queryByText(/investigation halted/i)).toBeNull();
  });
});
