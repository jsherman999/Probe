"use strict";
/**
 * BotManager - Manages bot player lifecycle and coordinates bot actions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.botManager = exports.BotManager = void 0;
const OllamaService_1 = require("./OllamaService");
const WordValidator_1 = require("../game/WordValidator");
const BotPlayer_1 = require("./BotPlayer");
class BotManager {
    ollama;
    bots = new Map();
    gameBots = new Map();
    wordValidator;
    constructor(ollama = OllamaService_1.ollamaService, wordValidator) {
        this.ollama = ollama;
        this.wordValidator = wordValidator || new WordValidator_1.WordValidator();
    }
    // ============================================================================
    // Ollama Status & Models
    // ============================================================================
    /**
     * Check if Ollama is available
     */
    async isOllamaAvailable() {
        return this.ollama.isAvailable();
    }
    /**
     * Get list of available Ollama models
     */
    async getAvailableModels() {
        return this.ollama.listModels();
    }
    /**
     * Get Ollama version
     */
    async getOllamaVersion() {
        return this.ollama.getVersion();
    }
    // ============================================================================
    // Bot Creation & Management
    // ============================================================================
    /**
     * Create a new bot player
     */
    createBot(configInput) {
        // Validate model name is provided
        if (!configInput.modelName) {
            throw new Error('Model name is required');
        }
        const bot = new BotPlayer_1.BotPlayer(configInput, this.ollama, this.wordValidator);
        this.bots.set(bot.id, bot);
        console.log(`[BotManager] Created bot: ${bot.displayName} (${bot.id}) using model: ${configInput.modelName}`);
        return bot;
    }
    /**
     * Create bot from a preset configuration
     */
    createBotFromPreset(preset) {
        return this.createBot({
            displayName: preset.displayName,
            modelName: preset.modelName,
            ollamaOptions: preset.ollamaOptions,
            personality: preset.personality,
            difficulty: preset.difficulty,
        });
    }
    /**
     * Get a bot by ID
     */
    getBot(botId) {
        return this.bots.get(botId);
    }
    /**
     * Check if a player ID belongs to a bot
     */
    isBot(playerId) {
        return this.bots.has(playerId);
    }
    /**
     * Destroy a bot
     */
    destroyBot(botId) {
        const deleted = this.bots.delete(botId);
        if (deleted) {
            console.log(`[BotManager] Destroyed bot: ${botId}`);
        }
        return deleted;
    }
    // ============================================================================
    // Game-Bot Association
    // ============================================================================
    /**
     * Add bot to a game
     */
    addBotToGame(botId, roomCode) {
        if (!this.bots.has(botId)) {
            throw new Error('Bot not found');
        }
        if (!this.gameBots.has(roomCode)) {
            this.gameBots.set(roomCode, new Set());
        }
        this.gameBots.get(roomCode).add(botId);
        console.log(`[BotManager] Added bot ${botId} to game ${roomCode}`);
    }
    /**
     * Remove bot from a game
     */
    removeBotFromGame(botId, roomCode) {
        this.gameBots.get(roomCode)?.delete(botId);
        console.log(`[BotManager] Removed bot ${botId} from game ${roomCode}`);
    }
    /**
     * Get all bots in a game
     */
    getBotsInGame(roomCode) {
        const botIds = this.gameBots.get(roomCode) || new Set();
        return Array.from(botIds)
            .map(id => this.bots.get(id))
            .filter((bot) => bot !== undefined);
    }
    /**
     * Get bot IDs in a game
     */
    getBotIdsInGame(roomCode) {
        const botIds = this.gameBots.get(roomCode) || new Set();
        return Array.from(botIds);
    }
    /**
     * Check if a game has any bots
     */
    gameHasBots(roomCode) {
        const bots = this.gameBots.get(roomCode);
        return bots !== undefined && bots.size > 0;
    }
    // ============================================================================
    // Bot Actions
    // ============================================================================
    /**
     * Handle a bot's turn
     */
    async handleBotTurn(botId, gameContext) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error('Bot not found');
        }
        return bot.takeTurn(gameContext);
    }
    /**
     * Handle bot word selection
     */
    async handleBotWordSelection(botId, gameContext) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error('Bot not found');
        }
        return bot.selectWord(gameContext);
    }
    /**
     * Handle bot blank position selection
     */
    async handleBotBlankSelection(botId, positions, gameContext) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error('Bot not found');
        }
        return bot.selectBlankPosition(positions, gameContext);
    }
    /**
     * Handle bot duplicate position selection
     */
    async handleBotDuplicateSelection(botId, positions, letter, gameContext) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error('Bot not found');
        }
        return bot.selectDuplicatePosition(positions, letter, gameContext);
    }
    // ============================================================================
    // Cleanup
    // ============================================================================
    /**
     * Clean up all bots in a game
     */
    cleanupGame(roomCode) {
        const botIds = this.gameBots.get(roomCode);
        if (botIds) {
            botIds.forEach(id => {
                this.bots.delete(id);
                console.log(`[BotManager] Cleaned up bot ${id} from game ${roomCode}`);
            });
            this.gameBots.delete(roomCode);
        }
    }
    /**
     * Clean up all bots (for shutdown)
     */
    cleanupAll() {
        this.bots.clear();
        this.gameBots.clear();
        console.log('[BotManager] Cleaned up all bots');
    }
    // ============================================================================
    // Statistics
    // ============================================================================
    /**
     * Get total number of active bots
     */
    getTotalBotCount() {
        return this.bots.size;
    }
    /**
     * Get number of games with bots
     */
    getGamesWithBotsCount() {
        return this.gameBots.size;
    }
    /**
     * Get bot stats for monitoring
     */
    getStats() {
        const botsByGame = {};
        this.gameBots.forEach((bots, roomCode) => {
            botsByGame[roomCode] = bots.size;
        });
        return {
            totalBots: this.bots.size,
            gamesWithBots: this.gameBots.size,
            botsByGame,
        };
    }
}
exports.BotManager = BotManager;
// Export singleton instance
exports.botManager = new BotManager();
//# sourceMappingURL=BotManager.js.map