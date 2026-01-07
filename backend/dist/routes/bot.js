"use strict";
/**
 * Bot management API routes
 *
 * These endpoints allow any player to manage Ollama models and bot configurations
 * as long as Ollama is available on the hosting server.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bot_1 = require("../bot");
const server_1 = require("../server");
const router = (0, express_1.Router)();
// Bot routes are now available to all players (no localhost restriction)
// ============================================================================
// Validation Schemas
// ============================================================================
const BotConfigSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(1).max(30).default('Bot Player'),
    modelName: zod_1.z.string().min(1),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']).default('medium'),
    provider: zod_1.z.enum(['ollama', 'openrouter']).optional().default('ollama'),
    personality: zod_1.z.string().max(500).optional(),
    ollamaOptions: zod_1.z.object({
        temperature: zod_1.z.number().min(0).max(2).optional(),
        top_p: zod_1.z.number().min(0).max(1).optional(),
        top_k: zod_1.z.number().min(1).max(100).optional(),
        num_predict: zod_1.z.number().min(10).max(500).optional(),
        repeat_penalty: zod_1.z.number().min(0).max(2).optional(),
        seed: zod_1.z.number().optional(),
    }).optional(),
});
const BotPresetSchema = zod_1.z.object({
    presetName: zod_1.z.string().min(1).max(50),
    displayName: zod_1.z.string().min(1).max(30),
    modelName: zod_1.z.string().min(1),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']).default('medium'),
    provider: zod_1.z.enum(['ollama', 'openrouter']).optional().default('ollama'),
    personality: zod_1.z.string().max(500).optional(),
    ollamaConfig: zod_1.z.object({
        temperature: zod_1.z.number().min(0).max(2).optional(),
        top_p: zod_1.z.number().min(0).max(1).optional(),
        top_k: zod_1.z.number().min(1).max(100).optional(),
        num_predict: zod_1.z.number().min(10).max(500).optional(),
        repeat_penalty: zod_1.z.number().min(0).max(2).optional(),
        seed: zod_1.z.number().optional(),
    }).optional(),
});
// ============================================================================
// Ollama Status & Models
// ============================================================================
/**
 * GET /api/bot/ollama/status
 * Check if Ollama server is running and accessible
 */
router.get('/ollama/status', async (req, res) => {
    try {
        const available = await bot_1.botManager.isOllamaAvailable();
        const version = available ? await bot_1.botManager.getOllamaVersion() : null;
        res.json({
            available,
            version,
            baseUrl: 'http://localhost:11434',
        });
    }
    catch (error) {
        res.status(500).json({
            available: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/bot/ollama/models
 * List all available models from specified provider (default: ollama)
 */
router.get('/ollama/models', async (req, res) => {
    try {
        const provider = req.query.provider || 'ollama';
        // Validate provider
        if (provider !== 'ollama' && provider !== 'openrouter') {
            return res.status(400).json({ error: 'Invalid provider' });
        }
        const models = await bot_1.botManager.getAvailableModels(provider);
        // Format models for frontend
        const formattedModels = models.map(model => ({
            name: model.name,
            size: model.size,
            sizeFormatted: bot_1.OllamaService.formatBytes(model.size),
            modifiedAt: model.modified_at,
            details: model.details,
        }));
        res.json({ models: formattedModels });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to list models',
            message: error.message,
        });
    }
});
/**
 * GET /api/bot/ollama/models/:name
 * Get detailed information about a specific model
 */
router.get('/ollama/models/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const ollama = new bot_1.OllamaService();
        const info = await ollama.getModelInfo(name);
        res.json(info);
    }
    catch (error) {
        res.status(404).json({
            error: 'Model not found',
            message: error.message,
        });
    }
});
/**
 * POST /api/bot/ollama/pull
 * Pull/download a model from Ollama registry
 * Uses Server-Sent Events for progress updates
 */
router.post('/ollama/pull', async (req, res) => {
    const { modelName } = req.body;
    if (!modelName) {
        return res.status(400).json({ error: 'Model name is required' });
    }
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
        const ollama = new bot_1.OllamaService();
        await ollama.pullModel(modelName, (progress) => {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        });
        res.write(`data: ${JSON.stringify({ status: 'complete', done: true })}\n\n`);
        res.end();
    }
    catch (error) {
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.end();
    }
});
// ============================================================================
// Bot Presets (Saved Configurations)
// ============================================================================
/**
 * GET /api/bot/presets
 * List all saved bot presets
 */
router.get('/presets', async (req, res) => {
    try {
        const presets = await server_1.prisma.botPreset.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json({ presets });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to list presets',
            message: error.message,
        });
    }
});
/**
 * GET /api/bot/presets/:id
 * Get a specific bot preset
 */
router.get('/presets/:id', async (req, res) => {
    try {
        const preset = await server_1.prisma.botPreset.findUnique({
            where: { id: req.params.id },
        });
        if (!preset) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.json(preset);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to get preset',
            message: error.message,
        });
    }
});
/**
 * POST /api/bot/presets
 * Create a new bot preset
 */
