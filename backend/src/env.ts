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
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
