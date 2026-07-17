/**
 * Unit tests for ChoicePanel — choice visibility filtering and Advantage indicator
 *
 * Sub-task 7.1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../store';
import { ChoicePanel } from '../ChoicePanel/ChoicePanel';
import { ChoiceCard } from '../ChoicePanel/ChoiceCard';
import { resolveChoiceVisibility } from '../../engine/choiceVisibility';
import type { Choice, GameState, Investigator, Clue, Deduction } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseInvestigator: Investigator = {
  name: 'Elara Voss',
  archetype: 'deductionist',
  faculties: {
    reason: 14,     // modifier +2
    perception: 12, // modifier +1
    nerve: 8,       // modifier -1
    vigor: 10,      // modifier +0
    influence: 10,
    lore: 10,
  },
  composure: 10,
  vitality: 10,
  abilityUsed: false,
};

function makeClue(id: string, isRevealed = true): Clue {
  return {
    id,
    type: 'physical',
    title: `Clue ${id}`,
    description: '',
    sceneSource: 'scene-1',
    tags: [],
    status: 'new',
    isRevealed,
  };
}

function makeDeduction(id: string): Deduction {
  return {
    id,
    clueIds: [],
    description: '',
    isRedHerring: false,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    investigator: baseInvestigator,
    currentScene: 'scene-1',
    currentCase: 'case-1',
    clues: {},
    deductions: {},
    npcs: {},
    flags: {},
    factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      textSpeed: 'typewriter',
      hintsEnabled: true,
      autoSaveFrequency: 'scene',
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
    ...overrides,
  };
}

const unconditionalChoice: Choice = {
  id: 'choice-open',
  text: 'Examine the room',
  outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
};

// ─── resolveChoiceVisibility — unit tests (pure function) ─────────────────────

describe('resolveChoiceVisibility — no requirements', () => {
  it('resolves shown for a choice with no requirements', () => {
    expect(resolveChoiceVisibility(unconditionalChoice, makeGameState())).toBe('shown');
  });
});

describe('resolveChoiceVisibility — requiresClue', () => {
  const choice: Choice = {
    ...unconditionalChoice,
    id: 'choice-clue',
    requiresClue: 'clue-bloodstain',
  };

  it('hides choice when required clue is not in inventory', () => {
    const state = makeGameState({ clues: {} });
    expect(resolveChoiceVisibility(choice, state)).toBe('hidden');
  });

  it('hides choice when required clue exists but is not revealed', () => {
    const state = makeGameState({
      clues: { 'clue-bloodstain': makeClue('clue-bloodstain', false) },
    });
    expect(resolveChoiceVisibility(choice, state)).toBe('hidden');
  });

  it('shows choice when required clue is revealed', () => {
    const state = makeGameState({
      clues: { 'clue-bloodstain': makeClue('clue-bloodstain', true) },
    });
    expect(resolveChoiceVisibility(choice, state)).toBe('shown');
  });
});

describe('resolveChoiceVisibility — requiresDeduction', () => {
  const choice: Choice = {
    ...unconditionalChoice,
    id: 'choice-deduction',
    requiresDeduction: 'deduction-motive',
  };

  it('hides choice when required deduction is absent', () => {
    const state = makeGameState({ deductions: {} });
    expect(resolveChoiceVisibility(choice, state)).toBe('hidden');
  });

  it('shows choice when required deduction is present', () => {
    const state = makeGameState({
      deductions: { 'deduction-motive': makeDeduction('deduction-motive') },
    });
    expect(resolveChoiceVisibility(choice, state)).toBe('shown');
  });
});

describe('resolveChoiceVisibility — requiresFlag', () => {
  const choice: Choice = {
    ...unconditionalChoice,
    id: 'choice-flag',
    requiresFlag: 'spoke-to-inspector',
  };

  it('hides choice when required flag is false', () => {
    const state = makeGameState({ flags: { 'spoke-to-inspector': false } });
    expect(resolveChoiceVisibility(choice, state)).toBe('hidden');
  });

  it('hides choice when required flag is absent', () => {
    const state = makeGameState({ flags: {} });
    expect(resolveChoiceVisibility(choice, state)).toBe('hidden');
  });

  it('shows choice when required flag is true', () => {
    const state = makeGameState({ flags: { 'spoke-to-inspector': true } });
    expect(resolveChoiceVisibility(choice, state)).toBe('shown');
  });
});

describe('resolveChoiceVisibility — requiresFaculty', () => {
  const choice: Choice = {
    ...unconditionalChoice,
    id: 'choice-faculty',
    requiresFaculty: { faculty: 'reason', minimum: 14 },
  };

  it('hides choice when faculty score is below minimum', () => {
    const state = makeGameState({
      investigator: { ...baseInvestigator, faculties: { ...baseInvestigator.faculties, reason: 10 } },
    });
    expect(resolveChoiceVisibility(choice, state)).toBe('hidden');
  });

  it('shows choice when faculty score meets minimum exactly', () => {
    const state = makeGameState({
      investigator: { ...baseInvestigator, faculties: { ...baseInvestigator.faculties, reason: 14 } },
    });
    expect(resolveChoiceVisibility(choice, state)).toBe('shown');
  });

  it('shows choice when faculty score exceeds minimum', () => {
    const state = makeGameState({
      investigator: { ...baseInvestigator, faculties: { ...baseInvestigator.faculties, reason: 18 } },
    });
    expect(resolveChoiceVisibility(choice, state)).toBe('shown');
  });
});

// ─── ChoiceCard — Advantage indicator ───────────────────────────────

describe('ChoiceCard — Advantage indicator', () => {
  const choiceWithAdvantage: Choice = {
    ...unconditionalChoice,
    id: 'choice-adv',
    text: 'Follow the blood trail',
    faculty: 'perception',
    advantageIf: ['clue-bloodstain', 'clue-footprint'],
  };

  // The badge is now driven purely by the `hasAdvantage` prop, which parents
  // compute via the shared `computeAdvantage` (clue advantage OR Lore + Veil
  // Sight). ChoiceCard no longer derives advantage from clues itself (F-014).
  it('does not show Advantage indicator when hasAdvantage is false', () => {
    render(
      <ChoiceCard
        choice={choiceWithAdvantage}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/advantage/i)).not.toBeInTheDocument();
  });

  it('shows Advantage indicator when hasAdvantage is true', () => {
    render(
      <ChoiceCard
        choice={choiceWithAdvantage}
        investigator={baseInvestigator}
        revealedClueIds={new Set(['clue-bloodstain'])}
        deductionIds={new Set()}
        hasAdvantage={true}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText(/advantage/i)).toBeInTheDocument();
  });

  it('shows Advantage indicator regardless of a specific clue (e.g. Veil Sight)', () => {
    render(
      <ChoiceCard
        choice={unconditionalChoice}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set()}
        hasAdvantage={true}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText(/advantage/i)).toBeInTheDocument();
  });

  it('does not show Advantage indicator when hasAdvantage is false and no advantageIf', () => {
    render(
      <ChoiceCard
        choice={unconditionalChoice}
        investigator={baseInvestigator}
        revealedClueIds={new Set(['clue-bloodstain'])}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/advantage/i)).not.toBeInTheDocument();
  });
});

// ─── ChoiceCard — key icon ────────────────────────────────────────

describe('ChoiceCard — key icon for preparation-unlocked choices', () => {
  it('shows key icon when choice is unlocked by a held clue', () => {
    const choice: Choice = {
      ...unconditionalChoice,
      id: 'choice-key-clue',
      requiresClue: 'clue-cipher',
    };
    render(
      <ChoiceCard
        choice={choice}
        investigator={baseInvestigator}
        revealedClueIds={new Set(['clue-cipher'])}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText(/unlocked by your preparation/i)).toBeInTheDocument();
  });

  it('shows key icon when choice is unlocked by a formed deduction', () => {
    const choice: Choice = {
      ...unconditionalChoice,
      id: 'choice-key-deduction',
      requiresDeduction: 'deduction-motive',
    };
    render(
      <ChoiceCard
        choice={choice}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set(['deduction-motive'])}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText(/unlocked by your preparation/i)).toBeInTheDocument();
  });
});

// ─── ChoiceCard — Faculty tag and proficiency colour ─────

describe('ChoiceCard — Faculty tag', () => {
  it('shows Faculty tag with modifier and proficiency label', () => {
    const choice: Choice = {
      ...unconditionalChoice,
      id: 'choice-faculty-tag',
      text: 'Deduce the pattern',
      faculty: 'reason',
      difficulty: 14,
    };
    render(
      <ChoiceCard
        choice={choice}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    // reason score 14 → modifier +2, trained bonus +1 → +3 → "Proficient"
    const tag = screen.getByLabelText(/reason check.*\+3.*proficient/i);
    expect(tag).toBeInTheDocument();
  });

  it('shows "Adequate" label for modifier 0–1', () => {
    const choice: Choice = {
      ...unconditionalChoice,
      id: 'choice-adequate',
      faculty: 'vigor',
    };
    // vigor score 10 → modifier +0
    render(
      <ChoiceCard
        choice={choice}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText(/vigor check.*\+0.*adequate/i)).toBeInTheDocument();
  });

  it('shows "Untrained" label for modifier ≤ -1', () => {
    const choice: Choice = {
      ...unconditionalChoice,
      id: 'choice-untrained',
      faculty: 'nerve',
    };
    // nerve score 8 → modifier -1
    render(
      <ChoiceCard
        choice={choice}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText(/nerve check.*-1.*untrained/i)).toBeInTheDocument();
  });

  it('does not render a Faculty tag for choices without a faculty check', () => {
    render(
      <ChoiceCard
        choice={unconditionalChoice}
        investigator={baseInvestigator}
        revealedClueIds={new Set()}
        deductionIds={new Set()}
        hasAdvantage={false}
        onSelect={() => {}}
      />,
    );
    // No faculty tag aria-label present
    expect(screen.queryByLabelText(/check,/i)).not.toBeInTheDocument();
  });
});

// ─── ChoicePanel — integration: filtering visible choices ─────────────────────

// Mock the Zustand store so ChoicePanel can render without a real store.
// vi.mock is hoisted — no module-level variables allowed inside the factory.
vi.mock('../../store', () => {
  const storeState = {
    investigator: {
      name: 'Elara Voss',
      archetype: 'deductionist' as const,
      faculties: {
        reason: 14,
        perception: 12,
        nerve: 8,
        vigor: 10,
        influence: 10,
        lore: 10,
      },
      composure: 10,
      vitality: 10,
      abilityUsed: false,
    },
    currentScene: 'scene-1',
    currentCase: 'case-1',
    clues: {
      'clue-bloodstain': {
        id: 'clue-bloodstain',
        type: 'physical' as const,
        title: 'Clue clue-bloodstain',
        description: '',
        sceneSource: 'scene-1',
        tags: [],
        status: 'new' as const,
        isRevealed: true,
      },
    },
    deductions: {
      'deduction-motive': {
        id: 'deduction-motive',
        clueIds: [],
        description: '',
        isRedHerring: false,
      },
    },
    npcs: {},
    flags: { 'spoke-to-inspector': true },
    factionReputation: {},
    sceneHistory: [],
    settings: {
      fontSize: 'standard' as const,
      highContrast: false,
      reducedMotion: false,
      textSpeed: 'typewriter' as const,
      hintsEnabled: true,
      autoSaveFrequency: 'scene' as const,
      audioVolume: { ambient: 0.5, sfx: 0.5 },
    },
    goToScene: vi.fn(),
    setCheckResult: vi.fn(),
  };

  const useStoreFn = (selector?: (s: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState;
  useStoreFn.getState = () => storeState;

  const snapshot = (s: typeof storeState) => ({
    investigator: s.investigator,
    currentScene: s.currentScene,
    currentCase: s.currentCase,
    clues: s.clues,
    deductions: s.deductions,
    npcs: s.npcs,
    flags: s.flags,
    factionReputation: s.factionReputation,
    sceneHistory: s.sceneHistory,
    settings: s.settings,
  });

  return {
    useStore: useStoreFn,
    buildGameState: snapshot,
    // Reactive snapshot hook (F-042) — in the mock it resolves against the
    // static store state, same shape as buildGameState.
    useGameState: () => snapshot(storeState),
  };
});

describe('ChoicePanel — visibility filtering', () => {
  const choices: Choice[] = [
    {
      id: 'open',
      text: 'Look around',
      outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
    },
    {
      id: 'needs-clue',
      text: 'Examine the bloodstain',
      requiresClue: 'clue-bloodstain',
      outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
    },
    {
      id: 'needs-missing-clue',
      text: 'Analyse the cipher',
      requiresClue: 'clue-cipher', // not in store
      outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
    },
    {
      id: 'needs-deduction',
      text: 'Confront the suspect',
      requiresDeduction: 'deduction-motive',
      outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
    },
    {
      id: 'needs-flag',
      text: 'Mention the inspector',
      requiresFlag: 'spoke-to-inspector',
      outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
    },
    {
      id: 'needs-missing-flag',
      text: 'Reference the guild',
      requiresFlag: 'joined-guild', // not set
      outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders choices whose requirements are met', () => {
    render(<ChoicePanel choices={choices} />);
    expect(screen.getByText('Look around')).toBeInTheDocument();
    expect(screen.getByText('Examine the bloodstain')).toBeInTheDocument();
    expect(screen.getByText('Confront the suspect')).toBeInTheDocument();
    expect(screen.getByText('Mention the inspector')).toBeInTheDocument();
  });

  it('hides choices whose requirements are not met', () => {
    render(<ChoicePanel choices={choices} />);
    expect(screen.queryByText('Analyse the cipher')).not.toBeInTheDocument();
    expect(screen.queryByText('Reference the guild')).not.toBeInTheDocument();
  });

  it('renders nothing when all choices are gated', () => {
    const gated: Choice[] = [
      {
        id: 'gated',
        text: 'Secret path',
        requiresClue: 'clue-nonexistent',
        outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
      },
    ];
    const { container } = render(<ChoicePanel choices={gated} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onChoiceSelected when a choice is clicked', () => {
    const onChoiceSelected = vi.fn();
    render(<ChoicePanel choices={choices} onChoiceSelected={onChoiceSelected} />);
    fireEvent.click(screen.getByText('Look around'));
    expect(onChoiceSelected).toHaveBeenCalledWith('open');
  });
});

// ─── ChoicePanel — Phase 5 disabled choices ───────────────────────────────────
//
// The mocked store above holds ONLY clue-bloodstain / deduction-motive /
// spoke-to-inspector, so `missing-clue` is genuinely unmet at render time —
// these tests exercise real gate failure, not vacuous passes.
describe('ChoicePanel — Phase 5 disabled choices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a disabled choice greyed, non-interactive, non-focusable, with its reason in a list', () => {
    const choices = [
      { id: 'open', text: 'Open ledger', outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
      { id: 'force', text: 'Force the safe', requiresClue: 'missing-clue',
        visibility: 'disabled', gateReason: 'You would need the key first.',
        outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
    ] as unknown as Choice[];

    render(<ChoicePanel choices={choices} />);

    expect(screen.getByRole('button', { name: /Open ledger/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Force the safe/ })).toBeNull();
    expect(screen.getByText('You would need the key first.')).toBeInTheDocument();
    expect(screen.getByText('Force the safe')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Locked choices/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBe(1);
    const locked = screen.getByRole('listitem');
    expect(locked.querySelector('button, a, [tabindex]')).toBeNull();
  });

  it('places the interactive nav BEFORE the locked list in DOM order', () => {
    const choices = [
      { id: 'open', text: 'Open ledger', outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
      { id: 'force', text: 'Force the safe', requiresClue: 'missing-clue',
        visibility: 'disabled', gateReason: 'Locked.',
        outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
    ] as unknown as Choice[];
    render(<ChoicePanel choices={choices} />);
    const nav = screen.getByRole('navigation', { name: /Available choices/ });
    const list = screen.getByRole('list', { name: /Locked choices/ });
    expect(nav.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders a shown-soft-gate choice as interactive despite an unmet gate', () => {
    const choices = [
      { id: 'soft', text: 'Soft gate', requiresClue: 'missing-clue', visibility: 'shown',
        outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
    ] as unknown as Choice[];
    render(<ChoicePanel choices={choices} />);
    expect(screen.getByRole('button', { name: /Soft gate/ })).toBeInTheDocument();
  });

  it('still hides a gated choice with default (absent) visibility', () => {
    const choices = [
      { id: 'open', text: 'Open ledger', outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
      { id: 'secret', text: 'Secret path', requiresClue: 'missing-clue', outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' } },
    ] as unknown as Choice[];
    render(<ChoicePanel choices={choices} />);
    expect(screen.queryByText('Secret path')).toBeNull();
  });
});

// ─── ChoicePanel — end-to-end Advantage badge wiring (F-014) ──────────────────
//
// Proves that ChoicePanel (the real parent) threads computeAdvantage(choice,
// gameState) into ChoiceCard's `hasAdvantage` prop — specifically the Veil
// Sight grant: a Lore check rolls with advantage while the veil-sight flag is
// active, even with NO clue in inventory. This exercises the parent→prop→badge
// path, not the pieces in isolation.
describe('ChoicePanel — Veil Sight advantage badge (parent wiring)', () => {
  // The mocked store is a shared closure object reachable via getState(); mutate
  // its flags here and restore afterwards so sibling tests are unaffected.
  let savedFlags: Record<string, boolean>;

  beforeEach(() => {
    savedFlags = { ...useStore.getState().flags };
  });

  afterEach(() => {
    (useStore.getState() as { flags: Record<string, boolean> }).flags = savedFlags;
  });

  // A Lore check with no advantageIf clue — advantage can only come from Veil Sight.
  const loreChoice: Choice = {
    id: 'lore-check',
    text: 'Read the sigils',
    faculty: 'lore',
    difficulty: 12,
    outcomes: { critical: 's2', success: 's2', partial: 's2', failure: 's2', fumble: 's2' },
  };

  it('shows the Advantage badge for a Lore choice when veil-sight flag is active (no clue needed)', () => {
    (useStore.getState() as { flags: Record<string, boolean> }).flags = {
      ...savedFlags,
      'ability-veil-sight-active': true,
    };
    render(<ChoicePanel choices={[loreChoice]} />);
    expect(screen.getByText('Read the sigils')).toBeInTheDocument();
    // Target the ◈ badge specifically: the button's own accessible name now also
    // carries the pre-roll odds phrase (which includes ", advantage"), so a broad
    // /advantage/i match would be ambiguous (T5).
    expect(screen.getByLabelText('Advantage on this check')).toBeInTheDocument();
  });

  it('does NOT show the Advantage badge for the same Lore choice when veil-sight is inactive and no clue is held', () => {
    (useStore.getState() as { flags: Record<string, boolean> }).flags = {
      ...savedFlags,
      'ability-veil-sight-active': false,
    };
    render(<ChoicePanel choices={[loreChoice]} />);
    expect(screen.getByText('Read the sigils')).toBeInTheDocument();
    expect(screen.queryByLabelText(/advantage/i)).not.toBeInTheDocument();
  });
});
