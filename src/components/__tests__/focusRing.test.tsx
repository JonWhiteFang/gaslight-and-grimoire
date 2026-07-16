/// <reference types="node" />
/**
 * Focus-ring standardization (Phase 4 WS3, Codex Major 2).
 * All keyboard-focusable controls use focus-visible:ring-2 ring-amber-400.
 * The inventory test reads source and fails if a bare `focus:ring-` remains
 * outside two documented exceptions (red autofocus confirm, white skip-link).
 * jsdom can't compute contrast — that's the live check (Task 8).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TitleScreen } from '../TitleScreen/TitleScreen';

const src = (rel: string) =>
  readFileSync(resolve(fileURLToPath(import.meta.url), '../../..', rel), 'utf8');
// '../../..' pops the filename then climbs __tests__ → components → src, so a
// `rel` of 'App.tsx' resolves to src/App.tsx (same pattern as reducedMotion test).

afterEach(cleanup);

// A bare `focus:ring-<color>` (NOT focus-visible:) on a keyboard control is a
// finding UNLESS allowlisted (red autofocus confirm, white skip-link, or the
// bare `focus:ring-2` width utility paired with a focus-visible color).
function strayBareFocusRings(source: string): string[] {
  const matches = source.match(/(?<!focus-visible:)\bfocus:ring-[a-z0-9/-]+/g) ?? [];
  return matches.filter((m) => {
    if (m.startsWith('focus:ring-red-')) return false; // red autofocus confirm
    if (m === 'focus:ring-white') return false;        // skip-link
    if (m === 'focus:ring-2') return false;            // width utility
    return true;
  });
}

describe('focus rings — no stray bare focus:ring on keyboard controls (WS3)', () => {
  const files = [
    'App.tsx',
    'components/TitleScreen/TitleScreen.tsx',
    'components/TitleScreen/LoadGameScreen.tsx',
    'components/CaseSelection/CaseSelection.tsx',
    'components/CaseCompletion/CaseCompletion.tsx',
    'components/ChoicePanel/ChoiceCard.tsx',
    'components/ErrorBoundary/ErrorBoundary.tsx',
    'components/InvestigationHalted/InvestigationHalted.tsx',
  ];
  for (const f of files) {
    it(`${f} has no stray bare focus:ring color utility`, () => {
      expect(strayBareFocusRings(src(f))).toEqual([]);
    });
  }
});

describe('focus rings — no low-contrast stone ring remains (WS3)', () => {
  it('no ring-stone-400 / ring-stone-600 focus ring in scanned files', () => {
    const all = ['App.tsx','components/TitleScreen/TitleScreen.tsx','components/TitleScreen/LoadGameScreen.tsx','components/CaseSelection/CaseSelection.tsx','components/CaseCompletion/CaseCompletion.tsx','components/ChoicePanel/ChoiceCard.tsx','components/ErrorBoundary/ErrorBoundary.tsx','components/InvestigationHalted/InvestigationHalted.tsx'].map(src).join('\n');
    expect(all).not.toMatch(/ring-stone-[46]00/);
  });
});

describe('focus rings — rendered spot-check (WS3)', () => {
  it('TitleScreen New button uses focus-visible amber-400 (not bare focus)', () => {
    render(<TitleScreen onNewGame={() => {}} onLoadGame={() => {}} onSettings={() => {}} loadError={null} onDismissError={() => {}} />);
    const newGame = screen.getByRole('button', { name: /new investigation|new game/i });
    expect(newGame.className).toMatch(/focus-visible:ring-amber-400/);
    expect(newGame.className).not.toMatch(/(?<!focus-visible:)\bfocus:ring-amber-400/);
  });
});
