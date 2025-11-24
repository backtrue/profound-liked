import { DurableObject } from 'cloudflare:workers';
import { Env } from '../index';

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
    private state: DurableObjectState;
    private env: Env;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.env = env;
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Handle /start endpoint for batch test execution
        if (url.pathname === '/start' && request.method === 'POST') {
            try {
                const body = await request.json() as {
                    sessionId: number;
                    projectId: number;
                    userId: number;
                    targetMarket: 'TW' | 'JP';
                };

                console.log('[Durable Object] Starting batch test for session:', body.sessionId);

                // Start batch test execution (don't await - run in background)
                // Use waitUntil to ensure the background task completes even if the request finishes
                this.state.waitUntil(
                    this.executeBatchTest(body).catch(error => {
                        console.error('[Durable Object] Batch test failed:', error);
                        this.broadcastError(String(body.sessionId), {
                            message: error instanceof Error ? error.message : 'Unknown error'
                        });
                    })
                );

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('[Durable Object] Failed to start batch test:', error);
                return new Response(JSON.stringify({
                    error: error instanceof Error ? error.message : 'Unknown error'
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Handle WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
            return new Response('Expected WebSocket', { status: 426 });
        }

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

    // Method to execute batch test
    private async executeBatchTest(params: {
        sessionId: number;
        projectId: number;
        userId: number;
        targetMarket: 'TW' | 'JP';
    }) {
        const sessionId = String(params.sessionId);

        console.log('[Durable Object] Executing batch test for session:', sessionId);

        try {
            // Dynamically import to avoid circular dependencies if any
            const { BatchTestExecutor } = await import('../batchTestExecutor');

            const executor = new BatchTestExecutor(
                this.env,
                params,
                async (progress) => {
                    await this.broadcastProgress(sessionId, progress);
                }
            );

            await executor.run();

        } catch (error) {
            console.error('[Durable Object] Batch test execution failed:', error);
            await this.broadcastError(sessionId, {
                message: error instanceof Error ? error.message : 'Batch test failed'
            });

            // Update status to failed if not already done by executor
            await this.broadcastProgress(sessionId, {
                status: 'failed',
                currentQuery: 0,
                totalQueries: 0,
                currentEngine: 'Error',
                successCount: 0,
                failedCount: 0,
                message: error instanceof Error ? error.message : 'Batch test failed'
            });
        }
    }
}
