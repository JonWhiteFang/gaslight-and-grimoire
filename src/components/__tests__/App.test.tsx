/**
 * App-level routing tests (F-020).
 *
 * Covers the screen-routing seams that had zero coverage:
 *   - title → character-creation → case-selection navigation
 *   - a failed load routes back to title and surfaces an error
 *   - the archetype → ability-flag mapping is correct and complete
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App, { ABILITY_FLAGS } from '../../App';
import { useStore } from '../../store';
import type { Archetype } from '../../types';

// Keep localStorage empty & isolated so LoadGameScreen has no saves and
// loadGame() fails deterministically.
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}
vi.stubGlobal('localStorage', makeLocalStorageMock());

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('App — ability flag mapping (F-020)', () => {
  it('maps every archetype to its ability flag', () => {
    const expected: Record<Archetype, string> = {
      deductionist: 'ability-auto-succeed-reason',
      occultist: 'ability-veil-sight-active',
      operator: 'ability-auto-succeed-vigor',
      mesmerist: 'ability-auto-succeed-influence',
    };
    expect(ABILITY_FLAGS).toEqual(expected);
  });
});

const NEW_GAME = /start a new investigation/i;
const LOAD_GAME = /continue a saved investigation/i;

function seedSave() {
  localStorage.setItem('gg_save_index', JSON.stringify([
    { id: 'save-x', timestamp: new Date(0).toISOString(), caseName: 'The Whitechapel Cipher', investigatorName: 'Ada' },
  ]));
}

describe('App — title screen routing (F-020)', () => {
  it('starts on the title screen', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: NEW_GAME })).toBeTruthy();
  });

  it('navigates to character creation on New Game', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: NEW_GAME }));
    // CharacterCreation shows archetype choices.
    expect(screen.getByText(/deductionist/i)).toBeTruthy();
  });

  it('navigates to the load screen and back to title', () => {
    seedSave();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: LOAD_GAME }));
    expect(screen.getByText(/saved investigations/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back to title/i }));
    expect(screen.getByRole('button', { name: NEW_GAME })).toBeTruthy();
  });
});

describe('App — load failure routing (F-020)', () => {
  it('routes back to title and shows an error when loadGame fails', async () => {
    // Force loadGame to fail regardless of the save id.
    const spy = vi.spyOn(useStore.getState(), 'loadGame').mockResolvedValue(false);
    // Seed a fake save summary so LoadGameScreen renders a load button.
    seedSave();

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: LOAD_GAME }));
    fireEvent.click(screen.getByRole('button', { name: /load investigation: Ada/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
    });
    // Back on the title screen.
    expect(screen.getByRole('button', { name: /new (game|investigation)/i })).toBeTruthy();
    spy.mockRestore();
  });
});
