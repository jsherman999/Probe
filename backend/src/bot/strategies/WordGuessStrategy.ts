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
   * More aggressive than before - bots will try guessing earlier
   * ALWAYS attempts when only 1 position remains unrevealed
   */
  async shouldGuessWord(
    _ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<boolean> {
    // Calculate based on actual word (excluding blank padding)
    const frontPadding = targetPlayer.frontPadding || 0;
    const backPadding = targetPlayer.backPadding || 0;
    const actualLength = targetPlayer.wordLength - frontPadding - backPadding;

    // Get core positions (excluding blank padding)
    const corePositions = targetPlayer.revealedPositions.slice(frontPadding, targetPlayer.wordLength - backPadding);

    // Count revealed letters in the actual word
    const revealedCount = corePositions.filter(p => p !== null && p !== 'BLANK').length;
    const revealedPct = revealedCount / actualLength;
    const hiddenCount = actualLength - revealedCount;

    console.log(`🎲 [WordGuess ${config.displayName}] Checking word guess: ${revealedCount}/${actualLength} revealed (${(revealedPct * 100).toFixed(0)}%), ${hiddenCount} hidden (padding: front=${frontPadding}, back=${backPadding})`);

    // No point guessing if actual word is complete
    if (hiddenCount === 0) {
      console.log(`🎲 [WordGuess ${config.displayName}] Actual word already complete, no guess needed`);
      return false;
    }

    // CRITICAL: When only 1 position remains, ALWAYS attempt word guess (all difficulties)
    if (hiddenCount === 1) {
      console.log(`🎲 [WordGuess ${config.displayName}] Only 1 position hidden - MUST attempt word guess`);
      return true;
    }

    // Threshold varies by difficulty
    let minRevealedPct: number;
    let wordGuessChance: number;

    switch (config.difficulty) {
      case 'hard':
        // Hard bots: try guessing at 50% revealed, high chance
        minRevealedPct = 0.50;
        wordGuessChance = 0.7;
        break;
      case 'medium':
        // Medium bots: try at 60% revealed, moderate chance
        minRevealedPct = 0.60;
        wordGuessChance = 0.5;
        break;
      case 'easy':
      default:
        // Easy bots: try at 70% revealed, lower chance
        minRevealedPct = 0.70;
        wordGuessChance = 0.3;
        break;
    }

    // Not enough revealed yet
    if (revealedPct < minRevealedPct) {
      console.log(`🎲 [WordGuess ${config.displayName}] Not enough revealed (${(revealedPct * 100).toFixed(0)}% < ${(minRevealedPct * 100).toFixed(0)}%), will guess letter`);
      return false;
    }

    // With 2 letters remaining, always try word guess for all difficulties
    if (hiddenCount === 2) {
      console.log(`🎲 [WordGuess ${config.displayName}] Only 2 hidden - will attempt word guess`);
      return true;
    }

    // Roll the dice based on difficulty
    const roll = Math.random();
    if (roll < wordGuessChance) {
      // Check if we can actually form a valid word candidate
      const candidate = await this.generateWordCandidate(targetPlayer, config);
      if (candidate) {
        const isValid = await this.wordValidator.isValidWord(candidate);
        if (isValid) {
          console.log(`🎲 [WordGuess ${config.displayName}] Found valid candidate "${candidate}", will attempt word guess`);
          return true;
        }
        console.log(`🎲 [WordGuess ${config.displayName}] Candidate "${candidate}" invalid, will guess letter`);
      } else {
        console.log(`🎲 [WordGuess ${config.displayName}] No candidate found, will guess letter`);
      }
    } else {
      console.log(`🎲 [WordGuess ${config.displayName}] Random roll ${(roll * 100).toFixed(0)}% > ${(wordGuessChance * 100).toFixed(0)}%, will guess letter`);
    }

    return false;
  }

  /**
   * Build a clean pattern for LLM, handling blanks properly
   * Returns { pattern, actualLength } where pattern uses * for blanks and _ for unknown letters
   */
  private buildPatternForLLM(targetPlayer: PlayerInfo): { pattern: string; actualLength: number } {
    const frontPadding = targetPlayer.frontPadding || 0;
    const backPadding = targetPlayer.backPadding || 0;
    const actualLength = targetPlayer.wordLength - frontPadding - backPadding;

    // Build pattern: * for revealed blanks, _ for unrevealed, letter for revealed letters
    // Skip blank positions entirely in the pattern we show to LLM
    const corePositions = targetPlayer.revealedPositions.slice(frontPadding, targetPlayer.wordLength - backPadding);
    const pattern = corePositions
      .map(pos => {
        if (pos === null) return '_';
        if (pos === 'BLANK') return '_'; // Shouldn't happen in core positions, but handle it
        return pos;
      })
      .join('');

    return { pattern, actualLength };
  }

  /**
   * Generate a word candidate (without committing to guessing)
   */
  private async generateWordCandidate(
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string | null> {
    const { pattern, actualLength } = this.buildPatternForLLM(targetPlayer);
    const frontPadding = targetPlayer.frontPadding || 0;
    const backPadding = targetPlayer.backPadding || 0;
    const corePositions = targetPlayer.revealedPositions.slice(frontPadding, targetPlayer.wordLength - backPadding);

    // Build position hints
    const positionHints = corePositions.map((pos, i) => {
      if (pos === null || pos === 'BLANK') return `${i + 1}:?`;
      return `${i + 1}:${pos}`;
    }).join(' ');

    const prompt = `Pattern: ${pattern} (${actualLength} letters)
Positions: ${positionHints}
Not in word: ${targetPlayer.missedLetters.join(', ') || 'none'}
Letters shown are FIXED in position. What word matches exactly?
Reply with ONE word in uppercase, or UNKNOWN.`;

    try {
      const response = await this.llm.generate(
        config.modelName,
        prompt,
        { ...config.ollamaOptions, temperature: 0.3, num_predict: 20 }
      );

      const word = this.extractWord(response, actualLength);

      if (word && word !== 'UNKNOWN') {
        // Also verify it matches the revealed pattern (core letters only)
        if (this.matchesCorePattern(word, targetPlayer)) {
          return word;
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  /**
   * Generate a word guess for the target player's word
   * Only called when shouldGuessWord returned true
   * Checks guessedWords to avoid duplicate guesses
   */
  async guessWord(
    _ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string> {
    const { pattern, actualLength } = this.buildPatternForLLM(targetPlayer);
    const frontPadding = targetPlayer.frontPadding || 0;
    const backPadding = targetPlayer.backPadding || 0;

    // Get revealed letters from the core word (excluding blanks)
    const corePositions = targetPlayer.revealedPositions.slice(frontPadding, targetPlayer.wordLength - backPadding);
    const revealedLetters = corePositions
      .filter((p): p is string => p !== null && p !== 'BLANK');

    // Get already guessed words to avoid duplicates
    const alreadyGuessed = targetPlayer.guessedWords || [];

    const systemPrompt = 'You are playing a word guessing game. Give only single-word answers.';

    const alreadyGuessedInfo = alreadyGuessed.length > 0
      ? `\nWords already guessed (DO NOT guess these): ${alreadyGuessed.join(', ')}`
      : '';

    // Build position-by-position breakdown for clarity
    const positionBreakdown = corePositions.map((pos, i) => {
      if (pos === null || pos === 'BLANK') {
        return `Position ${i + 1}: ? (unknown)`;
      }
      return `Position ${i + 1}: ${pos} (FIXED - must be ${pos})`;
    }).join('\n');

    const prompt = `Guess the ${actualLength}-letter English word from this pattern: ${pattern}

IMPORTANT: The pattern shows the word with _ for unknown letters. Letters that are shown are FIXED in their exact positions and cannot move.

Position breakdown:
${positionBreakdown}

Letters confirmed NOT in the word: ${targetPlayer.missedLetters.join(', ') || 'none'}${alreadyGuessedInfo}

What common English word matches this EXACT pattern? The revealed letters must stay in their exact positions.
Reply with ONLY the word in uppercase letters.`;

    console.log(`🎲 [WordGuess ${config.displayName}] Asking LLM for word guess, pattern: ${pattern}, actualLength: ${actualLength}`);
    if (alreadyGuessed.length > 0) {
      console.log(`🎲 [WordGuess ${config.displayName}] Already guessed words: ${alreadyGuessed.join(', ')}`);
    }

    // Try multiple times to get a word that hasn't been guessed
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.llm.generate(
          config.modelName,
          prompt,
          {
            ...config.ollamaOptions,
            temperature: 0.3 + (attempt * 0.2), // Increase temperature on retries
            num_predict: 25,
          },
          systemPrompt
        );

        console.log(`🎲 [WordGuess ${config.displayName}] Raw LLM response (attempt ${attempt + 1}): "${response}"`);

        const word = this.extractWord(response, actualLength);

        if (word) {
          // Check if this word was already guessed
          if (alreadyGuessed.includes(word)) {
            console.log(`🎲 [WordGuess ${config.displayName}] Word "${word}" already guessed, trying again...`);
            continue;
          }

          // Validate the word is a real English word
          const isValid = await this.wordValidator.isValidWord(word);
          console.log(`🎲 [WordGuess ${config.displayName}] Extracted word "${word}", valid: ${isValid}`);

          if (isValid) {
            // Also check the word matches the revealed pattern (core letters only)
            if (this.matchesCorePattern(word, targetPlayer)) {
              console.log(`[Bot ${config.displayName}] Guessing word: ${word} for pattern: ${pattern}`);
              return word;
            } else {
              console.log(`🎲 [WordGuess ${config.displayName}] Word "${word}" doesn't match pattern`);
            }
          }
        }
      } catch (error: any) {
        console.error(`[Bot ${config.displayName}] Word guess error (attempt ${attempt + 1}): ${error.message}`);
      }
    }

    // If we can't get a valid word, throw to force letter guessing instead
    console.log(`🎲 [WordGuess ${config.displayName}] No valid word found after ${maxAttempts} attempts, will fall back to letter guess`);
    throw new Error('No valid word candidate found');
  }

  /**
   * Check if a word matches the core pattern (excluding blank padding positions)
   */
  private matchesCorePattern(word: string, targetPlayer: PlayerInfo): boolean {
    const frontPadding = targetPlayer.frontPadding || 0;
    const backPadding = targetPlayer.backPadding || 0;
    const actualLength = targetPlayer.wordLength - frontPadding - backPadding;

    if (word.length !== actualLength) {
      return false;
    }

    // Check against core positions only (skip padding)
    const corePositions = targetPlayer.revealedPositions.slice(frontPadding, targetPlayer.wordLength - backPadding);

    for (let i = 0; i < word.length; i++) {
      const revealed = corePositions[i];
      if (revealed !== null && revealed !== 'BLANK' && revealed.toUpperCase() !== word[i].toUpperCase()) {
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

    // If single word response close to right length, check it
    if (words.length === 1 && words[0].length === expectedLength) {
      return words[0];
    }

    return null;
  }
}
