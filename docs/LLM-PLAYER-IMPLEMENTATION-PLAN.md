# LLM Player Implementation Plan

## Overview

This plan details the implementation of an LLM-powered bot player system for Probe, allowing users on the hosting system to add AI players using locally-served Ollama models.

## Key Requirements

1. **Local-only access**: Only users on the hosting machine can add/configure bot players
2. **Model selection**: Choose from available Ollama models (downloaded or pullable)
3. **Custom naming**: Bot players can have custom display names
4. **Parameter configuration**: Support Ollama and model-specific parameters (temperature, top_p, etc.)
5. **Multiple bots**: Support multiple bot players in a single game
6. **Seamless integration**: Bots participate like regular players via the existing game flow

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                    │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │   Lobby.tsx │  │ BotConfigModal   │  │ Game.tsx (shows bot players)│ │
│  │ (Add Bot UI)│  │ (name, model,    │  │                             │ │
│  │             │  │  parameters)     │  │                             │ │
│  └─────────────┘  └──────────────────┘  └─────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Socket.io / REST API
┌────────────────────────────────▼────────────────────────────────────────┐
│                              Backend                                     │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │   Routes    │  │   BotManager     │  │      GameManager            │ │
│  │ /api/bot/*  │──│ - Bot lifecycle  │──│ - Treats bots as players    │ │
│  │             │  │ - Turn handling  │  │ - sanitizeGame hides bot    │ │
│  └─────────────┘  │ - Event response │  │   words from humans         │ │
│                   └────────┬─────────┘  └─────────────────────────────┘ │
│                            │                                             │
│  ┌─────────────────────────▼─────────────────────────────────────────┐  │
│  │                      OllamaService                                 │  │
│  │  - List available models (GET /api/tags)                          │  │
│  │  - Generate responses (POST /api/generate)                        │  │
│  │  - Pull models (POST /api/pull)                                   │  │
│  │  - Model info (POST /api/show)                                    │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────│──────────────────────────────────────────┘
                               │ HTTP (localhost:11434)
                       ┌───────▼───────┐
                       │ Ollama Server │
                       │  (local LLM)  │
                       └───────────────┘
```

---

## Implementation Phases

### Phase 1: Ollama Service Layer

**Files to create:**
- `backend/src/bot/OllamaService.ts`
- `backend/src/bot/types.ts`

**Functionality:**
```typescript
// backend/src/bot/types.ts
export interface OllamaModel {
  name: string;           // e.g., "llama3.2:3b"
  size: number;           // bytes
  digest: string;
  modified_at: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaGenerateOptions {
  temperature?: number;      // 0.0-2.0, default 0.7
  top_p?: number;           // 0.0-1.0, default 0.9
  top_k?: number;           // default 40
  num_predict?: number;     // max tokens, default 100
  stop?: string[];          // stop sequences
  repeat_penalty?: number;  // default 1.1
  seed?: number;            // for reproducibility
}

export interface BotConfig {
  id: string;
  displayName: string;
  modelName: string;
  ollamaOptions: OllamaGenerateOptions;
  personality?: string;     // optional system prompt modifier
  difficulty?: 'easy' | 'medium' | 'hard';
}
```

```typescript
// backend/src/bot/OllamaService.ts
export class OllamaService {
  constructor(private baseUrl = 'http://localhost:11434') {}

  // Check if Ollama is running
  async isAvailable(): Promise<boolean>;

  // List downloaded models
  async listModels(): Promise<OllamaModel[]>;

  // Get model details
  async getModelInfo(modelName: string): Promise<ModelInfo>;

  // Pull a model (for UI that allows downloading)
  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<void>;

  // Generate text response
  async generate(
    modelName: string,
    prompt: string,
    options?: OllamaGenerateOptions
  ): Promise<string>;

  // Chat completion (maintains context)
  async chat(
    modelName: string,
    messages: ChatMessage[],
    options?: OllamaGenerateOptions
  ): Promise<string>;
}
```

**Tasks:**
1. Create `backend/src/bot/types.ts` with all type definitions
2. Implement `OllamaService` class with error handling and timeouts
3. Add health check endpoint
4. Add unit tests for OllamaService

---

### Phase 2: Bot Strategy Engine

**Files to create:**
- `backend/src/bot/strategies/WordSelectionStrategy.ts`
- `backend/src/bot/strategies/LetterGuessStrategy.ts`
- `backend/src/bot/strategies/WordGuessStrategy.ts`
- `backend/src/bot/strategies/PositionSelectionStrategy.ts`
- `backend/src/bot/strategies/index.ts`

**Core Strategy Interface:**
```typescript
// backend/src/bot/strategies/types.ts
export interface GameContext {
  roomCode: string;
  botPlayerId: string;
  players: PlayerInfo[];
  myWord?: string;
  myRevealedPositions?: boolean[];
  currentTurnPlayerId: string;
}

export interface PlayerInfo {
  id: string;
  displayName: string;
  wordLength: number;
  revealedPositions: (string | null)[];  // letter or null
  missedLetters: string[];
  totalScore: number;
  isEliminated: boolean;
  isBot: boolean;
}

export interface BotStrategy {
  selectWord(ctx: GameContext, config: BotConfig): Promise<{
    word: string;
    frontPadding: number;
    backPadding: number;
  }>;

  selectTarget(ctx: GameContext, config: BotConfig): Promise<string>;  // targetPlayerId

  guessLetter(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;

  shouldGuessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;

  guessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;

  selectBlankPosition(positions: number[], ctx: GameContext, config: BotConfig): Promise<number>;

  selectDuplicatePosition(
    positions: number[],
    letter: string,
    ctx: GameContext,
    config: BotConfig
  ): Promise<number>;
}
```

**Word Selection Strategy:**
```typescript
// backend/src/bot/strategies/WordSelectionStrategy.ts
export class WordSelectionStrategy {
  constructor(
    private ollama: OllamaService,
    private wordValidator: WordValidator
  ) {}

  async selectWord(ctx: GameContext, config: BotConfig): Promise<WordSelection> {
    const difficultyPrompts = {
      easy: 'Choose a common English word that most people would know.',
      medium: 'Choose a moderately difficult English word.',
      hard: 'Choose an uncommon word with unusual letter patterns.'
    };

    const prompt = `You are playing a word guessing game.
${difficultyPrompts[config.difficulty || 'medium']}

Requirements:
- Word must be 4-12 letters
- Must be a valid English dictionary word
- Consider strategic letter choices

${config.personality ? `Your personality: ${config.personality}` : ''}

Return ONLY the word in uppercase, nothing else.`;

    let attempts = 0;
    while (attempts < 3) {
      const response = await this.ollama.generate(config.modelName, prompt, config.ollamaOptions);
      const word = response.trim().toUpperCase().replace(/[^A-Z]/g, '');

      if (word.length >= 4 && word.length <= 12) {
        const isValid = await this.wordValidator.isValidWord(word);
        if (isValid) {
          return { word, frontPadding: 0, backPadding: 0 };
        }
      }
      attempts++;
    }

    // Fallback to a safe word
    return { word: 'PUZZLE', frontPadding: 0, backPadding: 0 };
  }
}
```

**Letter Guessing Strategy:**
```typescript
// backend/src/bot/strategies/LetterGuessStrategy.ts
export class LetterGuessStrategy {
  constructor(private ollama: OllamaService) {}

  async guessLetter(
    ctx: GameContext,
    targetPlayer: PlayerInfo,
    config: BotConfig
  ): Promise<string> {
    // Build pattern string: "•A••E••" format
    const pattern = targetPlayer.revealedPositions
      .map(pos => pos || '•')
      .join('');

    // Get all letters already tried (revealed + missed)
    const revealedLetters = targetPlayer.revealedPositions
      .filter(p => p !== null) as string[];
    const triedLetters = [...new Set([...revealedLetters, ...targetPlayer.missedLetters])];

    const prompt = `You are guessing letters in a word guessing game.

Target word information:
- Length: ${targetPlayer.wordLength} positions
- Current pattern: ${pattern} (• = unknown)
- Letters already revealed: ${revealedLetters.join(', ') || 'none'}
- Letters tried but missed: ${targetPlayer.missedLetters.join(', ') || 'none'}

English letter frequency (most to least common): E, T, A, O, I, N, S, H, R, D, L, C, U, M, W, F, G, Y, P, B, V, K, J, X, Q, Z

Strategy tips:
- First guess common vowels (E, A, I, O) if not tried
- Then common consonants (T, N, S, R, L)
- Consider what English words could match the pattern
- Avoid letters that don't fit possible word patterns

${config.personality ? `Your personality: ${config.personality}` : ''}

What single letter should I guess next? Return ONLY one letter.`;

    const response = await this.ollama.generate(config.modelName, prompt, config.ollamaOptions);
    let letter = response.trim().toUpperCase().replace(/[^A-Z]/g, '')[0];

    // Fallback if LLM gives invalid response
    if (!letter || triedLetters.includes(letter)) {
      const frequency = 'ETAOINSHRLDCUMWFGYPBVKJXQZ';
      letter = frequency.split('').find(l => !triedLetters.includes(l)) || 'E';
    }

    return letter;
  }
}
```

**Tasks:**
1. Implement `WordSelectionStrategy` with validation loop
2. Implement `LetterGuessStrategy` with pattern analysis
3. Implement `WordGuessStrategy` for full word attempts
4. Implement `PositionSelectionStrategy` for blank/duplicate choices
5. Create unified `BotStrategy` class combining all strategies
6. Add comprehensive unit tests with mocked Ollama responses

---

### Phase 3: Bot Manager (Core Bot Lifecycle)

**Files to create:**
- `backend/src/bot/BotManager.ts`
- `backend/src/bot/BotPlayer.ts`

**BotPlayer Class:**
```typescript
// backend/src/bot/BotPlayer.ts
export class BotPlayer {
  public readonly id: string;
  public readonly odisplayName: string;
  public readonly isBot = true;

  private strategy: BotStrategy;
  private thinkingDelay: number;  // ms to simulate "thinking"

  constructor(
    public readonly config: BotConfig,
    private ollama: OllamaService,
    private wordValidator: WordValidator
  ) {
    this.id = `bot_${crypto.randomUUID()}`;
    this.displayName = config.displayName;
    this.strategy = new BotStrategy(ollama, wordValidator);
    this.thinkingDelay = this.calculateThinkingDelay(config.difficulty);
  }

  private calculateThinkingDelay(difficulty?: string): number {
    // Harder bots "think" longer (more realistic)
    switch (difficulty) {
      case 'easy': return 1000;    // 1 second
      case 'hard': return 4000;    // 4 seconds
      default: return 2000;        // 2 seconds
    }
  }

  async selectWord(ctx: GameContext): Promise<WordSelection> {
    await this.simulateThinking();
    return this.strategy.selectWord(ctx, this.config);
  }

  async takeTurn(ctx: GameContext): Promise<TurnAction> {
    await this.simulateThinking();

    // Select target (non-eliminated, non-self player)
    const targetId = await this.strategy.selectTarget(ctx, this.config);
    const target = ctx.players.find(p => p.id === targetId)!;

    // Decide: letter guess or word guess?
    const shouldGuessWord = await this.strategy.shouldGuessWord(ctx, target, this.config);

    if (shouldGuessWord) {
      const word = await this.strategy.guessWord(ctx, target, this.config);
      return { type: 'wordGuess', targetPlayerId: targetId, word };
    }

    const letter = await this.strategy.guessLetter(ctx, target, this.config);
    return { type: 'letterGuess', targetPlayerId: targetId, letter };
  }

  async selectBlankPosition(positions: number[], ctx: GameContext): Promise<number> {
    await this.simulateThinking(500);  // Shorter for position selection
    return this.strategy.selectBlankPosition(positions, ctx, this.config);
  }

  async selectDuplicatePosition(positions: number[], letter: string, ctx: GameContext): Promise<number> {
    await this.simulateThinking(500);
    return this.strategy.selectDuplicatePosition(positions, letter, ctx, this.config);
  }

  private simulateThinking(overrideMs?: number): Promise<void> {
    const delay = overrideMs ?? this.thinkingDelay;
    // Add some randomness (±30%)
    const variance = delay * 0.3;
    const actualDelay = delay + (Math.random() * variance * 2 - variance);
    return new Promise(resolve => setTimeout(resolve, actualDelay));
  }
}
```

**BotManager Class:**
```typescript
// backend/src/bot/BotManager.ts
export class BotManager {
  private bots: Map<string, BotPlayer> = new Map();  // odotId -> BotPlayer
  private gameBots: Map<string, Set<string>> = new Map();  // roomCode -> Set<botId>

  constructor(
    private ollama: OllamaService,
    private wordValidator: WordValidator
  ) {}

  // Create and register a new bot
  createBot(config: BotConfig): BotPlayer {
    const bot = new BotPlayer(config, this.ollama, this.wordValidator);
    this.bots.set(bot.id, bot);
    return bot;
  }

  // Add bot to a specific game
  addBotToGame(botId: string, roomCode: string): void {
    if (!this.gameBots.has(roomCode)) {
      this.gameBots.set(roomCode, new Set());
    }
    this.gameBots.get(roomCode)!.add(botId);
  }

  // Remove bot from game
  removeBotFromGame(botId: string, roomCode: string): void {
    this.gameBots.get(roomCode)?.delete(botId);
    // Optionally destroy bot if not in any game
  }

  // Get all bots in a game
  getBotsInGame(roomCode: string): BotPlayer[] {
    const botIds = this.gameBots.get(roomCode) || new Set();
    return Array.from(botIds)
      .map(id => this.bots.get(id))
      .filter(Boolean) as BotPlayer[];
  }

  // Get specific bot
  getBot(botId: string): BotPlayer | undefined {
    return this.bots.get(botId);
  }

  // Check if a player ID is a bot
  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  // Handle bot's turn (called by game logic)
  async handleBotTurn(
    botId: string,
    gameContext: GameContext,
    onAction: (action: TurnAction) => Promise<void>
  ): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error('Bot not found');

    const action = await bot.takeTurn(gameContext);
    await onAction(action);
  }

  // Cleanup when game ends
  cleanupGame(roomCode: string): void {
    const botIds = this.gameBots.get(roomCode);
    if (botIds) {
      botIds.forEach(id => this.bots.delete(id));
      this.gameBots.delete(roomCode);
    }
  }
}
```

**Tasks:**
1. Implement `BotPlayer` class with strategy integration
2. Implement `BotManager` for bot lifecycle management
3. Add "thinking" simulation with configurable delays
4. Add cleanup hooks for game end/abort
5. Write integration tests

---

### Phase 4: Database Schema Updates

**File to modify:**
- `backend/prisma/schema.prisma`

**Schema Changes:**
```prisma
// Add to existing schema

model BotConfiguration {
  id            String   @id @default(uuid())
  displayName   String
  modelName     String   // e.g., "llama3.2:3b"
  options       Json     // OllamaGenerateOptions
  personality   String?
  difficulty    String   @default("medium")  // easy, medium, hard
  createdAt     DateTime @default(now())

  // Bots can be saved as presets
  isPreset      Boolean  @default(false)
  presetName    String?

  gamePlayers   GamePlayer[]
}

// Modify GamePlayer to support bots
model GamePlayer {
  id                String    @id @default(uuid())
  gameId            String
  game              Game      @relation(fields: [gameId], references: [id], onDelete: Cascade)

  // Human player (nullable for bots)
  userId            String?
  user              User?     @relation(fields: [userId], references: [id])

  // Bot configuration (nullable for humans)
  botConfigId       String?
  botConfig         BotConfiguration? @relation(fields: [botConfigId], references: [id])

  // Flag to easily identify bots
  isBot             Boolean   @default(false)

  // Rest of existing fields...
  secretWord        String?
  secretWordHash    String?
  paddedWord        String?
  frontPadding      Int       @default(0)
  backPadding       Int       @default(0)
  revealedPositions Json      @default("[]")
  missedLetters     String[]  @default([])
  totalScore        Int       @default(0)
  isEliminated      Boolean   @default(false)
  turnOrder         Int

  @@unique([gameId, oduserId])
  @@unique([gameId, botConfigId])
}
```

**Tasks:**
1. Add `BotConfiguration` model
2. Modify `GamePlayer` to support bot players
3. Create migration
4. Update `GameManager` queries to handle bot players

---

### Phase 5: API Routes for Bot Management

**Files to create:**
- `backend/src/routes/bot.ts`

**File to modify:**
- `backend/src/server.ts` (register routes)

**API Endpoints:**
```typescript
// backend/src/routes/bot.ts
import { Router } from 'express';
import { requireLocalhost } from '../middleware/localOnly';

const router = Router();

// All bot routes require localhost access
router.use(requireLocalhost);

// GET /api/bot/ollama/status
// Check if Ollama is running and accessible
router.get('/ollama/status', async (req, res) => {
  const isAvailable = await ollamaService.isAvailable();
  res.json({ available: isAvailable });
});

// GET /api/bot/ollama/models
// List available Ollama models
router.get('/ollama/models', async (req, res) => {
  const models = await ollamaService.listModels();
  res.json({ models });
});

// GET /api/bot/ollama/models/:name
// Get details about a specific model
router.get('/ollama/models/:name', async (req, res) => {
  const info = await ollamaService.getModelInfo(req.params.name);
  res.json(info);
});

// POST /api/bot/ollama/pull
// Pull/download a model (long-running, use SSE for progress)
router.post('/ollama/pull', async (req, res) => {
  const { modelName } = req.body;
  // Stream progress updates
  res.setHeader('Content-Type', 'text/event-stream');
  await ollamaService.pullModel(modelName, (status) => {
    res.write(`data: ${JSON.stringify({ status })}\n\n`);
  });
  res.end();
});

// POST /api/bot/create
// Create a bot configuration
router.post('/create', async (req, res) => {
  const { displayName, modelName, options, personality, difficulty } = req.body;
  // Validate model exists
  // Create BotConfiguration in DB or in-memory
  // Return bot config with ID
});

// GET /api/bot/presets
// List saved bot presets
router.get('/presets', async (req, res) => {
  const presets = await prisma.botConfiguration.findMany({
    where: { isPreset: true }
  });
  res.json({ presets });
});

// POST /api/bot/presets
// Save a bot configuration as a preset
router.post('/presets', async (req, res) => {
  const { displayName, modelName, options, personality, difficulty, presetName } = req.body;
  const preset = await prisma.botConfiguration.create({
    data: { displayName, modelName, options, personality, difficulty, isPreset: true, presetName }
  });
  res.json(preset);
});

// DELETE /api/bot/presets/:id
// Delete a bot preset
router.delete('/presets/:id', async (req, res) => {
  await prisma.botConfiguration.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
```

**Localhost Middleware:**
```typescript
// backend/src/middleware/localOnly.ts
export function requireLocalhost(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (!isLocal) {
    return res.status(403).json({
      error: 'Bot management is only available from localhost'
    });
  }

  next();
}
```

**Tasks:**
1. Create `requireLocalhost` middleware
2. Implement all bot API routes
3. Add request validation with Zod
4. Register routes in server.ts
5. Add API tests

---

### Phase 6: Socket Events for Bot Integration

**File to modify:**
- `backend/src/socket/index.ts`

**New Socket Events:**
```typescript
// Add to socket/index.ts

// Add bot to game (host only, localhost only)
socket.on('addBotToGame', async (data: {
  roomCode: string;
  botConfig: BotConfig;
}) => {
  // Verify localhost
  const ip = socket.handshake.address;
  if (!isLocalhost(ip)) {
    socket.emit('error', { message: 'Bot management requires localhost access' });
    return;
  }

  // Verify host
  const game = await gameManager.getGameByRoomCode(data.roomCode);
  if (game.hostId !== socket.userId) {
    socket.emit('error', { message: 'Only host can add bots' });
    return;
  }

  // Create and add bot
  const bot = botManager.createBot(data.botConfig);
  await gameManager.addBotPlayer(data.roomCode, bot);
  botManager.addBotToGame(bot.id, data.roomCode);

  // Notify all players
  io.to(data.roomCode).emit('botJoined', {
    odotId: bot.id,
    displayName: bot.displayName,
    modelName: data.botConfig.modelName,
    game: await gameManager.getGameByRoomCode(data.roomCode)
  });
});

// Remove bot from game (host only)
socket.on('removeBotFromGame', async (data: {
  roomCode: string;
  botId: string;
}) => {
  // Similar validation...
  await gameManager.removeBotPlayer(data.roomCode, data.botId);
  botManager.removeBotFromGame(data.botId, data.roomCode);

  io.to(data.roomCode).emit('botLeft', {
    botId: data.botId,
    game: await gameManager.getGameByRoomCode(data.roomCode)
  });
});
```

**Modify Turn Handling:**
```typescript
// In the turn advancement logic, check if next player is a bot
async function advanceToNextPlayer(roomCode: string, game: Game) {
  const nextPlayerId = game.currentTurnPlayerId;

  if (botManager.isBot(nextPlayerId)) {
    // Trigger bot turn after short delay
    setTimeout(async () => {
      const bot = botManager.getBot(nextPlayerId);
      const ctx = buildGameContext(game, nextPlayerId);

      await botManager.handleBotTurn(nextPlayerId, ctx, async (action) => {
        if (action.type === 'letterGuess') {
          // Emit the guess as if from the bot
          const result = await gameManager.processGuess(
            roomCode,
            nextPlayerId,
            action.targetPlayerId,
            action.letter
          );
          io.to(roomCode).emit('letterGuessed', result);
          // Continue game logic...
        } else if (action.type === 'wordGuess') {
          // Handle word guess...
        }
      });
    }, 500);  // Small delay before bot starts "thinking"
  }
}
```

**Tasks:**
1. Add `addBotToGame` and `removeBotFromGame` socket events
2. Modify turn handling to detect and trigger bot turns
3. Handle bot word selection during word selection phase
4. Handle bot responses to blank/duplicate selection when targeted
5. Add bot action broadcasting (so humans see what bot did)

---

### Phase 7: GameManager Updates

**File to modify:**
- `backend/src/game/GameManager.ts`

**Changes Required:**

```typescript
// Add to GameManager class

// Add bot player to game
async addBotPlayer(roomCode: string, bot: BotPlayer): Promise<any> {
  const game = await prisma.game.findUnique({
    where: { roomCode },
    include: { players: true }
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== 'WAITING') throw new Error('Cannot add bot after game started');
  if (game.players.length >= game.maxPlayers) throw new Error('Game is full');

  // Create GamePlayer for bot
  const updatedGame = await prisma.game.update({
    where: { id: game.id },
    data: {
      players: {
        create: {
          odotConfigId: bot.config.id,  // If using DB storage
          isBot: true,
          turnOrder: game.players.length,
        }
      }
    },
    include: { players: { include: { user: true, botConfig: true } } }
  });

  return this.sanitizeGame(updatedGame);
}

// Remove bot player
async removeBotPlayer(roomCode: string, botId: string): Promise<any> {
  // Similar to removePlayer but for bots
}

// Modify sanitizeGame to handle bot players
private sanitizeGame(game: any, forUserId?: string): any {
  return {
    ...game,
    players: game.players.map((p: any) => ({
      id: p.id,
      userId: p.userId,
      odotId: p.botConfigId,
      isBot: p.isBot,
      displayName: p.isBot ? p.botConfig?.displayName : p.user?.displayName,
      // Hide secret word from other players (including bots' words)
      secretWord: p.userId === forUserId ? p.secretWord : undefined,
      // ... rest of player data
    }))
  };
}

// Handle bot word selection
async handleBotWordSelection(roomCode: string, botId: string, bot: BotPlayer): Promise<any> {
  const ctx = await this.buildGameContext(roomCode, botId);
  const selection = await bot.selectWord(ctx);

  return this.selectWord(
    roomCode,
    botId,  // Use bot ID as "userId"
    selection.word,
    selection.frontPadding,
    selection.backPadding
  );
}
```

**Tasks:**
1. Add `addBotPlayer` method
2. Add `removeBotPlayer` method
3. Modify `sanitizeGame` to handle bot display names
4. Modify `selectWord` to work with bot IDs
5. Modify `processGuess` to work with bot players
6. Add `buildGameContext` helper for bot strategy input
7. Update all player iterations to handle both humans and bots

---

### Phase 8: Frontend - Bot Configuration UI

**Files to create:**
- `frontend/src/components/BotConfigModal.tsx`
- `frontend/src/components/BotPlayerCard.tsx`
- `frontend/src/services/botApi.ts`
- `frontend/src/hooks/useOllama.ts`

**Files to modify:**
- `frontend/src/pages/Lobby.tsx`
- `frontend/src/store/slices/gameSlice.ts`

**Bot Configuration Modal:**
```tsx
// frontend/src/components/BotConfigModal.tsx
interface BotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: BotConfig) => void;
}

export function BotConfigModal({ isOpen, onClose, onAdd }: BotConfigModalProps) {
  const [displayName, setDisplayName] = useState('Bot Player');
  const [selectedModel, setSelectedModel] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [personality, setPersonality] = useState('');

  const { models, isLoading, error } = useOllamaModels();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add AI Player">
      {error && (
        <Alert type="error">
          Cannot connect to Ollama. Make sure it's running on localhost:11434
        </Alert>
      )}

      <div className="space-y-4">
        {/* Bot Name */}
        <div>
          <label>Bot Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter bot name..."
            maxLength={20}
          />
        </div>

        {/* Model Selection */}
        <div>
          <label>AI Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select a model...</option>
            {models.map(model => (
              <option key={model.name} value={model.name}>
                {model.name} ({formatBytes(model.size)})
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label>Difficulty</label>
          <div className="flex gap-2">
            {['easy', 'medium', 'hard'].map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d as any)}
                className={difficulty === d ? 'bg-blue-500' : 'bg-gray-200'}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <button onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-3 p-3 bg-gray-50 rounded">
            {/* Temperature */}
            <div>
              <label>Temperature: {temperature}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            {/* Personality */}
            <div>
              <label>Personality (optional)</label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g., 'Aggressive player who takes risks' or 'Cautious and methodical'"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => onAdd({
              displayName,
              modelName: selectedModel,
              difficulty,
              ollamaOptions: { temperature },
              personality: personality || undefined
            })}
            disabled={!selectedModel || !displayName}
          >
            Add Bot
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

