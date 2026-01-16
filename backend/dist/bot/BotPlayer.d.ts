/**
 * BotPlayer - Represents an individual AI player in the game
 */
import { WordValidator } from '../game/WordValidator';
import { BotConfig, BotConfigInput, GameContext, PlayerInfo, WordSelection, TurnAction, LLMProvider } from './types';
export declare class BotPlayer {
    readonly id: string;
    readonly displayName: string;
    readonly isBot = true;
    readonly config: BotConfig;
    private strategy;
    private thinkingDelayBase;
    constructor(configInput: BotConfigInput, provider: LLMProvider, wordValidator: WordValidator);
    /**
     * Calculate base thinking delay based on difficulty
     * Harder bots "think" longer (more realistic)
     */
    private calculateThinkingDelay;
    /**
     * Simulate thinking time for realistic gameplay
     */
    private simulateThinking;
    /**
     * Select a word during the word selection phase
     */
    selectWord(ctx: GameContext): Promise<WordSelection>;
    /**
     * Take a turn during active gameplay
     */
    takeTurn(ctx: GameContext): Promise<TurnAction>;
    /**
     * Select which blank position to reveal when targeted
     */
    selectBlankPosition(positions: number[], ctx: GameContext): Promise<number>;
    /**
     * Select which duplicate letter position to reveal when targeted
     */
    selectDuplicatePosition(positions: number[], letter: string, ctx: GameContext): Promise<number>;
    /**
     * Get serializable player info
     */
    toPlayerInfo(wordLength: number, revealedPositions: (string | null)[], missedLetters: string[], guessedWords: string[], totalScore: number, isEliminated: boolean, turnOrder: number, frontPadding?: number, backPadding?: number): PlayerInfo;
}
//# sourceMappingURL=BotPlayer.d.ts.map