import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Player {
  id: string;
  userId: string | null;
  displayName: string;
  wordLength: number;
  hasSelectedWord: boolean;
  frontPadding: number;
  backPadding: number;
  revealedPositions: (string | null)[];
  missedLetters: string[];
  totalScore: number;
  isEliminated: boolean;
  turnOrder: number;
  mySecretWord?: string; // Only set for the current user's own player
  // Bot-specific fields
  isBot?: boolean;
  botId?: string | null;
  botDisplayName?: string | null;
  botModelName?: string | null;
  botDifficulty?: string | null;
}

interface GameState {
  id: string | null;
  roomCode: string | null;
  status: 'WAITING' | 'WORD_SELECTION' | 'ACTIVE' | 'COMPLETED' | null;
  hostId: string | null;
  players: Player[];
  currentTurnPlayerId: string | null;
  roundNumber: number;
  turnTimerSeconds: number;
  currentTurnStartedAt: string | null;
  turnCardUsed: boolean;
}

const initialState: GameState = {
  id: null,
  roomCode: null,
  status: null,
  hostId: null,
  players: [],
  currentTurnPlayerId: null,
  roundNumber: 1,
  turnTimerSeconds: 300,
  currentTurnStartedAt: null,
  turnCardUsed: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGame: (state, action: PayloadAction<Partial<GameState>>) => {
      return { ...state, ...action.payload };
    },
    updatePlayer: (state, action: PayloadAction<Partial<Player> & { userId: string }>) => {
      const index = state.players.findIndex(p => p.userId === action.payload.userId);
      if (index !== -1) {
        state.players[index] = { ...state.players[index], ...action.payload };
      }
    },
    addPlayer: (state, action: PayloadAction<Player>) => {
      state.players.push(action.payload);
    },
    removePlayer: (state, action: PayloadAction<string>) => {
      state.players = state.players.filter(p => p.userId !== action.payload);
    },
    resetGame: () => initialState,
  },
});

export const { setGame, updatePlayer, addPlayer, removePlayer, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
