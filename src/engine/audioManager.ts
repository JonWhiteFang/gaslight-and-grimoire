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

// ─── SFX File Paths ───────────────────────────────────────────────────────────

const SFX_PATHS: Record<SfxEvent, string> = {
  'dice-roll': '/audio/sfx/dice-roll.mp3',
  'clue-physical': '/audio/sfx/clue-physical.mp3',
  'clue-testimony': '/audio/sfx/clue-testimony.mp3',
  'clue-occult': '/audio/sfx/clue-occult.mp3',
  'clue-deduction': '/audio/sfx/clue-deduction.mp3',
  'clue-redHerring': '/audio/sfx/clue-red-herring.mp3',
  'composure-decrease': '/audio/sfx/composure-decrease.mp3',
  'vitality-decrease': '/audio/sfx/vitality-decrease.mp3',
  'scene-transition': '/audio/sfx/scene-transition.mp3',
};

// ─── Lazy Howl Cache ──────────────────────────────────────────────────────────

const sfxCache = new Map<SfxEvent, Howl>();

function getSfxHowl(event: SfxEvent): Howl {
  if (!sfxCache.has(event)) {
    sfxCache.set(
      event,
      new Howl({
        src: [SFX_PATHS[event]],
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
