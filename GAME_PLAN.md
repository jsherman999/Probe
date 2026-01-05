# Probe - Multiplayer Word Game Implementation Plan

## Executive Summary
This document outlines a comprehensive plan to develop a modern, multiplayer web-based implementation of the classic Probe word game (Parker Brothers, 1964). The game will support 2-4 players on iOS devices and web browsers with responsive design.

---

## 1. Game Overview & Rules

### 1.1 Original Game Concept
Probe is a word-guessing game where players:
- Each select a secret word (4-12 letters)
- Take turns guessing letters in opponents' words
- Score points based on letter values when correctly guessed
- Continue their turn until they guess incorrectly
- Win by scoring the most points when all words are revealed

### 1.2 Core Game Mechanics

#### Position-Based Scoring System
Points are awarded based on letter position (repeating pattern):
```
Position 1, 4, 7, 10...: 5 points
Position 2, 5, 8, 11...: 10 points
Position 3, 6, 9, 12...: 15 points
```

#### Word Padding (Blanks)
Players can add blank padding to disguise their word's position:
- Front padding: blanks before the word
- Back padding: blanks after the word
- Example: "••LION•••" (2 front, 3 back)
- Blanks score the same as letters (position-based)
- Blank exposure order: back blanks (rightmost first), then front blanks (leftmost first)

#### Game Flow
1. **Setup Phase**
   - 2-4 players join game lobby
   - Each player secretly selects a word (4-12 letters)
   - Words are concealed behind blank tiles

2. **Play Phase**
   - Turn order determined randomly
   - Active player selects opponent and guesses a letter
   - If correct: letter revealed, points awarded, turn continues
   - If incorrect: turn ends, passes to next player
   - Player may target different opponents on same turn

3. **Scoring**
   - Points awarded immediately when letter revealed
   - Each occurrence of the letter scores points
   - Complete word reveals end that player's word scoring

4. **Winning**
   - Game ends when all words fully revealed
   - Player with highest score wins

#### Turn Card System
At the start of each new player's turn, a card is drawn with the following probabilities:

| Card Type | Label | Probability | Effect |
|-----------|-------|-------------|--------|
| normal | Take your normal turn | 60% | Standard turn |
| additional | Take an additional turn | 5% | Continue playing after a miss |
| expose_left | Player on your left exposes a letter | 5% | Adjacent player reveals one of their own letters, active player gets points |
| expose_right | Player on your right exposes a letter | 5% | Adjacent player reveals one of their own letters, active player gets points |
| bonus_20 | Add 20 to your score | 5% | Immediate +20 points |
| double | Double the value of your first guess | 5% | 2x multiplier on first successful guess |
| triple | Triple the value of your first guess | 5% | 3x multiplier on first successful guess |
| quadruple | Quadruple the value of your first guess | 5% | 4x multiplier on first successful guess |
| quintuple | Quintuple the value of your first guess | 5% | 5x multiplier on first successful guess |

**Expose Card Rules:**
- The affected player (left/right) chooses which of their OWN unrevealed letters to expose
- They see their actual word when selecting (not hidden)
- The active player who drew the card receives the position-based points
- 30-second timeout with auto-selection of rightmost unrevealed position

#### Turn Timer
- Configurable timer per turn (10 seconds to 30 minutes, default 5 minutes)
- Host sets timer in lobby with presets or custom time
- Real-time countdown with color urgency indicators
- Server-side timeout handling advances turn automatically

#### Observer Mode
- Non-players can watch games in progress
- Observers can guess secret words (private until game ends)
- Observer guesses revealed in game history after completion

---

## 2. Technical Architecture

### 2.1 Technology Stack

#### Frontend
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS (responsive design)
- **State Management**: Redux Toolkit + RTK Query
- **Real-time**: Socket.io-client
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

#### Backend
- **Runtime**: Node.js 20+ LTS
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Database**: PostgreSQL 16+
- **ORM**: Prisma
- **Authentication**: JWT tokens
- **Validation**: Zod

#### Infrastructure
- **Containerization**: Podman (rootless containers)
- **Reverse Proxy**: Nginx or Caddy
- **Process Manager**: PM2
- **Database**: PostgreSQL in container
- **Environment**: Python venv for tooling (if needed)

### 2.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  (iOS Safari, Chrome, Firefox - Responsive Tailwind UI)     │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS/WSS (Socket.io)
                            │
