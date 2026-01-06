/**
 * WordSelectionStrategy - Handles bot word selection during the word selection phase
 */

import { LLMProvider } from '../types';
import { WordValidator } from '../../game/WordValidator';
import { BotConfig, GameContext, WordSelection } from '../types';

// Larger fallback word lists by difficulty if LLM fails (randomized selection)
const FALLBACK_WORDS: Record<string, string[]> = {
  easy: [
    'APPLE', 'BEACH', 'CANDY', 'DANCE', 'EAGLE', 'FLAME', 'GRAPE', 'HAPPY',
    'IVORY', 'JOLLY', 'KNIFE', 'LEMON', 'MANGO', 'NIGHT', 'OCEAN', 'PIANO',
    'QUEEN', 'ROBOT', 'STORM', 'TIGER', 'UNCLE', 'VOICE', 'WHALE', 'YOUTH',
    'ZEBRA', 'CLOUD', 'DREAM', 'FROST', 'GLOBE', 'HONEY', 'JEWEL', 'KOALA',
  ],
  medium: [
    'BRONZE', 'CAMERA', 'DRAGON', 'ECLIPSE', 'FALCON', 'GLACIER', 'HORIZON',
    'IMPULSE', 'JASMINE', 'KINGDOM', 'LANTERN', 'MYSTERY', 'NUCLEUS', 'OPTIMAL',
    'PHOENIX', 'QUANTUM', 'RAINBOW', 'SERPENT', 'TRIDENT', 'UMBRELLA', 'VINTAGE',
    'WHISTLE', 'XENON', 'YOGURT', 'ZEALOUS', 'CAPTAIN', 'DESTINY', 'EMERALD',
  ],
  hard: [
    'SPHINX', 'QUARTZ', 'ZEPHYR', 'JOCKEY', 'FJORD', 'GLYPH', 'NYMPH', 'CRYPT',
    'LYMPH', 'PSYCH', 'SYNTH', 'TRYST', 'WRYLY', 'XYLYL', 'FLYBY', 'PYGMY',
    'MYTHS', 'HYMNS', 'GYPSY', 'JAZZY', 'FIZZY', 'FUZZY', 'BUZZY', 'DIZZY',
    'PROXY', 'EPOXY', 'OXIDE', 'PIXEL', 'VIXEN', 'BOXER', 'MIXER', 'FIXER',
  ],
};

export class WordSelectionStrategy {
  constructor(
    private llm: LLMProvider,
    private wordValidator: WordValidator
  ) {}

  /**
   * Select a word for the bot to use in the game
   */
  async selectWord(_ctx: GameContext, config: BotConfig): Promise<WordSelection> {
    const difficultyPrompts = {
      easy: `Choose a common, everyday English word that most people would know.
Examples of good easy words: HOUSE, APPLE, WATER, CHAIR, BREAD`,
      medium: `Choose a moderately challenging English word - not too common, but not obscure.
Examples of good medium words: PUZZLE, RHYTHM, GLIMPSE, FORTUNE`,
      hard: `Choose an uncommon or tricky English word with unusual letter patterns.
Consider words with: Q, X, Z, J, or double letters in unexpected places.
Examples of good hard words: SPHINX, QUARTZ, ZEPHYR, JINXED`,
    };

    const systemPrompt = config.personality
      ? `You are an AI player in a word guessing game. ${config.personality}`
      : 'You are an AI player in a word guessing game.';

    const prompt = `You are playing a word guessing game where opponents will guess letters one at a time to reveal your secret word.

${difficultyPrompts[config.difficulty || 'medium']}

Requirements:
- Word MUST be between 4 and 12 letters
- Word MUST be a valid English dictionary word
- Word should only contain letters A-Z (no hyphens, spaces, or special characters)
- IMPORTANT: Do NOT use any of the example words mentioned above - pick your own unique word!

Strategic considerations:
- Words with uncommon letters (J, Q, X, Z, K, V, W) are harder to guess
- Avoid words with common patterns like -ING, -TION, -ED endings
- Words with repeated letters can be tricky for opponents
- Shorter words give less information but have fewer positions to protect

Think of a creative word, then return ONLY that word in UPPERCASE letters.
No explanation, no punctuation, no quotes - just the single word on one line.`;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const response = await this.llm.generate(
          config.modelName,
          prompt,
          config.ollamaOptions,
          systemPrompt
        );

        // Extract word from response (handle potential extra text)
        const word = this.extractWord(response);

        if (word && word.length >= 4 && word.length <= 12) {
          // Validate the word
          const isValid = await this.wordValidator.isValidWord(word);
          if (isValid) {
            console.log(`[Bot ${config.displayName}] Selected word: ${word} (attempt ${attempts + 1})`);
            return this.applyPaddingStrategy(word, config);
          } else {
            console.log(`[Bot ${config.displayName}] Invalid word "${word}", retrying...`);
          }
        } else {
          console.log(`[Bot ${config.displayName}] Bad word length "${word}", retrying...`);
        }
      } catch (error: any) {
        console.error(`[Bot ${config.displayName}] Word selection error: ${error.message}`);
      }

