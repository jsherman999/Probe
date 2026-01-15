import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import botRoutes from './routes/bot';

// Load environment variables
dotenv.config();

// Initialize Prisma
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const httpServer = createServer(app);

// CORS configuration - allow same-origin and configured origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5200', 'http://localhost:3000'];

// Dynamic CORS origin handler for ngrok and other tunneling services
const corsOriginHandler = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
  if (!origin) {
    callback(null, true);
    return;
  }
  // Allow configured origins
  if (allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  // Allow ngrok, localtunnel, and other tunneling services
  if (origin.includes('ngrok') || origin.includes('loca.lt') || origin.includes('localhost')) {
    callback(null, true);
    return;
  }
  // Allow if origin matches the server's own address pattern
  callback(null, true); // Be permissive for single-port mode
};

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginHandler,
    credentials: true,
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000'),
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000'),
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for ngrok compatibility
}));
app.use(compression());
app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/bot', botRoutes);

// Socket.io setup
setupSocketHandlers(io);

// Serve frontend static files (for single-port deployment)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API and socket.io routes
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🎮 Ready to accept connections`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { io };