┌─────────────────────────────────────────────────────────────┐
│                 Load Balancer / Reverse Proxy               │
│                     (Nginx/Caddy)                            │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Application Server                         │
│              (Express.js + Socket.io)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Game Logic Layer                                   │   │
│  │  - Game State Manager                               │   │
│  │  - Turn Controller                                  │   │
│  │  - Scoring Engine                                   │   │
│  │  - Word Validator                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│              PostgreSQL Database                             │
│  - Games Table                                               │
│  - Players Table                                             │
│  - Game_Players Junction                                     │
│  - Game_History / Turns                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Game Flow Implementation

### 3.1 Lobby & Matchmaking

#### States
- **WAITING**: Lobby created, waiting for players (min 2, max 4)
- **READY**: All players present, ready to start
- **WORD_SELECTION**: Players choosing secret words
- **ACTIVE**: Game in progress
- **COMPLETED**: Game finished

#### Features
- Create game with unique room code (6 characters)
- Join game via room code
- Player list with ready status
- Host can start game when 2+ players ready
- Kick inactive players (host only)

### 3.2 Word Selection Phase

#### Requirements
- Each player selects word (4-12 letters)
- Word validation:
  - English dictionary check
  - Length constraints
  - No proper nouns
  - No repeated words in same game
- Visual feedback: blank tiles showing word length
- All players must submit before game starts
- 60-second timer (optional)

### 3.3 Active Game Phase

#### Turn Structure
```typescript
interface Turn {
  gameId: string;
  playerId: string;
  targetPlayerId: string;
  guessedLetter: string;
  isCorrect: boolean;
  positionsRevealed: number[];
  pointsScored: number;
  timestamp: Date;
}
```

#### Board State Display
```typescript
interface PlayerBoard {
  playerId: string;
  playerName: string;
  word: string; // server only
  revealedLetters: (string | null)[]; // client visible
  totalPoints: number;
  isEliminated: boolean; // word fully revealed
}
```

#### Turn Mechanics
1. Active player's indicator shown
2. Player selects opponent's board (visual highlight)
3. Player clicks letter from alphabet panel
4. Server validates:
   - Letter not already guessed for that word
   - Game state is valid
5. If correct:
   - Animate letter reveal(s)
   - Update score with animation
   - Player continues turn
6. If incorrect:
   - Show feedback animation
   - Pass turn to next player
7. If word completed:
   - Celebration animation
   - Target player eliminated
   - Turn continues

---

## 4. User Interface Design

### 4.1 Responsive Layout Strategy

#### Breakpoints (Tailwind)
- **Mobile**: < 640px (iPhone SE to iPhone 14 Pro Max)
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

#### Key Screens

##### 1. Home/Lobby Screen
```
┌─────────────────────────────────┐
│         PROBE                   │
│                                 │
│  ┌───────────────────────┐     │
│  │  Create New Game      │     │
│  └───────────────────────┘     │
│                                 │
│  ┌───────────────────────┐     │
│  │  Join Game            │     │
│  └───────────────────────┘     │
│                                 │
│  [Room Code: ______]            │
│                                 │
└─────────────────────────────────┘
```

##### 2. Game Lobby
```
┌─────────────────────────────────┐
│  Room: ABC123      [Leave]      │
├─────────────────────────────────┤
│  Players (2/4):                 │
│                                 │
│  🟢 Player 1 (Host) ✓ Ready     │
│  🟢 Player 2       ✓ Ready      │
│  ⚪ Waiting...                  │
│  ⚪ Waiting...                  │
│                                 │
│  ┌───────────────────────┐     │
│  │  Start Game           │     │
│  └───────────────────────┘     │
└─────────────────────────────────┘
```

##### 3. Word Selection
```
┌─────────────────────────────────┐
│  Choose Your Secret Word        │
│                                 │
│  [_____________]                │
│                                 │
│  Length: 4-12 letters           │
│  ✓ Valid word                   │
│                                 │
│  ┌───────────────────────┐     │
│  │  Submit Word          │     │
│  └───────────────────────┘     │
│                                 │
│  Waiting for other players...   │
└─────────────────────────────────┘
```

##### 4. Game Board (Mobile Portrait)
```
┌─────────────────────────────────┐
│  Turn: Player 1    Round: 5     │
├─────────────────────────────────┤
│  🟢 Player 1           Score: 42│
│  ┌─┬─┬─┬─┬─┬─┬─┐              │
│  │P│R│_│_│E│_│_│              │
│  └─┴─┴─┴─┴─┴─┴─┘              │
│                                 │
│  ⚪ Player 2           Score: 38│
│  ┌─┬─┬─┬─┬─┬─┐                │
│  │_│O│_│_│E│_│                │
│  └─┴─┴─┴─┴─┴─┘                │
│                                 │
│  ⚪ Player 3 ⭐       Score: 51│
│  ┌─┬─┬─┬─┬─┬─┬─┬─┐            │
│  │_│_│_│_│_│_│_│_│            │
│  └─┴─┴─┴─┴─┴─┴─┴─┘            │
│                                 │
│  ⚪ Player 4           Score: 29│
│  ┌─┬─┬─┬─┬─┐                  │
│  │_│I│_│E│_│                  │
│  └─┴─┴─┴─┴─┘                  │
├─────────────────────────────────┤
│  Letter Selector (if your turn) │
│  A B C D E F G H I              │
│  J K L M N O P Q R              │
│  S T U V W X Y Z                │
└─────────────────────────────────┘
```

