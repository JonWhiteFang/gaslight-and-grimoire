/**
 * EncounterPanel — Phase 3 T6: round-choice odds tag (transitive via ChoiceCard)
 * fed by a REACTIVE flags source, so an active auto-succeed ability reads "Assured".
 *
 * Uses the REAL store + REAL engine (no vi.mock) so the ChoiceCard actually renders
 * its pre-roll odds tag. Rounds are non-supernatural to avoid the reaction roll.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EncounterPanel } from '../EncounterPanel/EncounterPanel';
import { useStore } from '../../store';
import type { EncounterRound } from '../../types';

const rounds: EncounterRound[] = [
  {
    roundNumber: 1,
    isSupernatural: false,
    choices: [
      {
        id: 'e1',
        text: 'Reason it out',
        faculty: 'reason',
        difficulty: 14,
        outcomes: { critical: 'w', success: 'w', partial: 'w', failure: 'l', fumble: 'l' },
      },
    ],
  } as unknown as EncounterRound,
];

function initStore() {
  useStore.setState({
    investigator: {
      name: 'Test',
      archetype: 'deductionist',
      abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10,
      vitality: 10,
    },
    clues: {},
    deductions: {},
    connections: [],
    currentScene: 's1',
    currentCase: 'test',
    sceneHistory: [],
    npcs: {},
    flags: {},
    factionReputation: {},
    settings: {
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      textSpeed: 'typewriter',
      hintsEnabled: true,
      autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
    caseData: null,
    lastCheckResult: null,
    encounterState: null,
  });
}

describe('EncounterPanel — round-choice odds', () => {
  beforeEach(() => {
    initStore();
  });

  it('shows the Prospects tag on a round choice (transitive via ChoiceCard)', () => {
    render(<EncounterPanel sceneId="enc1" rounds={rounds} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
  });

  it('shows Assured when the auto-succeed flag is active for that faculty', () => {
    useStore.setState({ flags: { 'ability-auto-succeed-reason': true } });
    render(<EncounterPanel sceneId="enc2" rounds={rounds} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
  });

  it('writes the DC into lastCheckResult when a round choice is selected', () => {
    useStore.setState({ flags: {}, lastCheckResult: null });
    render(<EncounterPanel sceneId="enc3" rounds={rounds} isSupernatural={false} onComplete={() => {}} />);
    // Selecting the round choice resolves the check and may complete the
    // encounter (single round → onComplete); assert the store dc write here.
    fireEvent.click(screen.getByRole('button', { name: /Reason it out/ }));
    expect(useStore.getState().lastCheckResult?.dc).toBe(14); // resolveDC(e1) === 14
  });

  it('reacts to the auto-succeed flag flipping on AFTER mount', () => {
    // Mount FIRST with no flags: the pre-roll odds must show the Prospects band
    // (DC 14), NOT "Assured". A non-reactive snapshot would freeze this state.
    useStore.setState({ flags: {} });
    render(<EncounterPanel sceneId="enc4" rounds={rounds} isSupernatural={false} onComplete={() => {}} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    expect(screen.queryByText(/Assured/i)).not.toBeInTheDocument();

    // Flip the flag while the panel stays mounted. Because EncounterPanel reads
    // flags via the reactive `useStore((s) => s.flags)` selector (not the
    // non-reactive buildGameState snapshot), the ChoiceCard must re-render and
    // now read "Assured". This test would FAIL against a snapshot flags source.
    act(() => {
      useStore.setState({ flags: { 'ability-auto-succeed-reason': true } });
    });
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
    expect(screen.queryByText(/DC 14/)).not.toBeInTheDocument();
  });
});
