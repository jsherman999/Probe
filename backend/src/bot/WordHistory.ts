/**
 * WordHistory - Tracks words used by bots to prevent repetition
 * Stores history in a JSON file and provides methods to check/add words
 */

import * as fs from 'fs';
import * as path from 'path';

interface WordHistoryEntry {
  word: string;
  usedAt: string; // ISO timestamp
  botId?: string;
  gameId?: string;
}

interface WordHistoryData {
  words: WordHistoryEntry[];
  lastUpdated: string;
}

const HISTORY_FILE = path.join(process.cwd(), 'data', 'bot-word-history.json');
const MAX_HISTORY_SIZE = 500; // Keep last 500 words

class WordHistoryManager {
  private history: WordHistoryData;
  private usedWordsSet: Set<string>;

  constructor() {
    this.history = this.loadHistory();
    this.usedWordsSet = new Set(this.history.words.map(w => w.word.toUpperCase()));
  }

  /**
   * Load history from file
   */
  private loadHistory(): WordHistoryData {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(data) as WordHistoryData;
        console.log(`[WordHistory] Loaded ${parsed.words.length} words from history`);
        return parsed;
      }
    } catch (error) {
      console.error('[WordHistory] Error loading history:', error);
    }

    return { words: [], lastUpdated: new Date().toISOString() };
  }

  /**
   * Save history to file
   */
  private saveHistory(): void {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.history.lastUpdated = new Date().toISOString();
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('[WordHistory] Error saving history:', error);
    }
  }

  /**
   * Check if a word has been used recently
   */
  isWordUsed(word: string): boolean {
    return this.usedWordsSet.has(word.toUpperCase());
  }

  /**
   * Add a word to the history
   */
  addWord(word: string, botId?: string, gameId?: string): void {
    const upperWord = word.toUpperCase();

    // Don't add duplicates
    if (this.usedWordsSet.has(upperWord)) {
      return;
    }

    const entry: WordHistoryEntry = {
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
  getUsedWords(): Set<string> {
    return this.usedWordsSet;
  }

  /**
   * Get count of used words
   */
  getCount(): number {
    return this.usedWordsSet.size;
  }

  /**
   * Filter a list of words to only include unused ones
   */
  filterUnused(words: string[]): string[] {
    return words.filter(w => !this.usedWordsSet.has(w.toUpperCase()));
  }

  /**
   * Clear history (for testing)
   */
  clear(): void {
    this.history = { words: [], lastUpdated: new Date().toISOString() };
    this.usedWordsSet.clear();
    this.saveHistory();
    console.log('[WordHistory] History cleared');
  }
}

// Singleton instance
export const wordHistory = new WordHistoryManager();
