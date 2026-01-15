/**
 * Get the base URL for API requests.
 * Uses relative path when served from same origin (single-port mode),
 * otherwise uses environment variable or localhost default.
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production/same-origin mode, use relative path
  if (window.location.port === '3000' || window.location.hostname !== 'localhost') {
    return '/api';
  }
  // Development mode with separate frontend server
  return 'http://localhost:3000/api';
}

/**
 * Get the base URL for socket connections.
 * Uses current origin when served from same origin (single-port mode),
 * otherwise uses environment variable or localhost default.
 */
export function getSocketUrl(): string {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // In production/same-origin mode, use current origin
  if (window.location.port === '3000' || window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  // Development mode with separate frontend server
  return 'http://localhost:3000';
}

/**
 * Get the base server URL (without /api suffix).
 * Used for non-API endpoints like auth refresh.
 */
export function getServerUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    // Remove /api suffix if present
    return import.meta.env.VITE_API_URL.replace(/\/api$/, '');
  }
  // In production/same-origin mode, use current origin
  if (window.location.port === '3000' || window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  // Development mode with separate frontend server
  return 'http://localhost:3000';
}
