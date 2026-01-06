/**
 * Middleware to restrict access to localhost only
 *
 * This is used for bot management endpoints since only users
 * on the hosting machine should be able to add/configure bots.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Check if a request is coming from localhost
 */
export declare function isLocalhost(ip: string | undefined): boolean;
/**
 * Middleware that only allows requests from localhost
 */
export declare function requireLocalhost(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Check if a socket connection is from localhost
 */
export declare function isSocketFromLocalhost(socketAddress: string | undefined): boolean;
//# sourceMappingURL=localOnly.d.ts.map