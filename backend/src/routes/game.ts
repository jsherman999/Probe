import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

const router = Router();

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

export default router;
