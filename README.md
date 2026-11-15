# Probe - Multiplayer Word Game

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

A modern, real-time multiplayer implementation of the classic Parker Brothers (1964) word guessing board game Probe. Features AI bot players powered by local language models (LM Studio or Ollama) or cloud models (OpenRouter), position-based scoring, and advanced gameplay mechanics. Built with React, Node.js, Socket.io, and PostgreSQL.

## 🎮 Features

### Core Gameplay
- **Real-time Multiplayer**: 2-4 players per game with WebSocket communication
- **Mobile & Desktop**: Responsive design works on iPhone and browsers
- **Turn-based Gameplay**: Enhanced Probe rules with position-based scoring
- **Secure Authentication**: JWT-based user authentication
- **Room System**: Create or join games with username-based room codes
- **Live Updates**: Real-time game state synchronization
- **Reconnection Handling**: Automatic reconnection with state recovery
- **Turn Timer**: Configurable timer (10 seconds to 30 minutes, default 5 minutes)

### AI Bot Players
- **LLM-Powered Bots**: Play against AI opponents powered by local or cloud language models
- **LM Studio Support** (default): Use any model loaded in a local [LM Studio](https://lmstudio.ai) instance via its OpenAI-compatible API — no cloud, no Ollama required
- **Ollama Support**: Use local Ollama models (llama3.2, mistral, etc.)
- **OpenRouter Integration**: Access free cloud models via OpenRouter API
- **Difficulty Levels**: Easy, Medium, and Hard bot configurations
- **Smart Strategies**: Strategic word selection, letter guessing, and word guessing
- **Word History**: Bots track previously used words to avoid repetition
- **Robot Avatars**: 10 unique robot icons for bot players
- **AI Statistics**: Track bot performance, accuracy, and win rates

### Advanced Features
- **Observer Mode**: Watch games in progress and guess secret words
- **Game History**: View completed games with turn-by-turn replays
- **Viewer Guessing**: Observers can submit word guesses (revealed after game ends)
- **Eliminated Play**: Eliminated players can continue guessing to improve scores
- **Debug Window**: Live backend log viewer for localhost users (Ctrl+Shift+D)
- **Modern UI**: Tailwind CSS with smooth animations

## 🚀 Quick Start

### Prerequisites

**Required:**
- Node.js 20+ LTS
- PostgreSQL 16+
- npm or yarn

**Optional (for AI bots):**
- [LM Studio](https://lmstudio.ai) - For local AI bot players (default provider; any model you load works)
- [Ollama](https://ollama.ai) - Alternative local model server
- OpenRouter API Key - For cloud-based AI bot players

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jsherman999/Probe.git
   cd Probe
   ```

2. **Run automated setup**
   ```bash
   ./scripts/setup.sh
   ```
   This will install dependencies, setup PostgreSQL database, and configure environment variables.

3. **(Optional) Configure AI Bot Providers**

   For **LM Studio** (local models, default):
   ```bash
   # 1. Install LM Studio from https://lmstudio.ai and load a model
   #    (e.g. openai/gpt-oss-120b, qwen3.8-27b)
   # 2. Start the local server: Developer tab -> Start Server (port 1234)
   # 3. Confirm it is reachable:
   curl http://localhost:1234/v1/models
   ```

   For **Ollama** (local models):
   ```bash
   # Install Ollama from https://ollama.ai
   ollama pull llama3.2:3b
   ```

   For **OpenRouter** (cloud models):
   ```bash
   # Add to backend/.env
   OPENROUTER_API_KEY=your_api_key_here
   ```

   The default provider is set with `LLM_PROVIDER` in `backend/.env`
   (`lmstudio`, `ollama`, or `openrouter`). See [AI Bot Players](#-ai-bot-players)
   for all LM Studio tuning options.

4. **Start development servers**
   ```bash
   ./scripts/start.sh
   ```

5. **Access the application**
   - Frontend: http://localhost:5200
   - Backend API: http://localhost:3000
   - AI Stats: http://localhost:5200/ai-stats

## 🎯 How to Play

1. **Create or Join a Game**
   - Create a new game or enter a 6-character room code
   - Wait for 2-4 players to join (human or AI bots)
   - Host can configure turn timer settings

2. **Select Your Word**
   - Choose a secret word (4-12 letters)
   - Optionally add blank padding to disguise your word position
   - Game starts when all players are ready

3. **Guess Letters**
   - Take turns guessing letters in opponents' words
   - Earn points based on letter **position** (5, 10, 15, repeating)
   - Continue your turn on correct guesses
   - Can guess BLANK to reveal padding positions
   - Can attempt to guess the full word for a 50-point bonus

4. **Win the Game**
   - Last player with an unrevealed word wins
   - Or highest score when all words are revealed
   - Eliminated players can continue playing to improve their score

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **Socket.io-client** for real-time communication
- **Tailwind CSS** for styling
- **Vite** for fast development and building

### Backend
- **Node.js 20** with Express
- **Socket.io** for WebSocket server
- **Prisma** ORM with PostgreSQL
- **JWT** authentication
- **TypeScript** for type safety

### Database Schema
```
User -> GamePlayer <- Game
Game -> GameTurn
Game -> GameResult
```

## 📁 Project Structure

```
Probe/
├── backend/
│   ├── src/
│   │   ├── game/          # Game logic (GameManager, Scoring, Validation)
│   │   ├── bot/           # AI bot system
│   │   │   ├── BotManager.ts        # Bot lifecycle management
│   │   │   ├── BotPlayer.ts         # Individual bot player
│   │   │   ├── LMStudioService.ts   # Local LM Studio (OpenAI-compatible) integration
│   │   │   ├── OllamaService.ts     # Local Ollama integration
│   │   │   ├── OpenRouterService.ts # Cloud model integration
│   │   │   ├── WordHistory.ts       # Bot word tracking
│   │   │   └── strategies/          # Bot decision strategies
│   │   ├── routes/        # API routes
│   │   ├── socket/        # WebSocket handlers
│   │   ├── middleware/    # Auth middleware
│   │   ├── services/      # Business logic services
│   │   └── __tests__/     # Unit tests
│   ├── prisma/            # Database schema
│   ├── data/              # Bot word history, game archives
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── BotConfigModal.tsx   # Bot setup UI
│   │   │   └── BotPlayerCard.tsx    # Bot player display
│   │   ├── pages/         # Page components
│   │   │   ├── AIStats.tsx          # AI performance stats
│   │   │   └── GameHistory.tsx      # Game replay viewer
│   │   ├── hooks/         # Custom hooks
│   │   ├── store/         # Redux store
│   │   ├── services/      # API & Socket services
│   │   └── __tests__/     # Component tests
│   ├── public/
│   │   └── robots/        # 10 unique robot SVG icons
│   └── package.json
├── containers/            # Docker/Podman configs
├── scripts/               # Automation scripts
├── data/games/            # Archived game history JSON files
└── DEPLOYMENT.md          # Deployment guide
```

## 🧪 Testing

Run all tests:
```bash
./scripts/test.sh
```

Backend tests only:
```bash
cd backend
npm test
```

Frontend tests only:
```bash
cd frontend
npm test
```

With coverage:
```bash
cd backend
npm run test:coverage
```

## 🔧 Development Scripts

| Script | Description |
|--------|-------------|
| `./scripts/setup.sh` | Initial project setup |
| `./scripts/start.sh` | Start dev servers |
| `./scripts/test.sh` | Run all tests |
| `./scripts/build.sh` | Production build |
| `./scripts/lint.sh` | Code quality checks |
| `./scripts/deploy.sh` | Deploy with Podman |

## 🐛 Debug Window

A live backend log viewer is available for users on the hosting server (localhost only).

### Access
- **Toggle Button**: Click the 🔍 button in the bottom-right corner
- **Keyboard Shortcut**: `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)

### Features
- Real-time streaming of `logs/backend.log` via WebSocket
- Color-coded log output (errors in red, warnings in yellow, bot actions in purple)
- Filter/search logs
- Auto-scroll toggle
- Copy logs to clipboard
- Clear log display

### Security
- Only available from localhost (the hosting machine)
- Remote players cannot access the debug window
- Uses Socket.IO with IP address verification

## 🐳 Deployment

### Option 1: Podman (Containerized)
```bash
./scripts/deploy.sh
```

### Option 2: Native (macOS)
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 🌐 Remote Access (Cloudflare Tunnel)

The app supports single-port deployment for remote access via tunneling services like Cloudflare Tunnel or ngrok. This allows mobile devices and external users to access your locally-hosted game.

### How It Works
- **Single-port mode**: Backend serves both API and frontend static files on port 3000
- **Dynamic URL detection**: Frontend automatically detects same-origin mode and uses relative URLs
- **No `.env` required**: For tunnel deployment, remove/rename `frontend/.env` to enable dynamic detection

### Setup with Cloudflare Tunnel (Free)

1. **Install cloudflared**
   ```bash
   brew install cloudflared
   ```

2. **Quick Tunnel (Random URL - changes on restart)**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   This gives you a random URL like `https://random-words.trycloudflare.com`

3. **Using launchd (macOS service)**

   A launchd plist is provided at `~/Library/LaunchAgents/com.probe.cloudflared.plist`:
   ```bash
   # Start tunnel
   launchctl start com.probe.cloudflared

   # Stop tunnel
   launchctl stop com.probe.cloudflared

   # Get current tunnel URL
   grep -o 'https://[a-z-]*\.trycloudflare\.com' ~/cc_projects/Probe/logs/cloudflared.log | tail -1

   # View logs
   tail -f ~/cc_projects/Probe/logs/cloudflared.log
   ```

### Persistent URL (Optional)

For a URL that doesn't change on restart, create a named tunnel:

1. **Login to Cloudflare** (one-time)
   ```bash
   cloudflared tunnel login
   ```

2. **Create named tunnel**
   ```bash
   cloudflared tunnel create probe
   ```

3. **Run with persistent subdomain**
   ```bash
   cloudflared tunnel run --url http://localhost:3000 probe
   ```

This gives you a fixed `*.cfargotunnel.com` subdomain, or you can attach your own domain via Cloudflare DNS.

### iOS/Mobile Notes
- The app works on iOS Safari and Chrome via tunnel URLs
- Ensure `frontend/.env` is removed/renamed for proper URL detection
- Debug info is available on the login page (tap "Debug Info" to verify configuration)

## 📊 Scoring System

### Position-Based Scoring
Points are awarded based on the **position** of revealed letters, not the letter itself:

| Position | Points | Example |
|----------|--------|---------|
| 1st, 4th, 7th, 10th... | 5 | Position 0, 3, 6, 9 |
| 2nd, 5th, 8th, 11th... | 10 | Position 1, 4, 7, 10 |
| 3rd, 6th, 9th, 12th... | 15 | Position 2, 5, 8, 11 |

**Example:** If you guess a letter that appears at positions 0, 2, and 5 in a word, you earn:
- Position 0: 5 points
- Position 2: 15 points
- Position 5: 15 points
- **Total: 35 points**

### Special Scoring
- **Word Guess Bonus**: When you correctly guess another player's word:
  - Base bonus: 50 points (or 100 points if 5+ positions are unrevealed)
  - PLUS: Sum of position values for ALL unrevealed positions (including blanks)
  - Example: Guessing a 7-letter word with 4 unrevealed positions at 2, 3, 5, 6 = 50 + (15+5+15+5) = 90 points
- **Word Completion Bonus**: 50 points for revealing the final letter of a word through letter guessing
- **Incorrect Word Guess Penalty**: -50 points
- **Blank Padding**:
  - Individual BLANK guesses reveal blank positions but score based on their position value (5/10/15)
  - Blanks are included in the total when someone correctly guesses your word
- **Missed Letters**: Tracked and displayed for each player (no penalty)

## 🤖 AI Bot Players

### Overview
Play against intelligent AI opponents powered by large language models. Bots use strategic decision-making for word selection, letter guessing, and word guessing.

### Supported LLM Providers

#### Local LM Studio (Default, Recommended)
- Run any model you have loaded in [LM Studio](https://lmstudio.ai), served through its OpenAI-compatible API
- **Setup**: Load a model in LM Studio, then start the local server (Developer tab → Start Server, default port 1234)
- **Privacy**: All computation happens locally, no data sent to external services
- **Cost**: Free
- **Example models**: `openai/gpt-oss-120b`, `qwen3.8-27b`, any GGUF/MLX model you've downloaded
- **Tuning** (environment variables in `backend/.env`):

  | Variable | Default | Purpose |
  |----------|---------|---------|
  | `LLM_PROVIDER` | `lmstudio` | Default bot provider (`lmstudio`, `ollama`, or `openrouter`) |
  | `LMSTUDIO_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible API base URL |
  | `LMSTUDIO_TIMEOUT_MS` | `55000` | Generation timeout (keep under the 60s turn timer) |
  | `LMSTUDIO_MIN_MAX_TOKENS` | `2048` | Floor for the completion token budget — thinking models spend their budget on reasoning, so a tiny `num_predict` would otherwise return empty content |
  | `LMSTUDIO_REASONING_EFFORT` | `low` | OpenAI-standard reasoning control (`low`, `medium`, or `high`) for models that support it, e.g. gpt-oss |

  > **Note on thinking models:** Models like qwen3.8 and ornith spend their entire token budget on internal reasoning, which can leave the visible response empty. `LMSTUDIO_MIN_MAX_TOKENS` plus a low `reasoning_effort` keeps responses fast and non-empty. Non-thinking models stop early, so the floor does not slow them down.

#### Local Ollama
- Run models locally on your machine
- **Setup**: Install [Ollama](https://ollama.ai) and pull models like `llama3.2:3b` or `mistral`
- **Privacy**: All computation happens locally, no data sent to external services
- **Cost**: Free
- **Example models**: llama3.2, llama3.1, mistral, gemma2, phi3

#### OpenRouter API
- Access cloud-based models via OpenRouter
- **Setup**: Set `OPENROUTER_API_KEY` environment variable
- **Models**: Only free models are available (models with `:free` suffix)
- **Cost**: Free tier available

### Bot Difficulty Levels
- **Easy**: Faster decisions (1s thinking time), more random choices
- **Medium**: Balanced strategy (2s thinking time)
- **Hard**: Strategic play (3s thinking time), better word guessing

### Features
- **Smart Word Selection**: Chooses words strategically based on difficulty and game context
- **Strategic Guessing**: Uses letter frequency analysis and pattern recognition
- **Word History Tracking**: Prevents bots from reusing the same words across games
- **Blank Detection**: Can strategically guess BLANK to reveal padding
- **Performance Tracking**: View detailed AI statistics at `/ai-stats`

### Usage in Lobby
1. Click "Add Bot" in the game lobby (or open **Bot Creator** to save reusable bot presets)
2. Models from every available provider (LM Studio, Ollama, OpenRouter) appear in one list, labeled with their source
3. Choose a model from available options
4. Set difficulty level (Easy/Medium/Hard)
5. Bot joins the game with a unique robot avatar

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original game design by Parker Brothers (1964)
- Enhanced with modern AI and strategic gameplay mechanics
- Built with cutting-edge web technologies and LLM integration
- Inspired by classic board game mechanics

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/jsherman999/Probe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jsherman999/Probe/discussions)

## 🗺️ Roadmap

### Completed ✅
- [x] AI/Bot players with LLM integration (LM Studio, Ollama & OpenRouter)
- [x] Position-based scoring system
- [x] Word padding with blanks
- [x] Turn timer system
- [x] Observer mode with viewer guessing
- [x] Game history with turn-by-turn replay
- [x] AI statistics tracking
- [x] Eliminated players can continue playing
- [x] Word completion bonus
- [x] Missed letters display

### Planned 🚀
- [ ] Global leaderboards
- [ ] Tournament mode with brackets
- [ ] Custom word lists and dictionaries
- [ ] Enhanced AI personality customization
- [ ] Mobile native apps (iOS/Android)
- [ ] Social features (friends, challenges)
- [ ] Achievement system

---

Built with ❤️ using React, Node.js, and Socket.io
