/**
 * LMStudioService - Client for interacting with the local LM Studio API
 *
 * LM Studio exposes an OpenAI-compatible HTTP server (default: http://localhost:1234/v1).
 * This service implements the same LLMProvider interface as OllamaService so bots can
 * run against any model loaded in LM Studio (e.g. openai/gpt-oss-120b, qwen3.8-27b).
 *
 * Configuration (environment variables):
 *   LMSTUDIO_BASE_URL       - OpenAI-compatible base URL (default: http://localhost:1234/v1)
 *   LMSTUDIO_TIMEOUT_MS     - Generation timeout in ms (default: 55000, under the 60s turn timer)
 *   LMSTUDIO_MIN_MAX_TOKENS - Floor for max_completion_tokens (default: 2048).
 *                              Thinking models spend their token budget on reasoning, so a
 *                              small num_predict (e.g. 10 for letter guesses) would otherwise
 *                              produce empty content. Non-thinking models stop early, so the
 *                              floor does not slow them down.
 *   LMSTUDIO_REASONING_EFFORT - Default reasoning_effort sent to the model (default: "low").
 *                              OpenAI-standard parameter, honored by models like gpt-oss.
 */
import { LLMProvider, OllamaModel, OllamaGenerateOptions, OllamaChatMessage } from './types';
export declare class LMStudioService implements LLMProvider {
    private baseUrl;
    private defaultTimeout;
    private minMaxTokens;
    private defaultReasoningEffort;
    constructor(baseUrl?: string, defaultTimeout?: number, minMaxTokens?: number, defaultReasoningEffort?: 'low' | 'medium' | 'high');
    getProviderName(): string;
    /**
     * Base URL of the OpenAI-compatible API (for status responses)
     */
    getBaseUrl(): string;
    /**
     * Check if the LM Studio server is running and accessible
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get LM Studio version information.
     * The OpenAI-compatible API has no version endpoint, so we try the
     * non-OpenAI /api/version endpoint and return null if it is unavailable.
     */
    getVersion(): Promise<string | null>;
    /**
     * List all models loaded in LM Studio.
     * Maps OpenAI model objects onto the OllamaModel shape used across the bot system.
     */
    listModels(): Promise<OllamaModel[]>;
    /**
     * Generate a text response from the model (single prompt, optional system prompt)
     */
    generate(modelName: string, prompt: string, options?: OllamaGenerateOptions, systemPrompt?: string): Promise<string>;
    /**
     * Chat completion with message history via /v1/chat/completions
     */
    chat(modelName: string, messages: OllamaChatMessage[], options?: OllamaGenerateOptions): Promise<string>;
    /**
     * Map Ollama-style options onto OpenAI-compatible parameters.
     * - num_predict -> max_completion_tokens (with a floor for thinking models)
     * - top_k / repeat_penalty / num_ctx are Ollama-specific and not part of the
     *   OpenAI API, so they are dropped.
     */
    private mapOptions;
}
export declare const lmstudioService: LMStudioService;
//# sourceMappingURL=LMStudioService.d.ts.map