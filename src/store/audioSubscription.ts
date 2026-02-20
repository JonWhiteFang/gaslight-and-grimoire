import { useStore } from './index';
import { AudioManager } from '../engine/audioManager';
import type { SfxEvent } from '../engine/audioManager';

/** Subscribes to store changes and triggers SFX. Call once at app init. */
export function initAudioSubscription(): void {
  useStore.subscribe((state, prevState) => {
    const vol = state.settings.audioVolume.sfx;

    if (state.investigator.composure < prevState.investigator.composure) {
      AudioManager.playSfx('composure-decrease', vol);
    }
    if (state.investigator.vitality < prevState.investigator.vitality) {
      AudioManager.playSfx('vitality-decrease', vol);
    }
    if (state.currentScene !== prevState.currentScene && state.currentScene !== '') {
      AudioManager.playSfx('scene-transition', vol);
    }
    if (state.lastCheckResult !== null && prevState.lastCheckResult === null) {
      AudioManager.playSfx('dice-roll', vol);
    }

    // Clue discovery: find clues that just became revealed
    for (const [id, clue] of Object.entries(state.clues)) {
      const prev = prevState.clues[id];
      if (clue.isRevealed && prev && !prev.isRevealed) {
        AudioManager.playSfx(`clue-${clue.type}` as SfxEvent, vol);
      }
    }
  });
}
