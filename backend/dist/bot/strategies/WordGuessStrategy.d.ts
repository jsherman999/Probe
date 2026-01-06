/**
 * WordGuessStrategy - Handles bot full word guessing decisions
 */
import { OllamaService } from '../OllamaService';
import { BotConfig, GameContext, PlayerInfo } from '../types';
export declare class WordGuessStrategy {
    private ollama;
    constructor(ollama: OllamaService);
    /**
     * Decide whether the bot should attempt a full word guess
     */
    shouldGuessWord(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;
    /**
     * Ask LLM if it's confident enough to guess
     */
    private askLLMIfShouldGuess;
    /**
     * Generate a word guess for the target player's word
     */
    guessWord(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    /**
     * Extract a clean word from LLM response
     */
    private extractWord;
    /**
     * Construct a fallback guess by filling in blanks with common letters
     */
    private constructFallbackGuess;
}
//# sourceMappingURL=WordGuessStrategy.d.ts.map