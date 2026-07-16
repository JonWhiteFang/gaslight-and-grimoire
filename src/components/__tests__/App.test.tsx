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
import App, { OverlayFallback } from '../../App';
import { ARCHETYPE_ABILITY_FLAG } from '../../engine/flags';
import { useStore } from '../../store';
import { SaveManager } from '../../engine/saveManager';
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

// Serve a minimal manifest + two-scene case so the real new-game flow reaches
// the game screen. Shared by the F-108 and F-103 game-screen tests.
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

/** Drive the real new-game flow to the game screen. */
async function reachGameScreen() {
  fireEvent.click(screen.getByRole('button', { name: NEW_GAME }));
  fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));
  for (let i = 0; i < 12; i++) {
    fireEvent.click(screen.getByRole('button', { name: /Increase Reason/i }));
  }
  fireEvent.change(screen.getByLabelText(/investigator name/i), { target: { value: 'Holmes' } });
  fireEvent.click(screen.getByRole('button', { name: /begin investigation/i }));
  await waitFor(() => screen.getByRole('button', { name: /Test Case/i }));
  fireEvent.click(screen.getByRole('button', { name: /Test Case/i }));
  await screen.findByRole('button', { name: /save game/i });
}

// F-108: the "Review previous scene" button's enabled state must track
// sceneHistory reactively. App read useStore.getState().sceneHistory
// non-reactively at render, so advancing a scene (which appends to history)
// did not re-enable the button until some unrelated re-render.
describe('App — review-previous button reactivity (F-108)', () => {
  // Unstub the fetch mock, then restore the module-level localStorage stub that
  // unstubAllGlobals also clears (the top-level beforeEach calls localStorage.clear()).
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('enables the review button once a scene has been visited (reactive to sceneHistory)', async () => {
    stubCaseFetch();
    render(<App />);
    await reachGameScreen();

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

// #57: the modal-background isolation (F-007) must actually apply under React 19.
// App set `inert: ''`, which React 18 treated as truthy-present but React 19
// treats as a falsy boolean → react-dom calls removeAttribute, silently defeating
// the isolation. 3 of 4 overlays have no independent Tab trap and rely on it.
describe('App — modal background is inert while an overlay is open (#57)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('does NOT mark the background inert when no overlay is open', async () => {
    stubCaseFetch();
    render(<App />);
    await reachGameScreen();

    const background = screen.getByRole('banner').parentElement!;
    expect(background.hasAttribute('inert')).toBe(false);
  });

  it('marks the background inert when the Evidence Board overlay opens', async () => {
    stubCaseFetch();
    render(<App />);
    await reachGameScreen();

    fireEvent.click(screen.getByRole('button', { name: /open evidence board/i }));

    await waitFor(() => {
      const background = screen.getByRole('banner').parentElement!;
      expect(background.hasAttribute('inert')).toBe(true);
    });
  });
});

// Phase 4 WS2 (Codex Major 1 + Major 4): opening Settings from the TITLE screen
// must make the title content inert — gated on state, so it holds DURING the
// Suspense fallback, not only after the lazy panel resolves.
describe('App — title-screen background is inert while Settings is open (Phase 4)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('is inert together with the Loading fallback, and clears on close', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // Synchronous window: the inert region and the OverlayFallback ("Loading…")
    // coexist before the lazy chunk resolves (inert is bound to state, not chunk).
    const region = screen.getByTestId('title-inert-region');
    expect(region.hasAttribute('inert')).toBe(true);
    expect(screen.getByText(/^Loading…$/)).toBeInTheDocument();

    // After the chunk resolves, still inert; then close removes it.
    fireEvent.click(await screen.findByRole('button', { name: /close settings/i }));
    await waitFor(() =>
      expect(screen.getByTestId('title-inert-region').hasAttribute('inert')).toBe(false),
    );
  });
});

// #57: the loading fallbacks are visual-only (animate-pulse text). Screen-reader
// users get no feedback during async content/overlay loads. Both must be a
// polite live status region.
describe('App — loading fallbacks are announced to screen readers (#57)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('OverlayFallback is a polite live status region', () => {
    render(<OverlayFallback />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toMatch(/loading/i);
  });

  it('the full-screen "Loading case…" screen is a polite live status region', async () => {
    // Resolve the manifest (so the case button renders) but hang the case-content
    // fetch, so the 'loading' screen persists for the assertion.
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).endsWith('content/manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ cases: [{ id: 'test-case', type: 'case', title: 'Test Case', synopsis: 's', status: 'available' }] }),
        } as Response);
      }
      return new Promise<Response>(() => {});
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: NEW_GAME }));
    fireEvent.click(screen.getByRole('radio', { name: /deductionist/i }));
    for (let i = 0; i < 12; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Increase Reason/i }));
    }
    fireEvent.change(screen.getByLabelText(/investigator name/i), { target: { value: 'Holmes' } });
    fireEvent.click(screen.getByRole('button', { name: /begin investigation/i }));
    // CharacterCreation → case-selection; pick a case → 'loading' screen (fetch hangs).
    const caseBtn = await screen.findByRole('button', { name: /test case/i });
    fireEvent.click(caseBtn);

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toMatch(/loading case/i);
    });
  });
});

// F-103: a manual save that fails (localStorage throw) must surface an error,
// not a false "Game saved" confirmation.
describe('App — manual save failure surfaces an error toast (F-103)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.stubGlobal('localStorage', makeLocalStorageMock()); });

  it('shows an error alert (not "Game saved") when saveGame reports failure', async () => {
    stubCaseFetch();
    render(<App />);
    await reachGameScreen();

    // Force the persistence layer to throw (quota/disabled) so the real saveGame
    // try/catch returns { ok: false } end-to-end (F-103).
    vi.spyOn(SaveManager, 'save').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    fireEvent.click(screen.getByRole('button', { name: /save game/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/save failed/i);
    });
    expect(screen.queryByText(/^Game saved/)).toBeNull();
  });
});
