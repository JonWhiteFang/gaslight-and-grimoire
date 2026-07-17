/**
 * Content Loader
 *
 * Handles JSON content loading (cases, vignettes, manifest, shared scenes)
 * and load-time content validation.
 */

import type {
  CaseData,
  CaseManifest,
  CaseMeta,
  Clue,
  KeyDeduction,
  NPCState,
  SceneNode,
  ValidationResult,
  VignetteData,
  VignetteMeta,
} from '../types';
import { validateBundle } from './contentValidation';

// ─── Content Loading ──────────────────────────────────────────────────────────

/**
 * Fetches the content manifest listing all available cases and vignettes.
 */
export async function fetchManifest(): Promise<CaseManifest> {
  return fetchJson<CaseManifest>('/content/manifest.json');
}


/**
 * The shared breakdown/incapacitation scenes are identical across every case and
 * never change at runtime, so fetch them at most once and reuse the result on
 * subsequent case/vignette loads (F-047). The cached promise is shared so
 * concurrent loads don't double-fetch.
 */
let sharedScenesPromise: Promise<SceneNode[]> | null = null;

/** Test hook: clear the shared-scenes cache so a fresh `fetch` stub is honoured. */
export function _resetSharedScenesCache(): void {
  sharedScenesPromise = null;
}

function loadSharedScenes(): Promise<SceneNode[]> {
  if (!sharedScenesPromise) {
    sharedScenesPromise = Promise.all([
      fetchJson<SceneNode>('/content/shared/breakdown.json'),
      fetchJson<SceneNode>('/content/shared/incapacitation.json'),
    ]).catch((err) => {
      // Don't cache a failure — allow a later load to retry.
      sharedScenesPromise = null;
      throw err;
    });
  }
  return sharedScenesPromise;
}

/** Merges already-loaded shared scenes into a scenes record (pure). */
function mergeSharedScenes(scenes: Record<string, SceneNode>, shared: SceneNode[]): Record<string, SceneNode> {
  const merged = { ...scenes };
  for (const scene of shared) merged[scene.id] = scene;
  return merged;
}

/**
 * Loads all JSON files for a case and assembles a CaseData object.
 */
export async function loadCase(caseId: string): Promise<CaseData> {
  const base = `/content/cases/${caseId}`;

  // Kick off the (cached) shared-scene fetch alongside the main batch so the
  // first load doesn't pay for it sequentially (F-047).
  const sharedPromise = loadSharedScenes();

  const [meta, act1, act2, act3, cluesFile, npcsFile, variantsFile] =
    await Promise.all([
      fetchJson<CaseMeta>(`${base}/meta.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act1.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act2.json`),
      fetchJson<{ scenes: SceneNode[] }>(`${base}/act3.json`),
      fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
      fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
      fetchJson<{ variants: SceneNode[] }>(`${base}/variants.json`),
    ]);

  // deductions.json is optional — a case without key deductions simply has none.
  const recipes = await fetchJson<{ deductions: KeyDeduction[] }>(`${base}/deductions.json`)
    .then((f) => f.deductions)
    .catch(() => [] as KeyDeduction[]);

  const allScenes = [...act1.scenes, ...act2.scenes, ...act3.scenes];
  const scenes = mergeSharedScenes(indexById(allScenes), await sharedPromise);
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs, variants: variantsFile.variants, recipes };
}

/**
 * Loads all JSON files for a vignette and assembles a VignetteData object.
 */
export async function loadVignette(vignetteId: string): Promise<VignetteData> {
  const base = `/content/side-cases/${vignetteId}`;

  const sharedPromise = loadSharedScenes();

  const [meta, scenesFile, cluesFile, npcsFile] = await Promise.all([
    fetchJson<VignetteMeta>(`${base}/meta.json`),
    fetchJson<{ scenes: SceneNode[] }>(`${base}/scenes.json`),
    fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
    fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
  ]);

  // deductions.json / variants.json are optional — most vignettes ship neither.
  const recipes = await fetchJson<{ deductions: KeyDeduction[] }>(`${base}/deductions.json`)
    .then((f) => f.deductions)
    .catch(() => undefined);
  const variants = await fetchJson<{ variants: SceneNode[] }>(`${base}/variants.json`)
    .then((f) => f.variants)
    .catch(() => [] as SceneNode[]);

  const scenes = mergeSharedScenes(indexById(scenesFile.scenes), await sharedPromise);
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs, recipes, variants };
}

// ─── Content Validation ───────────────────────────────────────────────────────

/**
 * Validates a loaded CaseData for broken scene-graph edges, missing clue/npc
 * references, condition targets, variant structure, encounter edges, and clue
 * sceneSource. Delegates to the shared {@link validateBundle} (errors only —
 * reachability is a CLI-only concern). Logs descriptive errors on failure.
 */
export function validateContent(caseData: CaseData): ValidationResult {
  const { errors } = validateBundle({
    scenes: Object.values(caseData.scenes),
    variants: caseData.variants,
    clues: Object.values(caseData.clues),
    npcs: Object.values(caseData.npcs),
    // Key-deduction recipes form the requiresDeduction/hasDeduction registry — must
    // be passed or every such reference reads as "unknown" and load-validation throws.
    recipes: caseData.recipes,
    // breakdown/incapacitation are injected into caseData.scenes as base scenes,
    // but declare them shared too so variantOf targets resolve if injection changes.
    sharedSceneIds: ['breakdown', 'incapacitation'],
  });

  for (const msg of errors) {
    console.error(`[NarrativeEngine] ${msg}`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? '/';
  const fullUrl = `${base.replace(/\/$/, '')}${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`[NarrativeEngine] Failed to fetch "${fullUrl}": ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  for (const item of items) {
    map[item.id] = item;
  }
  return map;
}
