import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useCurrentScene, useSettings } from '../../store';

const FADE_DURATION = 1000; // ms

/**
 * Non-rendering component that manages ambient audio playback.
 * - Loads and loops the ambient track specified by the scene's ambientAudio field.
 * - Cross-fades between tracks on scene transition.
 * - Respects audioVolume.ambient from settings.
 */
export function AmbientAudio() {
  const scene = useCurrentScene();
  const ambientTrack = scene?.ambientAudio ?? null;
  const settings = useSettings();
  const ambientVolume = settings.audioVolume.ambient;

  const currentHowlRef = useRef<Howl | null>(null);

  // Cross-fade when ambient track changes
  useEffect(() => {
    const previous = currentHowlRef.current;

    // Fade out and stop the previous track
    if (previous) {
      previous.fade(previous.volume() as number, 0, FADE_DURATION);
      previous.once('fade', () => {
        previous.stop();
        previous.unload();
      });
    }

    if (!ambientTrack) {
      currentHowlRef.current = null;
      return;
    }

    const base = import.meta.env.BASE_URL ?? '/';
    const src = `${base.replace(/\/$/, '')}/audio/ambient/${ambientTrack}.mp3`;
    const howl = new Howl({
      src: [src],
      loop: true,
      volume: 0,
      html5: false,
      // Howler silently ignores missing files — no error handling needed
    });

    howl.once('load', () => {
      howl.play();
      howl.fade(0, ambientVolume, FADE_DURATION);
    });

    currentHowlRef.current = howl;

    return () => {
      // Cleanup on unmount — stop immediately
      howl.stop();
      howl.unload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientTrack]);

  // Update volume on the current Howl when the setting changes
  useEffect(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.volume(ambientVolume);
    }
  }, [ambientVolume]);

  return null;
}
