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

export interface BotConfig {
  displayName: string;
  modelName: string;
  difficulty: 'easy' | 'medium' | 'hard';
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
  personality?: string;
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
 * Get list of available Ollama models
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  const response = await api.get('/bot/ollama/models');
  return response.data.models;
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
