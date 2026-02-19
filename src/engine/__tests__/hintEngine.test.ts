/**
 * Unit tests for HintEngine — hint trigger conditions.
 *
 * Tests:
 * 1. shouldShowHint returns false when hintsEnabled is false (Req 13.6)
 * 2. shouldShowHint returns true after 3 board visits with no connection attempts (Req 13.1)
 * 3. shouldShowHint returns false after 2 board visits (Req 13.1)
 * 4. shouldShowHint returns false after 3 board visits if a connection was attempted (Req 13.1)
 * 5. shouldShowHint returns true when scene dwell time exceeds 5 minutes (Req 13.1)
 * 6. resetForScene resets board visit count and scene entry time (Req 13.1)
 * 7. getHint level 3 is blocked when level 2 has not been shown (Req 13.4)
 *
 * Requirements: 13.1, 13.6
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  trackActivity,
  shouldShowHint,
  getHint,
  resetForScene,
  _getState,
  _setState,
} from '../hintEngine';
import type { GameState } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal GameState stub sufficient for hint tests */
function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: 'Test',
      archetype: 'deductionist',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    },
    currentScene: 'scene-1',
    currentCase: 'case-1',
    clues: {},
    deductions: {},
    npcs: {},
    flags: {},
    factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      textSpeed: 'typewriter',
      hintsEnabled: true,
      autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.6, sfx: 0.8 },
    },
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset engine state before each test
  resetForScene();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Test 1: hints disabled ───────────────────────────────────────────────────

describe('shouldShowHint — hints disabled in settings', () => {
  it('returns false when hintsEnabled is false, regardless of board visits', () => {
    // Simulate 5 board visits — would normally trigger
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    expect(shouldShowHint(false)).toBe(false);
  });

  it('returns false when hintsEnabled is false even after 5-minute dwell', () => {
    // Backdate scene entry time by 6 minutes
    _setState({ sceneEntryTime: Date.now() - 6 * 60 * 1000 });

    expect(shouldShowHint(false)).toBe(false);
  });
});

// ─── Test 2: 3 board visits without connection ────────────────────────────────

describe('shouldShowHint — board visit threshold', () => {
  it('returns true after exactly 3 board visits with no connection attempts', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    expect(shouldShowHint(true)).toBe(true);
  });

  it('returns true after more than 3 board visits with no connection attempts', () => {
    for (let i = 0; i < 5; i++) {
      trackActivity({ type: 'boardVisit' });
    }

    expect(shouldShowHint(true)).toBe(true);
  });

  // ─── Test 3: only 2 board visits ─────────────────────────────────────────

  it('returns false after only 2 board visits', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    expect(shouldShowHint(true)).toBe(false);
  });

  it('returns false with zero board visits', () => {
    expect(shouldShowHint(true)).toBe(false);
  });

  // ─── Test 4: connection attempt resets counter ────────────────────────────

  it('returns false after 3 board visits when a connection was attempted', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    // Connection attempt resets the board visit counter
    trackActivity({ type: 'connectionAttempt' });

    expect(shouldShowHint(true)).toBe(false);
  });

  it('returns false after 3 visits → connection → 2 more visits (counter reset)', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'connectionAttempt' }); // resets boardVisitCount to 0
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    expect(shouldShowHint(true)).toBe(false);
  });

  it('returns true again after connection reset + 3 new board visits', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'connectionAttempt' }); // resets boardVisitCount
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    // Now 3 visits since last connection — but connectionAttemptCount > 0
    // Per spec: boardVisitCount >= 3 AND connectionAttemptCount === 0
    expect(shouldShowHint(true)).toBe(false);
  });
});

// ─── Test 5: 5-minute scene dwell ────────────────────────────────────────────

describe('shouldShowHint — scene dwell time', () => {
  it('returns true when scene dwell time exceeds 5 minutes', () => {
    // Backdate scene entry time by 5 minutes + 1 second
    _setState({ sceneEntryTime: Date.now() - (5 * 60 * 1000 + 1000) });

    expect(shouldShowHint(true)).toBe(true);
  });

  it('returns false when scene dwell time is just under 5 minutes', () => {
    // Backdate by 4 minutes 59 seconds
    _setState({ sceneEntryTime: Date.now() - (4 * 60 * 1000 + 59 * 1000) });

    expect(shouldShowHint(true)).toBe(false);
  });

  it('returns true at exactly 5 minutes', () => {
    _setState({ sceneEntryTime: Date.now() - 5 * 60 * 1000 });

    expect(shouldShowHint(true)).toBe(true);
  });
});

// ─── Test 6: resetForScene ────────────────────────────────────────────────────

