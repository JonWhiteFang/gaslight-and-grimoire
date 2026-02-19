import type { InvestigatorSlice } from './slices/investigatorSlice';
import type { NarrativeSlice } from './slices/narrativeSlice';
import type { EvidenceSlice } from './slices/evidenceSlice';
import type { NpcSlice } from './slices/npcSlice';
import type { WorldSlice } from './slices/worldSlice';
import type { MetaSlice } from './slices/metaSlice';

export type GameStore = InvestigatorSlice &
  NarrativeSlice &
  EvidenceSlice &
  NpcSlice &
  WorldSlice &
  MetaSlice;
