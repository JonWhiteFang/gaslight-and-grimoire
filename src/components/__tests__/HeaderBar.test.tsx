/**
 * HeaderBar tests — focus on the case-title display (F-010, issue #10).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../../store';
import { HeaderBar } from '../HeaderBar';

function initStore(overrides: Record<string, any> = {}) {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, connections: [],
    currentScene: 's1', currentCase: 'the-whitechapel-cipher', sceneHistory: [],
    visitedScenes: [], npcs: {}, flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: false, textSpeed: 'typewriter', hintsEnabled: false, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: null, lastCheckResult: null,
    ...overrides,
  });
}

const noop = () => {};
const props = {
  onOpenEvidenceBoard: noop, onOpenJournal: noop, onOpenNPCGallery: noop,
  onActivateAbility: noop, onOpenSettings: noop, onSaveGame: noop,
};

beforeEach(() => initStore());

describe('HeaderBar — case title (F-010)', () => {
  it('renders the readable case title from caseData.meta.title', () => {
    initStore({
      caseData: { meta: { id: 'the-whitechapel-cipher', title: 'The Whitechapel Cipher' }, scenes: {}, clues: {}, npcs: {}, variants: [] },
    });
    render(<HeaderBar {...props} />);
    expect(screen.getByRole('heading', { name: 'The Whitechapel Cipher' })).toBeTruthy();
  });

  it('does not render the raw case-id slug', () => {
    initStore({
      caseData: { meta: { id: 'the-whitechapel-cipher', title: 'The Whitechapel Cipher' }, scenes: {}, clues: {}, npcs: {}, variants: [] },
    });
    render(<HeaderBar {...props} />);
    expect(screen.queryByText('the-whitechapel-cipher')).toBeNull();
  });

  it('falls back to a de-slugified id when caseData is not loaded', () => {
    initStore({ caseData: null, currentCase: 'the-lamplighters-wake' });
    render(<HeaderBar {...props} />);
    expect(screen.getByRole('heading', { name: 'The Lamplighters Wake' })).toBeTruthy();
  });

  it('shows the game name when no case is active', () => {
    initStore({ caseData: null, currentCase: '' });
    render(<HeaderBar {...props} />);
    expect(screen.getByRole('heading', { name: 'Gaslight & Grimoire' })).toBeTruthy();
  });
});