##### 5. Game Board (Landscape/Desktop)
```
┌─────────────────────────────────────────────────────────────┐
│  PROBE              Turn: Player 3          Round: 5        │
├──────────────────────┬──────────────────────────────────────┤
│  Player 1: 42pts     │  Player 2: 38pts                     │
│  ┌─┬─┬─┬─┬─┬─┬─┐    │  ┌─┬─┬─┬─┬─┬─┐                      │
│  │P│R│_│_│E│_│_│    │  │_│O│_│_│E│_│                      │
│  └─┴─┴─┴─┴─┴─┴─┘    │  └─┴─┴─┴─┴─┴─┘                      │
├──────────────────────┼──────────────────────────────────────┤
│  Player 3 ⭐: 51pts  │  Player 4: 29pts                     │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┐  │  ┌─┬─┬─┬─┬─┐                        │
│  │_│_│_│_│_│_│_│_│  │  │_│I│_│E│_│                        │
│  └─┴─┴─┴─┴─┴─┴─┴─┘  │  └─┴─┴─┴─┴─┘                        │
└──────────────────────┴──────────────────────────────────────┘
│  Guess a Letter:                                            │
│  A B C D E F G H I J K L M N O P Q R S T U V W X Y Z       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Visual Design Specifications

#### Color Palette
```css
/* Primary Colors */
--primary-bg: #1e293b;      /* slate-800 */
--secondary-bg: #334155;    /* slate-700 */
--accent: #3b82f6;          /* blue-500 */
--success: #10b981;         /* emerald-500 */
--error: #ef4444;           /* red-500 */
--warning: #f59e0b;         /* amber-500 */

/* Text */
--text-primary: #f1f5f9;    /* slate-100 */
--text-secondary: #cbd5e1;  /* slate-300 */
--text-muted: #94a3b8;      /* slate-400 */

/* Letter Tiles */
--tile-concealed: #475569;  /* slate-600 */
--tile-revealed: #f1f5f9;   /* slate-100 */
--tile-border: #64748b;     /* slate-500 */

/* Player States */
--player-active: #3b82f6;   /* blue-500 */
--player-target: #f59e0b;   /* amber-500 */
--player-eliminated: #6b7280; /* gray-500 */
```

#### Typography
```css
/* Fonts */
font-family-base: 'Inter', system-ui, sans-serif;
font-family-mono: 'JetBrains Mono', 'Courier New', monospace;

/* Letter Tiles */
font-size-tile-mobile: 1.5rem (24px);
font-size-tile-tablet: 2rem (32px);
font-size-tile-desktop: 2.5rem (40px);
font-weight-tile: 700 (bold);

/* Scores */
font-size-score: 1.25rem (20px);
font-weight-score: 600 (semibold);
```

#### Letter Tile Specifications
```
Mobile:    40px × 40px
Tablet:    56px × 56px
Desktop:   64px × 64px

Border: 2px solid
Border-radius: 4px
Shadow: 0 2px 4px rgba(0,0,0,0.1)
```

#### Animation Specifications
- **Letter Reveal**: Flip animation 300ms ease-in-out
- **Score Update**: Count-up animation 500ms
- **Turn Change**: Fade transition 200ms
- **Board Highlight**: Pulse glow effect 1000ms
- **Wrong Guess**: Shake animation 400ms
- **Word Complete**: Celebration confetti 2000ms

### 4.3 Accessibility Features
- WCAG 2.1 AA compliant contrast ratios
- Keyboard navigation support
- Screen reader announcements for game events
- Focus indicators on interactive elements
- Alternative text for all icons
- Reduced motion option (respects prefers-reduced-motion)

---

## 5. Real-Time Communication

### 5.1 Socket.io Events

#### Client → Server
```typescript
// Connection
'connection' - Establish socket connection
'joinGame' - Join specific game room
'leaveGame' - Leave game room
'disconnect' - Handle disconnection

// Game Setup
'createGame' - Create new game lobby
'selectWord' - Submit secret word
'startGame' - Begin game (host only)

