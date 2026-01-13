# Probe: Local LLM Player Integration Options

This document outlines options for integrating a local LLM (such as Ollama) as an automated player in the Probe word guessing game.

## Application Overview

**Probe** is a multiplayer word guessing game (based on the 1964 Parker Brothers game) where:
- 2-4 players secretly select words (4-12 letters, optionally padded with blanks)
- Players take turns guessing letters in opponents' words
- Scoring is position-based (5/10/15 pattern repeating)
- Last player with unrevealed letters wins

**Key LLM Player Tasks:**
1. **Choose a secret word** - strategic word selection
2. **Guess letters** - analyze revealed letters, missed letters, and word patterns to guess likely letters
3. **Handle blank/duplicate selection** - when targeted, choose positions strategically
4. **Full word guessing** - attempt word guesses when confident

---

## Option 1: Standalone Bot Client (Recommended)

**Architecture:** A separate Node.js/TypeScript application that connects as a real player via WebSocket.

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│  Human Players  │◄─────────────────►│  Probe Backend  │
│  (Frontend)     │                   │  (Socket.io)    │
└─────────────────┘                   └────────┬────────┘
                                               │
                                      WebSocket│
                                               │
┌─────────────────┐     HTTP/REST     ┌────────▼────────┐
│  Ollama Server  │◄─────────────────►│  LLM Bot Client │
│  (localhost:    │                   │  (Node.js)      │
│   11434)        │                   └─────────────────┘
└─────────────────┘
```

**Pros:**
- Completely decoupled from main codebase
- Can run anywhere (same machine, different machine, cloud)
- Uses same auth/socket protocol as human players
- Easy to test independently
- Can support multiple bot instances

**Cons:**
- Requires separate user account for the bot
- Slightly more complex deployment

**Implementation Sketch:**

```typescript
// bot-client/src/index.ts
import { io, Socket } from 'socket.io-client';
import { OllamaClient } from './ollama';
import { WordStrategy } from './strategies/word-selection';
import { GuessStrategy } from './strategies/letter-guessing';

class ProbeLLMBot {
  private socket: Socket;
  private ollama: OllamaClient;
  private gameState: GameState | null = null;

  async connect(serverUrl: string, token: string) {
    this.socket = io(serverUrl, { auth: { token } });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.socket.on('wordSelectionPhase', () => this.selectWord());
    this.socket.on('gameStarted', (game) => this.onGameStarted(game));
    this.socket.on('letterGuessed', (result) => this.onLetterGuessed(result));
    this.socket.on('turnTimeout', () => this.onMyTurn());
    // ... handle all game events
  }

  private async selectWord() {
    const prompt = `You are playing a word guessing game. Choose a strategic
    English word between 4-12 letters that will be hard to guess. Consider:
    - Uncommon letter combinations
    - Words with rare letters (Q, X, Z, J)
    - Avoid common patterns
    Return ONLY the word, nothing else.`;

    const word = await this.ollama.generate(prompt);
    this.socket.emit('selectWord', {
      roomCode: this.gameState.roomCode,
      word: word.trim().toUpperCase(),
      frontPadding: 0,
      backPadding: 0
    });
  }

  private async guessLetter() {
    const targetPlayer = this.selectTarget();
    const context = this.buildGuessContext(targetPlayer);

    const prompt = `You are playing a word guessing game.
    Target word info:
    - Length: ${targetPlayer.wordLength} letters
    - Revealed: ${context.revealedPattern} (• = unknown)
    - Already tried (missed): ${context.missedLetters.join(', ')}

    Based on English word patterns, what single letter should I guess next?
    Consider letter frequency and word patterns.
    Return ONLY a single letter.`;

    const letter = await this.ollama.generate(prompt);
    this.socket.emit('guessLetter', {
      roomCode: this.gameState.roomCode,
      targetPlayerId: targetPlayer.id,
      letter: letter.trim().toUpperCase()[0]
    });
  }
}
```

---

## Option 2: Backend Bot Service (Integrated)

**Architecture:** Add a BotPlayer service within the existing backend that manages virtual players.

```
┌─────────────────────────────────────────────────────────┐
│                    Probe Backend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ GameManager  │  │ Socket.io    │  │ BotService   │  │
│  │              │◄─┤ Handlers     │◄─┤              │  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘  │
│                                             │          │
└─────────────────────────────────────────────│──────────┘
                                              │ HTTP
                                      ┌───────▼───────┐
                                      │ Ollama Server │
                                      │ (localhost)   │
                                      └───────────────┘
```

**Pros:**
- No separate authentication needed
- Direct access to game state (no serialization overhead)
- Can be added to games via host UI toggle
- Simpler deployment (single service)

**Cons:**
- Tightly coupled to backend
- Harder to test in isolation
- Bot actions must simulate socket events

**Implementation Location:** `backend/src/bot/BotService.ts`

```typescript
// backend/src/bot/BotService.ts
export class BotService {
  private ollama: OllamaClient;
  private activeBots: Map<string, BotPlayer> = new Map();

