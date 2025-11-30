import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Login from './pages/Login';
import { useAppSelector } from './store/hooks';

function App() {
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/game/:roomCode" element={<Game />} />
      </Routes>
    </div>
  );
}

export default App;
