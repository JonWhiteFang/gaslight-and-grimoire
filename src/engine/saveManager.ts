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

export const CURRENT_SAVE_VERSION = 3;

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural guard for a deserialised GameState (F-036).
 *
 * A truncated, malformed, or hand-edited save must not be written wholesale into
 * the store — a missing `investigator` or a `clues` that isn't an object crashes
 * rendering. This checks the *required* fields exist with the right broad shape;
 * `migrate` backfills the optional ones (`connections`/`visitedScenes`), so it
 * runs after migration. It is intentionally shallow — it defends against garbage,
 * not against a determined cheat editing a well-formed save.
 */
export function isValidGameState(state: unknown): state is GameState {
  if (!isPlainObject(state)) return false;

  if (!isPlainObject(state.investigator)) return false;
  if (!isPlainObject((state.investigator as Record<string, unknown>).faculties)) return false;

  if (typeof state.currentScene !== 'string') return false;
  if (typeof state.currentCase !== 'string') return false;

  // The normalised record maps and history/settings must be present and correctly typed.
  for (const key of ['clues', 'deductions', 'npcs', 'flags', 'factionReputation'] as const) {
    if (!isPlainObject(state[key])) return false;
  }
  if (!Array.isArray(state.sceneHistory)) return false;
  if (!isPlainObject(state.settings)) return false;

  return true;
}

// ─── SaveManager ─────────────────────────────────────────────────────────────

export const SaveManager = {
  /**
   * Serialise `state` into a versioned SaveFile and persist it.
   * Updates the save index with a summary entry.
   *
   * `caseTitle`, when supplied, is stored as the summary's readable `caseName`
   * so the Load-game list shows the human title rather than the slug (F-010).
   * The persisted GameState is unchanged — the title is index-only.
   */
  save(saveId: string, state: GameState, caseTitle?: string): void {
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
      caseName: caseTitle || state.currentCase,
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    // Guard the envelope before migrating: a scalar/array/null blob (truncated or
    // hand-edited) would otherwise crash `migrate`'s `...state` spread (F-036).
    if (!isPlainObject(parsed) || !isPlainObject(parsed.state)) return null;

    const migrated = SaveManager.migrate(parsed as unknown as SaveFile);
    // Reject a structurally-invalid save rather than committing garbage to the
    // store (F-036). Migration backfills optional fields; this checks the
    // required ones survived.
    if (!isValidGameState(migrated.state)) return null;
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
   *   1 → 2: backfill `sceneHistory` and `connections` (default []) — fields
   *          added after v1; a missing `sceneHistory` otherwise crashes
   *          goToScene's push on the first navigation after load.
   *   2 → 3: backfill `visitedScenes` from the scenes the player has already
   *          seen (`sceneHistory` + `currentScene`), so reloading a pre-v3 save
   *          does not re-fire onEnter effects on scenes already passed (F-006).
   */
  migrate(saveFile: SaveFile): SaveFile {
    if (saveFile.version === CURRENT_SAVE_VERSION) {
      return saveFile;
    }

    let { state } = saveFile;
    // A legacy or hand-edited save may lack a `version` (or carry a NaN). Coerce
    // that to 0 so the full v0 → current chain runs; otherwise `undefined < N` is
    // false, every step is skipped, and the file is wrongly stamped current (F-015).
    let version = Number.isFinite(saveFile.version) ? saveFile.version : 0;

    // v0 → v1
    if (version < 1) {
      state = {
        ...state,
        factionReputation: state.factionReputation ?? {},
      };
      version = 1;
    }

    // v1 → v2
    if (version < 2) {
      state = {
        ...state,
        sceneHistory: state.sceneHistory ?? [],
        connections: state.connections ?? [],
      };
      version = 2;
    }

    // v2 → 3
    if (version < 3) {
      state = {
        ...state,
        visitedScenes:
          state.visitedScenes ??
          [...(state.sceneHistory ?? []), state.currentScene].filter(Boolean),
      };
      version = 3;
    }

    return {
      version: CURRENT_SAVE_VERSION,
      timestamp: saveFile.timestamp,
      state,
    };
  },
};
