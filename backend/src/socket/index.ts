import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { GameManager } from '../game/GameManager';
import { PrismaClient } from '@prisma/client';
import { botManager, BotConfigInput, GameContext, PlayerInfo } from '../bot';

const prisma = new PrismaClient();

const gameManager = new GameManager();

// Store active game timers by roomCode
const gameTimers: Map<string, NodeJS.Timeout> = new Map();

// Store blank selection timers and pending data
const blankSelectionTimers: Map<string, NodeJS.Timeout> = new Map();
interface PendingBlankSelection {
  roomCode: string;
  guessingPlayerId: string;
  targetPlayerId: string;
  positions: number[];
}
const pendingBlankSelections: Map<string, PendingBlankSelection> = new Map();

// Store duplicate letter selection timers and pending data
const duplicateSelectionTimers: Map<string, NodeJS.Timeout> = new Map();
interface PendingDuplicateSelection {
  roomCode: string;
  guessingPlayerId: string;
  targetPlayerId: string;
  positions: number[];
  letter: string;
}
const pendingDuplicateSelections: Map<string, PendingDuplicateSelection> = new Map();

// Store word guess timers and pending data
const wordGuessTimers: Map<string, NodeJS.Timeout> = new Map();
interface PendingWordGuess {
  roomCode: string;
  guessingPlayerId: string;
  targetPlayerId: string;
  deadline: number;
}
const pendingWordGuesses: Map<string, PendingWordGuess> = new Map();

// Store expose card selection timers and pending data
const exposeSelectionTimers: Map<string, NodeJS.Timeout> = new Map();
interface PendingExposeSelection {
  roomCode: string;
  affectedPlayerId: string;
  affectedPlayerName: string;
  activePlayerId: string; // The player whose turn it is (who drew the expose card)
}
const pendingExposeSelections: Map<string, PendingExposeSelection> = new Map();

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
}

// Start or reset timer for a game
function startTurnTimer(io: Server, roomCode: string, turnTimerSeconds: number) {
  // Clear existing timer if any
  const existingTimer = gameTimers.get(roomCode);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Safety check: ensure timer is at least 10 seconds, default to 300 (5 min) if invalid
  const safeTimerSeconds = (turnTimerSeconds && turnTimerSeconds > 0) ? turnTimerSeconds : 300;
  if (!turnTimerSeconds || turnTimerSeconds <= 0) {
    console.warn(`⚠️ Invalid turnTimerSeconds (${turnTimerSeconds}) for room ${roomCode}, using default ${safeTimerSeconds}s`);
  }

  console.log(`⏱️ Starting ${safeTimerSeconds}s timer for room ${roomCode}`);

  // Set new timer
  const timer = setTimeout(() => {
    console.log(`⏰ Timer expired for room ${roomCode}`);
    executeTurnTimeout(io, roomCode);
  }, safeTimerSeconds * 1000);

  gameTimers.set(roomCode, timer);
}

// Execute turn timeout logic (advances to next player)
async function executeTurnTimeout(io: Server, roomCode: string) {
  try {
    const result = await gameManager.handleTurnTimeout(roomCode);

    // Broadcast timeout to all players
    io.to(roomCode).emit('turnTimeout', {
      timedOutPlayerId: result.timedOutPlayerId,
      timedOutPlayerName: result.timedOutPlayerName,
      nextPlayerId: result.nextPlayerId,
      nextPlayerName: result.nextPlayerName,
      game: result.game,
    });

    // Start new timer for next player if game still active
    if (result.game.status === 'ACTIVE') {
      startTurnTimer(io, roomCode, result.game.turnTimerSeconds);
      // Also emit turn changed for UI refresh
      io.to(roomCode).emit('turnChanged', {
        previousPlayerId: result.timedOutPlayerId,
        previousPlayerName: result.timedOutPlayerName,
        currentPlayerId: result.nextPlayerId,
        currentPlayerName: result.nextPlayerName,
        game: result.game,
      });

      // Check if next player is a bot
      checkAndTriggerBotTurn(io, roomCode, result.game);
    }
  } catch (error: any) {
    console.error(`❌ Error handling timeout for ${roomCode}:`, error.message);
  }
}

// Stop timer for a game (when completed or abandoned)
function stopTurnTimer(roomCode: string) {
  const timer = gameTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    gameTimers.delete(roomCode);
    console.log(`⏱️ Timer stopped for room ${roomCode}`);
  }
}

// ============================================================================
// Bot Turn Handling
// ============================================================================

/**
 * Build game context for bot decision making
 */
async function buildBotGameContext(roomCode: string, botPlayerId: string): Promise<GameContext> {
  const game = await gameManager.getGameByRoomCode(roomCode);

  // Find the bot player to get their word info
  const botPlayer = game.players.find((p: any) => p.botId === botPlayerId || p.id === botPlayerId);

  const players: PlayerInfo[] = game.players.map((p: any) => ({
    id: p.botId || p.userId || p.id,
    displayName: p.isBot ? p.botDisplayName : p.user?.displayName || 'Unknown',
    userId: p.userId,
    isBot: p.isBot || false,
    wordLength: p.paddedWord?.length || p.secretWord?.length || 0,
    revealedPositions: p.revealedPositions || [],
    missedLetters: p.missedLetters || [],
    totalScore: p.totalScore || 0,
    isEliminated: p.isEliminated || false,
    turnOrder: p.turnOrder || 0,
  }));

  return {
    roomCode,
    botPlayerId,
    players,
    myWord: botPlayer?.secretWord,
    myPaddedWord: botPlayer?.paddedWord,
    myRevealedPositions: botPlayer?.revealedPositions,
    currentTurnPlayerId: game.currentTurnPlayerId,
    roundNumber: game.roundNumber || 1,
    turnTimerSeconds: game.turnTimerSeconds,
  };
}

/**
 * Trigger a bot to take its turn
 */
