# Audio Asset Kit — Gaslight & Grimoire

> Generation-ready prompt kit for the 19 audio assets the game's (already-complete) audio
> pipeline expects. Author: run each prompt through the recommended tool, post-process to the
> stated targets, and drop the file into `public/audio/` under the exact filename given.
>
> **Design spec:** [`docs/superpowers/specs/2026-07-08-audio-asset-kit-design.md`](superpowers/specs/2026-07-08-audio-asset-kit-design.md)
>
> **Status:** prompt kit authored; 9 SFX shipped (`public/audio/sfx/`); 10 ambient loops pending. Illustrations parked (see spec).

---

## House style (applies to every prompt)

Naturalistic Victorian period ambience — diegetic, grounded, **never campy**. Realism is the
point: it makes the supernatural land harder when it intrudes.

Baked into every prompt:

- **No music, no melody, no modern instrumentation** in ambient beds — environmental sound only.
- **No voices / no words.** Muffled, indistinct crowd murmur is fine; intelligible speech is not.
- **Restraint over drama** — low, sustained, textural.
- **Period-accurate palette** — gas-lamp hiss, coal fires, hansom cabs on cobbles, rain on
  glass, ticking clocks, rustling paper, distant Thames/dock sounds. No cars, no electrical
  hum, no synths.
- The occult clue stinger and the `cellar` / `seance` beds are the **only** places a hint of
  the supernatural may leak through — and even then through *natural* means (a room too quiet,
  a draft, an ambiguous creak, a faint resonant "wrongness").

## Format & loudness targets

| Stream | Format | Duration | Loudness target | Notes |
|---|---|---|---|---|
| SFX | mp3 | 0.5–2 s | ~-14 LUFS | Sits *above* the ambient bed. Trim silence at head; short natural tail. |
| Ambient | mp3 | 30–60 s | ~-18 LUFS | Seamless loop, no distinct start/end event. Engine cross-fades 1 s. |

Engine defaults: `audioVolume.ambient = 0.6`, `audioVolume.sfx = 0.8`. The two loudness tiers
keep SFX audible over the beds without per-file volume code.

## Post-processing checklist (every file)

1. **Trim** — remove leading silence; SFX get a short natural tail, not an abrupt cut.
2. **Normalize** to the stream's LUFS target (above). Peak-limit to ≤ -1 dBFS to avoid clipping.
3. **Ambient loop check** — render the loop twice back-to-back and listen across the seam.
   No click, no perceptible restart, no distinct event that "announces" the loop point.
4. **Export** as mp3 (constant or high-quality VBR is fine), mono or stereo.
5. **Name exactly** as the table specifies and place in the correct directory. Filenames are
   matched literally by the engine — a typo means silent failure.

---

## SFX (9) → `public/audio/sfx/`

Recommended tool: **ElevenLabs SFX** (or similar text-to-SFX). These are short, one-shot.

> Note the naming asymmetry: the in-engine event is `clue-redHerring` (camelCase) but the
> **file** is `clue-red-herring.mp3` (kebab-case). Use the filename in the table.

### `dice-roll.mp3`
- **Trigger:** a faculty check resolves (first non-null `lastCheckResult`).
- **Duration:** ~1 s.
- **Prompt:**
  > A pair of bone or wooden dice tumbling and settling on a bare wooden table. Dry, close-mic'd,
  > tactile clatter with a short natural settle. No room reverb, no music. Single quick roll.

### `clue-physical.mp3`
- **Trigger:** a `physical`-type clue is revealed.
- **Duration:** ~1 s.
- **Prompt:**
  > A small physical object being picked up and examined on a desk — a faint scrape, the soft
  > tap of an item set down, a brief handling of an object. Understated, diegetic, no music.

### `clue-testimony.mp3`
- **Trigger:** a `testimony`-type clue is revealed.
- **Duration:** ~1–1.5 s.
- **Prompt:**
  > A single sheet of paper being turned and lightly rustled, as if noting down a witness's
  > words. Dry, close, intimate. A soft page handle, nothing else. No voices, no music.

