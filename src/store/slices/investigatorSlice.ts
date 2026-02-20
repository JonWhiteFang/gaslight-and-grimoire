import type { StateCreator } from 'zustand';
import type { GameStore } from '../types';
import type { Faculty, Investigator } from '../../types';

export interface InvestigatorSlice {
  investigator: Investigator;
  initInvestigator: (investigator: Investigator) => void;
  updateFaculty: (faculty: Faculty, value: number) => void;
  adjustComposure: (delta: number) => void;
  adjustVitality: (delta: number) => void;
  useAbility: () => void;
  resetAbility: () => void;
}

const defaultInvestigator: Investigator = {
  name: '',
  archetype: 'deductionist',
  faculties: {
    reason: 8,
    perception: 8,
    nerve: 8,
    vigor: 8,
    influence: 8,
    lore: 8,
  },
  composure: 10,
  vitality: 10,
  abilityUsed: false,
};

export const createInvestigatorSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  InvestigatorSlice
> = (set) => ({
  investigator: defaultInvestigator,

  initInvestigator: (investigator) =>
    set((state) => {
      state.investigator = investigator;
    }),

  updateFaculty: (faculty, value) =>
    set((state) => {
      state.investigator.faculties[faculty] = value;
    }),

  adjustComposure: (delta) =>
    set((state) => {
      state.investigator.composure = Math.max(
        0,
        Math.min(10, state.investigator.composure + delta),
      );
    }),

  adjustVitality: (delta) =>
    set((state) => {
      state.investigator.vitality = Math.max(
        0,
        Math.min(10, state.investigator.vitality + delta),
      );
    }),

  useAbility: () =>
    set((state) => {
      state.investigator.abilityUsed = true;
    }),

  resetAbility: () =>
    set((state) => {
      state.investigator.abilityUsed = false;
    }),
});
