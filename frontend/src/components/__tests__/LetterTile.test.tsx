import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LetterTile from '../LetterTile';

describe('LetterTile Component', () => {
  it('should render revealed letter', () => {
    render(<LetterTile letter="A" isRevealed={true} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render hidden letter with empty box', () => {
    render(<LetterTile letter="A" isRevealed={false} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('should show index when provided', () => {
    render(<LetterTile letter="A" isRevealed={false} index={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should apply highlight class when highlighted', () => {
    const { container } = render(<LetterTile letter="A" isRevealed={true} isHighlighted={true} />);
    const tile = container.firstChild;
    expect(tile).toHaveClass('ring-2');
  });

  it('should apply correct styles for revealed letters', () => {
    const { container } = render(<LetterTile letter="A" isRevealed={true} />);
    const tile = container.firstChild;
    expect(tile).toHaveClass('bg-accent');
  });

  it('should apply correct styles for hidden letters', () => {
    const { container } = render(<LetterTile letter="A" isRevealed={false} />);
    const tile = container.firstChild;
    expect(tile).toHaveClass('bg-gray-700');
  });
});
