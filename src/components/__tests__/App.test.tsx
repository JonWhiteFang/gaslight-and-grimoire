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
import App from '../../App';
import { ARCHETYPE_ABILITY_FLAG } from '../../engine/flags';
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
    expect(ARCHETYPE_ABILITY_FLAG).toEqual(expected);
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

// F-108: the "Review previous scene" button's enabled state must track
// sceneHistory reactively. App read useStore.getState().sceneHistory
// non-reactively at render, so advancing a scene (which appends to history)
// did not re-enable the button until some unrelated re-render.
describe('App — review-previous button reactivity (F-108)', () => {
  // Serve a minimal manifest + two-scene case so the real new-game flow reaches
  // the game screen, then drive goToScene through the store.
  function stubCaseFetch() {
    const firstScene = { id: 'sc-1', act: 1, narrative: 'first', cluesAvailable: [], choices: [], onEnter: [] };
    const secondScene = { id: 'sc-2', act: 1, narrative: 'second', cluesAvailable: [], choices: [], onEnter: [] };
    const bySuffix: Record<string, unknown> = {
      'content/manifest.json': { cases: [{ id: 'test-case', type: 'case', title: 'Test Case', synopsis: 's', status: 'available' }] },
      'cases/test-case/meta.json': { id: 'test-case', title: 'Test Case', firstScene: 'sc-1', acts: 3, facultyDistribution: {} },
      'cases/test-case/act1.json': { scenes: [firstScene, secondScene] },
      'cases/test-case/act2.json': { scenes: [] },
      'cases/test-case/act3.json': { scenes: [] },
      'cases/test-case/clues.json': { clues: [] },
      'cases/test-case/npcs.json': { npcs: [] },
      'cases/test-case/variants.json': { variants: [] },
      'shared/breakdown.json': { id: 'breakdown', narrative: 'b', choices: [], cluesAvailable: [], onEnter: [] },
      'shared/incapacitation.json': { id: 'incapacitation', narrative: 'i', choices: [], cluesAvailable: [], onEnter: [] },
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const key = Object.keys(bySuffix).find((k) => String(url).endsWith(k));
      if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
      return { ok: true, json: async () => bySuffix[key] } as Response;
    }));
  }

  afterEach(() => vi.unstubAllGlobals());

  it('enables the review button once a scene has been visited (reactive to sceneHistory)', async () => {
    stubCaseFetch();
    render(<App />);

    // New game → pick archetype (radio) → allocate all 12 points → name → begin.
    fireEvent.click(screen.getByRole('button', { name: NEW_GAME }));
    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));
    for (let i = 0; i < 12; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Increase Reason/i }));
    }
    fireEvent.change(screen.getByLabelText(/investigator name/i), { target: { value: 'Holmes' } });
    fireEvent.click(screen.getByRole('button', { name: /begin investigation/i }));

    // Case selection → pick the case → game screen.
    await waitFor(() => screen.getByRole('button', { name: /Test Case/i }));
    fireEvent.click(screen.getByRole('button', { name: /Test Case/i }));

    // On the game screen, at the first scene, history is empty → button disabled.
    const reviewBtn = await screen.findByRole('button', { name: /review previous scene/i });
    expect(reviewBtn).toBeDisabled();

    // Advance to the next scene via the store; sceneHistory now holds sc-1.
    await waitFor(() => useStore.getState().goToScene('sc-2'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /review previous scene/i })).not.toBeDisabled();
    });
  });
});
