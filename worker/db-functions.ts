/**
 * Database functions for Cloudflare Workers
 * 
 * This file contains all database operations migrated from server/db.ts
 * Adapted to work with PlanetScale HTTP driver in Workers environment
 */

import { eq, desc, and } from 'drizzle-orm';
import type { Database } from './db';
import type { Env } from './index';
import { encrypt, decrypt, maskApiKey } from './encryption';
import { queryEngine } from './aiEngines';
import {
    users,
    projects,
    seedKeywords,
    derivativeQueries,
    analysisSessions,
    engineResponses,
    brandMentions,
    citationSources,
    actionItems,
    sarcasmCorpus,
    targetEngines,
    apiKeys,
    executionLogs,
} from '../drizzle/schema';

// ============ Project Functions ============

export async function getProjectsByUserId(db: Database, userId: number) {
    return db.query.projects.findMany({
        where: eq(projects.userId, userId),
        orderBy: [desc(projects.createdAt)],
    });
}

export async function createProject(
    db: Database,
    data: {
        userId: number;
        projectName: string;
        targetMarket: 'TW' | 'JP';
        brandName: string;
        competitors: string[];
    }
) {
    const result = await db.insert(projects).values(data).returning();
    return result[0];
}

export async function getProjectById(db: Database, projectId: number) {
    return db.query.projects.findFirst({
        where: eq(projects.id, projectId),
    });
}

export async function updateProject(
    db: Database,
    projectId: number,
    updates: Partial<{
        projectName: string;
        brandName: string;
        competitors: string[];
    }>
) {
    await db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function deleteProject(db: Database, projectId: number) {
    await db.delete(projects).where(eq(projects.id, projectId));
}

// ============ Seed Keyword Functions ============

export async function createSeedKeyword(
    db: Database,
    data: {
        projectId: number;
        keyword: string;
        searchVolume?: number;
    }
) {
    const result = await db.insert(seedKeywords).values(data).returning();
    return result[0];
}

export async function getSeedKeywordsWithCount(db: Database, projectId: number) {
    const keywords = await db.query.seedKeywords.findMany({
        where: eq(seedKeywords.projectId, projectId),
    });

    // Get query count for each keyword
    const keywordsWithCount = await Promise.all(
        keywords.map(async (kw) => {
            const queries = await db.query.derivativeQueries.findMany({
                where: eq(derivativeQueries.seedKeywordId, kw.id),
            });
            return {
                ...kw,
                queryCount: queries.length,
            };
        })
    );

    return keywordsWithCount;
}

export async function deleteSeedKeyword(db: Database, keywordId: number) {
    // First delete all derivative queries
    await db.delete(derivativeQueries).where(eq(derivativeQueries.seedKeywordId, keywordId));
    // Then delete the keyword itself
    await db.delete(seedKeywords).where(eq(seedKeywords.id, keywordId));
}

export async function getDerivativeQueriesBySeedKeywordId(
    db: Database,
    seedKeywordId: number
) {
    return db.query.derivativeQueries.findMany({
        where: eq(derivativeQueries.seedKeywordId, seedKeywordId),
    });
}

// ============ Query Generation ============

export async function generateQueries(
    db: Database,
    env: Env,
    input: {
        seedKeywordId: number;
        seedKeyword: string;
        targetMarket: 'TW' | 'JP';
    }
) {
    console.log(`[Generate Queries] Starting for keyword: ${input.seedKeyword} (ID: ${input.seedKeywordId})`);

    // 0. Delete existing queries for this keyword (for regeneration)
    await db
        .delete(derivativeQueries)
        .where(eq(derivativeQueries.seedKeywordId, input.seedKeywordId))
        .run();

    console.log(`[Generate Queries] Deleted existing queries`);

    // 1. Generate template queries
    const templateQueries = generateTemplateQueries(input.seedKeyword, input.targetMarket);
    console.log(`[Generate Queries] Generated ${templateQueries.length} template queries`);

    // 2. Generate AI creative queries
    let aiQueries: string[] = [];
    let aiError: string | null = null;
    try {
        aiQueries = await generateAIQueries(env, input.seedKeyword, input.targetMarket);
        console.log(`[Generate Queries] Generated ${aiQueries.length} AI queries`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        aiError = errorMessage;
        console.error('[Generate Queries] Failed to generate AI queries:', errorMessage);
        // Continue with template queries only
    }

    // Combine all queries
    const allQueries = [
        ...templateQueries.map(q => ({
            seedKeywordId: input.seedKeywordId,
            queryText: q,
            generationType: 'template' as const,
        })),
        ...aiQueries.map(q => ({
            seedKeywordId: input.seedKeywordId,
            queryText: q,
            generationType: 'ai_creative' as const,
        })),
    ];

    // Save to database
    if (allQueries.length > 0) {
        await db.insert(derivativeQueries).values(allQueries);
        console.log(`[Generate Queries] Saved ${allQueries.length} queries to database`);
    }

    return {
        total: allQueries.length,
        template: templateQueries.length,
        aiCreative: aiQueries.length,
        aiError,  // Include error message if AI generation failed
        queries: allQueries,
    };
}

async function generateAIQueries(
    env: Env,
    seedKeyword: string,
    market: 'TW' | 'JP'
): Promise<string[]> {
    // Check for Gemini API key
    if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const marketContext = market === 'TW'
        ? '台灣市場，使用繁體中文'
        : '日本市場，使用日文';

    const prompt = `你是一個專業的 SEO 和市場研究專家。請為關鍵字「${seedKeyword}」生成 10 個創意搜尋問句。

市場：${marketContext}

要求：
1. 問句要符合真實用戶的搜尋習慣
2. 涵蓋不同的搜尋意圖：資訊型、比較型、購買型
3. 包含長尾關鍵字
4. 考慮當地文化和語言習慣
5. 每個問句一行，不要編號，不要任何前綴

範例格式：
${seedKeyword} 2025 最新推薦
${seedKeyword} 和 XX 哪個好
${seedKeyword} 使用心得分享

請直接輸出 10 個問句，每行一個，不要任何額外說明：`;

    try {
        console.log(`[AI Query Generation] Starting for keyword: ${seedKeyword}`);

        // Call Gemini API directly
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1000,
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{
                        text?: string;
                    }>;
                };
            }>;
        };

        console.log(`[AI Query Generation] Gemini response received`);

        // Extract text from response
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content || typeof content !== 'string') {
            console.error('[AI Query Generation] Invalid Gemini response format:', JSON.stringify(data));
            return [];
        }

        console.log(`[AI Query Generation] Raw content:`, content);

        // Split by newlines and filter empty lines
        const queries = content
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => {
                // Filter out empty lines, numbered lines, and lines that are just punctuation
                return line.length > 0
                    && !line.match(/^\d+[\.):]/)  // Remove numbered lines
                    && !line.match(/^[-*•]/)      // Remove bullet points
                    && line.length > 3;           // Remove very short lines
            })
            .slice(0, 10); // Take first 10

        console.log(`[AI Query Generation] Generated ${queries.length} queries:`, queries);

        return queries;
    } catch (error) {
        console.error('[AI Query Generation] Failed:', error);
        // Log more details
        if (error instanceof Error) {
            console.error('[AI Query Generation] Error details:', error.message, error.stack);
        }
        throw error; // Re-throw to show error in toast
    }
}

