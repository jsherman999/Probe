import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface BotStat {
  // Game info
  roomCode: string;
  completedAt: string;
  playerCount: number;

  // Bot identity
  botName: string;
  botId: string;

  // LLM config
  modelName: string;
  difficulty: string;
  config: {
    temperature?: number;
    numPredict?: number;
    topK?: number;
    topP?: number;
  };

  // Performance
  score: number;
  placement: number;
  totalPlayers: number;

  // Guessing stats
  correctGuesses: number;
  incorrectGuesses: number;
  totalGuesses: number;
  accuracy: number;

  // Word info
  secretWord: string;
  wordLength: number;
}

export default function AIStats() {
  const [stats, setStats] = useState<BotStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/game/bot-stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch AI stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  // Calculate aggregate stats
  const aggregateStats = stats.length > 0 ? {
    totalGames: stats.length,
    wins: stats.filter(s => s.placement === 1).length,
    avgScore: Math.round(stats.reduce((sum, s) => sum + s.score, 0) / stats.length),
    avgAccuracy: Math.round(stats.reduce((sum, s) => sum + s.accuracy, 0) / stats.length),
    avgPlacement: (stats.reduce((sum, s) => sum + s.placement, 0) / stats.length).toFixed(1),
  } : null;

  // Get unique models used
  const uniqueModels = [...new Set(stats.map(s => s.modelName))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading AI stats...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">AI Stats</h1>
          <Link to="/" className="btn-secondary">
            Back to Home
          </Link>
        </div>

        {error && (
          <div className="bg-error/20 border border-error text-error px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {aggregateStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-3xl font-bold text-accent">{aggregateStats.totalGames}</p>
              <p className="text-text-muted text-sm">Games Played</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-400">{aggregateStats.wins}</p>
              <p className="text-text-muted text-sm">Wins</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-yellow-400">{aggregateStats.avgScore}</p>
              <p className="text-text-muted text-sm">Avg Score</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-400">{aggregateStats.avgAccuracy}%</p>
              <p className="text-text-muted text-sm">Avg Accuracy</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-purple-400">{aggregateStats.avgPlacement}</p>
              <p className="text-text-muted text-sm">Avg Place</p>
            </div>
          </div>
        )}

        {/* Models Used */}
        {uniqueModels.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-3">Models Used</h2>
            <div className="flex flex-wrap gap-2">
              {uniqueModels.map(model => (
                <span
                  key={model}
                  className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}

        {stats.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-text-secondary text-lg">No AI games recorded yet</p>
            <p className="text-text-muted mt-2">
              Play games with AI opponents to see stats here
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <h2 className="text-xl font-bold mb-4">Game History</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-bg">
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Game</th>
                  <th className="text-left py-3 px-2">Bot</th>
                  <th className="text-left py-3 px-2">Model</th>
                  <th className="text-center py-3 px-2">Place</th>
                  <th className="text-right py-3 px-2">Score</th>
                  <th className="text-right py-3 px-2">Accuracy</th>
                  <th className="text-left py-3 px-2">Word</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, index) => (
                  <tr
                    key={`${stat.roomCode}-${stat.botId}-${index}`}
                    className="border-b border-secondary-bg/50 hover:bg-primary-bg/50"
                  >
                    <td className="py-3 px-2 text-text-muted">
                      {new Date(stat.completedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2">
                      <Link
                        to={`/history/${stat.roomCode}`}
                        className="text-accent hover:underline"
                      >
                        {stat.roomCode}
                      </Link>
                    </td>
                    <td className="py-3 px-2 font-semibold">{stat.botName}</td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 bg-secondary-bg rounded text-xs">
                        {stat.modelName}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          stat.placement === 1
                            ? 'bg-yellow-500 text-black'
                            : stat.placement === 2
                            ? 'bg-gray-400 text-black'
                            : stat.placement === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-secondary-bg'
                        }`}
                      >
                        {stat.placement}
                      </span>
                      <span className="text-text-muted text-xs ml-1">
                        /{stat.totalPlayers}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-bold">{stat.score}</td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={`${
                          stat.accuracy >= 50
                            ? 'text-green-400'
                            : stat.accuracy >= 30
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {stat.accuracy}%
                      </span>
                      <span className="text-text-muted text-xs ml-1">
                        ({stat.correctGuesses}/{stat.totalGuesses})
                      </span>
                    </td>
                    <td className="py-3 px-2 font-mono">{stat.secretWord}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
