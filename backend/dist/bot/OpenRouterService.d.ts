/**
 * OpenRouterService - Client for interacting with the OpenRouter API
 *
 * OpenRouter API documentation: https://openrouter.ai/docs
 */
import { LLMProvider, OllamaModel, OllamaGenerateOptions, OllamaChatMessage } from './types';
export declare class OpenRouterService implements LLMProvider {
    private baseUrl;
    private apiKey;
    private defaultTimeout;
    constructor(apiKey?: string, defaultTimeout?: number);
    getProviderName(): string;
    /**
     * Check if OpenRouter is available (and API key is set)
     */
    isAvailable(): Promise<boolean>;
    /**
     * List available OpenRouter models (free models only)
     */
    listModels(): Promise<OllamaModel[]>;
    /**
     * Generate completion (using chat endpoint as most models are chat models)
     */
    generate(modelName: string, prompt: string, options?: OllamaGenerateOptions, systemPrompt?: string): Promise<string>;
    /**
     * Chat completion
     */
    chat(modelName: string, messages: OllamaChatMessage[], options?: OllamaGenerateOptions): Promise<string>;
}
export declare const openRouterService: OpenRouterService;
//# sourceMappingURL=OpenRouterService.d.ts.map