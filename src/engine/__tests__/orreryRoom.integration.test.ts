/**
 * Orrery Room behavioral integration witnesses (spec §8.3 / plan T9 Step 1b).
 *
 * Structural assertions (orreryRoom.content.test.ts) can stay green while the
 * integrated behavior is broken — these five witnesses drive the REAL
 * machinery (store, oracle, resolver, loader) with the shipped content:
 *   1. loadGame round-trip restores recipes + variants into caseData
 *   2. both recipes form through the real classifyBoard oracle
 *   3. ending variants resolve via the real resolveScene
 *   4. the flagless brokered path (deduction formable, choice becomes shown)
 *   5. rep clamp behavior of the literal ending effect lists (ordering rule)
 * (The form-keystone-AFTER-terminal-scene scenario — spec Major 5 — lives in
 * orreryRoom.onFormAfterTerminal.test.tsx because it needs the real board.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyBoard } from '../deductionOracle';
import { resolveScene } from '../conditions';
import { resolveChoiceVisibility } from '../choiceVisibility';
import { _resetSharedScenesCache } from '../contentLoader';
import { vignetteToCaseData } from '../../store/slices/narrativeSlice';
import { SaveManager } from '../saveManager';
import { snapshotGameState } from '../../utils/gameState';
import { useStore } from '../../store';
import type {
  CaseData, Choice, Clue, ClueConnection, GameState, KeyDeduction, SceneNode, VignetteMeta,
} from '../../types';
import metaFile from '../../../public/content/side-cases/the-orrery-room/meta.json';
import scenesFile from '../../../public/content/side-cases/the-orrery-room/scenes.json';
import variantsFile from '../../../public/content/side-cases/the-orrery-room/variants.json';
import cluesFile from '../../../public/content/side-cases/the-orrery-room/clues.json';
import npcsFile from '../../../public/content/side-cases/the-orrery-room/npcs.json';
import deductionsFile from '../../../public/content/side-cases/the-orrery-room/deductions.json';

const scenes = (scenesFile as { scenes: SceneNode[] }).scenes;
const variants = (variantsFile as { variants: SceneNode[] }).variants;
const clueList = (cluesFile as { clues: Clue[] }).clues;
const recipes = (deductionsFile as { deductions: KeyDeduction[] }).deductions;

const indexById = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((i) => [i.id, i]));

/** The real vignette, adapted through the production path. */
function orreryCaseData(): CaseData {
  return vignetteToCaseData({
    meta: metaFile as VignetteMeta,
    scenes: indexById(scenes),
    clues: indexById(clueList),
    npcs: indexById((npcsFile as { npcs: { id: string }[] }).npcs) as CaseData['npcs'],
    recipes,
    variants,
  });
}

/** Revealed copies of the named real clues, indexed — classifyBoard fails closed on unrevealed. */
function revealedClues(...ids: string[]): Record<string, Clue> {
  const byId = indexById(clueList);
  return Object.fromEntries(
    ids.map((id) => [id, { ...byId[id], isRevealed: true } as Clue]),
  );
}

const edge = (fromId: string, toId: string): ClueConnection => ({ fromId, toId });

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: {
      archetype: 'detective',
      faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    },
    clues: {},
    deductions: {},
    flags: {},
    npcs: {},
    factionReputation: {},
    ...overrides,
  } as unknown as GameState;
}

const ENDINGS = [
  'or-act2-ending-destroyed',
  'or-act2-ending-enshrined',
  'or-act2-ending-sealed',
] as const;

// ── 1. loadGame round-trip ─────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

/** Serves the REAL orrery content by URL suffix (side-cases path + shared scenes). */
function stubOrreryFetch() {
  const shared = (id: string) => ({ id, act: 1, narrative: id, choices: [], cluesAvailable: [] });
  const bySuffix: Record<string, unknown> = {
    'content/manifest.json': {
      cases: [{ id: 'the-orrery-room', title: 'The Orrery Room', synopsis: '', type: 'vignette' }],
    },
    'side-cases/the-orrery-room/meta.json': metaFile,
    'side-cases/the-orrery-room/scenes.json': scenesFile,
    'side-cases/the-orrery-room/clues.json': cluesFile,
    'side-cases/the-orrery-room/npcs.json': npcsFile,
    'side-cases/the-orrery-room/deductions.json': deductionsFile,
    'side-cases/the-orrery-room/variants.json': variantsFile,
    'shared/breakdown.json': shared('breakdown'),
    'shared/incapacitation.json': shared('incapacitation'),
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const key = Object.keys(bySuffix).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response;
    return { ok: true, json: async () => bySuffix[key] } as Response;
  }));
}

function baseInvestigator() {
  return {
    name: 'Holmes', archetype: 'deductionist' as const,
    faculties: { reason: 10, perception: 10, nerve: 10, vigor: 10, influence: 10, lore: 10 },
    composure: 10, vitality: 10, abilityUsed: false,
  };
}

