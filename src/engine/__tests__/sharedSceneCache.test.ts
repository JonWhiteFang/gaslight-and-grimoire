/**
 * Tests for shared-scene fetch caching (F-047).
 *
 * breakdown/incapacitation are identical across every case, so `loadCase` /
 * `loadVignette` must fetch them at most once and reuse the result on later
 * loads instead of re-fetching per case load.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadCase, _resetSharedScenesCache } from '../contentLoader';

const scene = (id: string) => ({ id, narrative: id, choices: [], cluesAvailable: [], onEnter: [] });

function fixtureFor(caseId: string): Record<string, unknown> {
  return {
    [`cases/${caseId}/meta.json`]: { id: caseId, title: caseId, firstScene: 's1', acts: 3, facultyDistribution: {} },
    [`cases/${caseId}/act1.json`]: { scenes: [scene('s1')] },
    [`cases/${caseId}/act2.json`]: { scenes: [] },
    [`cases/${caseId}/act3.json`]: { scenes: [] },
    [`cases/${caseId}/clues.json`]: { clues: [] },
    [`cases/${caseId}/npcs.json`]: { npcs: [] },
    [`cases/${caseId}/variants.json`]: { variants: [] },
  };
}

const shared = {
  'shared/breakdown.json': scene('breakdown'),
  'shared/incapacitation.json': scene('incapacitation'),
};

let fetched: string[] = [];

function stubFetch() {
  const bySuffix: Record<string, unknown> = { ...fixtureFor('case-a'), ...fixtureFor('case-b'), ...shared };
  fetched = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(url);
    const key = Object.keys(bySuffix).find((k) => url.endsWith(k));
    // deductions.json is optional (.catch → []); 404 it.
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
    return { ok: true, json: async () => bySuffix[key] } as Response;
  }));
}

beforeEach(() => { _resetSharedScenesCache(); stubFetch(); });
afterEach(() => vi.unstubAllGlobals());

describe('shared-scene fetch caching (F-047)', () => {
  it('injects the shared scenes into a loaded case', async () => {
    const data = await loadCase('case-a');
    expect(data.scenes.breakdown).toBeDefined();
    expect(data.scenes.incapacitation).toBeDefined();
  });

  it('fetches the shared scenes only once across two case loads', async () => {
    await loadCase('case-a');
    await loadCase('case-b');

    const breakdownFetches = fetched.filter((u) => u.endsWith('shared/breakdown.json'));
    const incapFetches = fetched.filter((u) => u.endsWith('shared/incapacitation.json'));
    expect(breakdownFetches).toHaveLength(1);
    expect(incapFetches).toHaveLength(1);
  });

  it('re-fetches after the cache is reset', async () => {
    await loadCase('case-a');
    _resetSharedScenesCache();
    await loadCase('case-b');

    const breakdownFetches = fetched.filter((u) => u.endsWith('shared/breakdown.json'));
    expect(breakdownFetches).toHaveLength(2);
  });
});
