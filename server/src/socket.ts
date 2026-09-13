import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

let io: SocketIOServer | null = null;

export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    },
    transports: ["websocket", "polling"]
  });

  io.on("connection", (socket: Socket) => {
    console.log(`⚡ [Socket.IO] Client connected: ${socket.id}`);

    // Allow client to join specific ministry room if needed
    socket.on("join:ministry", (ministryId: number | string) => {
      if (ministryId) {
        socket.join(`ministry:${ministryId}`);
      }
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
