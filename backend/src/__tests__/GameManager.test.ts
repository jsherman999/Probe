import { describe, it, expect } from 'vitest';
import { GameManager } from '../game/GameManager';

describe('GameManager', () => {
  const gameManager = new GameManager();

  describe('Room Code Generation', () => {
    it('should generate unique 6-character room codes', () => {
      const codes = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const code = (gameManager as any).generateRoomCode();
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
        codes.add(code);
      }
      
      // Should have at least 95 unique codes out of 100 (allowing for rare collisions)
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('Game Creation', () => {
    it('should create a game with valid parameters', async () => {
      const hostId = 'test-user-1';
      const game = await gameManager.createGame(hostId, 4);
      
      expect(game).toBeDefined();
      expect(game.roomCode).toHaveLength(6);
      expect(game.status).toBe('WAITING');
      expect(game.maxPlayers).toBe(4);
      expect(game.players).toHaveLength(1);
      expect(game.hostId).toBe(hostId);
    });

    it('should reject invalid maxPlayers', async () => {
      await expect(gameManager.createGame('test-user', 1)).rejects.toThrow();
      await expect(gameManager.createGame('test-user', 5)).rejects.toThrow();
    });
  });

  describe('Player Joining', () => {
    it('should allow players to join a game', async () => {
      const game = await gameManager.createGame('host-user', 4);
      const joinedGame = await gameManager.joinGame(game.roomCode, 'player-2');
      
      expect(joinedGame.players).toHaveLength(2);
      expect(joinedGame.players.some(p => p.userId === 'player-2')).toBe(true);
    });

    it('should prevent joining full games', async () => {
      const game = await gameManager.createGame('host', 2);
      await gameManager.joinGame(game.roomCode, 'player-2');
      
      await expect(gameManager.joinGame(game.roomCode, 'player-3')).rejects.toThrow('full');
    });

    it('should prevent joining with invalid room code', async () => {
      await expect(gameManager.joinGame('INVALID', 'player')).rejects.toThrow();
    });
  });

  describe('Word Selection', () => {
    it('should accept valid words', async () => {
      const game = await gameManager.createGame('host', 2);
      await gameManager.joinGame(game.roomCode, 'player-2');
      
      await expect(gameManager.selectWord(game.roomCode, 'host', 'PROBE')).resolves.not.toThrow();
    });

    it('should reject words that are too short', async () => {
      const game = await gameManager.createGame('host', 2);
      
      await expect(gameManager.selectWord(game.roomCode, 'host', 'CAT')).rejects.toThrow();
    });

    it('should reject words that are too long', async () => {
      const game = await gameManager.createGame('host', 2);
      
      await expect(gameManager.selectWord(game.roomCode, 'host', 'EXTRAORDINARY')).rejects.toThrow();
    });
  });
});
