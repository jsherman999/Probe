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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

    const onTurnTimeout = (data: any) => {
      console.log('⏰ Turn timeout:', data);
      dispatch(setGame(data.game));
      setToastMessage(`${data.timedOutPlayerName}'s turn timed out!`);
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
    socket.on('wordCompleted', onWordCompleted);
    socket.on('gameOver', onGameOver);
    socket.on('turnTimeout', onTurnTimeout);
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
      socket.off('wordCompleted', onWordCompleted);
      socket.off('gameOver', onGameOver);
      socket.off('turnTimeout', onTurnTimeout);
      socket.off('error', onError);
      socket.off('connect', syncGameState);
    };
  }, [token, roomCode, dispatch, navigate]);

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
      setError('Total length with padding cannot exceed 12');
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
            <div className="space-y-2">
              {game.players.map(p => (
                <div key={p.userId} className="flex justify-between items-center p-3 bg-primary-bg rounded">
                  <span>{p.displayName}</span>
                  <span className={p.hasSelectedWord ? 'text-success' : 'text-text-muted'}>
                    {p.hasSelectedWord ? '✓' : '...'}
                  </span>
                </div>
              ))}
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
            Select a word between 4-12 letters. Add padding to hide word position!
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

            {/* Padding controls */}
            {selectedWord.length >= 4 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Front Padding</label>
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
                  <label className="block text-sm font-medium mb-1">Back Padding</label>
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
              {selectedWord.length} letters + {frontPadding + backPadding} padding = {totalLength} / 12 total
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
  const myTurn = game.currentTurnPlayerId === user?.id;
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
      {/* Toast notification for timeouts */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-secondary-bg rounded-xl p-4 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">PROBE</h1>
            <p className="text-sm text-text-muted">Room: {roomCode}</p>
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

        {/* Player boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {game.players.map((player) => {
            const isMe = player.userId === user?.id;
            const isTarget = selectedTarget === player.userId;
            const isActive = game.currentTurnPlayerId === player.userId;

            return (
              <div
                key={player.userId}
                onClick={() => !isMe && !player.isEliminated && myTurn && setSelectedTarget(player.userId)}
                className={`card cursor-pointer transition-all ${
                  isTarget ? 'ring-4 ring-warning' : ''
                } ${isActive ? 'ring-2 ring-player-active' : ''} ${
                  player.isEliminated ? 'opacity-50' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold">{player.displayName} {isMe && '(You)'}</p>
                    {player.isEliminated && (
                      <span className="text-xs text-player-eliminated">Eliminated</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-accent">{player.totalScore}</p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {player.revealedPositions.map((letter, i) => {
                    const isBlank = letter === 'BLANK';
                    return (
                      <div
                        key={i}
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
                    );
                  })}
                </div>

                {/* Missed letters display */}
                {player.missedLetters && player.missedLetters.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-red-400">Missed: </span>
                    <span className="text-red-300 font-mono">
                      {player.missedLetters.sort().join(', ')}
                    </span>
                  </div>
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
              {/* BLANK button for guessing padding */}
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

        {error && (
          <div className="mt-4 bg-error/20 border border-error text-error px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
