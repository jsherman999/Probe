import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayerBoard from '../PlayerBoard';

describe('PlayerBoard Component', () => {
  const mockPlayer = {
    userId: 'player-1',
    username: 'TestPlayer',
    displayName: 'Test Player',
    secretWord: 'PROBE',
    revealedPositions: [0, 2, 4],
    totalScore: 15,
    isEliminated: false,
  };

  it('should render player name', () => {
    render(<PlayerBoard player={mockPlayer} />);
    expect(screen.getByText('Test Player')).toBeInTheDocument();
  });

  it('should render player score', () => {
    render(<PlayerBoard player={mockPlayer} />);
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('should render all letters in word', () => {
    render(<PlayerBoard player={mockPlayer} />);
    
    // Should render 5 letter tiles for "PROBE"
    const tiles = screen.getAllByRole('generic', { hidden: true }).filter(
      el => el.className.includes('rounded')
    );
    expect(tiles.length).toBeGreaterThanOrEqual(5);
  });

  it('should show revealed letters', () => {
    render(<PlayerBoard player={mockPlayer} />);
    
    // Positions 0, 2, 4 are revealed (P, O, E)
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('should highlight when isActive is true', () => {
    const { container } = render(<PlayerBoard player={mockPlayer} isActive={true} />);
    expect(container.firstChild).toHaveClass('ring-2');
  });

  it('should highlight as target when isTarget is true', () => {
    const { container } = render(<PlayerBoard player={mockPlayer} isTarget={true} />);
    expect(container.firstChild).toHaveClass('ring-yellow-500');
  });

  it('should show eliminated state', () => {
    const eliminatedPlayer = { ...mockPlayer, isEliminated: true };
    const { container } = render(<PlayerBoard player={eliminatedPlayer} />);
    expect(container.firstChild).toHaveClass('opacity-50');
  });

  it('should show ELIMINATED badge for eliminated players', () => {
    const eliminatedPlayer = { ...mockPlayer, isEliminated: true };
    render(<PlayerBoard player={eliminatedPlayer} />);
    expect(screen.getByText('ELIMINATED')).toBeInTheDocument();
  });
});
