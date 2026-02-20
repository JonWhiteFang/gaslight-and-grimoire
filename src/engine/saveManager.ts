/**
 * SaveManager — persistence module for Gaslight & Grimoire.
 *
 * Storage: localStorage with JSON serialisation.
 *
 * Key format:  gg_save_{saveId}
 * Index key:   gg_save_index  (array of SaveSummary, sorted by timestamp desc)
 */

import type { GameState, SaveFile } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CURRENT_SAVE_VERSION = 1;

const KEY_PREFIX = 'gg_save_';
const INDEX_KEY = 'gg_save_index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveSummary {
  id: string;
  timestamp: string;
  caseName: string;
  investigatorName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveKey(saveId: string): string {
  return KEY_PREFIX + saveId;
}

function readIndex(): SaveSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SaveSummary[];
  } catch {
    return [];
  }
}

function writeIndex(index: SaveSummary[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ─── SaveManager ─────────────────────────────────────────────────────────────

export const SaveManager = {
  /**
   * Serialise `state` into a versioned SaveFile and persist it.
   * Updates the save index with a summary entry.
   */
  save(saveId: string, state: GameState): void {
    const saveFile: SaveFile = {
      version: CURRENT_SAVE_VERSION,
      timestamp: new Date().toISOString(),
      state,
    };

    localStorage.setItem(saveKey(saveId), JSON.stringify(saveFile));

    // Update index
    const index = readIndex();
    const summary: SaveSummary = {
      id: saveId,
      timestamp: saveFile.timestamp,
      caseName: state.currentCase,
      investigatorName: state.investigator.name,
    };
    const existingIdx = index.findIndex((s) => s.id === saveId);
    if (existingIdx >= 0) {
      index[existingIdx] = summary;
    } else {
      index.push(summary);
    }
    // Sort descending by timestamp
    index.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    writeIndex(index);
  },

  /**
   * Load a save by ID. Returns null if not found.
   * Applies migration before returning the state.
   */
  load(saveId: string): GameState | null {
    const raw = localStorage.getItem(saveKey(saveId));
    if (!raw) return null;

    let saveFile: SaveFile;
    try {
      saveFile = JSON.parse(raw) as SaveFile;
    } catch {
      return null;
    }

    const migrated = SaveManager.migrate(saveFile);
    return migrated.state;
  },

  /**
   * Return all save summaries sorted by timestamp descending.
   */
  listSaves(): SaveSummary[] {
    return readIndex();
  },

  /**
   * Remove a save file and its index entry.
   */
  deleteSave(saveId: string): void {
    localStorage.removeItem(saveKey(saveId));
    const index = readIndex().filter((s) => s.id !== saveId);
    writeIndex(index);
  },

  /**
   * Migrate a SaveFile to the current schema version.
   * Idempotent: calling twice on a current-version file returns an equivalent file.
   *
   * Version history:
   *   0 → 1: ensure `factionReputation` exists (default {})
   */
  migrate(saveFile: SaveFile): SaveFile {
    if (saveFile.version === CURRENT_SAVE_VERSION) {
      return saveFile;
    }

    let { state } = saveFile;
    let version = saveFile.version;

    // v0 → v1
    if (version < 1) {
      state = {
        ...state,
        factionReputation: state.factionReputation ?? {},
      };
      version = 1;
    }

    return {
      version: CURRENT_SAVE_VERSION,
      timestamp: saveFile.timestamp,
      state,
    };
  },
};
