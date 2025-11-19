import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface ProgressData {
  status: "running" | "completed" | "failed";
  currentQuery: number;
  totalQueries: number;
  currentEngine: string;
  successCount: number;
  failedCount: number;
  estimatedTimeRemaining?: number;
  message?: string;
  rateLimit?: string;
}

interface ErrorData {
  message: string;
}

export function useAnalysisProgress(sessionId: number | null) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<ErrorData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Create Socket.IO connection
    const socket: Socket = io({
      path: "/socket.io/",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected");
      setIsConnected(true);
      
      // Join the session room
      socket.emit("join-session", sessionId);
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Disconnected");
      setIsConnected(false);
    });

    socket.on("progress", (data: ProgressData) => {
      console.log("[Socket.IO] Progress update:", data);
      setProgress(data);
    });

    socket.on("error", (data: ErrorData) => {
      console.log("[Socket.IO] Error:", data);
      setError(data);
    });

    // Cleanup on unmount
    return () => {
      socket.emit("leave-session", sessionId);
      socket.disconnect();
    };
  }, [sessionId]);

  return {
    progress,
    error,
    isConnected,
  };
}
