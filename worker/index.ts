import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createTRPCContext, trpcServer } from './trpc';
import { appRouter } from './routers';
import { SessionProgress } from './durable-objects/SessionProgress';

// Export Durable Object
export { SessionProgress };

// Types for Cloudflare Workers environment
export interface Env {
  // D1 Database
  DB: D1Database;

  // Durable Objects
  SESSION_PROGRESS: DurableObjectNamespace;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OAUTH_SERVER_URL: string;
  OWNER_OPEN_ID: string;
  VITE_APP_ID: string;
  ENCRYPTION_KEY: string;

  // Optional
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;

  // R2 Storage (if used)
  // STORAGE: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('/*', cors({
  origin: ['*'], // Update with your domain in production
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// tRPC API routes
app.use('/api/trpc/*', async (c) => {
  const path = c.req.path.replace('/api/trpc/', '');

  return trpcServer({
    router: appRouter,
    createContext: () => createTRPCContext(c),
    endpoint: '/api/trpc',
  })(c);
});

// OAuth callback route
app.get('/api/oauth/callback', async (c) => {
  const { handleOAuthCallback } = await import('./oauth');
  return handleOAuthCallback(c);
});

// WebSocket upgrade for Durable Objects
app.get('/api/ws/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  // Get Durable Object ID
  const id = c.env.SESSION_PROGRESS.idFromName(`session-${sessionId}`);
  const stub = c.env.SESSION_PROGRESS.get(id);

  // Forward the request to the Durable Object
  return stub.fetch(c.req.raw);
});

// Serve static files from Pages (in production, Pages handles this)
// This is mainly for development/testing
app.get('/*', (c) => {
  return c.text('Static files served by Cloudflare Pages', 404);
});

export default app;
