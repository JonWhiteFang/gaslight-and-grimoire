/**
 * Actions interface passed to impure engine functions.
 * Breaks the engine → store circular dependency.
 */
import type { Faculty, Investigator } from '../types';

export interface EngineActions {
  adjustComposure: (delta: number) => void;
  adjustVitality: (delta: number) => void;
  setFlag: (key: string, value: boolean | string) => void;
  adjustDisposition: (npcId: string, delta: number) => void;
  adjustSuspicion: (npcId: string, delta: number) => void;
  adjustReputation: (faction: string, delta: number) => void;
  discoverClue: (clueId: string) => void;
  goToScene: (sceneId: string) => void;
  updateFaculty: (faculty: Faculty, value: number) => void;
  investigator: Investigator;
}
