/**
 * WordSelectionStrategy - Handles bot word selection during the word selection phase
 */
import { LLMProvider } from '../types';
import { WordValidator } from '../../game/WordValidator';
import { BotConfig, GameContext, WordSelection } from '../types';
export declare class WordSelectionStrategy {
    private llm;
    private wordValidator;
    constructor(llm: LLMProvider, wordValidator: WordValidator);
    /**
     * Select a word for the bot to use in the game
     */
    selectWord(_ctx: GameContext, config: BotConfig): Promise<WordSelection>;
    /**
     * Extract a clean word from LLM response
     */
    private extractWord;
    /**
     * Apply padding strategy - all bots randomly add 0-3 blanks to front and back
     * Total word + padding must not exceed 12 characters
     */
    private applyPaddingStrategy;
    /**
     * Select a fallback word if LLM fails
     */
    private selectFallbackWord;
}
//# sourceMappingURL=WordSelectionStrategy.d.ts.map