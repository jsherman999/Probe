import { GameManager } from '../game/GameManager';

export class GameStateService {
  private gameManager: GameManager;

  constructor() {
    this.gameManager = new GameManager();
  }

  async getGameState(gameId: string) {
    return await this.gameManager.getGame(gameId);
  }

  async getGameByRoomCode(roomCode: string) {
    return await this.gameManager.getGameByRoomCode(roomCode);
  }

  async isPlayerInGame(gameId: string, playerId: string): Promise<boolean> {
    try {
      const game = await this.gameManager.getGame(gameId);
      return game.players.some((p: any) => p.userId === playerId);
    } catch {
      return false;
    }
  }

  async isPlayersTurn(gameId: string, playerId: string): Promise<boolean> {
    try {
      const game = await this.gameManager.getGame(gameId);
      return game.currentTurnPlayerId === playerId;
    } catch {
      return false;
    }
  }

  async getPlayerState(gameId: string, playerId: string) {
    const game = await this.gameManager.getGame(gameId);
    return game.players.find((p: any) => p.userId === playerId);
  }

  async getAllActivePlayers(gameId: string) {
    const game = await this.gameManager.getGame(gameId);
    return game.players.filter((p: any) => !p.isEliminated);
  }

  async getUsedLetters(gameId: string): Promise<string[]> {
    const game = await this.gameManager.getGame(gameId);
    const usedLetters = new Set<string>();
    
    game.turns.forEach((turn: any) => {
      usedLetters.add(turn.letter.toUpperCase());
    });
    
    return Array.from(usedLetters);
  }
}
