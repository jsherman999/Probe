"use strict";
/**
 * WordGuessStrategy - Handles bot full word guessing decisions
 *
 * This strategy is now more aggressive - bots will attempt word guesses when:
 * 1. At least 50% of the word is revealed (for hard bots)
 * 2. At least 60% revealed for medium bots
 * 3. At least 70% revealed for easy bots
 * 4. The guessed word must be a valid English word
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordGuessStrategy = void 0;
const WordValidator_1 = require("../../game/WordValidator");
class WordGuessStrategy {
    llm;
    wordValidator;
    constructor(llm, wordValidator) {
        this.llm = llm;
        this.wordValidator = wordValidator || new WordValidator_1.WordValidator();
    }
    /**
     * Decide whether the bot should attempt a full word guess
     * More aggressive than before - bots will try guessing earlier
     */
    async shouldGuessWord(_ctx, targetPlayer, config) {
        // Calculate how much of the word is revealed
        const revealedCount = targetPlayer.revealedPositions.filter(p => p !== null).length;
        const totalLength = targetPlayer.wordLength;
        const revealedPct = revealedCount / totalLength;
        const hiddenCount = totalLength - revealedCount;
        console.log(`🎲 [WordGuess ${config.displayName}] Checking word guess: ${revealedCount}/${totalLength} revealed (${(revealedPct * 100).toFixed(0)}%), ${hiddenCount} hidden`);
        // No point guessing if word is complete or only blanks remain
        if (hiddenCount === 0) {
            console.log(`🎲 [WordGuess ${config.displayName}] Word already complete, no guess needed`);
            return false;
        }
        // Threshold varies by difficulty
        let minRevealedPct;
        let wordGuessChance;
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
        // With very few letters remaining (1-2), always try word guess for all difficulties
        if (hiddenCount <= 2) {
            console.log(`🎲 [WordGuess ${config.displayName}] Only ${hiddenCount} hidden - will attempt word guess`);
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
            }
            else {
                console.log(`🎲 [WordGuess ${config.displayName}] No candidate found, will guess letter`);
            }
        }
        else {
            console.log(`🎲 [WordGuess ${config.displayName}] Random roll ${(roll * 100).toFixed(0)}% > ${(wordGuessChance * 100).toFixed(0)}%, will guess letter`);
        }
        return false;
    }
    /**
     * Generate a word candidate (without committing to guessing)
     */
    async generateWordCandidate(targetPlayer, config) {
        const pattern = targetPlayer.revealedPositions
            .map(pos => pos || '_')
            .join('');
        const prompt = `What English word matches this pattern: ${pattern}
Letters NOT in the word: ${targetPlayer.missedLetters.join(', ') || 'none'}
The word is ${targetPlayer.wordLength} letters long.
Reply with just ONE word in uppercase, or "UNKNOWN" if you can't determine it.`;
        try {
            const response = await this.llm.generate(config.modelName, prompt, { ...config.ollamaOptions, temperature: 0.3, num_predict: 20 });
            const word = this.extractWord(response, targetPlayer.wordLength);
            if (word && word !== 'UNKNOWN') {
                // Also verify it matches the revealed pattern
                if (this.matchesPattern(word, targetPlayer.revealedPositions)) {
                    return word;
                }
            }
        }
        catch {
            // Ignore errors
        }
        return null;
    }
    /**
     * Generate a word guess for the target player's word
     * Only called when shouldGuessWord returned true
     */
    async guessWord(_ctx, targetPlayer, config) {
        const pattern = targetPlayer.revealedPositions
            .map(pos => pos || '_')
            .join('');
        const revealedLetters = targetPlayer.revealedPositions
            .filter((p) => p !== null);
        const systemPrompt = 'You are playing a word guessing game. Give only single-word answers.';
        const prompt = `Complete this word pattern: ${pattern}
- Word length: ${targetPlayer.wordLength} letters
- Revealed letters: ${revealedLetters.join(', ') || 'none'}
- Letters NOT in word: ${targetPlayer.missedLetters.join(', ') || 'none'}

Think about what common English word this could be. What is the COMPLETE word?
Reply with ONLY the word in uppercase letters.`;
        console.log(`🎲 [WordGuess ${config.displayName}] Asking LLM for word guess, pattern: ${pattern}`);
        try {
            const response = await this.llm.generate(config.modelName, prompt, {
                ...config.ollamaOptions,
                temperature: 0.3,
                num_predict: 25,
            }, systemPrompt);
            console.log(`🎲 [WordGuess ${config.displayName}] Raw LLM response: "${response}"`);
            const word = this.extractWord(response, targetPlayer.wordLength);
            if (word) {
                // Validate the word is a real English word
                const isValid = await this.wordValidator.isValidWord(word);
                console.log(`🎲 [WordGuess ${config.displayName}] Extracted word "${word}", valid: ${isValid}`);
                if (isValid) {
                    // Also check the word matches the revealed pattern
                    if (this.matchesPattern(word, targetPlayer.revealedPositions)) {
                        console.log(`[Bot ${config.displayName}] Guessing word: ${word} for pattern: ${pattern}`);
                        return word;
                    }
                    else {
                        console.log(`🎲 [WordGuess ${config.displayName}] Word "${word}" doesn't match pattern`);
                    }
                }
            }
        }
        catch (error) {
            console.error(`[Bot ${config.displayName}] Word guess error: ${error.message}`);
        }
        // If we can't get a valid word, throw to force letter guessing instead
        console.log(`🎲 [WordGuess ${config.displayName}] No valid word found, will fall back to letter guess`);
        throw new Error('No valid word candidate found');
    }
    /**
     * Check if a word matches the revealed pattern
     */
    matchesPattern(word, revealedPositions) {
        if (word.length !== revealedPositions.length) {
            return false;
        }
        for (let i = 0; i < word.length; i++) {
            const revealed = revealedPositions[i];
            if (revealed !== null && revealed.toUpperCase() !== word[i].toUpperCase()) {
                return false;
            }
        }
        return true;
    }
    /**
     * Extract a clean word from LLM response
     */
    extractWord(response, expectedLength) {
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
exports.WordGuessStrategy = WordGuessStrategy;
//# sourceMappingURL=WordGuessStrategy.js.map