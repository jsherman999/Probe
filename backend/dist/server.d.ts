import './env';
import { Server } from 'socket.io';
import { prisma } from './db';
export { prisma };
declare const io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { io };
//# sourceMappingURL=server.d.ts.map