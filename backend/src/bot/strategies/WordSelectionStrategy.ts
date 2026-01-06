/**
 * WordSelectionStrategy - Handles bot word selection during the word selection phase
 * Tracks word history to avoid repetition across games
 */

import { LLMProvider } from '../types';
import { WordValidator } from '../../game/WordValidator';
import { BotConfig, GameContext, WordSelection } from '../types';
import { wordHistory } from '../WordHistory';

// Expanded fallback word lists by difficulty (100+ words each)
const FALLBACK_WORDS: Record<string, string[]> = {
  easy: [
    // Common 4-5 letter words
    'APPLE', 'BEACH', 'CANDY', 'DANCE', 'EAGLE', 'FLAME', 'GRAPE', 'HAPPY',
    'IVORY', 'JOLLY', 'KNIFE', 'LEMON', 'MANGO', 'NIGHT', 'OCEAN', 'PIANO',
    'QUEEN', 'ROBOT', 'STORM', 'TIGER', 'UNCLE', 'VOICE', 'WHALE', 'YOUTH',
    'ZEBRA', 'CLOUD', 'DREAM', 'FROST', 'GLOBE', 'HONEY', 'JEWEL', 'KOALA',
    'HOUSE', 'WATER', 'CHAIR', 'BREAD', 'PLANT', 'STONE', 'LIGHT', 'MUSIC',
    'PAINT', 'RIVER', 'GRASS', 'HORSE', 'SHEEP', 'CROWN', 'SWORD', 'MAGIC',
    'SMILE', 'SLEEP', 'LUNCH', 'DRINK', 'FRUIT', 'BRAIN', 'HEART', 'TEETH',
    'BLOOD', 'PHONE', 'CLOCK', 'PAPER', 'METAL', 'GLASS', 'SUGAR', 'BREAD',
    'SHINE', 'SHADE', 'SPARK', 'STEAM', 'SWING', 'TWIST', 'BLEND', 'CLIMB',
    'DRIFT', 'FLOAT', 'GRASP', 'KNEEL', 'MARCH', 'PAUSE', 'REACH', 'SCOUT',
    'TRACE', 'WEAVE', 'YIELD', 'BOOST', 'CHARM', 'FLARE', 'GLEAM', 'HAVEN',
    'JOKER', 'KIOSK', 'LUNAR', 'MAPLE', 'NOBLE', 'OLIVE', 'PEARL', 'QUILT',
    'REIGN', 'SILLY', 'TOAST', 'URBAN', 'VITAL', 'WRIST', 'ANKLE', 'BIRCH',
    'CORAL', 'DENIM', 'EMBER', 'FABLE', 'GRAIN', 'HASTE', 'INBOX', 'JAUNT',
    'KARMA', 'LABEL', 'MERIT', 'NERVE', 'ONSET', 'PRIDE', 'QUEST', 'RIDGE',
    'SIREN', 'TREND', 'UMBRA', 'VIGOR', 'WHEAT', 'TEMPO', 'WALTZ', 'PANDA',
  ],
  medium: [
    // 6-8 letter moderately challenging words
    'BRONZE', 'CAMERA', 'DRAGON', 'ECLIPSE', 'FALCON', 'GLACIER', 'HORIZON',
    'IMPULSE', 'JASMINE', 'KINGDOM', 'LANTERN', 'MYSTERY', 'NUCLEUS', 'OPTIMAL',
    'PHOENIX', 'QUANTUM', 'RAINBOW', 'SERPENT', 'TRIDENT', 'UMBRELLA', 'VINTAGE',
    'WHISTLE', 'CRYSTAL', 'DESTINY', 'EMERALD', 'FURNACE', 'GATEWAY', 'HARMONY',
    'INFERNO', 'JUSTICE', 'KEYNOTE', 'LATTICE', 'MAESTRO', 'NATURAL', 'OBSCURE',
    'PARKWAY', 'QUININE', 'RADIANT', 'SURFACE', 'THUNDER', 'UNIFORM', 'VENTURE',
    'WIZARDRY', 'ANCIENT', 'BANQUET', 'CAPTIVE', 'DIAGRAM', 'ELEMENT', 'FIGHTER',
    'GENUINE', 'HEROISM', 'IMPROVE', 'JOURNEY', 'KITCHEN', 'LEISURE', 'MONITOR',
    'NOTABLE', 'OPENING', 'PASSION', 'QUARTER', 'REFLECT', 'SHELTER', 'TRANSIT',
    'UPGRADE', 'VOLCANO', 'WEATHER', 'ACADEMY', 'BALANCE', 'CLIMATE', 'DOLPHIN',
    'EXHIBIT', 'FANTASY', 'GODDESS', 'HIGHWAY', 'INSTANT', 'JUBILEE', 'KINDRED',
    'LIBRARY', 'MAGENTA', 'NETWORK', 'ORGANIC', 'PILGRIM', 'QUICKEN', 'REPTILE',
    'SCHOLAR', 'TEXTILE', 'UNRAVEL', 'VIBRANT', 'WARFARE', 'ALCHEMY', 'BISCUIT',
    'CHAMBER', 'DYNAMIC', 'EPSILON', 'FLEXION', 'GRANULE', 'HOLSTER', 'INSIGHT',
    'JAVELIN', 'KEROSENE', 'LEOPARD', 'MANTRAP', 'NEUTRON', 'OUTCAST', 'PLUMBER',
    'QUARREL', 'RIVULET', 'SOPRANO', 'TARNISH', 'UPSTART', 'VERDANT', 'WRANGLE',
  ],
  hard: [
    // Tricky words with uncommon letters (Q, X, Z, J, K, V, W) or patterns
    'SPHINX', 'QUARTZ', 'ZEPHYR', 'JOCKEY', 'FJORD', 'GLYPH', 'NYMPH', 'CRYPT',
    'LYMPH', 'PSYCH', 'SYNTH', 'TRYST', 'WRYLY', 'PYGMY', 'MYTHS', 'HYMNS',
    'GYPSY', 'JAZZY', 'FIZZY', 'FUZZY', 'BUZZY', 'DIZZY', 'PROXY', 'EPOXY',
    'OXIDE', 'PIXEL', 'VIXEN', 'BOXER', 'MIXER', 'FIXER', 'HEXED', 'VEXED',
    'JINXED', 'KAYAK', 'KHAKI', 'KIOSK', 'KNACK', 'QUIRK', 'QUACK', 'QUALM',
    'SQUAD', 'SQUID', 'SQUAB', 'WALTZ', 'WIZARD', 'LIZARD', 'HAZARD', 'BLAZER',
    'FROZEN', 'FRENZY', 'BRONZE', 'BENZYL', 'ENZYME', 'SNEEZE', 'BREEZE', 'FREEZE',
    'WHEEZE', 'TWEEZE', 'XYLOSE', 'SYZYGY', 'RHYTHM', 'CYPHER', 'TYPHUS', 'PYTHON',
    'ZYGOTE', 'ZENITH', 'ZOMBIE', 'ZIGZAG', 'SIZZLE', 'PUZZLE', 'MUZZLE', 'NOZZLE',
    'DRIZZLE', 'GRIZZLY', 'FRAZZLE', 'DAZZLE', 'RAZZLE', 'BEDAZZLE', 'EMBEZZLE',
    'JACKAL', 'JARGON', 'JASPER', 'JETLAG', 'JIGSAW', 'JOKING', 'JOSTLE', 'JOVIAL',
    'JUMBLE', 'JUNGLE', 'JUNIOR', 'JUNIPER', 'KELP', 'KETCHUP', 'KIDNEY', 'KINDLE',
    'KNUCKLE', 'KOWTOW', 'OXYGEN', 'OXIDIZE', 'QUENCH', 'QUINOA', 'QUIRKY', 'QUIVER',
    'SCHISM', 'SKETCH', 'SPHINX', 'SPLURGE', 'SQUASH', 'SQUAWK', 'SQUEAL', 'SQUEEZE',
    'THWART', 'TWELFTH', 'VORTEX', 'WAFFLE', 'WRAITH', 'WRENCH', 'WRITHE', 'ZEALOT',
    'ZENITH', 'ZEPPELIN', 'ZODIAC', 'ZOMBIE', 'ZONING', 'ZWIEBACK', 'KABUKI', 'KVETCH',
  ],
};

