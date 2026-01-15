import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameHistory from './pages/GameHistory';
import AIStats from './pages/AIStats';
import BotCreator from './pages/BotCreator';
import Login from './pages/Login';
import DebugWindow from './components/DebugWindow';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { logout, updateToken } from './store/slices/authSlice';
import socketService from './services/socket';
import { getServerUrl } from './utils/config';

const API_URL = getServerUrl();

function App() {
  const { user, refreshToken } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const [showDebugWindow, setShowDebugWindow] = useState(false);

  // Keyboard shortcut for debug window (Ctrl+Shift+D)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setShowDebugWindow(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Set up socket auth error handler to auto-logout on stale tokens
  useEffect(() => {
    socketService.setAuthErrorHandler(() => {
      console.log('🔒 Auth error - logging out');
      dispatch(logout());
    });

    // Handle token refresh from socket service
    socketService.setTokenRefreshedHandler((newToken: string) => {
      console.log('🔄 Token refreshed from socket, updating store');
      dispatch(updateToken(newToken));
    });
  }, [dispatch]);

  // Try to refresh token on app startup if we have a refresh token
  useEffect(() => {
    const tryRefreshToken = async () => {
      if (!refreshToken || !user) return;

      try {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();
          dispatch(updateToken(data.token));
          console.log('🔄 Token refreshed on startup');
        } else {
          console.warn('⚠️ Token refresh failed, user may need to re-login');
        }
      } catch (error) {
        console.warn('⚠️ Token refresh error:', error);
      }
    };

    tryRefreshToken();
  }, []); // Only run once on mount

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/game/:roomCode" element={<Game />} />
        <Route path="/history" element={<GameHistory />} />
        <Route path="/history/:roomCode" element={<GameHistory />} />
        <Route path="/ai-stats" element={<AIStats />} />
        <Route path="/bot-creator" element={<BotCreator />} />
      </Routes>

      {/* Debug toggle button - fixed position */}
      <button
        onClick={() => setShowDebugWindow(prev => !prev)}
        className={`fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
          showDebugWindow
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
        title="Toggle Debug Window (Ctrl+Shift+D)"
      >
        <span className="text-lg">🔍</span>
      </button>

      {/* Debug window */}
      <DebugWindow
        isOpen={showDebugWindow}
        onClose={() => setShowDebugWindow(false)}
      />
    </div>
  );
}

export default App;
