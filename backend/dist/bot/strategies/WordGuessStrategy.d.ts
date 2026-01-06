/**
 * WordGuessStrategy - Handles bot full word guessing decisions
 *
 * This strategy is VERY conservative - bots should primarily guess letters.
 * Word guessing is only attempted when:
 * 1. At least 80% of the word is revealed
 * 2. The bot is highly confident it knows the word
 * 3. The guessed word is a valid English word (verified against dictionary)
 */
import { LLMProvider } from '../types';
import { WordValidator } from '../../game/WordValidator';
import { BotConfig, GameContext, PlayerInfo } from '../types';
export declare class WordGuessStrategy {
    private llm;
    private wordValidator;
    constructor(llm: LLMProvider, wordValidator?: WordValidator);
    /**
     * Decide whether the bot should attempt a full word guess
     * VERY conservative - default to letter guessing
     */
    shouldGuessWord(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;
    /**
     * Check if we can confidently guess the word (for hard bots)
     */
    private canConfidentlyGuess;
    /**
     * Generate a word candidate (without committing to guessing)
     */
    private generateWordCandidate;
    /**
     * Generate a word guess for the target player's word
     * Only called when shouldGuessWord returned true
     */
    guessWord(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    /**
     * Check if a word matches the revealed pattern
     */
    private matchesPattern;
    /**
     * Extract a clean word from LLM response
     */
    private extractWord;
}
//# sourceMappingURL=WordGuessStrategy.d.ts.map