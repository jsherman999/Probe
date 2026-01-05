interface ViewerGuess {
    viewerId: string;
    viewerName: string;
    targetPlayerId: string;
    targetPlayerName: string;
    guessedWord: string;
    isCorrect: boolean;
    submittedAt: Date;
}
export declare class GameManager {
    private wordValidator;
    private scoringEngine;
    private viewerGuesses;
    constructor();
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
    processWordGuess(roomCode: string, guessingPlayerId: string, targetPlayerId: string, guessedWord: string): Promise<any>;
    handleTurnTimeout(roomCode: string): Promise<any>;
    updateTimerSettings(roomCode: string, userId: string, turnTimerSeconds: number): Promise<any>;
    archiveGame(gameId: string): Promise<void>;
    submitViewerGuess(roomCode: string, viewerId: string, viewerName: string, targetPlayerId: string, guessedWord: string): Promise<{
        isCorrect: boolean;
        targetPlayerName: string;
    }>;
    getViewerGuesses(roomCode: string): ViewerGuess[];
    getGameHistoryList(): Promise<any[]>;
    getGameHistoryByRoomCode(roomCode: string): Promise<any>;
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
}
export {};
//# sourceMappingURL=GameManager.d.ts.map