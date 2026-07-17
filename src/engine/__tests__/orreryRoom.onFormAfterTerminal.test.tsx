/**
 * THE spec-Major-5 witness: a keystone deduction formed AFTER the player has
 * already entered a terminal ending scene must still record the persistent
 * `mythos-pattern-named` flag. Scene-entry effects can't do this (variant
 * onEnter only fires inside goToScene; the board stays live on terminal
 * scenes) — `KeyDeduction.onForm` at formation time can, and this test drives
 * that path through the REAL EvidenceBoard with the REAL shipped recipes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';
import type { Clue, KeyDeduction } from '../../types';
import cluesFile from '../../../public/content/side-cases/the-orrery-room/clues.json';
import deductionsFile from '../../../public/content/side-cases/the-orrery-room/deductions.json';

vi.mock('../../engine/hintEngine', () => ({
  trackActivity: vi.fn(),
}));

vi.mock('../../engine/diceEngine', () => ({
  performCheck: vi.fn(() => ({ roll: 10, modifier: 0, total: 10, dc: 14, tier: 'success' })),
  calculateModifier: () => 0,
  getTrainedBonus: () => 0,
  isFacultyCheck: (c: { faculty?: unknown; difficulty?: unknown; dynamicDifficulty?: unknown }) =>
    c.faculty != null && (c.difficulty !== undefined || c.dynamicDifficulty != null),
}));

vi.mock('../../announcer', () => ({
  announce: vi.fn(),
}));

import { EvidenceBoard } from '../../components/EvidenceBoard';

const recipes = (deductionsFile as { deductions: KeyDeduction[] }).deductions;
const clueList = (cluesFile as { clues: Clue[] }).clues;

const KEYSTONE_CLUES = [
  'or-clue-orrery-period',
  'or-clue-adjustment-diary',
  'or-clue-night-observation',
] as const;

function revealedKeystoneClues(): Record<string, Clue> {
  const byId = Object.fromEntries(clueList.map((c) => [c.id, c]));
  return Object.fromEntries(
    KEYSTONE_CLUES.map((id) => [id, { ...byId[id], isRevealed: true, status: 'examined' } as Clue]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('keystone formed AFTER entering a terminal ending (spec Major 5)', () => {
  it('onForm records mythos-pattern-named while currentScene is a terminal ending', () => {
    useStore.setState({
      investigator: {
        name: 'Test', archetype: 'deductionist', abilityUsed: false,
        faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
        composure: 10, vitality: 10,
      },
      clues: revealedKeystoneClues(),
      deductions: {},
      connections: [
        { fromId: 'or-clue-orrery-period', toId: 'or-clue-adjustment-diary' },
        { fromId: 'or-clue-adjustment-diary', toId: 'or-clue-night-observation' },
      ],
      contestedTokens: {}, contestedPrior: {}, attemptSeq: 0,
      // The load-bearing setup: the player is ALREADY on a terminal ending scene.
      currentScene: 'or-act2-ending-destroyed', currentCase: 'the-orrery-room',
      sceneHistory: [],
      npcs: {}, flags: {}, factionReputation: {},
      settings: {
        fontSize: 'standard', highContrast: false, reducedMotion: false,
        textSpeed: 'typewriter', hintsEnabled: true, autoSaveFrequency: 'scene',
        audioVolume: { ambient: 0.5, sfx: 0.5 },
      },
      caseData: { recipes } as never,
      lastCheckResult: null,
    } as never);

    render(<EvidenceBoard onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Attempt Deduction/i }));

    const st = useStore.getState();
    // The deduction formed AND the persistent flag was recorded — no goToScene needed.
    expect(st.deductions['mythos-pattern-named']).toBeDefined();
    expect(st.flags['mythos-pattern-named']).toBe(true);
    // Still on the terminal scene: formation happened without any navigation.
    expect(st.currentScene).toBe('or-act2-ending-destroyed');
  });
});
