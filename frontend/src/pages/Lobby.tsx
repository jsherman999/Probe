import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setGame } from '../store/slices/gameSlice';
import socketService from '../services/socket';

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const game = useAppSelector((state) => state.game);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !user) return;

    const socket = socketService.connect(token);

    // Join the game
    socket.emit('joinGame', { roomCode });

    // Listen for events
    socket.on('playerJoined', (data: any) => {
      dispatch(setGame(data.game));
    });

    socket.on('playerLeft', (data: any) => {
      console.log('Player left:', data);
    });

    socket.on('wordSelectionPhase', (data: any) => {
      dispatch(setGame(data));
    });

    socket.on('gameStarted', (data: any) => {
      dispatch(setGame(data));
      navigate(`/game/${roomCode}`);
    });

    socket.on('error', (err: any) => {
      setError(err.message);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('wordSelectionPhase');
      socket.off('gameStarted');
      socket.off('error');
    };
  }, [roomCode, token, user, dispatch, navigate]);

  const handleStartGame = () => {
    socketService.emit('startGame', { roomCode });
  };

  const handleLeave = () => {
    socketService.emit('leaveGame', { roomCode });
    navigate('/');
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
            <p className="text-text-secondary">Room Code: <span className="text-accent font-mono text-2xl">{roomCode}</span></p>
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
            Share the room code with your friends to play together!
          </p>
        </div>
      </div>
    </div>
  );
}
