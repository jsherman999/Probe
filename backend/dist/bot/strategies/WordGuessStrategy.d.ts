/**
 * WordGuessStrategy - Handles bot full word guessing decisions
 *
 * This strategy is now more aggressive - bots will attempt word guesses when:
 * 1. At least 50% of the word is revealed (for hard bots)
 * 2. At least 60% revealed for medium bots
 * 3. At least 70% revealed for easy bots
 * 4. The guessed word must be a valid English word
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
     * More aggressive than before - bots will try guessing earlier
     * ALWAYS attempts when only 1 position remains unrevealed
     */
    shouldGuessWord(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;
    /**
     * Build a clean pattern for LLM, handling blanks properly
     * Returns { pattern, actualLength } where pattern uses * for blanks and _ for unknown letters
     */
    private buildPatternForLLM;
    /**
     * Generate a word candidate (without committing to guessing)
     */
    private generateWordCandidate;
    /**
     * Generate a word guess for the target player's word
     * Only called when shouldGuessWord returned true
     * Checks guessedWords to avoid duplicate guesses
     */
    guessWord(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    /**
     * Check if a word matches the core pattern (excluding blank padding positions)
     */
    private matchesCorePattern;
    /**
     * Extract a clean word from LLM response
     */
    private extractWord;
}
//# sourceMappingURL=WordGuessStrategy.d.ts.map