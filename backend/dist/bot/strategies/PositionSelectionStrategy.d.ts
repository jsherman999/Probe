/**
 * PositionSelectionStrategy - Handles bot position selection when targeted
 *
 * When an opponent guesses a letter that appears multiple times in the bot's word,
 * or guesses "BLANK" when there are multiple blanks, the bot must choose which
 * position to reveal. This strategy makes that decision.
 */
import { LLMProvider } from '../types';
import { BotConfig, GameContext } from '../types';
export declare class PositionSelectionStrategy {
    private llm;
    private scoringEngine;
    constructor(llm: LLMProvider);
    /**
     * Select which blank position to reveal when opponent guesses "BLANK"
     *
     * Strategy: Reveal the blank that gives the least information
     * (usually prefer back padding over front padding)
     */
    selectBlankPosition(positions: number[], _ctx: GameContext, config: BotConfig): Promise<number>;
    /**
     * Select which duplicate letter position to reveal
     *
     * Strategy: Reveal the position that gives opponent the least advantage
     * Consider:
     * - Scoring (lower-scoring positions first)
     * - Word structure (edge positions may reveal more about word shape)
     * - Pattern completion (avoid revealing letters that complete common patterns)
     */
    selectDuplicatePosition(positions: number[], letter: string, ctx: GameContext, config: BotConfig): Promise<number>;
    /**
     * Select position that gives minimum points to opponent
     */
    private selectByScoring;
    /**
     * Use LLM to make a strategic duplicate position selection
     */
    private selectStrategicDuplicatePosition;
}
//# sourceMappingURL=PositionSelectionStrategy.d.ts.map