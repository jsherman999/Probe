/**
 * OpenRouterService - Client for interacting with the OpenRouter API
 *
 * OpenRouter API documentation: https://openrouter.ai/docs
 */

import {
  LLMProvider,
  OllamaModel,
  OllamaModelInfo,
  OllamaGenerateOptions,
  OllamaChatMessage,
} from './types';

export class OpenRouterService implements LLMProvider {
  private baseUrl = 'https://openrouter.ai/api/v1';
  private apiKey: string;
  private defaultTimeout: number;

  constructor(apiKey?: string, defaultTimeout = 60000) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.defaultTimeout = defaultTimeout;
  }

  getProviderName(): string {
    return 'openrouter';
  }

  /**
   * Check if OpenRouter is available (and API key is set)
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/auth/check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * List available OpenRouter models (free models only)
   */
  async listModels(): Promise<OllamaModel[]> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is missing');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      // OpenRouter model structure includes pricing info
      interface OpenRouterModel {
        id: string;
        name: string;
        pricing?: {
          prompt?: string;
          completion?: string;
        };
        context_length?: number;
      }

      const data = await response.json() as { data: OpenRouterModel[] };

      // Filter to only include free models (pricing.prompt === "0" or has :free suffix)
      const freeModels = data.data.filter((model) => {
        const isFreeByPrice = model.pricing?.prompt === '0' && model.pricing?.completion === '0';
        const isFreeByName = model.id.includes(':free');
        return isFreeByPrice || isFreeByName;
      });

      console.log(`[OpenRouter] Found ${freeModels.length} free models out of ${data.data.length} total`);

      // Map OpenRouter models to our format
      return freeModels.map((model) => ({
        name: model.id,
        size: 0, // Not applicable
        digest: model.id,
        modified_at: new Date().toISOString(),
        details: {
          format: 'openrouter',
          family: model.id.split('/')[0] || 'unknown', // Extract provider (e.g., "meta-llama")
          families: null,
          parameter_size: 'unknown',
          quantization_level: 'free',
        }
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout while listing models');
      }
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  /**
   * Generate completion (using chat endpoint as most models are chat models)
   */
  async generate(
    modelName: string,
    prompt: string,
    options?: OllamaGenerateOptions,
    systemPrompt?: string
  ): Promise<string> {
    const messages: OllamaChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chat(modelName, messages, options);
  }

  /**
   * Chat completion
   */
  async chat(
    modelName: string,
    messages: OllamaChatMessage[],
    options?: OllamaGenerateOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is missing');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

      // Map options to OpenRouter/OpenAI format
      const body = {
        model: modelName,
        messages: messages,
        temperature: options?.temperature,
        top_p: options?.top_p,
        max_tokens: options?.num_predict, // num_predict maps to max_tokens
        stream: false,
        stop: options?.stop,
        // Add OpenRouter specific headers for better ranking/logging if needed
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/project-probe', // Optional
          'X-Title': 'Project Probe', // Optional
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout during generation');
      }
      throw new Error(`OpenRouter generation failed: ${error.message}`);
    }
  }
}

export const openRouterService = new OpenRouterService();