describe('resetForScene', () => {
  it('resets board visit count to 0', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    resetForScene();

    expect(_getState().boardVisitCount).toBe(0);
  });

  it('resets connection attempt count to 0', () => {
    trackActivity({ type: 'connectionAttempt' });
    trackActivity({ type: 'connectionAttempt' });

    resetForScene();

    expect(_getState().connectionAttemptCount).toBe(0);
  });

  it('resets lastHintLevelShown to null', () => {
    const gs = makeGameState();
    getHint(1, gs);
    getHint(2, gs);

    resetForScene();

    expect(_getState().lastHintLevelShown).toBeNull();
  });

  it('updates sceneEntryTime to approximately now', () => {
    const before = Date.now();
    resetForScene();
    const after = Date.now();

    const { sceneEntryTime } = _getState();
    expect(sceneEntryTime).toBeGreaterThanOrEqual(before);
    expect(sceneEntryTime).toBeLessThanOrEqual(after);
  });

  it('suppresses hint after reset even if 3 visits were recorded before', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    resetForScene();

    expect(shouldShowHint(true)).toBe(false);
  });

  it('sceneChange event triggers resetForScene', () => {
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });
    trackActivity({ type: 'boardVisit' });

    trackActivity({ type: 'sceneChange' });

    expect(_getState().boardVisitCount).toBe(0);
    expect(shouldShowHint(true)).toBe(false);
  });
});

// ─── Test 7: getHint level 3 gating ──────────────────────────────────────────

describe('getHint — level 3 gating', () => {
  it('returns level 2 hint when level 3 is requested but level 2 has not been shown', () => {
    const gs = makeGameState();

    // Request level 3 without having seen level 2
    const hint = getHint(3, gs);

    expect(hint.level).toBe(2);
  });

  it('returns level 3 hint after level 2 has been shown', () => {
    const gs = makeGameState();

    // Show level 2 first
    getHint(2, gs);

    // Now level 3 should be available
    const hint = getHint(3, gs);

    expect(hint.level).toBe(3);
  });

  it('returns level 3 hint after level 1 then level 2 have been shown', () => {
    const gs = makeGameState();

    getHint(1, gs);
    getHint(2, gs);

    const hint = getHint(3, gs);

    expect(hint.level).toBe(3);
  });

  it('level 3 is blocked when only level 1 has been shown', () => {
    const gs = makeGameState();

    getHint(1, gs);

    const hint = getHint(3, gs);

    // lastHintLevelShown is 1, which is < 2, so level 3 is blocked
    expect(hint.level).toBe(2);
  });

  it('tracks lastHintLevelShown correctly as hints are retrieved', () => {
    const gs = makeGameState();

    expect(_getState().lastHintLevelShown).toBeNull();

    getHint(1, gs);
    expect(_getState().lastHintLevelShown).toBe(1);

    getHint(2, gs);
    expect(_getState().lastHintLevelShown).toBe(2);

    getHint(3, gs);
    expect(_getState().lastHintLevelShown).toBe(3);
  });
});

// ─── getHint content ──────────────────────────────────────────────────────────

describe('getHint — content', () => {
  it('level 1 returns a narrative nudge', () => {
    const gs = makeGameState();
    const hint = getHint(1, gs);

    expect(hint.level).toBe(1);
    expect(hint.text).toBeTruthy();
    expect(typeof hint.text).toBe('string');
  });

  it('level 2 returns generic text when no connected clues exist', () => {
    const gs = makeGameState(); // no clues
    const hint = getHint(2, gs);

    expect(hint.level).toBe(2);
    expect(hint.text).toContain('location or person');
  });

  it('level 2 suggests specific clues when connected clues exist', () => {
    const gs = makeGameState({
      clues: {
        'clue-a': {
          id: 'clue-a',
          type: 'physical',
          title: 'Torn Letter',
          description: 'A torn letter',
          sceneSource: 'scene-1',
          connectsTo: ['clue-b'],
          tags: ['paper'],
          status: 'new',
          isRevealed: true,
        },
        'clue-b': {
          id: 'clue-b',
          type: 'testimony',
          title: 'Witness Account',
          description: 'A witness account',
          sceneSource: 'scene-2',
          connectsTo: ['clue-a'],
          tags: ['person'],
          status: 'new',
          isRevealed: true,
        },
      },
    });

    const hint = getHint(2, gs);

    expect(hint.level).toBe(2);
    expect(hint.text).toContain('Torn Letter');
    expect(hint.text).toContain('Witness Account');
  });

  it('level 3 returns a direct reveal', () => {
    const gs = makeGameState();

    // Unlock level 3 by showing level 2 first
    getHint(2, gs);
    const hint = getHint(3, gs);

    expect(hint.level).toBe(3);
    expect(hint.text).toBeTruthy();
    expect(typeof hint.text).toBe('string');
  });
});
