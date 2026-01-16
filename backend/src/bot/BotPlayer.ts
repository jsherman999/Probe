/**
 * BotPlayer - Represents an individual AI player in the game
 */

import crypto from 'crypto';
import { WordValidator } from '../game/WordValidator';
import { BotStrategy } from './strategies';
import {
  BotConfig,
  BotConfigInput,
  GameContext,
  PlayerInfo,
  WordSelection,
  TurnAction,
  BotDifficulty,
  LLMProvider,
} from './types';

export class BotPlayer {
  public readonly id: string;
  public readonly displayName: string;
  public readonly isBot = true;
  public readonly config: BotConfig;

  private strategy: BotStrategy;
  private thinkingDelayBase: number;

  constructor(
    configInput: BotConfigInput,
    provider: LLMProvider,
    wordValidator: WordValidator
  ) {
    // Generate unique bot ID
    this.id = `bot_${crypto.randomUUID()}`;

    // Build full config with defaults
    this.config = {
      id: this.id,
      displayName: configInput.displayName || 'Bot Player',
      modelName: configInput.modelName,
      ollamaOptions: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        num_predict: 100,
        ...configInput.ollamaOptions,
      },
      personality: configInput.personality,
      difficulty: configInput.difficulty || 'medium',
      provider: configInput.provider || 'ollama',
    };

    this.displayName = this.config.displayName;
    this.strategy = new BotStrategy(provider, wordValidator);
    this.thinkingDelayBase = this.calculateThinkingDelay(this.config.difficulty);
  }

  /**
   * Calculate base thinking delay based on difficulty
   * Harder bots "think" longer (more realistic)
   */
  private calculateThinkingDelay(difficulty: BotDifficulty): number {
    switch (difficulty) {
      case 'easy':
        return 1000;  // 1 second
      case 'hard':
        return 3000;  // 3 seconds
      default:
        return 2000;  // 2 seconds
    }
  }

  /**
   * Simulate thinking time for realistic gameplay
   */
  private async simulateThinking(overrideMs?: number): Promise<void> {
    const baseDelay = overrideMs ?? this.thinkingDelayBase;
    // Add randomness (±30%)
    const variance = baseDelay * 0.3;
    const actualDelay = baseDelay + (Math.random() * variance * 2 - variance);

    return new Promise(resolve => setTimeout(resolve, Math.max(500, actualDelay)));
  }

  /**
   * Select a word during the word selection phase
   */
  async selectWord(ctx: GameContext): Promise<WordSelection> {
    console.log(`[${this.displayName}] Selecting word...`);
    await this.simulateThinking();

    try {
      const selection = await this.strategy.selectWord(ctx, this.config);
      console.log(`[${this.displayName}] Word selected (length: ${selection.word.length})`);
      return selection;
    } catch (error: any) {
      console.error(`[${this.displayName}] Word selection failed: ${error.message}`);
      // Return a safe fallback
      return { word: 'ROBOT', frontPadding: 0, backPadding: 0 };
    }
  }

  /**
   * Take a turn during active gameplay
   */
  async takeTurn(ctx: GameContext): Promise<TurnAction> {
    console.log(`[${this.displayName}] Taking turn...`);
    await this.simulateThinking();

    try {
      // Select target
      const targetId = await this.strategy.selectTarget(ctx, this.config);
      const target = ctx.players.find(p => p.id === targetId);

      if (!target) {
        throw new Error('No valid target found');
      }

      console.log(`[${this.displayName}] Targeting: ${target.displayName}`);

      // Decide: word guess, blank guess, or letter guess?
      const shouldGuessWord = await this.strategy.shouldGuessWord(ctx, target, this.config);

      if (shouldGuessWord) {
        try {
          const word = await this.strategy.guessWord(ctx, target, this.config);
          console.log(`[${this.displayName}] Attempting word guess: ${word}`);
          return { type: 'wordGuess', targetPlayerId: targetId, word };
        } catch (wordGuessError: any) {
          // Word guess failed (no valid word found) - fall back to letter guess
          console.log(`[${this.displayName}] Word guess failed (${wordGuessError.message}), falling back to letter guess`);
        }
      }

      // Check if we should guess BLANK
      const shouldGuessBlank = this.strategy.shouldGuessBlank(target, this.config);
      if (shouldGuessBlank) {
        console.log(`[${this.displayName}] Guessing BLANK`);
        return { type: 'letterGuess', targetPlayerId: targetId, letter: 'BLANK' };
      }

      // Letter guess (default or fallback)
      const letter = await this.strategy.guessLetter(ctx, target, this.config);
      console.log(`[${this.displayName}] Guessing letter: ${letter}`);
      return { type: 'letterGuess', targetPlayerId: targetId, letter };
    } catch (error: any) {
      console.error(`[${this.displayName}] Turn error: ${error.message}`);

      // Return a safe fallback action
      try {
        const fallbackTarget = ctx.players.find(
          p => !p.isEliminated && p.id !== ctx.botPlayerId
        );

        if (fallbackTarget) {
          console.log(`[${this.displayName}] Using fallback target: ${fallbackTarget.displayName}`);
          return {
            type: 'letterGuess',
            targetPlayerId: fallbackTarget.id,
            letter: 'E', // Safe fallback letter
          };
        }
      } catch (fallbackError) {
        console.error(`[${this.displayName}] Fallback generation failed:`, fallbackError);
      }

      // Last resort: re-throw error to be handled by caller
      throw error;
    }
  }

  /**
   * Select which blank position to reveal when targeted
   */
  async selectBlankPosition(positions: number[], ctx: GameContext): Promise<number> {
    console.log(`[${this.displayName}] Selecting blank position from: ${positions.join(', ')}`);
    await this.simulateThinking(800);

    try {
      const position = await this.strategy.selectBlankPosition(positions, ctx, this.config);
      console.log(`[${this.displayName}] Selected blank position: ${position}`);
      return position;
    } catch (error: any) {
      console.error(`[${this.displayName}] Blank selection error: ${error.message}`);
      // Fallback: select rightmost (typically back padding)
      return Math.max(...positions);
    }
  }

  /**
   * Select which duplicate letter position to reveal when targeted
   */
  async selectDuplicatePosition(
    positions: number[],
    letter: string,
    ctx: GameContext
  ): Promise<number> {
    console.log(`[${this.displayName}] Selecting position for duplicate "${letter}" from: ${positions.join(', ')}`);
    await this.simulateThinking(800);

    try {
      const position = await this.strategy.selectDuplicatePosition(
        positions,
        letter,
        ctx,
        this.config
      );
      console.log(`[${this.displayName}] Selected duplicate position: ${position}`);
      return position;
    } catch (error: any) {
      console.error(`[${this.displayName}] Duplicate selection error: ${error.message}`);
      // Fallback: select first position
      return positions[0];
    }
  }

  /**
   * Get serializable player info
   */
  toPlayerInfo(
    wordLength: number,
    revealedPositions: (string | null)[],
    missedLetters: string[],
    guessedWords: string[],
    totalScore: number,
    isEliminated: boolean,
    turnOrder: number,
    frontPadding: number = 0,
    backPadding: number = 0
  ): PlayerInfo {
    return {
      id: this.id,
      displayName: this.displayName,
      userId: undefined,
      isBot: true,
      wordLength,
      revealedPositions,
      missedLetters,
      guessedWords,
      totalScore,
      isEliminated,
      turnOrder,
      frontPadding,
      backPadding,
    };
  }
}