**Lobby Updates:**
```tsx
// Additions to frontend/src/pages/Lobby.tsx

function Lobby() {
  const [showBotModal, setShowBotModal] = useState(false);
  const { isLocalhost } = useLocalhost();  // Hook to detect if on localhost

  const handleAddBot = async (config: BotConfig) => {
    socket.emit('addBotToGame', { roomCode, botConfig: config });
    setShowBotModal(false);
  };

  return (
    <div>
      {/* Existing lobby UI */}

      {/* Add Bot Button - Only visible on localhost and for host */}
      {isHost && isLocalhost && game.status === 'WAITING' && (
        <button
          onClick={() => setShowBotModal(true)}
          disabled={game.players.length >= 4}
        >
          + Add AI Player
        </button>
      )}

      {/* Player list showing both humans and bots */}
      <div className="player-list">
        {game.players.map(player => (
          player.isBot ? (
            <BotPlayerCard
              key={player.id}
              bot={player}
              canRemove={isHost && isLocalhost}
              onRemove={() => socket.emit('removeBotFromGame', {
                roomCode,
                botId: player.botId
              })}
            />
          ) : (
            <PlayerCard key={player.id} player={player} />
          )
        ))}
      </div>

      <BotConfigModal
        isOpen={showBotModal}
        onClose={() => setShowBotModal(false)}
        onAdd={handleAddBot}
      />
    </div>
  );
}
```

