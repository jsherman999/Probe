"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const server_1 = require("../server");
const router = (0, express_1.Router)();
// Validation schemas
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
    displayName: zod_1.z.string().min(1).max(100),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string(),
});
// Register/Login (simplified - no password for now, just username)
router.post('/login', async (req, res) => {
    try {
        const { username, displayName } = registerSchema.parse(req.body);
        // Find or create user
        let user = await server_1.prisma.user.findUnique({
            where: { username },
        });
        if (!user) {
            user = await server_1.prisma.user.create({
                data: {
                    username,
                    displayName: displayName || username,
                },
            });
        }
        else {
            // Update last seen
            user = await server_1.prisma.user.update({
                where: { id: user.id },
                data: { lastSeen: new Date() },
            });
        }
        // Generate tokens
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' });
        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
            },
            token,
            refreshToken,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await server_1.prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Generate new token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        res.json({ token });
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});
// Get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await server_1.prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
        });
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map