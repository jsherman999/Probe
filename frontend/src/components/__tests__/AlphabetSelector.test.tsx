import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlphabetSelector from '../AlphabetSelector';
import userEvent from '@testing-library/user-event';

describe('AlphabetSelector Component', () => {
  it('should render all 26 letters', () => {
    render(<AlphabetSelector usedLetters={[]} onSelect={() => {}} />);
    
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of alphabet) {
      expect(screen.getByText(letter, { selector: '.text-3xl' })).toBeInTheDocument();
    }
  });

  it('should show point values for each letter', () => {
    render(<AlphabetSelector usedLetters={[]} onSelect={() => {}} />);
    
    // Check for some specific point values
    expect(screen.getByText('1pt')).toBeInTheDocument(); // E, A, I, etc.
    expect(screen.getByText('10pt')).toBeInTheDocument(); // Q, Z
  });

  it('should call onSelect when letter is clicked', async () => {
    const user = userEvent.setup();
    let selectedLetter = '';
    
    render(<AlphabetSelector usedLetters={[]} onSelect={(letter) => { selectedLetter = letter; }} />);
    
    const letterA = screen.getByText('A', { selector: '.text-3xl' });
    await user.click(letterA);
    
    expect(selectedLetter).toBe('A');
  });

  it('should disable used letters', () => {
    render(<AlphabetSelector usedLetters={['A', 'E', 'Z']} onSelect={() => {}} />);
    
    const letterA = screen.getByText('A', { selector: '.text-3xl' }).closest('button');
    const letterB = screen.getByText('B', { selector: '.text-3xl' }).closest('button');
    
    expect(letterA).toBeDisabled();
    expect(letterB).not.toBeDisabled();
  });

  it('should not call onSelect for disabled letters', async () => {
    const user = userEvent.setup();
    let selectedLetter = '';
    
    render(<AlphabetSelector usedLetters={['A']} onSelect={(letter) => { selectedLetter = letter; }} />);
    
    const letterA = screen.getByText('A', { selector: '.text-3xl' });
    await user.click(letterA);
    
    expect(selectedLetter).toBe('');
  });

  it('should apply disabled styles to used letters', () => {
    render(<AlphabetSelector usedLetters={['A']} onSelect={() => {}} />);
    
    const letterA = screen.getByText('A', { selector: '.text-3xl' }).closest('button');
    expect(letterA).toHaveClass('opacity-30');
  });
});
