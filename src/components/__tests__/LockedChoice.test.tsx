import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LockedChoice } from '../shared';

describe('LockedChoice', () => {
  it('renders the choice text and the gateReason as visible prose', () => {
    render(<LockedChoice text="Force the door" gateReason="The lock holds fast." />);
    expect(screen.getByText('Force the door')).toBeInTheDocument();
    expect(screen.getByText('The lock holds fast.')).toBeInTheDocument();
  });

  it('is not a button and exposes no interactive role', () => {
    render(<LockedChoice text="Force the door" gateReason="Locked." />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders as a listitem (for placement inside the locked <ul>)', () => {
    render(
      <ul>
        <LockedChoice text="Force the door" gateReason="Locked." />
      </ul>,
    );
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });
});