async function triggerBotTurn(io: Server, roomCode: string, botId: string) {
  const bot = botManager.getBot(botId);
  const botName = bot?.displayName || botId;
  const startTime = Date.now();
  console.log(`🤖 ====== BOT TURN START ======`);
  console.log(`🤖 Triggering bot turn for ${botName} (${botId}) in room ${roomCode}`);

  // Emit thinking indicator to clients
  io.to(roomCode).emit('botThinking', { botId, botName, status: 'starting', message: 'Starting turn...' });

  try {
    console.log(`🤖 [${botName}] Building game context...`);
    const ctx = await buildBotGameContext(roomCode, botId);
    console.log(`🤖 [${botName}] Context built. Players: ${ctx.players.map(p => `${p.displayName}(${p.id.substring(0,8)})`).join(', ')}`);
    console.log(`🤖 [${botName}] Bot's word: ${ctx.myWord}, current turn: ${ctx.currentTurnPlayerId?.substring(0,8)}`);

    io.to(roomCode).emit('botThinking', { botId, botName, status: 'analyzing', message: 'Analyzing game state...' });

    console.log(`🤖 [${botName}] Calling handleBotTurn...`);
    const action = await botManager.handleBotTurn(botId, ctx);
    const elapsed = Date.now() - startTime;
    console.log(`🤖 [${botName}] Decided action: ${action.type} (took ${elapsed}ms)`);

    if (action.type === 'letterGuess') {
      console.log(`🤖 [${botName}] Letter guess action: "${action.letter}" -> target ${action.targetPlayerId.substring(0,8)}`);
      io.to(roomCode).emit('botThinking', { botId, botName, status: 'guessing', message: `Guessing "${action.letter}"...` });

      // Process the letter guess
      const result = await gameManager.processGuess(
        roomCode,
        botId,
        action.targetPlayerId,
        action.letter
      );
      console.log(`🤖 [${botName}] Guess result: ${result.isCorrect ? 'HIT' : 'MISS'}`);

      // Check if duplicate selection is required
      if (result.duplicateSelectionRequired) {
        console.log(`🎲 Bot needs to wait for duplicate selection`);
        // The target player (or bot) needs to select position
        const targetIsBot = botManager.isBot(action.targetPlayerId);
        if (targetIsBot) {
          // Bot target - auto select after delay
          setTimeout(async () => {
            const position = await botManager.handleBotDuplicateSelection(
              action.targetPlayerId,
              result.positions,
              result.letter,
              ctx
            );
            // Resolve and broadcast
            const resolveResult = await gameManager.resolveDuplicateSelection(
              roomCode,
              botId,
              action.targetPlayerId,
              position,
              result.letter
            );
            io.to(roomCode).emit('duplicateSelected', {
              ...resolveResult,
              autoSelected: false,
              selectedPosition: position,
            });
            handlePostGuessLogic(io, roomCode, resolveResult);
          }, 1000);
        }
        return;
      }

      // Check if blank selection is required
      if (result.blankSelectionRequired) {
        console.log(`🎲 Bot needs to wait for blank selection`);
        const targetIsBot = botManager.isBot(action.targetPlayerId);
        if (targetIsBot) {
          setTimeout(async () => {
            const position = await botManager.handleBotBlankSelection(
              action.targetPlayerId,
              result.positions,
              ctx
            );
            const resolveResult = await gameManager.resolveBlankSelection(
              roomCode,
              botId,
              action.targetPlayerId,
              position
            );
            io.to(roomCode).emit('blankSelected', {
              ...resolveResult,
              autoSelected: false,
              selectedPosition: position,
            });
            handlePostGuessLogic(io, roomCode, resolveResult);
          }, 1000);
        }
        return;
      }

      // Broadcast result
      io.to(roomCode).emit('letterGuessed', result);
      handlePostGuessLogic(io, roomCode, result);

    } else if (action.type === 'wordGuess') {
      // Process word guess
      const result = await gameManager.processWordGuess(
        roomCode,
        botId,
        action.targetPlayerId,
        action.word
      );

      io.to(roomCode).emit('wordGuessResult', {
        ...result,
        timedOut: false,
        guessingPlayerName: botManager.getBot(botId)?.displayName || 'Bot',
      });

      handlePostGuessLogic(io, roomCode, result);
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ ====== BOT TURN ERROR ======`);
    console.error(`❌ Bot turn error for ${botName} (${botId}) after ${elapsed}ms`);
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ Stack:`, error.stack);
    io.to(roomCode).emit('botThinking', { botId, botName, status: 'error', message: `Error: ${error.message}` });
    // Force a turn timeout so the game continues
    await executeTurnTimeout(io, roomCode);
  }
  console.log(`🤖 ====== BOT TURN END ======`);
}

/**
 * Handle post-guess logic (word completion, game over, next turn)
 */
function handlePostGuessLogic(io: Server, roomCode: string, result: any) {
  if (result.wordCompleted) {
    io.to(roomCode).emit('wordCompleted', { playerId: result.targetPlayerId });
  }

  if (result.gameOver) {
    io.to(roomCode).emit('gameOver', result.finalResults);
    stopTurnTimer(roomCode);
    botManager.cleanupGame(roomCode);
  } else if (result.isCorrect && result.game) {
    // Correct guess - reset timer for same player's continued turn
    console.log(`⏱️ Correct guess (bot flow) - resetting timer for continued turn`);
    startTurnTimer(io, roomCode, result.game.turnTimerSeconds);
    // Same player continues (could be bot)
    checkAndTriggerBotTurn(io, roomCode, result.game);
  } else if (!result.isCorrect) {
    // Turn ended (miss or wrong word guess) - start timer for next player
    startTurnTimer(io, roomCode, result.game.turnTimerSeconds);

    // Emit turnChanged event so UI updates (critical for bot turns!)
    const nextPlayer = result.game.players?.find((p: any) =>
      p.userId === result.currentTurnPlayerId ||
      p.botId === result.currentTurnPlayerId ||
      p.id === result.currentTurnPlayerId
    );
    const nextPlayerName = nextPlayer?.isBot
      ? nextPlayer?.botDisplayName
      : nextPlayer?.user?.displayName || nextPlayer?.displayName || 'Unknown';

    io.to(roomCode).emit('turnChanged', {
      previousPlayerId: result.guessingPlayerId,
      previousPlayerName: result.guessingPlayerName || 'Player',
      currentPlayerId: result.currentTurnPlayerId,
      currentPlayerName: nextPlayerName,
      game: result.game,
    });

    // Check if next player is a bot
    checkAndTriggerBotTurn(io, roomCode, result.game);
  }
}

/**
 * Check if the current turn player is a bot and trigger their turn
 */
function checkAndTriggerBotTurn(io: Server, roomCode: string, game: any) {
  const currentPlayerId = game.currentTurnPlayerId;
  if (!currentPlayerId) return;

  // Find the current player
  const currentPlayer = game.players?.find((p: any) =>
    p.botId === currentPlayerId || p.userId === currentPlayerId || p.id === currentPlayerId
  );

  if (currentPlayer?.isBot && currentPlayer.botId) {
    // It's a bot's turn - trigger after a short delay
    setTimeout(() => {
      triggerBotTurn(io, roomCode, currentPlayer.botId);
    }, 500);
  }
}

/**
 * Handle pending expose card at game start or after turn change
 * This ensures bot auto-expose works when a human draws an expose card affecting a bot
 */
