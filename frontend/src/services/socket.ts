import { io, Socket } from 'socket.io-client';
import { getSocketUrl, getServerUrl } from '../utils/config';

const SOCKET_URL = getSocketUrl();

interface SocketConfig {
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
}

const DEFAULT_CONFIG: SocketConfig = {
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
};

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private config: SocketConfig = DEFAULT_CONFIG;
  private eventHandlers = new Map<string, Set<(...args: any[]) => void>>();
  private onAuthError: (() => void) | null = null;
  private isRefreshingToken = false;
  private onTokenRefreshed: ((newToken: string) => void) | null = null;

  connect(token: string): Socket {
    // If already connected, reuse
    if (this.socket?.connected) {
      console.log('🔄 Reusing existing socket connection');
      return this.socket;
    }

    // Clean up any existing stale socket
    if (this.socket) {
      console.log('🧹 Cleaning up stale socket');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('🔌 Creating new socket connection to', SOCKET_URL);
    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      timeout: this.config.timeout,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    return this.socket;
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.reattachEventHandlers();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, manually reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', async (error) => {
      console.error('❌ Connection error:', error.message);
      this.reconnectAttempts++;

      // Check for auth errors - try to refresh token first before logging out
      if (error.message.includes('Invalid') || error.message.includes('token') || error.message.includes('Authentication')) {
        console.warn('🔒 Auth error detected, attempting token refresh...');

        // Don't try multiple refreshes simultaneously
        if (this.isRefreshingToken) {
          console.log('🔄 Token refresh already in progress, waiting...');
          return;
        }

        this.isRefreshingToken = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            console.error('❌ No refresh token available, logging out');
            if (this.onAuthError) this.onAuthError();
            return;
          }

          const serverUrl = getServerUrl();
          const response = await fetch(`${serverUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Token refreshed successfully, reconnecting socket...');
            localStorage.setItem('token', data.token);

            // Notify app of new token
            if (this.onTokenRefreshed) {
              this.onTokenRefreshed(data.token);
            }

            // Reconnect with new token
            this.reconnectAttempts = 0;
            this.disconnect();
            this.connect(data.token);
          } else {
            console.error('❌ Token refresh failed, logging out');
            if (this.onAuthError) this.onAuthError();
          }
        } catch (err) {
          console.error('❌ Token refresh error:', err);
          if (this.onAuthError) this.onAuthError();
        } finally {
          this.isRefreshingToken = false;
        }
        return;
      }

      if (this.reconnectAttempts >= this.config.reconnectionAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed - max attempts reached');
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  private reattachEventHandlers(): void {
    this.eventHandlers.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.on(event, callback);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
      this.eventHandlers.clear();
    }
  }

  setAuthErrorHandler(callback: () => void): void {
    this.onAuthError = callback;
  }

  setTokenRefreshedHandler(callback: (newToken: string) => void): void {
    this.onTokenRefreshed = callback;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data?: any): void {
    if (!this.socket || !this.isConnected()) {
      console.warn('Cannot emit - socket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  // Emit with callback and error handling
  emitWithAck(event: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(event, data, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.eventHandlers.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      this.eventHandlers.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  // Helper to ping server for latency check
  async ping(): Promise<number> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('ping', (response: any) => {
        const latency = Date.now() - startTime;
        resolve(latency);
      });

      setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);
    });
  }
}

export default new SocketService();