// Gameplay
'guessLetter' - Make letter guess
'endTurn' - Manually end turn (optional)

// Chat (optional)
'sendMessage' - Send chat message
```

#### Server → Client
```typescript
// Connection
'connected' - Connection confirmed
'error' - Error message

// Lobby Updates
'gameCreated' - Game lobby created
'playerJoined' - New player joined
'playerLeft' - Player left game
'playerReady' - Player ready status changed
'gameStarting' - Game starting countdown

// Game State
'wordSelectionPhase' - Enter word selection
'gameStarted' - Game began
'turnStart' - New turn started
'letterGuessed' - Letter guess result
'letterRevealed' - Letter(s) revealed
'scoreUpdate' - Score changed
'wordCompleted' - Word fully revealed
'gameOver' - Game ended
'playerEliminated' - Player's word revealed

// Sync
'gameState' - Full game state update
'boardUpdate' - Board state changed
```

### 5.2 State Synchronization Strategy
- Optimistic updates for UI responsiveness
- Server authoritative for game logic
- Periodic state reconciliation (every 30s)
- Reconnection handling with state recovery
- Conflict resolution using server timestamp

---

## 6. Database Schema

### 6.1 PostgreSQL Tables

```sql
-- Users/Players
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Games
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL, -- WAITING, WORD_SELECTION, ACTIVE, COMPLETED
    host_id UUID REFERENCES users(id),
    max_players INTEGER DEFAULT 4,
    current_turn_player_id UUID,
    round_number INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Game Players (Junction)
CREATE TABLE game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    turn_order INTEGER NOT NULL,
    secret_word VARCHAR(12),
    secret_word_hash VARCHAR(255), -- For validation without exposure
    revealed_positions JSONB DEFAULT '[]', -- Array of revealed indices
    total_score INTEGER DEFAULT 0,
    is_eliminated BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, user_id)
);

-- Game Turns (History)
CREATE TABLE game_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id),
    target_player_id UUID REFERENCES users(id),
    guessed_letter CHAR(1) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    positions_revealed INTEGER[] DEFAULT '{}',
    points_scored INTEGER DEFAULT 0,
    turn_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Game Results
CREATE TABLE game_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id),
    final_score INTEGER NOT NULL,
    placement INTEGER NOT NULL, -- 1st, 2nd, 3rd, 4th
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_user ON game_players(user_id);
CREATE INDEX idx_game_turns_game ON game_turns(game_id);
```

### 6.2 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String   @id @default(uuid())
  username    String   @unique
  displayName String
  createdAt   DateTime @default(now())
  lastSeen    DateTime @default(now())

  hostedGames   Game[]        @relation("HostedGames")
  gamePlayers   GamePlayer[]
  turnsPlayed   GameTurn[]    @relation("PlayerTurns")
  turnsTargeted GameTurn[]    @relation("TargetedTurns")
  gameResults   GameResult[]

  @@map("users")
}

model Game {
  id                 String    @id @default(uuid())
  roomCode           String    @unique
  status             String    // WAITING, WORD_SELECTION, ACTIVE, COMPLETED
  hostId             String?
  maxPlayers         Int       @default(4)
  currentTurnPlayerId String?
  roundNumber        Int       @default(1)
  createdAt          DateTime  @default(now())
  startedAt          DateTime?
  completedAt        DateTime?

  host        User?        @relation("HostedGames", fields: [hostId], references: [id])
  players     GamePlayer[]
  turns       GameTurn[]
  results     GameResult[]

  @@map("games")
}

model GamePlayer {
  id                String   @id @default(uuid())
  gameId            String
  userId            String
  turnOrder         Int
  secretWord        String?
  secretWordHash    String?
  revealedPositions Json     @default("[]")
  totalScore        Int      @default(0)
  isEliminated      Boolean  @default(false)
  joinedAt          DateTime @default(now())

  game Game @relation(fields: [gameId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@unique([gameId, userId])
  @@map("game_players")
}

model GameTurn {
  id                String   @id @default(uuid())
  gameId            String
  playerId          String
  targetPlayerId    String
  guessedLetter     String
  isCorrect         Boolean
  positionsRevealed Int[]    @default([])
  pointsScored      Int      @default(0)
  turnNumber        Int
  createdAt         DateTime @default(now())

  game         Game @relation(fields: [gameId], references: [id], onDelete: Cascade)
  player       User @relation("PlayerTurns", fields: [playerId], references: [id])
  targetPlayer User @relation("TargetedTurns", fields: [targetPlayerId], references: [id])

  @@map("game_turns")
}

model GameResult {
  id         String   @id @default(uuid())
  gameId     String
  playerId   String
  finalScore Int
  placement  Int
  createdAt  DateTime @default(now())

  game   Game @relation(fields: [gameId], references: [id], onDelete: Cascade)
  player User @relation(fields: [playerId], references: [id])

  @@map("game_results")
}
```