// Variety prompts to get different word types from LLM
const VARIETY_PROMPTS = [
  'Think of a word related to nature, animals, or plants.',
  'Think of a word related to technology, science, or invention.',
  'Think of a word related to food, cooking, or cuisine.',
  'Think of a word related to art, music, or creativity.',
  'Think of a word related to sports, games, or competition.',
  'Think of a word related to weather, seasons, or climate.',
  'Think of a word related to travel, geography, or places.',
  'Think of a word related to emotions, feelings, or psychology.',
  'Think of a word related to history, ancient times, or mythology.',
  'Think of a word related to space, astronomy, or the cosmos.',
  'Think of a word related to architecture, buildings, or construction.',
  'Think of a word related to fashion, clothing, or textiles.',
  'Think of a word related to medicine, health, or the human body.',
  'Think of a word related to business, finance, or economics.',
  'Think of a word related to literature, writing, or storytelling.',
];

export class WordSelectionStrategy {
  constructor(
    private llm: LLMProvider,
    private wordValidator: WordValidator
  ) {}

  /**
   * Select a word for the bot to use in the game
   */
  async selectWord(ctx: GameContext, config: BotConfig): Promise<WordSelection> {
    const difficultyPrompts = {
      easy: `Choose a common, everyday English word that most people would know.
The word should be simple but not too obvious.`,
      medium: `Choose a moderately challenging English word - not too common, but not obscure.
Aim for words that educated adults would recognize but might not think of immediately.`,
      hard: `Choose an uncommon or tricky English word with unusual letter patterns.
Consider words with: Q, X, Z, J, or double letters in unexpected places.
The word should be valid but challenging to guess.`,
    };

    // Pick a random variety prompt to encourage diversity
    const varietyPrompt = VARIETY_PROMPTS[Math.floor(Math.random() * VARIETY_PROMPTS.length)];

    const systemPrompt = config.personality
      ? `You are an AI player in a word guessing game. ${config.personality}`
      : 'You are an AI player in a word guessing game.';

    // Get recently used words to tell LLM to avoid
    const recentWords = Array.from(wordHistory.getUsedWords()).slice(-50);
    const avoidList = recentWords.length > 0
      ? `\n\nIMPORTANT: Do NOT use any of these recently used words: ${recentWords.join(', ')}`
      : '';

    const prompt = `You are playing a word guessing game where opponents will guess letters one at a time to reveal your secret word.

${difficultyPrompts[config.difficulty || 'medium']}

${varietyPrompt}

Requirements:
- Word MUST be between 4 and 12 letters
- Word MUST be a valid English dictionary word
- Word should only contain letters A-Z (no hyphens, spaces, or special characters)
- Be creative and pick something unique!${avoidList}

Strategic considerations:
- Words with uncommon letters (J, Q, X, Z, K, V, W) are harder to guess
- Avoid words with common patterns like -ING, -TION, -ED endings
- Words with repeated letters can be tricky for opponents
- Shorter words give less information but have fewer positions to protect

Think of a creative, unique word, then return ONLY that word in UPPERCASE letters.
No explanation, no punctuation, no quotes - just the single word on one line.`;

    let attempts = 0;
    const maxAttempts = 5; // Increased from 3 to give more chances for unique words

    while (attempts < maxAttempts) {
      try {
        const response = await this.llm.generate(
          config.modelName,
          prompt,
          { ...config.ollamaOptions, temperature: 0.9 + (attempts * 0.1) }, // Increase temperature on retries
          systemPrompt
        );

        // Extract word from response (handle potential extra text)
        const word = this.extractWord(response);

        if (word && word.length >= 4 && word.length <= 12) {
          // Check if word was recently used
          if (wordHistory.isWordUsed(word)) {
            console.log(`[Bot ${config.displayName}] Word "${word}" already used, retrying...`);
            attempts++;
            continue;
          }

          // Validate the word
          const isValid = await this.wordValidator.isValidWord(word);
          if (isValid) {
            console.log(`[Bot ${config.displayName}] Selected word: ${word} (attempt ${attempts + 1})`);
            // Record the word in history
            wordHistory.addWord(word, config.id, ctx.roomCode);
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
    return this.selectFallbackWord(ctx, config);
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
   * Select a fallback word if LLM fails - filters out already-used words
   */
  private selectFallbackWord(ctx: GameContext, config: BotConfig): WordSelection {
    const allWords = FALLBACK_WORDS[config.difficulty] || FALLBACK_WORDS.medium;

    // Filter out already used words
    const availableWords = wordHistory.filterUnused(allWords);

    if (availableWords.length === 0) {
      // All words in this difficulty used - try other difficulties
      console.log(`[Bot ${config.displayName}] All ${config.difficulty} fallback words used, trying other difficulties...`);
      const allFallbacks = [
        ...FALLBACK_WORDS.easy,
        ...FALLBACK_WORDS.medium,
        ...FALLBACK_WORDS.hard,
      ];
      const anyAvailable = wordHistory.filterUnused(allFallbacks);

      if (anyAvailable.length === 0) {
        // Extremely rare: all 300+ words used - just pick random and allow reuse
        console.log(`[Bot ${config.displayName}] All fallback words exhausted! Allowing reuse.`);
        const word = allWords[Math.floor(Math.random() * allWords.length)];
        return this.applyPaddingStrategy(word, config);
      }

      const word = anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
      console.log(`[Bot ${config.displayName}] Using cross-difficulty fallback word: ${word}`);
      wordHistory.addWord(word, config.id, ctx.roomCode);
      return this.applyPaddingStrategy(word, config);
    }

    const word = availableWords[Math.floor(Math.random() * availableWords.length)];
    console.log(`[Bot ${config.displayName}] Using fallback word: ${word} (${availableWords.length} available)`);
    wordHistory.addWord(word, config.id, ctx.roomCode);
    return this.applyPaddingStrategy(word, config);
  }
}
