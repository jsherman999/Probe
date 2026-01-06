"use strict";
/**
 * WordSelectionStrategy - Handles bot word selection during the word selection phase
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordSelectionStrategy = void 0;
// Fallback words by difficulty if LLM fails
const FALLBACK_WORDS = {
    easy: ['HOUSE', 'PLANT', 'MUSIC', 'BREAD', 'CHAIR', 'WATER', 'LIGHT', 'SMILE'],
    medium: ['PUZZLE', 'RHYTHM', 'GLIMPSE', 'WHISPER', 'FORTUNE', 'CRYSTAL', 'JOURNEY'],
    hard: ['SPHINX', 'QUARTZ', 'ZEPHYR', 'JOCKEY', 'FERVID', 'BYGONE', 'VORTEX', 'JINXED'],
};
class WordSelectionStrategy {
    ollama;
    wordValidator;
    constructor(ollama, wordValidator) {
        this.ollama = ollama;
        this.wordValidator = wordValidator;
    }
    /**
     * Select a word for the bot to use in the game
     */
    async selectWord(_ctx, config) {
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

Strategic considerations:
- Words with uncommon letters (J, Q, X, Z, K, V, W) are harder to guess
- Avoid words with common patterns like -ING, -TION, -ED endings
- Words with repeated letters can be tricky for opponents
- Shorter words give less information but have fewer positions to protect

Return ONLY the word in UPPERCASE letters. No explanation, no punctuation, just the word.`;
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                const response = await this.ollama.generate(config.modelName, prompt, config.ollamaOptions, systemPrompt);
                // Extract word from response (handle potential extra text)
                const word = this.extractWord(response);
                if (word && word.length >= 4 && word.length <= 12) {
                    // Validate the word
                    const isValid = await this.wordValidator.isValidWord(word);
                    if (isValid) {
                        console.log(`[Bot ${config.displayName}] Selected word: ${word} (attempt ${attempts + 1})`);
                        return this.applyPaddingStrategy(word, config);
                    }
                    else {
                        console.log(`[Bot ${config.displayName}] Invalid word "${word}", retrying...`);
                    }
                }
                else {
                    console.log(`[Bot ${config.displayName}] Bad word length "${word}", retrying...`);
                }
            }
            catch (error) {
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
    extractWord(response) {
        // Remove any non-letter characters and get first word
        const cleaned = response
            .trim()
            .toUpperCase()
            .replace(/[^A-Z\s]/g, '')
            .split(/\s+/)[0];
        return cleaned;
    }
    /**
     * Apply padding strategy based on difficulty
     */
    applyPaddingStrategy(word, config) {
        // For now, no padding - can be enhanced later
        // Harder difficulties could strategically add padding
        let frontPadding = 0;
        let backPadding = 0;
        if (config.difficulty === 'hard' && word.length <= 8) {
            // Hard bots might add some padding to obscure word length
            const totalPadding = Math.floor(Math.random() * 3); // 0-2 padding
            frontPadding = Math.floor(Math.random() * (totalPadding + 1));
            backPadding = totalPadding - frontPadding;
        }
        return { word, frontPadding, backPadding };
    }
    /**
     * Select a fallback word if LLM fails
     */
    selectFallbackWord(config) {
        const words = FALLBACK_WORDS[config.difficulty] || FALLBACK_WORDS.medium;
        const word = words[Math.floor(Math.random() * words.length)];
        console.log(`[Bot ${config.displayName}] Using fallback word: ${word}`);
        return { word, frontPadding: 0, backPadding: 0 };
    }
}
exports.WordSelectionStrategy = WordSelectionStrategy;
//# sourceMappingURL=WordSelectionStrategy.js.map