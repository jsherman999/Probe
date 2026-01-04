import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setGame } from '../store/slices/gameSlice';
import socketService from '../services/socket';

// Timer preset options
const TIMER_PRESETS = [
  { label: '30 sec', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const game = useAppSelector((state) => state.game);
  const [error, setError] = useState('');
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customSeconds, setCustomSeconds] = useState(0);

  useEffect(() => {
    if (!token || !user) return;

    const socket = socketService.connect(token);

    // Listen for events BEFORE joining
    const onGameState = (game: any) => {
      console.log('📥 Received game state:', game.status);
      dispatch(setGame(game));

      // If game is already in progress, redirect to game page
      if (game.status === 'WORD_SELECTION' || game.status === 'ACTIVE') {
        console.log('🎮 Game already in progress, redirecting to game page');
        navigate(`/game/${roomCode}`);
      }
    };

    const onPlayerJoined = (data: any) => {
      console.log('📥 Player joined:', data);
      dispatch(setGame(data.game));
    };

    const onPlayerLeft = (data: any) => {
      console.log('📥 Player left:', data);
      // Request fresh game state
      socket.emit('getGame', { roomCode });
    };

    const onWordSelectionPhase = (data: any) => {
      console.log('📥 Word selection phase:', data);
      dispatch(setGame(data));
      navigate(`/game/${roomCode}`);
    };

    const onGameStarted = (data: any) => {
      console.log('📥 Game started:', data);
      dispatch(setGame(data));
      navigate(`/game/${roomCode}`);
    };

    const onError = (err: any) => {
      console.error('❌ Socket error:', err);
      setError(err.message);
    };

    const onTimerSettingsUpdated = (data: any) => {
      console.log('📥 Timer settings updated:', data.turnTimerSeconds);
      dispatch(setGame(data.game));
    };

    socket.on('gameState', onGameState);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('wordSelectionPhase', onWordSelectionPhase);
    socket.on('gameStarted', onGameStarted);
    socket.on('timerSettingsUpdated', onTimerSettingsUpdated);
    socket.on('error', onError);

    // Function to join game when connected
    const joinWhenConnected = () => {
      console.log('📤 Joining game:', roomCode);
      socket.emit('joinGame', { roomCode });
      socket.emit('getGame', { roomCode });
    };

    // Wait for connection before joining
    if (socket.connected) {
      joinWhenConnected();
    } else {
      console.log('⏳ Waiting for socket connection...');
      socket.once('connect', joinWhenConnected);
    }

    return () => {
      socket.off('gameState', onGameState);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('wordSelectionPhase', onWordSelectionPhase);
      socket.off('gameStarted', onGameStarted);
      socket.off('timerSettingsUpdated', onTimerSettingsUpdated);
      socket.off('error', onError);
      socket.off('connect', joinWhenConnected);
    };
  }, [roomCode, token, user, dispatch, navigate]);

  const handleStartGame = () => {
    const socket = socketService.getSocket();

    if (!socket || !socketService.isConnected()) {
      console.error('❌ Cannot start game - socket not connected');
      setError('Connection lost. Please refresh the page.');
      return;
    }

    console.log('🎮 Emitting startGame event for room:', roomCode);
    socket.emit('startGame', { roomCode });
  };

  const handleLeave = () => {
    socketService.emit('leaveGame', { roomCode });
    navigate('/');
  };

  const handleTimerChange = (seconds: number) => {
    const socket = socketService.getSocket();
    if (!socket || !socketService.isConnected()) return;

    socket.emit('updateTimerSettings', { roomCode, turnTimerSeconds: seconds });
  };

  const handleCustomTimerChange = () => {
    const totalSeconds = customMinutes * 60 + customSeconds;
    if (totalSeconds >= 10 && totalSeconds <= 1800) {
      handleTimerChange(totalSeconds);
    }
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const isHost = game.hostId === user?.id;
  const playerCount = game.players.length;
  const canStart = isHost && playerCount >= 2;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Game Lobby</h1>
            <p className="text-text-secondary">Game Code: <span className="text-accent font-mono text-2xl">{roomCode}</span></p>
          </div>
          <button onClick={handleLeave} className="btn-secondary">
            Leave
          </button>
        </div>

        {error && (
          <div className="bg-error/20 border border-error text-error px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Players ({playerCount}/4)
          </h2>
          <div className="space-y-2">
            {game.players.map((player) => (
              <div
                key={player.userId}
                className="flex items-center justify-between bg-primary-bg p-4 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold">
                    {player.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{player.displayName}</p>
                    {player.userId === game.hostId && (
                      <span className="text-sm text-warning">Host</span>
                    )}
                  </div>
                </div>
                {game.status === 'WORD_SELECTION' && player.hasSelectedWord && (
                  <span className="text-success font-semibold">✓ Ready</span>
                )}
              </div>
            ))}
            {playerCount < 4 && Array.from({ length: 4 - playerCount }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-primary-bg/30 p-4 rounded-lg border-2 border-dashed border-tile-border">
                <p className="text-text-muted text-center">Waiting for player...</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timer Configuration (host only, in WAITING state) */}
        {game.status === 'WAITING' && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Turn Timer</h2>
            <p className="text-text-muted text-sm mb-3">
              Current: <span className="text-accent font-semibold">{formatTimer(game.turnTimerSeconds)}</span>
              {!isHost && ' (Only host can change)'}
            </p>

            {isHost && (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {TIMER_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleTimerChange(preset.value)}
                      className={`px-4 py-2 rounded transition-colors ${
                        game.turnTimerSeconds === preset.value
                          ? 'bg-accent text-white'
                          : 'bg-primary-bg hover:bg-accent/50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">Custom:</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                    className="w-16 px-2 py-1 bg-primary-bg rounded text-center"
                  />
                  <span className="text-sm">min</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customSeconds}
                    onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-16 px-2 py-1 bg-primary-bg rounded text-center"
                  />
                  <span className="text-sm">sec</span>
                  <button
                    onClick={handleCustomTimerChange}
                    className="px-3 py-1 bg-secondary-bg hover:bg-accent rounded text-sm transition-colors"
                  >
                    Set
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-2">Min: 10 seconds, Max: 30 minutes</p>
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          {game.status === 'WAITING' && (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="btn-primary w-full"
            >
              {canStart ? 'Start Game' : isHost ? 'Need at least 2 players' : 'Waiting for host...'}
            </button>
          )}

          {game.status === 'WORD_SELECTION' && (
            <div className="bg-accent/20 border border-accent p-4 rounded-lg">
              <p className="text-center font-semibold">
                Waiting for all players to select their words...
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-tile-border">
          <p className="text-sm text-text-muted text-center">
            Share the game code with your friends to play together!
          </p>
        </div>
      </div>
    </div>
  );
}
