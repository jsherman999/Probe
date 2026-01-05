# Bug Fix - Create Game Button Stuck in "Creating..."

## Date: 2025-12-22

## Issue
The "Create New Game" button would change to "Creating..." and never update. No errors appeared in frontend or backend terminals.

## Root Cause

**Race Condition in Socket Event Handling**

The Home component had a critical timing issue:

1. It called `socketService.connect(token)` to establish connection
2. Immediately set up listeners with `socket.once('gameCreated', ...)`
3. Then emitted `createGame` event
4. **Problem:** If the socket wasn't fully connected yet, the event would be emitted before the listener was ready, OR the response would come back before the listener was attached

This created a race condition where:
- The backend received the `createGame` request ✅
- The backend sent back `gameCreated` response ✅
- The frontend listener missed the response ❌
- The button stayed in "Creating..." state forever ❌

## Solution

### Frontend Changes (`frontend/src/pages/Home.tsx`)

**1. Pre-connect Socket on Component Mount**
```typescript
// Ensure socket is connected when component mounts
useEffect(() => {
  if (token) {
    socketService.connect(token);
  }
}, [token]);
```

**2. Proper Event Listener Setup**
- Use `socketService.on()` instead of `socket.once()` for proper event tracking
- Set up listeners BEFORE emitting the event
- Check if socket is connected before emitting
- Wait for connection if not connected yet
- Properly clean up listeners after they fire

```typescript
const handleCreateGame = () => {
  setLoading(true);
  setError('');

  const socket = socketService.connect(token!);

  // Set up listeners before emitting
  const onGameCreated = (game: any) => {
    console.log('Game created:', game);
    setLoading(false);
    socketService.off('gameCreated', onGameCreated);
    socketService.off('error', onError);
    navigate(`/lobby/${game.roomCode}`);
  };

  const onError = (err: any) => {
    console.error('Error creating game:', err);
    setError(err.message);
    setLoading(false);
    socketService.off('gameCreated', onGameCreated);
    socketService.off('error', onError);
  };

  // Use socketService.on() to ensure handlers are tracked
  socketService.on('gameCreated', onGameCreated);
  socketService.on('error', onError);

  // Wait for connection if needed
  if (socket.connected) {
    console.log('Socket already connected, emitting createGame');
    socket.emit('createGame');
  } else {
    console.log('Waiting for socket connection...');
    socket.once('connect', () => {
      console.log('Socket connected, emitting createGame');
      socket.emit('createGame');
    });
  }
};
```

### Backend Changes (`backend/src/socket/index.ts`)

Added debug logging to trace the create game flow:

```typescript
socket.on('createGame', async () => {
  console.log(`📝 Create game request from ${socket.username} (${socket.userId})`);
  try {
    const game = await gameManager.createGame(socket.userId!);
    console.log(`✅ Game created: ${game.roomCode}`);
    socket.join(game.roomCode);
    socket.emit('gameCreated', game);
    console.log(`📤 Sent gameCreated event to ${socket.username}`);
  } catch (error: any) {
    console.error(`❌ Error creating game:`, error.message);
    socket.emit('error', { message: error.message });
  }
});
```

## Key Improvements

1. **Guaranteed Connection:** Socket connects when Home component mounts, not when button is clicked
2. **No Race Condition:** Listeners are set up before emitting, and we wait for connection
3. **Proper Cleanup:** Listeners are removed after firing to prevent memory leaks
4. **Better Error Handling:** Errors properly reset the loading state
5. **Debug Logging:** Console logs help trace the flow for debugging

## Files Modified

1. `/frontend/src/pages/Home.tsx` - Fixed event listener setup and connection timing
2. `/backend/src/socket/index.ts` - Added debug logging

## Testing

After these changes, the "Create New Game" button should:

1. Click "Create New Game"
2. Button shows "Creating..."
3. Backend logs show:
   ```
   📝 Create game request from [username] ([userId])
   ✅ Game created: [ROOMCODE]
   📤 Sent gameCreated event to [username]
   ```
4. Frontend logs show:
   ```
   Socket already connected, emitting createGame
   Game created: { roomCode: 'ABC123', ... }
   ```
5. Browser navigates to `/lobby/ABC123`
6. Button returns to normal state

## How to Test

1. Make sure both servers are running:
   ```bash
   # Backend
   cd backend && npm run dev

   # Frontend
   cd frontend && npm run dev
   ```

2. Open browser to `http://192.168.5.221:5200` (or `http://localhost:5200`)
3. Click "Create New Game"
4. Should immediately navigate to lobby with a room code
5. Check both terminal outputs for the debug logs

## Related Issues

This fix also improves:
- Socket connection stability
- Event handler memory management
- Overall WebSocket communication reliability
