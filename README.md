# Probe - Multiplayer Word Game

A modern, multiplayer implementation of the classic Probe word game (Parker Brothers, 1964).

## Features

- 🎮 Real-time multiplayer (2-4 players)
- 📱 Responsive design (works on iPhone and all browsers)
- 🎯 Classic Probe gameplay mechanics
- 🔐 Secure game state management
- 🚀 WebSocket-based real-time updates

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL + Prisma ORM
- **Deployment**: Podman containers

## Quick Start

### Prerequisites

- Node.js 20+ LTS
- PostgreSQL 16+
- npm or yarn

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd Probe
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

4. **Setup database**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Start development servers**
   ```bash
   # Backend (from backend directory)
   npm run dev
   
   # Frontend (from frontend directory, new terminal)
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## Deployment

### Podman (Recommended for Mac Mini M4 Pro)

```bash
# Build containers
podman-compose build

# Start services
podman-compose up -d

# View logs
podman-compose logs -f
```

### Native Deployment

```bash
# Run setup script
./scripts/setup.sh

# Start application
./scripts/start.sh
```

## Game Rules

1. Each player selects a secret word (4-12 letters)
2. Players take turns guessing letters in opponents' words
3. Correct guesses reveal the letter and award points
4. Turn continues until an incorrect guess
5. Game ends when all words are revealed
6. Highest score wins!

### Letter Point Values

- 1 point: E, A, I, O, N, R, T, L, S, U
- 2 points: D, G
- 3 points: B, C, M, P
- 4 points: F, H, V, W, Y
- 5 points: K
- 8 points: J, X
- 10 points: Q, Z

## Project Structure

```
Probe/
├── backend/           # Node.js backend
│   ├── src/
│   │   ├── server.ts
│   │   ├── game/      # Game logic
│   │   ├── routes/    # API routes
│   │   └── socket/    # Socket.io handlers
│   ├── prisma/        # Database schema
│   └── package.json
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/     # Redux store
│   │   └── App.tsx
│   └── package.json
├── containers/        # Docker/Podman configs
├── scripts/           # Setup & deployment scripts
└── GAME_PLAN.md      # Detailed implementation plan
```

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Documentation

- [Game Plan](./GAME_PLAN.md) - Comprehensive implementation plan
- [API Documentation](./backend/docs/API.md) - API endpoints
- [Game Rules](./docs/RULES.md) - Detailed game rules

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

Based on the Probe word game by Parker Brothers (1964)

## Support

For issues and questions, please open a GitHub issue.
