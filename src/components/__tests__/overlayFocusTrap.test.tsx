/**
 * Focus-trap coverage for the CaseJournal and NPCGallery overlays (F-007, #8).
 * The EvidenceBoard's own trap is covered in EvidenceBoard.test.tsx.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';
import { CaseJournal } from '../CaseJournal';
import { NPCGallery } from '../NPCGallery';

function initStore(overrides: Record<string, any> = {}) {
  useStore.setState({
    investigator: {
      name: 'Test', archetype: 'deductionist', abilityUsed: false,
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10, vitality: 10,
    },
    clues: {}, deductions: {}, connections: [],
    currentScene: 's1', currentCase: 'test', sceneHistory: [], visitedScenes: [],
    npcs: {
      'npc-a': { id: 'npc-a', name: 'Inspector Vale', faction: null, disposition: 2, suspicion: 0, memoryFlags: {}, isAlive: true, isAccessible: true },
    },
    flags: {}, factionReputation: {},
    settings: { fontSize: 'standard', highContrast: false, reducedMotion: true, textSpeed: 'instant', hintsEnabled: false, autoSaveFrequency: 'scene', audioVolume: { ambient: 0.5, sfx: 0.5 } },
    caseData: null, lastCheckResult: null,
    ...overrides,
  });
}

beforeEach(() => initStore());

describe('CaseJournal — focus trap (F-007)', () => {
  it('moves focus inside the dialog on open', () => {
    render(<CaseJournal onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    let closed = false;
    render(<CaseJournal onClose={() => { closed = true; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('restores focus to the invoker on close', () => {
    render(<button type="button" data-testid="invoker">Open journal</button>);
    const invoker = screen.getByTestId('invoker');
    invoker.focus();
    const { unmount } = render(<CaseJournal onClose={() => {}} />);
    expect(document.activeElement).not.toBe(invoker);
    unmount();
    expect(document.activeElement).toBe(invoker);
  });
});

describe('NPCGallery — focus trap (F-007)', () => {
  it('moves focus inside the dialog on open', () => {
    render(<NPCGallery onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    let closed = false;
    render(<NPCGallery onClose={() => { closed = true; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('restores focus to the invoker on close', () => {
    render(<button type="button" data-testid="invoker">Open gallery</button>);
    const invoker = screen.getByTestId('invoker');
    invoker.focus();
    const { unmount } = render(<NPCGallery onClose={() => {}} />);
    expect(document.activeElement).not.toBe(invoker);
    unmount();
    expect(document.activeElement).toBe(invoker);
  });
});
