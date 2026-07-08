# ADR-0006: Media asset strategy — AI-generated audio, prompt-kit pipeline, illustrations parked

- **Status:** Accepted
- **Date:** 2026-07-08
- **Deciders:** Jon White (product), Claude (design/brainstorm)
- **Phase / stage:** Media assets (#20)

## Context

Media assets (#20) are the sole remaining pre-1.0 milestone. The audio playback pipeline
(`audioManager.ts`, `AmbientAudio.tsx`, `audioSubscription.ts`) and the illustration render path
(`SceneIllustration.tsx`) are **fully coded** but ship with **zero media files** — the game runs
silent and un-illustrated. Content JSON already references **10 distinct `ambientAudio` tracks**;
the engine expects **9 SFX** at fixed paths. No scene references an `illustration` yet (the field
is dormant across all 198 scenes).

PROJECT_STATE carried a standing open question — *"How do we source and license media assets?"* —
to be resolved via ADR. This session brainstormed it to a decision. A hard constraint shaped the
outcome: **the assistant cannot synthesize audio files directly**, so any "generate" path must
route file production through a tool the user runs.

## Decision

**Audio, AI-generated, via a prompt kit the user runs; illustrations deferred.**

1. **Source = AI generation** (not commissioned art or licensed packs) — full control over a
   cohesive house style, no licensing hunt, and the prompts double as regeneration docs.
2. **Scope = audio only.** 19 assets: 9 SFX first, then 10 ambient loops. Illustrations are
   **parked at lowest priority** until the user decides to pick them up (no code change to defer —
   `SceneIllustration` renders nothing when `illustration` is undefined).
3. **Pipeline = prompt kit, not an API integration.** The assistant authors `docs/audio-asset-kit.md`
   (per-asset prompts, tool recommendations, format/loudness targets, post-processing + QA
   checklists); the user runs the prompts through the tools (ElevenLabs SFX for stingers; Stable
   Audio/Suno for loops) and drops files into `public/audio/`. No API keys, billing, or live
   external dependency enter the repo.
4. **House style = naturalistic Victorian period ambience** — diegetic, grounded, never campy;
   the supernatural may leak through **only** at the occult clue stinger and the `cellar`/`seance`
   beds, and even then via natural means.
5. **Validation = a local `scripts/checkAudioAssets.mjs`** (presence + content-cross-reference),
   **not** wired into CI now — deferred until real files exist (likely as a `--strict` gate).

## Alternatives considered

- **CC0 / licensed stock:** authentic period feel, zero generation cost, but hard to make cohesive
  and time-consuming to vet licenses. Rejected in favour of a controllable house style.
- **Styled placeholders only (no real media):** fastest path to a polished-feeling 1.0, but leaves
  the game genuinely silent. Rejected — the goal is real audio.
- **Scripted API pipeline (e.g. ElevenLabs API):** repeatable, but adds an API key, billing, and a
  live external dependency to the repo for a one-off generation task. Rejected as over-engineered
  for the need.
- **Illustrations in scope now (per-location / key-scene / every-scene coverage):** deferred —
  the user chose text-only for now; art is a separate future milestone.
- **Scored / musical underscore or hybrid tonal beds:** more cinematic but risks melodrama and
  dates faster; conflicts with the "measured, never campy" mandate. Rejected for naturalism.

## Consequences

- **Positive:** cohesive, controllable sonic identity; no licensing/legal surface; prompts are
  self-documenting for regeneration; engine untouched (491-test baseline unaffected); illustration
  deferral is free (no code change). Smallest sensible first slice (SFX) de-risks the pipeline.
- **Negative / trade-offs:** file production depends on the user running tools by hand (not
  automated); AI-generated ambience needs a careful manual loop/loudness pass to avoid seams and
  clipping; the game stays un-illustrated until the parked milestone is revived.
- **Follow-ups:** (a) user generates the 19 files; (b) build `scripts/checkAudioAssets.mjs` + a unit
  test for its content-cross-reference logic; (c) manual QA pass per the kit checklist; (d) revisit
  CI wiring (`--strict`) once files land; (e) illustration milestone remains open, lowest priority.

## Links

- Related ADRs: builds on ADR-0001 (content↔engine separation — media are runtime assets under
  `public/`, engine stays pure); verification via ADR-0003 (Playwright MCP) at QA time.
- Planning docs: [design spec](../superpowers/specs/2026-07-08-audio-asset-kit-design.md);
  [the prompt kit](../audio-asset-kit.md).
- Commits / PRs: `f6bc29e` (spec), `42de32f` (decisions), `19908f9` (prompt kit).
