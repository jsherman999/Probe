"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordValidator = void 0;
class WordValidator {
    validWordCache = new Set();
    invalidWordCache = new Set();
    apiTimeout = 3000; // 3 seconds
    async isValidWord(word) {
        const upperWord = word.toUpperCase();
        // Basic validation first
        if (!this.isValidLength(word) || !this.hasValidCharacters(word)) {
            return false;
        }
        // Check cache first
        if (this.validWordCache.has(upperWord)) {
            return true;
        }
        if (this.invalidWordCache.has(upperWord)) {
            return false;
        }
        // Try online dictionary API
        try {
            const isValid = await this.checkDictionaryAPI(word.toLowerCase());
            // Cache the result
            if (isValid) {
                this.validWordCache.add(upperWord);
            }
            else {
                this.invalidWordCache.add(upperWord);
            }
            return isValid;
        }
        catch (error) {
            // API failed - fallback to accepting the word
            console.warn(`Dictionary API failed for "${word}", accepting word as fallback:`, error);
            this.validWordCache.add(upperWord); // Cache as valid since we're accepting it
            return true;
        }
    }
    async checkDictionaryAPI(word) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            // 200 = word found, 404 = word not found
            return response.ok;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Dictionary API timeout');
            }
            throw error;
        }
    }
    isValidLength(word) {
        const len = word.length;
        return len >= 4 && len <= 12;
    }
    hasValidCharacters(word) {
        // Only letters A-Z, no digits or special characters
        return /^[A-Za-z]+$/.test(word);
    }
    // No-op - kept for interface compatibility
    async loadDictionary() {
        // Dictionary is now validated via API
    }
    // Utility to clear caches if needed
    clearCache() {
        this.validWordCache.clear();
        this.invalidWordCache.clear();
    }
    // Get cache stats for debugging
    getCacheStats() {
        return {
            valid: this.validWordCache.size,
            invalid: this.invalidWordCache.size,
        };
    }
}
exports.WordValidator = WordValidator;
//# sourceMappingURL=WordValidator.js.map