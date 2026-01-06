/**
 * BotStrategy - Unified strategy class combining all bot decision-making
 */

import { LLMProvider } from '../types';
import { WordValidator } from '../../game/WordValidator';
import {
  BotConfig,
  GameContext,
  PlayerInfo,
  WordSelection,
  IBotStrategy,
} from '../types';

import { WordSelectionStrategy } from './WordSelectionStrategy';
import { LetterGuessStrategy } from './LetterGuessStrategy';
import { WordGuessStrategy } from './WordGuessStrategy';
import { PositionSelectionStrategy } from './PositionSelectionStrategy';

export class BotStrategy implements IBotStrategy {
  private wordSelectionStrategy: WordSelectionStrategy;
  private letterGuessStrategy: LetterGuessStrategy;
  private wordGuessStrategy: WordGuessStrategy;
  private positionSelectionStrategy: PositionSelectionStrategy;

  constructor(llm: LLMProvider, wordValidator: WordValidator) {
    this.wordSelectionStrategy = new WordSelectionStrategy(llm, wordValidator);
    this.letterGuessStrategy = new LetterGuessStrategy(llm);
    this.wordGuessStrategy = new WordGuessStrategy(llm, wordValidator);  // Pass validator for word validation
    this.positionSelectionStrategy = new PositionSelectionStrategy(llm);
  }


  /**
   * Select a word for the bot to use
   */
  async selectWord(ctx: GameContext, config: BotConfig): Promise<WordSelection> {
    return this.wordSelectionStrategy.selectWord(ctx, config);
  }

  /**
   * Select which opponent to target
   */
  async selectTarget(ctx: GameContext, config: BotConfig): Promise<string> {
    return this.letterGuessStrategy.selectTarget(ctx, config);
  }

  /**
   * Guess a letter in the target player's word
   */
  async guessLetter(
    ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string> {
    return this.letterGuessStrategy.guessLetter(ctx, targetPlayer, config);
  }

  /**
   * Decide whether to guess BLANK instead of a regular letter
   */
  shouldGuessBlank(
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): boolean {
    return this.letterGuessStrategy.shouldGuessBlank(targetPlayer, config);
  }

  /**
   * Decide whether to attempt a full word guess
   */
  async shouldGuessWord(
    ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<boolean> {
    return this.wordGuessStrategy.shouldGuessWord(ctx, targetPlayer, config);
  }

  /**
   * Guess the full word
   */
  async guessWord(
    ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string> {
    return this.wordGuessStrategy.guessWord(ctx, targetPlayer, config);
  }

  /**
   * Select which blank position to reveal (when targeted)
   */
  async selectBlankPosition(
    positions: number[],
    ctx: GameContext,
    config: BotConfig
  ): Promise<number> {
    return this.positionSelectionStrategy.selectBlankPosition(positions, ctx, config);
  }

  /**
   * Select which duplicate letter position to reveal (when targeted)
   */
  async selectDuplicatePosition(
    positions: number[],
    letter: string,
    ctx: GameContext,
    config: BotConfig
  ): Promise<number> {
    return this.positionSelectionStrategy.selectDuplicatePosition(
      positions,
      letter,
      ctx,
      config
    );
  }
}

// Re-export individual strategies for testing
export { WordSelectionStrategy } from './WordSelectionStrategy';
export { LetterGuessStrategy } from './LetterGuessStrategy';
export { WordGuessStrategy } from './WordGuessStrategy';
export { PositionSelectionStrategy } from './PositionSelectionStrategy';
