"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication token missing'));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;
        next();
    }
    catch (err) {
        next(new Error('Invalid authentication token'));
    }
};
exports.authenticateSocket = authenticateSocket;
//# sourceMappingURL=socketAuth.js.map