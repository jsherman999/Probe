/**
 * WordSelectionStrategy - Handles bot word selection during the word selection phase
 */
import { OllamaService } from '../OllamaService';
import { WordValidator } from '../../game/WordValidator';
import { BotConfig, GameContext, WordSelection } from '../types';
export declare class WordSelectionStrategy {
    private ollama;
    private wordValidator;
    constructor(ollama: OllamaService, wordValidator: WordValidator);
    /**
     * Select a word for the bot to use in the game
     */
    selectWord(_ctx: GameContext, config: BotConfig): Promise<WordSelection>;
    /**
     * Extract a clean word from LLM response
     */
    private extractWord;
    /**
     * Apply padding strategy based on difficulty
     */
    private applyPaddingStrategy;
    /**
     * Select a fallback word if LLM fails
     */
    private selectFallbackWord;
}
//# sourceMappingURL=WordSelectionStrategy.d.ts.map