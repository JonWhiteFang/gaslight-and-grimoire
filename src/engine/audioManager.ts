import { Howl } from 'howler';

// ─── SFX Event Types ──────────────────────────────────────────────────────────

export type SfxEvent =
  | 'dice-roll'
  | 'clue-physical'
  | 'clue-testimony'
  | 'clue-occult'
  | 'clue-deduction'
  | 'clue-redHerring'
  | 'composure-decrease'
  | 'vitality-decrease'
  | 'scene-transition';

// ─── SFX File Names ───────────────────────────────────────────────────────────

/** Event → filename stem (kebab-case; note `clue-redHerring` → `clue-red-herring`). */
const SFX_FILES: Record<SfxEvent, string> = {
  'dice-roll': 'dice-roll',
  'clue-physical': 'clue-physical',
  'clue-testimony': 'clue-testimony',
  'clue-occult': 'clue-occult',
  'clue-deduction': 'clue-deduction',
  'clue-redHerring': 'clue-red-herring',
  'composure-decrease': 'composure-decrease',
  'vitality-decrease': 'vitality-decrease',
  'scene-transition': 'scene-transition',
};

/**
 * Resolve the served URL for an SFX event under the given Vite base path.
 * Mirrors AmbientAudio's base handling so SFX resolve correctly under
 * `/gaslight-and-grimoire/` (GitHub Pages) as well as `/` (root).
 */
export function buildSfxSrc(base: string, event: SfxEvent): string {
  return `${base.replace(/\/$/, '')}/audio/sfx/${SFX_FILES[event]}.mp3`;
}

// ─── Lazy Howl Cache ──────────────────────────────────────────────────────────

const sfxCache = new Map<SfxEvent, Howl>();

function getSfxHowl(event: SfxEvent): Howl {
  if (!sfxCache.has(event)) {
    sfxCache.set(
      event,
      new Howl({
        src: [buildSfxSrc(import.meta.env.BASE_URL ?? '/', event)],
        preload: true,
        html5: false,
      }),
    );
  }
  return sfxCache.get(event)!;
}

// ─── AudioManager Singleton ───────────────────────────────────────────────────

export const AudioManager = {
  /**
   * Play a sound effect at the given volume (0–1).
   * Howler handles missing files gracefully — no error thrown.
   */
  playSfx(event: SfxEvent, volume: number): void {
    const howl = getSfxHowl(event);
    howl.volume(Math.max(0, Math.min(1, volume)));
    howl.play();
  },

  /**
   * Update the volume on all cached SFX Howl instances.
   * Called when the user changes the SFX volume slider.
   */
  setMasterSfxVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    sfxCache.forEach((howl) => howl.volume(clamped));
  },
};
