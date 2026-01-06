/**
 * BotManager - Manages bot player lifecycle and coordinates bot actions
 */
import { OllamaService } from './OllamaService';
import { OpenRouterService } from './OpenRouterService';
import { WordValidator } from '../game/WordValidator';
import { BotPlayer } from './BotPlayer';
import { BotConfigInput, BotPreset, GameContext, TurnAction, OllamaModel, LLMProviderType } from './types';
export declare class BotManager {
    private ollama;
    private openRouter;
    private bots;
    private gameBots;
    private wordValidator;
    constructor(ollama?: OllamaService, openRouter?: OpenRouterService, wordValidator?: WordValidator);
    /**
     * Check if a provider is available
     */
    isProviderAvailable(provider?: LLMProviderType): Promise<boolean>;
    /**
     * Legacy: Check if Ollama is available
     */
    isOllamaAvailable(): Promise<boolean>;
    /**
     * Get list of available models from a provider
     */
    getAvailableModels(provider?: LLMProviderType): Promise<OllamaModel[]>;
    /**
     * Get Ollama version
     */
    getOllamaVersion(): Promise<string | null>;
    /**
     * Create a new bot player
     */
    createBot(configInput: BotConfigInput): BotPlayer;
    /**
     * Create bot from a preset configuration
     */
    createBotFromPreset(preset: BotPreset): BotPlayer;
    /**
     * Get a bot by ID
     */
    getBot(botId: string): BotPlayer | undefined;
    /**
     * Check if a player ID belongs to a bot
     */
    isBot(playerId: string): boolean;
    /**
     * Destroy a bot
     */
    destroyBot(botId: string): boolean;
    /**
     * Add bot to a game
     */
    addBotToGame(botId: string, roomCode: string): void;
    /**
     * Remove bot from a game
     */
    removeBotFromGame(botId: string, roomCode: string): void;
    /**
     * Get all bots in a game
     */
    getBotsInGame(roomCode: string): BotPlayer[];
    /**
     * Get bot IDs in a game
     */
    getBotIdsInGame(roomCode: string): string[];
    /**
     * Check if a game has any bots
     */
    gameHasBots(roomCode: string): boolean;
    /**
     * Handle a bot's turn
     */
    handleBotTurn(botId: string, gameContext: GameContext): Promise<TurnAction>;
    /**
     * Handle bot word selection
     */
    handleBotWordSelection(botId: string, gameContext: GameContext): Promise<{
        word: string;
        frontPadding: number;
        backPadding: number;
    }>;
    /**
     * Handle bot blank position selection
     */
    handleBotBlankSelection(botId: string, positions: number[], gameContext: GameContext): Promise<number>;
    /**
     * Handle bot duplicate position selection
     */
    handleBotDuplicateSelection(botId: string, positions: number[], letter: string, gameContext: GameContext): Promise<number>;
    /**
     * Clean up all bots in a game
     */
    cleanupGame(roomCode: string): void;
    /**
     * Clean up all bots (for shutdown)
     */
    cleanupAll(): void;
    /**
     * Get total number of active bots
     */
    getTotalBotCount(): number;
    /**
     * Get number of games with bots
     */
    getGamesWithBotsCount(): number;
    /**
     * Get bot stats for monitoring
     */
    getStats(): {
        totalBots: number;
        gamesWithBots: number;
        botsByGame: Record<string, number>;
    };
}
export declare const botManager: BotManager;
//# sourceMappingURL=BotManager.d.ts.map