import { prisma } from '../server';
import { WordValidator } from './WordValidator';
import { ScoringEngine } from './ScoringEngine';
import crypto from 'crypto';

interface GameState {
  id: string;
  roomCode: string;
  status: string;
  hostId: string;
  players: PlayerState[];
  currentTurnPlayerId: string | null;
  roundNumber: number;
}

interface PlayerState {
  id: string;
  userId: string;
  displayName: string;
  secretWord: string | null;
  revealedPositions: boolean[];
  totalScore: number;
  isEliminated: boolean;
}

export class GameManager {
  private wordValidator: WordValidator;
  private scoringEngine: ScoringEngine;

  constructor() {
    this.wordValidator = new WordValidator();
    this.scoringEngine = new ScoringEngine();
    this.wordValidator.loadDictionary();
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createGame(userId: string): Promise<any> {
    const roomCode = this.generateRoomCode();

    const game = await prisma.game.create({
      data: {
        roomCode,
        status: 'WAITING',
        hostId: userId,
        players: {
          create: {
            userId,
            turnOrder: 0,
          },
        },
      },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    return this.sanitizeGame(game);
  }

  async joinGame(roomCode: string, userId: string): Promise<any> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'WAITING') {
      throw new Error('Game already started');
    }

    if (game.players.length >= game.maxPlayers) {
      throw new Error('Game is full');
    }

    // Check if user already in game
    const existingPlayer = game.players.find(p => p.userId === userId);
    if (existingPlayer) {
      throw new Error('Already in this game');
    }

    const updatedGame = await prisma.game.update({
      where: { id: game.id },
      data: {
        players: {
          create: {
            userId,
            turnOrder: game.players.length,
          },
        },
      },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    return this.sanitizeGame(updatedGame);
  }

  async leaveGame(roomCode: string, userId: string): Promise<void> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    const player = game.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Not in this game');
    }

    await prisma.gamePlayer.delete({
      where: { id: player.id },
    });

    // If host left, assign new host or delete game if no players
    if (game.hostId === userId) {
      const remainingPlayers = game.players.filter(p => p.userId !== userId);
      if (remainingPlayers.length > 0) {
        await prisma.game.update({
          where: { id: game.id },
          data: { hostId: remainingPlayers[0].userId },
        });
      } else {
        await prisma.game.delete({
          where: { id: game.id },
        });
      }
    }
  }

  async startGame(roomCode: string, userId: string): Promise<any> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.hostId !== userId) {
      throw new Error('Only host can start game');
    }

    if (game.players.length < 2) {
      throw new Error('Need at least 2 players');
    }

    const updatedGame = await prisma.game.update({
      where: { id: game.id },
      data: {
        status: 'WORD_SELECTION',
      },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    return this.sanitizeGame(updatedGame);
  }

  async selectWord(roomCode: string, userId: string, word: string): Promise<any> {
    word = word.toUpperCase().trim();

    // Validate word
    if (!this.wordValidator.isValidLength(word)) {
      throw new Error('Word must be 4-12 letters');
    }

    if (!this.wordValidator.hasValidCharacters(word)) {
      throw new Error('Word contains invalid characters');
    }

    if (!this.wordValidator.isValidWord(word)) {
      throw new Error('Not a valid English word');
    }

    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'WORD_SELECTION') {
      throw new Error('Not in word selection phase');
    }

    const player = game.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Not in this game');
    }

    // Hash the word for validation without storing plaintext
    const wordHash = crypto.createHash('sha256').update(word).digest('hex');

    // Initialize revealed positions
    const revealedPositions = new Array(word.length).fill(false);

    await prisma.gamePlayer.update({
      where: { id: player.id },
      data: {
        secretWord: word,
        secretWordHash: wordHash,
        revealedPositions: JSON.stringify(revealedPositions),
      },
    });

