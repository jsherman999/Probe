"use strict";
/**
 * LetterGuessStrategy - Handles bot letter guessing during gameplay
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LetterGuessStrategy = void 0;
// English letter frequency (most to least common)
const LETTER_FREQUENCY = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
// Common patterns to help with guessing
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
class LetterGuessStrategy {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    /**
     * Select the best letter to guess for a target player's word
     */
    async guessLetter(_ctx, targetPlayer, config) {
        // Get all letters already tried (revealed + missed)
        const revealedLetters = targetPlayer.revealedPositions
            .filter((p) => p !== null);
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
            console.log(`🎯 [LetterGuess ${config.displayName}] Calling LLM for letter guess...`);
            console.log(`🎯 [LetterGuess ${config.displayName}] Pattern: ${pattern}, tried: ${[...triedLetters].join(',')}`);
            const response = await this.llm.generate(config.modelName, prompt, {
                ...config.ollamaOptions,
                temperature: this.getTemperatureForDifficulty(config.difficulty),
                num_predict: 10, // Very short response expected
            }, systemPrompt);
            console.log(`🎯 [LetterGuess ${config.displayName}] Raw LLM response: "${response}"`);
            const letter = this.extractLetter(response, triedLetters);
            if (letter) {
                console.log(`🎯 [LetterGuess ${config.displayName}] Extracted letter: ${letter} ✓`);
                console.log(`[Bot ${config.displayName}] Guessing letter: ${letter} for pattern: ${pattern}`);
                return letter;
            }
            else {
                console.log(`🎯 [LetterGuess ${config.displayName}] Failed to extract valid letter from response`);
            }
        }
        catch (error) {
            console.error(`🎯 [LetterGuess ${config.displayName}] Letter guess error: ${error.message}`);
            console.error(`[Bot ${config.displayName}] Letter guess error: ${error.message}`);
        }
        // Fallback: use frequency-based selection
        console.log(`🎯 [LetterGuess ${config.displayName}] Using fallback letter selection`);
        return this.selectFallbackLetter(triedLetters, hasVowels, config);
    }
    /**
     * Select which opponent to target
     */
    async selectTarget(ctx, config) {
        console.log(`🎯 [TargetSelect ${config.displayName}] Selecting target from ${ctx.players.length} players`);
        console.log(`🎯 [TargetSelect ${config.displayName}] Bot ID: ${ctx.botPlayerId}`);
        // Get eligible targets (not eliminated, not self)
        const eligibleTargets = ctx.players.filter(p => !p.isEliminated && p.id !== ctx.botPlayerId);
        console.log(`🎯 [TargetSelect ${config.displayName}] Eligible targets: ${eligibleTargets.map(t => t.displayName).join(', ')}`);
        if (eligibleTargets.length === 0) {
            console.error(`🎯 [TargetSelect ${config.displayName}] No eligible targets found!`);
            throw new Error('No eligible targets');
        }
        if (eligibleTargets.length === 1) {
            console.log(`🎯 [TargetSelect ${config.displayName}] Only one target: ${eligibleTargets[0].displayName}`);
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
    selectStrategicTarget(eligibleTargets, _ctx, _config) {
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
     * Handles various formats like "  D", "D", "The letter D", "I'll guess D", etc.
     */
    extractLetter(response, triedLetters) {
        // Normalize: remove all whitespace and convert to uppercase
        const normalized = response.replace(/\s+/g, '').toUpperCase();
        // If it's a single letter after normalization, use it directly
        if (normalized.length === 1 && /[A-Z]/.test(normalized)) {
            const letter = normalized;
            if (!triedLetters.has(letter)) {
                return letter;
            }
            console.log(`🎯 [LetterGuess] Single letter "${letter}" already tried`);
            return null;
        }
        // Get all letters from the original response (preserving order)
        const allLetters = response.toUpperCase().match(/[A-Z]/g) || [];
        if (allLetters.length === 0) {
            console.log(`🎯 [LetterGuess] No letters found in response: "${response}"`);
            return null;
        }
        // If only one unique letter appears, use it (handles "  D", "D.", "D!", etc.)
        const uniqueLetters = [...new Set(allLetters)];
        if (uniqueLetters.length === 1) {
            const letter = uniqueLetters[0];
            if (!triedLetters.has(letter)) {
                return letter;
            }
            console.log(`🎯 [LetterGuess] Only letter "${letter}" already tried`);
            return null;
        }
        // Multiple letters - try to find the intended guess
        // Common patterns: "I guess X", "The letter is X", "My guess: X", "X.", just "X"
        // Check for single letter at start or end after trimming
        const trimmed = response.trim().toUpperCase();
        if (trimmed.length >= 1) {
            // Check last character (common: "guess D", "letter: D")
            const lastChar = trimmed[trimmed.length - 1];
            if (/[A-Z]/.test(lastChar) && !triedLetters.has(lastChar)) {
                return lastChar;
            }
            // Check first character
            const firstChar = trimmed[0];
            if (/[A-Z]/.test(firstChar) && !triedLetters.has(firstChar)) {
                return firstChar;
            }
        }
        // Fall back to first untried letter in response
        for (const letter of allLetters) {
            if (!triedLetters.has(letter)) {
                return letter;
            }
        }
        console.log(`🎯 [LetterGuess] All letters in response already tried: ${allLetters.join(', ')}`);
        return null;
    }
    /**
     * Fallback letter selection based on frequency
     */
    selectFallbackLetter(triedLetters, hasVowels, config) {
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
    getTemperatureForDifficulty(difficulty) {
        switch (difficulty) {
            case 'easy':
                return 1.0; // More random/unpredictable
            case 'hard':
                return 0.3; // Very focused/optimal
            default:
                return 0.7; // Balanced
        }
    }
    /**
     * Decide whether the bot should guess BLANK instead of a regular letter
     * Returns true if bot should guess BLANK
     */
    shouldGuessBlank(targetPlayer, config) {
        const revealed = targetPlayer.revealedPositions;
        const wordLength = targetPlayer.wordLength;
        // NEVER guess BLANK if it was already missed on this player
        // (means this player has no blanks in their word)
        if (targetPlayer.missedLetters.includes('BLANK')) {
            return false;
        }
        // Check if any blanks have already been revealed
        const revealedBlanks = revealed.filter(p => p === 'BLANK').length;
        const hasKnownBlanks = revealedBlanks > 0;
        // Count unrevealed positions
        const unrevealedCount = revealed.filter(p => p === null).length;
        // No unrevealed positions - nothing to guess
        if (unrevealedCount === 0) {
            return false;
        }
        // If blanks are known, check if all blanks are already revealed
        // (no point guessing BLANK if all blanks are already shown)
        if (hasKnownBlanks) {
            // Count how many unrevealed positions could still be blanks
            // We can't know for sure, but if all revealed are blanks and word is short, maybe done
            // For now, just allow guessing if there are unrevealed positions
        }
        // Base probability varies by difficulty
        let blankChance;
        switch (config.difficulty) {
            case 'easy':
                // Easy bots: 10% base chance, higher if blanks known
                blankChance = hasKnownBlanks ? 0.25 : 0.10;
                break;
            case 'hard':
                // Hard bots: 20% base chance, higher if blanks known
                blankChance = hasKnownBlanks ? 0.40 : 0.20;
                break;
            default:
                // Medium bots: 15% base chance, higher if blanks known
                blankChance = hasKnownBlanks ? 0.30 : 0.15;
        }
        // Increase chance if word is unusually long (likely has padding)
        // Most words are 4-8 letters, so 9+ is suspicious
        if (wordLength >= 9) {
            blankChance += 0.15;
        }
        // Increase chance if many letters have been missed (exhausted common letters)
        if (targetPlayer.missedLetters.length >= 8) {
            blankChance += 0.10;
        }
        // Roll the dice
        const roll = Math.random();
        const shouldGuess = roll < blankChance;
        if (shouldGuess) {
            console.log(`🎲 [BlankGuess ${config.displayName}] Decided to guess BLANK (roll ${(roll * 100).toFixed(0)}% < ${(blankChance * 100).toFixed(0)}%)`);
        }
        return shouldGuess;
    }
}
exports.LetterGuessStrategy = LetterGuessStrategy;
//# sourceMappingURL=LetterGuessStrategy.js.map