      attempts++;
    }

    // Fallback to predefined word
    return this.selectFallbackWord(config);
  }

  /**
   * Extract a clean word from LLM response
   */
  private extractWord(response: string): string {
    // Remove any non-letter characters and get first word
    const cleaned = response
      .trim()
      .toUpperCase()
      .replace(/[^A-Z\s]/g, '')
      .split(/\s+/)[0];

    return cleaned;
  }

  /**
   * Apply padding strategy - all bots randomly add 0-3 blanks to front and back
   * Total word + padding must not exceed 12 characters
   */
  private applyPaddingStrategy(word: string, config: BotConfig): WordSelection {
    const MAX_TOTAL_LENGTH = 12;
    const availablePadding = MAX_TOTAL_LENGTH - word.length;

    // If word is already at max length, no padding
    if (availablePadding <= 0) {
      console.log(`[Bot ${config.displayName}] Word "${word}" (${word.length} chars) - no padding available`);
      return { word, frontPadding: 0, backPadding: 0 };
    }

    // Total padding varies by difficulty
    let maxFrontPadding: number;
    let maxBackPadding: number;

    switch (config.difficulty) {
      case 'easy':
        // Easy bots: 0-1 blanks each side
        maxFrontPadding = 1;
        maxBackPadding = 1;
        break;
      case 'hard':
        // Hard bots: 0-3 blanks each side
        maxFrontPadding = 3;
        maxBackPadding = 3;
        break;
      default:
        // Medium bots: 0-2 blanks each side
        maxFrontPadding = 2;
        maxBackPadding = 2;
    }

    // Limit padding to what's available
    maxFrontPadding = Math.min(maxFrontPadding, availablePadding);
    maxBackPadding = Math.min(maxBackPadding, availablePadding);

    // Select random padding
    let frontPadding = Math.floor(Math.random() * (maxFrontPadding + 1));
    let backPadding = Math.floor(Math.random() * (maxBackPadding + 1));

    // Ensure total doesn't exceed available padding
    const totalPadding = frontPadding + backPadding;
    if (totalPadding > availablePadding) {
      // Scale down proportionally
      const scale = availablePadding / totalPadding;
      frontPadding = Math.floor(frontPadding * scale);
      backPadding = availablePadding - frontPadding;
    }

    console.log(`[Bot ${config.displayName}] Word "${word}" (${word.length} chars) with padding: front=${frontPadding}, back=${backPadding}, total=${word.length + frontPadding + backPadding}`);

    return { word, frontPadding, backPadding };
  }

  /**
   * Select a fallback word if LLM fails
   */
  private selectFallbackWord(config: BotConfig): WordSelection {
    const words = FALLBACK_WORDS[config.difficulty] || FALLBACK_WORDS.medium;
    const word = words[Math.floor(Math.random() * words.length)];
    console.log(`[Bot ${config.displayName}] Using fallback word: ${word}`);
    // Apply padding to fallback words too
    return this.applyPaddingStrategy(word, config);
  }
}
