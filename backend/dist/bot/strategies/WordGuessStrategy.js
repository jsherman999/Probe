"use strict";
/**
 * WordGuessStrategy - Handles bot full word guessing decisions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordGuessStrategy = void 0;
class WordGuessStrategy {
    ollama;
    constructor(ollama) {
        this.ollama = ollama;
    }
    /**
     * Decide whether the bot should attempt a full word guess
     */
    async shouldGuessWord(_ctx, targetPlayer, config) {
        // Calculate how much of the word is revealed
        const revealedCount = targetPlayer.revealedPositions.filter(p => p !== null).length;
        const totalLength = targetPlayer.wordLength;
        const revealedPct = revealedCount / totalLength;
        // Different thresholds by difficulty
        const thresholds = {
            easy: 0.9, // Easy bot only guesses when 90%+ revealed
            medium: 0.7, // Medium bot at 70%+
            hard: 0.5, // Hard bot might guess at 50%+
        };
        const threshold = thresholds[config.difficulty] || thresholds.medium;
        // Don't guess if not enough revealed
        if (revealedPct < threshold) {
            return false;
        }
        // For hard bots, use LLM to decide
        if (config.difficulty === 'hard' && revealedPct >= 0.5) {
            return this.askLLMIfShouldGuess(targetPlayer, config);
        }
        // For easier difficulties, use simpler heuristics
        // Guess if we have a high confidence pattern
        if (revealedPct >= 0.8) {
            return true;
        }
        // Random chance based on reveal percentage
        return Math.random() < revealedPct * 0.3;
    }
    /**
     * Ask LLM if it's confident enough to guess
     */
    async askLLMIfShouldGuess(targetPlayer, config) {
        const pattern = targetPlayer.revealedPositions
            .map(pos => pos || '_')
            .join('');
        const prompt = `You are playing a word guessing game.

The opponent's word pattern is: ${pattern}
(Underscores are hidden letters)

Missed letters (not in the word): ${targetPlayer.missedLetters.join(', ') || 'none'}

Can you confidently guess what this word is?
Reply with just "YES" if you're 80%+ confident, or "NO" if not sure.`;
        try {
            const response = await this.ollama.generate(config.modelName, prompt, { ...config.ollamaOptions, temperature: 0.3, num_predict: 10 });
            return response.toUpperCase().includes('YES');
        }
        catch {
            return false;
        }
    }
    /**
     * Generate a word guess for the target player's word
     */
    async guessWord(_ctx, targetPlayer, config) {
        const pattern = targetPlayer.revealedPositions
            .map(pos => pos || '_')
            .join('');
        const revealedLetters = targetPlayer.revealedPositions
            .filter((p) => p !== null);
        const systemPrompt = config.personality
            ? `You are an AI player in a word guessing game. ${config.personality}`
            : 'You are an AI player in a word guessing game.';
        const prompt = `You are attempting to guess an opponent's complete word in a word guessing game.

WORD INFORMATION:
- Pattern: ${pattern}
  (Letters shown are revealed, underscores are hidden)
- Word length: ${targetPlayer.wordLength} letters
- Revealed letters: ${revealedLetters.join(', ') || 'none'}
- Letters NOT in the word: ${targetPlayer.missedLetters.join(', ') || 'none'}

Think about what English words match this pattern.
The hidden positions must be filled with letters that:
1. Are NOT in the missed letters list
2. Create a valid English word
3. Make sense with the revealed pattern

What is the complete word?
Return ONLY the word in UPPERCASE, nothing else.`;
        try {
            const response = await this.ollama.generate(config.modelName, prompt, {
                ...config.ollamaOptions,
                temperature: 0.3, // Low temperature for more focused guessing
                num_predict: 20,
            }, systemPrompt);
            const word = this.extractWord(response, targetPlayer.wordLength);
            if (word) {
                console.log(`[Bot ${config.displayName}] Guessing word: ${word} for pattern: ${pattern}`);
                return word;
            }
        }
        catch (error) {
            console.error(`[Bot ${config.displayName}] Word guess error: ${error.message}`);
        }
        // Fallback: construct word from pattern with common letters
        return this.constructFallbackGuess(targetPlayer);
    }
    /**
     * Extract a clean word from LLM response
     */
    extractWord(response, expectedLength) {
        const cleaned = response
            .trim()
            .toUpperCase()
            .replace(/[^A-Z]/g, '');
        // Check if the length matches
        if (cleaned.length === expectedLength) {
            return cleaned;
        }
        // Try to find a word of the right length in the response
        const words = response.toUpperCase().match(/[A-Z]+/g) || [];
        for (const word of words) {
            if (word.length === expectedLength) {
                return word;
            }
        }
        // If we have a word close to the right length, try it anyway
        if (cleaned.length >= expectedLength - 1 && cleaned.length <= expectedLength + 1) {
            return cleaned.slice(0, expectedLength);
        }
        return null;
    }
    /**
     * Construct a fallback guess by filling in blanks with common letters
     */
    constructFallbackGuess(targetPlayer) {
        const commonLetters = 'ETAOINSHRDLCU';
        let fallbackIdx = 0;
        const guess = targetPlayer.revealedPositions.map(pos => {
            if (pos !== null) {
                return pos;
            }
            // Fill with common letters not in missed list
            while (fallbackIdx < commonLetters.length) {
                const letter = commonLetters[fallbackIdx++];
                if (!targetPlayer.missedLetters.includes(letter)) {
                    return letter;
                }
            }
            return 'A'; // Last resort
        });
        return guess.join('');
    }
}
exports.WordGuessStrategy = WordGuessStrategy;
//# sourceMappingURL=WordGuessStrategy.js.map