---

## 7. Game Logic Implementation

### 7.1 Core Classes/Modules

```typescript
// src/server/game/GameManager.ts
class GameManager {
  private games: Map<string, GameState>;
  
  createGame(hostId: string): Game
  joinGame(gameId: string, userId: string): boolean
  startGame(gameId: string): boolean
  processGuess(gameId: string, playerId: string, targetId: string, letter: string): GuessResult
  endTurn(gameId: string): void
  checkGameOver(gameId: string): boolean
}

// src/server/game/WordValidator.ts
class WordValidator {
  private dictionary: Set<string>;
  
  async loadDictionary(): Promise<void>
  isValidWord(word: string): boolean
  isValidLength(word: string): boolean
  hasValidCharacters(word: string): boolean
}

// src/server/game/ScoringEngine.ts
class ScoringEngine {
  private letterValues: Map<string, number>;
  
  calculateScore(letter: string, occurrences: number): number
  getLetterValue(letter: string): number
}

// src/server/game/GameState.ts
interface GameState {
  id: string;
  roomCode: string;
  status: GameStatus;
  players: PlayerState[];
  currentTurnIndex: number;
  roundNumber: number;
  startedAt?: Date;
}

interface PlayerState {
  id: string;
  displayName: string;
  secretWord: string;
  revealedPositions: boolean[];
  guessedLetters: Set<string>;
  score: number;
  isEliminated: boolean;
}

enum GameStatus {
  WAITING = 'WAITING',
  WORD_SELECTION = 'WORD_SELECTION',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}
```

### 7.2 Game Flow Logic

```typescript
// Main game loop
async function processLetterGuess(
  gameId: string,
  playerId: string,
  targetPlayerId: string,
  letter: string
): Promise<GuessResult> {
  // 1. Validate game state
  const game = await getGame(gameId);
  if (game.status !== 'ACTIVE') throw new Error('Game not active');
  if (game.currentTurnPlayerId !== playerId) throw new Error('Not your turn');
  
  // 2. Validate target
  const targetPlayer = game.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer || targetPlayer.isEliminated) throw new Error('Invalid target');
  
  // 3. Validate letter
  letter = letter.toUpperCase();
  if (targetPlayer.guessedLetters.has(letter)) throw new Error('Letter already guessed');
  
  // 4. Check if letter in word
  const positions = findLetterPositions(targetPlayer.secretWord, letter);
  const isCorrect = positions.length > 0;
  
  // 5. Update state if correct
  if (isCorrect) {
    positions.forEach(pos => {
      targetPlayer.revealedPositions[pos] = true;
    });
    
    const points = scoringEngine.calculateScore(letter, positions.length);
    targetPlayer.score += points;
    
    // Check if word completed
    if (targetPlayer.revealedPositions.every(p => p)) {
      targetPlayer.isEliminated = true;
    }
  }
  
  // 6. Record turn
  await recordTurn({
    gameId,
    playerId,
    targetPlayerId,
    guessedLetter: letter,
    isCorrect,
    positionsRevealed: positions,
    pointsScored: isCorrect ? scoringEngine.calculateScore(letter, positions.length) : 0
  });
  
  // 7. If incorrect, advance turn
  if (!isCorrect) {
    advanceTurn(game);
  }
  
  // 8. Check game over
  if (checkGameOver(game)) {
    await finalizeGame(game);
  }
  
  return {
    isCorrect,
    positions,
    pointsScored: isCorrect ? scoringEngine.calculateScore(letter, positions.length) : 0,
    wordCompleted: targetPlayer.isEliminated,
    gameOver: game.status === 'COMPLETED'
  };
}

function checkGameOver(game: GameState): boolean {
  // Game over when all but one player eliminated
  // OR when all words revealed
  const activePlayers = game.players.filter(p => !p.isEliminated);
  return activePlayers.length <= 1;
}
```

---

## 8. Deployment Architecture

### 8.1 Podman Container Setup

#### Container Structure
```
probe-app/
├── containers/
│   ├── app/
│   │   ├── Containerfile
│   │   └── .dockerignore
│   ├── db/
│   │   └── init.sql
│   └── nginx/
│       └── nginx.conf
├── podman-compose.yml
└── .env.example
```

#### Podman Compose Configuration

