export class ScoringEngine {
  // Position-based scoring: 5, 10, 15 repeating pattern
  private readonly POSITION_POINTS = [5, 10, 15];

  // Bonus for completing a word (guessing final letter or full word)
  public readonly WORD_COMPLETION_BONUS = 50;

  /**
   * Get points for a specific position (0-indexed)
   * Position 0 = 5 pts, Position 1 = 10 pts, Position 2 = 15 pts
   * Position 3 = 5 pts, Position 4 = 10 pts, Position 5 = 15 pts (repeating)
   */
  getPositionPoints(position: number): number {
    return this.POSITION_POINTS[position % 3];
  }

  /**
   * Calculate score for revealed positions
   * @param positions Array of position indices that were revealed
   * @param isBlank Optional function to check if a position is a blank (unused, kept for backwards compatibility)
   */
  calculateScore(positions: number[], isBlank?: (pos: number) => boolean): number {
    return positions.reduce((total, pos) => {
      return total + this.getPositionPoints(pos);
    }, 0);
  }

  /**
   * Get all position points for a given word length (for UI display)
   */
  getPositionPointsArray(wordLength: number): number[] {
    return Array.from({ length: wordLength }, (_, i) => this.getPositionPoints(i));
  }

  /**
   * Legacy method for backwards compatibility - now calculates based on positions
   * @deprecated Use calculateScore with positions instead
   */
  calculateScoreLegacy(_letter: string, occurrences: number): number {
    // For backwards compatibility, assume average position value
    return occurrences * 10; // Average of 5+10+15 = 30/3 = 10
  }
}
