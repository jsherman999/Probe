import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock the database layer before importing GameManager so tests run without a
// real (or stubbed) Prisma engine.
const mockPrisma = vi.hoisted(() => ({
  game: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  gamePlayer: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  gameTurn: { create: vi.fn() },
  gameResult: { create: vi.fn() },
}));

vi.mock('../db', () => ({ prisma: mockPrisma }));

import { GameManager } from '../game/GameManager';

// Mock the online dictionary API (WordValidator) for deterministic word checks
const mockFetch = vi.fn(async () => ({ ok: true } as Response));

/** Build a fake game row matching the shape sanitizeGame expects */
function makePlayer(userId: string, displayName: string, overrides: Record<string, any> = {}) {
  return {
    id: `player-${userId}`,
    userId,
    botId: null,
    isBot: false,
    botDisplayName: null,
    botModelName: null,
    botDifficulty: null,
    turnOrder: 0,
    secretWord: null,
    paddedWord: null,
    frontPadding: 0,
    backPadding: 0,
    revealedPositions: null,
    missedLetters: [],
    totalScore: 0,
    isEliminated: false,
    user: { displayName },
    ...overrides,
  };
}

function makeGame(overrides: Record<string, any> = {}) {
  return {
    id: 'game-1',
    roomCode: 'testuser_2501010000',
    status: 'WAITING',
    hostId: 'host-1',
    currentTurnPlayerId: null,
    roundNumber: 1,
    turnTimerSeconds: 300,
    currentTurnStartedAt: null,
    currentTurnCard: null,
    turnCardMultiplier: 1,
    turnCardUsed: false,
    pendingExposePlayerId: null,
    maxPlayers: 4,
    players: [makePlayer('host-1', 'Host')],
    ...overrides,
  };
}

describe('GameManager', () => {
  const gameManager = new GameManager();

  beforeEach(() => {
    vi.clearAllMocks(); // fresh call counts, implementations preserved
    vi.restoreAllMocks(); // drop the previous Math.random spy
    vi.stubGlobal('fetch', mockFetch);
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic "normal" turn card
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Room Code Generation', () => {
    it('should derive the code from a sanitized username plus timestamp', () => {
      const code = (gameManager as any).generateRoomCode('Test User!');
      // Sanitized username + yyMMddHHmm suffix (10 digits)
      expect(code).toMatch(/^testuser_\d{10}$/);
    });

    it('should be deterministic for the same username within a minute', () => {
      const a = (gameManager as any).generateRoomCode('Alice');
      const b = (gameManager as any).generateRoomCode('Alice');
      expect(a).toBe(b);
    });

    it('should differ for different usernames', () => {
      const a = (gameManager as any).generateRoomCode('Alice');
      const b = (gameManager as any).generateRoomCode('Bob');
      expect(a).not.toBe(b);
    });

    it('should strip special characters from usernames', () => {
      const code = (gameManager as any).generateRoomCode('a@b#c$d');
      expect(code).toMatch(/^abcd_\d{10}$/);
    });
  });

  describe('Game Creation', () => {
    it('should create a game with the host as first player', async () => {
      mockPrisma.game.create.mockResolvedValue(makeGame());

      const game = await gameManager.createGame('host-1', 'Test User!');

      expect(game).toBeDefined();
      expect(game.status).toBe('WAITING');
      expect(game.hostId).toBe('host-1');
      expect(game.players).toHaveLength(1);
      expect(game.turnTimerSeconds).toBe(300); // default 5 minutes

      const createCall = mockPrisma.game.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('WAITING');
      expect(createCall.data.hostId).toBe('host-1');
    });

    it('should clamp the turn timer to 10s - 30min', async () => {
      mockPrisma.game.create.mockResolvedValue(makeGame());

      await gameManager.createGame('host-1', 'Host', 5);
      expect(mockPrisma.game.create.mock.calls[0][0].data.turnTimerSeconds).toBe(10);

      await gameManager.createGame('host-1', 'Host', 9999);
      expect(mockPrisma.game.create.mock.calls[1][0].data.turnTimerSeconds).toBe(1800);
    });
  });

  describe('Player Joining', () => {
    it('should allow players to join a waiting game', async () => {
      const base = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(base);
      mockPrisma.game.update.mockResolvedValue(
        makeGame({ players: [makePlayer('host-1', 'Host'), makePlayer('player-2', 'P2')] })
      );

      const joined = await gameManager.joinGame(base.roomCode, 'player-2');

      expect(joined.players).toHaveLength(2);
      expect(mockPrisma.game.update).toHaveBeenCalled();
    });

    it('should prevent joining full games', async () => {
      const base = makeGame({ maxPlayers: 2, players: [makePlayer('host-1', 'Host'), makePlayer('p2', 'P2')] });
      mockPrisma.game.findUnique.mockResolvedValue(base);

      await expect(gameManager.joinGame(base.roomCode, 'player-3')).rejects.toThrow('full');
    });

    it('should prevent joining with an unknown room code', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(gameManager.joinGame('NOPE', 'player')).rejects.toThrow('not found');
    });

    it('should return current state when the user is already in the game', async () => {
      const base = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(base);

      const result = await gameManager.joinGame(base.roomCode, 'host-1');
      expect(result.players).toHaveLength(1);
      expect(mockPrisma.game.update).not.toHaveBeenCalled();
    });
  });

  describe('Word Selection', () => {
    it('should accept valid words during word selection', async () => {
      const base = makeGame({ status: 'WORD_SELECTION' });
      mockPrisma.game.findUnique.mockResolvedValue(base);
      const revealed = JSON.stringify([false, false, false, false, false]); // 5 positions for PROBE
      mockPrisma.gamePlayer.update.mockResolvedValue({});
      mockPrisma.gamePlayer.findMany.mockResolvedValue([
        makePlayer('host-1', 'Host', { secretWord: 'PROBE', revealedPositions: revealed }),
      ]);
      mockPrisma.game.update.mockResolvedValue(
        makeGame({ status: 'ACTIVE', players: [makePlayer('host-1', 'Host', { secretWord: 'PROBE', revealedPositions: revealed })] })
      );

      const game = await gameManager.selectWord(base.roomCode, 'host-1', 'PROBE');

      expect(game.status).toBe('ACTIVE');
    });

    it('should reject words that are too short', async () => {
      await expect(gameManager.selectWord('room', 'host-1', 'CAT')).rejects.toThrow(/4-12/);
      expect(mockPrisma.game.findUnique).not.toHaveBeenCalled();
    });

    it('should reject words that are too long', async () => {
      await expect(gameManager.selectWord('room', 'host-1', 'EXTRAORDINARY')).rejects.toThrow(/exceed 12/);
    });

    it('should reject words with invalid characters', async () => {
      await expect(gameManager.selectWord('room', 'host-1', 'WORD123')).rejects.toThrow(/invalid characters/);
    });

    it('should reject words outside the word selection phase', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame({ status: 'WAITING' }));

      await expect(gameManager.selectWord('room', 'host-1', 'PROBE')).rejects.toThrow(/word selection/i);
    });
  });
});
