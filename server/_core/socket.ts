import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

// Store current progress for each session
const sessionProgress = new Map<number, {
  status: "running" | "completed" | "failed";
  currentQuery: number;
  totalQueries: number;
  currentEngine: string;
  successCount: number;
  failedCount: number;
  estimatedTimeRemaining?: number;
  message?: string;
  rateLimit?: string;
}>();

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
      
      // Send current progress if available
      const currentProgress = sessionProgress.get(sessionId);
      if (currentProgress) {
        socket.emit("progress", currentProgress);
        console.log(`[Socket.IO] Sent current progress to ${socket.id}:`, currentProgress);
      }
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
  
  // Store current progress
  sessionProgress.set(sessionId, progress);
  
  // Emit to all clients in the room
  io.to(roomName).emit("progress", progress);
  console.log(`[Socket.IO] Progress emitted to ${roomName}:`, progress);
  
  // Clean up progress when completed or failed
  if (progress.status === "completed" || progress.status === "failed") {
    setTimeout(() => {
      sessionProgress.delete(sessionId);
      console.log(`[Socket.IO] Cleaned up progress for session ${sessionId}`);
    }, 60000); // Keep for 1 minute after completion
  }
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
