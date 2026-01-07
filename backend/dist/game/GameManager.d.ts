interface ViewerGuess {
    viewerId: string;
    viewerName: string;
    targetPlayerId: string;
    targetPlayerName: string;
    guessedWord: string;
    isCorrect: boolean;
    submittedAt: Date;
}
export interface TurnCardInfo {
    type: string;
    label: string;
    multiplier?: number;
    affectedPlayerId?: string;
    affectedPlayerName?: string;
}
export declare class GameManager {
    private wordValidator;
    private scoringEngine;
    private viewerGuesses;
    constructor();
    private drawTurnCard;
    private getPlayerId;
    private getPlayerDisplayName;
    private getAdjacentPlayer;
    private generateRoomCode;
    createGame(userId: string, username: string, turnTimerSeconds?: number): Promise<any>;
    getGameByRoomCode(roomCode: string, forUserId?: string): Promise<any>;
    joinGame(roomCode: string, userId: string): Promise<any>;
    leaveGame(roomCode: string, userId: string): Promise<{
        gameEnded: boolean;
        game: any | null;
    }>;
    endGame(roomCode: string, userId: string, force?: boolean): Promise<any>;
    startGame(roomCode: string, userId: string): Promise<any>;
    private readonly BLANK_CHAR;
    selectWord(roomCode: string, userId: string, word: string, frontPadding?: number, backPadding?: number): Promise<any>;
    processGuess(roomCode: string, playerId: string, targetPlayerId: string, letter: string): Promise<any>;
    resolveBlankSelection(roomCode: string, guessingPlayerId: string, targetPlayerId: string, selectedPosition: number): Promise<any>;
    resolveDuplicateSelection(roomCode: string, guessingPlayerId: string, targetPlayerId: string, selectedPosition: number, letter: string): Promise<any>;
    resolveExposeCard(roomCode: string, affectedPlayerId: string, selectedPosition: number): Promise<any>;
    processWordGuess(roomCode: string, guessingPlayerId: string, targetPlayerId: string, guessedWord: string): Promise<any>;
    handleTurnTimeout(roomCode: string): Promise<any>;
    updateTimerSettings(roomCode: string, userId: string, turnTimerSeconds: number): Promise<any>;
    archiveGame(gameId: string): Promise<void>;
    reArchiveGame(roomCode: string): Promise<void>;
    migrateAllGameHistory(): Promise<{
        migrated: string[];
        failed: string[];
    }>;
    submitViewerGuess(roomCode: string, viewerId: string, viewerName: string, targetPlayerId: string, guessedWord: string): Promise<{
        isCorrect: boolean;
        targetPlayerName: string;
    }>;
    getViewerGuesses(roomCode: string): ViewerGuess[];
    getGameHistoryList(): Promise<any[]>;
    getGameHistoryByRoomCode(roomCode: string): Promise<any>;
    getBotStats(): Promise<any[]>;
    cleanupStaleGames(): Promise<{
        removed: number;
        roomCodes: string[];
    }>;
    forceCleanupAllGames(): Promise<{
        removed: number;
        roomCodes: string[];
    }>;
    removeGame(roomCode: string, userId?: string, force?: boolean): Promise<void>;
    removeGameHistory(roomCode: string): Promise<void>;
    private sanitizeGame;
    /**
     * Add a bot player to a game
     */
    addBotPlayer(roomCode: string, bot: any): Promise<any>;
    /**
     * Remove a bot player from a game
     */
    removeBotPlayer(roomCode: string, botId: string): Promise<any>;
}
export {};
//# sourceMappingURL=GameManager.d.ts.map