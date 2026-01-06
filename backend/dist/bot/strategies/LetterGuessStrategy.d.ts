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
}
//# sourceMappingURL=LetterGuessStrategy.d.ts.map