### `clue-occult.mp3`
- **Trigger:** an `occult`-type clue is revealed. **The one place the supernatural may show.**
- **Duration:** ~1.5–2 s.
- **Prompt:**
  > A low, resonant sense of wrongness — a brief, dry, almost sub-audible swell as if the air
  > itself tenses, with a faint metallic shimmer that fades quickly. Uncanny but restrained; no
  > horror-movie sting, no melody, no obvious synth. Ambiguous and cold.

### `clue-deduction.mp3`
- **Trigger:** a `deduction`-type clue is revealed.
- **Duration:** ~1–1.5 s.
- **Prompt:**
  > The soft strike and catch of a match, resolving into a faint, clear, single chime of
  > realization — the sound of a thought clicking into place. Warm, dry, brief. No music bed.

### `clue-red-herring.mp3`  *(event: `clue-redHerring`)*
- **Trigger:** a `redHerring`-type clue is revealed.
- **Duration:** ~1–1.5 s.
- **Prompt:**
  > A subtly hollow, slightly-off version of a clue discovery — a soft object-handling sound
  > that ends on a faint dull, deflating note, hinting the lead is false without being comic.
  > Dry, understated. No music, no cartoon sting.

### `composure-decrease.mp3`
- **Trigger:** the investigator's composure drops.
- **Duration:** ~1.5 s.
- **Prompt:**
  > A short, cold intake — a faint, low tension in the room, like a held breath or a distant
  > draft passing through. Unsettling and internal, not loud. No music, no jump-scare.

### `vitality-decrease.mp3`
- **Trigger:** the investigator's vitality drops.
- **Duration:** ~1 s.
- **Prompt:**
  > A dull, physical impact felt in the body — a muffled thud with a short low-end weight, as of
  > a blow or a hard stumble. Grounded and blunt, no music, no reverb tail.

### `scene-transition.mp3`
- **Trigger:** the current scene changes.
- **Duration:** ~1 s.
- **Prompt:**
  > A soft, brief transitional whoosh of air, like turning a heavy page or moving between rooms
  > — a gentle low sweep that settles quickly. Subtle; it should not draw attention. No music.

---

## Ambient loops (10) → `public/audio/ambient/`

Recommended tool: **Stable Audio** or **Suno** (instrumental/ambient mode). Each must loop
seamlessly. **No melody, no instruments** — environmental beds only. Files are named
`ambient-*.mp3` to match the `ambientAudio` values in content JSON.

### `ambient-whitechapel-night.mp3`
- **Used by:** Whitechapel Cipher (act 1, act 2 street scenes, variants), Lamplighter's Wake,
  Debt of Smoke.
- **Prompt:**
  > A cold, damp Victorian slum street at night. Distant hansom-cab wheels on wet cobbles, a
  > faint gas-lamp hiss nearby, occasional far-off dripping water and a distant dog, thin wind
  > down a narrow alley. Bleak, sparse, low. No music, no voices, no melody. Seamless 45-second
  > loop.

### `ambient-london-day.mp3`
- **Used by:** Whitechapel Cipher act 2, Lamplighter's Wake act 2, Unfinished Case, variants.
- **Prompt:**
  > A busy Victorian London street by day, heard from a step back. A steady wash of distant
  > crowd murmur (no distinct words), horse-drawn traffic on cobbles, occasional far-off cart
  > and church bell. Bustling but muted, non-intrusive. No music, no melody. Seamless 45-second
  > loop.

### `ambient-printshop.mp3`
- **Used by:** Whitechapel Cipher act 2 (the print shop).
- **Prompt:**
  > The interior of a small Victorian print shop. The rhythmic mechanical clack and creak of a
  > hand-operated printing press, a faint hiss of a gas lamp, soft shuffling of paper. Enclosed,
  > working, slightly oppressive. No music, no voices. Seamless 40-second loop with the press
  > rhythm phased so the loop point is not obvious.

### `ambient-cellar.mp3`
- **Used by:** Whitechapel Cipher act 2/3 (cellar, climax), Mayfair Séance act 3, Lamplighter's
  Wake act 3. **May carry faint unease.**
