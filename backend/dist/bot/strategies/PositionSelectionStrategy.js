"use strict";
/**
 * PositionSelectionStrategy - Handles bot position selection when targeted
 *
 * When an opponent guesses a letter that appears multiple times in the bot's word,
 * or guesses "BLANK" when there are multiple blanks, the bot must choose which
 * position to reveal. This strategy makes that decision.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionSelectionStrategy = void 0;
const ScoringEngine_1 = require("../../game/ScoringEngine");
class PositionSelectionStrategy {
    llm;
    scoringEngine;
    constructor(llm) {
        this.llm = llm;
        this.scoringEngine = new ScoringEngine_1.ScoringEngine();
    }
    /**
     * Select which blank position to reveal when opponent guesses "BLANK"
     *
     * Strategy: Reveal the blank that gives the least information
     * (usually prefer back padding over front padding)
     */
    async selectBlankPosition(positions, _ctx, config) {
        if (positions.length === 1) {
            return positions[0];
        }
        // Strategy varies by difficulty
        switch (config.difficulty) {
            case 'easy':
                // Easy bot: random selection
                return positions[Math.floor(Math.random() * positions.length)];
            case 'hard':
                // Hard bot: strategic selection - prefer revealing back padding
                // (back padding is typically less informative about word structure)
                return Math.max(...positions);
            default:
                // Medium: slightly strategic - 70% chance to pick strategically
                if (Math.random() < 0.7) {
                    return Math.max(...positions);
                }
                return positions[Math.floor(Math.random() * positions.length)];
        }
    }
    /**
     * Select which duplicate letter position to reveal
     *
     * Strategy: Reveal the position that gives opponent the least advantage
     * Consider:
     * - Scoring (lower-scoring positions first)
     * - Word structure (edge positions may reveal more about word shape)
     * - Pattern completion (avoid revealing letters that complete common patterns)
     */
    async selectDuplicatePosition(positions, letter, ctx, config) {
        if (positions.length === 1) {
            return positions[0];
        }
        switch (config.difficulty) {
            case 'easy':
                // Easy bot: random selection
                return positions[Math.floor(Math.random() * positions.length)];
            case 'hard':
                // Hard bot: use LLM for strategic decision
                return this.selectStrategicDuplicatePosition(positions, letter, ctx, config);
            default:
                // Medium: use scoring-based heuristic
                return this.selectByScoring(positions);
        }
    }
    /**
     * Select position that gives minimum points to opponent
     */
    selectByScoring(positions) {
        let minScore = Infinity;
        let bestPosition = positions[0];
        for (const pos of positions) {
            const score = this.scoringEngine.getPositionPoints(pos);
            if (score < minScore) {
                minScore = score;
                bestPosition = pos;
            }
        }
        return bestPosition;
    }
    /**
     * Use LLM to make a strategic duplicate position selection
     */
    async selectStrategicDuplicatePosition(positions, letter, ctx, config) {
        // Get the bot's current word state
        const myWord = ctx.myPaddedWord || ctx.myWord || '';
        const revealed = ctx.myRevealedPositions || [];
        // Build a visualization of the word
        const wordDisplay = myWord
            .split('')
            .map((char, idx) => {
            if (revealed[idx])
                return char;
            if (positions.includes(idx))
                return `[${char}]`; // Mark positions with the duplicate letter
            return '•';
        })
            .join('');
        // Calculate scores for each position
        const positionScores = positions.map(pos => ({
            pos,
            score: this.scoringEngine.getPositionPoints(pos),
        }));
        const prompt = `You are playing a word guessing game and must choose which position to reveal.

Your word: ${wordDisplay}
(• = hidden, [${letter}] = positions you must choose from)

The opponent guessed "${letter}" which appears at positions: ${positions.join(', ')}
You must reveal ONE of these positions.

Position scores (points opponent gains):
${positionScores.map(ps => `- Position ${ps.pos}: ${ps.score} points`).join('\n')}

Strategic considerations:
- Lower-scoring positions give opponent fewer points
- Edge positions (first/last) may reveal word boundaries
- Some positions may complete recognizable patterns

Which position number should you reveal? Consider both scoring and strategic value.
Return ONLY the position number.`;
        try {
            const response = await this.llm.generate(config.modelName, prompt, { ...config.ollamaOptions, temperature: 0.3, num_predict: 10 });
            const selectedPos = parseInt(response.trim().match(/\d+/)?.[0] || '', 10);
            if (positions.includes(selectedPos)) {
                console.log(`[Bot ${config.displayName}] LLM selected position ${selectedPos} for duplicate "${letter}"`);
                return selectedPos;
            }
        }
        catch (error) {
            console.error(`[Bot ${config.displayName}] Position selection error: ${error.message}`);
        }
        // Fallback to scoring-based selection
        return this.selectByScoring(positions);
    }
}
exports.PositionSelectionStrategy = PositionSelectionStrategy;
//# sourceMappingURL=PositionSelectionStrategy.js.map