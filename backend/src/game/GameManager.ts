import { prisma } from '../server';
import { WordValidator } from './WordValidator';
import { ScoringEngine } from './ScoringEngine';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = '/Users/jay/cc_projects/Probe/data/games';

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

  async createGame(userId: string, turnTimerSeconds?: number): Promise<any> {
    const roomCode = this.generateRoomCode();

    // Validate timer: minimum 10 seconds, maximum 30 minutes
    const validTimer = turnTimerSeconds
      ? Math.max(10, Math.min(1800, turnTimerSeconds))
      : 300; // default 5 minutes

    const game = await prisma.game.create({
      data: {
        roomCode,
        status: 'WAITING',
        hostId: userId,
        turnTimerSeconds: validTimer,
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

  async getGameByRoomCode(roomCode: string): Promise<any> {
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

    // Check if user already in game - if so, just return current state
    const existingPlayer = game.players.find(p => p.userId === userId);
    if (existingPlayer) {
      return this.getGameByRoomCode(roomCode);
    }

    if (game.status !== 'WAITING' && game.status !== 'WORD_SELECTION') {
      throw new Error('Game already started');
    }

    if (game.players.length >= game.maxPlayers) {
      throw new Error('Game is full');
    }

    try {
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
    } catch (error: any) {
      // Handle race condition - user may have joined via concurrent request
      if (error.code === 'P2002') {
        // Unique constraint violation - user already joined
        return this.getGameByRoomCode(roomCode);
      }
      throw error;
    }
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

  // Blank character for padding
  private readonly BLANK_CHAR = '\u2022'; // bullet character

  async selectWord(
    roomCode: string,
    userId: string,
    word: string,
    frontPadding: number = 0,
    backPadding: number = 0
  ): Promise<any> {
    word = word.toUpperCase().trim();

    // Validate padding
    if (frontPadding < 0 || backPadding < 0) {
      throw new Error('Padding cannot be negative');
    }

    const totalLength = word.length + frontPadding + backPadding;
    if (totalLength > 12) {
      throw new Error('Total word length with padding cannot exceed 12');
    }

    // Validate word
    if (!this.wordValidator.isValidLength(word)) {
      throw new Error('Word must be 4-12 letters');
    }

    if (!this.wordValidator.hasValidCharacters(word)) {
      throw new Error('Word contains invalid characters');
    }

    if (!(await this.wordValidator.isValidWord(word))) {
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

    // Create padded word
    const paddedWord = this.BLANK_CHAR.repeat(frontPadding) + word + this.BLANK_CHAR.repeat(backPadding);

    // Hash the word for validation without storing plaintext
    const wordHash = crypto.createHash('sha256').update(word).digest('hex');

    // Initialize revealed positions for padded word length
    const revealedPositions = new Array(paddedWord.length).fill(false);

    await prisma.gamePlayer.update({
      where: { id: player.id },
      data: {
        secretWord: word,
        secretWordHash: wordHash,
        paddedWord: paddedWord,
        frontPadding: frontPadding,
        backPadding: backPadding,
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
          currentTurnStartedAt: new Date(),
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

    // Use paddedWord if available, otherwise fall back to secretWord
    const word = targetPlayer.paddedWord || targetPlayer.secretWord!;
    const revealedPositions = JSON.parse(targetPlayer.revealedPositions as any) as boolean[];

    // Handle special "BLANK" guess for padding
    const isBlankGuess = letter === 'BLANK';
    const charToFind = isBlankGuess ? this.BLANK_CHAR : letter;

    // Find positions of the letter/blank
    const positions: number[] = [];
    for (let i = 0; i < word.length; i++) {
      if (word[i] === charToFind && !revealedPositions[i]) {
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

      // Calculate score based on position (5, 10, 15 pattern)
      // Blanks score 0 points
      const isBlankPosition = (pos: number) => word[pos] === this.BLANK_CHAR;
      pointsScored = this.scoringEngine.calculateScore(positions, isBlankPosition);

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

    // If incorrect, advance turn and track missed letter
    if (!isCorrect) {
      // Add letter to target player's missed letters
      const currentMissed = (targetPlayer.missedLetters as string[]) || [];
      if (!currentMissed.includes(letter)) {
        await prisma.gamePlayer.update({
          where: { id: targetPlayer.id },
          data: {
            missedLetters: [...currentMissed, letter],
          },
        });
      }

      const currentIndex = game.players.findIndex(p => p.userId === playerId);
      const nextIndex = (currentIndex + 1) % game.players.length;
      const nextPlayer = game.players[nextIndex];

      await prisma.game.update({
        where: { id: game.id },
        data: {
          currentTurnPlayerId: nextPlayer.userId,
          currentTurnStartedAt: new Date(),
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

      // Archive the completed game
      try {
        await this.archiveGame(game.id);
      } catch (archiveError) {
        console.error('Failed to archive game:', archiveError);
      }
    }

    // Fetch updated game state to return to clients
    const updatedGame = await this.getGameByRoomCode(roomCode);

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
      game: updatedGame, // Include full game state for frontend
    };
  }

  async handleTurnTimeout(roomCode: string): Promise<any> {
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

    if (!game || game.status !== 'ACTIVE') {
      throw new Error('Game not active');
    }

    // Find the player whose turn timed out
    const timedOutPlayer = game.players.find(p => p.userId === game.currentTurnPlayerId);
    if (!timedOutPlayer) {
      throw new Error('Current player not found');
    }

    // Advance to the next player
    const currentIndex = game.players.findIndex(p => p.userId === game.currentTurnPlayerId);
    const nextIndex = (currentIndex + 1) % game.players.length;
    const nextPlayer = game.players[nextIndex];

    await prisma.game.update({
      where: { id: game.id },
      data: {
        currentTurnPlayerId: nextPlayer.userId,
        currentTurnStartedAt: new Date(),
      },
    });

    const updatedGame = await this.getGameByRoomCode(roomCode);

    return {
      timedOutPlayerId: timedOutPlayer.userId,
      timedOutPlayerName: timedOutPlayer.user?.displayName || 'Unknown',
      nextPlayerId: nextPlayer.userId,
      nextPlayerName: nextPlayer.user?.displayName || 'Unknown',
      game: updatedGame,
    };
  }

  async updateTimerSettings(roomCode: string, userId: string, turnTimerSeconds: number): Promise<any> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.hostId !== userId) {
      throw new Error('Only host can change timer settings');
    }

    if (game.status !== 'WAITING') {
      throw new Error('Cannot change timer after game started');
    }

    // Validate timer: minimum 10 seconds, maximum 30 minutes
    const validTimer = Math.max(10, Math.min(1800, turnTimerSeconds));

    const updatedGame = await prisma.game.update({
      where: { id: game.id },
      data: { turnTimerSeconds: validTimer },
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

  async archiveGame(gameId: string): Promise<void> {
    // Fetch full game data with all relationships
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: {
            user: true,
          },
        },
        turns: {
          orderBy: { turnNumber: 'asc' },
        },
        results: {
          include: {
            player: true,
          },
          orderBy: { placement: 'asc' },
        },
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Build archive data
    const archiveData = {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      completedAt: game.completedAt,
      players: game.players.map(p => ({
        userId: p.userId,
        displayName: p.user?.displayName || 'Unknown',
        secretWord: p.secretWord,
        paddedWord: p.paddedWord,
        frontPadding: p.frontPadding,
        backPadding: p.backPadding,
        totalScore: p.totalScore,
        isEliminated: p.isEliminated,
        turnOrder: p.turnOrder,
      })),
      turns: game.turns.map(t => ({
        turnNumber: t.turnNumber,
        playerId: t.playerId,
        targetPlayerId: t.targetPlayerId,
        guessedLetter: t.guessedLetter,
        isCorrect: t.isCorrect,
        positionsRevealed: t.positionsRevealed,
        pointsScored: t.pointsScored,
        createdAt: t.createdAt,
      })),
      results: game.results.map(r => ({
        playerId: r.playerId,
        displayName: r.player?.displayName || 'Unknown',
        finalScore: r.finalScore,
        placement: r.placement,
      })),
    };

    // Ensure directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Write to file
    const filename = `${game.roomCode}_${game.completedAt?.toISOString().split('T')[0] || 'incomplete'}.json`;
    const filepath = path.join(DATA_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(archiveData, null, 2));

    console.log(`📁 Game archived to ${filepath}`);
  }

  async getGameHistoryList(): Promise<any[]> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const games = await Promise.all(
      jsonFiles.map(async (filename) => {
        const filepath = path.join(DATA_DIR, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        const data = JSON.parse(content);
        return {
          roomCode: data.roomCode,
          completedAt: data.completedAt,
          playerCount: data.players?.length || 0,
          winner: data.results?.[0]?.displayName || 'Unknown',
          winnerScore: data.results?.[0]?.finalScore || 0,
          filename,
        };
      })
    );

    // Sort by date descending
    return games.sort((a, b) =>
      new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    );
  }

  async getGameHistoryByRoomCode(roomCode: string): Promise<any> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const files = await fs.readdir(DATA_DIR);
    const matchingFile = files.find(f => f.startsWith(roomCode) && f.endsWith('.json'));

    if (!matchingFile) {
      throw new Error('Game history not found');
    }

    const filepath = path.join(DATA_DIR, matchingFile);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }

  private sanitizeGame(game: any): any {
    return {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      hostId: game.hostId,
      currentTurnPlayerId: game.currentTurnPlayerId,
      roundNumber: game.roundNumber,
      turnTimerSeconds: game.turnTimerSeconds,
      currentTurnStartedAt: game.currentTurnStartedAt,
      players: game.players.map((p: any) => {
        // Use paddedWord if available, otherwise secretWord
        const word = p.paddedWord || p.secretWord;
        const wordLength = word?.length || 0;

        return {
          id: p.id,
          userId: p.userId,
          displayName: p.user?.displayName || 'Unknown',
          turnOrder: p.turnOrder,
          wordLength: wordLength,
          hasSelectedWord: p.secretWord !== null,
          frontPadding: p.frontPadding || 0,
          backPadding: p.backPadding || 0,
          revealedPositions: word
            ? JSON.parse(p.revealedPositions as any).map((revealed: boolean, i: number) => {
                if (!revealed) return null;
                // Show "BLANK" for blank characters, actual letter otherwise
                return word[i] === this.BLANK_CHAR ? 'BLANK' : word[i];
              })
            : [],
          missedLetters: p.missedLetters || [],
          totalScore: p.totalScore,
          isEliminated: p.isEliminated,
        };
      }),
    };
  }
}
