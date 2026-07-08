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


/** Loads shared scenes (breakdown, incapacitation) and injects them into a scenes record. */
async function injectSharedScenes(scenes: Record<string, SceneNode>): Promise<Record<string, SceneNode>> {
  const [breakdown, incapacitation] = await Promise.all([
    fetchJson<SceneNode>("/content/shared/breakdown.json"),
    fetchJson<SceneNode>("/content/shared/incapacitation.json"),
  ]);
  return { ...scenes, [breakdown.id]: breakdown, [incapacitation.id]: incapacitation };
}

/**
 * Loads all JSON files for a case and assembles a CaseData object.
 */
export async function loadCase(caseId: string): Promise<CaseData> {
  const base = `/content/cases/${caseId}`;

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
  const scenes = await injectSharedScenes(indexById(allScenes));
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs, variants: variantsFile.variants, recipes };
}

/**
 * Loads all JSON files for a vignette and assembles a VignetteData object.
 */
export async function loadVignette(vignetteId: string): Promise<VignetteData> {
  const base = `/content/side-cases/${vignetteId}`;

  const [meta, scenesFile, cluesFile, npcsFile] = await Promise.all([
    fetchJson<VignetteMeta>(`${base}/meta.json`),
    fetchJson<{ scenes: SceneNode[] }>(`${base}/scenes.json`),
    fetchJson<{ clues: Clue[] }>(`${base}/clues.json`),
    fetchJson<{ npcs: NPCState[] }>(`${base}/npcs.json`),
  ]);

  const scenes = await injectSharedScenes(indexById(scenesFile.scenes));
  const clues = indexById(cluesFile.clues);
  const npcs = indexById(npcsFile.npcs);

  return { meta, scenes, clues, npcs };
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
