/**
 * BotStrategy - Unified strategy class combining all bot decision-making
 */
import { LLMProvider } from '../types';
import { WordValidator } from '../../game/WordValidator';
import { BotConfig, GameContext, PlayerInfo, WordSelection, IBotStrategy } from '../types';
export declare class BotStrategy implements IBotStrategy {
    private wordSelectionStrategy;
    private letterGuessStrategy;
    private wordGuessStrategy;
    private positionSelectionStrategy;
    constructor(llm: LLMProvider, wordValidator: WordValidator);
    /**
     * Select a word for the bot to use
     */
    selectWord(ctx: GameContext, config: BotConfig): Promise<WordSelection>;
    /**
     * Select which opponent to target
     */
    selectTarget(ctx: GameContext, config: BotConfig): Promise<string>;
    /**
     * Guess a letter in the target player's word
     */
    guessLetter(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    /**
     * Decide whether to attempt a full word guess
     */
    shouldGuessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;
    /**
     * Guess the full word
     */
    guessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    /**
     * Select which blank position to reveal (when targeted)
     */
    selectBlankPosition(positions: number[], ctx: GameContext, config: BotConfig): Promise<number>;
    /**
     * Select which duplicate letter position to reveal (when targeted)
     */
    selectDuplicatePosition(positions: number[], letter: string, ctx: GameContext, config: BotConfig): Promise<number>;
}
export { WordSelectionStrategy } from './WordSelectionStrategy';
export { LetterGuessStrategy } from './LetterGuessStrategy';
export { WordGuessStrategy } from './WordGuessStrategy';
export { PositionSelectionStrategy } from './PositionSelectionStrategy';
//# sourceMappingURL=index.d.ts.map