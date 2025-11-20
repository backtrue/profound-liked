import { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { jwtVerify, SignJWT } from 'jose';
import { COOKIE_NAME } from '../shared/const';
import type { Env } from './index';
import { createDatabase } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

interface OAuthUserInfo {
    openId: string;
    name?: string;
    email?: string;
    loginMethod: string;
}

export async function handleOAuthCallback(c: Context<{ Bindings: Env }>) {
    const env = c.env;
    const url = new URL(c.req.url);

    // Get authorization code from query params
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
        return c.json({ error: 'Missing authorization code' }, 400);
    }

    try {
        // Exchange code for user info (Google OAuth)
        const userInfo = await exchangeCodeForUserInfo(code, env);

        // Get or create user in database
        const db = createDatabase(env);

        let user = await db.query.users.findFirst({
            where: eq(users.openId, userInfo.openId),
        });

        if (!user) {
            // Create new user
            const [newUser] = await db.insert(users).values({
                openId: userInfo.openId,
                name: userInfo.name || null,
                email: userInfo.email || null,
                loginMethod: userInfo.loginMethod,
                role: 'user',
                lastSignedIn: new Date(),
            });

            user = await db.query.users.findFirst({
                where: eq(users.openId, userInfo.openId),
            });
        } else {
            // Update last signed in
            await db.update(users)
                .set({ lastSignedIn: new Date() })
                .where(eq(users.id, user.id));
        }

        if (!user) {
            throw new Error('Failed to create or retrieve user');
        }

        // Create JWT token
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const token = await new SignJWT({
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            loginMethod: user.loginMethod,
            role: user.role,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret);

        // Set cookie
        setCookie(c, COOKIE_NAME, token, {
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        // Redirect back to frontend
        const frontendUrl = env.FRONTEND_URL || env.OAUTH_SERVER_URL || '/';
        return c.redirect(frontendUrl);
    } catch (error) {
        console.error('OAuth callback error:', error);
        return c.json({ error: 'Authentication failed' }, 500);
    }
}

async function exchangeCodeForUserInfo(
    code: string,
    env: Env
): Promise<OAuthUserInfo> {
    // This is a simplified version - you'll need to implement the actual
    // Google OAuth token exchange

    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID || '',
            client_secret: env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: `${env.OAUTH_SERVER_URL}/api/oauth/callback`,
            grant_type: 'authorization_code',
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Failed to exchange code for token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };

    // 2. Get user info from Google
    const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        }
    );

    if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info');
    }

    const googleUser = await userInfoResponse.json() as {
        id: string;
        name?: string;
        email?: string;
    };

    return {
        openId: `google:${googleUser.id}`,
        name: googleUser.name,
        email: googleUser.email,
        loginMethod: 'google',
    };
}
