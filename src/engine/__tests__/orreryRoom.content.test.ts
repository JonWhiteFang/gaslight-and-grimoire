/**
 * Orrery Room content witness tests — structural guards over the REAL shipped
 * JSON (spec §4/§5/§3.10). These are GREEN-on-arrival regression guards: they
 * pin the keystone gating chain (sole source / sole inbound edge / Phase 5
 * disabled-with-reason), the three-ending shelf, the clamp-safe effect
 * ordering, and the keystone recipe's onForm contract, so a future content
 * edit can't silently break the Mythos thread's confirmation node.
 */
import { describe, it, expect } from 'vitest';
import { choiceGateConditions, resolveChoiceVisibility } from '../choiceVisibility';
import type { Choice, GameState, KeyDeduction, SceneNode } from '../../types';
import scenesFile from '../../../public/content/side-cases/the-orrery-room/scenes.json';
import variantsFile from '../../../public/content/side-cases/the-orrery-room/variants.json';
import deductionsFile from '../../../public/content/side-cases/the-orrery-room/deductions.json';

const scenes = (scenesFile as { scenes: SceneNode[] }).scenes;
const variants = (variantsFile as { variants: SceneNode[] }).variants;
const recipes = (deductionsFile as { deductions: KeyDeduction[] }).deductions;

const allScenes = [...scenes, ...variants];
const sceneById = (id: string): SceneNode => {
  const s = allScenes.find((x) => x.id === id);
  if (!s) throw new Error(`scene ${id} not found`);
  return s;
};
const allChoices = allScenes.flatMap((s) =>
  (s.choices ?? []).map((c) => ({ sceneId: s.id, choice: c as Choice })),
);

/** Minimal GameState stub — the same shape choiceVisibility.test.ts uses. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      archetype: 'detective',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    },
    clues: {},
    deductions: {},
    flags: {},
    npcs: {},
    factionReputation: {},
    ...overrides,
  } as unknown as GameState;
}

const KEYSTONE_CLUE = 'or-clue-orrery-period';
const COMPARISON = 'or-act1-period-match';
const ENDINGS = [
  'or-act2-ending-destroyed',
  'or-act2-ending-enshrined',
  'or-act2-ending-sealed',
] as const;

describe('keystone gating chain (spec §4/§5)', () => {
  it('the comparison scene is the keystone clue\'s SOLE source', () => {
    for (const s of allScenes) {
      const inClues = (s.cluesAvailable ?? []).some((d) => d.clueId === KEYSTONE_CLUE);
      const inOnEnter = (s.onEnter ?? []).some(
        (e) => e.type === 'discoverClue' && e.target === KEYSTONE_CLUE,
      );
      expect(inClues, `${s.id} must not list the keystone clue in cluesAvailable`).toBe(false);
      if (s.id === COMPARISON) {
        expect(inOnEnter, 'comparison scene grants the clue via onEnter').toBe(true);
      } else {
        expect(inOnEnter, `${s.id} must not grant the keystone clue`).toBe(false);
      }
    }
  });

  it('the flag-gated choice is the comparison scene\'s sole inbound edge', () => {
    const inbound = allChoices.filter(({ choice }) =>
      Object.values(choice.outcomes ?? {}).includes(COMPARISON),
    );
    expect(inbound.map(({ choice }) => choice.id)).toEqual(['or-choice-hub-period-match']);
    expect(inbound[0].choice.requiresFlag).toBe('mythos-period-computed');
  });

  it('keystone choice is disabled-with-reason flagless, selectable with the flag', () => {
    const choice = sceneById('or-act1-orrery-room').choices.find(
      (c) => c.id === 'or-choice-hub-period-match',
    ) as Choice;
    expect(choice.visibility).toBe('disabled');
    expect(typeof choice.gateReason).toBe('string');
    expect((choice.gateReason as string).trim().length).toBeGreaterThan(0);

    expect(resolveChoiceVisibility(choice, makeState({ flags: {} }))).toBe('disabled');
    expect(
      resolveChoiceVisibility(choice, makeState({ flags: { 'mythos-period-computed': true } })),
    ).toBe('shown');
  });

  it('the orrery-room hub always carries ungated choices (no soft-lock)', () => {
    const hub = sceneById('or-act1-orrery-room');
    const ungated = hub.choices.filter((c) => choiceGateConditions(c as Choice).length === 0);
    expect(ungated.length).toBeGreaterThanOrEqual(1);
    // Current shape: rooms/finch/gallery ungated; onward is clue-gated; keystone flag-gated.
    expect(ungated.length).toBe(3);
  });

  it('the keystone recipe carries the onForm persistent flag', () => {
    const keystone = recipes.find((r) => r.id === 'mythos-pattern-named');
    expect(keystone).toBeDefined();
    expect(keystone!.onForm).toEqual([
      { type: 'flag', target: 'mythos-pattern-named', value: true },
    ]);
    expect(keystone!.requiredClues).toContain(KEYSTONE_CLUE);
  });
});

describe('endings (spec §3.10)', () => {
  it('all three endings exist, are terminal, and set or-case-complete', () => {
    for (const id of ENDINGS) {
      const s = sceneById(id);
      expect(s.choices, `${id} is terminal`).toEqual([]);
      expect(s.onEnter).toContainEqual({ type: 'flag', target: 'or-case-complete', value: true });
    }
  });

  it('two partisan endings are reachable via ungated verdict choices (flagless completability)', () => {
    const hub = sceneById('or-act2-verdict-hub');
    for (const target of ['or-act2-ending-destroyed', 'or-act2-ending-enshrined']) {
      const route = hub.choices.find(
        (c) =>
          choiceGateConditions(c as Choice).length === 0 &&
          Object.values(c.outcomes ?? {}).includes(target),
      );
      expect(route, `ungated route to ${target}`).toBeTruthy();
    }
  });

  it('the brokered ending is gated on the genuine-instrument deduction', () => {
    const broker = sceneById('or-act2-verdict-hub').choices.find(
      (c) => c.id === 'or-choice-verdict-broker',
    ) as Choice;
    expect(broker.requiresDeduction).toBe('or-genuine-instrument');
    // Default hidden: no visibility field — an unearned verdict doesn't advertise itself.
    expect(broker.visibility).toBeUndefined();
  });

  it('disposition effects precede the reputation effect in every ending (clamp-ordering rule)', () => {
    for (const id of ENDINGS) {
      const types = (sceneById(id).onEnter ?? []).map((e) => e.type);
      const lastDisposition = types.lastIndexOf('disposition');
      const firstReputation = types.indexOf('reputation');
      expect(lastDisposition, `${id} has disposition effects`).toBeGreaterThanOrEqual(0);
      expect(firstReputation, `${id} has a reputation effect`).toBeGreaterThanOrEqual(0);
      expect(lastDisposition, `${id}: dispositions before reputation`).toBeLessThan(firstReputation);
    }
  });

  it('each ending has a keystone-named variant gated on hasDeduction, effects identical', () => {
    for (const id of ENDINGS) {
      const v = variants.find((x) => x.variantOf === id);
      expect(v, `variant of ${id}`).toBeTruthy();
      expect(v!.variantCondition).toEqual({ type: 'hasDeduction', target: 'mythos-pattern-named' });
      expect(v!.choices).toEqual([]);
      expect(v!.onEnter).toEqual(sceneById(id).onEnter);
    }
  });
});
