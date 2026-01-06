export declare class GameStateService {
    private gameManager;
    constructor();
    getGameState(gameId: string): Promise<any>;
    getGameByRoomCode(roomCode: string): Promise<any>;
    isPlayerInGame(gameId: string, playerId: string): Promise<boolean>;
    isPlayersTurn(gameId: string, playerId: string): Promise<boolean>;
    getPlayerState(gameId: string, playerId: string): Promise<any>;
    getAllActivePlayers(gameId: string): Promise<any>;
    getUsedLetters(gameId: string): Promise<string[]>;
}
//# sourceMappingURL=GameStateService.d.ts.map