**Tasks:**
1. Create `BotConfigModal` component
2. Create `BotPlayerCard` component (shows bot with robot icon, model name)
3. Create `useOllamaModels` hook to fetch available models
4. Create `useLocalhost` hook to detect localhost access
5. Update `Lobby.tsx` with "Add AI Player" button
6. Update `gameSlice.ts` to handle bot player state
7. Handle `botJoined` and `botLeft` socket events
8. Style bot players differently in game UI (robot icon, "AI" badge)

---

### Phase 9: Frontend - Game UI Updates

**Files to modify:**
- `frontend/src/pages/Game.tsx`
- `frontend/src/components/PlayerBoard.tsx`

**Changes:**
- Show bot players with distinct styling (robot icon, model name badge)
- Display "Bot is thinking..." indicator when bot's turn
- Show bot actions in game log/feed
- Handle bot turn animations

```tsx
// Updates to PlayerBoard.tsx
function PlayerBoard({ player, isCurrentTurn }: PlayerBoardProps) {
  return (
    <div className={`player-board ${player.isBot ? 'bot-player' : ''}`}>
      <div className="player-header">
        {player.isBot && <RobotIcon className="w-5 h-5" />}
        <span className="player-name">{player.displayName}</span>
        {player.isBot && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 rounded">
            AI
          </span>
        )}
      </div>

      {isCurrentTurn && player.isBot && (
        <div className="thinking-indicator">
          <SpinnerIcon /> Bot is thinking...
        </div>
      )}

      {/* Rest of player board */}
    </div>
  );
}
```

