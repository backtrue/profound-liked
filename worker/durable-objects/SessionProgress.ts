import { DurableObject } from 'cloudflare:workers';

interface ProgressData {
    status: 'running' | 'completed' | 'failed';
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

export class SessionProgress extends DurableObject {
    private sessions: Map<string, WebSocket[]> = new Map();
    private progressData: Map<string, ProgressData> = new Map();

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
    }

    async fetch(request: Request): Promise<Response> {
        // Handle WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
            return new Response('Expected WebSocket', { status: 426 });
        }

        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            return new Response('Missing sessionId', { status: 400 });
        }

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept the WebSocket connection
        this.handleSession(server, sessionId);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    handleSession(ws: WebSocket, sessionId: string) {
        // Accept the WebSocket
        ws.accept();

        // Add to session list
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, []);
        }
        this.sessions.get(sessionId)!.push(ws);

        console.log(`[Durable Object] Client joined session: ${sessionId}`);

        // Send current progress if available
        const currentProgress = this.progressData.get(sessionId);
        if (currentProgress) {
            ws.send(JSON.stringify({ type: 'progress', data: currentProgress }));
        }

        // Handle messages from client
        ws.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data as string);

                if (message.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (error) {
                console.error('[Durable Object] Failed to parse message:', error);
            }
        });

        // Handle close
        ws.addEventListener('close', () => {
            console.log(`[Durable Object] Client left session: ${sessionId}`);
            const sockets = this.sessions.get(sessionId);
            if (sockets) {
                const index = sockets.indexOf(ws);
                if (index > -1) {
                    sockets.splice(index, 1);
                }
                if (sockets.length === 0) {
                    this.sessions.delete(sessionId);
                }
            }
        });

        // Handle errors
        ws.addEventListener('error', (event) => {
            console.error('[Durable Object] WebSocket error:', event);
        });
    }

    // Method to broadcast progress to all clients in a session
    async broadcastProgress(sessionId: string, progress: ProgressData) {
        // Store progress data
        this.progressData.set(sessionId, progress);

        // Broadcast to all connected clients
        const sockets = this.sessions.get(sessionId);
        if (sockets) {
            const message = JSON.stringify({ type: 'progress', data: progress });
            for (const ws of sockets) {
                try {
                    ws.send(message);
                } catch (error) {
                    console.error('[Durable Object] Failed to send to client:', error);
                }
            }
        }

        // Clean up progress data when completed or failed
        if (progress.status === 'completed' || progress.status === 'failed') {
            // Keep for 1 minute then delete
            setTimeout(() => {
                this.progressData.delete(sessionId);
            }, 60000);
        }
    }

    // Method to broadcast error to all clients in a session
    async broadcastError(sessionId: string, error: ErrorData) {
        const sockets = this.sessions.get(sessionId);
        if (sockets) {
            const message = JSON.stringify({ type: 'error', data: error });
            for (const ws of sockets) {
                try {
                    ws.send(message);
                } catch (err) {
                    console.error('[Durable Object] Failed to send error to client:', err);
                }
            }
        }
    }
}
