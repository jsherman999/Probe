import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { GameManager } from '../game/GameManager';

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

        // Remove from lobby since game has started
        io.emit('lobbyGameRemoved', { roomCode: data.roomCode });
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
        } else if (!result.isCorrect) {
          // Reset timer for next player's turn
          startTurnTimer(io, data.roomCode, result.game.turnTimerSeconds);
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
