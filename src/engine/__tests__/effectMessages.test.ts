import { describe, it, expect } from 'vitest';
import { generateEffectMessage, generateEffectMessages } from '../effectMessages';
import type { Effect, NPCState } from '../../types';

const npcs: Record<string, NPCState> = {
  'npc-graves': {
    id: 'npc-graves',
    name: 'Inspector Graves',
    faction: 'Rationalists Circle',
    disposition: 2,
    suspicion: 0,
    memoryFlags: {},
    isAlive: true,
    isAccessible: true,
  },
};

describe('generateEffectMessage', () => {
  it('returns null for flag effects', () => {
    expect(generateEffectMessage({ type: 'flag', target: 'x', value: true }, npcs)).toBeNull();
  });

  it('returns null for discoverClue effects', () => {
    expect(generateEffectMessage({ type: 'discoverClue', target: 'c1' }, npcs)).toBeNull();
  });

  it('returns null when delta is undefined', () => {
    expect(generateEffectMessage({ type: 'composure' }, npcs)).toBeNull();
  });

  it('composure negative', () => {
    expect(generateEffectMessage({ type: 'composure', delta: -1 }, npcs))
      .toBe('A chill settles over you (Composure -1)');
  });

  it('composure positive', () => {
    expect(generateEffectMessage({ type: 'composure', delta: 2 }, npcs))
      .toBe('You steady yourself (Composure +2)');
  });

  it('vitality negative', () => {
    expect(generateEffectMessage({ type: 'vitality', delta: -2 }, npcs))
      .toBe('You feel a sharp sting (Vitality -2)');
  });

  it('vitality positive', () => {
    expect(generateEffectMessage({ type: 'vitality', delta: 1 }, npcs))
      .toBe('Renewed vigour courses through you (Vitality +1)');
  });

  it('disposition positive with NPC name resolution', () => {
    expect(generateEffectMessage({ type: 'disposition', target: 'npc-graves', delta: 2 }, npcs))
      .toBe('Inspector Graves regards you with newfound respect (Disposition +2)');
  });

  it('disposition negative with NPC name resolution', () => {
    expect(generateEffectMessage({ type: 'disposition', target: 'npc-graves', delta: -2 }, npcs))
      .toBe('Inspector Graves grows cold toward you (Disposition -2)');
  });

  it('disposition falls back to target id when NPC not found', () => {
    expect(generateEffectMessage({ type: 'disposition', target: 'npc-unknown', delta: 1 }, npcs))
      .toBe('npc-unknown regards you with newfound respect (Disposition +1)');
  });

  it('suspicion positive', () => {
    expect(generateEffectMessage({ type: 'suspicion', target: 'npc-graves', delta: 1 }, npcs))
      .toBe('Inspector Graves eyes you more carefully (Suspicion +1)');
  });

  it('suspicion negative', () => {
    expect(generateEffectMessage({ type: 'suspicion', target: 'npc-graves', delta: -1 }, npcs))
      .toBe('Inspector Graves seems to relax (Suspicion -1)');
  });

  it('reputation', () => {
    expect(generateEffectMessage({ type: 'reputation', target: 'Lamplighters', delta: 1 }, npcs))
      .toBe('Your standing with Lamplighters shifts (Reputation +1)');
  });

  it('uses authored description when present', () => {
    const effect: Effect = { type: 'composure', delta: -1, description: 'The crypt air bites deep' };
    expect(generateEffectMessage(effect, npcs))
      .toBe('The crypt air bites deep (Composure -1)');
  });
});

describe('generateEffectMessages', () => {
  it('filters out null messages', () => {
    const effects: Effect[] = [
      { type: 'composure', delta: -1 },
      { type: 'flag', target: 'visited', value: true },
      { type: 'disposition', target: 'npc-graves', delta: 2 },
    ];
    const msgs = generateEffectMessages(effects, npcs);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('Composure');
    expect(msgs[1]).toContain('Inspector Graves');
  });
});