async function handlePendingExposeCard(io: Server, roomCode: string, game: any) {
  const pendingExposePlayerId = game.pendingExposePlayerId;
  if (!pendingExposePlayerId) return;

  console.log(`🎴 Handling pending expose card for player: ${pendingExposePlayerId}`);

  // Fetch raw player data from database
  const rawAffectedPlayer = await prisma.gamePlayer.findFirst({
    where: {
      game: { roomCode },
      OR: [
        { userId: pendingExposePlayerId },
        { botId: pendingExposePlayerId },
      ],
    },
    include: { user: true },
  });

  if (!rawAffectedPlayer) {
    console.error(`🎴 Could not find affected player: ${pendingExposePlayerId}`);
    return;
  }

  // Get display name - for bots use botDisplayName, for humans use user.displayName
  const isBot = rawAffectedPlayer.isBot || false;
  const affectedPlayerName = isBot
    ? (rawAffectedPlayer.botDisplayName || 'Bot')
    : (rawAffectedPlayer.user?.displayName || 'Unknown');
  const paddedWord = rawAffectedPlayer.paddedWord || rawAffectedPlayer.secretWord || '';

  // Parse revealedPositions from JSON string to boolean array
  let parsedRevealedPositions: boolean[] = [];
  try {
    const revPos = rawAffectedPlayer.revealedPositions;
    if (typeof revPos === 'string') {
      parsedRevealedPositions = JSON.parse(revPos);
    } else if (Array.isArray(revPos)) {
      parsedRevealedPositions = revPos as boolean[];
    }
  } catch (e) {
    console.error('Failed to parse revealedPositions:', e);
  }

  console.log(`🎴 Pending expose - affected: ${affectedPlayerName} (isBot: ${isBot})`);

  // Emit turn card drawn event for the current player
  const currentTurnCard = game.currentTurnCard;
  if (currentTurnCard === 'expose_left' || currentTurnCard === 'expose_right') {
    io.to(roomCode).emit('turnCardDrawn', {
      playerId: game.currentTurnPlayerId,
      turnCard: {
        type: currentTurnCard,
        label: currentTurnCard === 'expose_left' ? 'Player on your left exposes a letter' : 'Player on your right exposes a letter',
        affectedPlayerId: pendingExposePlayerId,
        affectedPlayerName: affectedPlayerName,
      },
    });
  }

  // If affected player is a bot, immediately auto-select a random unrevealed position
  if (isBot) {
    console.log(`🤖 Bot ${affectedPlayerName} auto-selecting expose position (from handlePendingExposeCard)...`);

    // Find all unrevealed positions
    const unrevealedPositions: number[] = [];
    for (let i = 0; i < parsedRevealedPositions.length; i++) {
      if (!parsedRevealedPositions[i]) {
        unrevealedPositions.push(i);
      }
    }

    if (unrevealedPositions.length > 0) {
      // Select a random unrevealed position
      const randomIndex = Math.floor(Math.random() * unrevealedPositions.length);
      const selectedPosition = unrevealedPositions[randomIndex];

      console.log(`🤖 Bot ${affectedPlayerName} selected position ${selectedPosition} from unrevealed: [${unrevealedPositions.join(', ')}]`);

      // Short delay to make it feel natural (1-2 seconds)
      setTimeout(async () => {
        try {
          const botResult = await gameManager.resolveExposeCard(
            roomCode,
            pendingExposePlayerId,
            selectedPosition
          );

          // Broadcast result
          io.to(roomCode).emit('exposeCardResolved', {
            ...botResult,
            autoSelected: true,
            botSelected: true,
          });

          if (botResult.wordCompleted) {
            io.to(roomCode).emit('wordCompleted', { playerId: pendingExposePlayerId });
          }
          if (botResult.gameOver) {
            io.to(roomCode).emit('gameOver', botResult.finalResults);
            stopTurnTimer(roomCode);
          }
        } catch (err) {
          console.error(`Error in bot expose auto-selection for ${affectedPlayerName}:`, err);
        }
      }, 1000 + Math.random() * 1000); // 1-2 second delay
    }
  } else {
    // Human player - use the normal 30-second selection timer
    const selectionKey = `${roomCode}_expose`;
    pendingExposeSelections.set(selectionKey, {
      roomCode: roomCode,
      affectedPlayerId: pendingExposePlayerId,
      affectedPlayerName: affectedPlayerName,
      activePlayerId: game.currentTurnPlayerId,
    });

    // Notify all players that expose selection is required
    io.to(roomCode).emit('exposeCardRequired', {
      affectedPlayerId: pendingExposePlayerId,
      affectedPlayerName: affectedPlayerName,
      activePlayerId: game.currentTurnPlayerId,
      deadline: Date.now() + 30000, // 30 seconds
      paddedWord: paddedWord,
      revealedPositions: parsedRevealedPositions,
    });

    // Start 30 second timer for auto-selection
    const existingTimer = exposeSelectionTimers.get(selectionKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      const pending = pendingExposeSelections.get(selectionKey);
      if (!pending) return;

      console.log(`⏰ Expose selection timeout for ${pending.affectedPlayerName}`);

      try {
        // Fetch fresh player data from database for auto-selection
        const freshPlayer = await prisma.gamePlayer.findFirst({
          where: {
            game: { roomCode: pending.roomCode },
            OR: [
              { userId: pending.affectedPlayerId },
              { botId: pending.affectedPlayerId },
            ],
          },
        });
        if (!freshPlayer) return;

        // Parse revealedPositions from JSON string
        let revealedPositions: boolean[] = [];
        try {
          const revPos = freshPlayer.revealedPositions;
          if (typeof revPos === 'string') {
            revealedPositions = JSON.parse(revPos);
          }
        } catch (e) {
          console.error('Failed to parse revealedPositions in timeout:', e);
          return;
        }

        let rightmostUnrevealed = -1;
        for (let i = revealedPositions.length - 1; i >= 0; i--) {
          if (!revealedPositions[i]) {
            rightmostUnrevealed = i;
            break;
          }
        }

        if (rightmostUnrevealed >= 0) {
          const autoResult = await gameManager.resolveExposeCard(
            pending.roomCode,
            pending.affectedPlayerId,
            rightmostUnrevealed
          );

          // Broadcast result
          io.to(pending.roomCode).emit('exposeCardResolved', {
            ...autoResult,
            autoSelected: true,
          });

          if (autoResult.wordCompleted) {
            io.to(pending.roomCode).emit('wordCompleted', { playerId: pending.affectedPlayerId });
          }
          if (autoResult.gameOver) {
            io.to(pending.roomCode).emit('gameOver', autoResult.finalResults);
            stopTurnTimer(pending.roomCode);
          }
        }
      } catch (err) {
        console.error('Error in expose auto-selection:', err);
      }

      // Cleanup
      pendingExposeSelections.delete(selectionKey);
      exposeSelectionTimers.delete(selectionKey);
    }, 30000);

    exposeSelectionTimers.set(selectionKey, timer);
  }
}

/**
 * Trigger bot word selection during word selection phase
 */
async function triggerBotWordSelection(io: Server, roomCode: string, botId: string) {
  const botName = botManager.getBot(botId)?.displayName || botId;
  console.log(`🤖 Triggering word selection for bot ${botId} (${botName}) in room ${roomCode}`);

  try {
    const ctx = await buildBotGameContext(roomCode, botId);
    console.log(`🤖 [${botName}] Got game context, calling handleBotWordSelection...`);

    const selection = await botManager.handleBotWordSelection(botId, ctx);
    console.log(`🤖 [${botName}] Bot selected word: ${selection.word} (${selection.word.length} letters) + ${selection.frontPadding}/${selection.backPadding} padding`);

    // Submit the word selection
    console.log(`🤖 [${botName}] Submitting word to GameManager...`);
    const game = await gameManager.selectWord(
      roomCode,
      botId,
      selection.word,
      selection.frontPadding,
      selection.backPadding
    );
    console.log(`✅ Bot ${botName} word saved, game status: ${game.status}`);

    // Notify room that bot is ready (don't reveal the word)
    io.to(roomCode).emit('playerReady', {
      userId: botId,
      username: botName,
      isBot: true,
    });

    // Check if all players are ready
    if (game.status === 'ACTIVE') {
      console.log(`🎮 All players ready, starting game in room ${roomCode}`);
      io.to(roomCode).emit('gameStarted', game);
      startTurnTimer(io, roomCode, game.turnTimerSeconds);
      // Check if first player is a bot
      checkAndTriggerBotTurn(io, roomCode, game);
      // Handle any pending expose card at game start (affects bots auto-exposing)
      handlePendingExposeCard(io, roomCode, game);
    }
  } catch (error: any) {
    console.error(`❌ Bot word selection error for ${botId} (${botName}):`, error.message);
    console.error(`❌ Full error:`, error);
  }
}

