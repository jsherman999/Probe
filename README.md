# Probe - Multiplayer Word Game

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

A modern, real-time multiplayer implementation of the classic Parker Brothers (1964) word guessing board game Probe. Built with React, Node.js, Socket.io, and PostgreSQL.

## 🎮 Features

- **Real-time Multiplayer**: 2-4 players per game with WebSocket communication
- **Mobile & Desktop**: Responsive design works on iPhone and browsers
- **Turn-based Gameplay**: Classic Probe rules with letter guessing and scoring
- **Secure Authentication**: JWT-based user authentication
- **Room System**: Create or join games with 6-character room codes
- **Live Updates**: Real-time game state synchronization
- **Reconnection Handling**: Automatic reconnection with state recovery
- **Modern UI**: Tailwind CSS with smooth animations

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- PostgreSQL 16+
- npm or yarn

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

3. **Start development servers**
   ```bash
   ./scripts/start.sh
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## 🎯 How to Play

1. **Create or Join a Game**
   - Create a new game or enter a 6-character room code
   - Wait for 2-4 players to join

2. **Select Your Word**
   - Choose a secret word (4-12 letters)
   - Game starts when all players are ready

3. **Guess Letters**
   - Take turns guessing letters in opponents' words
   - Earn points based on letter value × occurrences
   - Continue your turn on correct guesses

4. **Win the Game**
   - Last player with an unrevealed word wins
   - Or highest score when all words are revealed

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
│   │   ├── routes/        # API routes
│   │   ├── socket/        # WebSocket handlers
│   │   ├── middleware/    # Auth middleware
│   │   ├── services/      # Business logic services
│   │   └── __tests__/     # Unit tests
│   ├── prisma/            # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── store/         # Redux store
│   │   ├── services/      # API & Socket services
│   │   └── __tests__/     # Component tests
│   └── package.json
├── containers/            # Docker/Podman configs
├── scripts/               # Automation scripts
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

## 🐳 Deployment

### Option 1: Podman (Containerized)
```bash
./scripts/deploy.sh
```

### Option 2: Native (macOS)
See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📊 Scoring System

| Letters | Points |
|---------|--------|
| E, A, I, O, N, R, T, L, S, U | 1 |
| D, G | 2 |
| B, C, M, P | 3 |
| F, H, V, W, Y | 4 |
| K | 5 |
| J, X | 8 |
| Q, Z | 10 |

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
- Built with modern web technologies
- Inspired by classic board game mechanics

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/jsherman999/Probe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jsherman999/Probe/discussions)

## 🗺️ Roadmap

- [ ] Game statistics and leaderboards
- [ ] Tournament mode
- [ ] Custom word lists
- [ ] Spectator mode
- [ ] Replay system
- [ ] Mobile native apps

---

Built with ❤️ using React, Node.js, and Socket.io
