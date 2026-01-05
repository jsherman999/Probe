import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface GameSummary {
  roomCode: string;
  completedAt: string;
  playerCount: number;
  winner: string;
  winnerScore: number;
}

interface GameDetail {
  id: string;
  roomCode: string;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  players: {
    userId: string;
    displayName: string;
    secretWord: string;
    paddedWord: string;
    frontPadding: number;
    backPadding: number;
    totalScore: number;
    isEliminated: boolean;
    turnOrder: number;
  }[];
  turns: {
    turnNumber: number;
    playerId: string;
    targetPlayerId: string;
    guessedLetter: string;
    isCorrect: boolean;
    positionsRevealed: number[];
    pointsScored: number;
    createdAt: string;
  }[];
  results: {
    playerId: string;
    displayName: string;
    finalScore: number;
    placement: number;
  }[];
  viewerGuesses?: {
    viewerId: string;
    viewerName: string;
    targetPlayerId: string;
    targetPlayerName: string;
    guessedWord: string;
    isCorrect: boolean;
    submittedAt: string;
  }[];
}

function GameHistoryList() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch(`${API_URL}/game/history/all`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch game history');
        }

        const data = await response.json();
        setGames(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [token]);

  const handleRemoveHistory = async (roomCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove game history for ${roomCode}?`)) return;

    try {
      const response = await fetch(`${API_URL}/game/history/${roomCode}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setGames(prev => prev.filter(g => g.roomCode !== roomCode));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove game history');
      }
    } catch (err) {
      console.error('Error removing game history:', err);
      setError('Failed to remove game history');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading game history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Game History</h1>
          <Link to="/" className="btn-secondary">
            Back to Home
          </Link>
        </div>

        {error && (
          <div className="bg-error/20 border border-error text-error px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {games.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-text-secondary text-lg">No completed games yet</p>
            <p className="text-text-muted mt-2">
              Games will appear here once they are completed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.roomCode}
                onClick={() => navigate(`/history/${game.roomCode}`)}
                className="card cursor-pointer hover:ring-2 hover:ring-accent transition-all"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">Game: {game.roomCode}</p>
                    <p className="text-text-muted text-sm">
                      {new Date(game.completedAt).toLocaleDateString()} at{' '}
                      {new Date(game.completedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-accent font-bold">{game.winner}</p>
                      <p className="text-text-secondary">
                        {game.winnerScore} pts | {game.playerCount} players
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleRemoveHistory(game.roomCode, e)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-2 rounded transition-colors"
                      title="Remove from history"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameHistoryDetail({ roomCode }: { roomCode: string }) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const fetchGame = async (retryCount = 0): Promise<void> => {
      try {
        const response = await fetch(`${API_URL}/game/history/game/${roomCode}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // If not found and we have retries left, wait and try again
          // This handles the race condition when navigating immediately after game ends
          if (response.status === 404 && retryCount < 3) {
            console.log(`Game history not ready yet, retrying in ${(retryCount + 1) * 500}ms...`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 500));
            return fetchGame(retryCount + 1);
          }
          throw new Error('Failed to fetch game details');
        }

        const data = await response.json();
        setGame(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [token, roomCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading game details...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/history" className="text-accent hover:underline mb-4 inline-block">
            &larr; Back to History
          </Link>
          <div className="bg-error/20 border border-error text-error px-4 py-3 rounded">
            {error || 'Game not found'}
          </div>
        </div>
      </div>
    );
  }

  // Build a map of player IDs to display names
  const playerNames: Record<string, string> = {};
  game.players.forEach((p) => {
    playerNames[p.userId] = p.displayName;
  });

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/history" className="text-accent hover:underline mb-4 inline-block">
          &larr; Back to History
        </Link>

        <div className="card mb-6">
          <h1 className="text-3xl font-bold mb-2">Game: {game.roomCode}</h1>
          <p className="text-text-muted">
            Completed: {new Date(game.completedAt).toLocaleDateString()} at{' '}
            {new Date(game.completedAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Final Results */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Final Results</h2>
          <div className="space-y-3">
            {game.results.map((result, index) => (
              <div
                key={result.playerId}
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
                    {result.placement}
                  </span>
                  <span className="font-semibold">{result.displayName}</span>
                </div>
                <span className="text-2xl font-bold">{result.finalScore} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Player Words */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Secret Words</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {game.players.map((player) => {
              const wordLength = (player.paddedWord || player.secretWord).length;
              let tileSizeClass = 'w-8 h-8';
              let textSizeClass = 'text-base';

              if (wordLength >= 10) {
                tileSizeClass = 'w-6 h-6';
                textSizeClass = 'text-sm';
              } else if (wordLength === 9) {
                tileSizeClass = 'w-7 h-7';
                textSizeClass = 'text-base';
              }

              return (
                <div key={player.userId} className="bg-primary-bg p-4 rounded-lg">
                  <p className="font-semibold mb-2">{player.displayName}</p>
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {(player.paddedWord || player.secretWord).split('').map((char, i) => {
                      const isBlank = char === '\u2022';
                      return (
                        <div
                          key={i}
                          className={`${tileSizeClass} rounded flex items-center justify-center font-bold ${textSizeClass} flex-shrink-0 ${
                            isBlank
                              ? 'bg-gray-600 text-gray-400'
                              : 'bg-accent text-white'
                          }`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-text-muted text-sm mt-2">
                    Word: {player.secretWord}
                    {(player.frontPadding > 0 || player.backPadding > 0) && (
                      <span> (Padding: {player.frontPadding}/{player.backPadding})</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Turn History */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Turn History</h2>
          {game.turns.length === 0 ? (
            <p className="text-text-muted">No turns recorded</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {game.turns.map((turn, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-2 rounded text-sm ${
                    turn.isCorrect ? 'bg-success/10' : 'bg-error/10'
                  }`}
                >
                  <div>
                    <span className="font-semibold">
                      {playerNames[turn.playerId] || 'Unknown'}
                    </span>
                    <span className="text-text-muted"> guessed </span>
                    <span className="font-mono font-bold">
                      {turn.guessedLetter === 'BLANK' ? '(BLANK)' : turn.guessedLetter}
                    </span>
                    <span className="text-text-muted"> on </span>
                    <span className="font-semibold">
                      {playerNames[turn.targetPlayerId] || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {turn.isCorrect ? (
                      <>
                        <span className="text-success">+{turn.pointsScored}</span>
                        <span className="text-success">HIT</span>
                      </>
                    ) : (
                      <span className="text-error">MISS</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Viewer Guesses */}
        {game.viewerGuesses && game.viewerGuesses.length > 0 && (
          <div className="card mt-6">
            <h2 className="text-xl font-bold mb-4">👁️ Viewer Guesses</h2>
            <div className="space-y-2">
              {game.viewerGuesses.map((guess: any, index: number) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-3 rounded ${
                    guess.isCorrect ? 'bg-green-600/20' : 'bg-red-600/20'
                  }`}
                >
                  <div>
                    <span className="font-semibold">{guess.viewerName}</span>
                    <span className="text-text-muted"> guessed </span>
                    <span className="font-mono font-bold">{guess.guessedWord}</span>
                    <span className="text-text-muted"> for </span>
                    <span className="font-semibold">{guess.targetPlayerName}</span>
                  </div>
                  <div className="text-right">
                    <span className={guess.isCorrect ? 'text-green-400' : 'text-red-400'}>
                      {guess.isCorrect ? '✓ Correct' : '✗ Wrong'}
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
      </div>
    </div>
  );
}

export default function GameHistory() {
  const { roomCode } = useParams<{ roomCode?: string }>();

  if (roomCode) {
    return <GameHistoryDetail roomCode={roomCode} />;
  }

  return <GameHistoryList />;
}