**Tasks:**
1. Add bot visual indicators (icon, badge)
2. Add "thinking" animation during bot turns
3. Show bot model name on hover
4. Update turn indicator for bot turns
5. Handle bot elimination display

---

### Phase 10: Testing & Polish

**Files to create:**
- `backend/src/__tests__/BotManager.test.ts`
- `backend/src/__tests__/OllamaService.test.ts`
- `backend/src/__tests__/BotStrategies.test.ts`
- `frontend/src/__tests__/BotConfigModal.test.tsx`

**Testing Strategy:**
1. **Unit Tests**: Mock Ollama responses, test strategy logic
2. **Integration Tests**: Test full bot turn flow with mocked LLM
3. **E2E Tests**: Test adding bot to game and playing through

**Tasks:**
1. Write unit tests for all strategy classes
2. Write integration tests for BotManager
3. Write socket event tests
4. Add frontend component tests
5. Add E2E test for bot game flow
6. Performance testing (bot response times)
7. Error handling for Ollama connection failures
8. Graceful degradation when Ollama unavailable

---

## File Summary

### New Files to Create

| File | Description |
|------|-------------|
| `backend/src/bot/types.ts` | Type definitions for bot system |
| `backend/src/bot/OllamaService.ts` | Ollama API client |
| `backend/src/bot/BotPlayer.ts` | Individual bot player class |
| `backend/src/bot/BotManager.ts` | Bot lifecycle management |
| `backend/src/bot/strategies/WordSelectionStrategy.ts` | Word choice logic |
| `backend/src/bot/strategies/LetterGuessStrategy.ts` | Letter guessing logic |
| `backend/src/bot/strategies/WordGuessStrategy.ts` | Full word guess logic |
| `backend/src/bot/strategies/PositionSelectionStrategy.ts` | Blank/duplicate selection |
| `backend/src/bot/strategies/index.ts` | Strategy exports |
| `backend/src/routes/bot.ts` | Bot management REST API |
| `backend/src/middleware/localOnly.ts` | Localhost restriction middleware |
| `frontend/src/components/BotConfigModal.tsx` | Bot configuration UI |
| `frontend/src/components/BotPlayerCard.tsx` | Bot display in player list |
| `frontend/src/services/botApi.ts` | Bot API client |
| `frontend/src/hooks/useOllama.ts` | Ollama status/models hook |
| `frontend/src/hooks/useLocalhost.ts` | Localhost detection hook |