function generateTemplateQueries(seedKeyword: string, market: 'TW' | 'JP'): string[] {
    const templates = [
        `${seedKeyword} PTT 推薦`,
        `${seedKeyword} Dcard 評價`,
        `${seedKeyword} Mobile01 心得`,
        `${seedKeyword} 2025 推薦`,
        `${seedKeyword} 哪裡買`,
        `${seedKeyword} 優缺點`,
        `${seedKeyword} 價格比較`,
        `${seedKeyword} 使用心得`,
        `${seedKeyword} 好用嗎`,
        `${seedKeyword} 評測`,
    ];

    if (market === 'JP') {
        templates.push(
            `${seedKeyword} 口コミ`,
            `${seedKeyword} レビュー`,
            `${seedKeyword} おすすめ`,
            `${seedKeyword} 比較`,
            `${seedKeyword} 価格`
        );
    }

    return templates;
}

// ============ Analysis Session Functions ============

export async function createAnalysisSession(
    db: Database,
    data: {
        projectId: number;
        status: 'pending' | 'running' | 'completed' | 'failed';
    }
) {
    const result = await db.insert(analysisSessions).values(data).returning();
    return result[0];
}

export async function getAnalysisSessionsByProjectId(db: Database, projectId: number) {
    return db.query.analysisSessions.findMany({
        where: eq(analysisSessions.projectId, projectId),
        orderBy: [desc(analysisSessions.startedAt)],
    });
}

export async function getAnalysisSessionById(db: Database, sessionId: number) {
    return db.query.analysisSessions.findFirst({
        where: eq(analysisSessions.id, sessionId),
    });
}

export async function getExecutionLogsBySessionId(db: Database, sessionId: number) {
    return db.query.executionLogs.findMany({
        where: eq(executionLogs.sessionId, sessionId),
        orderBy: [desc(executionLogs.createdAt)],
    });
}

// ============ Placeholder Functions ============
// These need full implementation based on original server/db.ts

