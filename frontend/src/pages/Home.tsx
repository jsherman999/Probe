import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import socketService from '../services/socket';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token, user } = useAppSelector((state) => state.auth);

  const handleCreateGame = () => {
    setLoading(true);
    setError('');

    const socket = socketService.connect(token!);

    socket.once('gameCreated', (game: any) => {
      navigate(`/lobby/${game.roomCode}`);
    });

    socket.once('error', (err: any) => {
      setError(err.message);
      setLoading(false);
    });

    socket.emit('createGame');
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    
    if (code.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }

    navigate(`/lobby/${code}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="card text-center">
          <h1 className="text-5xl font-bold mb-4">PROBE</h1>
          <p className="text-text-secondary">Welcome, {user?.displayName}!</p>
        </div>

        <div className="card space-y-4">
          <button
            onClick={handleCreateGame}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Creating...' : 'Create New Game'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-tile-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-secondary-bg text-text-muted">OR</span>
            </div>
          </div>

          <form onSubmit={handleJoinGame} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="input-field text-center text-2xl tracking-widest"
                placeholder="ABC123"
                maxLength={6}
                pattern="[A-Z0-9]{6}"
              />
            </div>

            {error && (
              <div className="bg-error/20 border border-error text-error px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-secondary w-full">
              Join Game
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Game Rules</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Setup</h3>
              <p>Each player selects a secret word (4-12 letters). Your word is hidden from other players.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Gameplay</h3>
              <p>Take turns guessing letters in opponents' words. Correct guesses reveal the letter and award points. Your turn continues until you guess incorrectly.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Scoring</h3>
              <p>Letter values range from 1-10 points. Rare letters like Q and Z are worth more!</p>
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
