import type { ArchetypeDefinition } from '../types';

export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'deductionist',
    name: 'Deductionist',
    description:
      'A master of logical inference who reads crime scenes like open books. Where others see chaos, you see patterns.',
    bonuses: { reason: 3, perception: 1 },
    ability: {
      name: 'Elementary',
      description: 'Automatically succeed on a Reason check to connect two clues.',
      faculty: 'reason',
      context: 'connect two clues',
    },
  },
  {
    id: 'occultist',
    name: 'Occultist',
    description:
      'A scholar of forbidden knowledge who walks the boundary between the rational and the arcane.',
    bonuses: { lore: 3, perception: 1 },
    ability: {
      name: 'Veil Sight',
      description: 'Reveal hidden supernatural elements in the current scene.',
      faculty: 'lore',
      context: 'reveal supernatural scene elements',
    },
  },
  {
    id: 'operator',
    name: 'Operator',
    description:
      'A street-hardened survivor who relies on physical prowess and underworld connections to get results.',
    bonuses: { vigor: 3, nerve: 1 },
    ability: {
      name: 'Street Survivor',
      description: 'Automatically succeed on a Vigor check to escape a dangerous situation.',
      faculty: 'vigor',
      context: 'escape danger',
    },
  },
  {
    id: 'mesmerist',
    name: 'Mesmerist',
    description:
      'A silver-tongued manipulator who bends minds and reads people with uncanny precision.',
    bonuses: { influence: 3, nerve: 1 },
    ability: {
      name: 'Silver Tongue',
      description: 'Automatically succeed on an Influence check during interrogation or negotiation.',
      faculty: 'influence',
      context: 'interrogation or negotiation',
    },
  },
];

export const FACULTY_LABELS: Record<string, string> = {
  reason: 'Reason',
  perception: 'Perception',
  nerve: 'Nerve',
  vigor: 'Vigor',
  influence: 'Influence',
  lore: 'Lore',
};

export const FACULTIES = ['reason', 'perception', 'nerve', 'vigor', 'influence', 'lore'] as const;

export const BASE_FACULTY_SCORE = 8;
export const BONUS_POINTS_TOTAL = 12;
