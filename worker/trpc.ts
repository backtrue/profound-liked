import { initTRPC, TRPCError } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { Context as HonoContext } from 'hono';
import { getCookie } from 'hono/cookie';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '../shared/const';
import type { Env } from './index';
import superjson from 'superjson';

// User type from shared schema
export interface User {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    role: 'user' | 'admin';
}

// Context type
export interface TRPCContext {
    user: User | null;
    env: Env;
    req: Request;
    res: {
        headers: Headers;
    };
}

// Create context from Hono context
export async function createTRPCContext(
    c: HonoContext<{ Bindings: Env }>
): Promise<TRPCContext> {
    const env = c.env;
    const req = c.req.raw;
    const headers = new Headers();

    // Get session cookie
    const sessionToken = getCookie(c, COOKIE_NAME);

    let user: User | null = null;

    if (sessionToken) {
        try {
            // Verify JWT token
            const secret = new TextEncoder().encode(env.JWT_SECRET);
            const { payload } = await jwtVerify(sessionToken, secret);

            user = {
                id: payload.id as number,
                openId: payload.openId as string,
                name: payload.name as string | null,
                email: payload.email as string | null,
                loginMethod: payload.loginMethod as string | null,
                role: (payload.role as 'user' | 'admin') || 'user',
            };
        } catch (error) {
            console.error('Failed to verify session token:', error);
            // Invalid token, user remains null
        }
    }

    return {
        user,
        env,
        req,
        res: { headers },
    };
}

// Initialize tRPC
const t = initTRPC.context<TRPCContext>().create({
    transformer: superjson,
});

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure (requires authentication)
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to access this resource',
        });
    }
    return next({
        ctx: {
            ...ctx,
            user: ctx.user, // Now guaranteed to be non-null
        },
    });
});

// tRPC server adapter for Hono
export function trpcServer(opts: {
    router: any;
    createContext: () => Promise<TRPCContext>;
    endpoint: string;
}) {
    return async (c: HonoContext) => {
        const { fetchRequestHandler } = await import('@trpc/server/adapters/fetch');

        return fetchRequestHandler({
            endpoint: opts.endpoint,
            req: c.req.raw,
            router: opts.router,
            createContext: opts.createContext,
        });
    };
}
