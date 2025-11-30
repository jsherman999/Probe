import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setGame, resetGame } from '../store/slices/gameSlice';
import socketService from '../services/socket';

export function useGameSocket(roomCode: string | undefined) {
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.auth);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !roomCode) return;

    const socket = socketService.connect(token);

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('error', (err: any) => {
      setError(err.message);
    });

    socket.on('playerJoined', (data: any) => {
      dispatch(setGame(data.game));
    });

    socket.on('playerLeft', (data: any) => {
      console.log('Player left:', data);
      // Update game state
    });

    socket.on('playerReady', (data: any) => {
      console.log('Player ready:', data);
    });

    socket.on('wordSelectionPhase', (data: any) => {
      dispatch(setGame(data));
    });

    socket.on('gameStarted', (data: any) => {
      dispatch(setGame(data));
    });

    socket.on('letterGuessed', (result: any) => {
      console.log('Letter guessed:', result);
      // Update game state with new reveals and scores
      dispatch(setGame({
        currentTurnPlayerId: result.currentTurnPlayerId,
      }));
    });

    socket.on('wordCompleted', (data: any) => {
      console.log('Word completed:', data);
    });

    socket.on('gameOver', (results: any) => {
      console.log('Game over:', results);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('playerReady');
      socket.off('wordSelectionPhase');
      socket.off('gameStarted');
      socket.off('letterGuessed');
      socket.off('wordCompleted');
      socket.off('gameOver');
    };
  }, [token, roomCode, dispatch]);

  return { isConnected, error };
}
