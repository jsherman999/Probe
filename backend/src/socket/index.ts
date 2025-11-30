import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { GameManager } from './game/GameManager';

const gameManager = new GameManager();

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
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
      try {
        const game = await gameManager.createGame(socket.userId!);
        socket.join(game.roomCode);
        socket.emit('gameCreated', game);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // Join game
    socket.on('joinGame', async (data: { roomCode: string }) => {
      try {
        const game = await gameManager.joinGame(data.roomCode, socket.userId!);
        socket.join(data.roomCode);
        
        // Notify all players in the room
        io.to(data.roomCode).emit('playerJoined', {
          userId: socket.userId,
          username: socket.username,
          game,
        });
      } catch (error: any) {
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
    socket.on('selectWord', async (data: { roomCode: string; word: string }) => {
      try {
        const game = await gameManager.selectWord(data.roomCode, socket.userId!, data.word);
        
        // Notify the room (but don't reveal the word)
        io.to(data.roomCode).emit('playerReady', {
          userId: socket.userId,
          username: socket.username,
        });

        // Check if all players are ready
        if (game.status === 'ACTIVE') {
          io.to(data.roomCode).emit('gameStarted', game);
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // Start game
    socket.on('startGame', async (data: { roomCode: string }) => {
      try {
        const game = await gameManager.startGame(data.roomCode, socket.userId!);
        io.to(data.roomCode).emit('wordSelectionPhase', game);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // Guess letter
    socket.on('guessLetter', async (data: { roomCode: string; targetPlayerId: string; letter: string }) => {
      try {
        const result = await gameManager.processGuess(
          data.roomCode,
          socket.userId!,
          data.targetPlayerId,
          data.letter
        );

        // Broadcast result to all players
        io.to(data.roomCode).emit('letterGuessed', result);

        if (result.wordCompleted) {
          io.to(data.roomCode).emit('wordCompleted', {
            playerId: data.targetPlayerId,
          });
        }

        if (result.gameOver) {
          io.to(data.roomCode).emit('gameOver', result.finalResults);
        }
      } catch (error: any) {
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
