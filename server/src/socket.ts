import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./middleware/auth";
import { db } from "./db/schema";

let io: SocketIOServer | null = null;

export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    },
    transports: ["websocket", "polling"]
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") return next(new Error("Authentication required"));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: number };
      const user = await db.get<{ id: number }>("SELECT id FROM users WHERE id = $1", [payload.id]);
      if (!user) return next(new Error("User no longer exists"));
      socket.data.userId = payload.id;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`⚡ [Socket.IO] Client connected: ${socket.id}`);

    const userId = Number(socket.data.userId);
    if (userId) socket.join(`user:${userId}`);

    // Ministry rooms remain available for existing live-data subscriptions.
    socket.on("join:ministry", async (ministryId: number | string) => {
      if (!ministryId) return;
      const allowed = await db.get<{ allowed: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = $1 AND (
            r.name = 'Admin' OR EXISTS (
              SELECT 1 FROM user_ministries um WHERE um.user_id = u.id AND um.ministry_id = $2
            )
          )
        ) AS allowed
      `, [userId, Number(ministryId)]).catch(() => null);
      if (allowed?.allowed) socket.join(`ministry:${ministryId}`);
    });

    socket.on("leave:ministry", (ministryId: number | string) => {
      if (ministryId) {
        socket.leave(`ministry:${ministryId}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 [Socket.IO] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast real-time event to all connected clients
 */
export function emitRealtimeEvent(event: string, payload: any = {}): void {
  if (io) {
    io.emit(event, {
      ...payload,
      _timestamp: new Date().toISOString()
    });
  }
}

/**
 * Broadcast real-time event to specific ministry room
 */
export function emitMinistryEvent(ministryId: number | string, event: string, payload: any = {}): void {
  if (io) {
    io.to(`ministry:${ministryId}`).emit(event, {
      ...payload,
      ministryId,
      _timestamp: new Date().toISOString()
    });
  }
}

export function emitUserEvent(userId: number | string, event: string, payload: unknown = {}): void {
  if (io) {
    const data = typeof payload === "object" && payload !== null ? payload : { value: payload };
    io.to(`user:${userId}`).emit(event, { ...data, _timestamp: new Date().toISOString() });
  }
}
