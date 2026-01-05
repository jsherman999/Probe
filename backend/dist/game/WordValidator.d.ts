export declare class WordValidator {
    private validWordCache;
    private invalidWordCache;
    private apiTimeout;
    isValidWord(word: string): Promise<boolean>;
    private checkDictionaryAPI;
    isValidLength(word: string): boolean;
    hasValidCharacters(word: string): boolean;
    loadDictionary(): Promise<void>;
    clearCache(): void;
    getCacheStats(): {
        valid: number;
        invalid: number;
    };
}
//# sourceMappingURL=WordValidator.d.ts.map