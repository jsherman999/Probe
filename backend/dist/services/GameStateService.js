"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStateService = void 0;
const GameManager_1 = require("../game/GameManager");
class GameStateService {
    gameManager;
    constructor() {
        this.gameManager = new GameManager_1.GameManager();
    }
    async getGameState(gameId) {
        return await this.gameManager.getGame(gameId);
    }
    async getGameByRoomCode(roomCode) {
        return await this.gameManager.getGameByRoomCode(roomCode);
    }
    async isPlayerInGame(gameId, playerId) {
        try {
            const game = await this.gameManager.getGame(gameId);
            return game.players.some((p) => p.userId === playerId);
        }
        catch {
            return false;
        }
    }
    async isPlayersTurn(gameId, playerId) {
        try {
            const game = await this.gameManager.getGame(gameId);
            return game.currentTurnPlayerId === playerId;
        }
        catch {
            return false;
        }
    }
    async getPlayerState(gameId, playerId) {
        const game = await this.gameManager.getGame(gameId);
        return game.players.find((p) => p.userId === playerId);
    }
    async getAllActivePlayers(gameId) {
        const game = await this.gameManager.getGame(gameId);
        return game.players.filter((p) => !p.isEliminated);
    }
    async getUsedLetters(gameId) {
        const game = await this.gameManager.getGame(gameId);
        const usedLetters = new Set();
        game.turns.forEach((turn) => {
            usedLetters.add(turn.letter.toUpperCase());
        });
        return Array.from(usedLetters);
    }
}
exports.GameStateService = GameStateService;
//# sourceMappingURL=GameStateService.js.map