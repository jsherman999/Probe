import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setGame } from '../store/slices/gameSlice';
import socketService from '../services/socket';

export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const game = useAppSelector((state) => state.game);
  const [selectedWord, setSelectedWord] = useState('');
  const [error, setError] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('letterGuessed', (result: any) => {
      console.log('Letter guessed:', result);
      // Update game state based on result
    });

    socket.on('wordCompleted', (data: any) => {
      console.log('Word completed:', data);
    });

    socket.on('gameOver', (results: any) => {
      console.log('Game over:', results);
      // Show results
    });

    return () => {
      socket.off('letterGuessed');
      socket.off('wordCompleted');
      socket.off('gameOver');
    };
  }, []);

  const handleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = selectedWord.trim().toUpperCase();

    if (word.length < 4 || word.length > 12) {
      setError('Word must be 4-12 letters');
      return;
    }

    if (!/^[A-Z]+$/.test(word)) {
      setError('Word must contain only letters');
      return;
    }

    socketService.emit('selectWord', { roomCode, word });
    setError('');
  };

  const handleLetterGuess = (letter: string) => {
    if (!selectedTarget) {
      setError('Please select a player first');
      return;
    }

    socketService.emit('guessLetter', {
      roomCode,
      targetPlayerId: selectedTarget,
      letter,
    });
  };

  // Word selection phase
  if (game.status === 'WORD_SELECTION') {
    const myPlayer = game.players.find(p => p.userId === user?.id);
    
    if (myPlayer?.hasSelectedWord) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">Word Selected!</h2>
            <p className="text-text-secondary mb-6">
              Waiting for other players to choose their words...
            </p>
            <div className="space-y-2">
              {game.players.map(p => (
                <div key={p.userId} className="flex justify-between items-center p-3 bg-primary-bg rounded">
                  <span>{p.displayName}</span>
                  <span className={p.hasSelectedWord ? 'text-success' : 'text-text-muted'}>
                    {p.hasSelectedWord ? '✓' : '...'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4">Choose Your Secret Word</h2>
          <p className="text-text-secondary mb-6">
            Select a word between 4-12 letters. Keep it secret!
          </p>

          <form onSubmit={handleWordSubmit} className="space-y-4">
            <input
              type="text"
              value={selectedWord}
              onChange={(e) => setSelectedWord(e.target.value.toUpperCase())}
              className="input-field text-center text-2xl tracking-wider"
              placeholder="ENTER WORD"
              maxLength={12}
              autoFocus
            />

            <div className="text-sm text-text-muted text-center">
              {selectedWord.length} / 12 letters
              {selectedWord.length > 0 && selectedWord.length < 4 && (
                <span className="text-warning ml-2">(minimum 4)</span>
              )}
            </div>

            {error && (
              <div className="bg-error/20 border border-error text-error px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={selectedWord.length < 4}
              className="btn-primary w-full"
            >
              Submit Word
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active game phase
  const myTurn = game.currentTurnPlayerId === user?.id;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-secondary-bg rounded-xl p-4 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">PROBE</h1>
            <p className="text-sm text-text-muted">Room: {roomCode}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">Round {game.roundNumber}</p>
            <p className="text-lg font-semibold">
              {myTurn ? "Your Turn" : "Waiting..."}
            </p>
          </div>
        </div>

        {/* Player boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {game.players.map((player) => {
            const isMe = player.userId === user?.id;
            const isTarget = selectedTarget === player.userId;
            const isActive = game.currentTurnPlayerId === player.userId;

            return (
              <div
                key={player.userId}
                onClick={() => !isMe && !player.isEliminated && myTurn && setSelectedTarget(player.userId)}
                className={`card cursor-pointer transition-all ${
                  isTarget ? 'ring-4 ring-warning' : ''
                } ${isActive ? 'ring-2 ring-player-active' : ''} ${
                  player.isEliminated ? 'opacity-50' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold">{player.displayName} {isMe && '(You)'}</p>
                    {player.isEliminated && (
                      <span className="text-xs text-player-eliminated">Eliminated</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-accent">{player.totalScore}</p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {player.revealedPositions.map((letter, i) => (
                    <div
                      key={i}
                      className={letter ? 'letter-tile-revealed' : 'letter-tile-concealed'}
                    >
                      {letter || '?'}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Letter selector */}
        {myTurn && (
          <div className="card">
            <p className="text-center mb-3 font-semibold">
              {selectedTarget ? 'Select a letter to guess' : 'Select a player first'}
            </p>
            <div className="grid grid-cols-9 md:grid-cols-13 gap-2">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleLetterGuess(letter)}
                  disabled={!selectedTarget}
                  className="aspect-square bg-secondary-bg hover:bg-accent text-white font-bold rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-error/20 border border-error text-error px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
