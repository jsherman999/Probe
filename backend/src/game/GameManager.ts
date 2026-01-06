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

// Viewer guess stored in memory during game
interface ViewerGuess {
  viewerId: string;
  viewerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  guessedWord: string;
  isCorrect: boolean;
  submittedAt: Date;
}

// Turn card types and their probabilities
interface TurnCard {
  type: string;
  label: string;
  probability: number;
  multiplier?: number;
}

const TURN_CARDS: TurnCard[] = [
  { type: 'normal', label: 'Take your normal turn', probability: 60 },
  { type: 'additional', label: 'Take an additional turn', probability: 5 },
  { type: 'expose_left', label: 'Player on your left exposes a letter', probability: 5 },
  { type: 'expose_right', label: 'Player on your right exposes a letter', probability: 5 },
  { type: 'bonus_20', label: 'Add 20 to your score', probability: 5 },
  { type: 'double', label: 'Double the value of your first guess', probability: 5, multiplier: 2 },
  { type: 'triple', label: 'Triple the value of your first guess', probability: 5, multiplier: 3 },
  { type: 'quadruple', label: 'Quadruple the value of your first guess', probability: 5, multiplier: 4 },
  { type: 'quintuple', label: 'Quintuple the value of your first guess', probability: 5, multiplier: 5 },
];

export interface TurnCardInfo {
  type: string;
  label: string;
  multiplier?: number;
  affectedPlayerId?: string;
  affectedPlayerName?: string;
}

export class GameManager {
  private wordValidator: WordValidator;
  private scoringEngine: ScoringEngine;
  // Map of roomCode -> array of viewer guesses
  private viewerGuesses: Map<string, ViewerGuess[]> = new Map();

  constructor() {
    this.wordValidator = new WordValidator();
    this.scoringEngine = new ScoringEngine();
    this.wordValidator.loadDictionary();
  }

  // Draw a random turn card based on weighted probabilities
  private drawTurnCard(): TurnCard {
    const totalWeight = TURN_CARDS.reduce((sum, card) => sum + card.probability, 0);
    let random = Math.random() * totalWeight;

    for (const card of TURN_CARDS) {
      random -= card.probability;
      if (random <= 0) {
        return card;
      }
    }

    // Fallback to normal (shouldn't happen)
    return TURN_CARDS[0];
  }

  // Helper to get effective player ID (userId for humans, botId for bots)
  private getPlayerId(player: { userId: string | null; botId: string | null }): string {
    return (player.userId ?? player.botId)!;
  }

  // Helper to get display name (from user for humans, botDisplayName for bots)
  private getPlayerDisplayName(player: { user?: { displayName: string } | null; botDisplayName?: string | null }): string {
    return player.user?.displayName ?? player.botDisplayName ?? 'Unknown';
  }

  // Get adjacent player in turn order
  // direction: 'left' = next player, 'right' = previous player
  private getAdjacentPlayer(
    players: any[],
    currentPlayerId: string,
    direction: 'left' | 'right'
  ): { playerId: string; displayName: string } | null {
    // Filter to only active players and sort by turn order
    const activePlayers = players
      .filter(p => !p.isEliminated)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    if (activePlayers.length < 2) return null;

    const currentIndex = activePlayers.findIndex(p => this.getPlayerId(p) === currentPlayerId);
    if (currentIndex === -1) return null;

    let targetIndex: number;
    if (direction === 'left') {
      // Next player in turn order (wraps around)
      targetIndex = (currentIndex + 1) % activePlayers.length;
    } else {
      // Previous player in turn order (wraps around)
      targetIndex = (currentIndex - 1 + activePlayers.length) % activePlayers.length;
    }

    const targetPlayer = activePlayers[targetIndex];
    return {
      playerId: this.getPlayerId(targetPlayer),
      displayName: this.getPlayerDisplayName(targetPlayer),
    };
  }

  private generateRoomCode(username: string): string {
    // Format: username_yymmddhhmm
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    // Sanitize username: lowercase, remove special chars, limit length
    const sanitizedUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);

