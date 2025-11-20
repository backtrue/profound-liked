import { useEffect, useState } from "react";

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

    // Create WebSocket connection to Durable Object
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/${sessionId}?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[WebSocket] Connected");
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log("[WebSocket] Disconnected");
      setIsConnected(false);
    };

    ws.onerror = (event) => {
      console.error("[WebSocket] Error:", event);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'progress') {
          console.log("[WebSocket] Progress update:", message.data);
          setProgress(message.data);
        } else if (message.type === 'error') {
          console.log("[WebSocket] Error:", message.data);
          setError(message.data);
        } else if (message.type === 'pong') {
          // Heartbeat response
        }
      } catch (err) {
        console.error("[WebSocket] Failed to parse message:", err);
      }
    };

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeat);
      ws.close();
    };
  }, [sessionId]);

  return {
    progress,
    error,
    isConnected,
  };
}
