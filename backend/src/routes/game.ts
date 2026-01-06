import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { GameManager } from '../game/GameManager';

const router = Router();
const gameManager = new GameManager();

// Middleware to verify JWT
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all archived games - MUST be before /:roomCode to avoid matching "history" as roomCode
router.get('/history/all', authenticate, async (req: any, res) => {
  try {
    const games = await gameManager.getGameHistoryList();
    res.json(games);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get AI/Bot stats from all games - MUST be before /:roomCode
router.get('/bot-stats', authenticate, async (req: any, res) => {
  try {
    const stats = await gameManager.getBotStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific archived game by room code - MUST be before /:roomCode
router.get('/history/game/:roomCode', authenticate, async (req: any, res) => {
  try {
    const { roomCode } = req.params;
    const game = await gameManager.getGameHistoryByRoomCode(roomCode);
    res.json(game);
  } catch (error: any) {
    if (error.message === 'Game history not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Migrate all game history (re-archive games still in database)
router.post('/history/migrate', authenticate, async (req: any, res) => {
  try {
    const result = await gameManager.migrateAllGameHistory();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all waiting games (lobby) - MUST be before /:roomCode
router.get('/lobby/all', authenticate, async (req: any, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { status: 'WAITING' },
      include: {
        players: true,
        host: { select: { displayName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(games.map(g => ({
      roomCode: g.roomCode,
      hostName: (g as any).host?.displayName || 'Unknown',
      playerCount: g.players.length,
      maxPlayers: 4,
      createdAt: g.createdAt
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all running games (for observer mode) - MUST be before /:roomCode
router.get('/running/all', authenticate, async (req: any, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        status: { in: ['ACTIVE', 'WORD_SELECTION'] }
      },
      include: {
        players: {
          include: {
            user: { select: { displayName: true } }
          }
        },
        host: { select: { displayName: true } }
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json(games.map(g => ({
      roomCode: g.roomCode,
      status: g.status,
      hostName: (g as any).host?.displayName || 'Unknown',
      playerCount: g.players.length,
      playerNames: g.players.map(p => (p as any).user?.displayName || 'Unknown'),
      startedAt: g.startedAt
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get game by room code
router.get('/:roomCode', authenticate, async (req: any, res) => {
  try {
    const { roomCode } = req.params;

    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Don't send secret words to clients
    const sanitizedGame = {
      ...game,
      players: game.players.map(p => ({
        ...p,
        secretWord: undefined,
        secretWordHash: undefined,
      })),
    };

    res.json(sanitizedGame);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get game history
router.get('/:roomCode/history', authenticate, async (req: any, res) => {
  try {
    const { roomCode } = req.params;

    const game = await prisma.game.findUnique({
      where: { roomCode },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const turns = await prisma.gameTurn.findMany({
      where: { gameId: game.id },
      include: {
        player: true,
        targetPlayer: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(turns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a game from the lobby (host or force)
router.delete('/lobby/:roomCode', authenticate, async (req: any, res) => {
  try {
    const { roomCode } = req.params;
    const force = req.query.force === 'true';
    await gameManager.removeGame(roomCode, req.userId, force);
    res.json({ success: true, roomCode });
  } catch (error: any) {
    if (error.message === 'Game not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only host can remove the game') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a game from history (archived files)
router.delete('/history/:roomCode', authenticate, async (req: any, res) => {
  try {
    const { roomCode } = req.params;
    await gameManager.removeGameHistory(roomCode);
    res.json({ success: true, roomCode });
  } catch (error: any) {
    if (error.message === 'Game history not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual cleanup (for admin use)
router.post('/cleanup', authenticate, async (req: any, res) => {
  try {
    const forceAll = req.query.forceAll === 'true';

    if (forceAll) {
      // Force cleanup ALL non-completed games
      const result = await gameManager.forceCleanupAllGames();
      res.json(result);
    } else {
      const result = await gameManager.cleanupStaleGames();
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
