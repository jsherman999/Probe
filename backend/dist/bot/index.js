"use strict";
/**
 * Bot module exports
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotStrategy = exports.botManager = exports.BotManager = exports.BotPlayer = exports.ollamaService = exports.OllamaService = void 0;
// Types
__exportStar(require("./types"), exports);
// Services
var OllamaService_1 = require("./OllamaService");
Object.defineProperty(exports, "OllamaService", { enumerable: true, get: function () { return OllamaService_1.OllamaService; } });
Object.defineProperty(exports, "ollamaService", { enumerable: true, get: function () { return OllamaService_1.ollamaService; } });
var BotPlayer_1 = require("./BotPlayer");
Object.defineProperty(exports, "BotPlayer", { enumerable: true, get: function () { return BotPlayer_1.BotPlayer; } });
var BotManager_1 = require("./BotManager");
Object.defineProperty(exports, "BotManager", { enumerable: true, get: function () { return BotManager_1.BotManager; } });
Object.defineProperty(exports, "botManager", { enumerable: true, get: function () { return BotManager_1.botManager; } });
// Strategies
var strategies_1 = require("./strategies");
Object.defineProperty(exports, "BotStrategy", { enumerable: true, get: function () { return strategies_1.BotStrategy; } });
//# sourceMappingURL=index.js.map