describe('loadGame round-trip restores vignette recipes + variants (spec §2 tests)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
    _resetSharedScenesCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('an in-progress orrery save restores caseData.recipes and caseData.variants', async () => {
    stubOrreryFetch();
    useStore.setState({
      investigator: baseInvestigator(),
      currentScene: 'or-act1-orrery-room', currentCase: 'the-orrery-room',
      clues: {}, deductions: {}, npcs: {}, flags: {}, factionReputation: {},
      sceneHistory: [], connections: [],
    });
    SaveManager.save('orrery-vig', snapshotGameState(useStore.getState()));

    const ok = await useStore.getState().loadGame('orrery-vig');
    expect(ok).toBe(true);

    const caseData = useStore.getState().caseData;
    expect(caseData?.meta.id).toBe('the-orrery-room');
    expect(caseData?.recipes?.map((r) => r.id)).toContain('mythos-pattern-named');
    expect(caseData?.variants.map((v) => v.id)).toContain('or-act2-night-vigil-veil');
  });
});

// ── 2. Real-oracle recipe formation ────────────────────────────────────────────

describe('both recipes form through the real oracle (spec §8.3)', () => {
  it('or-genuine-instrument: gear-train + finch-admission → correct, recipe matched', () => {
    const comps = classifyBoard(
      [edge('or-clue-gear-train', 'or-clue-finch-admission')],
      revealedClues('or-clue-gear-train', 'or-clue-finch-admission'),
      recipes,
    );
    expect(comps).toHaveLength(1);
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes.map((r) => r.id)).toContain('or-genuine-instrument');
  });

  it('mythos-pattern-named: the three keystone clues → correct, keystone matched', () => {
    const comps = classifyBoard(
      [
        edge('or-clue-orrery-period', 'or-clue-adjustment-diary'),
        edge('or-clue-adjustment-diary', 'or-clue-night-observation'),
      ],
      revealedClues('or-clue-orrery-period', 'or-clue-adjustment-diary', 'or-clue-night-observation'),
      recipes,
    );
    expect(comps).toHaveLength(1);
    expect(comps[0].correctness).toBe('correct');
    expect(comps[0].recipes.map((r) => r.id)).toContain('mythos-pattern-named');
  });
});

// ── 3. Ending variants resolve through the real resolver ──────────────────────

describe('ending variants resolve with the keystone deduction held (spec §3.10)', () => {
  const caseData = orreryCaseData();
  const withKeystone = makeState({
    deductions: {
      'mythos-pattern-named': {
        id: 'mythos-pattern-named', clueIds: [], title: '', description: '',
        isCorrect: true, formedAt: 0,
      },
    } as unknown as GameState['deductions'],
  });

  it.each(ENDINGS)('%s → its -named variant with the deduction, base without', (id) => {
    expect(resolveScene(id, withKeystone, caseData).id).toBe(`${id}-named`);
    expect(resolveScene(id, makeState(), caseData).id).toBe(id);
  });
});

// ── 4. Flagless brokered path ──────────────────────────────────────────────────

describe('flagless run: genuine-instrument formable, broker choice unlocks (spec §8.3)', () => {
  const broker = scenes
    .find((s) => s.id === 'or-act2-verdict-hub')!
    .choices.find((c) => c.id === 'or-choice-verdict-broker') as Choice;

  it('or-genuine-instrument forms with flags: {} (keystone never needed for it)', () => {
    const comps = classifyBoard(
      [edge('or-clue-gear-train', 'or-clue-finch-admission')],
      revealedClues('or-clue-gear-train', 'or-clue-finch-admission'),
      recipes,
    );
    expect(comps[0].recipes.map((r) => r.id)).toContain('or-genuine-instrument');
  });

  it('broker choice: hidden without the deduction, shown with it — flags stay empty', () => {
    expect(resolveChoiceVisibility(broker, makeState({ flags: {} }))).toBe('hidden');
    expect(
      resolveChoiceVisibility(
        broker,
        makeState({
          flags: {},
          deductions: {
            'or-genuine-instrument': { id: 'or-genuine-instrument' },
          } as unknown as GameState['deductions'],
        }),
      ),
    ).toBe('shown');
  });
});

// ── 5. Rep clamp behavior of the literal ending effects ───────────────────────

describe('rep clamp behavior at the boundary (spec §3 rep-math note)', () => {
  const destroyedOnEnter = scenes.find((s) => s.id === 'or-act2-ending-destroyed')!.onEnter!;
  const GD = 'Hermetic Order of the Grey Dawn';

  function seedStore(gdRep: number) {
    useStore.setState({
      investigator: baseInvestigator(),
      npcs: {
        'npc-coyle': {
          id: 'npc-coyle', name: 'Magister Coyle', faction: GD,
          disposition: 1, suspicion: 0, memoryFlags: {}, isAlive: true, isAccessible: true,
        },
      },
      flags: {},
      factionReputation: { [GD]: gdRep },
    } as never);
  }

  it('partisan ending nets +0.5 from mid-range rep (disposition −3 → −1.5, then +2)', () => {
    seedStore(0);
    useStore.getState().applyEffects(destroyedOnEnter);
    expect(useStore.getState().factionReputation[GD]).toBe(0.5);
  });

  it('at the +10 clamp the authored order (disposition first) preserves the reward', () => {
    // disposition −3 → propagation −1.5 → 8.5; then +2 clamps UP to 10.
    // The reversed order would clamp the +2 away first and end at 8.5 —
    // this asymmetry is why the ordering rule exists.
    seedStore(10);
    useStore.getState().applyEffects(destroyedOnEnter);
    expect(useStore.getState().factionReputation[GD]).toBe(10);
  });
});
