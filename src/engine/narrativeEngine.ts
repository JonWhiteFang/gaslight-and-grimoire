/**
 * Narrative Engine (barrel)
 *
 * The narrative engine was split into focused modules (F-019). This file
 * re-exports the full public surface so every existing
 * `import { X } from '.../narrativeEngine'` path continues to resolve unchanged.
 *
 *   - contentLoader   — JSON content loading + load-time validation
 *   - conditions      — condition evaluation, scene resolution, clue-discovery gating
 *   - choiceResolution — pure choice-outcome computation + processChoice action
 *   - encounters      — multi-round encounter setup and processing
 */

export * from './contentLoader';
export * from './conditions';
export * from './choiceResolution';
export * from './encounters';
