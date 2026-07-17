/**
 * Unit tests for CaseProgression.
 *
 * 1. completeCase grants +1 to the faculty stored in the `investigator.lastCriticalFaculty` field
 * 2. checkVignetteUnlocks returns 'a-matter-of-shadows' when Lamplighters rep ≥ 2
 * 3. checkVignetteUnlocks returns null when Lamplighters rep < 2
 * 4. grantFacultyBonus caps faculty at 20
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CaseProgression } from '../caseProgression';
import { useStore } from '../../store';
import type { Faculty, GameState } from '../../types';

// ─── localStorage mock (SaveManager uses it) ─────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid GameState for testing. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      name: 'Holmes',
      archetype: 'deductionist',
      faculties: {
        reason: 12,
        perception: 10,
        nerve: 10,
        vigor: 10,
        influence: 10,
        lore: 10,
      },
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    },
    currentScene: 'scene-1',
    currentCase: 'the-whitechapel-cipher',
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
      autoSaveFrequency: 'manual',
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
    ...overrides,
  };
}

/** Reset the Zustand store to a clean default state before each test. */
function resetStore() {
  useStore.setState({
    investigator: {
      name: 'Holmes',
      archetype: 'deductionist',
      faculties: {
        reason: 12,
        perception: 10,
        nerve: 10,
        vigor: 10,
        influence: 10,
        lore: 10,
      },
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    },
    currentScene: 'scene-1',
    currentCase: 'the-whitechapel-cipher',
    clues: {},
    deductions: {},
    npcs: {},
    flags: {},
    factionReputation: {},
    sceneHistory: [],
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  resetStore();
});

// ─── Test 1: completeCase grants faculty bonus ────────────────────────────────

describe('completeCase — faculty bonus from investigator.lastCriticalFaculty', () => {
  it('grants +1 to the faculty stored in lastCriticalFaculty', () => {
    const faculty: Faculty = 'reason';
    const initialScore = 12;

    const state = makeState({
      investigator: {
        name: 'Holmes',
        archetype: 'deductionist',
        faculties: {
          reason: initialScore,
          perception: 10,
          nerve: 10,
          vigor: 10,
          influence: 10,
          lore: 10,
        },
        composure: 10,
        vitality: 10,
        abilityUsed: false,
        lastCriticalFaculty: faculty,
      },
    });

    // Sync store to match state
    useStore.setState((s) => ({
      ...s,
      investigator: state.investigator,
    }));

    const result = CaseProgression.completeCase('the-whitechapel-cipher', state, useStore.getState());

    expect(result.facultyBonusGranted).toBe(faculty);
    expect(useStore.getState().investigator.faculties[faculty]).toBe(initialScore + 1);
  });

  it('grants +1 to influence when lastCriticalFaculty is influence', () => {
    const faculty: Faculty = 'influence';
    const initialScore = 14;

    const state = makeState({
      investigator: {
        name: 'Holmes',
        archetype: 'deductionist',
        faculties: {
          reason: 12,
          perception: 10,
          nerve: 10,
          vigor: 10,
          influence: initialScore,
          lore: 10,
        },
        composure: 10,
        vitality: 10,
        abilityUsed: false,
        lastCriticalFaculty: faculty,
      },
    });

    useStore.setState((s) => ({
      ...s,
      investigator: state.investigator,
    }));

    const result = CaseProgression.completeCase('the-whitechapel-cipher', state, useStore.getState());

    expect(result.facultyBonusGranted).toBe(faculty);
    expect(useStore.getState().investigator.faculties[faculty]).toBe(initialScore + 1);
  });

  it('returns facultyBonusGranted: null when lastCriticalFaculty is unset', () => {
    const state = makeState();

    const result = CaseProgression.completeCase('the-whitechapel-cipher', state, useStore.getState());

    expect(result.facultyBonusGranted).toBeNull();
  });
});

// ─── Test 2 & 3: checkVignetteUnlocks ────────────────────────────────────────

describe('checkVignetteUnlocks — a-matter-of-shadows', () => {
  it('returns ["a-matter-of-shadows"] when Lamplighters reputation is exactly 2', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 2 },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual(['a-matter-of-shadows']);
  });

  it('returns ["a-matter-of-shadows"] when Lamplighters reputation exceeds 2', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 5 },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual(['a-matter-of-shadows']);
  });

  it('returns [] when Lamplighters reputation is 1', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 1 },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual([]);
  });

  it('returns [] when Lamplighters reputation is 0', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 0 },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual([]);
  });

  it('returns [] when Lamplighters reputation is negative', () => {
    const state = makeState({
      factionReputation: { Lamplighters: -3 },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual([]);
  });

  it('returns [] when factionReputation has no Lamplighters entry', () => {
    const state = makeState({
      factionReputation: { Rationalists: 10 },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual([]);
  });

  it('does not re-list an already-unlocked vignette', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 5 },
      flags: { 'vignette-unlocked-a-matter-of-shadows': true },
    });

    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual([]);
  });

  it('sets the vignette-unlocked flag in the store when unlocked via completeCase', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 3 },
    });

    useStore.setState((s) => ({
      ...s,
      factionReputation: { Lamplighters: 3 },
    }));

    CaseProgression.completeCase('the-whitechapel-cipher', state, useStore.getState());

    expect(useStore.getState().flags['vignette-unlocked-a-matter-of-shadows']).toBe(true);
  });
});

