/**
 * LetterGuessStrategy - Handles bot letter guessing during gameplay
 */
import { LLMProvider } from '../types';
import { BotConfig, GameContext, PlayerInfo } from '../types';
export declare class LetterGuessStrategy {
    private llm;
    constructor(llm: LLMProvider);
    /**
     * Select the best letter to guess for a target player's word
     */
    guessLetter(_ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    /**
     * Select which opponent to target
     */
    selectTarget(ctx: GameContext, config: BotConfig): Promise<string>;
    /**
     * Select target strategically - prefer players close to elimination
     */
    private selectStrategicTarget;
    /**
     * Extract a valid letter from LLM response
     * Handles various formats like "  D", "D", "The letter D", "I'll guess D", etc.
     */
    private extractLetter;
    /**
     * Fallback letter selection based on frequency
     */
    private selectFallbackLetter;
    /**
     * Adjust temperature based on difficulty
     * Lower = more focused/deterministic, Higher = more creative/random
     */
    private getTemperatureForDifficulty;
    /**
     * Decide whether the bot should guess BLANK instead of a regular letter
     * Returns true if bot should guess BLANK
     */
    shouldGuessBlank(targetPlayer: PlayerInfo, config: BotConfig): boolean;
}
//# sourceMappingURL=LetterGuessStrategy.d.ts.map