    // Check if all players have selected words
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });

    const allReady = updatedPlayers.every(p => p.secretWord !== null);

    if (allReady) {
      // Start the game
      const updatedGame = await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
          currentTurnPlayerId: updatedPlayers[0].userId,
        },
        include: {
          players: {
            include: {
              user: true,
            },
          },
        },
      });

      return this.sanitizeGame(updatedGame);
    }

    const gameWithPlayers = await prisma.game.findUnique({
      where: { id: game.id },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    return this.sanitizeGame(gameWithPlayers!);
  }

  async processGuess(
    roomCode: string,
    playerId: string,
    targetPlayerId: string,
    letter: string
  ): Promise<any> {
    letter = letter.toUpperCase();

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
      throw new Error('Game not found');
    }

    if (game.status !== 'ACTIVE') {
      throw new Error('Game not active');
    }

    if (game.currentTurnPlayerId !== playerId) {
      throw new Error('Not your turn');
    }

    const targetPlayer = game.players.find(p => p.userId === targetPlayerId);
    if (!targetPlayer || targetPlayer.isEliminated) {
      throw new Error('Invalid target player');
    }

    const word = targetPlayer.secretWord!;
    const revealedPositions = JSON.parse(targetPlayer.revealedPositions as any) as boolean[];

    // Find positions of the letter
    const positions: number[] = [];
    for (let i = 0; i < word.length; i++) {
      if (word[i] === letter && !revealedPositions[i]) {
        positions.push(i);
      }
    }

    const isCorrect = positions.length > 0;
    let pointsScored = 0;

    if (isCorrect) {
      // Update revealed positions
      positions.forEach(pos => {
        revealedPositions[pos] = true;
      });

      // Calculate score
      pointsScored = this.scoringEngine.calculateScore(letter, positions.length);

      // Update player
      await prisma.gamePlayer.update({
        where: { id: targetPlayer.id },
        data: {
          revealedPositions: JSON.stringify(revealedPositions),
          totalScore: targetPlayer.totalScore + pointsScored,
          isEliminated: revealedPositions.every(p => p),
        },
      });
    }

    // Record turn
    await prisma.gameTurn.create({
      data: {
        gameId: game.id,
        playerId,
        targetPlayerId,
        guessedLetter: letter,
        isCorrect,
        positionsRevealed: positions,
        pointsScored,
        turnNumber: game.roundNumber,
      },
    });

    // If incorrect, advance turn
    if (!isCorrect) {
      const currentIndex = game.players.findIndex(p => p.userId === playerId);
      const nextIndex = (currentIndex + 1) % game.players.length;
      const nextPlayer = game.players[nextIndex];

      await prisma.game.update({
        where: { id: game.id },
        data: {
          currentTurnPlayerId: nextPlayer.userId,
        },
      });
    }

    // Check if game is over
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });

    const activePlayers = updatedPlayers.filter(p => !p.isEliminated);
    const gameOver = activePlayers.length <= 1;

    let finalResults = null;
    if (gameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Record results
      const sorted = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      finalResults = await Promise.all(
        sorted.map((p, index) =>
          prisma.gameResult.create({
            data: {
              gameId: game.id,
              playerId: p.userId,
              finalScore: p.totalScore,
              placement: index + 1,
            },
            include: {
              player: true,
            },
          })
        )
      );
    }

    return {
      isCorrect,
      positions,
      pointsScored,
      letter,
      targetPlayerId,
      revealedWord: revealedPositions.map((revealed, i) => (revealed ? word[i] : null)),
      wordCompleted: revealedPositions.every(p => p),
      gameOver,
      finalResults,
      currentTurnPlayerId: isCorrect ? playerId : game.players[(game.players.findIndex(p => p.userId === playerId) + 1) % game.players.length].userId,
    };
  }

  private sanitizeGame(game: any): any {
    return {
      ...game,
      players: game.players.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        displayName: p.user?.displayName || 'Unknown',
        turnOrder: p.turnOrder,
        wordLength: p.secretWord?.length || 0,
        hasSelectedWord: p.secretWord !== null,
        revealedPositions: p.secretWord
          ? JSON.parse(p.revealedPositions as any).map((revealed: boolean, i: number) =>
              revealed ? p.secretWord[i] : null
            )
          : [],
        totalScore: p.totalScore,
        isEliminated: p.isEliminated,
      })),
    };
  }
}
