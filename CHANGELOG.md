# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2025-01-03 - Phase 7: Enhanced Gameplay Features

### Added
- **Position-Based Scoring**: Points now follow a 5/10/15 repeating pattern based on letter position
  - Position 1 = 5 pts, Position 2 = 10 pts, Position 3 = 15 pts (repeating)
- **Word Padding (Blanks)**: Players can add blank padding to disguise word position
  - Configurable front and back padding (up to 12 total characters)
  - Visual preview during word selection
  - Special "BLANK" button for guessing padding positions
  - Blanks score 0 points when revealed
- **Missed Letters Display**: Incorrect guesses are tracked and shown on player cards
  - Red "Missed" section shows all letters guessed incorrectly against that player
- **Game History System**: Complete game archival and viewing
  - Games automatically archived to JSON when completed
  - New `/history` page lists all past games
  - Detailed view shows players, secret words, turn-by-turn history, and final scores
  - Link to history from home page
- **Turn Timer System**: Configurable countdown per turn
  - Host can configure timer in lobby (10 sec - 30 min, default 5 min)
  - Preset buttons (30s, 1m, 2m, 5m, 10m) plus custom time input
  - Real-time countdown display during active game
  - Timer color changes: normal -> yellow at 30s -> red/pulsing at 10s
  - Server-side timeout handling ensures fairness
  - Toast notification when any player's turn times out
- **Game Over Screen**: Shows winner and final standings with View Details button

### Changed
- Updated game rules text on home page to reflect new scoring system
- Enhanced GameManager with timer and padding logic
- Socket handlers now manage turn timers server-side

### Technical
- New database fields: `turnTimerSeconds`, `currentTurnStartedAt`, `paddedWord`, `frontPadding`, `backPadding`, `missedLetters`
- Game archival stored in `/data/games/` as JSON files
- New API routes: `GET /game/history/all`, `GET /game/history/game/:roomCode`
- New socket events: `turnTimeout`, `timerSettingsUpdated`, `updateTimerSettings`

### Phase 6 - Deployment Ready
- Production deployment configurations
- Environment variable documentation
- Security hardening
- Performance optimizations

## [0.5.0] - 2024-12-XX - Phase 5: Testing & Polish

### Added
- Comprehensive unit tests for game logic components
- Component tests for all React UI elements
- ESLint configuration for code quality
- Prettier for code formatting
- GameRules component with interactive modal
- CopyButton component for room codes
- CountdownTimer component with visual progress
- Build and lint automation scripts
- Enhanced README with badges and detailed documentation
- PHASE5_TODO tracking document

### Improved
- Accessibility with ARIA labels
- Code quality and consistency
- Developer documentation

## [0.4.0] - 2024-12-XX - Phase 4: Real-time Features

### Added
- Enhanced Socket.io error handling
- Comprehensive reconnection logic
- Custom React hooks (useGameSocket, useNotifications, useSound, useLocalStorage)
- Socket authentication middleware
- GameStateService for centralized state management
- Ping/pong health checks
- Automatic event handler reattachment
- Vitest testing framework setup
- DEPLOYMENT.md with detailed setup instructions

### Improved
- Connection stability
- Error handling and recovery
- Disconnect handling with room cleanup
- WebSocket performance

### Fixed
- Connection drops on server disconnect
- Event handler persistence across reconnections

## [0.3.0] - 2024-12-XX - Phase 3: User Interface

### Added
- Reusable UI components:
  * Button with variants
  * Card container
  * LetterTile for word display
  * PlayerBoard for game state
  * AlphabetSelector for letter picking
  * LoadingSpinner
  * Notification system
  * Modal dialogs
  * GameOverModal
- CSS animations (slideInRight, scaleIn)
- Deployment configurations:
  * podman-compose.yml
  * Multi-stage Containerfile
  * nginx reverse proxy config
  * Database initialization script
- Automation scripts:
  * setup.sh for development
  * start.sh for running servers
  * deploy.sh for production

### Improved
- Responsive layouts for mobile and desktop
- Visual feedback for game states
- User experience with animations

## [0.2.0] - 2024-12-XX - Phase 2: Core Gameplay

### Added
- Complete game state management with Redux
- Word validation engine
- Scoring calculation system
- Turn-based game logic
- Letter guessing mechanics
- Game completion detection
- Player elimination logic

### Improved
- Game flow control
- State synchronization
- Score tracking

## [0.1.0] - 2024-12-XX - Phase 1: Foundation

### Added
- Initial project structure
- Backend API with Express
- PostgreSQL database with Prisma ORM
- Database schema (User, Game, GamePlayer, GameTurn, GameResult)
- JWT authentication system
- Basic REST API endpoints
- Frontend with React 18 + TypeScript
- Redux store setup
- Socket.io integration
- Basic page components (Login, Home, Lobby, Game)
- Tailwind CSS configuration
- Development environment setup

### Security
- JWT token-based authentication
- Refresh token rotation
- Password hashing with bcrypt
- CORS configuration
- Helmet security headers

## [0.0.1] - 2024-12-XX - Initial Planning

### Added
- Game design document (GAME_PLAN.md)
- Technical architecture planning
- Database schema design
- API endpoint specifications
- WebSocket event design
- Deployment strategy

---

## Release Notes Format

### Added
For new features.

### Changed
For changes in existing functionality.

### Deprecated
For soon-to-be removed features.

### Removed
For now removed features.

### Fixed
For any bug fixes.

### Security
In case of vulnerabilities.

### Improved
For enhancements to existing features.