export async function startBatchTest(
    db: Database,
    env: Env,
    userId: number,
    sessionId: number
) {
    // 1. Get session data
    const session = await db
        .select()
        .from(analysisSessions)
        .where(eq(analysisSessions.id, sessionId))
        .get();

    if (!session) {
        throw new Error('Session not found');
    }

    // 2. Get project data
    const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, session.projectId))
        .get();

    if (!project) {
        throw new Error('Project not found');
    }

    // 3. Update session status to 'running'
    await db
        .update(analysisSessions)
        .set({
            status: 'running',
            startedAt: new Date(),
        })
        .where(eq(analysisSessions.id, sessionId))
        .run();

    // 4. Get Durable Object instance
    const doId = env.SESSION_PROGRESS.idFromName(`session-${sessionId}`);
    const stub = env.SESSION_PROGRESS.get(doId);

    // 5. Start batch test execution
    try {
        await stub.fetch('https://fake-host/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                projectId: session.projectId,
                userId,
                targetMarket: project.targetMarket,
            }),
        });

        return { success: true };
    } catch (error) {
        // Update session status to 'failed' if DO initialization fails
        await db
            .update(analysisSessions)
            .set({
                status: 'failed',
                completedAt: new Date(),
            })
            .where(eq(analysisSessions.id, sessionId))
            .run();

        throw error;
    }
}

export async function getSessionMetrics(db: Database, sessionId: number) {
    // TODO: Implement metrics calculation
    throw new Error('Not implemented yet');
}

export async function generateAnalysisReport(
    db: Database,
    env: Env,
    sessionId: number
) {
    // TODO: Implement report generation
    throw new Error('Not implemented yet');
}

export async function getAllSarcasmCorpus(db: Database) {
    return db.query.sarcasmCorpus.findMany();
}

export async function getSarcasmCorpusByMarket(
    db: Database,
    market: 'taiwan' | 'japan'
) {
    return db.query.sarcasmCorpus.findMany({
        where: eq(sarcasmCorpus.market, market),
    });
}

export async function createSarcasmCorpusEntry(
    db: Database,
    data: {
        market: 'taiwan' | 'japan';
        platform: string;
        text: string;
        explanation?: string;
        category: 'irony' | 'sarcasm' | 'understatement' | 'exaggeration' | 'other';
        createdBy: number;
    }
) {
    const result = await db.insert(sarcasmCorpus).values(data).returning();
    return result[0];
}

export async function deleteSarcasmCorpusEntry(
    db: Database,
    id: number,
    userId: number
) {
    await db.delete(sarcasmCorpus).where(
        and(eq(sarcasmCorpus.id, id), eq(sarcasmCorpus.createdBy, userId))
    );
}

export async function updateActionItemStatus(
    db: Database,
    itemId: number,
    status: 'pending' | 'in_progress' | 'completed'
) {
    await db.update(actionItems).set({ status }).where(eq(actionItems.id, itemId));
}

export async function getActiveTargetEngines(db: Database) {
    return db.query.targetEngines.findMany({
        where: eq(targetEngines.isActive, true),
    });
}

// ============ API Key Functions ============

export async function getApiKeysByUserId(db: Database, userId: number) {
    const keys = await db.query.apiKeys.findMany({
        where: eq(apiKeys.userId, userId),
    });

    // Don't return the actual API key, mask it
    return keys.map(k => ({
        ...k,
        apiKey: maskApiKey(k.apiKey),
    }));
}

export async function createApiKey(
    db: Database,
    env: Env,
    userId: number,
    provider: 'openai' | 'perplexity' | 'google',
    apiKey: string
) {
    // Encrypt the API key
    const encryptedKey = await encrypt(apiKey, env);

    const result = await db.insert(apiKeys).values({
        userId,
        provider,
        apiKey: encryptedKey,
        isActive: true,
    }).returning();

    const newKey = result[0];

    if (!newKey) {
        throw new Error('Failed to create API key');
    }

    return {
        ...newKey,
        apiKey: maskApiKey(apiKey), // Return masked version
    };
}

export async function updateApiKey(
    db: Database,
    env: Env,
    keyId: number,
    userId: number,
    apiKey: string
) {
    // Encrypt the new API key
    const encryptedKey = await encrypt(apiKey, env);

    await db.update(apiKeys)
        .set({ apiKey: encryptedKey })
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
}

export async function deleteApiKey(db: Database, keyId: number, userId: number) {
    await db.delete(apiKeys).where(
        and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
    );
}

export async function getDecryptedApiKey(
    db: Database,
    env: Env,
    userId: number,
    provider: 'openai' | 'perplexity' | 'google'
): Promise<string | null> {
    const key = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.provider, provider),
            eq(apiKeys.isActive, true)
        ),
    });

    if (!key) {
        return null;
    }

    // Decrypt the API key
    return decrypt(key.apiKey, env);
}

export async function testApiKey(
    db: Database,
    env: Env,
    userId: number,
    provider: 'openai' | 'perplexity' | 'google',
    query: string
) {
    const apiKey = await getDecryptedApiKey(db, env, userId, provider);

    if (!apiKey) {
        throw new Error(`No API key found for ${provider}`);
    }

    // Test the API key by making a simple query
    const response = await queryEngine(provider, apiKey, query);

    return {
        content: response.content,
        citations: response.citations || [],
    };
}
