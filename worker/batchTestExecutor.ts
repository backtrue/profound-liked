/**
 * Batch Test Executor for Cloudflare Workers
 * 
 * Due to Workers CPU time limits, we use Durable Objects to handle long-running batch tests.
 * The main executor triggers the Durable Object, which then processes queries asynchronously.
 */

import type { Database } from './db';
import type { Env } from './index';
import { queryEngine } from './aiEngines';
import { getDecryptedApiKey } from './db-functions';

export interface BatchTestParams {
    sessionId: number;
    userId: number;
    projectId: number;
    brandName: string;
    competitors: string[];
}

/**
 * Start batch test execution by triggering the Durable Object
 */
export async function startBatchTest(
    db: Database,
    env: Env,
    userId: number,
    sessionId: number
): Promise<void> {
    // Get session and project data
    const session = await db.query.analysisSessions.findFirst({
        where: (analysisSessions, { eq }) => eq(analysisSessions.id, sessionId),
    });

    if (!session) {
        throw new Error('Analysis session not found');
    }

    const project = await db.query.projects.findFirst({
        where: (projects, { eq }) => eq(projects.id, session.projectId),
    });

    if (!project) {
        throw new Error('Project not found');
    }

    // Update session status to running
    await db.update(db.query.analysisSessions)
        .set({ status: 'running' })
        .where((analysisSessions, { eq }) => eq(analysisSessions.id, sessionId));

    // Get the Durable Object for this session
    const id = env.SESSION_PROGRESS.idFromName(`session-${sessionId}`);
    const stub = env.SESSION_PROGRESS.get(id);

    // Trigger batch test execution in the Durable Object
    // The DO will handle the long-running process
    await stub.fetch(new Request('https://internal/batch-test', {
        method: 'POST',
        body: JSON.stringify({
            sessionId,
            userId,
            projectId: project.id,
            brandName: project.brandName,
            competitors: project.competitors || [],
        }),
    }));
}

/**
 * Helper functions for batch test execution
 * These are used by the Durable Object
 */

// Rate limit configuration
export const RATE_LIMITS: Record<string, { delayMs: number; maxRetries: number }> = {
    google: { delayMs: 2500, maxRetries: 5 },
    openai: { delayMs: 1000, maxRetries: 3 },
    perplexity: { delayMs: 1000, maxRetries: 3 },
};

export function isRetryableError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage.includes('503') || errorMessage.includes('429') || errorMessage.includes('overloaded');
}

export function getRetryDelay(error: any, attempt: number): number {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if error message contains suggested retry delay
    const match = errorMessage.match(/retry in (\d+)/);
    if (match && match[1]) {
        return parseInt(match[1]) * 1000;
    }

    // Exponential backoff: 5s, 10s, 20s, 40s, 80s
    const baseDelay = 5000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);

    // Add random jitter (±20%)
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    const finalDelay = Math.floor(exponentialDelay + jitter);

    // Cap at 2 minutes
    return Math.min(finalDelay, 120000);
}

export function mapEngineToProvider(engineName: string): 'openai' | 'perplexity' | 'google' | null {
    const nameLower = engineName.toLowerCase();

    if (nameLower.includes('chatgpt') || nameLower.includes('openai') || nameLower.includes('gpt')) {
        return 'openai';
    }

    if (nameLower.includes('perplexity')) {
        return 'perplexity';
    }

    if (nameLower.includes('gemini') || nameLower.includes('google')) {
        return 'google';
    }

    return null;
}

export function classifySourceType(url: string): 'official' | 'ecommerce' | 'forum' | 'media' | 'video' | 'competitor' | 'unknown' {
    const urlLower = url.toLowerCase();

    // E-commerce
    if (urlLower.includes('shopee') || urlLower.includes('pchome') || urlLower.includes('momo') ||
        urlLower.includes('amazon') || urlLower.includes('rakuten')) {
        return 'ecommerce';
    }

    // Forum
    if (urlLower.includes('ptt.cc') || urlLower.includes('dcard') || urlLower.includes('mobile01') ||
        urlLower.includes('reddit') || urlLower.includes('2ch') || urlLower.includes('5ch')) {
        return 'forum';
    }

    // Video
    if (urlLower.includes('youtube') || urlLower.includes('youtu.be') || urlLower.includes('vimeo')) {
        return 'video';
    }

    // Media
    if (urlLower.includes('news') || urlLower.includes('blog') || urlLower.includes('medium') ||
        urlLower.includes('udn') || urlLower.includes('chinatimes') || urlLower.includes('ltn')) {
        return 'media';
    }

    return 'unknown';
}

export function detectBrandMentions(
    text: string,
    brandName: string,
    competitors: string[]
): Array<{
    brandName: string;
    context: string;
    rankPosition: number | null;
    sentimentScore: number;
    isSarcastic: boolean;
}> {
    const mentions: Array<{
        brandName: string;
        context: string;
        rankPosition: number | null;
        sentimentScore: number;
        isSarcastic: boolean;
    }> = [];

    const allBrands = [brandName, ...competitors];

    for (const brand of allBrands) {
        const regex = new RegExp(brand, 'gi');
        const matches = text.match(regex);

        if (matches && matches.length > 0) {
            const index = text.toLowerCase().indexOf(brand.toLowerCase());
            const start = Math.max(0, index - 50);
            const end = Math.min(text.length, index + brand.length + 50);
            const context = text.substring(start, end);

            const sentimentScore = analyzeSentiment(context);
            const isSarcastic = detectSarcasm(context);

            mentions.push({
                brandName: brand,
                context,
                rankPosition: null,
                sentimentScore,
                isSarcastic,
            });
        }
    }

    return mentions;
}

function analyzeSentiment(text: string): number {
    const positiveWords = ['好', '推薦', '優秀', '棒', '讚', 'excellent', 'great', 'good', 'recommend'];
    const negativeWords = ['爛', '差', '不推', '雷', 'bad', 'poor', 'terrible', 'avoid'];

    const textLower = text.toLowerCase();
    let score = 0;

    for (const word of positiveWords) {
        if (textLower.includes(word)) score += 0.3;
    }

    for (const word of negativeWords) {
        if (textLower.includes(word)) score -= 0.3;
    }

    return Math.max(-1, Math.min(1, score));
}

function detectSarcasm(text: string): boolean {
    const sarcasticPatterns = [
        '呵呵', '笑死', '真香', '反串', '酸', '諷刺',
        'lol', 'yeah right', 'sure', 'totally'
    ];

    const textLower = text.toLowerCase();
    return sarcasticPatterns.some(pattern => textLower.includes(pattern));
}

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