export function setupSocketHandlers(io: Server) {
  // Run stale game cleanup every 5 minutes
  setInterval(async () => {
    try {
      const result = await gameManager.cleanupStaleGames();
      if (result.removed > 0) {
        // Notify lobby about removed games
        result.roomCodes.forEach(roomCode => {
          io.emit('lobbyGameRemoved', { roomCode });
        });
      }
    } catch (error) {
      console.error('Error in stale game cleanup:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Also run cleanup once on startup
  gameManager.cleanupStaleGames().then(result => {
    if (result.removed > 0) {
      result.roomCodes.forEach(roomCode => {
        io.emit('lobbyGameRemoved', { roomCode });
      });
    }
  }).catch(err => console.error('Startup cleanup error:', err));

  // Authentication middleware
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    console.log(`✓ User connected: ${socket.username} (${socket.userId})`);

    // Send connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      username: socket.username,
    });

    // Create game
    socket.on('createGame', async () => {
      console.log(`📝 Create game request from ${socket.username} (${socket.userId})`);
      try {
        const game = await gameManager.createGame(socket.userId!, socket.username!);
        console.log(`✅ Game created: ${game.roomCode}`);
        socket.join(game.roomCode);
        socket.emit('gameCreated', game);
        console.log(`📤 Sent gameCreated event to ${socket.username}`);

        // Broadcast to lobby for real-time updates
        io.emit('lobbyGameCreated', {
          roomCode: game.roomCode,
          hostName: socket.username,
          playerCount: 1,
          maxPlayers: 4,
          createdAt: new Date().toISOString()
        });
      } catch (error: any) {
        console.error(`❌ Error creating game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Join game
    socket.on('joinGame', async (data: { roomCode: string }) => {
      try {
        console.log(`📝 Join game request from ${socket.username} for room ${data.roomCode}`);
        const game = await gameManager.joinGame(data.roomCode, socket.userId!);
        socket.join(data.roomCode);
        console.log(`✅ ${socket.username} joined room ${data.roomCode}`);

        // Notify all players in the room
        io.to(data.roomCode).emit('playerJoined', {
          userId: socket.userId,
          username: socket.username,
          game,
        });

        // Broadcast to lobby for real-time updates
        io.emit('lobbyGameUpdated', {
          roomCode: data.roomCode,
          playerCount: game.players.length
        });
      } catch (error: any) {
        console.error(`❌ Error joining game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Get current game state
    socket.on('getGame', async (data: { roomCode: string }) => {
      try {
        console.log(`📋 Get game request from ${socket.username} for room ${data.roomCode}`);
        // Pass userId so players can see their own secret word
        const game = await gameManager.getGameByRoomCode(data.roomCode, socket.userId);
        socket.join(data.roomCode); // Ensure they're in the room
        console.log(`📤 Sending game state (status: ${game.status}) to ${socket.username}`);

        // Include viewer guesses when game is completed
        const gameWithViewerGuesses = {
          ...game,
          viewerGuesses: game.status === 'COMPLETED' ? gameManager.getViewerGuesses(data.roomCode) : [],
        };

        socket.emit('gameState', gameWithViewerGuesses);
      } catch (error: any) {
        console.error(`❌ Error getting game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Leave game
    socket.on('leaveGame', async (data: { roomCode: string }) => {
      try {
        console.log(`🚪 Leave game request from ${socket.username} for room ${data.roomCode}`);
        const result = await gameManager.leaveGame(data.roomCode, socket.userId!);
        socket.leave(data.roomCode);

        io.to(data.roomCode).emit('playerLeft', {
          userId: socket.userId,
          username: socket.username,
          game: result.game,
          gameEnded: result.gameEnded,
        });

        // Notify lobby if game was deleted or ended
        if (result.gameEnded) {
          io.emit('lobbyGameRemoved', { roomCode: data.roomCode });
          stopTurnTimer(data.roomCode);
        }

        // Notify the leaving player
        socket.emit('leftGame', { roomCode: data.roomCode, gameEnded: result.gameEnded });
      } catch (error: any) {
        console.error(`❌ Error leaving game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // End game (host only, or force for admin)
    socket.on('endGame', async (data: { roomCode: string; force?: boolean }) => {
      try {
        console.log(`🛑 End game request from ${socket.username} for room ${data.roomCode}`);
        const game = await gameManager.endGame(data.roomCode, socket.userId!, data.force || false);

        // Stop the timer
        stopTurnTimer(data.roomCode);

        // Notify all players
        io.to(data.roomCode).emit('gameEnded', {
          game,
          endedBy: socket.username,
        });

        // Notify lobby
        io.emit('lobbyGameRemoved', { roomCode: data.roomCode });

        console.log(`✅ Game ${data.roomCode} ended by ${socket.username}`);
      } catch (error: any) {
        console.error(`❌ Error ending game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Viewer (observer) word guess - hidden from active players during game
    socket.on('viewerGuessWord', async (data: {
      roomCode: string;
      targetPlayerId: string;
      guessedWord: string;
    }) => {
      try {
        console.log(`👁️ Viewer guess from ${socket.username} for room ${data.roomCode}`);

        const result = await gameManager.submitViewerGuess(
          data.roomCode,
          socket.userId!,
          socket.username!,
          data.targetPlayerId,
          data.guessedWord
        );

        // Only send result back to the viewer who made the guess
        socket.emit('viewerGuessResult', {
          targetPlayerId: data.targetPlayerId,
          targetPlayerName: result.targetPlayerName,
          guessedWord: data.guessedWord.toUpperCase(),
          isCorrect: result.isCorrect,
          submittedAt: new Date(),
        });
      } catch (error: any) {
        console.error(`❌ Error with viewer guess:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Remove game (host only, or force for local admin)
    socket.on('removeGame', async (data: { roomCode: string; force?: boolean }) => {
      try {
        console.log(`🗑️ Remove game request from ${socket.username} for room ${data.roomCode}`);
        await gameManager.removeGame(data.roomCode, socket.userId!, data.force || false);

        // Notify everyone in the room that it's been removed
        io.to(data.roomCode).emit('gameRemoved', { roomCode: data.roomCode });

        // Notify lobby
        io.emit('lobbyGameRemoved', { roomCode: data.roomCode });

        socket.emit('gameRemoveSuccess', { roomCode: data.roomCode });
      } catch (error: any) {
        console.error(`❌ Error removing game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // ========================================================================
    // Bot Management Events
    // ========================================================================

    // Add bot to game (host only)
    socket.on('addBotToGame', async (data: {
      roomCode: string;
      botConfig: BotConfigInput;
    }) => {
      try {
        console.log(`🤖 Add bot request from ${socket.username} for room ${data.roomCode}`);

        // Verify host
        const game = await gameManager.getGameByRoomCode(data.roomCode);
        if (game.hostId !== socket.userId) {
          socket.emit('error', { message: 'Only the host can add bots' });
          return;
        }

        // Check game status
        if (game.status !== 'WAITING' && game.status !== 'WORD_SELECTION') {
          socket.emit('error', { message: 'Cannot add bots after game has started' });
          return;
        }

        // Check player count
        if (game.players.length >= 4) {
          socket.emit('error', { message: 'Game is full (max 4 players)' });
          return;
        }

        // Create the bot
        const bot = botManager.createBot(data.botConfig);

        // Add bot to game in database
        const updatedGame = await gameManager.addBotPlayer(data.roomCode, bot);
        botManager.addBotToGame(bot.id, data.roomCode);

        console.log(`✅ Bot ${bot.displayName} added to game ${data.roomCode}`);

        // Notify all players in the room
        io.to(data.roomCode).emit('botJoined', {
          botId: bot.id,
          displayName: bot.displayName,
          modelName: data.botConfig.modelName,
          difficulty: data.botConfig.difficulty || 'medium',
          game: updatedGame,
        });

        // Update lobby
        io.emit('lobbyGameUpdated', {
          roomCode: data.roomCode,
          playerCount: updatedGame.players.length,
        });

        // If we're in word selection phase, trigger bot word selection
        if (game.status === 'WORD_SELECTION') {
          setTimeout(() => {
            triggerBotWordSelection(io, data.roomCode, bot.id);
          }, 1000);
        }
      } catch (error: any) {
        console.error(`❌ Error adding bot:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Remove bot from game (host only)
    socket.on('removeBotFromGame', async (data: {
      roomCode: string;
      botId: string;
    }) => {
      try {
        console.log(`🤖 Remove bot request from ${socket.username} for room ${data.roomCode}`);

        // Verify host
        const game = await gameManager.getGameByRoomCode(data.roomCode);
        if (game.hostId !== socket.userId) {
          socket.emit('error', { message: 'Only the host can remove bots' });
          return;
        }

        // Check game status
        if (game.status !== 'WAITING') {
          socket.emit('error', { message: 'Cannot remove bots after game has started' });
          return;
        }

        // Remove bot
        const bot = botManager.getBot(data.botId);
        const botName = bot?.displayName || 'Bot';

        await gameManager.removeBotPlayer(data.roomCode, data.botId);
        botManager.removeBotFromGame(data.botId, data.roomCode);
        botManager.destroyBot(data.botId);

        console.log(`✅ Bot ${botName} removed from game ${data.roomCode}`);

        // Get updated game state
        const updatedGame = await gameManager.getGameByRoomCode(data.roomCode);

        // Notify all players
        io.to(data.roomCode).emit('botLeft', {
          botId: data.botId,
          displayName: botName,
          game: updatedGame,
        });

        // Update lobby
        io.emit('lobbyGameUpdated', {
          roomCode: data.roomCode,
          playerCount: updatedGame.players.length,
        });
      } catch (error: any) {
        console.error(`❌ Error removing bot:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Select word
    socket.on('selectWord', async (data: {
      roomCode: string;
      word: string;
      frontPadding?: number;
      backPadding?: number;
    }) => {
      try {
        const frontPad = data.frontPadding || 0;
        const backPad = data.backPadding || 0;
        console.log(`🔤 Select word from ${socket.username} for room ${data.roomCode}: ${data.word.length} letters + ${frontPad}/${backPad} padding`);
        const game = await gameManager.selectWord(
          data.roomCode,
          socket.userId!,
          data.word,
          frontPad,
          backPad
        );
        console.log(`✅ Word selected by ${socket.username}, game status: ${game.status}`);

        // Notify the room (but don't reveal the word)
        io.to(data.roomCode).emit('playerReady', {
          userId: socket.userId,
          username: socket.username,
        });

        // Send updated game state to the player who selected
        socket.emit('wordSelected', { game });

        // Check if all players are ready
        if (game.status === 'ACTIVE') {
          console.log(`🎮 All players ready, starting game in room ${data.roomCode}`);
          io.to(data.roomCode).emit('gameStarted', game);

          // Start the turn timer
          startTurnTimer(io, data.roomCode, game.turnTimerSeconds);

          // Check if first player is a bot
          checkAndTriggerBotTurn(io, data.roomCode, game);

          // Handle any pending expose card at game start (affects bots auto-exposing)
          handlePendingExposeCard(io, data.roomCode, game);
        }
      } catch (error: any) {
        console.error(`❌ Error selecting word:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Start game
    socket.on('startGame', async (data: { roomCode: string }) => {
      try {
        console.log(`🚀 Start game request from ${socket.username} for room ${data.roomCode}`);
        const game = await gameManager.startGame(data.roomCode, socket.userId!);
        console.log(`✅ Game started, entering word selection phase`);
        io.to(data.roomCode).emit('wordSelectionPhase', game);

        // Remove from lobby since game has started
        io.emit('lobbyGameRemoved', { roomCode: data.roomCode });

        // Trigger word selection for any bots in the game
        const botIds = botManager.getBotIdsInGame(data.roomCode);
        botIds.forEach((botId, index) => {
          // Stagger bot word selections to avoid race conditions
          setTimeout(() => {
            triggerBotWordSelection(io, data.roomCode, botId);
          }, 1000 + (index * 500));
        });
      } catch (error: any) {
        console.error(`❌ Error starting game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Update timer settings (host only, before game starts)
    socket.on('updateTimerSettings', async (data: { roomCode: string; turnTimerSeconds: number }) => {
      try {
        console.log(`⏱️ Timer update from ${socket.username}: ${data.turnTimerSeconds}s`);
        const game = await gameManager.updateTimerSettings(data.roomCode, socket.userId!, data.turnTimerSeconds);
        console.log(`✅ Timer updated to ${game.turnTimerSeconds}s`);

        // Broadcast updated game state to all players
        io.to(data.roomCode).emit('timerSettingsUpdated', {
          turnTimerSeconds: game.turnTimerSeconds,
          game,
        });
      } catch (error: any) {
        console.error(`❌ Error updating timer:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Guess letter
    socket.on('guessLetter', async (data: { roomCode: string; targetPlayerId: string; letter: string }) => {
      try {
        console.log(`🎯 Guess letter from ${socket.username}: "${data.letter}" targeting ${data.targetPlayerId}`);
        const result = await gameManager.processGuess(
          data.roomCode,
          socket.userId!,
          data.targetPlayerId,
          data.letter
        );

        // Check if blank selection is required (multiple blanks to choose from)
        if (result.blankSelectionRequired) {
          console.log(`🎲 Blank selection required - ${result.positions.length} blanks available`);

          // Store pending selection data
          const selectionKey = `${data.roomCode}_${data.targetPlayerId}`;
          pendingBlankSelections.set(selectionKey, {
            roomCode: data.roomCode,
            guessingPlayerId: socket.userId!,
            targetPlayerId: data.targetPlayerId,
            positions: result.positions,
          });

          // Notify all players that blank selection is pending
          io.to(data.roomCode).emit('blankSelectionRequired', {
            targetPlayerId: data.targetPlayerId,
            guessingPlayerId: socket.userId,
            positions: result.positions,
            deadline: Date.now() + 30000, // 30 seconds
          });

          // Start 30 second timer for auto-selection
          const existingTimer = blankSelectionTimers.get(selectionKey);
          if (existingTimer) clearTimeout(existingTimer);

          const timer = setTimeout(async () => {
            const pending = pendingBlankSelections.get(selectionKey);
            if (!pending) return;

            // Auto-select rightmost blank
            const rightmostPosition = Math.max(...pending.positions);
            console.log(`⏰ Blank selection timeout - auto-selecting position ${rightmostPosition}`);

            try {
              const autoResult = await gameManager.resolveBlankSelection(
                pending.roomCode,
                pending.guessingPlayerId,
                pending.targetPlayerId,
                rightmostPosition
              );

              // Broadcast result
              io.to(pending.roomCode).emit('blankSelected', {
                ...autoResult,
                autoSelected: true,
                selectedPosition: rightmostPosition,
              });

              if (autoResult.wordCompleted) {
                io.to(pending.roomCode).emit('wordCompleted', { playerId: pending.targetPlayerId });
              }
              if (autoResult.gameOver) {
                io.to(pending.roomCode).emit('gameOver', autoResult.finalResults);
                stopTurnTimer(pending.roomCode);
              }
            } catch (err) {
              console.error('Error in blank auto-selection:', err);
            }

            // Cleanup
            pendingBlankSelections.delete(selectionKey);
            blankSelectionTimers.delete(selectionKey);
          }, 30000);

          blankSelectionTimers.set(selectionKey, timer);
          return;
        }

        // Check if duplicate letter selection is required (multiple positions with same letter)
        if (result.duplicateSelectionRequired) {
          console.log(`🎲 Duplicate letter selection required - ${result.positions.length} positions for "${result.letter}"`);

          // Store pending selection data
          const selectionKey = `${data.roomCode}_${data.targetPlayerId}_dup`;
          pendingDuplicateSelections.set(selectionKey, {
            roomCode: data.roomCode,
            guessingPlayerId: socket.userId!,
            targetPlayerId: data.targetPlayerId,
            positions: result.positions,
            letter: result.letter,
          });

          // Notify all players that duplicate selection is pending
          io.to(data.roomCode).emit('duplicateSelectionRequired', {
            targetPlayerId: data.targetPlayerId,
            guessingPlayerId: socket.userId,
            positions: result.positions,
            letter: result.letter,
            deadline: Date.now() + 30000, // 30 seconds
          });

          // Start 30 second timer for auto-selection
          const existingTimer = duplicateSelectionTimers.get(selectionKey);
          if (existingTimer) clearTimeout(existingTimer);

          const timer = setTimeout(async () => {
            const pending = pendingDuplicateSelections.get(selectionKey);
            if (!pending) return;

            // Auto-select rightmost position
            const rightmostPosition = Math.max(...pending.positions);
            console.log(`⏰ Duplicate selection timeout - auto-selecting position ${rightmostPosition}`);

            try {
              const autoResult = await gameManager.resolveDuplicateSelection(
                pending.roomCode,
                pending.guessingPlayerId,
                pending.targetPlayerId,
                rightmostPosition,
                pending.letter
              );

              // Broadcast result
              io.to(pending.roomCode).emit('duplicateSelected', {
                ...autoResult,
                autoSelected: true,
                selectedPosition: rightmostPosition,
              });

              if (autoResult.wordCompleted) {
                io.to(pending.roomCode).emit('wordCompleted', { playerId: pending.targetPlayerId });
              }
              if (autoResult.gameOver) {
                io.to(pending.roomCode).emit('gameOver', autoResult.finalResults);
                stopTurnTimer(pending.roomCode);
              }
            } catch (err) {
              console.error('Error in duplicate auto-selection:', err);
            }

            // Cleanup
            pendingDuplicateSelections.delete(selectionKey);
            duplicateSelectionTimers.delete(selectionKey);
          }, 30000);

          duplicateSelectionTimers.set(selectionKey, timer);
          return;
        }

        console.log(`✅ Guess result: ${result.isCorrect ? 'HIT' : 'MISS'}, positions: ${result.positions.join(',') || 'none'}`);

        // Broadcast result to all players
        io.to(data.roomCode).emit('letterGuessed', result);

        if (result.wordCompleted) {
          console.log(`🏆 Word completed for player ${data.targetPlayerId}`);
          io.to(data.roomCode).emit('wordCompleted', {
            playerId: data.targetPlayerId,
          });
        }

        if (result.gameOver) {
          console.log(`🎮 Game over in room ${data.roomCode}`);
          io.to(data.roomCode).emit('gameOver', result.finalResults);
          // Stop the timer when game ends
          stopTurnTimer(data.roomCode);
        } else if (result.isCorrect) {
          // Correct guess - reset timer for same player's continued turn
          console.log(`⏱️ Correct guess - resetting timer for continued turn`);
          startTurnTimer(io, data.roomCode, result.game.turnTimerSeconds);
        } else {
          // Miss - reset timer for next player's turn
          startTurnTimer(io, data.roomCode, result.game.turnTimerSeconds);

          // If a turn card was drawn for the next player, emit it
          if (result.turnCardInfo) {
            console.log(`🎴 Turn card drawn for next player: ${result.turnCardInfo.type}`);
            io.to(data.roomCode).emit('turnCardDrawn', {
              playerId: result.currentTurnPlayerId,
              turnCard: result.turnCardInfo,
            });

            // If expose card, start expose selection timer
            if (result.turnCardInfo.affectedPlayerId) {
              const selectionKey = `${data.roomCode}_expose`;
              const affectedId = result.turnCardInfo.affectedPlayerId;

              // Fetch raw player data from database (sanitized game doesn't have paddedWord)
              // Search by BOTH userId OR botId since affected player might be a bot
              const rawAffectedPlayer = await prisma.gamePlayer.findFirst({
                where: {
                  game: { roomCode: data.roomCode },
                  OR: [
                    { userId: affectedId },
                    { botId: affectedId },
                  ],
                },
                include: { user: true },
              });

              // Get display name - for bots use botDisplayName, for humans use user.displayName
              const isBot = rawAffectedPlayer?.isBot || false;
              const affectedPlayerName = isBot
                ? (rawAffectedPlayer?.botDisplayName || 'Bot')
                : (rawAffectedPlayer?.user?.displayName || 'Unknown');
              const paddedWord = rawAffectedPlayer?.paddedWord || rawAffectedPlayer?.secretWord || '';

              // Parse revealedPositions from JSON string to boolean array
              let parsedRevealedPositions: boolean[] = [];
              try {
                const revPos = rawAffectedPlayer?.revealedPositions;
                if (typeof revPos === 'string') {
                  parsedRevealedPositions = JSON.parse(revPos);
                } else if (Array.isArray(revPos)) {
                  parsedRevealedPositions = revPos as boolean[];
                }
              } catch (e) {
                console.error('Failed to parse revealedPositions:', e);
              }

              console.log(`🎴 Expose card - affected: ${affectedPlayerName} (isBot: ${isBot}), paddedWord: ${paddedWord}, revealedPositions:`, parsedRevealedPositions);

              // If affected player is a bot, immediately auto-select a random unrevealed position
              if (isBot && rawAffectedPlayer) {
                console.log(`🤖 Bot ${affectedPlayerName} auto-selecting expose position...`);

                // Find all unrevealed positions
                const unrevealedPositions: number[] = [];
                for (let i = 0; i < parsedRevealedPositions.length; i++) {
                  if (!parsedRevealedPositions[i]) {
                    unrevealedPositions.push(i);
                  }
                }

                if (unrevealedPositions.length > 0) {
                  // Select a random unrevealed position
                  const randomIndex = Math.floor(Math.random() * unrevealedPositions.length);
                  const selectedPosition = unrevealedPositions[randomIndex];

                  console.log(`🤖 Bot ${affectedPlayerName} selected position ${selectedPosition} from unrevealed: [${unrevealedPositions.join(', ')}]`);

                  // Short delay to make it feel natural (1-2 seconds)
                  setTimeout(async () => {
                    try {
                      const botResult = await gameManager.resolveExposeCard(
                        data.roomCode,
                        affectedId,
                        selectedPosition
                      );

                      // Broadcast result
                      io.to(data.roomCode).emit('exposeCardResolved', {
                        ...botResult,
                        autoSelected: true,
                        botSelected: true,
                      });

                      if (botResult.wordCompleted) {
                        io.to(data.roomCode).emit('wordCompleted', { playerId: affectedId });
                      }
                      if (botResult.gameOver) {
                        io.to(data.roomCode).emit('gameOver', botResult.finalResults);
                        stopTurnTimer(data.roomCode);
                      }
                    } catch (err) {
                      console.error(`Error in bot expose auto-selection for ${affectedPlayerName}:`, err);
                    }
                  }, 1000 + Math.random() * 1000); // 1-2 second delay
                }
              } else {
                // Human player - use the normal 30-second selection timer
                pendingExposeSelections.set(selectionKey, {
                  roomCode: data.roomCode,
                  affectedPlayerId: affectedId,
                  affectedPlayerName: affectedPlayerName,
                  activePlayerId: result.currentTurnPlayerId,
                });

                // Notify all players that expose selection is required
                io.to(data.roomCode).emit('exposeCardRequired', {
                  affectedPlayerId: affectedId,
                  affectedPlayerName: affectedPlayerName,
                  activePlayerId: result.currentTurnPlayerId,
                  deadline: Date.now() + 30000, // 30 seconds
                  // Send padded word so affected player can see their letters
                  paddedWord: paddedWord,
                  revealedPositions: parsedRevealedPositions,
                });

                // Start 30 second timer for auto-selection
                const existingTimer = exposeSelectionTimers.get(selectionKey);
                if (existingTimer) clearTimeout(existingTimer);

                const timer = setTimeout(async () => {
                  const pending = pendingExposeSelections.get(selectionKey);
                  if (!pending) return;

                  console.log(`⏰ Expose selection timeout for ${pending.affectedPlayerName}`);

                  try {
                    // Fetch fresh player data from database for auto-selection
                    // Search by BOTH userId OR botId
                    const freshPlayer = await prisma.gamePlayer.findFirst({
                      where: {
                        game: { roomCode: pending.roomCode },
                        OR: [
                          { userId: pending.affectedPlayerId },
                          { botId: pending.affectedPlayerId },
                        ],
                      },
                    });
                    if (!freshPlayer) return;

                    // Parse revealedPositions from JSON string
                    let revealedPositions: boolean[] = [];
                    try {
                      const revPos = freshPlayer.revealedPositions;
                      if (typeof revPos === 'string') {
                        revealedPositions = JSON.parse(revPos);
                      }
                    } catch (e) {
                      console.error('Failed to parse revealedPositions in timeout:', e);
                      return;
                    }

                    let rightmostUnrevealed = -1;
                    for (let i = revealedPositions.length - 1; i >= 0; i--) {
                      if (!revealedPositions[i]) {
                        rightmostUnrevealed = i;
                        break;
                      }
                    }

                    if (rightmostUnrevealed >= 0) {
                      const autoResult = await gameManager.resolveExposeCard(
                        pending.roomCode,
                        pending.affectedPlayerId,
                        rightmostUnrevealed
                      );

                      // Broadcast result
                      io.to(pending.roomCode).emit('exposeCardResolved', {
                        ...autoResult,
                        autoSelected: true,
                      });

                      if (autoResult.wordCompleted) {
                        io.to(pending.roomCode).emit('wordCompleted', { playerId: pending.affectedPlayerId });
                      }
                      if (autoResult.gameOver) {
                        io.to(pending.roomCode).emit('gameOver', autoResult.finalResults);
                        stopTurnTimer(pending.roomCode);
                      }
                    }
                  } catch (err) {
                    console.error('Error in expose auto-selection:', err);
                  }

                  // Cleanup
                  pendingExposeSelections.delete(selectionKey);
                  exposeSelectionTimers.delete(selectionKey);
                }, 30000);

                exposeSelectionTimers.set(selectionKey, timer);
              }
            }
          }

          // Emit turn changed event for UI refresh
          const nextPlayer = result.game.players.find((p: any) =>
            p.userId === result.currentTurnPlayerId || p.botId === result.currentTurnPlayerId
          );
          const nextPlayerName = nextPlayer?.isBot
            ? nextPlayer?.botDisplayName
            : nextPlayer?.user?.displayName || nextPlayer?.displayName || 'Unknown';
          io.to(data.roomCode).emit('turnChanged', {
            previousPlayerId: socket.userId,
            previousPlayerName: socket.username,
            currentPlayerId: result.currentTurnPlayerId,
            currentPlayerName: nextPlayerName,
            game: result.game,
          });

          // Check if next player is a bot and trigger their turn
          checkAndTriggerBotTurn(io, data.roomCode, result.game);
        }
      } catch (error: any) {
        console.error(`❌ Error guessing letter:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Select blank position (when target player chooses which blank to reveal)
    socket.on('selectBlankPosition', async (data: { roomCode: string; position: number }) => {
      try {
        const selectionKey = `${data.roomCode}_${socket.userId}`;
        const pending = pendingBlankSelections.get(selectionKey);

        if (!pending) {
          socket.emit('error', { message: 'No pending blank selection' });
          return;
        }

        if (!pending.positions.includes(data.position)) {
          socket.emit('error', { message: 'Invalid blank position' });
          return;
        }

        console.log(`🎯 Blank position selected by ${socket.username}: position ${data.position}`);

        // Clear the timer
        const timer = blankSelectionTimers.get(selectionKey);
        if (timer) clearTimeout(timer);
        blankSelectionTimers.delete(selectionKey);
        pendingBlankSelections.delete(selectionKey);

        // Resolve the blank selection
        const result = await gameManager.resolveBlankSelection(
          pending.roomCode,
          pending.guessingPlayerId,
          pending.targetPlayerId,
          data.position
        );

        // Broadcast result to all players
        io.to(data.roomCode).emit('blankSelected', {
          ...result,
          autoSelected: false,
          selectedPosition: data.position,
        });

        if (result.wordCompleted) {
          console.log(`🏆 Word completed for player ${pending.targetPlayerId}`);
          io.to(data.roomCode).emit('wordCompleted', { playerId: pending.targetPlayerId });
        }

        if (result.gameOver) {
          console.log(`🎮 Game over in room ${data.roomCode}`);
          io.to(data.roomCode).emit('gameOver', result.finalResults);
          stopTurnTimer(data.roomCode);
        }
      } catch (error: any) {
        console.error(`❌ Error selecting blank position:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Select duplicate letter position (when target player chooses which duplicate to reveal)
    socket.on('selectDuplicatePosition', async (data: { roomCode: string; position: number }) => {
      try {
        const selectionKey = `${data.roomCode}_${socket.userId}_dup`;
        const pending = pendingDuplicateSelections.get(selectionKey);

        if (!pending) {
          socket.emit('error', { message: 'No pending duplicate selection' });
          return;
        }

        if (!pending.positions.includes(data.position)) {
          socket.emit('error', { message: 'Invalid duplicate position' });
          return;
        }

        console.log(`🎯 Duplicate position selected by ${socket.username}: position ${data.position} for letter "${pending.letter}"`);

        // Clear the timer
        const timer = duplicateSelectionTimers.get(selectionKey);
        if (timer) clearTimeout(timer);
        duplicateSelectionTimers.delete(selectionKey);
        pendingDuplicateSelections.delete(selectionKey);

        // Resolve the duplicate selection
        const result = await gameManager.resolveDuplicateSelection(
          pending.roomCode,
          pending.guessingPlayerId,
          pending.targetPlayerId,
          data.position,
          pending.letter
        );

        // Broadcast result to all players
        io.to(data.roomCode).emit('duplicateSelected', {
          ...result,
          autoSelected: false,
          selectedPosition: data.position,
        });

        if (result.wordCompleted) {
          console.log(`🏆 Word completed for player ${pending.targetPlayerId}`);
          io.to(data.roomCode).emit('wordCompleted', { playerId: pending.targetPlayerId });
        }

        if (result.gameOver) {
          console.log(`🎮 Game over in room ${data.roomCode}`);
          io.to(data.roomCode).emit('gameOver', result.finalResults);
          stopTurnTimer(data.roomCode);
        }
      } catch (error: any) {
        console.error(`❌ Error selecting duplicate position:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Select expose card position (when affected player chooses which of their own letters to reveal)
    socket.on('selectExposePosition', async (data: { roomCode: string; position: number }) => {
      try {
        const selectionKey = `${data.roomCode}_expose`;
        const pending = pendingExposeSelections.get(selectionKey);

        if (!pending) {
          socket.emit('error', { message: 'No pending expose selection' });
          return;
        }

        if (pending.affectedPlayerId !== socket.userId) {
          socket.emit('error', { message: 'Not your expose selection' });
          return;
        }

        console.log(`🎯 Expose position selected by ${socket.username}: position ${data.position}`);

        // Clear the timer
        const timer = exposeSelectionTimers.get(selectionKey);
        if (timer) clearTimeout(timer);
        exposeSelectionTimers.delete(selectionKey);
        pendingExposeSelections.delete(selectionKey);

        // Resolve the expose selection
        const result = await gameManager.resolveExposeCard(
          pending.roomCode,
          pending.affectedPlayerId,
          data.position
        );

        // Broadcast result to all players
        io.to(data.roomCode).emit('exposeCardResolved', {
          ...result,
          autoSelected: false,
          selectedPosition: data.position,
        });

        if (result.wordCompleted) {
          console.log(`🏆 Word completed for player ${pending.affectedPlayerId}`);
          io.to(data.roomCode).emit('wordCompleted', { playerId: pending.affectedPlayerId });
        }

        if (result.gameOver) {
          console.log(`🎮 Game over in room ${data.roomCode}`);
          io.to(data.roomCode).emit('gameOver', result.finalResults);
          stopTurnTimer(data.roomCode);
        }
      } catch (error: any) {
        console.error(`❌ Error selecting expose position:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Initiate word guess ("Guess Now!" feature)
    socket.on('initiateWordGuess', async (data: { roomCode: string; targetPlayerId: string }) => {
      try {
        console.log(`🎲 Word guess initiated by ${socket.username} targeting ${data.targetPlayerId}`);

        // Check if there's already a pending word guess for this room
        const existingGuess = Array.from(pendingWordGuesses.values()).find(
          pg => pg.roomCode === data.roomCode
        );
        if (existingGuess) {
          socket.emit('error', { message: 'Another player is already making a word guess' });
          return;
        }

        const guessKey = `${data.roomCode}_${socket.userId}`;
        const deadline = Date.now() + 30000; // 30 seconds

        // Store pending word guess
        pendingWordGuesses.set(guessKey, {
          roomCode: data.roomCode,
          guessingPlayerId: socket.userId!,
          targetPlayerId: data.targetPlayerId,
          deadline,
        });

        // Notify all players about the word guess attempt
        io.to(data.roomCode).emit('wordGuessStarted', {
          guessingPlayerId: socket.userId,
          guessingPlayerName: socket.username,
          targetPlayerId: data.targetPlayerId,
          deadline,
        });

        // Start 30 second timer for timeout
        const timer = setTimeout(async () => {
          const pending = pendingWordGuesses.get(guessKey);
          if (!pending) return;

          console.log(`⏰ Word guess timeout for ${socket.username}`);

          // Timeout counts as wrong guess (-50 points)
          try {
            const result = await gameManager.processWordGuess(
              pending.roomCode,
              pending.guessingPlayerId,
              pending.targetPlayerId,
              '' // Empty guess is always wrong
            );

            io.to(pending.roomCode).emit('wordGuessResult', {
              ...result,
              timedOut: true,
              guessingPlayerName: socket.username,
            });

            if (result.gameOver) {
              io.to(pending.roomCode).emit('gameOver', result.finalResults);
              stopTurnTimer(pending.roomCode);
            }
          } catch (err) {
            console.error('Error in word guess timeout:', err);
          }

          pendingWordGuesses.delete(guessKey);
          wordGuessTimers.delete(guessKey);
        }, 30000);

        wordGuessTimers.set(guessKey, timer);
      } catch (error: any) {
        console.error(`❌ Error initiating word guess:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Submit word guess
    socket.on('submitWordGuess', async (data: { roomCode: string; guessedWord: string }) => {
      try {
        const guessKey = `${data.roomCode}_${socket.userId}`;
        const pending = pendingWordGuesses.get(guessKey);

        if (!pending) {
          socket.emit('error', { message: 'No pending word guess' });
          return;
        }

        console.log(`🎯 Word guess submitted by ${socket.username}: "${data.guessedWord}"`);

        // Clear the timer
        const timer = wordGuessTimers.get(guessKey);
        if (timer) clearTimeout(timer);
        wordGuessTimers.delete(guessKey);
        pendingWordGuesses.delete(guessKey);

        // Process the word guess
        const result = await gameManager.processWordGuess(
          pending.roomCode,
          pending.guessingPlayerId,
          pending.targetPlayerId,
          data.guessedWord
        );

        console.log(`✅ Word guess result: ${result.isCorrect ? 'CORRECT' : 'WRONG'}, points: ${result.pointsChange}`);

        // Broadcast result to all players
        io.to(data.roomCode).emit('wordGuessResult', {
          ...result,
          timedOut: false,
          guessingPlayerName: socket.username,
        });

        if (result.gameOver) {
          console.log(`🎮 Game over in room ${data.roomCode}`);
          io.to(data.roomCode).emit('gameOver', result.finalResults);
          stopTurnTimer(data.roomCode);
        } else if (!result.isCorrect) {
          // Wrong word guess ends the turn - restart timer for next player
          startTurnTimer(io, data.roomCode, result.game.turnTimerSeconds);
          // Emit turn changed event for UI refresh
          const nextPlayer = result.game.players.find((p: any) =>
            p.userId === result.game.currentTurnPlayerId || p.botId === result.game.currentTurnPlayerId
          );
          const nextPlayerName = nextPlayer?.isBot
            ? nextPlayer?.botDisplayName
            : nextPlayer?.user?.displayName || nextPlayer?.displayName || 'Unknown';
          io.to(data.roomCode).emit('turnChanged', {
            previousPlayerId: socket.userId,
            previousPlayerName: socket.username,
            currentPlayerId: result.game.currentTurnPlayerId,
            currentPlayerName: nextPlayerName,
            game: result.game,
          });
        }
      } catch (error: any) {
        console.error(`❌ Error submitting word guess:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Cancel word guess (if player changes their mind)
    socket.on('cancelWordGuess', async (data: { roomCode: string }) => {
      const guessKey = `${data.roomCode}_${socket.userId}`;
      const pending = pendingWordGuesses.get(guessKey);

      if (!pending) return;

      console.log(`❌ Word guess cancelled by ${socket.username}`);

      // Clear timer and pending data
      const timer = wordGuessTimers.get(guessKey);
      if (timer) clearTimeout(timer);
      wordGuessTimers.delete(guessKey);
      pendingWordGuesses.delete(guessKey);

      // Notify all players
      io.to(data.roomCode).emit('wordGuessCancelled', {
        guessingPlayerId: socket.userId,
        guessingPlayerName: socket.username,
      });
    });

    // Ping for connection health check
    socket.on('ping', (callback) => {
      callback({ pong: true, timestamp: Date.now() });
    });

    // Handle reconnection
    socket.on('reconnect', async (data: { roomCode?: string }, callback) => {
      try {
        console.log(`🔄 User reconnecting: ${socket.username}`);
        
        if (data.roomCode) {
          // Rejoin the room
          socket.join(data.roomCode);
          
          // Get current game state
          const game = await gameManager.getGameByRoomCode(data.roomCode);
          
          callback({ success: true, game });
        } else {
          callback({ success: true });
        }
      } catch (error: any) {
        callback({ success: false, error: error.message });
      }
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      console.log(`✗ User disconnected: ${socket.username} (${socket.userId}) - Reason: ${reason}`);
      
      // Notify rooms about disconnection
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      rooms.forEach(roomCode => {
        io.to(roomCode).emit('playerDisconnected', {
          userId: socket.userId,
          username: socket.username,
          reason,
        });
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.username}:`, error);
      socket.emit('error', { message: error.message });
    });
  });

  // Global error handler
  io.on('error', (error) => {
    console.error('❌ Socket.IO server error:', error);
  });
}
