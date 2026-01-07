"use strict";
/**
 * WordHistory - Tracks words used by bots to prevent repetition
 * Stores history in a JSON file and provides methods to check/add words
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordHistory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const HISTORY_FILE = path.join(process.cwd(), 'data', 'bot-word-history.json');
const MAX_HISTORY_SIZE = 500; // Keep last 500 words
class WordHistoryManager {
    history;
    usedWordsSet;
    constructor() {
        this.history = this.loadHistory();
        this.usedWordsSet = new Set(this.history.words.map(w => w.word.toUpperCase()));
    }
    /**
     * Load history from file
     */
    loadHistory() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(HISTORY_FILE);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            if (fs.existsSync(HISTORY_FILE)) {
                const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
                const parsed = JSON.parse(data);
                console.log(`[WordHistory] Loaded ${parsed.words.length} words from history`);
                return parsed;
            }
        }
        catch (error) {
            console.error('[WordHistory] Error loading history:', error);
        }
        return { words: [], lastUpdated: new Date().toISOString() };
    }
    /**
     * Save history to file
     */
    saveHistory() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(HISTORY_FILE);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            this.history.lastUpdated = new Date().toISOString();
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
        }
        catch (error) {
            console.error('[WordHistory] Error saving history:', error);
        }
    }
    /**
     * Check if a word has been used recently
     */
    isWordUsed(word) {
        return this.usedWordsSet.has(word.toUpperCase());
    }
    /**
     * Add a word to the history
     */
    addWord(word, botId, gameId) {
        const upperWord = word.toUpperCase();
        // Don't add duplicates
        if (this.usedWordsSet.has(upperWord)) {
            return;
        }
        const entry = {
            word: upperWord,
            usedAt: new Date().toISOString(),
            botId,
            gameId,
        };
        this.history.words.push(entry);
        this.usedWordsSet.add(upperWord);
        // Trim history if too large (remove oldest entries)
        if (this.history.words.length > MAX_HISTORY_SIZE) {
            const removed = this.history.words.splice(0, this.history.words.length - MAX_HISTORY_SIZE);
            // Update the set by removing old words
            for (const entry of removed) {
                // Only remove from set if word isn't in remaining history
                if (!this.history.words.some(w => w.word === entry.word)) {
                    this.usedWordsSet.delete(entry.word);
                }
            }
        }
        this.saveHistory();
        console.log(`[WordHistory] Added word "${upperWord}" (total: ${this.history.words.length})`);
    }
    /**
     * Get all used words as a Set (for efficient lookup)
     */
    getUsedWords() {
        return this.usedWordsSet;
    }
    /**
     * Get count of used words
     */
    getCount() {
        return this.usedWordsSet.size;
    }
    /**
     * Filter a list of words to only include unused ones
     */
    filterUnused(words) {
        return words.filter(w => !this.usedWordsSet.has(w.toUpperCase()));
    }
    /**
     * Clear history (for testing)
     */
    clear() {
        this.history = { words: [], lastUpdated: new Date().toISOString() };
        this.usedWordsSet.clear();
        this.saveHistory();
        console.log('[WordHistory] History cleared');
    }
}
// Singleton instance
exports.wordHistory = new WordHistoryManager();
//# sourceMappingURL=WordHistory.js.map