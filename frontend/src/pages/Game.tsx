import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setGame } from '../store/slices/gameSlice';
import socketService from '../services/socket';

// Toast notification component
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 bg-warning text-black px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
      <span className="text-xl">⏰</span>
      <span className="font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 text-black/60 hover:text-black">
        &times;
      </button>
    </div>
  );
}

export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const game = useAppSelector((state) => state.game);
  const [selectedWord, setSelectedWord] = useState('');
  const [frontPadding, setFrontPadding] = useState(0);
  const [backPadding, setBackPadding] = useState(0);
  const [error, setError] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showMyWord, setShowMyWord] = useState(false);

  // Blank selection state
  const [blankSelectionPending, setBlankSelectionPending] = useState<{
    positions: number[];
    deadline: number;
    guessingPlayerId: string;
  } | null>(null);
  const [blankSelectionTimeRemaining, setBlankSelectionTimeRemaining] = useState<number>(0);

  // Duplicate letter selection state
  const [duplicateSelectionPending, setDuplicateSelectionPending] = useState<{
    positions: number[];
    deadline: number;
    guessingPlayerId: string;
    letter: string;
  } | null>(null);
  const [duplicateSelectionTimeRemaining, setDuplicateSelectionTimeRemaining] = useState<number>(0);

  // Word guess state ("Guess Now!" feature)
  const [wordGuessActive, setWordGuessActive] = useState<{
    guessingPlayerId: string;
    guessingPlayerName: string;
    targetPlayerId: string;
    deadline: number;
  } | null>(null);
  const [wordGuessInput, setWordGuessInput] = useState('');
  const [wordGuessTimeRemaining, setWordGuessTimeRemaining] = useState<number>(0);
  const [showWordGuessModal, setShowWordGuessModal] = useState(false);

  // Viewer guess state (for observers)
  const [viewerGuessTarget, setViewerGuessTarget] = useState<string | null>(null);
  const [viewerGuessInput, setViewerGuessInput] = useState('');
  const [viewerGuesses, setViewerGuesses] = useState<Array<{
    viewerId: string;
    viewerName: string;
    targetPlayerId: string;
    targetPlayerName: string;
    guessedWord: string;
    isCorrect: boolean;
    submittedAt: string;
  }>>([]);
  const [myViewerGuesses, setMyViewerGuesses] = useState<Array<{
    targetPlayerId: string;
    targetPlayerName: string;
    guessedWord: string;
    isCorrect: boolean;
    submittedAt: Date;
  }>>([]);

  // Turn change flash state
  const [turnChangeFlash, setTurnChangeFlash] = useState<{
    isMyTurn: boolean;
    playerName: string;
  } | null>(null);

  // Blank selection countdown timer effect
  useEffect(() => {
    if (!blankSelectionPending) {
      setBlankSelectionTimeRemaining(0);
      return;
    }

    const updateBlankTimer = () => {
      const remaining = Math.max(0, Math.floor((blankSelectionPending.deadline - Date.now()) / 1000));
      setBlankSelectionTimeRemaining(remaining);
    };

    updateBlankTimer();
    const interval = setInterval(updateBlankTimer, 1000);

    return () => clearInterval(interval);
  }, [blankSelectionPending]);

  // Duplicate selection countdown timer effect
  useEffect(() => {
    if (!duplicateSelectionPending) {
      setDuplicateSelectionTimeRemaining(0);
      return;
    }

    const updateDuplicateTimer = () => {
      const remaining = Math.max(0, Math.floor((duplicateSelectionPending.deadline - Date.now()) / 1000));
      setDuplicateSelectionTimeRemaining(remaining);
    };

    updateDuplicateTimer();
    const interval = setInterval(updateDuplicateTimer, 1000);

    return () => clearInterval(interval);
  }, [duplicateSelectionPending]);

  // Word guess countdown timer effect
  useEffect(() => {
    if (!wordGuessActive) {
      setWordGuessTimeRemaining(0);
      return;
    }

    const updateWordGuessTimer = () => {
      const remaining = Math.max(0, Math.floor((wordGuessActive.deadline - Date.now()) / 1000));
      setWordGuessTimeRemaining(remaining);
    };

    updateWordGuessTimer();
    const interval = setInterval(updateWordGuessTimer, 1000);

    return () => clearInterval(interval);
  }, [wordGuessActive]);

  // Handler to initiate word guess
  const handleInitiateWordGuess = (targetPlayerId: string) => {
    console.log('🎯 handleInitiateWordGuess called:', { roomCode, targetPlayerId });
    if (!roomCode) {
      console.error('❌ No roomCode for word guess');
      return;
    }

    const socket = socketService.getSocket();
    if (!socket || !socketService.isConnected()) {
      console.error('❌ Socket not connected for word guess');
      setError('Connection lost. Please refresh the page.');
      return;
    }

    console.log('📤 Emitting initiateWordGuess');
    socket.emit('initiateWordGuess', {
      roomCode,
      targetPlayerId,
    });
  };

  // Handler to submit word guess
  const handleSubmitWordGuess = () => {
    if (!roomCode || !wordGuessInput.trim()) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('📤 Emitting submitWordGuess:', wordGuessInput.trim().toUpperCase());
    socket.emit('submitWordGuess', {
      roomCode,
      guessedWord: wordGuessInput.trim().toUpperCase(),
    });

    setWordGuessInput('');
    setShowWordGuessModal(false);
  };

  // Handler to cancel word guess
  const handleCancelWordGuess = () => {
    if (!roomCode) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('📤 Emitting cancelWordGuess');
    socket.emit('cancelWordGuess', { roomCode });
    setShowWordGuessModal(false);
    setWordGuessInput('');
  };

  // Handler to select blank position
  const handleBlankPositionSelect = (position: number) => {
    if (!blankSelectionPending || !roomCode) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('📤 Emitting selectBlankPosition:', position);
    socket.emit('selectBlankPosition', {
      roomCode,
      position,
    });

    // Clear pending state immediately for responsive UI
    setBlankSelectionPending(null);
  };

  // Handler to select duplicate letter position
  const handleDuplicatePositionSelect = (position: number) => {
    if (!duplicateSelectionPending || !roomCode) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('📤 Emitting selectDuplicatePosition:', position);
    socket.emit('selectDuplicatePosition', {
      roomCode,
      position,
    });

    // Clear pending state immediately for responsive UI
    setDuplicateSelectionPending(null);
  };

  // Handler to leave game
  const handleLeaveGame = () => {
    if (!roomCode) return;
    if (!confirm('Are you sure you want to leave this game? You will forfeit if the game is in progress.')) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('📤 Emitting leaveGame');
    socket.emit('leaveGame', { roomCode });
  };

  // Handler to end game (host only)
  const handleEndGame = () => {
    if (!roomCode) return;
    if (!confirm('Are you sure you want to end this game? This will declare the current leader as winner.')) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('📤 Emitting endGame');
    socket.emit('endGame', { roomCode, force: true });
  };

  // Handler for viewer (observer) to submit a word guess
  const handleViewerGuessSubmit = () => {
    if (!roomCode || !viewerGuessTarget || !viewerGuessInput.trim()) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    console.log('👁️ Submitting viewer guess:', viewerGuessInput.toUpperCase());
    socket.emit('viewerGuessWord', {
      roomCode,
      targetPlayerId: viewerGuessTarget,
      guessedWord: viewerGuessInput.trim().toUpperCase(),
    });

    setViewerGuessInput('');
    setViewerGuessTarget(null);
  };

  // Calculate and update time remaining
  const updateTimeRemaining = useCallback(() => {
    if (game.status === 'ACTIVE' && game.currentTurnStartedAt && game.turnTimerSeconds) {
      const startTime = new Date(game.currentTurnStartedAt).getTime();
      const endTime = startTime + game.turnTimerSeconds * 1000;
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeRemaining(remaining);
    } else {
      setTimeRemaining(null);
    }
  }, [game.status, game.currentTurnStartedAt, game.turnTimerSeconds]);

  // Timer countdown effect
  useEffect(() => {
    updateTimeRemaining();

    if (game.status === 'ACTIVE') {
      timerRef.current = setInterval(updateTimeRemaining, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [game.status, game.currentTurnStartedAt, game.turnTimerSeconds, updateTimeRemaining]);

  // Auto-select opponent in 2-player games when it's my turn
  useEffect(() => {
    if (game.status === 'ACTIVE' && game.currentTurnPlayerId === user?.id) {
      const otherPlayers = game.players.filter(p => p.userId !== user?.id && !p.isEliminated);
      if (otherPlayers.length === 1) {
        setSelectedTarget(otherPlayers[0].userId);
      }
    }
  }, [game.status, game.currentTurnPlayerId, game.players, user?.id]);

  // Ensure socket is connected and game state is synced when component mounts
  useEffect(() => {
    if (!token || !roomCode) {
      console.error('❌ No token or roomCode available');
      navigate('/');
      return;
    }

    const socket = socketService.connect(token);

    // Listen for game state updates
    const onGameState = (data: any) => {
      console.log('📥 Game state received:', data.status);
      dispatch(setGame(data));
      // Extract viewer guesses if game is completed
      if (data.viewerGuesses && data.viewerGuesses.length > 0) {
        setViewerGuesses(data.viewerGuesses);
      }
    };

    // Listen for word selection events
    const onWordSelected = (data: any) => {
      console.log('✅ Word selected:', data);
      dispatch(setGame(data.game || data));
    };

    const onPlayerReady = (data: any) => {
      console.log('✅ Player ready:', data.username);
      // Request fresh game state when a player is ready
      socket.emit('getGame', { roomCode });
    };

    const onGameStarted = (data: any) => {
      console.log('✅ Game started:', data);
      dispatch(setGame(data.game || data));
    };

    const onLetterGuessed = (result: any) => {
      console.log('🎯 Letter guessed:', result.letter, result.isCorrect ? 'HIT' : 'MISS');
      dispatch(setGame(result.game || result));
    };

    const onWordCompleted = (data: any) => {
      console.log('🏆 Word completed:', data);
      // Request fresh game state
      socket.emit('getGame', { roomCode });
    };

    const onGameOver = (results: any) => {
      console.log('🎮 Game over:', results);
      // Request fresh game state
      socket.emit('getGame', { roomCode });
    };

    const onLeftGame = (data: any) => {
      console.log('🚪 Left game:', data);
      navigate('/');
    };

    const onGameEnded = (data: any) => {
      console.log('🛑 Game ended by host:', data);
      dispatch(setGame(data.game || data));
      setToastMessage(`Game ended by ${data.endedBy}`);
    };

    const onPlayerLeft = (data: any) => {
      console.log('👋 Player left:', data);
      if (data.game) {
        dispatch(setGame(data.game));
      }
      setToastMessage(`${data.username} left the game`);
      if (data.gameEnded) {
        setToastMessage(`${data.username} left - Game Over!`);
      }
    };

    const onTurnTimeout = (data: any) => {
      console.log('⏰ Turn timeout:', data);
      dispatch(setGame(data.game));
      setToastMessage(`${data.timedOutPlayerName}'s turn timed out!`);
    };

    const onTurnChanged = (data: any) => {
      console.log('🔄 Turn changed:', data);
      dispatch(setGame(data.game));

      // Show turn change flash notification
      const isMyTurn = data.currentPlayerId === user?.id;
      setTurnChangeFlash({
        isMyTurn,
        playerName: data.currentPlayerName,
      });

      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setTurnChangeFlash(null);
      }, 2000);
    };

    const onBlankSelectionRequired = (data: any) => {
      console.log('🎲 Blank selection required:', data);
      // Only set pending if current user is the target
      if (data.targetPlayerId === user?.id) {
        setBlankSelectionPending({
          positions: data.positions,
          deadline: data.deadline,
          guessingPlayerId: data.guessingPlayerId,
        });
      } else {
        // Other players see a message
        setToastMessage('Waiting for opponent to choose which blank to reveal...');
      }
    };

    const onBlankSelected = (data: any) => {
      console.log('🎯 Blank selected:', data);
      setBlankSelectionPending(null);
      setToastMessage(null); // Clear the "waiting for opponent" toast
      dispatch(setGame(data.game || data));
      if (data.autoSelected) {
        setToastMessage('Blank auto-selected (timeout)');
      }
    };

    const onDuplicateSelectionRequired = (data: any) => {
      console.log('🎲 Duplicate letter selection required:', data);
      // Only set pending if current user is the target
      if (data.targetPlayerId === user?.id) {
        setDuplicateSelectionPending({
          positions: data.positions,
          deadline: data.deadline,
          guessingPlayerId: data.guessingPlayerId,
          letter: data.letter,
        });
      } else {
        // Other players see a message
        setToastMessage(`Waiting for opponent to choose which "${data.letter}" to reveal...`);
      }
    };

    const onDuplicateSelected = (data: any) => {
      console.log('🎯 Duplicate selected:', data);
      setDuplicateSelectionPending(null);
      setToastMessage(null); // Clear the "waiting for opponent" toast
      dispatch(setGame(data.game || data));
      if (data.autoSelected) {
        setToastMessage(`"${data.letter}" auto-selected (timeout)`);
      }
    };

    // Word guess event handlers
    const onWordGuessStarted = (data: any) => {
      console.log('🎲 Word guess started:', data);
      setWordGuessActive({
        guessingPlayerId: data.guessingPlayerId,
        guessingPlayerName: data.guessingPlayerName,
        targetPlayerId: data.targetPlayerId,
        deadline: data.deadline,
      });

      // If current user is the one guessing, show the modal
      if (data.guessingPlayerId === user?.id) {
        setShowWordGuessModal(true);
      } else {
        setToastMessage(`${data.guessingPlayerName} is guessing someone's word...`);
      }
    };

    const onWordGuessResult = (data: any) => {
      console.log('🎯 Word guess result:', data);
      setWordGuessActive(null);
      setShowWordGuessModal(false);
      setWordGuessInput('');
      setToastMessage(null);
      dispatch(setGame(data.game || data));

      // Show result toast
      if (data.isCorrect) {
        setToastMessage(`${data.guessingPlayerName} guessed the word correctly! +${data.pointsChange} pts`);
      } else if (data.timedOut) {
        setToastMessage(`${data.guessingPlayerName}'s word guess timed out! ${data.pointsChange} pts`);
      } else {
        setToastMessage(`${data.guessingPlayerName}'s word guess was wrong! ${data.pointsChange} pts`);
      }
    };

    const onWordGuessCancelled = (data: any) => {
      console.log('❌ Word guess cancelled:', data);
      setWordGuessActive(null);
      setShowWordGuessModal(false);
      setWordGuessInput('');
      setToastMessage(`${data.guessingPlayerName} cancelled their word guess`);
    };

    // Viewer guess result (only shown to the viewer who made the guess)
    const onViewerGuessResult = (data: any) => {
      console.log('👁️ Viewer guess result:', data);
      setMyViewerGuesses(prev => [...prev, {
        targetPlayerId: data.targetPlayerId,
        targetPlayerName: data.targetPlayerName,
        guessedWord: data.guessedWord,
        isCorrect: data.isCorrect,
        submittedAt: new Date(data.submittedAt),
      }]);
      // Show brief feedback toast
      setToastMessage(data.isCorrect
        ? `Your guess for ${data.targetPlayerName}'s word was correct! 🎉`
        : `Your guess for ${data.targetPlayerName}'s word was incorrect.`
      );
    };

    const onError = (err: any) => {
      console.error('❌ Socket error:', err);
      setError(err.message || 'An error occurred');
    };

    socket.on('gameState', onGameState);
    socket.on('wordSelected', onWordSelected);
    socket.on('playerReady', onPlayerReady);
    socket.on('gameStarted', onGameStarted);
    socket.on('letterGuessed', onLetterGuessed);
    socket.on('blankSelectionRequired', onBlankSelectionRequired);
    socket.on('blankSelected', onBlankSelected);
    socket.on('duplicateSelectionRequired', onDuplicateSelectionRequired);
    socket.on('duplicateSelected', onDuplicateSelected);
    socket.on('wordGuessStarted', onWordGuessStarted);
    socket.on('wordGuessResult', onWordGuessResult);
    socket.on('wordGuessCancelled', onWordGuessCancelled);
    socket.on('wordCompleted', onWordCompleted);
    socket.on('gameOver', onGameOver);
    socket.on('leftGame', onLeftGame);
    socket.on('gameEnded', onGameEnded);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('turnTimeout', onTurnTimeout);
    socket.on('turnChanged', onTurnChanged);
    socket.on('viewerGuessResult', onViewerGuessResult);
    socket.on('error', onError);

    // Join room and get current game state when component mounts
    const syncGameState = () => {
      console.log('🔄 Syncing game state for room:', roomCode);
      socket.emit('joinGame', { roomCode });
      socket.emit('getGame', { roomCode });
    };

    if (socket.connected) {
      syncGameState();
    } else {
      socket.once('connect', syncGameState);
    }

    return () => {
      socket.off('gameState', onGameState);
      socket.off('wordSelected', onWordSelected);
      socket.off('playerReady', onPlayerReady);
      socket.off('gameStarted', onGameStarted);
      socket.off('letterGuessed', onLetterGuessed);
      socket.off('blankSelectionRequired', onBlankSelectionRequired);
      socket.off('blankSelected', onBlankSelected);
      socket.off('duplicateSelectionRequired', onDuplicateSelectionRequired);
      socket.off('duplicateSelected', onDuplicateSelected);
      socket.off('wordGuessStarted', onWordGuessStarted);
      socket.off('wordGuessResult', onWordGuessResult);
      socket.off('wordGuessCancelled', onWordGuessCancelled);
      socket.off('wordCompleted', onWordCompleted);
      socket.off('gameOver', onGameOver);
      socket.off('leftGame', onLeftGame);
      socket.off('gameEnded', onGameEnded);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('turnTimeout', onTurnTimeout);
      socket.off('turnChanged', onTurnChanged);
      socket.off('viewerGuessResult', onViewerGuessResult);
      socket.off('error', onError);
      socket.off('connect', syncGameState);
    };
  }, [token, roomCode, dispatch, navigate, user?.id]);

  // Format time remaining for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 handleWordSubmit called');

    const word = selectedWord.trim().toUpperCase();

    if (word.length < 4 || word.length > 12) {
      setError('Word must be 4-12 letters');
      return;
    }

    if (!/^[A-Z]+$/.test(word)) {
      setError('Word must contain only letters');
      return;
    }

    const totalLength = word.length + frontPadding + backPadding;
    if (totalLength > 12) {
      setError('Total length with blanks cannot exceed 12');
      return;
    }

    const socket = socketService.getSocket();
    if (!socket || !socketService.isConnected()) {
      console.error('❌ Cannot submit word - socket not connected');
      setError('Connection lost. Please refresh the page.');
      return;
    }

    console.log('📤 Emitting selectWord event:', { roomCode, word, frontPadding, backPadding });
    socket.emit('selectWord', { roomCode, word, frontPadding, backPadding });
    setError('');
  };

  const handleLetterGuess = (letter: string) => {
    if (!selectedTarget) {
      setError('Please select a player first');
      return;
    }

    socketService.emit('guessLetter', {
      roomCode,
      targetPlayerId: selectedTarget,
      letter,
    });
  };

  // Word selection phase
  if (game.status === 'WORD_SELECTION') {
    const myPlayer = game.players.find(p => p.userId === user?.id);
    
    if (myPlayer?.hasSelectedWord) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">Word Selected!</h2>
            <p className="text-text-secondary mb-6">
              Waiting for other players to choose their words...
            </p>
            <div className="space-y-2 mb-6">
              {[...game.players].sort((a, b) => a.turnOrder - b.turnOrder).map(p => (
                <div key={p.userId} className="flex justify-between items-center p-3 bg-primary-bg rounded">
                  <span>{p.displayName}</span>
                  <span className={p.hasSelectedWord ? 'text-success' : 'text-text-muted'}>
                    {p.hasSelectedWord ? '✓' : '...'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2">
              <button
                onClick={handleLeaveGame}
                className="px-4 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors text-sm font-semibold"
              >
                🚪 Leave Game
              </button>
              {game.hostId === user?.id && (
                <button
                  onClick={handleEndGame}
                  className="px-4 py-2 bg-orange-600/20 text-orange-400 rounded hover:bg-orange-600/30 transition-colors text-sm font-semibold"
                >
                  🛑 End Game
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    const totalLength = selectedWord.length + frontPadding + backPadding;
    const maxPadding = 12 - selectedWord.length;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4">Choose Your Secret Word</h2>
          <p className="text-text-secondary mb-6">
            Select a word between 4-12 letters. Add blanks to hide word position!
          </p>

          <form onSubmit={handleWordSubmit} className="space-y-4">
            <input
              type="text"
              value={selectedWord}
              onChange={(e) => setSelectedWord(e.target.value.toUpperCase())}
              className="input-field text-center text-2xl tracking-wider"
              placeholder="ENTER WORD"
              maxLength={12}
              autoFocus
            />

            {/* Padding preview */}
            {selectedWord.length >= 4 && (
              <div className="bg-primary-bg p-3 rounded-lg">
                <p className="text-sm text-text-muted mb-2 text-center">Preview:</p>
                <div className="flex justify-center gap-1">
                  {Array.from({ length: frontPadding }).map((_, i) => (
                    <div key={`front-${i}`} className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-gray-400 text-lg">
                      {'\u2022'}
                    </div>
                  ))}
                  {selectedWord.split('').map((letter, i) => (
                    <div key={`letter-${i}`} className="w-8 h-8 bg-accent rounded flex items-center justify-center text-white font-bold">
                      {letter}
                    </div>
                  ))}
                  {Array.from({ length: backPadding }).map((_, i) => (
                    <div key={`back-${i}`} className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-gray-400 text-lg">
                      {'\u2022'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blanks controls */}
            {selectedWord.length >= 4 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Front Blanks</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFrontPadding(Math.max(0, frontPadding - 1))}
                      className="w-8 h-8 bg-secondary-bg rounded hover:bg-accent transition-colors"
                      disabled={frontPadding === 0}
                    >-</button>
                    <span className="w-8 text-center">{frontPadding}</span>
                    <button
                      type="button"
                      onClick={() => setFrontPadding(Math.min(maxPadding - backPadding, frontPadding + 1))}
                      className="w-8 h-8 bg-secondary-bg rounded hover:bg-accent transition-colors"
                      disabled={totalLength >= 12}
                    >+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Back Blanks</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBackPadding(Math.max(0, backPadding - 1))}
                      className="w-8 h-8 bg-secondary-bg rounded hover:bg-accent transition-colors"
                      disabled={backPadding === 0}
                    >-</button>
                    <span className="w-8 text-center">{backPadding}</span>
                    <button
                      type="button"
                      onClick={() => setBackPadding(Math.min(maxPadding - frontPadding, backPadding + 1))}
                      className="w-8 h-8 bg-secondary-bg rounded hover:bg-accent transition-colors"
                      disabled={totalLength >= 12}
                    >+</button>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-text-muted text-center">
              {selectedWord.length} letters + {frontPadding + backPadding} blanks = {totalLength} / 12 total
              {selectedWord.length > 0 && selectedWord.length < 4 && (
                <span className="text-warning ml-2">(minimum 4 letters)</span>
              )}
            </div>

            {error && (
              <div className="bg-error/20 border border-error text-error px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={selectedWord.length < 4}
              className="btn-primary w-full"
            >
              Submit Word
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Game completed phase
  if (game.status === 'COMPLETED') {
    const sortedPlayers = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
    const winner = sortedPlayers[0];

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card w-full max-w-md text-center">
          <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-2xl font-bold text-accent mb-2">{winner?.displayName}</p>
          <p className="text-text-secondary mb-6">wins with {winner?.totalScore} points!</p>

          <div className="space-y-2 mb-6">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.userId}
                className={`flex justify-between items-center p-3 rounded ${
                  index === 0 ? 'bg-accent/20 border border-accent' : 'bg-primary-bg'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-accent text-white' : 'bg-secondary-bg'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-semibold">
                    {player.displayName}
                    {player.userId === user?.id && ' (You)'}
                  </span>
                </div>
                <span className="text-xl font-bold">{player.totalScore} pts</span>
              </div>
            ))}
          </div>

          {/* Viewer guesses section */}
          {viewerGuesses.length > 0 && (
            <div className="mb-6 text-left">
              <h3 className="font-bold mb-3 text-center">👁️ Viewer Guesses</h3>
              <div className="space-y-2">
                {viewerGuesses.map((guess, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      guess.isCorrect ? 'bg-green-600/20' : 'bg-red-600/20'
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{guess.viewerName}</span>
                      <span className="text-text-muted"> guessed </span>
                      <span className="font-mono">{guess.guessedWord}</span>
                      <span className="text-text-muted"> for {guess.targetPlayerName}</span>
                    </div>
                    <div className="text-right">
                      <span className={guess.isCorrect ? 'text-green-400' : 'text-red-400'}>
                        {guess.isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="text-xs text-text-muted">
                        {new Date(guess.submittedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn-primary flex-1"
            >
              Back to Home
            </button>
            <button
              onClick={() => navigate(`/history/${roomCode}`)}
              className="btn-secondary flex-1"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active game phase
  // Only mark as observer if game data has actually loaded (has players)
  // and user is confirmed not in the players list
  const gameLoaded = game.players.length > 0 && game.id !== null;
  const isObserver = gameLoaded && !game.players.some(p => p.userId === user?.id);
  const myTurn = !isObserver && game.currentTurnPlayerId === user?.id;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Determine timer urgency color
  const getTimerColor = () => {
    if (timeRemaining === null) return 'text-text-muted';
    if (timeRemaining <= 10) return 'text-error animate-pulse';
    if (timeRemaining <= 30) return 'text-warning';
    return 'text-text-secondary';
  };

  return (
    <div className="min-h-screen p-4">
      {/* Observer banner */}
      {isObserver && (
        <div className="fixed top-0 left-0 right-0 bg-green-600 text-white py-2 px-4 text-center z-50 flex items-center justify-center gap-3">
          <span className="text-lg">👁️</span>
          <span className="font-semibold">Observer Mode</span>
          <span className="text-sm opacity-80">You're watching this game</span>
          <button
            onClick={() => navigate('/')}
            className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
          >
            Leave
          </button>
        </div>
      )}

      {/* Toast notification for timeouts */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Turn change flash notification */}
      {turnChangeFlash && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-pulse ${
          turnChangeFlash.isMyTurn
            ? 'bg-green-500/30'
            : 'bg-blue-500/20'
        }`}>
          <div className={`text-center p-8 rounded-2xl ${
            turnChangeFlash.isMyTurn
              ? 'bg-green-600/90 text-white shadow-2xl shadow-green-500/50 scale-110'
              : 'bg-secondary-bg/95 text-white shadow-xl'
          }`}>
            <p className="text-5xl mb-4">{turnChangeFlash.isMyTurn ? '🎯' : '⏳'}</p>
            <p className="text-3xl font-bold mb-2">
              {turnChangeFlash.isMyTurn ? "YOUR TURN!" : `${turnChangeFlash.playerName}'s Turn`}
            </p>
            {turnChangeFlash.isMyTurn && (
              <p className="text-lg opacity-90">Make your move!</p>
            )}
          </div>
        </div>
      )}

      {/* Blank selection modal */}
      {blankSelectionPending && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-2">Choose a Blank to Reveal</h2>
            <p className="text-text-secondary mb-4">
              Someone guessed BLANK! Select which position to reveal.
            </p>

            {/* Countdown timer */}
            <div className={`text-3xl font-mono font-bold mb-4 ${
              blankSelectionTimeRemaining <= 10 ? 'text-error animate-pulse' :
              blankSelectionTimeRemaining <= 20 ? 'text-warning' : 'text-accent'
            }`}>
              {blankSelectionTimeRemaining}s
            </div>
            <p className="text-sm text-text-muted mb-4">
              (Rightmost blank will be auto-selected on timeout)
            </p>

            {/* Word display with clickable blanks */}
            <div className="flex flex-wrap justify-center gap-1 mb-4">
              {game.players
                .find(p => p.userId === user?.id)
                ?.revealedPositions.map((letter, i) => {
                  const isClickableBlank = blankSelectionPending.positions.includes(i);
                  const isBlank = letter === 'BLANK';

                  return (
                    <button
                      key={i}
                      onClick={() => isClickableBlank && handleBlankPositionSelect(i)}
                      disabled={!isClickableBlank}
                      className={`w-10 h-10 rounded flex items-center justify-center font-bold text-lg transition-all ${
                        isClickableBlank
                          ? 'bg-warning text-black cursor-pointer hover:bg-yellow-400 hover:scale-110 ring-2 ring-warning animate-pulse'
                          : letter
                            ? isBlank
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-accent text-white cursor-not-allowed'
                            : 'bg-secondary-bg text-text-muted cursor-not-allowed'
                      }`}
                    >
                      {isClickableBlank ? '?' : letter ? (isBlank ? '•' : letter) : '?'}
                    </button>
                  );
                })}
            </div>

            <p className="text-sm text-text-muted">
              Click on a yellow position to reveal that blank
            </p>
          </div>
        </div>
      )}

      {/* Duplicate letter selection modal */}
      {duplicateSelectionPending && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-2">Choose a "{duplicateSelectionPending.letter}" to Reveal</h2>
            <p className="text-text-secondary mb-4">
              Someone guessed "{duplicateSelectionPending.letter}"! Select which position to reveal.
            </p>

            {/* Countdown timer */}
            <div className={`text-3xl font-mono font-bold mb-4 ${
              duplicateSelectionTimeRemaining <= 10 ? 'text-error animate-pulse' :
              duplicateSelectionTimeRemaining <= 20 ? 'text-warning' : 'text-accent'
            }`}>
              {duplicateSelectionTimeRemaining}s
            </div>
            <p className="text-sm text-text-muted mb-4">
              (Rightmost position will be auto-selected on timeout)
            </p>

            {/* Word display with clickable duplicate positions */}
            <div className="flex flex-wrap justify-center gap-1 mb-4">
              {game.players
                .find(p => p.userId === user?.id)
                ?.revealedPositions.map((letter, i) => {
                  const isClickableDuplicate = duplicateSelectionPending.positions.includes(i);
                  const isBlank = letter === 'BLANK';

                  return (
                    <button
                      key={i}
                      onClick={() => isClickableDuplicate && handleDuplicatePositionSelect(i)}
                      disabled={!isClickableDuplicate}
                      className={`w-10 h-10 rounded flex items-center justify-center font-bold text-lg transition-all ${
                        isClickableDuplicate
                          ? 'bg-warning text-black cursor-pointer hover:bg-yellow-400 hover:scale-110 ring-2 ring-warning animate-pulse'
                          : letter
                            ? isBlank
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-accent text-white cursor-not-allowed'
                            : 'bg-secondary-bg text-text-muted cursor-not-allowed'
                      }`}
                    >
                      {isClickableDuplicate ? duplicateSelectionPending.letter : letter ? (isBlank ? '•' : letter) : '?'}
                    </button>
                  );
                })}
            </div>

            <p className="text-sm text-text-muted">
              Click on a yellow position to reveal that "{duplicateSelectionPending.letter}"
            </p>
          </div>
        </div>
      )}

      {/* Word guess modal */}
      {showWordGuessModal && wordGuessActive && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-2">🎯 Guess the Word!</h2>
            <p className="text-text-secondary mb-4">
              Type the word you think {game.players.find(p => p.userId === wordGuessActive.targetPlayerId)?.displayName} has chosen.
            </p>

            {/* Countdown timer */}
            <div className={`text-4xl font-mono font-bold mb-4 ${
              wordGuessTimeRemaining <= 10 ? 'text-error animate-pulse' :
              wordGuessTimeRemaining <= 20 ? 'text-warning' : 'text-purple-400'
            }`}>
              {wordGuessTimeRemaining}s
            </div>

            {/* Scoring info */}
            <div className="bg-primary-bg p-3 rounded-lg mb-4 text-sm">
              <p className="text-green-400">✓ Correct (5+ unrevealed): +100 pts</p>
              <p className="text-green-300">✓ Correct (&lt;5 unrevealed): +50 pts</p>
              <p className="text-red-400">✗ Wrong or timeout: -50 pts</p>
            </div>

            {/* Word input */}
            <input
              type="text"
              value={wordGuessInput}
              onChange={(e) => setWordGuessInput(e.target.value.toUpperCase())}
              className="input-field text-center text-2xl tracking-wider mb-4"
              placeholder="ENTER WORD"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && wordGuessInput.trim()) {
                  handleSubmitWordGuess();
                }
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={handleCancelWordGuess}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitWordGuess}
                disabled={!wordGuessInput.trim()}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded transition-colors"
              >
                Submit Guess
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Someone else is guessing - show overlay */}
      {wordGuessActive && wordGuessActive.guessingPlayerId !== user?.id && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">🎯 Word Guess in Progress</h2>
            <p className="text-text-secondary mb-4">
              {wordGuessActive.guessingPlayerName} is guessing {game.players.find(p => p.userId === wordGuessActive.targetPlayerId)?.displayName}'s word...
            </p>
            <div className={`text-3xl font-mono font-bold ${
              wordGuessTimeRemaining <= 10 ? 'text-error animate-pulse' :
              wordGuessTimeRemaining <= 20 ? 'text-warning' : 'text-purple-400'
            }`}>
              {wordGuessTimeRemaining}s remaining
            </div>
          </div>
        </div>
      )}

      {/* Viewer guess modal */}
      {viewerGuessTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-2">👁️ Viewer Guess</h2>
            <p className="text-text-secondary mb-4">
              Guess {game.players.find(p => p.userId === viewerGuessTarget)?.displayName}'s word
            </p>

            <input
              type="text"
              value={viewerGuessInput}
              onChange={(e) => setViewerGuessInput(e.target.value.toUpperCase())}
              placeholder="Enter your guess"
              className="w-full px-4 py-3 bg-primary-bg border border-tile-border rounded-lg text-center text-xl font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleViewerGuessSubmit()}
            />

            <p className="text-sm text-text-muted mb-4">
              Your guess will be hidden from players until the game ends.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setViewerGuessTarget(null)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleViewerGuessSubmit}
                disabled={!viewerGuessInput.trim()}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold rounded transition-colors"
              >
                Submit Guess
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-6xl mx-auto ${isObserver ? 'pt-12' : ''}`}>
        {/* Header */}
        <div className="bg-secondary-bg rounded-xl p-4 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-yellow-400">P</span>
              <span className="text-blue-400">R</span>
              <span className="text-green-400">O</span>
              <span className="text-red-400">B</span>
              <span className="text-purple-400">E</span>
            </h1>
            <p className="text-sm text-text-muted">Game: {roomCode}</p>
          </div>

          {/* Timer display */}
          {timeRemaining !== null && (
            <div className="text-center">
              <p className="text-sm text-text-muted">Time Left</p>
              <p className={`text-3xl font-mono font-bold ${getTimerColor()}`}>
                {formatTime(timeRemaining)}
              </p>
            </div>
          )}

          <div className="text-right">
            <p className="text-sm text-text-muted">Round {game.roundNumber}</p>
            <p className="text-lg font-semibold">
              {myTurn ? "Your Turn" : "Waiting..."}
            </p>
          </div>
        </div>

        {/* Game controls */}
        {!isObserver && game.status === 'ACTIVE' && (
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={handleLeaveGame}
              className="px-4 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors text-sm font-semibold"
            >
              🚪 Leave Game
            </button>
            {game.hostId === user?.id && (
              <button
                onClick={handleEndGame}
                className="px-4 py-2 bg-orange-600/20 text-orange-400 rounded hover:bg-orange-600/30 transition-colors text-sm font-semibold"
              >
                🛑 End Game
              </button>
            )}
          </div>
        )}

        {/* Player boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {[...game.players].sort((a, b) => a.turnOrder - b.turnOrder).map((player) => {
            const isMe = player.userId === user?.id;
            const isTarget = selectedTarget === player.userId;
            const isActive = game.currentTurnPlayerId === player.userId;

            return (
              <div
                key={player.userId}
                onClick={() => !isMe && !player.isEliminated && myTurn && setSelectedTarget(player.userId)}
                className={`card cursor-pointer transition-all ${
                  isTarget ? 'ring-4 ring-warning' : ''
                } ${isActive && !isTarget ? 'ring-2 ring-green-500' : ''} ${
                  player.isEliminated ? 'opacity-50' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold">{player.displayName} {isMe && '(You)'}</p>
                    {player.isEliminated && (
                      <span className="text-xs text-player-eliminated">Eliminated</span>
                    )}
                    {/* Show secret word toggle for own player */}
                    {isMe && player.mySecretWord && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMyWord(!showMyWord);
                        }}
                        className="text-xs text-accent hover:text-accent/80 underline ml-2"
                      >
                        {showMyWord ? 'Hide' : 'Show'} my word
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-accent">{player.totalScore}</p>
                </div>

                {/* Display own secret word when toggled */}
                {isMe && showMyWord && player.mySecretWord && (
                  <div className="mb-3 p-2 bg-accent/20 rounded text-center">
                    <span className="text-sm text-text-muted">Your word: </span>
                    <span className="font-bold text-accent tracking-wider">{player.mySecretWord}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {player.revealedPositions.map((letter, i) => {
                    const isBlank = letter === 'BLANK';
                    // Calculate point value: 5, 10, 15 repeating pattern
                    const pointValues = [5, 10, 15];
                    const pointValue = pointValues[i % 3];

                    return (
                      <div key={i} className="flex flex-col items-center">
                        <div
                          className={
                            letter
                              ? isBlank
                                ? 'letter-tile-revealed bg-gray-600 text-gray-400'
                                : 'letter-tile-revealed'
                              : 'letter-tile-concealed'
                          }
                        >
                          {letter ? (isBlank ? '\u2022' : letter) : '?'}
                        </div>
                        {/* Show point value for unrevealed positions */}
                        {!letter && (
                          <span className="text-xs text-text-muted mt-0.5">{pointValue}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Missed letters display */}
                {player.missedLetters && player.missedLetters.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-red-400">Missed: </span>
                    <span className="text-red-300 font-mono">
                      {[...player.missedLetters].sort().join(', ')}
                    </span>
                  </div>
                )}

                {/* Guess Now button - only for other players who aren't eliminated (not for observers) */}
                {!isObserver && !isMe && !player.isEliminated && !wordGuessActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInitiateWordGuess(player.userId);
                    }}
                    className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded transition-colors text-sm"
                  >
                    🎯 Guess Word!
                  </button>
                )}

                {/* Viewer Guess button - only for observers */}
                {isObserver && !player.isEliminated && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewerGuessTarget(player.userId);
                    }}
                    className="mt-3 w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition-colors text-sm"
                  >
                    👁️ Guess Word
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Letter selector */}
        {myTurn && (
          <div className="card">
            <p className="text-center mb-3 font-semibold">
              {selectedTarget ? 'Select a letter to guess' : 'Select a player first'}
            </p>
            <div className="grid grid-cols-9 md:grid-cols-13 gap-2">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleLetterGuess(letter)}
                  disabled={!selectedTarget}
                  className="aspect-square bg-secondary-bg hover:bg-accent text-white font-bold rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {letter}
                </button>
              ))}
              {/* BLANK button for guessing blanks */}
              <button
                onClick={() => handleLetterGuess('BLANK')}
                disabled={!selectedTarget}
                className="col-span-2 aspect-[2/1] bg-gray-600 hover:bg-gray-500 text-gray-300 font-bold rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                BLANK
              </button>
            </div>
          </div>
        )}

        {/* Observer's guesses section */}
        {isObserver && myViewerGuesses.length > 0 && (
          <div className="card mt-4">
            <h3 className="font-bold mb-3">👁️ Your Guesses</h3>
            <div className="space-y-2">
              {myViewerGuesses.map((guess, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded ${
                    guess.isCorrect ? 'bg-green-600/20' : 'bg-red-600/20'
                  }`}
                >
                  <div>
                    <span className="font-mono">{guess.guessedWord}</span>
                    <span className="text-text-muted ml-2">for {guess.targetPlayerName}</span>
                  </div>
                  <span className={guess.isCorrect ? 'text-green-400' : 'text-red-400'}>
                    {guess.isCorrect ? '✓ Correct' : '✗ Wrong'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-2">
              These will be revealed to all players when the game ends.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-error/20 border border-error text-error px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
