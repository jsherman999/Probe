"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Environment bootstrap.
 *
 * Imported as the very first statement of server.ts so that backend/.env is
 * loaded before any other module is evaluated. Several modules read
 * process.env at import time (the LM Studio / OpenRouter singletons, the
 * default-provider constant in routes/bot.ts), so dotenv must run first.
 *
 * Looks in the current directory first, then next to the compiled/source tree
 * (backend/.env), so the server also works when started from the repo root.
 */
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
//# sourceMappingURL=env.js.map