import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameHistory from './pages/GameHistory';
import Login from './pages/Login';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { logout, updateToken } from './store/slices/authSlice';
import socketService from './services/socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const { user, refreshToken } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  // Set up socket auth error handler to auto-logout on stale tokens
  useEffect(() => {
    socketService.setAuthErrorHandler(() => {
      console.log('🔒 Auth error - logging out');
      dispatch(logout());
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
      </Routes>
    </div>
  );
}

export default App;
