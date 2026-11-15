import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client singleton.
 *
 * Kept in its own module (instead of server.ts) so that game and bot modules
 * can import the database client without creating a circular dependency with
 * the application entry point (server.ts -> socket -> GameManager -> server).
 */
export const prisma = new PrismaClient();