- **Prompt:**
  > A cold stone cellar underground. Deep, still room tone, slow distant water drips echoing off
  > stone, a faint low draft, a single ambiguous creak of settling timber. Claustrophobic and
  > too quiet — a subtle sense of being watched, achieved naturally, not with music. No melody,
  > no synth pad. Seamless 50-second loop.

### `ambient-study.mp3`
- **Used by:** Whitechapel Cipher act 2 (a study), Rationalist's Dilemma.
- **Prompt:**
  > A quiet Victorian study or office at night. A steady ticking mantel clock, a soft coal-fire
  > crackle, the faint hiss of a gas lamp, rare creak of a leather chair. Warm, contained,
  > scholarly, calm. No music, no voices. Seamless 45-second loop.

### `ambient-mayfair-evening.mp3`
- **Used by:** Mayfair Séance act 1 and variants.
- **Prompt:**
  > An affluent Mayfair townhouse on a genteel evening. Very faint distant refined party murmur
  > behind walls (no words), a ticking clock, soft fire crackle, the occasional distant carriage
  > outside. Comfortable, hushed, well-to-do. No music, no melody. Seamless 45-second loop.

### `ambient-mayfair-night.mp3`
- **Used by:** Mayfair Séance act 3.
- **Prompt:**
  > A grand Mayfair townhouse late at night, emptied of guests. Deep quiet, a slow ticking
  > clock, the settle and creak of a large house, a faint wind at tall windows, distant fading
  > street sounds. Still, heavy, a little uneasy. No music, no voices. Seamless 50-second loop.

### `ambient-seance.mp3`
- **Used by:** Mayfair Séance act 2 (the séance) and variants. **May carry faint unease.**
- **Prompt:**
  > A darkened Victorian parlour set for a séance. Near silence, the low flutter of candle
  > flames, a faint draft, the soft creak of chairs, the occasional almost-imperceptible
  > resonant hum in the air that could be nerves or something more. Tense, expectant, restrained
  > — unease from stillness, not stingers. No music, no melody, no voices. Seamless 50-second
  > loop.

### `ambient-thames-night.mp3`
- **Used by:** A Matter of Shadows (most scenes).
- **Prompt:**
  > The bank of the River Thames at night. Slow lapping water against stone and wood, a distant
  > ship's bell and low foghorn, creaking mooring ropes, a cold river wind, faint far-off dock
  > sounds. Wide, damp, lonely. No music, no voices. Seamless 50-second loop.

### `ambient-southwark-night.mp3`
- **Used by:** A Matter of Shadows (Southwark scene).
- **Prompt:**
  > A rough Southwark backstreet at night, near the river. Sparse footsteps on wet stone in the
  > distance, a low wind, faint dripping, a far-off tavern murmur behind closed doors (no words),
  > the occasional distant river sound. Grimy, dim, watchful. No music, no melody. Seamless
  > 45-second loop.

---

## Regeneration guide

To regenerate any asset: find its entry above, re-run the prompt through the recommended tool,
apply the post-processing checklist, and overwrite the file under the same name. The prompts are
the source of truth for the house style — keep edits to them in sync with the design spec's
"Sonic house style" section so the set stays cohesive.

If content later adds a **new** `ambientAudio` location, add a matching entry here (and a file),
then run `scripts/checkAudioAssets.mjs` (once built) to confirm the manifest and content agree.

## Manual QA checklist (after files land)

- [ ] All 9 SFX files present in `public/audio/sfx/` under exact names.
- [ ] All 10 ambient files present in `public/audio/ambient/` under exact names.
- [ ] Each ambient bed loops with no audible click/restart at the 1 s cross-fade seam.
- [ ] Dice-roll fires on a faculty check.
- [ ] Each clue stinger fires on discovering its clue type (physical/testimony/occult/deduction/
      red-herring).
- [ ] Composure-decrease and vitality-decrease fire on taking the respective damage.
- [ ] Scene-transition fires on moving between scenes.
- [ ] SFX are clearly audible *over* the ambient bed; nothing clips or overpowers the text.
- [ ] Occult stinger and cellar/seance beds feel uncanny but not campy.
