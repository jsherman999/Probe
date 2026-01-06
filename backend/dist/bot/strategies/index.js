"use strict";
/**
 * BotStrategy - Unified strategy class combining all bot decision-making
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionSelectionStrategy = exports.WordGuessStrategy = exports.LetterGuessStrategy = exports.WordSelectionStrategy = exports.BotStrategy = void 0;
const WordSelectionStrategy_1 = require("./WordSelectionStrategy");
const LetterGuessStrategy_1 = require("./LetterGuessStrategy");
const WordGuessStrategy_1 = require("./WordGuessStrategy");
const PositionSelectionStrategy_1 = require("./PositionSelectionStrategy");
class BotStrategy {
    wordSelectionStrategy;
    letterGuessStrategy;
    wordGuessStrategy;
    positionSelectionStrategy;
    constructor(ollama, wordValidator) {
        this.wordSelectionStrategy = new WordSelectionStrategy_1.WordSelectionStrategy(ollama, wordValidator);
        this.letterGuessStrategy = new LetterGuessStrategy_1.LetterGuessStrategy(ollama);
        this.wordGuessStrategy = new WordGuessStrategy_1.WordGuessStrategy(ollama);
        this.positionSelectionStrategy = new PositionSelectionStrategy_1.PositionSelectionStrategy(ollama);
    }
    /**
     * Select a word for the bot to use
     */
    async selectWord(ctx, config) {
        return this.wordSelectionStrategy.selectWord(ctx, config);
    }
    /**
     * Select which opponent to target
     */
    async selectTarget(ctx, config) {
        return this.letterGuessStrategy.selectTarget(ctx, config);
    }
    /**
     * Guess a letter in the target player's word
     */
    async guessLetter(ctx, targetPlayer, config) {
        return this.letterGuessStrategy.guessLetter(ctx, targetPlayer, config);
    }
    /**
     * Decide whether to attempt a full word guess
     */
    async shouldGuessWord(ctx, targetPlayer, config) {
        return this.wordGuessStrategy.shouldGuessWord(ctx, targetPlayer, config);
    }
    /**
     * Guess the full word
     */
    async guessWord(ctx, targetPlayer, config) {
        return this.wordGuessStrategy.guessWord(ctx, targetPlayer, config);
    }
    /**
     * Select which blank position to reveal (when targeted)
     */
    async selectBlankPosition(positions, ctx, config) {
        return this.positionSelectionStrategy.selectBlankPosition(positions, ctx, config);
    }
    /**
     * Select which duplicate letter position to reveal (when targeted)
     */
    async selectDuplicatePosition(positions, letter, ctx, config) {
        return this.positionSelectionStrategy.selectDuplicatePosition(positions, letter, ctx, config);
    }
}
exports.BotStrategy = BotStrategy;
// Re-export individual strategies for testing
var WordSelectionStrategy_2 = require("./WordSelectionStrategy");
Object.defineProperty(exports, "WordSelectionStrategy", { enumerable: true, get: function () { return WordSelectionStrategy_2.WordSelectionStrategy; } });
var LetterGuessStrategy_2 = require("./LetterGuessStrategy");
Object.defineProperty(exports, "LetterGuessStrategy", { enumerable: true, get: function () { return LetterGuessStrategy_2.LetterGuessStrategy; } });
var WordGuessStrategy_2 = require("./WordGuessStrategy");
Object.defineProperty(exports, "WordGuessStrategy", { enumerable: true, get: function () { return WordGuessStrategy_2.WordGuessStrategy; } });
var PositionSelectionStrategy_2 = require("./PositionSelectionStrategy");
Object.defineProperty(exports, "PositionSelectionStrategy", { enumerable: true, get: function () { return PositionSelectionStrategy_2.PositionSelectionStrategy; } });
//# sourceMappingURL=index.js.map