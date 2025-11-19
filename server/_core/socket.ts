import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

export function initializeSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io/",
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });

    // Join a specific session room
    socket.on("join-session", (sessionId: number) => {
      const roomName = `session-${sessionId}`;
      socket.join(roomName);
      console.log(`[Socket.IO] Client ${socket.id} joined room: ${roomName}`);
    });

    // Leave a session room
    socket.on("leave-session", (sessionId: number) => {
      const roomName = `session-${sessionId}`;
      socket.leave(roomName);
      console.log(`[Socket.IO] Client ${socket.id} left room: ${roomName}`);
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit progress update to all clients in a session room
 */
export function emitProgress(sessionId: number, progress: {
  status: "running" | "completed" | "failed";
  currentQuery: number;
  totalQueries: number;
  currentEngine: string;
  successCount: number;
  failedCount: number;
  estimatedTimeRemaining?: number;
  message?: string;
  rateLimit?: string;
}) {
  if (!io) {
    console.warn("[Socket.IO] Socket.IO not initialized");
    return;
  }

  const roomName = `session-${sessionId}`;
  io.to(roomName).emit("progress", progress);
  console.log(`[Socket.IO] Progress emitted to ${roomName}:`, progress);
}

/**
 * Emit error to all clients in a session room
 */
export function emitError(sessionId: number, error: { message: string }) {
  if (!io) {
    console.warn("[Socket.IO] Socket.IO not initialized");
    return;
  }

  const roomName = `session-${sessionId}`;
  io.to(roomName).emit("error", error);
  console.log(`[Socket.IO] Error emitted to ${roomName}:`, error);
}
