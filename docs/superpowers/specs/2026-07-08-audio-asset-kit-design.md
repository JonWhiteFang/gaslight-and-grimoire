# Design — Audio Asset Generation Kit

_Gaslight & Grimoire · Issue #20 (media assets), audio-only scope · 2026-07-08_

## Summary

Produce a generation-ready **prompt kit + asset manifest** for the 19 AI-generated audio
files the game's already-complete audio pipeline expects, plus lightweight repo tooling to
validate their presence and document how they're regenerated.

The audio playback code (`audioManager.ts`, `AmbientAudio.tsx`, `audioSubscription.ts`) is
**already complete and requires no changes**. The game currently runs silent because the
`.mp3` files don't exist — Howler silently tolerates missing files. This project fills that
gap with a documented, reproducible generation process.

**Illustrations are explicitly out of scope for now.** `SceneIllustration` renders nothing
when `scene.illustration` is undefined (the current state of all 198 scenes), so deferring
art requires zero code change. It can be picked up as a separate milestone later.

**The deliverable is documentation + a validator, not the audio files themselves.** I author
the specs; the user runs the prompts through the generation tools and drops the resulting
files into `public/audio/`.

## Scope

**In scope — 19 assets, SFX first:**

- **9 SFX** → `public/audio/sfx/` — `dice-roll`, `clue-physical`, `clue-testimony`,
  `clue-occult`, `clue-deduction`, `clue-red-herring`, `composure-decrease`,
  `vitality-decrease`, `scene-transition`
- **10 ambient loops** → `public/audio/ambient/` — `ambient-whitechapel-night`,
  `ambient-london-day`, `ambient-printshop`, `ambient-cellar`, `ambient-study`,
  `ambient-mayfair-evening`, `ambient-mayfair-night`, `ambient-seance`,
  `ambient-thames-night`, `ambient-southwark-night`

SFX first: they're short, self-contained, low-risk to generate/loop, and deliver the biggest
immediate "the game reacts to me" payoff. Ambient beds (seamless looping, tonal consistency)
come second, once the generation pipeline is validated on the easier assets.

**Out of scope:**

- Illustrations / any visual assets (deferred; no code change needed to defer)
- Changes to the audio playback engine (verified complete)
- Building an automated API-calling pipeline (chosen approach is a prompt kit the user runs
  manually — no API keys, billing, or live external dependency in the repo)

## Sonic house style

**Direction: naturalistic Victorian period ambience** — diegetic, grounded, never campy.
Realism is the point: it makes the supernatural land harder when it intrudes. This mirrors
the project's narrative-tone mandate ("measured, atmospheric, never campy").

Global constraints baked into every prompt:

- **No music, no melody, no modern instrumentation** in ambient beds — environmental sound
  only (room tone, weather, distant city, fire, clocks).
- **No voices / no words** — muffled, indistinct crowd murmur is acceptable; intelligible
  speech is not.
- **Restraint over drama** — low, sustained, textural. Occult locations (`cellar`, `seance`)
  earn unease through natural means (a room too quiet, a draft, a single ambiguous creak)
  rather than horror-movie stingers.
- **Period-accurate palette** — gas-lamp hiss, coal fires, hansom cabs on cobbles, rain on
  glass, ticking clocks, rustling paper, distant Thames/dock sounds. No cars, no electrical
  hum, no synths.

**SFX corollary:** grounded physical sounds — paper rustle (testimony), a struck match /
faint chime-of-realization (deduction), dice as real bone/wood on a wooden table. The occult
clue stinger is the **one** place a hint of the supernatural is allowed to leak through (a
resonant "wrongness").

## Per-asset generation spec

Each of the 19 assets gets a manifest entry with these fields:

| Field | Purpose |
|---|---|
| `filename` | exact output name — must match the hardcoded engine paths (e.g. `clue-red-herring.mp3`, `ambient-cellar.mp3`) |
| `tool` | ElevenLabs SFX for the 9 stingers; Stable Audio / Suno for the 10 ambient loops |
| `prompt` | the exact text to paste into the generation tool |
| `duration` | SFX 0.5–2 s; ambient 30–60 s designed to loop |
| `loudness / format` | mp3; target ~-18 LUFS for ambient, ~-14 LUFS for SFX so nothing clips or drowns the on-screen text, and SFX sit above the beds |
| `loop notes` | ambient only — "seamless loop, no distinct start/end event, fade-safe" (the engine cross-fades over 1 s) |
| `trigger` | where it fires in-game (documented from the traced wiring) so future maintainers know what each asset is *for* |

