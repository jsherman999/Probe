# Bug Fixes - Game Lobby & Word Selection

## Date: 2025-12-22

## Issues Fixed

### 1. Word Selection UI Not Appearing
**Problem:** When the host clicked "Start Game", the status changed to "WORD_SELECTION" but no word selection form appeared. Players just saw "Waiting for all players to select their words..." with no way to actually select a word.

**Root Cause:** The word selection UI exists in the Game component (`/game/:roomCode`), but the Lobby component wasn't navigating to it when the game status changed to `WORD_SELECTION`. It only navigated on `gameStarted` (status = ACTIVE).

**Fix:** Updated `frontend/src/pages/Lobby.tsx` line 32-35 to navigate to the game page when `wordSelectionPhase` event is received.

```typescript
socket.on('wordSelectionPhase', (data: any) => {
  dispatch(setGame(data));
  navigate(`/game/${roomCode}`);  // Added this line
});
```

### 2. "Already in this game" Error
**Problem:** When players refreshed the page or reconnected, they would see an error message "Already in this game" and the lobby wouldn't load properly.

**Root Cause:** The Lobby component calls `socket.emit('joinGame', { roomCode })` every time it mounts (line 21). The backend's `joinGame` method threw an error if the user was already in the game.

**Fix:**
1. Added `getGameByRoomCode` method to GameManager to retrieve game state without joining
2. Modified `joinGame` to return current game state instead of throwing error if player is already in the game

```typescript
// backend/src/game/GameManager.ts line 103-107
// Check if user already in game - if so, just return current state
const existingPlayer = game.players.find(p => p.userId === userId);
if (existingPlayer) {
  return this.getGameByRoomCode(roomCode);
}
```

### 3. Players Not Seeing Each Other (Synchronization)
**Problem:** Phone player couldn't see the desktop player, but desktop could see both.

**Root Cause:** Related to issue #2 - the phone player was getting an error when trying to join, so the game state wasn't synchronizing properly. Once the "Already in this game" error is handled gracefully, both players can see each other.

**Fix:** Same as #2 - allowing graceful rejoining ensures proper state synchronization.

## Files Modified

1. `/frontend/src/pages/Lobby.tsx` - Added navigation to game page on word selection phase
2. `/backend/src/game/GameManager.ts` - Added `getGameByRoomCode` method and modified `joinGame` to handle already-joined players

## Testing

Tested with:
- Desktop browser (Chrome/Safari)
- iPhone via local network (192.168.5.221:5200)
- Multiple players joining and starting game
- Refresh/reconnection scenarios

## How to Use

1. **Start Backend:**
   ```bash
   cd /Users/jay/cc_projects/Probe/backend
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd /Users/jay/cc_projects/Probe/frontend
   npm run dev
   ```

3. **Access the Game:**
   - Local: http://localhost:5200
   - Network: http://192.168.5.221:5200

## Expected Flow

1. Player 1 creates game → gets room code
2. Player 2 joins with room code
3. Both players see each other in lobby
4. Host clicks "Start Game"
5. Both players are redirected to `/game/:roomCode`
6. Both players see word selection form
7. Each player enters their secret word
8. When all words are selected, game starts automatically
