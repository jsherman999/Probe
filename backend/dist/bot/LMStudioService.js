"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.lmstudioService = exports.LMStudioService = void 0;
class LMStudioService {
    baseUrl;
    defaultTimeout;
    minMaxTokens;
    defaultReasoningEffort;
    constructor(baseUrl, defaultTimeout, minMaxTokens, defaultReasoningEffort) {
        this.baseUrl = (baseUrl ?? process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1').replace(/\/$/, '');
        this.defaultTimeout = defaultTimeout ?? (parseInt(process.env.LMSTUDIO_TIMEOUT_MS || '', 10) || 55000);
        this.minMaxTokens = minMaxTokens ?? (parseInt(process.env.LMSTUDIO_MIN_MAX_TOKENS || '', 10) || 2048);
        const envEffort = process.env.LMSTUDIO_REASONING_EFFORT;
        this.defaultReasoningEffort = defaultReasoningEffort ?? (envEffort === 'medium' || envEffort === 'high' ? envEffort : 'low');
    }
    getProviderName() {
        return 'lmstudio';
    }
    /**
     * Base URL of the OpenAI-compatible API (for status responses)
     */
    getBaseUrl() {
        return this.baseUrl;
    }
    /**
     * Check if the LM Studio server is running and accessible
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${this.baseUrl}/models`, {
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
     * Get LM Studio version information.
     * The OpenAI-compatible API has no version endpoint, so we try the
     * non-OpenAI /api/version endpoint and return null if it is unavailable.
     */
    async getVersion() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            // Strip the /v1 suffix to reach the native LM Studio API
            const nativeBase = this.baseUrl.replace(/\/v1$/, '');
            const response = await fetch(`${nativeBase}/api/version`, {
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
     * List all models loaded in LM Studio.
     * Maps OpenAI model objects onto the OllamaModel shape used across the bot system.
     */
    async listModels() {
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
            const data = await response.json();
            return (data.data || []).map((m) => ({
                name: m.id,
                size: 0, // LM Studio does not report model sizes via the OpenAI API
                digest: '',
                modified_at: m.created ? new Date(m.created * 1000).toISOString() : new Date(0).toISOString(),
            }));
        }
        catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout while listing models');
            }
            throw new Error(`Failed to list models: ${error.message}`);
        }
    }
    /**
     * Generate a text response from the model (single prompt, optional system prompt)
     */
    async generate(modelName, prompt, options, systemPrompt) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        return this.chat(modelName, messages, options);
    }
    /**
     * Chat completion with message history via /v1/chat/completions
     */
    async chat(modelName, messages, options) {
        console.log(`🔮 [LMStudioService] Generating with model: ${modelName} (${this.baseUrl})`);
        console.log(`🔮 [LMStudioService] Messages: ${messages.length}, last length: ${messages[messages.length - 1]?.content?.length ?? 0} chars`);
        const startTime = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
            const request = {
                model: modelName,
                messages,
                stream: false,
                ...this.mapOptions(options),
            };
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startTime;
            console.log(`🔮 [LMStudioService] Response received in ${elapsed}ms, status: ${response.status}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`🔮 [LMStudioService] Generation failed: ${response.statusText} - ${errorText}`);
                throw new Error(`Generation failed: ${response.statusText} - ${errorText}`);
            }
            const data = await response.json();
            const message = data.choices?.[0]?.message;
            let content = (message?.content ?? '').trim();
            const reasoningContent = message?.reasoning_content;
            if (!content) {
                // Thinking models may spend their entire token budget on reasoning and return
                // empty content. Surface a clear error so callers can fall back gracefully.
                console.warn(`🔮 [LMStudioService] Empty content from ${modelName} (reasoning tokens: ${reasoningContent?.length ?? 0}). ` +
                    'The model likely spent its whole token budget on reasoning.');
            }
            console.log(`🔮 [LMStudioService] Response text: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
            return content;
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            if (error.name === 'AbortError') {
                console.error(`🔮 [LMStudioService] Request TIMEOUT after ${elapsed}ms`);
                throw new Error('Request timeout during generation');
            }
            console.error(`🔮 [LMStudioService] Generation ERROR after ${elapsed}ms: ${error.message}`);
            throw new Error(`Generation failed: ${error.message}`);
        }
    }
    /**
     * Map Ollama-style options onto OpenAI-compatible parameters.
     * - num_predict -> max_completion_tokens (with a floor for thinking models)
     * - top_k / repeat_penalty / num_ctx are Ollama-specific and not part of the
     *   OpenAI API, so they are dropped.
     */
    mapOptions(options) {
        const merged = {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 100, // Keep responses short for game actions
            ...options,
        };
        const mapped = {
            temperature: merged.temperature,
            top_p: merged.top_p,
        };
        // Enforce a minimum completion budget so thinking models have tokens left for content
        const maxTokens = Math.max(merged.num_predict ?? 100, this.minMaxTokens);
        mapped.max_completion_tokens = maxTokens;
        if (merged.stop) {
            mapped.stop = merged.stop;
        }
        if (merged.seed !== undefined) {
            mapped.seed = merged.seed;
        }
        // OpenAI-standard reasoning control (honored by models like gpt-oss)
        mapped.reasoning_effort = merged.reasoning_effort ?? this.defaultReasoningEffort;
        return mapped;
    }
}
exports.LMStudioService = LMStudioService;
// Export singleton instance with default configuration (env-driven)
exports.lmstudioService = new LMStudioService();
//# sourceMappingURL=LMStudioService.js.map