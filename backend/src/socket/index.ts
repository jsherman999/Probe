import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { GameManager } from '../game/GameManager';

const gameManager = new GameManager();

// Store active game timers by roomCode
const gameTimers: Map<string, NodeJS.Timeout> = new Map();

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

  console.log(`⏱️ Starting ${turnTimerSeconds}s timer for room ${roomCode}`);

  // Set new timer
  const timer = setTimeout(async () => {
    try {
      console.log(`⏰ Timer expired for room ${roomCode}`);
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
      }
    } catch (error: any) {
      console.error(`❌ Error handling timeout for ${roomCode}:`, error.message);
    }
  }, turnTimerSeconds * 1000);

  gameTimers.set(roomCode, timer);
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

export function setupSocketHandlers(io: Server) {
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
        const game = await gameManager.createGame(socket.userId!);
        console.log(`✅ Game created: ${game.roomCode}`);
        socket.join(game.roomCode);
        socket.emit('gameCreated', game);
        console.log(`📤 Sent gameCreated event to ${socket.username}`);
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
      } catch (error: any) {
        console.error(`❌ Error joining game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Get current game state
    socket.on('getGame', async (data: { roomCode: string }) => {
      try {
        console.log(`📋 Get game request from ${socket.username} for room ${data.roomCode}`);
        const game = await gameManager.getGameByRoomCode(data.roomCode);
        socket.join(data.roomCode); // Ensure they're in the room
        console.log(`📤 Sending game state (status: ${game.status}) to ${socket.username}`);
        socket.emit('gameState', game);
      } catch (error: any) {
        console.error(`❌ Error getting game:`, error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Leave game
    socket.on('leaveGame', async (data: { roomCode: string }) => {
      try {
        await gameManager.leaveGame(data.roomCode, socket.userId!);
        socket.leave(data.roomCode);
        
        io.to(data.roomCode).emit('playerLeft', {
          userId: socket.userId,
          username: socket.username,
        });
      } catch (error: any) {
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
        } else if (!result.isCorrect) {
          // Reset timer for next player's turn
          startTurnTimer(io, data.roomCode, result.game.turnTimerSeconds);
        }
      } catch (error: any) {
        console.error(`❌ Error guessing letter:`, error.message);
        socket.emit('error', { message: error.message });
      }
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
