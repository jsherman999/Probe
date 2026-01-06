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

export class WordGuessStrategy {
  private wordValidator: WordValidator;

  constructor(
    private llm: LLMProvider,
    wordValidator?: WordValidator
  ) {
    this.wordValidator = wordValidator || new WordValidator();
  }

  /**
   * Decide whether the bot should attempt a full word guess
   * VERY conservative - default to letter guessing
   */
  async shouldGuessWord(
    _ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<boolean> {
    // Calculate how much of the word is revealed
    const revealedCount = targetPlayer.revealedPositions.filter(p => p !== null).length;
    const totalLength = targetPlayer.wordLength;
    const revealedPct = revealedCount / totalLength;

    console.log(`🎲 [WordGuess ${config.displayName}] Checking if should guess word: ${(revealedPct * 100).toFixed(0)}% revealed`);

    // STRICT requirement: At least 80% must be revealed for ANY difficulty
    if (revealedPct < 0.8) {
      console.log(`🎲 [WordGuess ${config.displayName}] Not enough revealed (<80%), will guess letter`);
      return false;
    }

    // Even at 80%+, only guess if there's just 1-2 letters missing
    const hiddenCount = totalLength - revealedCount;
    if (hiddenCount > 2) {
      console.log(`🎲 [WordGuess ${config.displayName}] Too many hidden letters (${hiddenCount}), will guess letter`);
      return false;
    }

    // For hard bots only, try to determine if we can guess the word
    if (config.difficulty === 'hard' && hiddenCount <= 2) {
      const confident = await this.canConfidentlyGuess(targetPlayer, config);
      console.log(`🎲 [WordGuess ${config.displayName}] Confidence check: ${confident ? 'YES' : 'NO'}`);
      return confident;
    }

    // Easy/Medium bots: only guess word when just 1 letter remains AND very high reveal %
    if (hiddenCount === 1 && revealedPct >= 0.85) {
      console.log(`🎲 [WordGuess ${config.displayName}] Only 1 letter hidden and 85%+ revealed, may guess word`);
      // Still only 50% chance to guess - prefer letter guessing
      return Math.random() < 0.5;
    }

    // Default: don't guess word, keep guessing letters
    console.log(`🎲 [WordGuess ${config.displayName}] Defaulting to letter guess`);
    return false;
  }

  /**
   * Check if we can confidently guess the word (for hard bots)
   */
  private async canConfidentlyGuess(
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<boolean> {
    const pattern = targetPlayer.revealedPositions
      .map(pos => pos || '_')
      .join('');

    // First, try to think of a valid word that matches
    const candidateWord = await this.generateWordCandidate(targetPlayer, config);

    if (!candidateWord) {
      return false;
    }

    // Validate it's a real English word
    const isValid = await this.wordValidator.isValidWord(candidateWord);
    console.log(`🎲 [WordGuess ${config.displayName}] Candidate "${candidateWord}" valid: ${isValid}`);

    return isValid;
  }

  /**
   * Generate a word candidate (without committing to guessing)
   */
  private async generateWordCandidate(
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string | null> {
    const pattern = targetPlayer.revealedPositions
      .map(pos => pos || '_')
      .join('');

    const prompt = `What common English word matches this pattern: ${pattern}
Letters NOT in the word: ${targetPlayer.missedLetters.join(', ') || 'none'}
Reply with just ONE word in uppercase, or "UNKNOWN" if unsure.`;

    try {
      const response = await this.llm.generate(
        config.modelName,
        prompt,
        { ...config.ollamaOptions, temperature: 0.2, num_predict: 15 }
      );

      const word = this.extractWord(response, targetPlayer.wordLength);

      if (word && word !== 'UNKNOWN') {
        return word;
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  /**
   * Generate a word guess for the target player's word
   * Only called when shouldGuessWord returned true
   */
  async guessWord(
    _ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string> {
    const pattern = targetPlayer.revealedPositions
      .map(pos => pos || '_')
      .join('');

    const revealedLetters = targetPlayer.revealedPositions
      .filter((p): p is string => p !== null);

    const systemPrompt = 'You are playing a word guessing game. Give only single-word answers.';

    const prompt = `Complete this word pattern: ${pattern}
- Word length: ${targetPlayer.wordLength} letters
- Revealed: ${revealedLetters.join(', ') || 'none'}
- NOT in word: ${targetPlayer.missedLetters.join(', ') || 'none'}

What is the COMPLETE English word? Reply with ONLY the word in uppercase.`;

    console.log(`🎲 [WordGuess ${config.displayName}] Asking LLM for word guess, pattern: ${pattern}`);

    try {
      const response = await this.llm.generate(
        config.modelName,
        prompt,
        {
          ...config.ollamaOptions,
          temperature: 0.2, // Very low for focused guessing
          num_predict: 20,
        },
        systemPrompt
      );

      console.log(`🎲 [WordGuess ${config.displayName}] Raw LLM response: "${response}"`);

      const word = this.extractWord(response, targetPlayer.wordLength);

      if (word) {
        // CRITICAL: Validate the word is a real English word
        const isValid = await this.wordValidator.isValidWord(word);
        console.log(`🎲 [WordGuess ${config.displayName}] Extracted word "${word}", valid: ${isValid}`);

        if (isValid) {
          // Also check the word matches the revealed pattern
          if (this.matchesPattern(word, targetPlayer.revealedPositions)) {
            console.log(`[Bot ${config.displayName}] Guessing valid word: ${word} for pattern: ${pattern}`);
            return word;
          } else {
            console.log(`🎲 [WordGuess ${config.displayName}] Word "${word}" doesn't match pattern`);
          }
        }
      }
    } catch (error: any) {
      console.error(`[Bot ${config.displayName}] Word guess error: ${error.message}`);
    }

    // If we can't get a valid word, throw to force letter guessing instead
    // This is better than guessing a nonsense word
    console.log(`🎲 [WordGuess ${config.displayName}] No valid word found, will fall back to letter guess`);
    throw new Error('No valid word candidate found');
  }

  /**
   * Check if a word matches the revealed pattern
   */
  private matchesPattern(word: string, revealedPositions: (string | null)[]): boolean {
    if (word.length !== revealedPositions.length) {
      return false;
    }

    for (let i = 0; i < word.length; i++) {
      const revealed = revealedPositions[i];
      if (revealed !== null && revealed !== word[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract a clean word from LLM response
   */
  private extractWord(response: string, expectedLength: number): string | null {
    // Clean the response
    const cleaned = response
      .trim()
      .toUpperCase()
      .replace(/[^A-Z\s]/g, '');

    // Try to find a word of exactly the right length
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);

    for (const word of words) {
      if (word.length === expectedLength) {
        return word;
      }
    }

    // If single word response and close to right length, try it
    if (words.length === 1) {
      const word = words[0];
      if (word.length === expectedLength) {
        return word;
      }
    }

    return null;
  }
}
