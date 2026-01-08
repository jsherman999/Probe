import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { logout } from '../store/slices/authSlice';
import socketService from '../services/socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface LobbyGame {
  roomCode: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: string;
}

interface RunningGame {
  roomCode: string;
  status: string;
  hostName: string;
  playerCount: number;
  playerNames: string[];
  startedAt: string;
}

export default function Home() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lobbyGames, setLobbyGames] = useState<LobbyGame[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(true);
  const [runningGames, setRunningGames] = useState<RunningGame[]>([]);
  const [runningLoading, setRunningLoading] = useState(true);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    socketService.disconnect();
    dispatch(logout());
    navigate('/');
  };

  // Ref to prevent multiple emissions in React StrictMode
  const isCreatingGame = useRef(false);

  // Fetch lobby games and set up real-time updates
  useEffect(() => {
    if (!token) return;

    // Connect socket
    socketService.connect(token);

    // Fetch initial lobby games
    const fetchLobbyGames = async () => {
      try {
        const response = await fetch(`${API_URL}/game/lobby/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const games = await response.json();
          setLobbyGames(games);
        }
      } catch (err) {
        console.error('Error fetching lobby games:', err);
      } finally {
        setLobbyLoading(false);
      }
    };

    // Fetch running games
    const fetchRunningGames = async () => {
      try {
        const response = await fetch(`${API_URL}/game/running/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const games = await response.json();
          setRunningGames(games);
        }
      } catch (err) {
        console.error('Error fetching running games:', err);
      } finally {
        setRunningLoading(false);
      }
    };

    fetchLobbyGames();
    fetchRunningGames();

    // Refresh running games periodically
    const runningInterval = setInterval(fetchRunningGames, 10000);

    // Real-time lobby updates
    const handleGameCreated = (game: LobbyGame) => {
      setLobbyGames(prev => [game, ...prev]);
    };

    const handleGameUpdated = (data: { roomCode: string; playerCount: number }) => {
      setLobbyGames(prev =>
        prev.map(g =>
          g.roomCode === data.roomCode ? { ...g, playerCount: data.playerCount } : g
        )
      );
    };

    const handleGameRemoved = (data: { roomCode: string }) => {
      setLobbyGames(prev => prev.filter(g => g.roomCode !== data.roomCode));
    };

    socketService.on('lobbyGameCreated', handleGameCreated);
    socketService.on('lobbyGameUpdated', handleGameUpdated);
    socketService.on('lobbyGameRemoved', handleGameRemoved);

    return () => {
      socketService.off('lobbyGameCreated', handleGameCreated);
      socketService.off('lobbyGameUpdated', handleGameUpdated);
      socketService.off('lobbyGameRemoved', handleGameRemoved);
      clearInterval(runningInterval);
    };
  }, [token]);

  const handleCreateGame = () => {
    // Prevent multiple emissions
    if (isCreatingGame.current) {
      console.log('⚠️ Already creating game, ignoring duplicate call');
      return;
    }

    isCreatingGame.current = true;
    setLoading(true);
    setError('');

    const socket = socketService.connect(token!);

    // Set up listeners before emitting
    const onGameCreated = (game: any) => {
      console.log('✅ Game created:', game);
      isCreatingGame.current = false;
      setLoading(false);
      socketService.off('gameCreated', onGameCreated);
      socketService.off('error', onError);
      navigate(`/lobby/${game.roomCode}`);
    };

    const onError = (err: any) => {
      console.error('❌ Error creating game:', err);
      setError(err.message);
      isCreatingGame.current = false;
      setLoading(false);
      socketService.off('gameCreated', onGameCreated);
      socketService.off('error', onError);
    };

    // Use socketService.on() to ensure handlers are tracked
    socketService.on('gameCreated', onGameCreated);
    socketService.on('error', onError);

    // Wait for connection if needed
    if (socket.connected) {
      console.log('📤 Socket connected, emitting createGame');
      socket.emit('createGame');
    } else {
      console.log('⏳ Waiting for socket connection...');
      socket.once('connect', () => {
        // Double-check we haven't already created a game
        if (!isCreatingGame.current) {
          console.log('⚠️ Game creation was cancelled');
          return;
        }
        console.log('📤 Socket connected, emitting createGame');
        socket.emit('createGame');
      });
    }
  };

  const handleJoinLobbyGame = (code: string) => {
    navigate(`/lobby/${code}`);
  };

  const handleRemoveGame = async (roomCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove Game ${roomCode}?`)) return;

    try {
      const response = await fetch(`${API_URL}/game/lobby/${roomCode}?force=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        // Update will come via socket, but also update locally for responsiveness
        setLobbyGames(prev => prev.filter(g => g.roomCode !== roomCode));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove game');
      }
    } catch (err) {
      console.error('Error removing game:', err);
      setError('Failed to remove game');
    }
  };

  const handleCleanupAllGames = async () => {
    if (!confirm('This will remove ALL Games. Are you sure?')) return;

    try {
      const response = await fetch(`${API_URL}/game/cleanup?forceAll=true`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLobbyGames([]);
        setRunningGames([]);
        alert(`Cleaned up ${data.removed} games`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to cleanup games');
      }
    } catch (err) {
      console.error('Error cleaning up games:', err);
      setError('Failed to cleanup games');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="card text-center">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-yellow-400">P</span>
            <span className="text-blue-400">R</span>
            <span className="text-green-400">O</span>
            <span className="text-red-400">B</span>
            <span className="text-purple-400">E</span>
          </h1>
          <p className="text-text-secondary mb-3">Welcome, {user?.displayName}!</p>
          <button
            onClick={handleLogout}
            className="text-sm text-text-muted hover:text-error transition-colors"
          >
            Switch Player / Logout
          </button>
        </div>

        <div className="card space-y-4">
          <button
            onClick={handleCreateGame}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Creating...' : 'Create New Game'}
          </button>

          {error && (
            <div className="bg-error/20 border border-error text-error px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Games Waiting for Players */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Games Waiting for Players</h2>
          {lobbyLoading ? (
            <p className="text-text-muted text-center py-4">Loading games...</p>
          ) : lobbyGames.length === 0 ? (
            <p className="text-text-muted text-center py-4">
              No games waiting. Create one!
            </p>
          ) : (
            <div className="space-y-2">
              {lobbyGames.map(game => (
                <div
                  key={game.roomCode}
                  className="flex items-center justify-between p-3 bg-primary-bg rounded-lg hover:bg-tile-bg transition-colors cursor-pointer"
                  onClick={() => handleJoinLobbyGame(game.roomCode)}
                >
                  <div>
                    <div className="font-semibold">{game.hostName}'s Game</div>
                    <div className="text-sm text-text-muted">{game.roomCode}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm">
                        <span className={game.playerCount >= game.maxPlayers ? 'text-error' : 'text-accent'}>
                          {game.playerCount}
                        </span>
                        /{game.maxPlayers} players
                      </div>
                      <button
                        className="text-xs text-accent hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinLobbyGame(game.roomCode);
                        }}
                      >
                        Join
                      </button>
                    </div>
                    <button
                      onClick={(e) => handleRemoveGame(game.roomCode, e)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 rounded transition-colors"
                      title="Remove Game"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Games in Progress (Observer Mode) */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Watch Games in Progress</h2>
            {(lobbyGames.length > 0 || runningGames.length > 0) && (
              <button
                onClick={handleCleanupAllGames}
                className="text-xs px-2 py-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                title="Remove all Games"
              >
                🧹 Cleanup All
              </button>
            )}
          </div>
          {runningLoading ? (
            <p className="text-text-muted text-center py-4">Loading...</p>
          ) : runningGames.length === 0 ? (
            <p className="text-text-muted text-center py-4">
              No games in progress
            </p>
          ) : (
            <div className="space-y-2">
              {runningGames.map(game => (
                <div
                  key={game.roomCode}
                  className="flex items-center justify-between p-3 bg-primary-bg rounded-lg hover:bg-tile-bg transition-colors cursor-pointer border-l-4 border-green-500"
                  onClick={() => navigate(`/game/${game.roomCode}`)}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      {game.playerNames.join(' vs ')}
                    </div>
                    <div className="text-sm text-text-muted">
                      {game.status === 'WORD_SELECTION' ? 'Selecting words...' : 'In progress'}
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors text-sm font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/game/${game.roomCode}`);
                    }}
                  >
                    👁️ Watch
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-6 flex-wrap">
          <Link
            to="/history"
            className="text-text-secondary hover:text-accent transition-colors"
          >
            Game History &rarr;
          </Link>
          <Link
            to="/ai-stats"
            className="text-text-secondary hover:text-accent transition-colors"
          >
            AI Stats &rarr;
          </Link>
          <Link
            to="/bot-creator"
            className="text-text-secondary hover:text-accent transition-colors"
          >
            Bot Creator &rarr;
          </Link>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Game Rules</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Setup</h3>
              <p>Each player selects a secret word (4-12 letters). Add blanks at front/back to hide your word position! Your word is hidden from other players.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Gameplay</h3>
              <p>Take turns guessing letters in opponents' words. Correct guesses reveal the letter and award points. Your turn continues until you guess incorrectly.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Scoring</h3>
              <p>Points are based on letter position: 5, 10, 15 (repeating). Position 1 = 5pts, Position 2 = 10pts, Position 3 = 15pts, etc.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Winning</h3>
              <p>Game ends when all words are revealed. Player with the highest score wins!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
