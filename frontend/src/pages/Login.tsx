import { useState, useEffect } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import api from '../services/api';
import { getApiBaseUrl } from '../utils/config';

export default function Login() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const dispatch = useAppDispatch();

  // Debug: show configuration info (useful for troubleshooting iOS)
  useEffect(() => {
    const info = [
      `API URL: ${getApiBaseUrl()}`,
      `Location: ${window.location.origin}`,
      `Hostname: ${window.location.hostname}`,
      `Port: ${window.location.port || '(default)'}`,
      `Protocol: ${window.location.protocol}`,
      `UA: ${navigator.userAgent.slice(0, 50)}...`,
    ].join('\n');
    setDebugInfo(info);
    console.log('🔧 Debug info:', info);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔐 Login attempt - API baseURL:', api.defaults.baseURL);
      const response = await api.post('/auth/login', {
        username: username.trim(),
        displayName: displayName.trim() || username.trim(),
      });

      dispatch(setCredentials(response.data));
    } catch (err: any) {
      console.error('🔐 Login error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Login failed';
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
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

        {/* Debug info - tap to toggle */}
        <details className="mt-4 text-xs text-text-secondary">
          <summary className="cursor-pointer opacity-50 hover:opacity-100">Debug Info</summary>
          <pre className="mt-2 p-2 bg-bg-secondary rounded text-[10px] overflow-x-auto whitespace-pre-wrap">
            {debugInfo}
          </pre>
        </details>
      </div>
    </div>
  );
}
