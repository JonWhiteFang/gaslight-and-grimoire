/**
 * haltScenes — identify the shared "investigation halted" terminal scenes.
 *
 * Reaching 0 Composure or Vitality routes the player to the shared `breakdown`
 * or `incapacitation` scene (0 choices). Each main case overrides these with a
 * variant (`wc-breakdown`, `ms-incapacitation`, …) whose id differs but which
 * carries `variantOf` pointing back at the canonical id. The UI keys the
 * "Investigation halted" screen off this predicate rather than the raw scene id
 * so a knockout is not mislabelled "Case Complete" (F-011, issue #9).
 */
import type { SceneNode } from '../types';

/** Which resource ran out, driving the halt-screen copy. */
export type HaltReason = 'composure' | 'vitality';

/** The canonical ids of the shared halt scenes. */
export const HALT_SCENE_IDS = ['breakdown', 'incapacitation'] as const;

/** Resolves a scene to its canonical shared id (following `variantOf`). */
function canonicalHaltId(scene: SceneNode): string {
  return scene.variantOf ?? scene.id;
}

/** True when `scene` is a breakdown/incapacitation scene (base or case variant). */
export function isHaltScene(scene: SceneNode | null | undefined): boolean {
  if (!scene) return false;
  return (HALT_SCENE_IDS as readonly string[]).includes(canonicalHaltId(scene));
}

/**
 * The halt reason for a halt scene: `breakdown` → composure, `incapacitation`
 * → vitality. Returns null for non-halt scenes.
 */
export function haltReason(scene: SceneNode | null | undefined): HaltReason | null {
  if (!scene) return null;
  const id = canonicalHaltId(scene);
  if (id === 'breakdown') return 'composure';
  if (id === 'incapacitation') return 'vitality';
  return null;
}
