"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const socket_1 = require("./socket");
const auth_1 = __importDefault(require("./routes/auth"));
const game_1 = __importDefault(require("./routes/game"));
const bot_1 = __importDefault(require("./routes/bot"));
// Load environment variables
dotenv_1.default.config();
// Initialize Prisma
exports.prisma = new client_1.PrismaClient();
// Create Express app
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// CORS configuration - allow same-origin and configured origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5200', 'http://localhost:3000'];
// Dynamic CORS origin handler for ngrok and other tunneling services
const corsOriginHandler = (origin, callback) => {
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
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: corsOriginHandler,
        credentials: true,
    },
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000'),
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000'),
});
exports.io = io;
// Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP for ngrok compatibility
}));
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: corsOriginHandler,
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', auth_1.default);
app.use('/api/game', game_1.default);
app.use('/api/bot', bot_1.default);
// Socket.io setup
(0, socket_1.setupSocketHandlers)(io);
// Serve frontend static files (for single-port deployment)
const frontendPath = path_1.default.join(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendPath));
// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
    // Skip API and socket.io routes
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path === '/health') {
        return next();
    }
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
// Error handling
app.use((err, req, res, next) => {
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
    await exports.prisma.$disconnect();
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await exports.prisma.$disconnect();
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map