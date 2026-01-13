/**
 * Bot API service for interacting with bot management endpoints
 */

import api from './api';

export interface OllamaModel {
  name: string;
  size: number;
  sizeFormatted: string;
  modifiedAt: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export type LLMProvider = 'ollama' | 'openrouter';

export interface BotConfig {
  displayName: string;
  modelName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  provider?: LLMProvider;
  personality?: string;
  ollamaOptions?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface BotPreset {
  id: string;
  presetName: string;
  displayName: string;
  modelName: string;
  difficulty: string;
  provider?: string;
  personality?: string;
  iconSvg?: string;
  ollamaConfig: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OllamaStatus {
  available: boolean;
  version?: string;
  baseUrl: string;
  error?: string;
}

/**
 * Check if Ollama server is available
 */
export async function getOllamaStatus(): Promise<OllamaStatus> {
  const response = await api.get('/bot/ollama/status');
  return response.data;
}

/**
 * Get list of available models from specified provider
 */
export async function getOllamaModels(provider: LLMProvider = 'ollama'): Promise<OllamaModel[]> {
  const response = await api.get('/bot/ollama/models', {
    params: { provider }
  });
  return response.data.models;
}

/**
 * Check if OpenRouter is available
 */
export async function checkOpenRouterStatus(): Promise<boolean> {
  try {
    const models = await getOllamaModels('openrouter');
    return models.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get details about a specific model
 */
export async function getModelInfo(modelName: string): Promise<any> {
  const response = await api.get(`/bot/ollama/models/${encodeURIComponent(modelName)}`);
  return response.data;
}

/**
 * Validate a bot configuration
 */
export async function validateBotConfig(config: BotConfig): Promise<{
  valid: boolean;
  error?: string;
  testResponse?: string;
}> {
  const response = await api.post('/bot/validate', config);
  return response.data;
}

/**
 * Get all saved bot presets
 */
export async function getBotPresets(): Promise<BotPreset[]> {
  const response = await api.get('/bot/presets');
  return response.data.presets;
}

/**
 * Create a new bot preset
 */
export async function createBotPreset(preset: Omit<BotPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<BotPreset> {
  const response = await api.post('/bot/presets', preset);
  return response.data;
}

/**
 * Update a bot preset
 */
export async function updateBotPreset(id: string, preset: Partial<BotPreset>): Promise<BotPreset> {
  const response = await api.put(`/bot/presets/${id}`, preset);
  return response.data;
}

/**
 * Delete a bot preset
 */
export async function deleteBotPreset(id: string): Promise<void> {
  await api.delete(`/bot/presets/${id}`);
}

/**
 * Get bot manager statistics
 */
export async function getBotStats(): Promise<{
  totalBots: number;
  gamesWithBots: number;
  ollamaAvailable: boolean;
}> {
  const response = await api.get('/bot/stats');
  return response.data;
}

// ============================================================================
// Robot Icon Generator API
// ============================================================================

/**
 * Generate a single random robot SVG icon
 */
export async function generateRobotIcon(): Promise<string> {
  const response = await api.get('/bot/robot-icon', {
    responseType: 'text',
  });
  return response.data;
}

/**
 * Generate multiple random robot SVG icons
 */
export async function generateRobotIcons(count: number = 5): Promise<string[]> {
  const response = await api.get('/bot/robot-icons', {
    params: { count: Math.min(Math.max(count, 1), 20) },
  });
  return response.data.bots;
}

/**
 * Check if robot icon generator is available
 */
export async function checkRobotIconHealth(): Promise<{ available: boolean; error?: string }> {
  const response = await api.get('/bot/robot-icon/health');
  return response.data;
}
