/**
 * Unit tests for CaseSelection.
 *
 * A failed manifest fetch must surface an error with a way back, rather than
 * leaving the player on "Loading cases…" forever.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CaseSelection } from '../CaseSelection/CaseSelection';
import * as narrativeEngine from '../../engine/narrativeEngine';

describe('CaseSelection — manifest fetch failure', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows an error message instead of loading forever when the manifest fetch fails', async () => {
    vi.spyOn(narrativeEngine, 'fetchManifest').mockRejectedValue(new Error('network down'));

    render(<CaseSelection onSelectCase={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading cases…')).not.toBeInTheDocument();
  });

  it('offers a Back control on error', async () => {
    vi.spyOn(narrativeEngine, 'fetchManifest').mockRejectedValue(new Error('network down'));
    const onBack = vi.fn();

    render(<CaseSelection onSelectCase={() => {}} onBack={onBack} />);

    const backBtn = await screen.findByRole('button', { name: /back/i });
    backBtn.click();
    expect(onBack).toHaveBeenCalled();
  });
});