router.post('/presets', async (req, res) => {
    try {
        const data = BotPresetSchema.parse(req.body);
        const preset = await server_1.prisma.botPreset.create({
            data: {
                presetName: data.presetName,
                displayName: data.displayName,
                modelName: data.modelName,
                difficulty: data.difficulty,
                provider: data.provider || 'ollama',
                personality: data.personality,
                ollamaConfig: data.ollamaConfig || {},
            },
        });
        res.status(201).json(preset);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors,
            });
        }
        // Handle unique constraint violation
        if (error.code === 'P2002') {
            return res.status(409).json({
                error: 'Preset name already exists',
            });
        }
        res.status(500).json({
            error: 'Failed to create preset',
            message: error.message,
        });
    }
});
/**
 * PUT /api/bot/presets/:id
 * Update a bot preset
 */
router.put('/presets/:id', async (req, res) => {
    try {
        const data = BotPresetSchema.partial().parse(req.body);
        const preset = await server_1.prisma.botPreset.update({
            where: { id: req.params.id },
            data: {
                presetName: data.presetName,
                displayName: data.displayName,
                modelName: data.modelName,
                difficulty: data.difficulty,
                provider: data.provider,
                personality: data.personality,
                ollamaConfig: data.ollamaConfig,
            },
        });
        res.json(preset);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors,
            });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.status(500).json({
            error: 'Failed to update preset',
            message: error.message,
        });
    }
});
/**
 * DELETE /api/bot/presets/:id
 * Delete a bot preset
 */
router.delete('/presets/:id', async (req, res) => {
    try {
        await server_1.prisma.botPreset.delete({
            where: { id: req.params.id },
        });
        res.json({ success: true });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Preset not found' });
        }
        res.status(500).json({
            error: 'Failed to delete preset',
            message: error.message,
        });
    }
});
// ============================================================================
// Bot Statistics
// ============================================================================
/**
 * GET /api/bot/stats
 * Get bot manager statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = bot_1.botManager.getStats();
        const ollamaAvailable = await bot_1.botManager.isOllamaAvailable();
        res.json({
            ...stats,
            ollamaAvailable,
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to get stats',
            message: error.message,
        });
    }
});
// ============================================================================
// Bot Validation
// ============================================================================
/**
 * POST /api/bot/validate
 * Validate a bot configuration (test model availability, generate test response)
 */
router.post('/validate', async (req, res) => {
    try {
        const data = BotConfigSchema.parse(req.body);
        const providerType = data.provider || 'ollama';
        // Check if provider is available
        const providerAvailable = await bot_1.botManager.isProviderAvailable(providerType);
        if (!providerAvailable) {
            const errorMsg = providerType === 'openrouter'
                ? 'OpenRouter API is not accessible (check API key)'
                : 'Ollama server is not available';
            return res.status(503).json({
                valid: false,
                error: errorMsg,
            });
        }
        // Check if model exists
        const models = await bot_1.botManager.getAvailableModels(providerType);
        const modelExists = models.some(m => m.name === data.modelName);
        if (!modelExists) {
            // For OpenRouter, we might not have the full list cached, so we might want to be lenient
            // or ensure we fetched the latest list. For now, we enforce strict checking.
            return res.status(400).json({
                valid: false,
                error: `Model "${data.modelName}" is not available on ${providerType}.`,
                availableModels: models.map(m => m.name),
            });
        }
        // Try a test generation using the provider directly (via temporary bot or service)
        // We'll Create a temporary bot instance to test generation
        const tempBot = bot_1.botManager.createBot({
            ...data,
            displayName: 'Validation Bot',
        });
        // We can't access private tempBot.strategy.llm directly easily without changing visibility
        // Instead, we'll instantiate the service directly for validation
        let testResponse = '';
        const prompt = 'Say "ready" if you can respond.';
        const options = { ...data.ollamaOptions, num_predict: 20 };
        if (providerType === 'openrouter') {
            const { openRouterService } = await Promise.resolve().then(() => __importStar(require('../bot/OpenRouterService')));
            testResponse = await openRouterService.generate(data.modelName, prompt, options);
        }
        else {
            const { ollamaService } = await Promise.resolve().then(() => __importStar(require('../bot/OllamaService')));
            testResponse = await ollamaService.generate(data.modelName, prompt, options);
        }
        // Clean up the temp bot from manager (it was added to the map)
        bot_1.botManager.destroyBot(tempBot.id);
        res.json({
            valid: true,
            modelName: data.modelName,
            testResponse: testResponse.trim(),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                valid: false,
                error: 'Validation failed',
                details: error.errors,
            });
        }
        res.status(500).json({
            valid: false,
            error: 'Validation failed',
            message: error.message,
        });
    }
});
exports.default = router;
//# sourceMappingURL=bot.js.map