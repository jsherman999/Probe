import { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import api from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        username: username.trim(),
        displayName: displayName.trim() || username.trim(),
      });

      dispatch(setCredentials(response.data));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2">
          <span className="text-yellow-400">P</span>
          <span className="text-blue-400">R</span>
          <span className="text-green-400">O</span>
          <span className="text-red-400">B</span>
          <span className="text-purple-400">E</span>
        </h1>
        <p className="text-text-secondary text-center mb-8">Multiplayer Word Game</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="Enter username"
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_]+"
              title="Only letters, numbers, and underscores"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Display Name (Optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
              placeholder="Enter display name"
              maxLength={100}
            />
          </div>

          {error && (
            <div className="bg-error/20 border border-error text-error px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Logging in...' : 'Play Now'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-tile-border">
          <h2 className="text-lg font-semibold mb-3">How to Play</h2>
          <ul className="text-sm text-text-secondary space-y-2">
            <li>• Choose a secret word (4-12 letters)</li>
            <li>• Guess letters in opponents' words</li>
            <li>• Earn points for correct guesses</li>
            <li>• Highest score wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
