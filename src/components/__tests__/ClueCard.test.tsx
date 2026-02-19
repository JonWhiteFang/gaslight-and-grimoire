/**
 * Unit tests for ClueCard status rendering.
 *
 * Req 7.3: Each of the six status states must render the correct visual indicator.
 *
 * Sub-task 12.1
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClueCard } from '../EvidenceBoard/ClueCard';
import type { Clue } from '../../types';

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeClue(overrides: Partial<Clue> = {}): Clue {
  return {
    id: 'clue-1',
    type: 'physical',
    title: 'Torn Glove',
    description: 'A leather glove found near the scene.',
    sceneSource: 'scene-1',
    tags: ['location:whitechapel'],
    status: 'examined',
    isRevealed: true,
    ...overrides,
  };
}

// ─── data-status attribute (all six states) ───────────────────────────────────

describe('ClueCard — data-status attribute', () => {
  const statuses: Clue['status'][] = [
    'new',
    'examined',
    'connected',
    'deduced',
    'contested',
    'spent',
  ];

  it.each(statuses)('status "%s" sets data-status="%s"', (status) => {
    render(<ClueCard clue={makeClue({ status })} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('data-status', status);
  });
});

// ─── "new" — pulsing amber glow + "NEW" badge ─────────────────────────────────

describe('ClueCard — new status', () => {
  it('renders "NEW" badge', () => {
    render(<ClueCard clue={makeClue({ status: 'new' })} />);
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('applies animate-pulse class for amber glow', () => {
    render(<ClueCard clue={makeClue({ status: 'new' })} />);
    const card = screen.getByRole('button');
    expect(card.className).toMatch(/animate-pulse/);
  });

  it('applies amber ring class', () => {
    render(<ClueCard clue={makeClue({ status: 'new' })} />);
    const card = screen.getByRole('button');
    expect(card.className).toMatch(/ring-amber/);
  });
});

// ─── "examined" — standard appearance, no special indicator ──────────────────

describe('ClueCard — examined status', () => {
  it('renders no badge or status icon', () => {
    render(<ClueCard clue={makeClue({ status: 'examined' })} />);
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Deduced')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contested')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Spent')).not.toBeInTheDocument();
  });

  it('does not apply animate-pulse', () => {
    render(<ClueCard clue={makeClue({ status: 'examined' })} />);
    const card = screen.getByRole('button');
    expect(card.className).not.toMatch(/animate-pulse/);
  });
});

// ─── "connected" — gold border indicator ─────────────────────────────────────

describe('ClueCard — connected status', () => {
  it('applies yellow/gold ring class', () => {
    render(<ClueCard clue={makeClue({ status: 'connected' })} />);
    const card = screen.getByRole('button');
    expect(card.className).toMatch(/ring-yellow/);
  });

  it('renders no badge or icon', () => {
    render(<ClueCard clue={makeClue({ status: 'connected' })} />);
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Deduced')).not.toBeInTheDocument();
  });
});

// ─── "deduced" — brass pin icon (📌) + green glow ────────────────────────────

describe('ClueCard — deduced status', () => {
  it('renders brass pin icon with aria-label "Deduced"', () => {
    render(<ClueCard clue={makeClue({ status: 'deduced' })} />);
    expect(screen.getByLabelText('Deduced')).toBeInTheDocument();
    expect(screen.getByLabelText('Deduced').textContent).toBe('📌');
  });

  it('applies green ring/glow class', () => {
    render(<ClueCard clue={makeClue({ status: 'deduced' })} />);
    const card = screen.getByRole('button');
    expect(card.className).toMatch(/ring-green/);
  });
});

// ─── "contested" — red border + question mark icon (❓) ───────────────────────

describe('ClueCard — contested status', () => {
  it('renders question mark icon with aria-label "Contested"', () => {
    render(<ClueCard clue={makeClue({ status: 'contested' })} />);
    expect(screen.getByLabelText('Contested')).toBeInTheDocument();
    expect(screen.getByLabelText('Contested').textContent).toBe('❓');
  });

  it('applies red ring class', () => {
    render(<ClueCard clue={makeClue({ status: 'contested' })} />);
    const card = screen.getByRole('button');
    expect(card.className).toMatch(/ring-red/);
  });
});

// ─── "spent" — greyed out (opacity-50) + checkmark (✓) ───────────────────────

describe('ClueCard — spent status', () => {
  it('renders checkmark icon with aria-label "Spent"', () => {
    render(<ClueCard clue={makeClue({ status: 'spent' })} />);
    expect(screen.getByLabelText('Spent')).toBeInTheDocument();
    expect(screen.getByLabelText('Spent').textContent).toBe('✓');
  });

  it('applies opacity-50 class for greyed-out appearance', () => {
    render(<ClueCard clue={makeClue({ status: 'spent' })} />);
    const card = screen.getByRole('button');
    expect(card.className).toMatch(/opacity-50/);
  });
});

// ─── Keyboard: Spacebar initiates connection ──────────────────────────────────

describe('ClueCard — keyboard navigation', () => {
  it('calls onInitiateConnection with clue id when Spacebar is pressed', async () => {
    const handler = vi.fn();
    render(
      <ClueCard
        clue={makeClue({ id: 'clue-42', status: 'examined' })}
        onInitiateConnection={handler}
      />,
    );
    const card = screen.getByRole('button');
    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(handler).toHaveBeenCalledWith('clue-42');
  });
});

// ─── ARIA label ───────────────────────────────────────────────────────────────

describe('ClueCard — ARIA', () => {
  it('has an aria-label describing the clue title and status', () => {
    render(<ClueCard clue={makeClue({ title: 'Torn Glove', status: 'new' })} />);
    expect(
      screen.getByRole('button', { name: /Torn Glove/i }),
    ).toBeInTheDocument();
  });
});
