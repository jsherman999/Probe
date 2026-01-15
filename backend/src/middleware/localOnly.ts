/**
 * Middleware to restrict access to localhost only
 *
 * This is used for bot management endpoints since only users
 * on the hosting machine should be able to add/configure bots.
 */

import { Request, Response, NextFunction } from 'express';
import { networkInterfaces } from 'os';

// Cache the server's own IP addresses
let serverIPs: Set<string> | null = null;

function getServerIPs(): Set<string> {
  if (serverIPs) return serverIPs;

  serverIPs = new Set([
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
  ]);

  // Add all local network interface IPs
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Add both raw IP and IPv4-mapped IPv6 format
      serverIPs.add(net.address);
      if (net.family === 'IPv4') {
        serverIPs.add(`::ffff:${net.address}`);
      }
    }
  }

  console.log('🔍 Server IPs for localhost check:', Array.from(serverIPs));
  return serverIPs;
}

/**
 * Check if a request is coming from localhost or the server's own IP
 */
export function isLocalhost(ip: string | undefined): boolean {
  if (!ip) return false;
  return getServerIPs().has(ip);
}

/**
 * Middleware that only allows requests from localhost
 */
export function requireLocalhost(req: Request, res: Response, next: NextFunction) {
  // Get the client IP address
  // Express may use x-forwarded-for if behind a proxy
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;

  if (!isLocalhost(ip)) {
    console.warn(`[localOnly] Blocked non-localhost request from IP: ${ip}`);
    return res.status(403).json({
      error: 'Bot management is only available from localhost',
      message: 'This endpoint can only be accessed from the machine hosting the game server.',
    });
  }

  next();
}

/**
 * Check if a socket connection is from localhost
 */
export function isSocketFromLocalhost(socketAddress: string | undefined): boolean {
  return isLocalhost(socketAddress);
}