    return `${sanitizedUsername}_${yy}${mm}${dd}${hh}${min}`;
  }

  async createGame(userId: string, username: string, turnTimerSeconds?: number): Promise<any> {
    const roomCode = this.generateRoomCode(username);

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

  async getGameByRoomCode(roomCode: string, forUserId?: string): Promise<any> {
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

    return this.sanitizeGame(game, forUserId);
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
      return this.getGameByRoomCode(roomCode, userId);
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

  async leaveGame(roomCode: string, userId: string): Promise<{ gameEnded: boolean; game: any | null }> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: {
          include: { user: true }
        },
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    const player = game.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Not in this game');
    }

    // If game is in WAITING status, simply remove the player
    if (game.status === 'WAITING') {
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
          const updatedGame = await this.getGameByRoomCode(roomCode);
          return { gameEnded: false, game: updatedGame };
        } else {
          await prisma.game.delete({
            where: { id: game.id },
          });
          return { gameEnded: true, game: null };
        }
      }
      const updatedGame = await this.getGameByRoomCode(roomCode);
      return { gameEnded: false, game: updatedGame };
    }

    // For active/word selection games, eliminate the player instead of removing
    if (game.status === 'ACTIVE' || game.status === 'WORD_SELECTION') {
      // Mark player as eliminated
      await prisma.gamePlayer.update({
        where: { id: player.id },
        data: { isEliminated: true },
      });

      // Check if game should end (only one active player left)
      const activePlayers = game.players.filter(p => p.userId !== userId && !p.isEliminated);

      if (activePlayers.length <= 1) {
        // Game over - the remaining player wins
        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // Record results (only for human players)
        const allPlayers = await prisma.gamePlayer.findMany({
          where: { gameId: game.id },
        });
        const sortedPlayers = [...allPlayers].sort((a, b) => b.totalScore - a.totalScore);
        const humanPlayers = sortedPlayers.filter(p => p.userId !== null);
        await Promise.all(
          humanPlayers.map(async (p, index) =>
            prisma.gameResult.create({
              data: {
                gameId: game.id,
                playerId: p.userId!,
                finalScore: p.totalScore,
                placement: index + 1,
              },
            })
          )
        );

        try {
          await this.archiveGame(game.id);
        } catch (err) {
          console.error('Failed to archive game:', err);
        }

        const updatedGame = await this.getGameByRoomCode(roomCode);
        return { gameEnded: true, game: updatedGame };
      }

      // If leaving player was current turn, advance to next player
      if (game.currentTurnPlayerId === userId) {
        const currentIndex = game.players.findIndex(p => p.userId === userId);
        let nextIndex = (currentIndex + 1) % game.players.length;
        let nextPlayer = game.players[nextIndex];

        // Find next non-eliminated player
        while (nextPlayer.isEliminated || nextPlayer.userId === userId) {
          nextIndex = (nextIndex + 1) % game.players.length;
          nextPlayer = game.players[nextIndex];
        }

        await prisma.game.update({
          where: { id: game.id },
          data: {
            currentTurnPlayerId: nextPlayer.userId || nextPlayer.botId,
            currentTurnStartedAt: new Date(),
          },
        });
      }

      const updatedGame = await this.getGameByRoomCode(roomCode);
      return { gameEnded: false, game: updatedGame };
    }

    // For completed games, just return
    return { gameEnded: false, game: null };
  }

  // Force end a game (host/admin only)
  async endGame(roomCode: string, userId: string, force: boolean = false): Promise<any> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: {
          include: { user: true }
        },
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Only host can end game (unless force is true for admin)
    if (!force && game.hostId !== userId) {
      throw new Error('Only the host can end the game');
    }

    if (game.status === 'COMPLETED') {
      throw new Error('Game already completed');
    }

    // Mark game as completed
    await prisma.game.update({
      where: { id: game.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Record results based on current scores (only for human players)
    const sortedPlayers = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
    const humanPlayers = sortedPlayers.filter(p => p.userId !== null);
    await Promise.all(
      humanPlayers.map(async (p, index) =>
        prisma.gameResult.create({
          data: {
            gameId: game.id,
            playerId: p.userId!,
            finalScore: p.totalScore,
            placement: index + 1,
          },
        })
      )
    );

    try {
      await this.archiveGame(game.id);
    } catch (err) {
      console.error('Failed to archive game:', err);
    }

    const updatedGame = await this.getGameByRoomCode(roomCode);
    return updatedGame;
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

    // Find player by userId or botId (userId parameter may be a botId)
    const player = game.players.find(p => p.userId === userId || p.botId === userId);
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
      // Draw initial turn card for the first player
      const initialCard = this.drawTurnCard();
      let pendingExposePlayerId: string | null = null;

      // Handle expose cards for initial player - first player could be human or bot
      const sortedPlayers = [...updatedPlayers].sort((a, b) => a.turnOrder - b.turnOrder);
      const firstPlayer = sortedPlayers[0];
      const firstPlayerId = firstPlayer.userId || firstPlayer.botId;

      if (initialCard.type === 'expose_left' || initialCard.type === 'expose_right') {
        const direction = initialCard.type === 'expose_left' ? 'left' : 'right';
        const firstIndex = 0;
        const targetIndex = direction === 'left'
          ? (firstIndex + 1) % sortedPlayers.length
          : (firstIndex - 1 + sortedPlayers.length) % sortedPlayers.length;
        pendingExposePlayerId = sortedPlayers[targetIndex].userId || sortedPlayers[targetIndex].botId;
      }

      // Handle bonus_20 for initial player
      if (initialCard.type === 'bonus_20') {
        await prisma.gamePlayer.update({
          where: { id: firstPlayer.id },
          data: {
            totalScore: firstPlayer.totalScore + 20,
          },
        });
      }

      // Start the game with initial turn card
      const updatedGame = await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
          currentTurnPlayerId: firstPlayerId,
          currentTurnStartedAt: new Date(),
          currentTurnCard: initialCard.type,
          turnCardMultiplier: initialCard.multiplier || 1,
          turnCardUsed: false,
          pendingExposePlayerId,
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

    // playerId could be userId or botId
    const currentPlayer = game.players.find(p => p.userId === playerId || p.botId === playerId);
    if (!currentPlayer) {
      throw new Error('Player not in game');
    }

    const currentPlayerId = currentPlayer.userId || currentPlayer.botId;
    if (game.currentTurnPlayerId !== currentPlayerId) {
      throw new Error('Not your turn');
    }

    // targetPlayerId could be userId or botId
    const targetPlayer = game.players.find(p => p.userId === targetPlayerId || p.botId === targetPlayerId);
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
    let blankMissPenalty = false;

    // If BLANK guess with multiple unrevealed blanks, auto-select based on position:
    // - Back blanks (after the word): expose from rightmost to leftmost
    // - Front blanks (before the word): expose from leftmost to rightmost (only after all back blanks done)
    if (isBlankGuess && positions.length > 1) {
      const frontPadding = targetPlayer.frontPadding || 0;
      const backPadding = targetPlayer.backPadding || 0;
      const wordLength = word.length;

      // Separate unrevealed blanks into front and back
      const frontBlankPositions = positions.filter(p => p < frontPadding);
      const backBlankPositions = positions.filter(p => p >= wordLength - backPadding);

      let selectedPosition: number;
      if (backBlankPositions.length > 0) {
        // Pick rightmost back blank (highest index)
        selectedPosition = Math.max(...backBlankPositions);
        console.log(`🎲 Multiple blanks - back blanks available at ${backBlankPositions.join(',')} - selecting rightmost: ${selectedPosition}`);
      } else if (frontBlankPositions.length > 0) {
        // Pick leftmost front blank (lowest index)
        selectedPosition = Math.min(...frontBlankPositions);
        console.log(`🎲 Multiple blanks - only front blanks at ${frontBlankPositions.join(',')} - selecting leftmost: ${selectedPosition}`);
      } else {
        // Fallback to rightmost (shouldn't happen)
        selectedPosition = Math.max(...positions);
        console.log(`🎲 Multiple blanks at positions ${positions.join(',')} - fallback to rightmost: ${selectedPosition}`);
      }

      // Filter positions to only the selected one
      positions.splice(0, positions.length, selectedPosition);
    }

    // If regular letter guess with multiple unrevealed positions (duplicate letters),
    // auto-select one randomly
    if (!isBlankGuess && positions.length > 1) {
      const randomIndex = Math.floor(Math.random() * positions.length);
      const selectedPosition = positions[randomIndex];
      console.log(`🎲 Duplicate letter "${letter}" found at positions ${positions.join(',')} - auto-selected random: ${selectedPosition}`);
      // Filter positions to only the selected one
      positions.splice(0, positions.length, selectedPosition);
    }

    // Penalty for guessing BLANK when no blanks are available
    if (isBlankGuess && positions.length === 0) {
      blankMissPenalty = true;
      pointsScored = -50;

      // Deduct points from the guessing player
      if (currentPlayer) {
        await prisma.gamePlayer.update({
          where: { id: currentPlayer.id },
          data: {
            totalScore: currentPlayer.totalScore - 50, // Allow negative scores
          },
        });
      }
    }

    if (isCorrect) {
      console.log(`✨ Single position hit: revealing position(s) ${positions.join(',')}`);
      // Update revealed positions (single position for blanks, or all positions for letters)
      positions.forEach(pos => {
        revealedPositions[pos] = true;
      });

      // Calculate score based on position (5, 10, 15 pattern)
      const isBlankPosition = (pos: number) => word[pos] === this.BLANK_CHAR;
      let basePoints = this.scoringEngine.calculateScore(positions, isBlankPosition);

      // Apply turn card multiplier for the first successful hit
      let multiplierApplied = false;
      console.log(`🎴 Multiplier check: basePoints=${basePoints}, turnCardMultiplier=${game.turnCardMultiplier}, turnCardUsed=${game.turnCardUsed}, turnCard=${game.currentTurnCard}`);
      if (basePoints > 0 && game.turnCardMultiplier > 1 && !game.turnCardUsed) {
        pointsScored = basePoints * game.turnCardMultiplier;
        multiplierApplied = true;
        console.log(`🎴 Multiplier x${game.turnCardMultiplier} applied: ${basePoints} -> ${pointsScored}`);
      } else {
        pointsScored = basePoints;
        if (basePoints > 0 && game.turnCardMultiplier > 1 && game.turnCardUsed) {
          console.log(`🎴 Multiplier NOT applied - already used this turn`);
        }
      }

      // Check if this guess completed the word (revealed final letter)
      const wordCompleted = revealedPositions.every(p => p);

      // Award word completion bonus if applicable
      if (wordCompleted) {
        const completionBonus = this.scoringEngine.WORD_COMPLETION_BONUS;
        pointsScored += completionBonus;
        console.log(`🏆 WORD COMPLETED! Adding ${completionBonus} point bonus (total: ${pointsScored})`);
      }

      // Update target player's revealed positions and elimination status
      await prisma.gamePlayer.update({
        where: { id: targetPlayer.id },
        data: {
          revealedPositions: JSON.stringify(revealedPositions),
          isEliminated: wordCompleted,
        },
      });

      // Award points to the GUESSING player (not the target)
      if (pointsScored > 0) {
        if (currentPlayer) {
          console.log(`💰 Awarding ${pointsScored} points to GUESSING player ${playerId} (was ${currentPlayer.totalScore}, now ${currentPlayer.totalScore + pointsScored})`);
          await prisma.gamePlayer.update({
            where: { id: currentPlayer.id },
            data: {
              totalScore: currentPlayer.totalScore + pointsScored,
            },
          });
        }
      }

      // Mark turn card as used after first successful hit (for multiplier cards)
      // Also reset currentTurnStartedAt so frontend timer resets for continued turn
      await prisma.game.update({
        where: { id: game.id },
        data: {
          ...(multiplierApplied ? { turnCardUsed: true } : {}),
          currentTurnStartedAt: new Date(), // Reset timer for continued turn
        },
      });
    }

    // Record turn
    await prisma.gameTurn.create({
      data: {
        gameId: game.id,
        playerId: currentPlayer.id,
        targetPlayerId: targetPlayer.id,
        guessedLetter: letter,
        isCorrect,
        positionsRevealed: positions,
        pointsScored,
        turnNumber: game.roundNumber,
      },
    });

    // Track whether turn is changing to a new player
    let turnCardInfo: TurnCardInfo | null = null;
    let nextTurnPlayerId = playerId; // Default: player keeps turn on hit

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

      // Check if current player has "additional" turn card that hasn't been used
      if (game.currentTurnCard === 'additional' && !game.turnCardUsed) {
        // Player gets to keep their turn despite miss, but card is consumed
        nextTurnPlayerId = playerId;
        await prisma.game.update({
          where: { id: game.id },
          data: {
            turnCardUsed: true,
            currentTurnStartedAt: new Date(),
          },
        });
      } else {
        // Normal turn transition - find next player
        // Include ALL players in turn rotation (eliminated players can still guess others' letters)
        const allPlayers = [...game.players].sort((a, b) => a.turnOrder - b.turnOrder);

        const currentIndex = allPlayers.findIndex(p => this.getPlayerId(p) === playerId);
        const nextIndex = (currentIndex + 1) % allPlayers.length;
        const nextPlayer = allPlayers[nextIndex];
        nextTurnPlayerId = this.getPlayerId(nextPlayer);

        // Draw a turn card for the next player
        const drawnCard = this.drawTurnCard();
        let pendingExposePlayerId: string | null = null;
        let bonusPointsAwarded = 0;

        // Handle expose cards
        if (drawnCard.type === 'expose_left' || drawnCard.type === 'expose_right') {
          const direction = drawnCard.type === 'expose_left' ? 'left' : 'right';
          const affectedPlayer = this.getAdjacentPlayer(game.players, this.getPlayerId(nextPlayer), direction);
          if (affectedPlayer) {
            pendingExposePlayerId = affectedPlayer.playerId;
            turnCardInfo = {
              type: drawnCard.type,
              label: drawnCard.label,
              affectedPlayerId: affectedPlayer.playerId,
              affectedPlayerName: affectedPlayer.displayName,
            };
          } else {
            // No valid adjacent player, treat as normal turn
            turnCardInfo = {
              type: 'normal',
              label: 'Take your normal turn',
            };
          }
        } else if (drawnCard.type === 'bonus_20') {
          // Immediately award 20 bonus points
          bonusPointsAwarded = 20;
          const playerToBonus = game.players.find(p => p.userId === nextPlayer.userId);
          if (playerToBonus) {
            await prisma.gamePlayer.update({
              where: { id: playerToBonus.id },
              data: {
                totalScore: playerToBonus.totalScore + 20,
              },
            });
          }
          turnCardInfo = {
            type: drawnCard.type,
            label: drawnCard.label,
          };
        } else {
          turnCardInfo = {
            type: drawnCard.type,
            label: drawnCard.label,
            multiplier: drawnCard.multiplier,
          };
        }

        // Log when multiplier card is drawn
        if (drawnCard.multiplier && drawnCard.multiplier > 1) {
          console.log(`🎴 MULTIPLIER CARD DRAWN: ${drawnCard.type} (x${drawnCard.multiplier}) for player ${nextPlayer.userId || nextPlayer.botId}`);
        }

        await prisma.game.update({
          where: { id: game.id },
          data: {
            currentTurnPlayerId: nextPlayer.userId || nextPlayer.botId,
            currentTurnStartedAt: new Date(),
            currentTurnCard: drawnCard.type,
            turnCardMultiplier: drawnCard.multiplier || 1,
            turnCardUsed: false,
            pendingExposePlayerId,
          },
        });
      }
    }

    // Check if game is over
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });

    const playersWithUnrevealedWords = updatedPlayers.filter(p => !p.isEliminated);
    // Game ends when ALL words are revealed (no targetable players remain)
    const gameOver = playersWithUnrevealedWords.length === 0;

    let finalResults = null;
    if (gameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Record results (only for human players - bots don't have User records)
      const sorted = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      const humanPlayers = sorted.filter(p => p.userId !== null);
      finalResults = await Promise.all(
        humanPlayers.map((p, index) =>
          prisma.gameResult.create({
            data: {
              gameId: game.id,
              playerId: p.userId!,
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
      blankMissPenalty,
      letter,
      targetPlayerId,
      revealedWord: revealedPositions.map((revealed, i) => (revealed ? word[i] : null)),
      wordCompleted: revealedPositions.every(p => p),
      gameOver,
      finalResults,
      currentTurnPlayerId: nextTurnPlayerId,
      turnCardInfo, // Info about the turn card drawn for the next player (or null if hit)
      game: updatedGame, // Include full game state for frontend
    };
  }

  // Resolve blank selection when target player chooses which blank to reveal
  async resolveBlankSelection(
    roomCode: string,
    guessingPlayerId: string,
    targetPlayerId: string,
    selectedPosition: number
  ): Promise<any> {
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

    const targetPlayer = game.players.find(p => p.userId === targetPlayerId);
    if (!targetPlayer) {
      throw new Error('Invalid target player');
    }

    const word = targetPlayer.paddedWord || targetPlayer.secretWord!;
    const revealedPositions = JSON.parse(targetPlayer.revealedPositions as any) as boolean[];

    // Validate the selected position is a valid unrevealed blank
    if (selectedPosition < 0 || selectedPosition >= word.length) {
      throw new Error('Invalid position');
    }
    if (word[selectedPosition] !== this.BLANK_CHAR) {
      throw new Error('Selected position is not a blank');
    }
    if (revealedPositions[selectedPosition]) {
      throw new Error('Position already revealed');
    }

    // Reveal only the selected position
    revealedPositions[selectedPosition] = true;

    // Score blanks like regular letters using position-based scoring
    const pointsScored = this.scoringEngine.getPositionPoints(selectedPosition);

    // Update target player
    await prisma.gamePlayer.update({
      where: { id: targetPlayer.id },
      data: {
        revealedPositions: JSON.stringify(revealedPositions),
        isEliminated: revealedPositions.every(p => p),
      },
    });

    // Award points to the GUESSING player
    if (pointsScored > 0) {
      const guessingPlayer = game.players.find(p => this.getPlayerId(p) === guessingPlayerId);
      if (guessingPlayer) {
        await prisma.gamePlayer.update({
          where: { id: guessingPlayer.id },
          data: {
            totalScore: guessingPlayer.totalScore + pointsScored,
          },
        });
      }
    }

    // Record turn
    const guessingPlayer = game.players.find(p => this.getPlayerId(p) === guessingPlayerId);
    if (guessingPlayer) {
      await prisma.gameTurn.create({
        data: {
          gameId: game.id,
          playerId: guessingPlayer.id,
          targetPlayerId: targetPlayer.id,
          guessedLetter: 'BLANK',
          isCorrect: true,
          positionsRevealed: [selectedPosition],
          pointsScored,
          turnNumber: game.roundNumber,
        },
      });
    }

    // Check for game over - fetch fresh player data after update
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });
    const playersWithUnrevealedWords = updatedPlayers.filter(p => !p.isEliminated);
    // Game ends when ALL words are revealed (no targetable players remain)
    const gameOver = playersWithUnrevealedWords.length === 0;

    let finalResults = null;
    if (gameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const sortedPlayers = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      const humanPlayers = sortedPlayers.filter(p => p.userId !== null);
      finalResults = await Promise.all(
        humanPlayers.map(async (p, index) =>
          prisma.gameResult.create({
            data: {
              gameId: game.id,
              playerId: p.userId!,
              finalScore: p.totalScore,
              placement: index + 1,
            },
            include: {
              player: true,
            },
          })
        )
      );

      try {
        await this.archiveGame(game.id);
      } catch (archiveError) {
        console.error('Failed to archive game:', archiveError);
      }
    }

    const updatedGame = await this.getGameByRoomCode(roomCode);

    return {
      isCorrect: true,
      positions: [selectedPosition],
      pointsScored,
      letter: 'BLANK',
      targetPlayerId,
      revealedWord: revealedPositions.map((revealed, i) => (revealed ? word[i] : null)),
      wordCompleted: revealedPositions.every(p => p),
      gameOver,
      finalResults,
      currentTurnPlayerId: guessingPlayerId, // Correct guess, same player continues
      game: updatedGame,
    };
  }

  // Resolve duplicate letter selection when target player chooses which duplicate to reveal
  async resolveDuplicateSelection(
    roomCode: string,
    guessingPlayerId: string,
    targetPlayerId: string,
    selectedPosition: number,
    letter: string
  ): Promise<any> {
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

    const targetPlayer = game.players.find(p => p.userId === targetPlayerId);
    if (!targetPlayer) {
      throw new Error('Invalid target player');
    }

    const word = targetPlayer.paddedWord || targetPlayer.secretWord!;
    const revealedPositions = JSON.parse(targetPlayer.revealedPositions as any) as boolean[];

    // Validate the selected position is a valid unrevealed position with the letter
    if (selectedPosition < 0 || selectedPosition >= word.length) {
      throw new Error('Invalid position');
    }
    if (word[selectedPosition].toUpperCase() !== letter.toUpperCase()) {
      throw new Error('Selected position does not contain the letter');
    }
    if (revealedPositions[selectedPosition]) {
      throw new Error('Position already revealed');
    }

    // Reveal only the selected position
    revealedPositions[selectedPosition] = true;

    // Calculate score based on position (5, 10, 15 pattern)
    const isBlankPosition = (pos: number) => word[pos] === this.BLANK_CHAR;
    const pointsScored = this.scoringEngine.calculateScore([selectedPosition], isBlankPosition);

    // Update target player's revealed positions
    await prisma.gamePlayer.update({
      where: { id: targetPlayer.id },
      data: {
        revealedPositions: JSON.stringify(revealedPositions),
        isEliminated: revealedPositions.every(p => p),
      },
    });

    // Award points to the GUESSING player
    if (pointsScored > 0) {
      const guessingPlayer = game.players.find(p => this.getPlayerId(p) === guessingPlayerId);
      if (guessingPlayer) {
        await prisma.gamePlayer.update({
          where: { id: guessingPlayer.id },
          data: {
            totalScore: guessingPlayer.totalScore + pointsScored,
          },
        });
      }
    }

    // Record turn
    const guessingPlayer = game.players.find(p => this.getPlayerId(p) === guessingPlayerId);
    if (guessingPlayer) {
      await prisma.gameTurn.create({
        data: {
          gameId: game.id,
          playerId: guessingPlayer.id,
          targetPlayerId: targetPlayer.id,
          guessedLetter: letter,
          isCorrect: true,
          positionsRevealed: [selectedPosition],
          pointsScored,
          turnNumber: game.roundNumber,
        },
      });
    }

    // Check for game over
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });
    const playersWithUnrevealedWords = updatedPlayers.filter(p => !p.isEliminated);
    // Game ends when ALL words are revealed (no targetable players remain)
    const gameOver = playersWithUnrevealedWords.length === 0;

    let finalResults = null;
    if (gameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const sortedPlayers = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      const humanPlayers = sortedPlayers.filter(p => p.userId !== null);
      finalResults = await Promise.all(
        humanPlayers.map(async (p, index) =>
          prisma.gameResult.create({
            data: {
              gameId: game.id,
              playerId: p.userId!,
              finalScore: p.totalScore,
              placement: index + 1,
            },
            include: {
              player: true,
            },
          })
        )
      );

      try {
        await this.archiveGame(game.id);
      } catch (archiveError) {
        console.error('Failed to archive game:', archiveError);
      }
    }

    const updatedGame = await this.getGameByRoomCode(roomCode);

    return {
      isCorrect: true,
      positions: [selectedPosition],
      pointsScored,
      letter,
      targetPlayerId,
      revealedWord: revealedPositions.map((revealed, i) => (revealed ? word[i] : null)),
      wordCompleted: revealedPositions.every(p => p),
      gameOver,
      finalResults,
      currentTurnPlayerId: guessingPlayerId, // Correct guess, same player continues
      game: updatedGame,
    };
  }

  // Resolve expose card selection - affected player chooses which of their letters to expose
  async resolveExposeCard(
    roomCode: string,
    affectedPlayerId: string,
    selectedPosition: number
  ): Promise<any> {
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

    // Verify this is the player who should be exposing
    if (game.pendingExposePlayerId !== affectedPlayerId) {
      throw new Error('Not your expose selection');
    }

    const affectedPlayer = game.players.find(p => this.getPlayerId(p) === affectedPlayerId);
    if (!affectedPlayer) {
      throw new Error('Player not found');
    }

    // Find the active player who drew the card (they get the points)
    // Note: currentTurnPlayerId might be a bot
    const activePlayer = game.players.find(p => this.getPlayerId(p) === game.currentTurnPlayerId);

    const word = affectedPlayer.paddedWord || affectedPlayer.secretWord!;
    const revealedPositions = JSON.parse(affectedPlayer.revealedPositions as any) as boolean[];

    // Validate the selected position is valid and unrevealed
    if (selectedPosition < 0 || selectedPosition >= word.length) {
      throw new Error('Invalid position');
    }
    if (revealedPositions[selectedPosition]) {
      throw new Error('Position already revealed');
    }

    // Reveal the selected position
    revealedPositions[selectedPosition] = true;

    // Calculate points for the exposed position (active player gets these points)
    const pointsScored = this.scoringEngine.getPositionPoints(selectedPosition);

    // Update affected player's revealed positions
    await prisma.gamePlayer.update({
      where: { id: affectedPlayer.id },
      data: {
        revealedPositions: JSON.stringify(revealedPositions),
        isEliminated: revealedPositions.every(p => p),
      },
    });

    // Get the exposed letter for logging
    const exposedLetter = word[selectedPosition];
    const affectedPlayerName = this.getPlayerDisplayName(affectedPlayer);

    // Award points to the active player who drew the expose card
    if (activePlayer) {
      await prisma.gamePlayer.update({
        where: { id: activePlayer.id },
        data: {
          totalScore: { increment: pointsScored },
        },
      });
      const activePlayerName = this.getPlayerDisplayName(activePlayer);
      console.log(`🎴 EXPOSE CARD RESOLVED: ${affectedPlayerName} exposed letter "${exposedLetter}" at position ${selectedPosition}`);
      console.log(`🎴 ${activePlayerName} earned ${pointsScored} points from the exposed letter`);
    } else {
      console.log(`🎴 EXPOSE CARD RESOLVED: ${affectedPlayerName} exposed letter "${exposedLetter}" at position ${selectedPosition}`);
    }

    // Clear the pending expose selection
    await prisma.game.update({
      where: { id: game.id },
      data: {
        pendingExposePlayerId: null,
      },
    });

    // Check for game over
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });
    const playersWithUnrevealedWords = updatedPlayers.filter(p => !p.isEliminated);
    // Game ends when ALL words are revealed (no targetable players remain)
    const gameOver = playersWithUnrevealedWords.length === 0;

    let finalResults = null;
    if (gameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const sortedPlayers = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      const humanPlayers = sortedPlayers.filter(p => p.userId !== null);
      finalResults = await Promise.all(
        humanPlayers.map(async (p, index) =>
          prisma.gameResult.create({
            data: {
              gameId: game.id,
              playerId: p.userId!,
              finalScore: p.totalScore,
              placement: index + 1,
            },
            include: {
              player: true,
            },
          })
        )
      );

      try {
        await this.archiveGame(game.id);
      } catch (archiveError) {
        console.error('Failed to archive game:', archiveError);
      }
    }

    const updatedGame = await this.getGameByRoomCode(roomCode);

    return {
      affectedPlayerId,
      selectedPosition,
      revealedLetter: word[selectedPosition],
      revealedWord: revealedPositions.map((revealed, i) => (revealed ? word[i] : null)),
      wordCompleted: revealedPositions.every(p => p),
      gameOver,
      finalResults,
      game: updatedGame,
      // Points info for the active player who drew the expose card
      pointsScored,
      activePlayerId: game.currentTurnPlayerId,
      activePlayerName: activePlayer?.user?.displayName || 'Unknown',
    };
  }

  // Process a full word guess attempt ("Guess Now!" feature)
  async processWordGuess(
    roomCode: string,
    guessingPlayerId: string,
    targetPlayerId: string,
    guessedWord: string
  ): Promise<any> {
    guessedWord = guessedWord.toUpperCase().trim();

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

    const targetPlayer = game.players.find(p => this.getPlayerId(p) === targetPlayerId);
    if (!targetPlayer || targetPlayer.isEliminated) {
      throw new Error('Invalid target player');
    }

    const guessingPlayer = game.players.find(p => this.getPlayerId(p) === guessingPlayerId);
    if (!guessingPlayer) {
      throw new Error('Guessing player not found');
    }

    // Get the actual secret word (without blanks)
    const actualWord = targetPlayer.secretWord!.toUpperCase();
    const paddedWord = targetPlayer.paddedWord || actualWord;
    const revealedPositions = JSON.parse(targetPlayer.revealedPositions as any) as boolean[];

    // Count unrevealed positions (letters + blanks)
    const unrevealedCount = revealedPositions.filter(r => !r).length;

    // Check if the guess is correct
    const isCorrect = guessedWord === actualWord;

    let pointsChange = 0;
    if (isCorrect) {
      // Correct guess: +100 if 5+ unrevealed, +50 otherwise
      pointsChange = unrevealedCount >= 5 ? 100 : 50;

      // Reveal all positions and eliminate the target
      const allRevealed = new Array(paddedWord.length).fill(true);
      await prisma.gamePlayer.update({
        where: { id: targetPlayer.id },
        data: {
          revealedPositions: JSON.stringify(allRevealed),
          isEliminated: true,
        },
      });
    } else {
      // Incorrect guess: -50 points
      pointsChange = -50;
    }

    // Update guessing player's score
    await prisma.gamePlayer.update({
      where: { id: guessingPlayer.id },
      data: {
        totalScore: guessingPlayer.totalScore + pointsChange, // Allow negative scores
      },
    });

    // If wrong guess, advance to next player's turn
    if (!isCorrect) {
      const currentIndex = game.players.findIndex(p => this.getPlayerId(p) === guessingPlayerId);
      let nextIndex = (currentIndex + 1) % game.players.length;

      // Skip eliminated players
      const activePlayers = game.players.filter(p => !p.isEliminated);
      if (activePlayers.length > 1) {
        while (game.players[nextIndex].isEliminated) {
          nextIndex = (nextIndex + 1) % game.players.length;
        }
      }

      const nextPlayer = game.players[nextIndex];
      const nextPlayerId = this.getPlayerId(nextPlayer);

      await prisma.game.update({
        where: { id: game.id },
        data: {
          currentTurnPlayerId: nextPlayerId,
          currentTurnStartedAt: new Date(),
        },
      });
    }

    // Record the word guess as a turn
    await prisma.gameTurn.create({
      data: {
        gameId: game.id,
        playerId: guessingPlayer.id,
        targetPlayerId: targetPlayer.id,
        guessedLetter: `WORD:${guessedWord}`,
        isCorrect,
        positionsRevealed: isCorrect ? Array.from({ length: paddedWord.length }, (_, i) => i) : [],
        pointsScored: pointsChange,
        turnNumber: game.roundNumber,
      },
    });

    // Check if game is over
    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });

    const playersWithUnrevealedWords = updatedPlayers.filter(p => !p.isEliminated);
    // Game ends when ALL words are revealed (no targetable players remain)
    const gameOver = playersWithUnrevealedWords.length === 0;

    let finalResults = null;
    if (gameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const sortedPlayers = [...updatedPlayers].sort((a, b) => b.totalScore - a.totalScore);
      const humanPlayers = sortedPlayers.filter(p => p.userId !== null);
      finalResults = await Promise.all(
        humanPlayers.map(async (p, index) =>
          prisma.gameResult.create({
            data: {
              gameId: game.id,
              playerId: p.userId!,
              finalScore: p.totalScore,
              placement: index + 1,
            },
            include: {
              player: true,
            },
          })
        )
      );

      try {
        await this.archiveGame(game.id);
      } catch (archiveError) {
        console.error('Failed to archive game:', archiveError);
      }
    }

    const updatedGame = await this.getGameByRoomCode(roomCode);

    return {
      isCorrect,
      guessedWord,
      actualWord: isCorrect ? actualWord : null, // Only reveal if correct
      targetPlayerId,
      guessingPlayerId,
      pointsChange,
      unrevealedCount,
      gameOver,
      finalResults,
      game: updatedGame,
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
    const timedOutPlayer = game.players.find(p => this.getPlayerId(p) === game.currentTurnPlayerId);
    if (!timedOutPlayer) {
      throw new Error('Current player not found');
    }

    // Get active (non-eliminated) players sorted by turn order
    const activePlayers = game.players
      .filter(p => !p.isEliminated)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    // If only one active player remains, game should be over
    if (activePlayers.length <= 1) {
      throw new Error('Game should be over - only one active player');
    }

    // Find current player's position among active players
    const currentActiveIndex = activePlayers.findIndex(p => this.getPlayerId(p) === game.currentTurnPlayerId);

    // If current player is eliminated (shouldn't happen but handle it), start from first active player
    let nextActiveIndex: number;
    if (currentActiveIndex === -1) {
      nextActiveIndex = 0;
    } else {
      nextActiveIndex = (currentActiveIndex + 1) % activePlayers.length;
    }

    const nextPlayer = activePlayers[nextActiveIndex];
    const nextPlayerId = this.getPlayerId(nextPlayer);

    await prisma.game.update({
      where: { id: game.id },
      data: {
        currentTurnPlayerId: nextPlayerId,
        currentTurnStartedAt: new Date(),
      },
    });

    const updatedGame = await this.getGameByRoomCode(roomCode);

    return {
      timedOutPlayerId: this.getPlayerId(timedOutPlayer),
      timedOutPlayerName: this.getPlayerDisplayName(timedOutPlayer),
      nextPlayerId: nextPlayerId,
      nextPlayerName: this.getPlayerDisplayName(nextPlayer),
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

    // Helper to get player display name by internal ID
    const getPlayerName = (internalId: string): string => {
      const player = game.players.find(p => p.id === internalId);
      if (!player) return 'Unknown';
      return player.isBot ? (player.botDisplayName || 'Bot') : (player.user?.displayName || 'Unknown');
    };

    // Build archive data
    const archiveData = {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      completedAt: game.completedAt,
      players: game.players.map(p => ({
        id: p.id,  // Include internal ID for turn lookups
        userId: p.userId,
        displayName: p.isBot ? p.botDisplayName : (p.user?.displayName || 'Unknown'),
        secretWord: p.secretWord,
        paddedWord: p.paddedWord,
        frontPadding: p.frontPadding,
        backPadding: p.backPadding,
        totalScore: p.totalScore,
        isEliminated: p.isEliminated,
        turnOrder: p.turnOrder,
        isBot: p.isBot,
        botId: p.botId,
        // LLM configuration for bots
        botModelName: p.botModelName,
        botDifficulty: p.botDifficulty,
        botConfig: p.botConfig,
      })),
      turns: game.turns.map(t => ({
        turnNumber: t.turnNumber,
        playerId: t.playerId,
        playerName: getPlayerName(t.playerId),  // Add resolved name
        targetPlayerId: t.targetPlayerId,
        targetPlayerName: getPlayerName(t.targetPlayerId),  // Add resolved name
        guessedLetter: t.guessedLetter,
        isCorrect: t.isCorrect,
        positionsRevealed: t.positionsRevealed,
        pointsScored: t.pointsScored,
        createdAt: t.createdAt,
      })),
      // Generate results for ALL players (including bots), sorted by score
      results: game.players
        .map(p => ({
          playerId: p.userId || p.botId || p.id,
          displayName: p.isBot ? (p.botDisplayName || 'Bot') : (p.user?.displayName || 'Unknown'),
          finalScore: p.totalScore || 0,
          isBot: p.isBot,
        }))
        .sort((a, b) => b.finalScore - a.finalScore)
        .map((r, index) => ({
          ...r,
          placement: index + 1,
        })),
      viewerGuesses: this.viewerGuesses.get(game.roomCode) || [],
    };

    // Clear viewer guesses for this game
    this.viewerGuesses.delete(game.roomCode);

    // Ensure directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Write to file
    const filename = `${game.roomCode}_${game.completedAt?.toISOString().split('T')[0] || 'incomplete'}.json`;
    const filepath = path.join(DATA_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(archiveData, null, 2));

    console.log(`📁 Game archived to ${filepath}`);
  }

  // Re-archive a game by room code (for migrating old files)
  async reArchiveGame(roomCode: string): Promise<void> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
    });

    if (!game) {
      throw new Error('Game not found in database');
    }

    await this.archiveGame(game.id);
    console.log(`📁 Re-archived game ${roomCode}`);
  }

  // Re-archive all completed games that are still in the database
  async migrateAllGameHistory(): Promise<{ migrated: string[]; failed: string[] }> {
    const completedGames = await prisma.game.findMany({
      where: { status: 'COMPLETED' },
    });

    const migrated: string[] = [];
    const failed: string[] = [];

    for (const game of completedGames) {
      try {
        await this.archiveGame(game.id);
        migrated.push(game.roomCode);
        console.log(`✅ Migrated ${game.roomCode}`);
      } catch (err) {
        failed.push(game.roomCode);
        console.error(`❌ Failed to migrate ${game.roomCode}:`, err);
      }
    }

    return { migrated, failed };
  }

  // Handle viewer (observer) word guess
  async submitViewerGuess(
    roomCode: string,
    viewerId: string,
    viewerName: string,
    targetPlayerId: string,
    guessedWord: string
  ): Promise<{ isCorrect: boolean; targetPlayerName: string }> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        players: {
          include: { user: true },
        },
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'ACTIVE') {
      throw new Error('Game is not active');
    }

    // Find target player
    const targetPlayer = game.players.find(p => p.userId === targetPlayerId);
    if (!targetPlayer) {
      throw new Error('Target player not found');
    }

    // Check if viewer is an active player (they shouldn't be able to use viewer guess)
    const isActivePlayer = game.players.some(p => p.userId === viewerId);
    if (isActivePlayer) {
      throw new Error('Active players cannot use viewer guess');
    }

    // Check if the word is correct
    const isCorrect = targetPlayer.secretWord?.toUpperCase() === guessedWord.toUpperCase();

    // Store the guess
    const guess: ViewerGuess = {
      viewerId,
      viewerName,
      targetPlayerId,
      targetPlayerName: targetPlayer.user?.displayName || 'Unknown',
      guessedWord: guessedWord.toUpperCase(),
      isCorrect,
      submittedAt: new Date(),
    };

    const existingGuesses = this.viewerGuesses.get(roomCode) || [];
    existingGuesses.push(guess);
    this.viewerGuesses.set(roomCode, existingGuesses);

    console.log(`👁️ Viewer ${viewerName} guessed "${guessedWord}" for ${targetPlayer.user?.displayName}'s word - ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    return {
      isCorrect,
      targetPlayerName: targetPlayer.user?.displayName || 'Unknown',
    };
  }

  // Get viewer guesses for a game (for displaying at game end)
  getViewerGuesses(roomCode: string): ViewerGuess[] {
    return this.viewerGuesses.get(roomCode) || [];
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

  // Get aggregated bot stats from all archived games
  async getBotStats(): Promise<any[]> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const botStats: any[] = [];

    for (const filename of jsonFiles) {
      const filepath = path.join(DATA_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);

      // Find bot players in this game
      const botPlayers = data.players?.filter((p: any) => p.isBot) || [];

      for (const bot of botPlayers) {
        // Find bot's result (placement and final score)
        const result = data.results?.find((r: any) =>
          r.playerId === bot.botId || r.displayName === bot.displayName
        );

        // Count correct/incorrect guesses from turns
        const botTurns = data.turns?.filter((t: any) =>
          t.playerId === bot.botId
        ) || [];
        const correctGuesses = botTurns.filter((t: any) => t.isCorrect).length;
        const incorrectGuesses = botTurns.filter((t: any) => !t.isCorrect).length;

        // Calculate accuracy
        const totalGuesses = correctGuesses + incorrectGuesses;
        const accuracy = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0;

        botStats.push({
          // Game info
          roomCode: data.roomCode,
          completedAt: data.completedAt,
          playerCount: data.players?.length || 0,

          // Bot identity
          botName: bot.displayName || bot.botDisplayName || 'Unknown Bot',
          botId: bot.botId,

          // LLM config
          modelName: bot.botModelName || 'Unknown',
          difficulty: bot.botDifficulty || 'Unknown',
          config: bot.botConfig || {},

          // Performance
          score: result?.finalScore || bot.totalScore || 0,
          placement: result?.placement || 0,
          totalPlayers: data.results?.length || data.players?.length || 0,

          // Guessing stats
          correctGuesses,
          incorrectGuesses,
          totalGuesses,
          accuracy,

          // Word info
          secretWord: bot.secretWord,
          wordLength: bot.wordLength || bot.secretWord?.length || 0,
        });
      }
    }

    // Sort by date descending
    return botStats.sort((a, b) =>
      new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    );
  }

  // Cleanup stale games (WAITING status older than 30 minutes)
  async cleanupStaleGames(): Promise<{ removed: number; roomCodes: string[] }> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find stale WAITING games (30 minutes old)
    const staleWaitingGames = await prisma.game.findMany({
      where: {
        status: 'WAITING',
        createdAt: {
          lt: thirtyMinutesAgo,
        },
      },
    });

    // Find stale ACTIVE/WORD_SELECTION games (2 hours old or no activity)
    const staleActiveGames = await prisma.game.findMany({
      where: {
        status: { in: ['ACTIVE', 'WORD_SELECTION'] },
        OR: [
          { createdAt: { lt: twoHoursAgo } },
          { startedAt: { lt: twoHoursAgo } },
        ],
      },
    });

    const allStaleGames = [...staleWaitingGames, ...staleActiveGames];
    const roomCodes = allStaleGames.map(g => g.roomCode);

    if (allStaleGames.length > 0) {
      const gameIds = allStaleGames.map(g => g.id);

      // Delete turns first
      await prisma.gameTurn.deleteMany({
        where: { gameId: { in: gameIds } },
      });

      // Delete results
      await prisma.gameResult.deleteMany({
        where: { gameId: { in: gameIds } },
      });

      // Delete players due to foreign key constraints
      await prisma.gamePlayer.deleteMany({
        where: { gameId: { in: gameIds } },
      });

      // Delete the games
      await prisma.game.deleteMany({
        where: { id: { in: gameIds } },
      });

      console.log(`🧹 Cleaned up ${allStaleGames.length} stale games: ${roomCodes.join(', ')}`);
    }

    return { removed: allStaleGames.length, roomCodes };
  }

  // Force cleanup ALL non-completed games (for admin use)
  async forceCleanupAllGames(): Promise<{ removed: number; roomCodes: string[] }> {
    console.log('🧹 forceCleanupAllGames called');

    const nonCompletedGames = await prisma.game.findMany({
      where: {
        status: { in: ['WAITING', 'ACTIVE', 'WORD_SELECTION'] },
      },
    });

    console.log(`🧹 Found ${nonCompletedGames.length} non-completed games:`, nonCompletedGames.map(g => `${g.roomCode}(${g.status})`));

    const roomCodes = nonCompletedGames.map(g => g.roomCode);

    if (nonCompletedGames.length > 0) {
      const gameIds = nonCompletedGames.map(g => g.id);

      // Delete turns first
      await prisma.gameTurn.deleteMany({
        where: { gameId: { in: gameIds } },
      });

      // Delete results
      await prisma.gameResult.deleteMany({
        where: { gameId: { in: gameIds } },
      });

      // Delete players due to foreign key constraints
      await prisma.gamePlayer.deleteMany({
        where: { gameId: { in: gameIds } },
      });

      // Delete the games
      await prisma.game.deleteMany({
        where: { id: { in: gameIds } },
      });

      console.log(`🧹 FORCE cleaned up ${nonCompletedGames.length} games: ${roomCodes.join(', ')}`);
    }

    return { removed: nonCompletedGames.length, roomCodes };
  }

  // Remove a game from the lobby (only host can remove, or force remove for admin)
  async removeGame(roomCode: string, userId?: string, force: boolean = false): Promise<void> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: { players: true },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Only allow host to remove, unless force is true (admin/cleanup)
    if (!force && userId && game.hostId !== userId) {
      throw new Error('Only host can remove the game');
    }

    // Delete related records first
    await prisma.gameTurn.deleteMany({ where: { gameId: game.id } });
    await prisma.gameResult.deleteMany({ where: { gameId: game.id } });
    await prisma.gamePlayer.deleteMany({ where: { gameId: game.id } });
    await prisma.game.delete({ where: { id: game.id } });

    console.log(`🗑️ Game ${roomCode} removed`);
  }

  // Remove a game from history (archived JSON files)
  async removeGameHistory(roomCode: string): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const files = await fs.readdir(DATA_DIR);
    const matchingFile = files.find(f => f.startsWith(roomCode) && f.endsWith('.json'));

    if (!matchingFile) {
      throw new Error('Game history not found');
    }

    const filepath = path.join(DATA_DIR, matchingFile);
    await fs.unlink(filepath);
    console.log(`🗑️ Game history ${roomCode} removed from ${filepath}`);
  }

  private sanitizeGame(game: any, forUserId?: string): any {
    return {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      hostId: game.hostId,
      currentTurnPlayerId: game.currentTurnPlayerId,
      roundNumber: game.roundNumber,
      turnTimerSeconds: game.turnTimerSeconds,
      currentTurnStartedAt: game.currentTurnStartedAt,
      // Turn card fields
      currentTurnCard: game.currentTurnCard,
      turnCardMultiplier: game.turnCardMultiplier,
      turnCardUsed: game.turnCardUsed,
      pendingExposePlayerId: game.pendingExposePlayerId,
      players: game.players.map((p: any) => {
        // Use paddedWord if available, otherwise secretWord
        const word = p.paddedWord || p.secretWord;
        const wordLength = word?.length || 0;

        // Include the player's own secret word (without blanks) if this is their data
        // For bots, forUserId might be the botId
        const isOwnPlayer = forUserId && (p.userId === forUserId || p.botId === forUserId);

        return {
          id: p.id,
          userId: p.userId,
          botId: p.botId,
          isBot: p.isBot || false,
          displayName: p.isBot ? p.botDisplayName : (p.user?.displayName || 'Unknown'),
          botModelName: p.botModelName,
          botDifficulty: p.botDifficulty,
          turnOrder: p.turnOrder,
          wordLength: wordLength,
          hasSelectedWord: p.secretWord !== null,
          frontPadding: p.frontPadding || 0,
          backPadding: p.backPadding || 0,
          // Include own secret word (the actual word without blanks)
          mySecretWord: isOwnPlayer ? p.secretWord : undefined,
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

  // ============================================================================
  // Bot Player Methods
  // ============================================================================

  /**
   * Add a bot player to a game
   */
  async addBotPlayer(roomCode: string, bot: any): Promise<any> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: { players: true },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'WAITING' && game.status !== 'WORD_SELECTION') {
      throw new Error('Cannot add bot after game has started');
    }

    if (game.players.length >= game.maxPlayers) {
      throw new Error('Game is full');
    }

    // Check if bot already in game
    const existingBot = game.players.find(p => p.botId === bot.id);
    if (existingBot) {
      return this.getGameByRoomCode(roomCode);
    }

    const updatedGame = await prisma.game.update({
      where: { id: game.id },
      data: {
        players: {
          create: {
            botId: bot.id,
            isBot: true,
            botDisplayName: bot.displayName || bot.config?.displayName || 'Bot',
            botModelName: bot.config?.modelName,
            botDifficulty: bot.config?.difficulty || 'medium',
            botConfig: bot.config || {},
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

  /**
   * Remove a bot player from a game
   */
  async removeBotPlayer(roomCode: string, botId: string): Promise<any> {
    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: { players: true },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'WAITING') {
      throw new Error('Cannot remove bot after game has started');
    }

    const botPlayer = game.players.find(p => p.botId === botId);
    if (!botPlayer) {
      throw new Error('Bot not in this game');
    }

    await prisma.gamePlayer.delete({
      where: { id: botPlayer.id },
    });

    // Re-order remaining players
    const remainingPlayers = game.players
      .filter(p => p.botId !== botId)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    await Promise.all(
      remainingPlayers.map((p, index) =>
        prisma.gamePlayer.update({
          where: { id: p.id },
          data: { turnOrder: index },
        })
      )
    );

    return this.getGameByRoomCode(roomCode);
  }
}