  async addBotToGame(roomCode: string, gameManager: GameManager) {
    const bot = new BotPlayer(this.ollama, roomCode, gameManager);
    this.activeBots.set(`${roomCode}_${bot.id}`, bot);
    await gameManager.joinGame(roomCode, bot.userId);
  }

  async handleBotTurn(roomCode: string, botId: string) {
    const bot = this.activeBots.get(`${roomCode}_${botId}`);
    if (bot) {
      await bot.takeTurn();
    }
  }
}
```

---

## Option 3: GameManager Hook System

**Architecture:** Add a hook/callback system to GameManager that allows plugging in AI decision-makers.

**Pros:**
- Most flexible architecture
- Supports multiple AI backends (Ollama, OpenAI, local rules-based)
- Clean separation of concerns

**Cons:**
- Requires GameManager refactoring
- More complex to implement initially

```typescript
// backend/src/game/AIPlayerInterface.ts
interface AIPlayerStrategy {
  selectWord(gameContext: WordSelectionContext): Promise<WordSelection>;
  guessLetter(gameContext: GuessContext): Promise<LetterGuess>;
  selectBlankPosition(positions: number[]): Promise<number>;
  selectDuplicatePosition(positions: number[], letter: string): Promise<number>;
  shouldGuessWord(gameContext: GuessContext): Promise<boolean>;
  guessWord(gameContext: GuessContext): Promise<string>;
}

// backend/src/bot/OllamaStrategy.ts
class OllamaStrategy implements AIPlayerStrategy {
  constructor(private modelName: string = 'llama3.2') {}

  async guessLetter(ctx: GuessContext): Promise<LetterGuess> {
    // Build prompt from context and call Ollama
  }
}
```

---

## Ollama Integration Details

**Ollama API Endpoints:**
- `POST http://localhost:11434/api/generate` - Text generation
- `POST http://localhost:11434/api/chat` - Chat completion (better for context)

**Recommended Models:**

| Model | Size | Speed | Quality | Notes |
|-------|------|-------|---------|-------|
| `llama3.2:3b` | 2GB | Fast | Good | Best balance for gameplay |
| `mistral:7b` | 4GB | Medium | Great | Strong reasoning |
| `phi3:mini` | 2GB | Fast | Good | Microsoft's small model |
| `qwen2.5:7b` | 4GB | Medium | Great | Good at word games |

**Sample Ollama Client:**

```typescript
// bot-client/src/ollama.ts
export class OllamaClient {
  constructor(
    private baseUrl = 'http://localhost:11434',
    private model = 'llama3.2:3b'
  ) {}

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 50  // Limit response length
        }
      })
    });

    const data = await response.json();
    return data.response;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false
      })
    });

    const data = await response.json();
    return data.message.content;
  }
}
```

---

## LLM Prompt Strategies

### 1. Word Selection Prompt

```
You are playing a word guessing game where opponents guess letters one at a time.

Choose a strategic English word (4-12 letters) that will be difficult to guess.

Good strategies:
- Use uncommon letters (J, Q, X, Z, K, V, W)
- Avoid common patterns (ING, TION, ED endings)
- Words with double letters can confuse opponents
- Shorter words give less information but fewer positions
- Longer words take more guesses to reveal

Return ONLY the word in uppercase, nothing else.
```

### 2. Letter Guessing Prompt

```
You are guessing letters in an opponent's hidden word.

Word information:
- Total length: 7 positions
- Revealed so far: •A••E•• (• = hidden, letters = revealed)
- Letters already tried (missed): R, S, T, N
- Blanks (padding): positions 0 might be blank

Common English letter frequencies: E, T, A, O, I, N, S, H, R

Based on the revealed pattern "•A••E••" and missed letters, suggest the next
letter to guess. Consider:
1. What English words could match this pattern?
2. Which common letters haven't been tried?
3. What positions are likely to be consonants vs vowels?

Return ONLY a single letter.
```

### 3. Word Guessing Prompt

```
The opponent's word has pattern: _A_ER (5 letters, positions 1 and 4 revealed as A and E)
Missed guesses: S, T, N, I, O

What complete English word could this be? Consider:
- BAKER, CAPER, DARER, FADER, GAMER, HATER, LASER, MAKER, PAPER, RAKER, SAFER, TAKER, WATER...

If you're >80% confident, return the word. Otherwise return "PASS".
Response format: Just the word or "PASS"
```

---

## Recommendation

**Start with Option 1 (Standalone Bot Client)** because:

1. **Lowest risk** - No changes to existing codebase
2. **Easiest to develop** - Separate project, independent testing
3. **Most flexible** - Can swap LLM backends easily
4. **Production ready** - Can scale horizontally (multiple bots)

**Implementation order:**
1. Create `bot-client/` directory with TypeScript setup
2. Implement Ollama client wrapper
3. Implement socket connection & authentication
4. Add word selection strategy
5. Add letter guessing strategy (most complex - needs word pattern analysis)
6. Add blank/duplicate position selection
7. Add word guessing logic
8. Add configurable difficulty levels
