/**
 * LoadGameScreen — legacy save titles must display readably (F-010 follow-up).
 *
 * Saves created before the title change stored caseName as a raw slug. The list
 * must de-slugify at the render site so those still show "The Whitechapel
 * Cipher", not "the-whitechapel-cipher". Post-change saves already store the
 * title and must pass through unchanged.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LoadGameScreen } from '../TitleScreen/LoadGameScreen';

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

function seedIndex(entries: Array<{ id: string; caseName: string; investigatorName: string }>) {
  localStorage.setItem('gg_save_index', JSON.stringify(
    entries.map((e) => ({ ...e, timestamp: new Date(0).toISOString() })),
  ));
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('LoadGameScreen — readable case titles', () => {
  it('de-slugifies a legacy slug caseName', () => {
    seedIndex([{ id: 'save-old', caseName: 'the-whitechapel-cipher', investigatorName: 'Ada' }]);
    render(<LoadGameScreen onLoad={() => {}} onBack={() => {}} />);
    expect(screen.getByText('The Whitechapel Cipher')).toBeTruthy();
    expect(screen.queryByText('the-whitechapel-cipher')).toBeNull();
  });

  it('leaves an already-readable title untouched', () => {
    seedIndex([{ id: 'save-new', caseName: 'The Mayfair Séance', investigatorName: 'Ada' }]);
    render(<LoadGameScreen onLoad={() => {}} onBack={() => {}} />);
    expect(screen.getByText('The Mayfair Séance')).toBeTruthy();
  });
});
