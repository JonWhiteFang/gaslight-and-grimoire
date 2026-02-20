# Trace 10 — Audio Pipeline (SFX + Ambient)

## 1. Entry Point

Two subsystems:
- **SFX**: `AudioManager.playSfx(event, volume)` — called from store slice actions.
- **Ambient**: `AmbientAudio` component — reacts to `scene.ambientAudio` changes.

## 2. Execution Path

### SFX

Triggered from 4 store slices:

| Caller | Event | Trigger |
|---|---|---|
| `investigatorSlice.adjustComposure` (delta < 0) | `'composure-decrease'` | Composure damage |
| `investigatorSlice.adjustVitality` (delta < 0) | `'vitality-decrease'` | Vitality damage |
| `narrativeSlice.goToScene` | `'scene-transition'` | Every scene change |
| `narrativeSlice.setCheckResult` (result truthy) | `'dice-roll'` | Faculty check performed |
| `evidenceSlice.discoverClue` | `'clue-{type}'` | Clue revealed |

Execution:
1. Slice action calls `AudioManager.playSfx(event, state.settings.audioVolume.sfx)`.
2. `playSfx` calls `getSfxHowl(event)`:
   - Checks `sfxCache` (module-level `Map<SfxEvent, Howl>`).
   - If miss: creates `new Howl({ src: [SFX_PATHS[event]], preload: true, html5: false })`, stores in cache.
3. Sets volume: `howl.volume(Math.max(0, Math.min(1, volume)))`.
4. Calls `howl.play()`.

### Ambient

1. `AmbientAudio` component (non-rendering, returns `null`) subscribes to `useCurrentScene()` and `useSettings()`.
2. Extracts `scene.ambientAudio` (a track name string or null).
3. `useEffect` on `ambientTrack` change:
   - Fades out previous Howl: `previous.fade(volume, 0, 1000ms)` → on fade complete, `stop()` + `unload()`.
   - If new track exists: creates `new Howl({ src, loop: true, volume: 0, html5: false })`.
   - On load: `howl.play()` → `howl.fade(0, ambientVolume, 1000ms)`.
   - Stores in `currentHowlRef`.
4. Separate `useEffect` on `ambientVolume` change: updates `currentHowlRef.current.volume(ambientVolume)`.
5. Cleanup on unmount: `howl.stop()` + `howl.unload()`.

## 3. Resource Management

- SFX Howls are lazy-created and cached forever in the module-level `Map`. Never evicted.
- `preload: true` on SFX means the audio file is fetched immediately on first reference. If the file doesn't exist, Howler silently fails.
- Ambient Howls are created per scene and unloaded on scene change. No caching — the same ambient track loaded twice creates two Howl instances.
- `html5: false` forces Web Audio API (not HTML5 Audio). This is better for SFX (lower latency) but means audio won't play on some mobile browsers without user interaction first.
- Cross-fade uses Howler's built-in `fade()` method with a 1-second duration.

## 4. Error Path

- Missing audio files: Howler silently fails. No error thrown, no fallback, no logging. The game runs fine without audio.
- `getSfxHowl` always returns a Howl (creates one if missing). No null check needed.
- If `import.meta.env.BASE_URL` is undefined, `AmbientAudio` constructs a path starting with `undefined/audio/...` — would 404 silently.

## 5. Performance Characteristics

- SFX playback is near-instant after first load (cached Howl, Web Audio API).
- First SFX play has latency: Howl creation + HTTP fetch + decode. `preload: true` mitigates this by starting the fetch immediately.
- Ambient cross-fade is smooth (Howler handles it internally).
- `AmbientAudio` re-renders on every scene change (subscribes to `useCurrentScene()`). The `useEffect` dependency on `ambientTrack` prevents unnecessary Howl creation if the track name hasn't changed.
- SFX calls happen inside Immer `set()` callbacks (store slices). This means audio playback is triggered synchronously during state mutation. Howler's `play()` is async internally (schedules on Web Audio), so this doesn't block the mutation.

## 6. Observable Effects

- Audio: SFX plays on composure/vitality damage, scene transitions, dice rolls, clue discovery. Ambient loops per scene.
- No visual effects from the audio system.
- No store mutations from the audio system.
- Volume respects `settings.audioVolume.sfx` (read at play time) and `settings.audioVolume.ambient` (reactive via useEffect).

## 7. Why This Design

- Lazy caching for SFX avoids loading all 9 sound effects upfront. Only sounds that are actually triggered get loaded.
- Calling `playSfx` from store slices (not components) ensures SFX plays regardless of which component triggered the action. This is a good separation — audio is a side effect of state changes, not UI events.
- `AmbientAudio` as a non-rendering component keeps audio logic out of the visual component tree.

## 8. Feels Incomplete

- No audio files exist in the repository. The entire audio system is functional but silent.
- `AudioManager.setMasterSfxVolume` exists but is never called. Volume is set per-play via the second argument to `playSfx`.
- No ambient audio for any scene — no `ambientAudio` field is set in the current case content JSON (would need to verify, but no audio files exist regardless).
- No mute toggle. Setting volume to 0 works but there's no quick mute/unmute.
- No audio for deduction success/failure, encounter reactions, or ability activation.

## 9. Feels Vulnerable

- SFX is triggered inside Immer `set()` callbacks. If Immer ever changes to batch or defer mutations, the audio timing could shift. More importantly, if a `set()` call is rolled back (e.g., by a middleware), the SFX would have already played.
- The SFX cache is never cleared. In a long session with many different SFX events, all Howl instances stay in memory. With only 9 events this is fine, but the pattern doesn't scale.
- `AmbientAudio` uses `eslint-disable-next-line react-hooks/exhaustive-deps` to suppress a warning about `ambientVolume` not being in the effect dependency array. This is intentional (volume changes are handled by a separate effect) but fragile — a future refactor could break the separation.

## 10. Feels Like Bad Design

- Playing SFX inside store slice `set()` callbacks mixes state mutation with side effects. The Zustand/Immer `set()` callback should be pure state transformation. Audio should be triggered via a middleware, subscription, or post-mutation callback.
- The `clue-${clueType}` SFX event is constructed via string interpolation and cast to `SfxEvent`: `const sfxEvent: SfxEvent = \`clue-\${clueType}\` as SfxEvent`. This bypasses type safety — if a new `ClueType` is added without a corresponding SFX path, the cast hides the error.
- `AmbientAudio` constructs the audio URL using `import.meta.env.BASE_URL` inline. This duplicates the URL construction logic from `narrativeEngine.fetchJson`. A shared URL helper would be more maintainable.