// ─── checkVignetteUnlocks — the other three vignettes ────────────────────────

describe('checkVignetteUnlocks — all four vignettes are registered', () => {
  it('unlocks the-rationalists-dilemma at Rationalists Circle reputation ≥ 2', () => {
    const state = makeState({ factionReputation: { 'Rationalists Circle': 2 } });
    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual(['the-rationalists-dilemma']);
  });

  // #3 / F-003: the-debt-of-smoke was gated on npc-sable disposition ≥ 7, but
  // the max attainable disposition in the only case containing Sable is +4, and
  // npcs reset between cases — so it was permanently unreachable. It is now
  // gated on the persisted `wc-court-deal-made` flag set by the Whitechapel
  // Court-of-Smoke ending (flags survive case loads, like wc-case-complete).
  it('unlocks the-debt-of-smoke when the wc-court-deal-made flag is set', () => {
    const state = makeState({
      flags: { 'wc-court-deal-made': true },
    });
    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual(['the-debt-of-smoke']);
  });

  it('does not unlock the-debt-of-smoke without the wc-court-deal-made flag', () => {
    const state = makeState({ flags: {} });
    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual([]);
  });

  it('unlocks the-unfinished-case when the wc-case-complete flag is set', () => {
    const state = makeState({
      // wc-case-complete alone (a non-Court ending) unlocks the-unfinished-case
      // but NOT the-debt-of-smoke.
      flags: { 'wc-case-complete': true },
    });
    expect(CaseProgression.checkVignetteUnlocks(state)).toEqual(['the-unfinished-case']);
  });
});

// ─── F-057: multiple vignettes unlock simultaneously ─────────────────────────

