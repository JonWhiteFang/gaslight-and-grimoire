---
inclusion: always
---

# Product Overview

Gaslight & Grimoire is a browser-based choose-your-own-adventure game set in Victorian London where magic exists beneath the rational world. Players are investigators navigating branching mysteries that blend Sherlock Holmes-style deduction with D&D-style faculty checks and dice mechanics.

## Tone & Setting
- Gothic mystery: gaslit alleyways, occult conspiracies, moral grey areas
- Supernatural elements are a "slow burn" — rational investigation comes first, occult escalates gradually
- Victorian London is the persistent world; NPC relationships and faction reputation carry across cases

## Core Fantasy
"You are the only person in London clever enough — and perhaps reckless enough — to follow the trail of clues into the dark places where logic and the supernatural collide."

## Gameplay Loop
DISCOVER → CONNECT → ACT → REFLECT
1. Explore scenes, gather clues, question NPCs
2. Use the Evidence Board to link clues and form Deductions
3. Face pivotal choices informed by evidence; outcomes are shaped by what the player knows
4. Consequences persist — new leads emerge, relationships shift

## Design Rules for AI Assistance
- Clues grant mechanical Advantage: knowledge must have tangible gameplay impact
- No single Faculty should gate critical story progress — always provide alternate paths
- Choices must have meaningful consequences; avoid cosmetic-only branching
- NPC disposition and faction reputation are persistent state — treat them as first-class data
- Scene nodes are the atomic unit of narrative; each node has choices, conditions, and effects
- Deductions are derived from linked clues — never hardcoded outcomes
- Content lives in `/content/cases/` and `/content/side-cases/` as JSON; game logic lives in `/src/engine/`
- Keep narrative tone consistent: measured, atmospheric, never campy
