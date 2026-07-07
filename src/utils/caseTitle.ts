/**
 * caseTitle — resolve a human-readable case title from a title/id pair.
 *
 * The engine keys cases by a slug id (`the-whitechapel-cipher`); the readable
 * title lives on `caseData.meta.title`. UI surfaces (HeaderBar, save list) must
 * show the title, falling back to a de-slugified id when the title is absent
 * (e.g. legacy save summaries that stored the slug). See F-010 / issue #10.
 */

const GAME_NAME = 'Gaslight & Grimoire';

/** Turns a hyphenated slug into Title Case (`the-mayfair-seance` → `The Mayfair Seance`). */
export function deslugifyCaseId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves the best available human-readable title:
 *   1. the explicit title, when present and non-empty
 *   2. otherwise a de-slugified id
 *   3. otherwise the game name
 */
export function resolveCaseTitle(
  title: string | undefined | null,
  id: string | undefined | null,
): string {
  if (title) return title;
  if (id) return deslugifyCaseId(id);
  return GAME_NAME;
}
