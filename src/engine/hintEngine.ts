/**
 * HintEngine — stateful singleton that tracks player activity and determines
 * when to surface contextual hints.
 *
 * Implements Requirements 13.1–13.6.
 */

import type { GameState } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HintEvent =
  | { type: 'boardVisit' }        // player opened Evidence Board
  | { type: 'connectionAttempt' } // player attempted a connection
  | { type: 'sceneChange' };      // player moved to a new scene

export type HintLevel = 1 | 2 | 3;

export interface HintContent {
  level: HintLevel;
  text: string;
}

export interface HintEngineState {
  boardVisitCount: number;
  connectionAttemptCount: number;
  sceneEntryTime: number;       // Date.now() when scene was entered
  lastHintLevelShown: HintLevel | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOARD_VISIT_THRESHOLD = 3;
const SCENE_DWELL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Internal State ───────────────────────────────────────────────────────────

let state: HintEngineState = {
  boardVisitCount: 0,
  connectionAttemptCount: 0,
  sceneEntryTime: Date.now(),
  lastHintLevelShown: null,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a player activity event.
 * - boardVisit: increments visit counter
 * - connectionAttempt: increments attempt counter and resets board visit counter
 * - sceneChange: resets all tracking for the new scene
 */
export function trackActivity(event: HintEvent): void {
  switch (event.type) {
    case 'boardVisit':
      state.boardVisitCount += 1;
      break;
    case 'connectionAttempt':
      state.connectionAttemptCount += 1;
      state.boardVisitCount = 0; // connection resets the board visit counter
      break;
    case 'sceneChange':
      resetForScene();
      break;
  }
}

/**
 * Returns true when a hint should be shown to the player.
 * Always returns false when hints are disabled in settings (Req 13.6).
 *
 * Trigger conditions (Req 13.1):
 * - 3+ board visits with no connection attempts, OR
 * - 5+ minutes elapsed on the current scene
 */
export function shouldShowHint(hintsEnabled: boolean): boolean {
  if (!hintsEnabled) return false;

  const boardTrigger =
    state.boardVisitCount >= BOARD_VISIT_THRESHOLD &&
    state.connectionAttemptCount === 0;

  const dwellTrigger = Date.now() - state.sceneEntryTime >= SCENE_DWELL_MS;

  return boardTrigger || dwellTrigger;
}

/**
 * Returns hint content for the requested level.
 * Tracks the highest level shown so Level 3 is gated behind Level 2 (Req 13.4).
 */
export function getHint(level: HintLevel, gameState: GameState): HintContent {
  // Level 3 is only available after Level 2 has been shown (Req 13.4)
  if (level === 3 && (state.lastHintLevelShown === null || state.lastHintLevelShown < 2)) {
    return {
      level: 2,
      text: 'Look for connections between clues that share a location or person.',
    };
  }

  let text: string;

  switch (level) {
    case 1:
      // Narrative nudge (Req 13.2)
      text = 'Consider revisiting the scene where you found your most recent clue.';
      break;

    case 2: {
      // Specific clue connection suggestion (Req 13.3)
      const connectedClues = Object.values(gameState.clues).filter(
        (c) => c.connectsTo && c.connectsTo.length > 0 && c.isRevealed,
      );

      if (connectedClues.length >= 2) {
        const [a, b] = connectedClues;
        text = `Consider connecting "${a.title}" with "${b.title}" — they may share a common thread.`;
      } else {
        text = 'Look for connections between clues that share a location or person.';
      }
      break;
    }

    case 3:
      // Direct reveal (Req 13.4)
      text =
        'The key connection is between your most recently discovered clue and the one before it.';
      break;
  }

  // Track the highest level shown
  if (state.lastHintLevelShown === null || level > state.lastHintLevelShown) {
    state.lastHintLevelShown = level;
  }

  return { level, text };
}

/**
 * Reset all tracking state when the player moves to a new scene (Req 13.1).
 */
export function resetForScene(): void {
  state.boardVisitCount = 0;
  state.connectionAttemptCount = 0;
  state.sceneEntryTime = Date.now();
  state.lastHintLevelShown = null;
}

/**
 * Expose internal state for testing purposes only.
 * @internal
 */
export function _getState(): Readonly<HintEngineState> {
  return { ...state };
}

/**
 * Replace internal state — for testing purposes only.
 * @internal
 */
export function _setState(partial: Partial<HintEngineState>): void {
  state = { ...state, ...partial };
}
