/**
 * ChoicePanel — Phase 3 T6: autoSucceeds plumbing + DC into lastCheckResult.
 *
 * Uses the REAL store (no vi.mock) so we exercise the true parent→prop→ChoiceCard
 * path and the true handleSelect → setCheckResult({ dc }) write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoicePanel } from '../ChoicePanel/ChoicePanel';
import { useStore } from '../../store';
import type { Choice } from '../../types';

const reasonCheck: Choice = {
  id: 'c1',
  text: 'Deduce',
  faculty: 'reason',
  difficulty: 14,
  outcomes: { critical: 's', success: 's', partial: 'p', failure: 'f', fumble: 'f' },
} as Choice;

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
  });
}

describe('ChoicePanel — autoSucceeds plumbing + dc', () => {
  beforeEach(() => {
    initStore();
  });

  it('renders Assured for a reason check when the auto-succeed flag is active', () => {
    useStore.setState({ flags: { 'ability-auto-succeed-reason': true } });
    render(<ChoicePanel choices={[reasonCheck]} />);
    expect(screen.getByText(/Assured/i)).toBeInTheDocument();
  });

  it('renders the Prospects band when no auto-succeed flag is set', () => {
    useStore.setState({ flags: {} });
    render(<ChoicePanel choices={[reasonCheck]} />);
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
  });

  it('writes the DC into lastCheckResult when a check choice is selected', () => {
    useStore.setState({ flags: {}, lastCheckResult: null });
    render(<ChoicePanel choices={[reasonCheck]} />);
    fireEvent.click(screen.getByRole('button', { name: /Deduce/ }));
    expect(useStore.getState().lastCheckResult?.dc).toBe(14); // resolveDC(reasonCheck) === 14
  });
});
