/**
 * WordHistory - Tracks words used by bots to prevent repetition
 * Stores history in a JSON file and provides methods to check/add words
 */
declare class WordHistoryManager {
    private history;
    private usedWordsSet;
    constructor();
    /**
     * Load history from file
     */
    private loadHistory;
    /**
     * Save history to file
     */
    private saveHistory;
    /**
     * Check if a word has been used recently
     */
    isWordUsed(word: string): boolean;
    /**
     * Add a word to the history
     */
    addWord(word: string, botId?: string, gameId?: string): void;
    /**
     * Get all used words as a Set (for efficient lookup)
     */
    getUsedWords(): Set<string>;
    /**
     * Get count of used words
     */
    getCount(): number;
    /**
     * Filter a list of words to only include unused ones
     */
    filterUnused(words: string[]): string[];
    /**
     * Clear history (for testing)
     */
    clear(): void;
}
export declare const wordHistory: WordHistoryManager;
export {};
//# sourceMappingURL=WordHistory.d.ts.map