```yaml
# podman-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: probe-db
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - probe-db-data:/var/lib/postgresql/data
      - ./containers/db/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: ./containers/app/Containerfile
    container_name: probe-app
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  nginx:
    image: nginx:alpine
    container_name: probe-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./containers/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  probe-db-data:
    driver: local

networks:
  default:
    name: probe-network
```

#### Application Containerfile

```dockerfile
# containers/app/Containerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build frontend and backend
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### 8.2 Python venv Deployment (Alternative)

#### Directory Structure
```
probe-app/
├── venv/                  # Python virtual environment
├── backend/               # Node.js backend
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── start.sh
├── requirements.txt       # Python tools (if needed)
└── .env
```

#### Setup Script (macOS M4 Pro)

```bash
#!/bin/bash
# scripts/setup.sh

set -e

echo "🎮 Setting up Probe Game..."

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
brew install node postgresql@16 podman podman-compose

# Start PostgreSQL
echo "🗄️  Starting PostgreSQL..."
brew services start postgresql@16

# Create database
echo "Creating database..."
createdb probe_game || echo "Database already exists"

# Setup backend
echo "🔧 Setting up backend..."
cd backend
npm install
npx prisma generate
npx prisma migrate deploy

# Setup frontend
echo "🎨 Setting up frontend..."
cd ../frontend
npm install
npm run build

# Python venv (if needed for tooling)
echo "🐍 Setting up Python environment..."
cd ..
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt || echo "No Python requirements"

echo "✅ Setup complete!"
echo "Run './scripts/start.sh' to start the application"
```

#### Startup Script

```bash
#!/bin/bash
# scripts/start.sh

set -e

echo "🚀 Starting Probe Game..."

# Check environment
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Copy .env.example to .env and configure"
    exit 1
fi

# Load environment
export $(cat .env | xargs)

# Start database
echo "Starting database..."
pg_ctl -D /usr/local/var/postgresql@16 start || brew services start postgresql@16

# Start backend
echo "Starting backend server..."
cd backend
npm run start &
BACKEND_PID=$!

# Wait for backend
sleep 3

# Serve frontend (production)
echo "Frontend available at http://localhost:5200"

echo "✅ Application running!"
echo "Backend PID: $BACKEND_PID"
echo "Press Ctrl+C to stop"

wait $BACKEND_PID
```

### 8.3 Deployment Checklist

#### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations up to date
- [ ] SSL certificates obtained (Let's Encrypt)
- [ ] Dictionary file loaded
- [ ] Frontend built for production
- [ ] Backend tests passing
- [ ] Security audit completed

#### Deployment Steps
1. **Podman Deployment**
   ```bash
   # Build containers
   podman-compose build
   
   # Start services
   podman-compose up -d
   
   # Check logs
   podman-compose logs -f app
   
   # Run migrations
   podman exec probe-app npm run migrate
   ```

2. **Native Deployment (venv)**
   ```bash
   # Run setup
   ./scripts/setup.sh
   
   # Start application
   ./scripts/start.sh
   
   # Monitor logs
   tail -f logs/app.log
   ```

#### Post-Deployment
- [ ] Health checks passing
- [ ] WebSocket connections working
- [ ] Database connections stable
- [ ] SSL/TLS configured
- [ ] Backup strategy implemented
- [ ] Monitoring configured (optional: Prometheus/Grafana)
- [ ] Log rotation configured

---

## 9. Development Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project structure setup
- [ ] Database schema implementation
- [ ] Backend API skeleton
- [ ] Authentication system
- [ ] Basic UI components (Tailwind)

### Phase 2: Core Gameplay (Weeks 3-4)
- [ ] Game state management
- [ ] Word validation system
- [ ] Turn-based logic
- [ ] Scoring engine
- [ ] Socket.io integration

### Phase 3: User Interface (Weeks 5-6)
- [ ] Lobby system
- [ ] Game board interface
- [ ] Responsive layouts
- [ ] Animations and transitions
- [ ] Mobile optimization

### Phase 4: Real-time Features (Week 7)
- [ ] WebSocket event handlers
- [ ] State synchronization
- [ ] Reconnection handling
- [ ] Optimistic updates

### Phase 5: Testing & Polish (Week 8)
- [ ] Unit tests
- [ ] Integration tests
- [ ] UI/UX testing
- [ ] Performance optimization
- [ ] Bug fixes

### Phase 6: Deployment (Week 9)
- [ ] Podman setup
- [ ] Mac Mini M4 deployment
- [ ] SSL configuration
- [ ] Monitoring setup
- [ ] Documentation

### Phase 7: Post-Launch (Week 10+)
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Feature enhancements
- [ ] Bug fixes and patches

---

## 10. Testing Strategy

### 10.1 Test Coverage Goals
- Unit Tests: 80%+ coverage
- Integration Tests: Critical paths
- E2E Tests: Full game flow
- Performance Tests: Load testing

### 10.2 Test Categories

#### Backend Tests
```typescript
// Example: Word validation tests
describe('WordValidator', () => {
  it('should accept valid words', () => {
    expect(validator.isValidWord('PROBE')).toBe(true);
  });
  
  it('should reject words with invalid length', () => {
    expect(validator.isValidWord('CAT')).toBe(false);
    expect(validator.isValidWord('EXTRAORDINARY')).toBe(false);
  });
  
  it('should reject proper nouns', () => {
    expect(validator.isValidWord('PARIS')).toBe(false);
  });
});

