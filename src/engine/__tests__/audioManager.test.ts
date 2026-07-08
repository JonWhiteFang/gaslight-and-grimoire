/**
 * audioManager — SFX path resolution.
 *
 * Regression (F): SFX_PATHS were bare absolute `/audio/sfx/*.mp3`, ignoring Vite's
 * `base` (`/gaslight-and-grimoire/`). Under the real base — in dev AND on GitHub
 * Pages — every SFX fetched a 404, so SFX never played. AmbientAudio already
 * prefixed `import.meta.env.BASE_URL`; SFX must too. buildSfxSrc is the pure,
 * base-injectable seam that resolution goes through.
 */
import { describe, it, expect } from 'vitest';
import { buildSfxSrc } from '../audioManager';

describe('buildSfxSrc', () => {
  it('prefixes the Vite base path (GitHub Pages / dev under a sub-path)', () => {
    expect(buildSfxSrc('/gaslight-and-grimoire/', 'dice-roll')).toBe(
      '/gaslight-and-grimoire/audio/sfx/dice-roll.mp3',
    );
  });

  it('maps the redHerring event to its kebab-case filename', () => {
    expect(buildSfxSrc('/gaslight-and-grimoire/', 'clue-redHerring')).toBe(
      '/gaslight-and-grimoire/audio/sfx/clue-red-herring.mp3',
    );
  });

  it('handles a root base without doubling the slash', () => {
    expect(buildSfxSrc('/', 'scene-transition')).toBe('/audio/sfx/scene-transition.mp3');
  });
});
