/**
 * LetterGuessStrategy - Handles bot letter guessing during gameplay
 */

import { OllamaService } from '../OllamaService';
import { BotConfig, GameContext, PlayerInfo } from '../types';

// English letter frequency (most to least common)
const LETTER_FREQUENCY = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';

// Common patterns to help with guessing
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export class LetterGuessStrategy {
  constructor(private ollama: OllamaService) {}

  /**
   * Select the best letter to guess for a target player's word
   */
  async guessLetter(
    _ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string> {
    // Get all letters already tried (revealed + missed)
    const revealedLetters = targetPlayer.revealedPositions
      .filter((p): p is string => p !== null);
    const triedLetters = new Set([
      ...revealedLetters,
      ...targetPlayer.missedLetters,
    ]);

    // Build the pattern string for the prompt
    const pattern = targetPlayer.revealedPositions
      .map(pos => pos || '•')
      .join('');

    // Count revealed vs hidden
    const revealedCount = revealedLetters.length;
    const hiddenCount = targetPlayer.wordLength - revealedCount;

    // Check if we have vowels revealed
    const hasVowels = revealedLetters.some(l => VOWELS.has(l));
    const untriedVowels = [...VOWELS].filter(v => !triedLetters.has(v));

    const systemPrompt = config.personality
      ? `You are an AI player in a word guessing game. ${config.personality}`
      : 'You are an AI player in a word guessing game.';

    const prompt = `You are guessing letters in an opponent's hidden word.

TARGET WORD INFORMATION:
- Total length: ${targetPlayer.wordLength} positions
- Current pattern: ${pattern}
  (• = hidden letter, revealed letters shown in place)
- Letters already revealed: ${revealedLetters.length > 0 ? revealedLetters.join(', ') : 'none'}
- Letters tried but missed: ${targetPlayer.missedLetters.length > 0 ? targetPlayer.missedLetters.join(', ') : 'none'}
- Positions still hidden: ${hiddenCount}

LETTER FREQUENCY (most to least common in English):
E, T, A, O, I, N, S, H, R, D, L, C, U, M, W, F, G, Y, P, B, V, K, J, X, Q, Z

STRATEGIC TIPS:
${!hasVowels && untriedVowels.length > 0 ? '- No vowels revealed yet! Try: ' + untriedVowels.join(', ') : ''}
${hiddenCount <= 3 ? '- Word is almost revealed! Think about what words could match.' : ''}
- Consider what English words could match the pattern "${pattern}"
- Common consonants not yet tried may be good choices
- Position matters: first/last letters are often consonants

DO NOT guess any of these already-tried letters: ${[...triedLetters].join(', ') || 'none'}

What single letter should I guess next?
Return ONLY one uppercase letter, nothing else.`;

    try {
      const response = await this.ollama.generate(
        config.modelName,
        prompt,
        {
          ...config.ollamaOptions,
          temperature: this.getTemperatureForDifficulty(config.difficulty),
          num_predict: 10, // Very short response expected
        },
        systemPrompt
      );

      const letter = this.extractLetter(response, triedLetters);

      if (letter) {
        console.log(`[Bot ${config.displayName}] Guessing letter: ${letter} for pattern: ${pattern}`);
        return letter;
      }
    } catch (error: any) {
      console.error(`[Bot ${config.displayName}] Letter guess error: ${error.message}`);
    }

    // Fallback: use frequency-based selection
    return this.selectFallbackLetter(triedLetters, hasVowels, config);
  }

  /**
   * Select which opponent to target
   */
  async selectTarget(ctx: GameContext, config: BotConfig): Promise<string> {
    // Get eligible targets (not eliminated, not self)
    const eligibleTargets = ctx.players.filter(
      p => !p.isEliminated && p.id !== ctx.botPlayerId
    );

    if (eligibleTargets.length === 0) {
      throw new Error('No eligible targets');
    }

    if (eligibleTargets.length === 1) {
      return eligibleTargets[0].id;
    }

    // Strategy varies by difficulty
    switch (config.difficulty) {
      case 'easy':
        // Easy bot: random target
        return eligibleTargets[Math.floor(Math.random() * eligibleTargets.length)].id;

      case 'hard':
        // Hard bot: target player closest to elimination (most revealed)
        return this.selectStrategicTarget(eligibleTargets, ctx, config);

      default:
        // Medium: mix of random and strategic
        if (Math.random() < 0.5) {
          return this.selectStrategicTarget(eligibleTargets, ctx, config);
        }
        return eligibleTargets[Math.floor(Math.random() * eligibleTargets.length)].id;
    }
  }

  /**
   * Select target strategically - prefer players close to elimination
   */
  private selectStrategicTarget(
    eligibleTargets: PlayerInfo[],
    _ctx: GameContext,
    _config: BotConfig
  ): string {
    // Calculate "completion percentage" for each target
    const targetScores = eligibleTargets.map(target => {
      const revealed = target.revealedPositions.filter(p => p !== null).length;
      const total = target.wordLength;
      const completionPct = revealed / total;

      // Also consider their score (maybe target leader?)
      return {
        id: target.id,
        completionPct,
        score: target.totalScore,
      };
    });

    // Sort by completion percentage (highest first - closest to elimination)
    targetScores.sort((a, b) => b.completionPct - a.completionPct);

    // If someone is close to elimination (>70% revealed), target them
    if (targetScores[0].completionPct > 0.7) {
      return targetScores[0].id;
    }

    // Otherwise, target the score leader
    targetScores.sort((a, b) => b.score - a.score);
    return targetScores[0].id;
  }

  /**
   * Extract a valid letter from LLM response
   */
  private extractLetter(response: string, triedLetters: Set<string>): string | null {
    // Get first letter from response
    const match = response.trim().toUpperCase().match(/[A-Z]/);
    if (!match) return null;

    const letter = match[0];

    // Make sure it's not already tried
    if (triedLetters.has(letter)) {
      // Try to find another letter in the response
      const allLetters = response.toUpperCase().match(/[A-Z]/g) || [];
      for (const l of allLetters) {
        if (!triedLetters.has(l)) {
          return l;
        }
      }
      return null;
    }

    return letter;
  }

  /**
   * Fallback letter selection based on frequency
   */
  private selectFallbackLetter(
    triedLetters: Set<string>,
    hasVowels: boolean,
    config: BotConfig
  ): string {
    // If no vowels revealed, prioritize vowels
    if (!hasVowels) {
      for (const vowel of ['E', 'A', 'I', 'O', 'U']) {
        if (!triedLetters.has(vowel)) {
          console.log(`[Bot ${config.displayName}] Fallback: guessing vowel ${vowel}`);
          return vowel;
        }
      }
    }

    // Otherwise use frequency order
    for (const letter of LETTER_FREQUENCY) {
      if (!triedLetters.has(letter)) {
        console.log(`[Bot ${config.displayName}] Fallback: guessing ${letter} (frequency)`);
        return letter;
      }
    }

    // Shouldn't happen, but just in case
    return 'E';
  }

  /**
   * Adjust temperature based on difficulty
   * Lower = more focused/deterministic, Higher = more creative/random
   */
  private getTemperatureForDifficulty(difficulty: string): number {
    switch (difficulty) {
      case 'easy':
        return 1.0; // More random/unpredictable
      case 'hard':
        return 0.3; // Very focused/optimal
      default:
        return 0.7; // Balanced
    }
  }
}
