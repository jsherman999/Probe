/**
 * OllamaService - Client for interacting with the local Ollama API
 *
 * Ollama API documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
import { OllamaModel, OllamaModelInfo, OllamaGenerateOptions, OllamaChatMessage, OllamaPullProgress } from './types';
export declare class OllamaService {
    private baseUrl;
    private defaultTimeout;
    constructor(baseUrl?: string, defaultTimeout?: number);
    /**
     * Check if Ollama server is running and accessible
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get Ollama version information
     */
    getVersion(): Promise<string | null>;
    /**
     * List all downloaded/available models
     */
    listModels(): Promise<OllamaModel[]>;
    /**
     * Get detailed information about a specific model
     */
    getModelInfo(modelName: string): Promise<OllamaModelInfo>;
    /**
     * Pull/download a model from Ollama registry
     * @param modelName - Name of the model to pull (e.g., "llama3.2:3b")
     * @param onProgress - Optional callback for progress updates
     */
    pullModel(modelName: string, onProgress?: (progress: OllamaPullProgress) => void): Promise<void>;
    /**
     * Generate a text response from the model
     * @param modelName - Name of the model to use
     * @param prompt - The prompt to send
     * @param options - Generation options (temperature, etc.)
     * @param systemPrompt - Optional system prompt
     */
    generate(modelName: string, prompt: string, options?: OllamaGenerateOptions, systemPrompt?: string): Promise<string>;
    /**
     * Chat completion with message history
     * @param modelName - Name of the model to use
     * @param messages - Array of chat messages
     * @param options - Generation options
     */
    chat(modelName: string, messages: OllamaChatMessage[], options?: OllamaGenerateOptions): Promise<string>;
    /**
     * Generate with streaming response
     * @param modelName - Name of the model to use
     * @param prompt - The prompt to send
     * @param onToken - Callback for each token
     * @param options - Generation options
     */
    generateStream(modelName: string, prompt: string, onToken: (token: string) => void, options?: OllamaGenerateOptions): Promise<string>;
    /**
     * Merge user options with sensible defaults for game play
     */
    private mergeOptions;
    /**
     * Format bytes to human-readable string
     */
    static formatBytes(bytes: number): string;
}
export declare const ollamaService: OllamaService;
//# sourceMappingURL=OllamaService.d.ts.map