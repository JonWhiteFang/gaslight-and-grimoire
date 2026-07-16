/// <reference types="node" />
/**
 * Focus-ring standardization (Phase 4 WS3, Codex Major 2).
 * All keyboard-focusable controls use focus-visible:ring-2 ring-amber-400.
 * The inventory test walks the WHOLE src/ tree and fails if a bare `focus:ring-`
 * remains outside two documented exceptions (red autofocus confirm, white
 * skip-link) — a glob-derived scan, not a hand-maintained file list, so a stray
 * ring in any component (scanned or not before) is caught (Codex code-review
 * Minor 1+2). jsdom can't compute contrast — that's the live check (Task 8).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TitleScreen } from '../TitleScreen/TitleScreen';

// src/ root, resolved module-relative (cwd-independent). '../../..' pops the
// filename then climbs __tests__ → components → src.
const SRC_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

const readSrc = (abs: string) => readFileSync(abs, 'utf8');

// Recursively enumerate every .tsx under src/, EXCLUDING test files and any
// __tests__ directory. Dependency-free walk (no fast-glob) — Minor 1.
function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walkTsx(full));
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

// Single derived file list, referenced by both describes (Minor 2).
const FILES = walkTsx(SRC_ROOT);

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

describe('focus rings — no stray bare focus:ring anywhere under src/ (WS3)', () => {
  it('every .tsx uses focus-visible amber-400 (only red/white exceptions remain)', () => {
    const offenders = FILES.map((f) => ({ f, strays: strayBareFocusRings(readSrc(f)) }))
      .filter((r) => r.strays.length > 0)
      .map((r) => `${r.f.slice(SRC_ROOT.length + 1)}: ${r.strays.join(', ')}`);
    expect(offenders).toEqual([]);
  });
});

describe('focus rings — no low-contrast stone ring remains (WS3)', () => {
  it('no ring-stone-400 / ring-stone-600 focus ring anywhere under src/', () => {
    const all = FILES.map(readSrc).join('\n');
    expect(all).not.toMatch(/focus:ring-stone-[46]00/);
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