### Files to Modify

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add BotConfiguration model, modify GamePlayer |
| `backend/src/server.ts` | Register bot routes |
| `backend/src/socket/index.ts` | Add bot socket events, modify turn handling |
| `backend/src/game/GameManager.ts` | Add bot player methods |
| `frontend/src/pages/Lobby.tsx` | Add "Add AI Player" button |
| `frontend/src/pages/Game.tsx` | Bot turn handling, visual indicators |
| `frontend/src/components/PlayerBoard.tsx` | Bot styling |
| `frontend/src/store/slices/gameSlice.ts` | Bot player state |

---

## Configuration Options Summary

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `displayName` | string | "Bot Player" | Bot's display name in game |
| `modelName` | string | required | Ollama model (e.g., "llama3.2:3b") |
| `difficulty` | enum | "medium" | easy/medium/hard - affects word choice and strategy |
| `temperature` | number | 0.7 | LLM creativity (0.0-2.0) |
| `top_p` | number | 0.9 | Nucleus sampling |
| `top_k` | number | 40 | Top-k sampling |
| `num_predict` | number | 100 | Max tokens per response |
| `personality` | string | null | Custom personality prompt |
| `seed` | number | null | For reproducible behavior |

---

## Security Considerations

1. **Localhost-only access**: All bot management endpoints restricted to 127.0.0.1
2. **Host-only control**: Only game host can add/remove bots
3. **No remote Ollama**: Only local Ollama instance supported
4. **Input validation**: All bot configs validated with Zod
5. **Rate limiting**: Prevent rapid bot creation
6. **Resource limits**: Cap number of bots per game (e.g., max 2)

---

## Future Enhancements (Out of Scope)

- Support for other LLM backends (OpenAI, Claude API, LM Studio)
- Bot vs Bot spectator mode
- Bot difficulty auto-adjustment based on win rate
- Tournament mode with multiple bots
- Bot personality presets (aggressive, defensive, chaotic)
- Learning from game history to improve strategies
