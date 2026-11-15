/**
 * BotManager - Manages bot player lifecycle and coordinates bot actions
 */

import { OllamaService, ollamaService } from './OllamaService';
import { OpenRouterService, openRouterService } from './OpenRouterService';
import { LMStudioService, lmstudioService } from './LMStudioService';
import { WordValidator } from '../game/WordValidator';
import { BotPlayer } from './BotPlayer';
import {
  BotConfigInput,
  BotPreset,
  GameContext,
  TurnAction,
  OllamaModel,
  LLMProvider,
  LLMProviderType,
} from './types';

export class BotManager {
  private bots: Map<string, BotPlayer> = new Map();
  private gameBots: Map<string, Set<string>> = new Map();
  private wordValidator: WordValidator;

  constructor(
    private ollama: OllamaService = ollamaService,
    private openRouter: OpenRouterService = openRouterService,
    private lmstudio: LMStudioService = lmstudioService,
    wordValidator?: WordValidator
  ) {
    this.wordValidator = wordValidator || new WordValidator();
  }

  /**
   * Resolve the default LLM provider.
   * Honors the LLM_PROVIDER env var (ollama | openrouter | lmstudio),
   * falling back to 'ollama' for backward compatibility.
   */
  private static defaultProvider(): LLMProviderType {
    const env = process.env.LLM_PROVIDER;
    if (env === 'ollama' || env === 'openrouter' || env === 'lmstudio') {
      return env;
    }
    return 'ollama';
  }

  /**
   * Get the default LLM provider (from LLM_PROVIDER env, else 'ollama')
   */
  getDefaultProvider(): LLMProviderType {
    return BotManager.defaultProvider();
  }

  /**
   * Resolve a provider name to its service instance
   */
  private resolveProvider(providerType: LLMProviderType): LLMProvider {
    if (providerType === 'openrouter') return this.openRouter;
    if (providerType === 'lmstudio') return this.lmstudio;
    return this.ollama;
  }

  // ============================================================================
  // Provider Status & Models
  // ============================================================================

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(provider: LLMProviderType = 'ollama'): Promise<boolean> {
    return this.resolveProvider(provider).isAvailable();
  }

  /**
   * Legacy: Check if Ollama is available
   */
  async isOllamaAvailable(): Promise<boolean> {
    return this.ollama.isAvailable();
  }

  /**
   * Check if LM Studio is available
   */
  async isLmStudioAvailable(): Promise<boolean> {
    return this.lmstudio.isAvailable();
  }

  /**
   * Get list of available models from a provider
   */
  async getAvailableModels(provider: LLMProviderType = 'ollama'): Promise<OllamaModel[]> {
    return this.resolveProvider(provider).listModels();
  }

  /**
   * Get Ollama version
   */
  async getOllamaVersion(): Promise<string | null> {
    return this.ollama.getVersion();
  }

  /**
   * Get LM Studio version (null when the native API is unavailable)
   */
  async getLmStudioVersion(): Promise<string | null> {
    return this.lmstudio.getVersion();
  }

  /**
   * Get the base URL of a provider (for status responses)
   */
  getProviderBaseUrl(provider: LLMProviderType = 'ollama'): string {
    if (provider === 'lmstudio') return this.lmstudio.getBaseUrl();
    if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
    return 'http://localhost:11434';
  }

  // ============================================================================
  // Bot Creation & Management
  // ============================================================================

  /**
   * Create a new bot player
   */
  createBot(configInput: BotConfigInput): BotPlayer {
    // Validate model name is provided
    if (!configInput.modelName) {
      throw new Error('Model name is required');
    }

    const providerType = configInput.provider || BotManager.defaultProvider();
    const provider: LLMProvider = this.resolveProvider(providerType);

    const bot = new BotPlayer(configInput, provider, this.wordValidator);
    this.bots.set(bot.id, bot);

    console.log(`[BotManager] Created bot: ${bot.displayName} (${bot.id}) using ${providerType} model: ${configInput.modelName}`);
    return bot;
  }

  /**
   * Create bot from a preset configuration
   */
  createBotFromPreset(preset: BotPreset): BotPlayer {
    return this.createBot({
      displayName: preset.displayName,
      modelName: preset.modelName,
      ollamaOptions: preset.ollamaOptions,
      personality: preset.personality,
      difficulty: preset.difficulty,
      provider: preset.provider,
    });
  }


  /**
   * Get a bot by ID
   */
  getBot(botId: string): BotPlayer | undefined {
    return this.bots.get(botId);
  }

  /**
   * Check if a player ID belongs to a bot
   */
  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  /**
   * Destroy a bot
   */
  destroyBot(botId: string): boolean {
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
  addBotToGame(botId: string, roomCode: string): void {
    if (!this.bots.has(botId)) {
      throw new Error('Bot not found');
    }

    if (!this.gameBots.has(roomCode)) {
      this.gameBots.set(roomCode, new Set());
    }

    this.gameBots.get(roomCode)!.add(botId);
    console.log(`[BotManager] Added bot ${botId} to game ${roomCode}`);
  }

  /**
   * Remove bot from a game
   */
  removeBotFromGame(botId: string, roomCode: string): void {
    this.gameBots.get(roomCode)?.delete(botId);
    console.log(`[BotManager] Removed bot ${botId} from game ${roomCode}`);
  }

  /**
   * Get all bots in a game
   */
  getBotsInGame(roomCode: string): BotPlayer[] {
    const botIds = this.gameBots.get(roomCode) || new Set();
    return Array.from(botIds)
      .map(id => this.bots.get(id))
      .filter((bot): bot is BotPlayer => bot !== undefined);
  }

  /**
   * Get bot IDs in a game
   */
  getBotIdsInGame(roomCode: string): string[] {
    const botIds = this.gameBots.get(roomCode) || new Set();
    return Array.from(botIds);
  }

  /**
   * Check if a game has any bots
   */
  gameHasBots(roomCode: string): boolean {
    const bots = this.gameBots.get(roomCode);
    return bots !== undefined && bots.size > 0;
  }

  // ============================================================================
  // Bot Actions
  // ============================================================================

  /**
   * Handle a bot's turn
   */
  async handleBotTurn(
    botId: string,
    gameContext: GameContext
  ): Promise<TurnAction> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error('Bot not found');
    }

    return bot.takeTurn(gameContext);
  }

  /**
   * Handle bot word selection
   */
  async handleBotWordSelection(
    botId: string,
    gameContext: GameContext
  ): Promise<{ word: string; frontPadding: number; backPadding: number }> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error('Bot not found');
    }

    return bot.selectWord(gameContext);
  }

  /**
   * Handle bot blank position selection
   */
  async handleBotBlankSelection(
    botId: string,
    positions: number[],
    gameContext: GameContext
  ): Promise<number> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error('Bot not found');
    }

    return bot.selectBlankPosition(positions, gameContext);
  }

  /**
   * Handle bot duplicate position selection
   */
  async handleBotDuplicateSelection(
    botId: string,
    positions: number[],
    letter: string,
    gameContext: GameContext
  ): Promise<number> {
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
  cleanupGame(roomCode: string): void {
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
  cleanupAll(): void {
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
  getTotalBotCount(): number {
    return this.bots.size;
  }

  /**
   * Get number of games with bots
   */
  getGamesWithBotsCount(): number {
    return this.gameBots.size;
  }

  /**
   * Get bot stats for monitoring
   */
  getStats(): { totalBots: number; gamesWithBots: number; botsByGame: Record<string, number> } {
    const botsByGame: Record<string, number> = {};
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

// Export singleton instance
export const botManager = new BotManager();