describe('checkVignetteUnlocks — multiple simultaneous unlocks (F-057)', () => {
  it('returns every satisfied vignette when two reputation thresholds are met at once', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 3, 'Rationalists Circle': 4 },
    });

    const unlocked = CaseProgression.checkVignetteUnlocks(state);
    expect(unlocked).toContain('a-matter-of-shadows');
    expect(unlocked).toContain('the-rationalists-dilemma');
    expect(unlocked).toHaveLength(2);
  });

  it('returns every satisfied vignette when two flags are set at once', () => {
    const state = makeState({
      flags: { 'wc-court-deal-made': true, 'wc-case-complete': true },
    });

    const unlocked = CaseProgression.checkVignetteUnlocks(state);
    expect(unlocked).toContain('the-debt-of-smoke');
    expect(unlocked).toContain('the-unfinished-case');
    expect(unlocked).toHaveLength(2);
  });

  it('completeCase sets a flag for every simultaneously-unlocked vignette', () => {
    const state = makeState({
      factionReputation: { Lamplighters: 3, 'Rationalists Circle': 4 },
    });
    useStore.setState((s) => ({
      ...s,
      factionReputation: { Lamplighters: 3, 'Rationalists Circle': 4 },
    }));

    const result = CaseProgression.completeCase('the-whitechapel-cipher', state, useStore.getState());

    expect(result.vignettesUnlocked).toContain('a-matter-of-shadows');
    expect(result.vignettesUnlocked).toContain('the-rationalists-dilemma');
    expect(useStore.getState().flags['vignette-unlocked-a-matter-of-shadows']).toBe(true);
    expect(useStore.getState().flags['vignette-unlocked-the-rationalists-dilemma']).toBe(true);
  });
});

// ─── the-orrery-room unlock ──────────────────────────────────────────────────

describe('the-orrery-room unlock', () => {
  function stateWithGreyDawnRep(rep: number, flags: Record<string, boolean> = {}) {
    return makeState({
      factionReputation: { 'Hermetic Order of the Grey Dawn': rep },
      flags,
    });
  }

  it('unlocks at Grey Dawn reputation 2 (threshold inclusive)', () => {
    const unlocked = CaseProgression.checkVignetteUnlocks(stateWithGreyDawnRep(2));
    expect(unlocked).toContain('the-orrery-room');
  });

  it('does not unlock below threshold', () => {
    const unlocked = CaseProgression.checkVignetteUnlocks(stateWithGreyDawnRep(1));
    expect(unlocked).not.toContain('the-orrery-room');
  });

  it('skips when already unlocked', () => {
    const unlocked = CaseProgression.checkVignetteUnlocks(
      stateWithGreyDawnRep(5, { 'vignette-unlocked-the-orrery-room': true }),
    );
    expect(unlocked).not.toContain('the-orrery-room');
  });
});

// ─── Test 4: grantFacultyBonus caps at 20 ────────────────────────────────────

describe('grantFacultyBonus — cap at 20', () => {
  it('increments faculty by 1 from a normal value', () => {
    useStore.setState((s) => ({
      ...s,
      investigator: { ...s.investigator, faculties: { ...s.investigator.faculties, nerve: 15 } },
    }));

    CaseProgression.grantFacultyBonus('nerve', useStore.getState());

    expect(useStore.getState().investigator.faculties['nerve']).toBe(16);
  });

  it('caps at 20 when faculty is already 20', () => {
    useStore.setState((s) => ({
      ...s,
      investigator: { ...s.investigator, faculties: { ...s.investigator.faculties, lore: 20 } },
    }));

    CaseProgression.grantFacultyBonus('lore', useStore.getState());

    expect(useStore.getState().investigator.faculties['lore']).toBe(20);
  });

  it('caps at 20 when faculty is 19', () => {
    useStore.setState((s) => ({
      ...s,
      investigator: { ...s.investigator, faculties: { ...s.investigator.faculties, vigor: 19 } },
    }));

    CaseProgression.grantFacultyBonus('vigor', useStore.getState());

    expect(useStore.getState().investigator.faculties['vigor']).toBe(20);
  });

  it('does not affect other faculties when granting a bonus', () => {
    useStore.setState((s) => ({
      ...s,
      investigator: {
        ...s.investigator,
        faculties: { reason: 12, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
      },
    }));

    CaseProgression.grantFacultyBonus('reason', useStore.getState());

    const faculties = useStore.getState().investigator.faculties;
    expect(faculties.reason).toBe(13);
    expect(faculties.perception).toBe(10);
    expect(faculties.nerve).toBe(10);
    expect(faculties.vigor).toBe(10);
    expect(faculties.influence).toBe(10);
    expect(faculties.lore).toBe(10);
  });
});