// Example: Scoring tests
describe('ScoringEngine', () => {
  it('should calculate correct scores', () => {
    expect(engine.calculateScore('E', 3)).toBe(3); // 1pt × 3
    expect(engine.calculateScore('Q', 1)).toBe(10); // 10pt × 1
  });
});

// Example: Game logic tests
describe('GameManager', () => {
  it('should process correct guess', async () => {
    const result = await manager.processGuess(gameId, playerId, targetId, 'E');
    expect(result.isCorrect).toBe(true);
    expect(result.positions).toContain(4);
  });
  
  it('should end turn on incorrect guess', async () => {
    const result = await manager.processGuess(gameId, playerId, targetId, 'Z');
    expect(result.isCorrect).toBe(false);
    expect(game.currentTurnIndex).not.toBe(previousIndex);
  });
});
```

#### Frontend Tests
```typescript
// Component tests
describe('GameBoard', () => {
  it('should render all player boards', () => {
    const { getAllByTestId } = render(<GameBoard players={mockPlayers} />);
    expect(getAllByTestId('player-board')).toHaveLength(4);
  });
  
  it('should highlight active player', () => {
    const { getByTestId } = render(<GameBoard activePlayerId="123" />);
    expect(getByTestId('player-123')).toHaveClass('active');
  });
});

// Integration tests
describe('Game Flow', () => {
  it('should complete full game', async () => {
    // Create game
    // Join players
    // Select words
    // Play turns
    // Verify winner
  });
});
```

### 10.3 Performance Testing
- Load test: 100 concurrent games
- Stress test: 500 WebSocket connections
- Spike test: Sudden player influx
- Endurance test: 24-hour stability

---

## 11. Security Considerations

### 11.1 Authentication & Authorization
- JWT tokens with short expiration (15 min)
- Refresh token rotation
- Rate limiting on all endpoints
- CORS configuration

### 11.2 Game Security
- Server-authoritative game logic
- Input validation on all client data
- Word hashing to prevent cheating
- Anti-tampering checks
- Rate limiting on guesses

### 11.3 Infrastructure Security
- HTTPS only (TLS 1.3)
- Secure WebSocket (WSS)
- Environment variable management
- Database connection encryption
- Regular security updates
- Container security scanning

---

## 12. Performance Optimization

### 12.1 Frontend Optimization
- Code splitting by route
- Lazy loading components
- Image optimization
- CSS purging (Tailwind)
- Service Worker for PWA (optional)
- Memoization of expensive renders

### 12.2 Backend Optimization
- Database connection pooling
- Query optimization with indexes
- Redis caching for game state (optional)
- Compression (gzip/brotli)
- WebSocket message batching

### 12.3 Network Optimization
- CDN for static assets
- HTTP/2 server push
- Minimize payload sizes
- Debounce client events
- Optimize Socket.io handshake

---

## 13. Monitoring & Logging

### 13.1 Application Monitoring
- Error tracking (Sentry optional)
- Performance monitoring
- User session tracking
- Game analytics
  - Games per day
  - Average game duration
  - Player retention
  - Popular word lengths

### 13.2 Infrastructure Monitoring
- CPU/Memory usage
- Database performance
- WebSocket connection count
- Response times
- Error rates

### 13.3 Logging Strategy
```typescript
// Structured logging
logger.info('Game started', {
  gameId,
  playerCount,
  roomCode
});

logger.warn('Player disconnected', {
  playerId,
  gameId,
  duration: connectionTime
});

