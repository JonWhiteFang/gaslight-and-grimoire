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
  // DEPRECATED / never written after Phase 2b — the connected cue is derived from
  // `connections` membership at render, not stored on the clue (retained in the union
  // so a pre-migration in-memory state can't fail isValidGameState).
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
  /**
   * The faculty of the most recent critical-success check this case. Read by
   * caseProgression.completeCase to grant the +1 end-of-case faculty bonus.
   * Reset to undefined on case/vignette load. Optional so it round-trips safely
   * through older saves (absent → no bonus). (F-013)
   */
  lastCriticalFaculty?: Faculty;
}

export interface ArchetypeDefinition {
  id: Archetype;
  name: string;
  description: string;
  bonuses: Partial<Record<Faculty, number>>;
  /** The archetype's primary faculty — must match its +3 bonus faculty. Single source of truth for the dice trained bonus. */
  primaryFaculty: Faculty;
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

/**
 * An authored "key deduction" recipe. When the player connects a set of clues
 * whose ids are a superset of `requiredClues`, the resulting Deduction is stored
 * under this stable `id` (instead of a random one), so `hasDeduction` /
 * `requiresDeduction` gates can reference it. Authored in a case's deductions.json.
 */
export interface KeyDeduction {
  id: string;
  requiredClues: string[];
  title: string;
  description: string;
  isRedHerring: boolean;
}

export type DeductionCorrectness = 'correct' | 'false' | 'partial' | 'incorrect';

/** One player-built connected component, classified by the deduction oracle. */
export interface ClassifiedComponent {
  /** Own-property, revealed clue ids in this component (sorted, deduped). */
  clueIds: string[];
  correctness: DeductionCorrectness;
  /**
   * EVERY recipe whose requiredClues ⊆ this component (ADR-0005 subset semantics).
   * Ordered for PRESENTATION only (non-red-herring first → largest requiredClues →
   * lowest id); the order never decides which recipes form — all of them do.
   * Empty on the generic path.
   */
  recipes: KeyDeduction[];
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

/**
 * A gate over game state. Discriminated union keyed on `type`: each variant
 * carries exactly the `target`/`value` shape its evaluator branch reads (F-026).
 * This lets `evaluateCondition` narrow `value` per-case without unchecked casts.
 *
 * Note on `target`:
 *   - `facultyMin` uses `target` as a Faculty key into investigator.faculties.
 *   - `archetypeIs` ignores `target` at eval time (it compares `value` to the
 *     investigator archetype); content authors set both, so it stays `string`.
 */
export type Condition =
  | { type: 'hasClue'; target: string }
  | { type: 'hasDeduction'; target: string }
  | { type: 'hasFlag'; target: string; value?: boolean }
  | { type: 'facultyMin'; target: Faculty; value: number }
  | { type: 'archetypeIs'; target: string; value: Archetype }
  | { type: 'npcDisposition'; target: string; value: number }
  | { type: 'npcSuspicion'; target: string; value: NpcSuspicionTier }
  | { type: 'factionReputation'; target: string; value: number }
  | { type: 'npcMemoryFlag'; target: string; value: string };

export interface Effect {
  type:
    | 'composure'
    | 'vitality'
    | 'flag'
    | 'disposition'
    | 'suspicion'
    | 'reputation'
    | 'discoverClue'
    | 'setMemoryFlag';
  target?: string;
  delta?: number;
  value?: boolean | string;
  /** Optional authored narrative text shown as feedback when this effect fires. */
  description?: string;
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
  encounter?: { rounds: EncounterRound[]; isSupernatural: boolean };
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
  // Encounter extensions
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
  /** Evidence-board connection threads (clue-id pairs). Persisted from save v2. */
  connections?: ClueConnection[];
  /**
   * Scene ids whose `onEnter` effects have already been applied this playthrough.
   * Gates onEnter to fire exactly once per scene, so revisiting (back button) or
   * reloading a save cannot re-apply — or "farm" — its effects. Persisted from save v3.
   */
  visitedScenes?: string[];
  /**
   * In-progress encounter state (round index + whether the reaction check has
   * run and its result), or null/absent when not in an encounter. Persisted so a
   * reload mid-encounter resumes rather than restarting — which would re-roll and
   * re-apply the reaction damage and lose round progress (F-105). From save v4.
   */
  encounterState?: EncounterState | null;
  settings: GameSettings;
}

export interface ClueConnection {
  fromId: string;
  toId: string;
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
  firstScene?: string;
}

export interface CaseData {
  meta: CaseMeta;
  scenes: Record<string, SceneNode>; // all scenes keyed by id
  clues: Record<string, Clue>;
  npcs: Record<string, NPCState>;
  variants: SceneNode[];
  /** Authored key-deduction recipes (main cases only; optional so vignettes may omit). */
  recipes?: KeyDeduction[];
}

export interface VignetteMeta {
  id: string;
  title: string;
  synopsis: string;
  triggerCondition?: Condition;
  firstScene?: string;
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

// ─── Content Manifest ─────────────────────────────────────────────────────────

export interface CaseManifestEntry {
  id: string;
  title: string;
  synopsis: string;
  type: 'case' | 'vignette';
  triggerCondition?: Condition;
}

export interface CaseManifest {
  cases: CaseManifestEntry[];
}

export interface ChoiceResult {
  nextSceneId: string;
  roll?: number;
  modifier?: number;
  total?: number;
  tier?: OutcomeTier;
  cluesDiscovered?: string[];
}