**Two loudness tiers** because the engine plays the streams at different defaults
(`audioVolume.ambient = 0.6`, `audioVolume.sfx = 0.8`) and layers SFX *over* the beds. The
spec's loudness targets keep that mix balanced without needing per-file volume code.

### Filename ↔ engine-path reference (must match exactly)

SFX (`SFX_PATHS` in `src/engine/audioManager.ts`):

| Event | File |
|---|---|
| `dice-roll` | `/audio/sfx/dice-roll.mp3` |
| `clue-physical` | `/audio/sfx/clue-physical.mp3` |
| `clue-testimony` | `/audio/sfx/clue-testimony.mp3` |
| `clue-occult` | `/audio/sfx/clue-occult.mp3` |
| `clue-deduction` | `/audio/sfx/clue-deduction.mp3` |
| `clue-redHerring` | `/audio/sfx/clue-red-herring.mp3` |
| `composure-decrease` | `/audio/sfx/composure-decrease.mp3` |
| `vitality-decrease` | `/audio/sfx/vitality-decrease.mp3` |
| `scene-transition` | `/audio/sfx/scene-transition.mp3` |

Ambient (`AmbientAudio.tsx` builds `/audio/ambient/{ambientAudio}.mp3` from the scene field):
the 10 distinct `ambientAudio` values currently referenced in content JSON map 1:1 to files
named `ambient-*.mp3`.

## Repo tooling & validation

- **`scripts/checkAudioAssets.mjs`** — lists the 19 expected files and reports present/missing.
  Cross-checks the ambient set against the `ambientAudio` values actually referenced in
  `public/content/**` so a renamed or newly-added track can't silently go missing.
  Non-failing by default (the game runs silent gracefully); a `--strict` flag turns it into a
  hard gate for a future "audio complete" milestone.
- **The prompt kit** lives at `docs/audio-asset-kit.md` — the full manifest, all 19 prompts,
  tool links, post-processing notes (trim, normalize, loop-point check), and a "how to
  regenerate" section. This doc doubles as regeneration documentation.
- **No changes** to `audioManager.ts`, `AmbientAudio.tsx`, or `audioSubscription.ts` — all
  verified complete and unchanged.

## Testing & validation

Audio is perceptual and `Howl` is mocked under jsdom, so validation is layered rather than
attempting to unit-test playback:

- **`checkAudioAssets.mjs`** — the mechanical gate: all 19 files present, correctly named, in
  the right directories, and every `ambientAudio` value referenced in content JSON has a
  matching file. This is the automatable check.
- **One unit test** for the checker's manifest-vs-content cross-reference logic (a pure
  function: does the set of content-referenced ambient names equal the manifest's ambient
  set?). Catches drift if content adds a new location later.
- **Manual QA checklist** (documented in the kit): load each case; confirm each bed loops
  seamlessly with no click at the 1 s cross-fade; trigger every SFX (roll dice, discover each
  clue type, take composure/vitality damage, change scenes); confirm SFX sits above the bed
  and nothing clips.
- **No new engine tests** — playback code is already covered and unchanged; testing there
  would test Howler, not our code.

The existing **491-test / 46-file** baseline stays green: we add a script + one small test and
touch no engine code.

## Files touched

**New:**

- `docs/audio-asset-kit.md` — the prompt kit / manifest / regeneration guide
- `scripts/checkAudioAssets.mjs` — presence + content-cross-reference validator
- `scripts/__tests__/checkAudioAssets.test.ts` (or co-located) — unit test for the
  cross-reference logic
- `public/audio/sfx/` and `public/audio/ambient/` — directories the user populates with the
  generated `.mp3` files (may hold a `.gitkeep` until files land)

**Unchanged (verified complete):**

- `src/engine/audioManager.ts`, `src/components/AmbientAudio/AmbientAudio.tsx`,
  `src/store/audioSubscription.ts`

## Open questions / follow-ups

- Whether to wire `checkAudioAssets.mjs` into CI (`deploy.yml`) as a non-blocking informational
  step now, or defer until the audio-complete `--strict` milestone. (Leaning: defer — a
  non-blocking check adds noise without a gate.)
- Illustration milestone remains open as a future, separate spec.
