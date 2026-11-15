"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
/**
 * Shared Prisma client singleton.
 *
 * Kept in its own module (instead of server.ts) so that game and bot modules
 * can import the database client without creating a circular dependency with
 * the application entry point (server.ts -> socket -> GameManager -> server).
 */
exports.prisma = new client_1.PrismaClient();
//# sourceMappingURL=db.js.map