logger.error('Database error', {
  error: err.message,
  stack: err.stack,
  query
});
```

---

## 14. Future Enhancements

### 14.1 Short-term (Post-MVP)
- [ ] Player profiles and stats
- [ ] Game history
- [ ] Leaderboards
- [ ] Custom word lists
- [ ] Time limits per turn
- [ ] Hint system
- [ ] Spectator mode

### 14.2 Medium-term
- [ ] Tournament mode
- [ ] Team play (2v2)
- [ ] Power-ups/special abilities
- [ ] Daily challenges
- [ ] Achievement system
- [ ] Social features (friends, invites)
- [ ] Mobile app (React Native)

### 14.3 Long-term
- [ ] AI opponents
- [ ] Voice chat integration
- [ ] Customizable themes
- [ ] Multiple languages
- [ ] Replay system
- [ ] Competitive ranked mode

---

## 15. Documentation Plan

### 15.1 Developer Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema docs
- [ ] Component library (Storybook)
- [ ] Architecture decision records
- [ ] Setup guides
- [ ] Contributing guidelines

### 15.2 User Documentation
- [ ] Game rules
- [ ] How to play guide
- [ ] FAQ
- [ ] Troubleshooting
- [ ] Privacy policy
- [ ] Terms of service

---

## 16. Budget & Resources

### 16.1 Infrastructure Costs
- **Mac Mini M4 Pro**: One-time (already owned)
- **Domain name**: ~$15/year
- **SSL Certificate**: Free (Let's Encrypt)
- **Electricity**: ~$5/month (M4 Pro efficient)
- **Total annual**: ~$75

### 16.2 Development Tools
- All open-source (Node, React, PostgreSQL, Podman)
- Optional: Premium monitoring services (~$20-50/month)

### 16.3 Time Estimate
- **Initial Development**: 9-10 weeks
- **Testing & QA**: 1-2 weeks
- **Deployment**: 1 week
- **Maintenance**: Ongoing (2-4 hours/week)

---

## 17. Success Metrics

### 17.1 Technical Metrics
- **Uptime**: 99.5%+ availability
- **Response Time**: < 100ms API responses
- **WebSocket Latency**: < 50ms
- **Error Rate**: < 0.1%
- **Database Query Time**: < 20ms average

### 17.2 User Metrics
- **Games per Day**: Target 50+ in first month
- **Player Retention**: 40%+ return within 7 days
- **Average Game Duration**: 10-15 minutes
- **Player Satisfaction**: 4+ stars (if ratings added)

---

## 18. Risk Assessment

### 18.1 Technical Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WebSocket instability | High | Medium | Reconnection logic, fallback polling |
| Database bottleneck | High | Low | Connection pooling, caching |
| State synchronization issues | High | Medium | Server authoritative, periodic sync |
| Mobile browser compatibility | Medium | Medium | Thorough testing, polyfills |
| Dictionary loading time | Low | Low | Pre-load, caching |

### 18.2 Project Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Scope creep | Medium | High | Strict MVP definition |
| Timeline delays | Medium | Medium | Buffer time, phased releases |
| User adoption | High | Medium | Marketing, user feedback |
| Cheating/exploits | Medium | Medium | Server validation, monitoring |

---

## 19. Quick Start Commands

### 19.1 Development
```bash
# Clone repository
git clone <repo-url>
cd probe

# Install dependencies
npm install

# Setup database
npx prisma migrate dev

# Start development servers
npm run dev        # Runs both frontend and backend

# Run tests
npm test

# Build for production
npm run build
```

### 19.2 Deployment (Podman)
```bash
# Build containers
podman-compose build

# Start services
podman-compose up -d

# View logs
podman-compose logs -f

# Stop services
podman-compose down

# Rebuild and restart
podman-compose up -d --build
```

### 19.3 Deployment (Native)
```bash
# Initial setup
./scripts/setup.sh

# Start application
./scripts/start.sh

# Stop application
pkill -f "node.*backend"
```

---

## 20. Conclusion

This comprehensive plan provides a roadmap for building a modern, multiplayer implementation of the Probe word game. The architecture is designed to be:

- **Scalable**: Handles 2-4 players per game with potential for many concurrent games
- **Responsive**: Works on iPhone and desktop browsers with Tailwind CSS
- **Real-time**: Socket.io provides smooth, synchronized gameplay
- **Deployable**: Both Podman containerization and native deployment on Mac Mini M4 Pro
- **Maintainable**: Clear architecture, comprehensive testing, good documentation

### Key Success Factors
1. ✅ Faithful to original Probe game rules and scoring
2. ✅ Beautiful, accessible UI that works on any device
3. ✅ Real-time multiplayer with excellent synchronization
4. ✅ Easy deployment and maintenance
5. ✅ Room for future enhancements

### Next Steps
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1: Foundation
4. Iterate based on testing and feedback

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-29  
**Author**: GitHub Copilot  
**Status**: Ready for Review
