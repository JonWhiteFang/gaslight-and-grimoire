// ─── Core Enumerations ───────────────────────────────────────────────────────

export type Archetype = 'deductionist' | 'occultist' | 'operator' | 'mesmerist';

export type Faculty =
  | 'reason'
  | 'perception'
  | 'nerve'
  | 'vigor'
  | 'influence'
  | 'lore';

export type ClueType =
  | 'physical'
  | 'testimony'
  | 'occult'
  | 'deduction'
  | 'redHerring';

export type ClueStatus =
  | 'new'
  | 'examined'
  | 'connected'
  | 'deduced'
  | 'contested'
  | 'spent';

export type OutcomeTier =
  | 'critical'
  | 'success'
  | 'partial'
  | 'failure'
  | 'fumble';

// ─── Character ───────────────────────────────────────────────────────────────

export interface Investigator {
  name: string;
  archetype: Archetype;
  faculties: Record<Faculty, number>;
  composure: number; // 0–10
  vitality: number; // 0–10
  abilityUsed: boolean;
}

export interface ArchetypeDefinition {
  id: Archetype;
  name: string;
  description: string;
  bonuses: Partial<Record<Faculty, number>>;
  ability: {
    name: string;
    description: string;
    faculty: Faculty;
    context: string;
  };
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export interface Clue {
  id: string;
  type: ClueType;
  title: string;
  description: string;
  sceneSource: string;
  connectsTo?: string[];
  grantsFaculty?: Faculty;
  tags: string[];
  status: ClueStatus;
  isRevealed: boolean;
}

export interface Deduction {
  id: string;
  clueIds: string[];
  description: string;
  unlocksScenes?: string[];
  unlocksDialogue?: string[];
  isRedHerring: boolean;
}

// ─── NPC ─────────────────────────────────────────────────────────────────────

export interface NPCState {
  id: string;
  name: string;
  faction: string | null;
  disposition: number; // -10 to +10
  suspicion: number; // 0 to 10
  memoryFlags: Record<string, boolean>;
  isAlive: boolean;
  isAccessible: boolean;
}

// ─── Scene Graph ─────────────────────────────────────────────────────────────

export type NpcSuspicionTier = 'normal' | 'evasive' | 'concealing' | 'hostile';

export interface Condition {
  type:
    | 'hasClue'
    | 'hasDeduction'
    | 'hasFlag'
    | 'facultyMin'
    | 'archetypeIs'
    | 'npcDisposition'
    | 'npcSuspicion'
    | 'factionReputation';
  target: string;
  value?: number | boolean | string | NpcSuspicionTier;
}

export interface Effect {
  type:
    | 'composure'
    | 'vitality'
    | 'flag'
    | 'disposition'
    | 'suspicion'
    | 'reputation'
    | 'discoverClue';
  target?: string;
  delta?: number;
  value?: boolean | string;
}

export interface ClueDiscovery {
  clueId: string;
  method: 'automatic' | 'exploration' | 'check' | 'dialogue';
  requiresFaculty?: { faculty: Faculty; minimum: number };
  requiresDeduction?: string;
}

export interface SceneNode {
  id: string;
  act: number;
  narrative: string;
  illustration?: string;
  ambientAudio?: string;
  cluesAvailable: ClueDiscovery[];
  choices: Choice[];
  conditions?: Condition[];
  onEnter?: Effect[];
  archetypeExclusive?: Archetype;
  variantOf?: string;
  variantCondition?: Condition;
}

export interface Choice {
  id: string;
  text: string;
  faculty?: Faculty;
  difficulty?: number;
  dynamicDifficulty?: {
    baseDC: number;
    scaleFaculty: Faculty;
    highThreshold: number;
    highDC: number;
  };
  advantageIf?: string[];
  outcomes: Record<OutcomeTier, string>;
  requiresClue?: string;
  requiresDeduction?: string;
  requiresFlag?: string;
  requiresFaculty?: { faculty: Faculty; minimum: number };
  npcEffect?: {
    npcId: string;
    dispositionDelta: number;
    suspicionDelta: number;
  };
  // Encounter extensions (Req 9)
  worseAlternative?: Choice;       // replaces this choice on Reaction_Check failure
  isEscapePath?: boolean;          // marks this as the non-combat escape option
  encounterDamage?: {
    composureDelta?: number;       // negative = damage
    vitalityDelta?: number;        // negative = damage
  };
}

// ─── Encounter System ─────────────────────────────────────────────────────────

export interface EncounterRound {
  roundNumber: number;   // 1-based
  choices: Choice[];     // 2–4 Faculty-tagged choices
  isSupernatural: boolean;
}

export interface EncounterState {
  id: string;
  rounds: EncounterRound[];
  currentRound: number;              // 0-indexed
  isComplete: boolean;
  reactionCheckPassed: boolean | null; // null = not yet performed
}

// ─── Settings & Persistence ──────────────────────────────────────────────────

export interface GameSettings {
  fontSize: 'standard' | 'large' | 'extraLarge' | number;
  highContrast: boolean;
  reducedMotion: boolean;
  textSpeed: 'typewriter' | 'fast' | 'instant';
  hintsEnabled: boolean;
  autoSaveFrequency: 'choice' | 'scene' | 'manual';
  audioVolume: { ambient: number; sfx: number };
}

export interface GameState {
  investigator: Investigator;
  currentScene: string;
  currentCase: string;
  clues: Record<string, Clue>;
  deductions: Record<string, Deduction>;
  npcs: Record<string, NPCState>;
  flags: Record<string, boolean>;
  factionReputation: Record<string, number>;
  sceneHistory: string[];
  settings: GameSettings;
}

export interface SaveFile {
  version: number;
  timestamp: string;
  state: GameState;
}

// ─── Content Loading ──────────────────────────────────────────────────────────

export interface CaseMeta {
  id: string;
  title: string;
  synopsis: string;
  acts: number;
  facultyDistribution: Partial<Record<Faculty, number>>;
}

export interface CaseData {
  meta: CaseMeta;
  scenes: Record<string, SceneNode>; // all scenes keyed by id
  clues: Record<string, Clue>;
  npcs: Record<string, NPCState>;
  variants: SceneNode[];
}

export interface VignetteMeta {
  id: string;
  title: string;
  synopsis: string;
  triggerCondition?: Condition;
}

export interface VignetteData {
  meta: VignetteMeta;
  scenes: Record<string, SceneNode>;
  clues: Record<string, Clue>;
  npcs: Record<string, NPCState>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ChoiceResult {
  nextSceneId: string;
  roll?: number;
  modifier?: number;
  total?: number;
  tier?: OutcomeTier;
  cluesDiscovered?: string[];
}
