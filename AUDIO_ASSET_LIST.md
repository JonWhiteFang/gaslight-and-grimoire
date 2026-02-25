# Audio Asset List — Gaslight & Grimoire

All files go in `public/audio/`. Format: MP3 preferred (smaller for browser delivery).

## SFX → `public/audio/sfx/`

Short sound effects (0.5–2 seconds).

| File | Trigger | Mood/Description |
|---|---|---|
| `dice-roll.mp3` | Faculty check performed | Tactile dice clatter on wood |
| `clue-physical.mp3` | Physical clue discovered | Paper rustle or object pickup |
| `clue-testimony.mp3` | Testimony clue discovered | Soft murmur or quill scratch |
| `clue-occult.mp3` | Occult clue discovered | Eerie whisper or resonant chime |
| `clue-deduction.mp3` | Deduction clue discovered | Satisfying "click" or insight tone |
| `clue-red-herring.mp3` | Red herring discovered | Subtle discordant note |
| `composure-decrease.mp3` | Composure drops | Unsettling heartbeat or gasp |
| `vitality-decrease.mp3` | Vitality drops | Dull impact or wince |
| `scene-transition.mp3` | Scene changes | Soft page turn or footsteps fading |

## Ambient Loops → `public/audio/ambient/`

Seamless loops (30–60 seconds). Howler plays these with `loop: true` and cross-fades between tracks on scene change.

| File | Used In | Mood/Description |
|---|---|---|
| `ambient-whitechapel-night.mp3` | Whitechapel Cipher Act 1, variants | Foggy streets, distant footsteps, gas lamp hiss |
| `ambient-london-day.mp3` | Whitechapel Cipher Act 2 | Daytime bustle, carriages, street vendors |
| `ambient-printshop.mp3` | Whitechapel Cipher Act 2 | Mechanical press rhythm, paper shuffle |
| `ambient-study.mp3` | Whitechapel Cipher Act 2 | Crackling fire, ticking clock, quiet room |
| `ambient-cellar.mp3` | Whitechapel Cipher Act 3, Mayfair Séance Act 3 | Dripping water, stone echo, oppressive silence |
| `ambient-mayfair-evening.mp3` | Mayfair Séance Act 1, variants | Upscale parlour, muffled conversation, clinking glass |
| `ambient-mayfair-night.mp3` | Mayfair Séance Act 3 | Quiet affluent street, wind, distant church bell |
| `ambient-seance.mp3` | Mayfair Séance Act 2 | Low drone, candle flicker, tense breathing |
| `ambient-thames-night.mp3` | A Matter of Shadows | River lapping, creaking wood, foghorn |
| `ambient-southwark-night.mp3` | A Matter of Shadows | Rougher district, rats, distant shouts |

## Summary

- **9** SFX files
- **10** ambient loops
- **19** total audio files
