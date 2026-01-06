"use strict";
/**
 * OllamaService - Client for interacting with the local Ollama API
 *
 * Ollama API documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ollamaService = exports.OllamaService = void 0;
class OllamaService {
    baseUrl;
    defaultTimeout;
    constructor(baseUrl = 'http://localhost:11434', defaultTimeout = 60000) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.defaultTimeout = defaultTimeout;
    }
    /**
     * Check if Ollama server is running and accessible
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get Ollama version information
     */
    async getVersion() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${this.baseUrl}/api/version`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data.version || null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * List all downloaded/available models
     */
    async listModels() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Failed to list models: ${response.statusText}`);
            }
            const data = await response.json();
            return data.models || [];
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout while listing models');
            }
            throw new Error(`Failed to list models: ${error.message}`);
        }
    }
    /**
     * Get detailed information about a specific model
     */
    async getModelInfo(modelName) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Failed to get model info: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout while getting model info');
            }
            throw new Error(`Failed to get model info: ${error.message}`);
        }
    }
    /**
     * Pull/download a model from Ollama registry
     * @param modelName - Name of the model to pull (e.g., "llama3.2:3b")
     * @param onProgress - Optional callback for progress updates
     */
    async pullModel(modelName, onProgress) {
        try {
            const response = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName, stream: true }),
            });
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.statusText}`);
            }
            if (!response.body) {
                throw new Error('No response body');
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const progress = JSON.parse(line);
                        if (onProgress) {
                            onProgress(progress);
                        }
                    }
                    catch {
                        // Ignore malformed JSON lines
                    }
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to pull model: ${error.message}`);
        }
    }
    /**
     * Generate a text response from the model
     * @param modelName - Name of the model to use
     * @param prompt - The prompt to send
     * @param options - Generation options (temperature, etc.)
     * @param systemPrompt - Optional system prompt
     */
    async generate(modelName, prompt, options, systemPrompt) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
            const request = {
                model: modelName,
                prompt,
                stream: false,
                options: this.mergeOptions(options),
            };
            if (systemPrompt) {
                request.system = systemPrompt;
            }
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Generation failed: ${response.statusText} - ${errorText}`);
            }
            const data = await response.json();
            return data.response;
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout during generation');
            }
            throw new Error(`Generation failed: ${error.message}`);
        }
    }
    /**
     * Chat completion with message history
     * @param modelName - Name of the model to use
     * @param messages - Array of chat messages
     * @param options - Generation options
     */
    async chat(modelName, messages, options) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
            const request = {
                model: modelName,
                messages,
                stream: false,
                options: this.mergeOptions(options),
            };
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Chat failed: ${response.statusText} - ${errorText}`);
            }
            const data = await response.json();
            return data.message.content;
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout during chat');
            }
            throw new Error(`Chat failed: ${error.message}`);
        }
    }
    /**
     * Generate with streaming response
     * @param modelName - Name of the model to use
     * @param prompt - The prompt to send
     * @param onToken - Callback for each token
     * @param options - Generation options
     */
    async generateStream(modelName, prompt, onToken, options) {
        try {
            const request = {
                model: modelName,
                prompt,
                stream: true,
                options: this.mergeOptions(options),
            };
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }
            if (!response.body) {
                throw new Error('No response body');
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            fullResponse += data.response;
                            onToken(data.response);
                        }
                    }
                    catch {
                        // Ignore malformed JSON lines
                    }
                }
            }
            return fullResponse;
        }
        catch (error) {
            throw new Error(`Streaming generation failed: ${error.message}`);
        }
    }
    /**
     * Merge user options with sensible defaults for game play
     */
    mergeOptions(options) {
        return {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            num_predict: 100, // Keep responses short for game actions
            repeat_penalty: 1.1,
            ...options,
        };
    }
    /**
     * Format bytes to human-readable string
     */
    static formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }
}
exports.OllamaService = OllamaService;
// Export singleton instance with default configuration
exports.ollamaService = new OllamaService();
//# sourceMappingURL=OllamaService.js.map