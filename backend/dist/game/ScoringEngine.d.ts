export declare class ScoringEngine {
    private readonly POSITION_POINTS;
    readonly WORD_COMPLETION_BONUS = 50;
    /**
     * Get points for a specific position (0-indexed)
     * Position 0 = 5 pts, Position 1 = 10 pts, Position 2 = 15 pts
     * Position 3 = 5 pts, Position 4 = 10 pts, Position 5 = 15 pts (repeating)
     */
    getPositionPoints(position: number): number;
    /**
     * Calculate score for revealed positions
     * @param positions Array of position indices that were revealed
     * @param isBlank Optional function to check if a position is a blank (unused, kept for backwards compatibility)
     */
    calculateScore(positions: number[], isBlank?: (pos: number) => boolean): number;
    /**
     * Get all position points for a given word length (for UI display)
     */
    getPositionPointsArray(wordLength: number): number[];
    /**
     * Legacy method for backwards compatibility - now calculates based on positions
     * @deprecated Use calculateScore with positions instead
     */
    calculateScoreLegacy(_letter: string, occurrences: number): number;
}
//# sourceMappingURL=ScoringEngine.d.ts.map